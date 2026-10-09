import { Router, Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import { getChannelById, getAllChannels } from './channels.js';
import { recordChannelClick } from '../src/db/storage.js';

const router = Router();

// Track active FFmpeg transcoding processes to prevent leaks
const activeTranscodingSessions = new Map<string, { pid: number; channelId: string; startTime: number; clientIp: string; process: ChildProcess }>();

/**
 * Robust channel resolver:
 * - Strips media extensions (.mp4, .ts, .m3u, .ram) case-insensitively
 * - Decodes URL components
 * - Performs case-insensitive fallback search
 */
async function resolveChannel(rawInput: string): Promise<any | null> {
  if (!rawInput) return null;
  let clean = decodeURIComponent(rawInput).trim();
  clean = clean.replace(/\.(mp4|ts|m3u|ram)$/i, '');

  let channel = await getChannelById(clean);
  if (!channel && clean !== rawInput) {
    channel = await getChannelById(rawInput);
  }
  if (!channel) {
    const all = await getAllChannels();
    channel = all.find(c => c.id.toLowerCase() === clean.toLowerCase() || c.id.toLowerCase() === rawInput.toLowerCase()) || null;
  }
  return channel;
}

// OPTIONS preflight for streaming endpoints
router.options(['/e72/stream/:id.:ext', '/e72/stream/:id', '/e72/play/:id.:ext', '/e72/play/:id'], (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
  res.end();
});

/**
 * Endpoint /e72/stream/:id or /e72/stream/:id.:ext (e.g. .ts or .mp4)
 * Dedicated real-time transcoding gateway for Nokia E72 / Symbian S60v3
 * - Supports both MPEG-TS (MIME video/MP2T) and Fragmented MP4 (MIME video/mp4)
 * - Downscales video to QVGA 320x240 (with aspect ratio preservation and letterboxing)
 * - Encodes with H.264 Baseline Profile @ Level 1.2 (hardware-decodable on ARM11 600MHz)
 * - Bitrate capped at 350-400 kbps (ideal for 3G/Wi-Fi on Nokia E72)
 * - Converts audio to AAC-LC 64 kbps, 44.1 kHz stereo
 * - Serves over plain HTTP with inline Content-Disposition for 1-Touch opening
 */
router.all(['/e72/stream/:id.:ext', '/e72/stream/:id'], async (req: Request, res: Response) => {
  const rawId = req.params.id || '';
  const extParam = (req.params.ext || '').toLowerCase();
  const formatQuery = (req.query.format as string || req.query.type as string || '').toLowerCase();

  const isMp4 = extParam === 'mp4' || formatQuery === 'mp4' || /\.mp4$/i.test(rawId);

  const channel = await resolveChannel(rawId);

  if (!channel) {
    return res.status(404).send('Kênh không tồn tại');
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const sessionId = `${channel.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // Record click / view asynchronously
  recordChannelClick(channel.id).catch(() => {});

  // Set HTTP headers optimized for Symbian / CorePlayer / RealPlayer
  const contentType = isMp4 ? 'video/mp4' : 'video/MP2T';
  const safeId = channel.id.replace(/[^\w-]/g, '_');
  const fileName = `${safeId}_e72.${isMp4 ? 'mp4' : 'ts'}`;

  // HEAD request support: Return headers immediately without spawning FFmpeg
  if (req.method === 'HEAD') {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'close',
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'none',
    });
    return res.end();
  }

  // Pre-cleanup: Clean up older active sessions from the same client to prevent resource exhaustion
  for (const [sid, info] of activeTranscodingSessions.entries()) {
    if (info.clientIp === clientIp && info.channelId === channel.id) {
      try {
        info.process.kill('SIGKILL');
      } catch {}
      activeTranscodingSessions.delete(sid);
    }
  }

  console.log(`[E72 Transcode] Starting ${isMp4 ? 'MP4' : 'MPEG-TS'} stream for "${channel.name}" (${channel.id}) to ${clientIp} [Session: ${sessionId}]`);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename="${fileName}"`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'close',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'none',
  });

  // Base FFmpeg arguments tailored strictly to Nokia E72 hardware capabilities
  const ffmpegArgs = [
    '-re', // Read input at native framerate
    '-reconnect', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '3',
    '-timeout', '12000000', // 12s socket timeout
    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-i', channel.stream_url,
    // Video: 320x240 QVGA with padding to preserve aspect ratio
    '-vf', 'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '1.2',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-b:v', '350k',
    '-maxrate', '400k',
    '-bufsize', '800k',
    '-r', '24',
    '-g', '48', // 2-second GOP
    // Audio: AAC-LC 64k stereo 44.1kHz
    '-c:a', 'aac',
    '-b:a', '64k',
    '-ar', '44100',
    '-ac', '2',
  ];

  if (isMp4) {
    // Fragmented MP4 progressive stream for RealPlayer / CorePlayer
    ffmpegArgs.push('-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1');
  } else {
    // MPEG-TS over HTTP pipe
    ffmpegArgs.push('-f', 'mpegts', 'pipe:1');
  }

  let ffmpeg: ChildProcess;
  try {
    ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error(`[E72 Transcode] Failed to spawn ffmpeg:`, err);
    if (!res.headersSent) {
      res.status(500).send('Lỗi khởi động bộ chuyển đổi video trên máy chủ');
    }
    return;
  }

  if (ffmpeg.pid) {
    activeTranscodingSessions.set(sessionId, {
      pid: ffmpeg.pid,
      channelId: channel.id,
      startTime: Date.now(),
      clientIp,
      process: ffmpeg,
    });
  }

  // Pipe MPEG-TS output directly to the client response stream
  if (ffmpeg.stdout) {
    ffmpeg.stdout.pipe(res);
  }

  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    activeTranscodingSessions.delete(sessionId);
    console.log(`[E72 Transcode] Session ${sessionId} ended. Killing FFmpeg process (PID ${ffmpeg.pid})`);

    try {
      if (ffmpeg.stdin && !ffmpeg.stdin.destroyed) ffmpeg.stdin.destroy();
      if (ffmpeg.stdout && !ffmpeg.stdout.destroyed) ffmpeg.stdout.destroy();
      if (ffmpeg.stderr && !ffmpeg.stderr.destroyed) ffmpeg.stderr.destroy();
      ffmpeg.kill('SIGKILL');
    } catch (e) {
      // Process already terminated
    }
  };

  // When Nokia E72 client disconnects (user stops player or changes channel)
  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  ffmpeg.on('error', (err) => {
    console.error(`[E72 Transcode] FFmpeg error [Session ${sessionId}]:`, err);
    cleanup();
  });

  ffmpeg.on('exit', (code, signal) => {
    console.log(`[E72 Transcode] FFmpeg exited with code ${code}, signal ${signal} [Session ${sessionId}]`);
    cleanup();
  });

  if (ffmpeg.stderr) {
    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      // Only log critical errors to keep server logs clean
      if (msg.includes('Error') || msg.includes('fatal') || msg.includes('Server returned 4')) {
        console.warn(`[E72 Transcode FFmpeg stderr]: ${msg.trim()}`);
      }
    });
  }
});

/**
 * Endpoint /e72/play/:id
 * Smart 1-Touch Launcher for Nokia E72:
 * Triggers native players (CorePlayer or RealPlayer) automatically upon browser click
 * - ?type=m3u (default): Inline M3U playlist file with audio/x-mpegurl MIME type.
 *   On Symbian S60v3 browser, immediately prompts "Mở bằng CorePlayer" (Open with CorePlayer).
 * - ?type=ts: Direct MPEG-TS 320x240 stream (video/MP2T).
 * - ?type=mp4: Direct Fragmented MP4 320x240 stream (video/mp4).
 * - ?type=ram: RealPlayer RAM metafile (audio/x-pn-realaudio) for RealPlayer.
 * - ?type=coreplayer: Redirects to coreplayer:// scheme.
 */
router.get(['/e72/play/:id.:ext', '/e72/play/:id'], async (req: Request, res: Response) => {
  let channelId = req.params.id || '';
  const extParam = (req.params.ext || '').toLowerCase();
  let type = ((req.query.type as string) || (req.query.format as string) || extParam || '').toLowerCase();

  if (channelId.endsWith('.mp4')) {
    channelId = channelId.slice(0, -4);
    if (!type) type = 'mp4';
  } else if (channelId.endsWith('.ts')) {
    channelId = channelId.slice(0, -3);
    if (!type) type = 'ts';
  } else if (channelId.endsWith('.m3u')) {
    channelId = channelId.slice(0, -4);
    if (!type) type = 'm3u';
  } else if (channelId.endsWith('.ram')) {
    channelId = channelId.slice(0, -4);
    if (!type) type = 'ram';
  }

  if (!type) type = 'm3u';

  let channel = await resolveChannel(channelId);
  if (!channel && channelId !== req.params.id) {
    channel = await resolveChannel(req.params.id);
  }

  if (!channel) {
    return res.status(404).send('Kênh không tồn tại');
  }

  const host = req.get('host') || '0.0.0.0:10000';
  const safeId = channel.id.replace(/[^\w-]/g, '_');

  // 1. Direct TS Redirect
  if (type === 'ts') {
    return res.redirect(`/e72/stream/${encodeURIComponent(channel.id)}.ts`);
  }

  // 2. Direct MP4 Redirect
  if (type === 'mp4') {
    return res.redirect(`/e72/stream/${encodeURIComponent(channel.id)}.mp4`);
  }

  // 3. RealPlayer RAM metafile (natively launched by RealPlayer in Symbian)
  if (type === 'ram' || type === 'realplayer') {
    const ramContent = `http://${host}/e72/stream/${encodeURIComponent(channel.id)}.mp4\n`;
    res.setHeader('Content-Type', 'audio/x-pn-realaudio');
    res.setHeader('Content-Disposition', `inline; filename="${safeId}_e72.ram"`);
    return res.send(ramContent);
  }

  // 4. Custom URI Scheme
  if (type === 'coreplayer' || type === 'scheme') {
    return res.redirect(`coreplayer://http://${host}/e72/stream/${encodeURIComponent(channel.id)}.ts`);
  }

  // 5. Default: Inline M3U file (Gold standard for 1-Touch CorePlayer on Nokia E72)
  const streamUrl = `http://${host}/e72/stream/${encodeURIComponent(channel.id)}.ts`;
  const m3uContent = `#EXTM3U
#EXTINF:-1 tvg-id="${channel.tvg_id || ''}" tvg-name="${channel.name}" group-title="${channel.group}",${channel.name} [E72]
${streamUrl}
`;

  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${safeId}_e72.m3u"`);
  res.send(m3uContent);
});

/**
 * Endpoint /e72/channel/:id.m3u
 * Single-channel M3U playlist file for Nokia E72 CorePlayer one-click opening
 */
router.get(['/e72/channel/:id.m3u', '/e72/channel/:id'], async (req: Request, res: Response) => {
  let channelId = req.params.id || '';
  if (channelId.endsWith('.m3u')) {
    channelId = channelId.slice(0, -4);
  }

  let channel = await resolveChannel(channelId);
  if (!channel && channelId !== req.params.id) {
    channel = await resolveChannel(req.params.id);
  }

  if (!channel) {
    return res.status(404).send('Kênh không tồn tại');
  }

  const host = req.get('host') || '0.0.0.0:10000';
  const safeId = channel.id.replace(/[^\w-]/g, '_');
  // Use http scheme so Nokia E72 won't attempt SSL handshake
  const streamUrl = `http://${host}/e72/stream/${encodeURIComponent(channel.id)}.ts`;

  const m3uContent = `#EXTM3U
#EXTINF:-1 tvg-id="${channel.tvg_id || ''}" tvg-name="${channel.name}" group-title="${channel.group}",${channel.name} [E72 QVGA 320x240]
${streamUrl}
`;

  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${safeId}_e72.m3u"`);
  res.send(m3uContent);
});

/**
 * Endpoint /e72/playlist.m3u
 * Full M3U playlist containing all channels converted into Nokia E72 stream URLs
 */
router.get('/e72/playlist.m3u', async (req: Request, res: Response) => {
  try {
    const channels = await getAllChannels();
    const host = req.get('host') || '0.0.0.0:10000';

    let content = '#EXTM3U name="MY IPTV - Nokia E72 Edition (QVGA 320x240)"\n\n';

    for (const c of channels) {
      const streamUrl = `http://${host}/e72/stream/${encodeURIComponent(c.id)}`;
      content += `#EXTINF:-1 tvg-id="${c.tvg_id || ''}" tvg-name="${c.name}" tvg-logo="${c.logo || ''}" group-title="${c.group}",${c.name}\n`;
      content += `${streamUrl}\n\n`;
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nokia_e72_iptv.m3u"');
    res.send(content);
  } catch (err: any) {
    res.status(500).send(`Error generating playlist: ${err.message}`);
  }
});

/**
 * Endpoint /e72/status
 * Health check & active stream counter for Nokia E72 transcoding pipeline
 */
router.get('/e72/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    activeSessionsCount: activeTranscodingSessions.size,
    sessions: Array.from(activeTranscodingSessions.entries()).map(([sessionId, info]) => ({
      sessionId,
      channelId: info.channelId,
      clientIp: info.clientIp,
      uptimeSeconds: Math.floor((Date.now() - info.startTime) / 1000),
    })),
  });
});

export default router;
