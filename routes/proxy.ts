import { Router, Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import zlib from 'zlib';

const router = Router();

// Reusable Keep-Alive agents to avoid TCP handshake overhead while avoiding stale socket hang-ups
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1500,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 10000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1500,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 10000,
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
 * Perform proxy request with automatic 1-time fallback if a pooled socket hung up
 */
function handleProxyStream(req: Request, res: Response, targetUrl: string, isRetry = false) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Invalid protocol. Only HTTP and HTTPS are supported.');
    }
  } catch {
    return res.status(400).send('Invalid target URL');
  }

  // Set global CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');

  try {
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    // On retry after socket hang-up, use fresh connection (agent: false) instead of pooled agent
    const agent = isRetry ? false : isHttps ? httpsAgent : httpAgent;

    const requestHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Do not gzip manifests so we can rewrite text
      'Connection': isRetry ? 'close' : 'keep-alive',
    };

    if (parsedUrl.origin) {
      requestHeaders['Referer'] = parsedUrl.origin + '/';
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
      timeout: 10000, // 10 seconds timeout
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
            } catch {
              // Ignore gzip errors
            }
          } else if (encoding === 'deflate') {
            try {
              buffer = zlib.inflateSync(buffer);
            } catch {
              // Ignore inflate errors
            }
          } else if (encoding === 'br') {
            try {
              buffer = zlib.brotliDecompressSync(buffer);
            } catch {
              // Ignore brotli errors
            }
          }

          const manifestText = buffer.toString('utf-8');

          // If upstream sent an HTML error page or empty response, handle cleanly
          if (!manifestText.includes('#EXTM3U')) {
            if (!res.headersSent) {
              return res.status(remoteRes.statusCode && remoteRes.statusCode >= 400 ? remoteRes.statusCode : 502).json({
                error: 'invalid_manifest',
                message: 'Máy chủ phản hồi định dạng không phải M3U8',
                url: targetUrl
              });
            }
            return;
          }

          const lines = manifestText.split(/\r?\n/);
          const rewrittenLines = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
              // Special case: Rewrite URI in #EXT-X-KEY (DRM / AES encryption keys)
              if (trimmed.startsWith('#EXT-X-KEY:') && trimmed.includes('URI="')) {
                return trimmed.replace(/URI="([^"]+)"/, (_match, keyUri) => {
                  try {
                    const resolvedKeyUrl = new URL(keyUri, targetUrl).href;
                    return `URI="/api/proxy/stream?url=${encodeURIComponent(resolvedKeyUrl)}"`;
                  } catch {
                    return `URI="${keyUri}"`;
                  }
                });
              }
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

        remoteRes.on('error', (err: any) => {
          // Normal client abort when switching channels or seeking
          if (err?.message === 'aborted' || req.destroyed || res.writableEnded || res.destroyed) {
            return;
          }
          if (!res.headersSent) res.status(502).json({ error: 'manifest_read_error', message: err.message });
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

        // Handle client abortion cleanly when user switches channel or pauses
        res.on('close', () => {
          proxyReq.destroy();
        });

        remoteRes.on('error', (err: any) => {
          // Normal client abort when switching channels or seeking
          if (err?.message === 'aborted' || req.destroyed || res.writableEnded || res.destroyed) {
            return;
          }
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
      if (!res.headersSent && !res.writableEnded) {
        res.status(504).json({
          error: 'gateway_timeout',
          message: 'Thời gian kết nối đến máy chủ nguồn IPTV vượt quá 10 giây',
          url: targetUrl
        });
      }
    });

    proxyReq.on('error', (err: any) => {
      // If client aborted the connection, do not treat as an error
      if (req.destroyed || res.writableEnded || res.destroyed) {
        return;
      }

      // If pooled keep-alive socket hung up and we haven't retried yet, retry immediately with fresh socket
      if (!isRetry && (err.message.includes('socket hang up') || err.code === 'ECONNRESET')) {
        return handleProxyStream(req, res, targetUrl, true);
      }

      // Expected upstream network failures from random IPTV sources
      if (!res.headersSent) {
        res.status(502).json({
          error: 'upstream_unavailable',
          message: `Máy chủ IPTV nguồn từ chối kết nối hoặc không phản hồi (${err.code || err.message})`,
          url: targetUrl
        });
      }
    });

    proxyReq.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_proxy_error', message: err.message });
    }
  }
}

/**
 * Universal IPTV Stream Proxy Routes
 */
router.get(['/api/proxy/stream', '/api/proxy/stream.m3u8', '/api/proxy/stream/playlist.m3u8'], async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" parameter');
  }

  handleProxyStream(req, res, targetUrl, false);
});

export default router;
