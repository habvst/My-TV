import { Router, Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import zlib from 'zlib';

const router = Router();

// Reusable Keep-Alive agents to avoid TCP handshake overhead and socket exhaustion on IPTV streams
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 60000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 60000,
  rejectUnauthorized: false, // Permit IPTV servers with self-signed or expired certs
});

// Handle preflight CORS requests
router.options(['/api/proxy/stream', '/api/proxy/stream.m3u8', '/api/proxy/stream/playlist.m3u8'], (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.sendStatus(204);
});

/**
 * Universal IPTV Stream Proxy
 * - Resolves CORS issues for modern browsers
 * - Bridges mixed-content (HTTP streams loaded on HTTPS pages)
 * - Automatically rewrites .m3u8 manifests so that chunklists and .ts segments route through this proxy
 * - Maintains Keep-Alive connections to upstream IPTV servers
 */
router.get(['/api/proxy/stream', '/api/proxy/stream.m3u8', '/api/proxy/stream/playlist.m3u8'], async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" parameter');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Invalid protocol. Only HTTP and HTTPS are supported.');
    }
  } catch (err) {
    return res.status(400).send('Invalid target URL');
  }

  // Set global CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');

  try {
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;

    const requestHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Do not gzip manifests so we can rewrite text
      'Connection': 'keep-alive',
    };

    if (parsedUrl.origin) {
      requestHeaders['Referer'] = parsedUrl.origin + '/';
      requestHeaders['Origin'] = parsedUrl.origin;
    }

    if (req.headers.range) {
      requestHeaders['Range'] = req.headers.range as string;
    }

    const requestOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: requestHeaders,
      agent,
      timeout: 30000, // 30 seconds socket timeout to accommodate slower IPTV CDNs
      rejectUnauthorized: false,
    };

    const proxyReq = client.request(requestOptions, (remoteRes) => {
      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (
        remoteRes.statusCode &&
        [301, 302, 303, 307, 308].includes(remoteRes.statusCode) &&
        remoteRes.headers.location
      ) {
        try {
          const redirectUrl = new URL(remoteRes.headers.location, targetUrl).href;
          return res.redirect(`/api/proxy/stream?url=${encodeURIComponent(redirectUrl)}`);
        } catch {
          // Fall through
        }
      }

      const contentType = remoteRes.headers['content-type'] || '';
      const isM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        parsedUrl.pathname.endsWith('.m3u8') ||
        parsedUrl.search.includes('.m3u8');

      if (isM3u8 && req.method !== 'HEAD') {
        // Read manifest into buffer and rewrite segment links
        const chunks: Buffer[] = [];
        remoteRes.on('data', (chunk) => chunks.push(chunk));
        remoteRes.on('end', () => {
          let buffer = Buffer.concat(chunks);
          const encoding = (remoteRes.headers['content-encoding'] || '').toLowerCase();
          const isGzip = encoding === 'gzip' || (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);

          if (isGzip) {
            try {
              buffer = zlib.gunzipSync(buffer);
            } catch (err: any) {
              console.warn('[Proxy] Failed to gunzip manifest:', err.message);
            }
          } else if (encoding === 'deflate') {
            try {
              buffer = zlib.inflateSync(buffer);
            } catch (err: any) {
              console.warn('[Proxy] Failed to inflate manifest:', err.message);
            }
          } else if (encoding === 'br') {
            try {
              buffer = zlib.brotliDecompressSync(buffer);
            } catch (err: any) {
              console.warn('[Proxy] Failed to brotli decompress manifest:', err.message);
            }
          }

          const manifestText = buffer.toString('utf-8');

          if (!manifestText.includes('#EXTM3U')) {
            // Not a real manifest, send as-is
            res.setHeader('Content-Type', contentType || 'application/vnd.apple.mpegurl');
            return res.status(remoteRes.statusCode || 200).send(manifestText);
          }

          // Rewrite lines: any URI should go through /api/proxy/stream
          // Handles \r\n, \r, and \n line breaks cleanly
          const lines = manifestText.split(/\r\n|\r|\n/);
          const rewrittenLines = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            // Handle any tag containing URI="..." (e.g. #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, #EXT-X-I-FRAME-STREAM-INF)
            if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_match, uriVal) => {
                try {
                  const resolvedUri = new URL(uriVal, targetUrl).href;
                  const isSub = resolvedUri.includes('.m3u8');
                  const prefix = isSub ? '/api/proxy/stream.m3u8' : '/api/proxy/stream';
                  return `URI="${prefix}?url=${encodeURIComponent(resolvedUri)}"`;
                } catch {
                  return `URI="${uriVal}"`;
                }
              });
            }

            // Skip other comments and directives
            if (trimmed.startsWith('#')) {
              return line;
            }

            // Media URI or sub-manifest URI
            try {
              const resolvedMediaUrl = new URL(trimmed, targetUrl).href;
              const isSub = resolvedMediaUrl.includes('.m3u8');
              const prefix = isSub ? '/api/proxy/stream.m3u8' : '/api/proxy/stream';
              return `${prefix}?url=${encodeURIComponent(resolvedMediaUrl)}`;
            } catch {
              return line;
            }
          });

          const rewrittenManifest = rewrittenLines.join('\n');
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          return res.status(200).send(rewrittenManifest);
        });

        remoteRes.on('error', (err) => {
          console.error('[Proxy] Manifest read error:', err.message);
          if (!res.headersSent) res.status(502).send('Error reading stream manifest');
        });
      } else {
        // Binary media chunks (.ts, .aac, .m4s) or HEAD request: pipe directly
        res.status(remoteRes.statusCode || 200);
        if (contentType) res.setHeader('Content-Type', contentType);
        if (remoteRes.headers['content-length']) {
          res.setHeader('Content-Length', remoteRes.headers['content-length']);
        }
        if (remoteRes.headers['content-range']) {
          res.setHeader('Content-Range', remoteRes.headers['content-range']);
        }
        if (remoteRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', remoteRes.headers['accept-ranges']);
        }
        res.setHeader('Cache-Control', 'public, max-age=60');

        // Handle client abortion and remote stream errors cleanly
        res.on('close', () => {
          proxyReq.destroy();
        });

        remoteRes.on('error', (err) => {
          console.warn('[Proxy] Segment streaming error:', err.message);
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.destroy();
          }
        });

        remoteRes.pipe(res);
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).send('Stream source connection timed out');
    });

    proxyReq.on('error', (err) => {
      console.warn('[Proxy] Request error for', targetUrl, ':', err.message);
      if (!res.headersSent) res.status(502).send(`Proxy connection error: ${err.message}`);
    });

    proxyReq.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).send(`Internal proxy error: ${err.message}`);
    }
  }
});

export default router;
