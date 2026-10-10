import { Router, Request, Response } from 'express';
import { getChannelById } from './channels.js';
import { detectDevice } from '../utils/deviceDetector.js';

const router = Router();

router.get('/open/:channelId', async (req: Request, res: Response) => {
  const channelId = req.params.channelId;
  const channel = await getChannelById(channelId);

  const userAgent = req.headers['user-agent'] || '';
  const deviceInfo = detectDevice(userAgent);
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  const timestamp = new Date().toISOString();
  console.log(`[Stream Access] ${timestamp} | IP: ${clientIp} | Device: ${deviceInfo.type} | Channel: ${channelId} | Agent: ${userAgent.substring(0, 80)}`);

  if (!channel) {
    res.status(404).send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kênh không tồn tại</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .box { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; max-width: 400px; }
    a { color: #38bdf8; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Kênh không tồn tại</h2>
    <p>Mã kênh: <code>${escapeHtml(channelId)}</code></p>
    <p><a href="/">&larr; Quay lại trang chủ</a></p>
  </div>
</body>
</html>`);
    return;
  }

  // 1. If Symbian S60 / Nokia device, redirect directly to E72 launcher for CorePlayer
  if (deviceInfo.isNokiaS60) {
    return res.redirect(`/e72/play/${encodeURIComponent(channel.id)}?type=m3u`);
  }

  const streamUrl = channel.stream_url;
  const useDirectRedirect = req.query.direct === '1' || req.query.redirect === '1';
  const useScheme = req.query.scheme === 'coreplayer';

  // 2. Direct 302 redirect only if explicitly requested (e.g. ?direct=1 or custom scheme)
  if (useDirectRedirect) {
    const targetUrl = useScheme ? `coreplayer://${streamUrl}` : streamUrl;
    res.setHeader('Location', targetUrl);
    return res.status(302).end();
  }

  // 3. For modern browsers in new tabs, serve the high-performance Standalone Web Player
  // Ensures ALL channels (HLS, MP4, TS) play smoothly across Chrome, Edge, Firefox, Safari!
  const proxyUrl = `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}`;
  const gatewayUrl = `/e72/stream/${encodeURIComponent(channel.id)}.mp4`;
  const m3uUrl = `/e72/channel/${encodeURIComponent(channel.id)}.m3u`;
  const vlcScheme = `vlc://${streamUrl}`;
  const corePlayerScheme = `coreplayer://${streamUrl}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(channel.name)} - Trình phát Trực tuyến</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #18181b;
      border-bottom: 1px solid #27272a;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      width: 36px;
      height: 36px;
      object-fit: contain;
      background: #27272a;
      border-radius: 8px;
      padding: 2px;
    }
    .logo-placeholder {
      width: 36px;
      height: 36px;
      background: #dc2626;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    .title-box h1 {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .title-box p {
      font-size: 12px;
      color: #a1a1aa;
    }
    .live-badge {
      background: #dc2626;
      color: #fff;
      font-size: 10px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
    }
    .video-container {
      width: 100%;
      max-width: 960px;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 1px 1px #27272a;
    }
    video {
      width: 100%;
      height: 100%;
      background: #000;
      display: block;
    }
    .overlay-status {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 10;
      pointer-events: none;
    }
    .overlay-unmute {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(220, 38, 38, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: none;
      z-index: 20;
      border: 2px solid white;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    }
    .control-hub {
      width: 100%;
      max-width: 960px;
      margin-top: 16px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-red { background: #e11d48; color: #fff; }
    .btn-red:hover { background: #be123c; }
    .btn-amber { background: #d97706; color: #fff; }
    .btn-amber:hover { background: #b45309; }
    .btn-blue { background: #2563eb; color: #fff; }
    .btn-blue:hover { background: #1d4ed8; }
    .btn-emerald { background: #059669; color: #fff; }
    .btn-emerald:hover { background: #047857; }
    .btn-dark { background: #27272a; color: #e4e4e7; border-color: #3f3f46; }
    .btn-dark:hover { background: #3f3f46; color: #fff; }
    .url-bar {
      display: flex;
      align-items: center;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 4px 10px;
      gap: 8px;
    }
    .url-text {
      flex: 1;
      font-family: monospace;
      font-size: 12px;
      color: #10b981;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-btn {
      background: #27272a;
      color: #f4f4f5;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 500;
    }
    .copy-btn:hover { background: #3f3f46; }
    .note-box {
      font-size: 12px;
      color: #71717a;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      ${channel.logo ? `<img class="logo" src="${escapeHtml(channel.logo)}" alt="" onerror="this.style.display='none'" />` : `<div class="logo-placeholder">TV</div>`}
      <div class="title-box">
        <h1>${escapeHtml(channel.name)} <span class="live-badge">Trực tiếp</span></h1>
        <p>Thể loại: ${escapeHtml(channel.group)} &bull; Tab độc lập chuyên dụng</p>
      </div>
    </div>
    <div class="header-actions">
      <a href="/" class="btn btn-dark">&larr; Trang chủ</a>
    </div>
  </header>

  <main>
    <div class="video-container">
      <div id="statusBadge" class="overlay-status">&#9679; Đang kết nối luồng phát...</div>
      <button id="unmuteBtn" class="overlay-unmute">&#128266; Bấm để bật âm thanh</button>
      <video id="videoPlayer" controls autoplay playsinline preload="auto"></video>
    </div>

    <div class="control-hub">
      <div class="action-row">
        <!-- 1-Click Launchers for External Apps -->
        <a href="${escapeHtml(vlcScheme)}" class="btn btn-red" title="Kích hoạt ứng dụng VLC trên máy">&#9654; Mở app VLC</a>
        <a href="${escapeHtml(corePlayerScheme)}" class="btn btn-blue" title="Mở trong CorePlayer">&#128241; Mở CorePlayer</a>
        <a href="${escapeHtml(m3uUrl)}" class="btn btn-emerald" download="${escapeHtml(channel.id)}.m3u" title="Tải file playlist">&#128190; Tải file .M3U</a>
        <button id="toggleProxyBtn" class="btn btn-amber">&#128279; Đổi qua Proxy CORS</button>
        <button id="toggleGatewayBtn" class="btn btn-dark">&#9889; Phát luồng Gateway (MP4)</button>
      </div>

      <div class="url-bar">
        <span style="color:#71717a;font-size:11px;font-weight:bold;">URL:</span>
        <div id="urlText" class="url-text">${escapeHtml(streamUrl)}</div>
        <button id="copyUrlBtn" class="copy-btn">Sao chép</button>
      </div>

      <div class="note-box">
        <strong>Mẹo cho chuyên gia:</strong> Trình duyệt máy tính (Chrome/Edge/Firefox) không có giải mã HLS native trên thanh địa chỉ, do đó trang tab độc lập này đã tự động tích hợp sẵn bộ engine <strong>Hls.js</strong> để phát mượt mà tất cả các luồng phát IPTV mà không bị màn hình đen hoặc tải file về máy.
      </div>
    </div>
  </main>

  <script>
    (function() {
      const video = document.getElementById('videoPlayer');
      const statusBadge = document.getElementById('statusBadge');
      const unmuteBtn = document.getElementById('unmuteBtn');
      const toggleProxyBtn = document.getElementById('toggleProxyBtn');
      const toggleGatewayBtn = document.getElementById('toggleGatewayBtn');
      const copyUrlBtn = document.getElementById('copyUrlBtn');
      const urlText = document.getElementById('urlText');

      const rawStreamUrl = ${JSON.stringify(streamUrl)};
      const proxyStreamUrl = ${JSON.stringify(proxyUrl)};
      const gatewayStreamUrl = ${JSON.stringify(gatewayUrl)};

      let currentSource = rawStreamUrl;
      let hlsInstance = null;
      let isUsingProxy = false;
      let isUsingGateway = false;

      function updateStatus(text, color) {
        statusBadge.innerHTML = text;
        if (color) statusBadge.style.color = color;
      }

      function destroyHls() {
        if (hlsInstance) {
          hlsInstance.destroy();
          hlsInstance = null;
        }
      }

      function playStream(url) {
        destroyHls();
        video.pause();
        video.removeAttribute('src');
        video.load();

        updateStatus('&#9679; Đang nạp dữ liệu luồng...', '#38bdf8');
        urlText.textContent = url;

        const isHls = url.includes('.m3u8') || (!url.includes('.mp4') && !url.includes('.ts'));

        if (isHls && window.Hls && Hls.isSupported()) {
          hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
          });
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(video);

          hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
            updateStatus('&#9679; Đang phát trực tiếp (HLS)', '#4ade80');
            video.play().catch(function() {
              video.muted = true;
              video.play();
              unmuteBtn.style.display = 'block';
            });
          });

          hlsInstance.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !isUsingProxy) {
                updateStatus('&#9888; Thử chuyển qua Proxy CORS...', '#f59e0b');
                setTimeout(switchToProxy, 1500);
              } else {
                updateStatus('&#10006; Lỗi kết nối luồng phát', '#f87171');
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari Native HLS
          video.src = url;
          video.play().catch(function() {
            video.muted = true;
            video.play();
            unmuteBtn.style.display = 'block';
          });
          updateStatus('&#9679; Đang phát (Safari Native)', '#4ade80');
        } else {
          // Progressive MP4 / Fallback
          video.src = url;
          video.play().catch(function() {
            video.muted = true;
            video.play();
            unmuteBtn.style.display = 'block';
          });
          updateStatus('&#9679; Đang phát trực tiếp', '#4ade80');
        }
      }

      function switchToProxy() {
        isUsingProxy = true;
        isUsingGateway = false;
        toggleProxyBtn.textContent = 'Dùng luồng Gốc';
        toggleProxyBtn.className = 'btn btn-emerald';
        playStream(proxyStreamUrl);
      }

      toggleProxyBtn.addEventListener('click', function() {
        if (isUsingProxy) {
          isUsingProxy = false;
          toggleProxyBtn.textContent = 'Đổi qua Proxy CORS';
          toggleProxyBtn.className = 'btn btn-amber';
          playStream(rawStreamUrl);
        } else {
          switchToProxy();
        }
      });

      toggleGatewayBtn.addEventListener('click', function() {
        if (isUsingGateway) {
          isUsingGateway = false;
          toggleGatewayBtn.className = 'btn btn-dark';
          toggleGatewayBtn.textContent = 'Phát luồng Gateway (MP4)';
          playStream(rawStreamUrl);
        } else {
          isUsingGateway = true;
          isUsingProxy = false;
          toggleGatewayBtn.className = 'btn btn-red';
          toggleGatewayBtn.textContent = 'Dùng luồng Gốc';
          playStream(gatewayStreamUrl);
        }
      });

      unmuteBtn.addEventListener('click', function() {
        video.muted = false;
        unmuteBtn.style.display = 'none';
      });

      video.addEventListener('playing', function() {
        updateStatus('&#9679; Đang phát trực tiếp', '#4ade80');
      });

      video.addEventListener('error', function() {
        if (!isUsingProxy) {
          switchToProxy();
        } else {
          updateStatus('&#10006; Không thể giải mã luồng', '#f87171');
        }
      });

      copyUrlBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(urlText.textContent).then(function() {
          copyUrlBtn.textContent = 'Đã chép!';
          setTimeout(function() { copyUrlBtn.textContent = 'Sao chép'; }, 2000);
        });
      });

      // Start stream
      playStream(rawStreamUrl);
    })();
  </script>
</body>
</html>`);
});

function escapeHtml(text: string = ''): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default router;

