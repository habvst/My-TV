import type { Channel } from '../src/types/iptv.js';

function escapeHtml(text: string = ''): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LEGACY_CSS = `
  /* RESET & BASE FOR SYMBIAN S60 / NOKIA E72 */
  * { box-sizing: border-box; }
  body {
    background-color: #121212;
    color: #e5e5e5;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.35;
    margin: 0;
    padding: 4px;
    -webkit-text-size-adjust: none;
  }
  a {
    color: #38bdf8;
    text-decoration: underline;
  }
  /* ULTRA HIGH-CONTRAST FOCUS OUTLINE FOR D-PAD / OPTICAL NAVI KEY NAVIGATION */
  a:focus, a:hover, a:active,
  button:focus, button:hover,
  input:focus, select:focus, textarea:focus {
    background-color: #facc15 !important;
    color: #000000 !important;
    outline: 2px solid #ffffff !important;
    text-decoration: none !important;
  }
  .detect-banner {
    background-color: #064e3b;
    color: #6ee7b7;
    padding: 3px 6px;
    font-size: 11px;
    text-align: center;
    border: 1px solid #10b981;
    margin-bottom: 5px;
    font-weight: bold;
  }
  .header {
    background-color: #0f172a;
    color: #ffffff;
    padding: 6px 8px;
    text-align: center;
    border-bottom: 2px solid #f59e0b;
    margin-bottom: 6px;
  }
  .header h1 {
    font-size: 15px;
    margin: 0 0 2px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .nav-bar {
    background-color: #1e293b;
    padding: 4px;
    margin-bottom: 6px;
    text-align: center;
    border: 1px solid #334155;
    font-size: 11px;
  }
  .nav-bar a {
    color: #cbd5e1;
    text-decoration: none;
    padding: 2px 4px;
    margin: 0 2px;
    display: inline-block;
    border: 1px solid #475569;
    background-color: #0f172a;
  }
  .quick-categories {
    margin-bottom: 6px;
    padding: 4px;
    background-color: #18181b;
    border: 1px solid #27272a;
    overflow-x: auto;
    white-space: nowrap;
    font-size: 11px;
  }
  .quick-cat-item {
    display: inline-block;
    padding: 3px 7px;
    margin-right: 4px;
    background-color: #27272a;
    color: #e4e4e7;
    border: 1px solid #3f3f46;
    text-decoration: none;
    font-weight: bold;
  }
  .quick-cat-item.active {
    background-color: #f59e0b;
    color: #000000;
    border-color: #d97706;
  }
  .search-panel {
    background-color: #1f1f23;
    border: 1px solid #333338;
    padding: 6px;
    margin-bottom: 6px;
  }
  .form-group {
    margin-bottom: 4px;
  }
  .form-label {
    display: block;
    font-size: 11px;
    font-weight: bold;
    color: #f59e0b;
    margin-bottom: 2px;
  }
  .input-text, .select-box {
    width: 100%;
    padding: 4px;
    font-size: 12px;
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #71717a;
    box-sizing: border-box;
    display: block;
  }
  .btn-search {
    width: 100%;
    padding: 5px 8px;
    font-size: 12px;
    background-color: #f59e0b;
    color: #000000;
    font-weight: bold;
    border: 1px solid #000000;
    cursor: pointer;
    margin-top: 4px;
    display: block;
    text-align: center;
  }
  .filter-status {
    background-color: #142232;
    border: 1px solid #1e3a5f;
    padding: 4px 6px;
    margin-bottom: 6px;
    font-size: 11px;
    color: #93c5fd;
  }
  .channel-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .channel-item {
    background-color: #1c1c20;
    border-bottom: 1px solid #2d2d34;
    padding: 6px 5px;
    margin-bottom: 4px;
  }
  .channel-title {
    font-size: 13px;
    font-weight: bold;
    color: #ffffff;
    text-decoration: none;
    display: block;
    margin-bottom: 2px;
  }
  .channel-group-tag {
    display: inline-block;
    background-color: #1e3a8a;
    color: #fde047;
    font-size: 10px;
    padding: 1px 4px;
    margin-right: 3px;
    border-radius: 2px;
  }
  .channel-badge {
    display: inline-block;
    background-color: #27272a;
    color: #a1a1aa;
    font-size: 10px;
    padding: 1px 4px;
    margin-right: 3px;
  }
  .action-row {
    margin-top: 5px;
    line-height: 1.8;
  }
  .btn {
    display: inline-block;
    padding: 3px 6px;
    margin: 2px 2px 2px 0;
    background-color: #0284c7;
    color: #ffffff !important;
    text-decoration: none;
    border: 1px solid #38bdf8;
    font-weight: bold;
    font-size: 11px;
    text-align: center;
  }
  .btn-one-touch {
    background-color: #059669;
    border-color: #10b981;
    color: #ffffff !important;
  }
  .btn-ts {
    background-color: #0284c7;
    border-color: #38bdf8;
    color: #ffffff !important;
  }
  .btn-audio {
    background-color: #ea580c;
    border-color: #f97316;
    color: #ffffff !important;
  }
  .btn-mp4 {
    background-color: #7c3aed;
    border-color: #a78bfa;
    color: #ffffff !important;
  }
  .btn-details {
    background-color: #3f3f46;
    border-color: #71717a;
    color: #e4e4e7 !important;
  }
  .btn-large {
    display: block;
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    margin: 6px 0;
    text-align: center;
  }
  .pagination {
    text-align: center;
    padding: 6px 0;
    margin-top: 6px;
    border-top: 1px dashed #3f3f46;
  }
  .pagination a, .pagination span {
    padding: 3px 6px;
    margin: 0 1px;
    display: inline-block;
    background-color: #27272a;
    border: 1px solid #3f3f46;
    font-size: 11px;
    color: #ffffff;
    text-decoration: none;
  }
  .pagination span.current {
    background-color: #f59e0b;
    color: #000000;
    font-weight: bold;
    border-color: #d97706;
  }
  .box {
    background-color: #1a1a1e;
    border: 1px solid #2e2e36;
    padding: 6px;
    margin-bottom: 6px;
  }
  .url-box {
    background-color: #000000;
    color: #22c55e;
    padding: 5px;
    font-family: Courier New, monospace;
    font-size: 11px;
    word-break: break-all;
    border: 1px solid #27272a;
    margin: 4px 0;
  }
  .guide-step {
    margin-bottom: 4px;
    font-size: 11px;
    color: #cbd5e1;
    line-height: 1.4;
  }
  .channel-nav-bar {
    display: flex;
    justify-content: space-between;
    margin: 6px 0;
    background-color: #1e293b;
    padding: 4px;
    border: 1px solid #334155;
  }
  .channel-nav-btn {
    display: inline-block;
    padding: 4px 8px;
    background-color: #0f172a;
    color: #38bdf8 !important;
    text-decoration: none;
    font-weight: bold;
    font-size: 11px;
    border: 1px solid #475569;
  }
  .footer {
    text-align: center;
    padding: 8px 4px;
    margin-top: 10px;
    border-top: 1px solid #27272a;
    font-size: 10px;
    color: #71717a;
  }
  .footer a {
    color: #a1a1aa;
    text-decoration: none;
  }
`;

export function renderLegacyHome(options: {
  channels: Channel[];
  totalChannels: number;
  currentPage: number;
  totalPages: number;
  currentGroup: string;
  groups: string[];
  searchQuery?: string;
}): string {
  const { channels, totalChannels, currentPage, totalPages, currentGroup, groups, searchQuery = '' } = options;

  // Prominent standard groups for quick navigation pills
  const priorityGroups = ['Tất cả', 'VTV', 'HTV', 'VTC', 'Thể thao', 'Tin tức', 'Giải trí', 'Địa phương', 'Quốc tế', 'Phim'];
  
  // Quick Pills HTML
  let quickPillsHtml = '';
  for (const pg of priorityGroups) {
    const isAll = pg === 'Tất cả';
    const isSelected = isAll ? currentGroup === 'all' : currentGroup.toLowerCase() === pg.toLowerCase();
    const href = isAll ? '/legacy' : `/legacy?group=${encodeURIComponent(pg)}`;
    quickPillsHtml += `<a class="quick-cat-item${isSelected ? ' active' : ''}" href="${href}">${escapeHtml(pg)}</a>`;
  }

  // Full Dropdown options
  const sortedGroups = [...groups].sort((a, b) => a.localeCompare(b));
  let optionsHtml = `<option value="all"${currentGroup === 'all' ? ' selected="selected"' : ''}>-- Tất cả nhóm (${totalChannels} kênh) --</option>`;
  for (const g of sortedGroups) {
    const isSelected = currentGroup.toLowerCase() === g.toLowerCase();
    optionsHtml += `<option value="${escapeHtml(g)}"${isSelected ? ' selected="selected"' : ''}>${escapeHtml(g)}</option>`;
  }

  // Channel items
  let channelItems = '';
  if (channels.length === 0) {
    channelItems = '<li class="channel-item" style="text-align:center;padding:16px;">Không tìm thấy kênh nào phù hợp với bộ lọc.</li>';
  } else {
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const indexNum = (currentPage - 1) * 10 + i + 1;
      channelItems += `
        <li class="channel-item">
          <a class="channel-title" href="/legacy/channel/${encodeURIComponent(ch.id)}">
            ${indexNum}. ${escapeHtml(ch.name)}
          </a>
          <div>
            <span class="channel-group-tag">${escapeHtml(ch.group)}</span>
            <span class="channel-badge">${escapeHtml(ch.resolution || 'HD')}</span>
            <span class="channel-badge" style="color:#f59e0b;">QVGA 320x240</span>
          </div>
          <div class="action-row">
            <a class="btn btn-one-touch" title="Mở trực tiếp bằng CorePlayer" href="/e72/play/${encodeURIComponent(ch.id)}?type=m3u">&#9889; 1-Chạm CorePlayer</a>
            <a class="btn btn-ts" title="Luồng trực tiếp MPEG-TS" href="/e72/stream/${encodeURIComponent(ch.id)}.ts">&#9654; TS Stream</a>
            <a class="btn btn-audio" title="Chỉ nghe âm thanh - Tiết kiệm 3G" href="/e72/audio/${encodeURIComponent(ch.id)}.aac">&#128251; Radio (Audio)</a>
            <a class="btn btn-mp4" title="Luồng MP4 cho RealPlayer" href="/e72/stream/${encodeURIComponent(ch.id)}.mp4">&#127916; MP4</a>
            <a class="btn btn-details" href="/legacy/channel/${encodeURIComponent(ch.id)}">[ Chi tiết ]</a>
          </div>
        </li>
      `;
    }
  }

  // Pagination
  let paginationHtml = '<div class="pagination">';
  if (currentPage > 1) {
    paginationHtml += `<a accesskey="5" href="/legacy?page=${currentPage - 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}">&laquo; Trước [5]</a>`;
  }
  paginationHtml += ` <span class="current">Trang ${currentPage}/${totalPages}</span> `;
  if (currentPage < totalPages) {
    paginationHtml += `<a accesskey="6" href="/legacy?page=${currentPage + 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}">Sau [6] &raquo;</a>`;
  }
  paginationHtml += '</div>';

  const isFiltering = currentGroup !== 'all' || Boolean(searchQuery.trim());

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="HandheldFriendly" content="true" />
  <meta name="MobileOptimized" content="320" />
  <title>MY IPTV - Nokia E72 / Symbian S60</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; TỰ ĐỘNG NHẬN DIỆN: NOKIA E72 / S60 (Giao diện chuẩn QVGA 320x240)
  </div>

  <div class="header">
    <h1>MY IPTV &bull; S60 / E72</h1>
    <div style="font-size:10px;color:#cbd5e1;">Bộ giải mã phần cứng ARM11 &bull; CorePlayer 1.3.x</div>
  </div>

  <!-- PHÍM TẮT & ĐIỀU HƯỚNG NHANH CHO NOKIA S60 (D-PAD & ACCESSKEYS) -->
  <div class="nav-bar">
    <a accesskey="1" href="/legacy"><b>[1] Trang chủ</b></a>
    <a accesskey="4" href="/legacy/playlists"><b>[4] Tải Playlist</b></a>
    <a accesskey="7" href="/legacy/help"><b>[7] Cài đặt CorePlayer</b></a>
    <a accesskey="0" href="/legacy"><b>[0] Tải lại</b></a>
  </div>

  <!-- THANH DANH MỤC NHANH (QUICK PILLS BẰNG PHÍM 5 CHIỀU D-PAD) -->
  <div class="quick-categories">
    ${quickPillsHtml}
  </div>

  <!-- FORM TÌM KIẾM & LỌC NHÓM -->
  <div class="search-panel">
    <form action="/legacy" method="GET">
      <div class="form-group">
        <label class="form-label" for="search-input">1. Tìm kiếm kênh (Phím tắt [2]):</label>
        <input class="input-text" type="text" id="search-input" name="q" accesskey="2" value="${escapeHtml(searchQuery)}" placeholder="Nhập tên kênh (vd: VTV1, Bong da)..." />
      </div>

      <div class="form-group">
        <label class="form-label" for="group-select">2. Danh sách nhóm kênh (Phím tắt [3]):</label>
        <select class="select-box" id="group-select" name="group" accesskey="3">
          ${optionsHtml}
        </select>
      </div>

      <div>
        <input class="btn-search" type="submit" value="&#128269; TÌM &amp; LỌC KÊNH" />
      </div>

      ${isFiltering ? `
      <div style="text-align:center;margin-top:5px;">
        <a href="/legacy" style="color:#ef4444;font-size:11px;font-weight:bold;">[ Xóa bộ lọc / Xem tất cả kênh ]</a>
      </div>` : ''}
    </form>
  </div>

  ${isFiltering ? `
  <div class="filter-status">
    Đang xem:
    ${currentGroup !== 'all' ? `Nhóm: <b>${escapeHtml(currentGroup)}</b>` : ''}
    ${(currentGroup !== 'all' && searchQuery) ? ' &bull; ' : ''}
    ${searchQuery ? `Từ khóa: <b>"${escapeHtml(searchQuery)}"</b>` : ''}
    &mdash; Tổng cộng <b>${totalChannels}</b> kênh.
  </div>` : ''}

  <!-- DANH SÁCH KÊNH -->
  <ul class="channel-list">
    ${channelItems}
  </ul>

  ${totalPages > 1 ? paginationHtml : ''}

  <!-- HỘP HƯỚNG DẪN 1-CHẠM TRÊN NOKIA S60 -->
  <div class="box" style="margin-top:8px;">
    <strong style="color:#f59e0b;">&#128241; MẸO DÙNG COREPLAYER TRÊN NOKIA E72:</strong>
    <div class="guide-step">&#8226; <b>Cách 1-Chạm:</b> Bấm nút xanh lá <b>[ &#9889; 1-Chạm CorePlayer ]</b>. Trình duyệt S60 tự nạp file M3U và gọi CorePlayer phát ngay!</div>
    <div class="guide-step">&#8226; <b>Khi mạng 2G/3G yếu:</b> Bấm nút màu cam <b>[ &#128251; Radio (Audio) ]</b> để chỉ nghe tiếng với bitrate 64kbps, không bao giờ bị giật lag!</div>
    <div class="guide-step">&#8226; <b>Tải danh sách vào thẻ nhớ:</b> Vào menu <b>[4] Tải Playlist</b> để chép file M3U vào thẻ nhớ (<code>E:\\CorePlayer\\</code>) xem không cần mở web.</div>
  </div>

  <div class="footer">
    <div>Chế độ: <b>Nokia E72 / Symbian S60 (QVGA 320x240)</b></div>
    <div style="margin-top:5px;">
      <a href="/legacy/playlists">[ Tải M3U Playlist ]</a> |
      <a href="/legacy/help">[ Hướng dẫn CorePlayer ]</a> |
      <a href="/?view=modern">[ Bản Hiện Đại ]</a>
    </div>
  </div>
</body>
</html>`;
}

export function renderLegacyChannel(channel: Channel, context?: { prevChannel?: Channel | null; nextChannel?: Channel | null; host?: string }): string {
  const host = context?.host || '0.0.0.0:3000';
  const e72StreamUrl = `http://${host}/e72/stream/${encodeURIComponent(channel.id)}.ts`;
  const e72AudioUrl = `http://${host}/e72/audio/${encodeURIComponent(channel.id)}.aac`;
  const e72Mp4Url = `http://${host}/e72/stream/${encodeURIComponent(channel.id)}.mp4`;
  const e72M3uUrl = `http://${host}/e72/channel/${encodeURIComponent(channel.id)}.m3u`;
  const e72AudioM3uUrl = `http://${host}/e72/channel/${encodeURIComponent(channel.id)}.m3u?audio=1`;
  const directStreamUrl = channel.stream_url;

  const prevChannel = context?.prevChannel;
  const nextChannel = context?.nextChannel;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="HandheldFriendly" content="true" />
  <meta name="MobileOptimized" content="320" />
  <title>${escapeHtml(channel.name)} - Nokia E72 CorePlayer</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; TỰ ĐỘNG CHUYỂN MÃ: CHUẨN PHẦN CỨNG NOKIA E72 (QVGA 320x240)
  </div>

  <div class="header">
    <h1>${escapeHtml(channel.name)}</h1>
    <div style="font-size:11px;color:#f59e0b;">Nhóm: <b>${escapeHtml(channel.group)}</b> &bull; Mã: <code>${escapeHtml(channel.id)}</code></div>
  </div>

  <!-- CHUYỂN KÊNH NHANH (PREV / NEXT CHANNELS) -->
  <div class="channel-nav-bar">
    ${prevChannel ? `<a class="channel-nav-btn" accesskey="4" href="/legacy/channel/${encodeURIComponent(prevChannel.id)}">&laquo; Kênh trước (${escapeHtml(prevChannel.name.substring(0, 10))})</a>` : '<span style="color:#555;font-size:10px;">Đầu danh sách</span>'}
    <a class="channel-nav-btn" accesskey="1" href="/legacy">&#9776; Danh sách</a>
    ${nextChannel ? `<a class="channel-nav-btn" accesskey="6" href="/legacy/channel/${encodeURIComponent(nextChannel.id)}">Kênh sau (${escapeHtml(nextChannel.name.substring(0, 10))}) &raquo;</a>` : '<span style="color:#555;font-size:10px;">Cuối danh sách</span>'}
  </div>

  <!-- BỘ CÁC NÚT PHÁT 1-CHẠM THÔNG MINH CHO NOKIA S60 -->
  <div class="box">
    <div style="font-size:11px;font-weight:bold;color:#f59e0b;margin-bottom:6px;text-align:center;">
      CÁC PHƯƠNG THỨC PHÁT TRỰC TIẾP TRÊN NOKIA S60:
    </div>

    <!-- Nút 1: 1-Chạm mở CorePlayer bằng inline M3U -->
    <a class="btn btn-large btn-one-touch" href="/e72/play/${encodeURIComponent(channel.id)}?type=m3u">
      &#9889; 1-CHẠM: KHỞI ĐỘNG COREPLAYER (M3U INLINE)
    </a>

    <!-- Nút 2: Luồng trực tiếp MPEG-TS (320x240) -->
    <a class="btn btn-large btn-ts" href="/e72/stream/${encodeURIComponent(channel.id)}.ts">
      &#9654; PHÁT TRỰC TIẾP MPEG-TS (video/MP2T &bull; 320x240)
    </a>

    <!-- Nút 3: Chỉ nghe âm thanh (Chế độ Radio 64kbps AAC) -->
    <a class="btn btn-large btn-audio" href="/e72/audio/${encodeURIComponent(channel.id)}.aac">
      &#128251; CHỈ NGHE ÂM THANH (Chế độ Radio &bull; Tiết kiệm 3G &amp; Pin)
    </a>

    <!-- Nút 4: Luồng trực tiếp MP4 (RealPlayer & CorePlayer) -->
    <a class="btn btn-large btn-mp4" href="/e72/stream/${encodeURIComponent(channel.id)}.mp4">
      &#127916; PHÁT QUA MP4 STREAM (Tương thích RealPlayer)
    </a>

    <!-- Nút 5: RealPlayer RAM Metafile -->
    <a class="btn btn-large" style="background-color:#c2410c;border-color:#ea580c;" href="/e72/play/${encodeURIComponent(channel.id)}?type=ram">
      &#128251; MỞ BẰNG REALPLAYER GỐC CỦA MÁY (.RAM)
    </a>

    <!-- Nút 6: Tải file M3U kênh này về thẻ nhớ -->
    <a class="btn btn-large" style="background-color:#334155;border-color:#475569;" href="${e72M3uUrl}">
      &#128190; TẢI FILE .M3U KÊNH NÀY VỀ THẺ NHỚ (E:\\)
    </a>
  </div>

  <!-- Ô URL SAO CHÉP DÀNH CHO COREPLAYER OPEN URL -->
  <div class="box">
    <strong style="color:#38bdf8;">URL LUỒNG MPEG-TS (Dán vào CorePlayer &gt; Open URL):</strong>
    <div class="url-box">${escapeHtml(e72StreamUrl)}</div>
    <textarea rows="2" style="width:100%;font-size:11px;background:#000;color:#22c55e;border:1px solid #444;font-family:Courier New, monospace;" readonly="readonly">${escapeHtml(e72StreamUrl)}</textarea>

    <div style="margin-top:6px;">
      <strong style="color:#f97316;">URL CHỈ NGHE TIẾNG (RADIO AUDIO):</strong>
      <div class="url-box">${escapeHtml(e72AudioUrl)}</div>
    </div>
  </div>

  <!-- BẢNG THÔNG SỐ KỸ THUẬT GATEWAY CHO NOKIA E72 -->
  <div class="box">
    <strong style="color:#f59e0b;">THÔNG SỐ KỸ THUẬT GATEWAY E72 (CHUẨN PHẦN CỨNG):</strong>
    <div style="font-size:11px;color:#cbd5e1;line-height:1.5;margin-top:4px;">
      &#8226; Độ phân giải: <b>320x240 (QVGA đúng chuẩn màn hình E72)</b><br />
      &#8226; Video Codec: <b>H.264 Baseline Profile @ Level 1.2</b><br />
      &#8226; Bitrate Video: <b>320 kbps (Tối đa 380 kbps, 24 fps cố định)</b><br />
      &#8226; Audio Codec: <b>AAC-LC 64 kbps, 44.1 kHz Stereo</b><br />
      &#8226; Giao thức truyền: <b>HTTP thuần (Không lỗi chứng chỉ SSL/TLS hết hạn trên S60)</b><br />
      &#8226; Tải CPU E72: <b>Chỉ ~30% - 40% (ARM11 600 MHz chạy mát, không sụt pin)</b><br />
    </div>
  </div>

  <!-- NGUỒN PHÁT GỐC -->
  <div class="box">
    <strong style="color:#71717a;">LUỒNG GỐC CỦA NHÀ ĐÀI:</strong>
    <div style="font-size:10px;color:#71717a;word-break:break-all;margin-top:2px;">
      ${escapeHtml(directStreamUrl)}
    </div>
  </div>

  <div class="footer">
    <a href="/legacy">&laquo; Danh sách kênh</a> |
    <a href="/legacy/playlists">Tải Playlist</a> |
    <a href="/legacy/help">Hướng dẫn CorePlayer</a> |
    <a href="/?view=modern">Bản hiện đại</a>
  </div>
</body>
</html>`;
}

export function renderLegacyPlaylists(): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="HandheldFriendly" content="true" />
  <meta name="MobileOptimized" content="320" />
  <title>Tải Playlist M3U cho Nokia E72</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; TRUNG TÂM TẢI DANH SÁCH M3U CHO NOKIA E72 &bull; S60
  </div>

  <div class="header">
    <h1>TẢI PLAYLIST M3U</h1>
    <div style="font-size:11px;color:#f59e0b;">Lưu vào thẻ nhớ E:\\ để mở bằng CorePlayer bất kỳ lúc nào</div>
  </div>

  <div class="nav-bar">
    <a accesskey="1" href="/legacy"><b>[1] Danh sách kênh</b></a>
    <a accesskey="7" href="/legacy/help"><b>[7] Cài đặt CorePlayer</b></a>
  </div>

  <div class="box">
    <strong style="color:#10b981;">1. TẢI TOÀN BỘ KÊNH TRUYỀN HÌNH (VIDEO QVGA 320x240):</strong>
    <p style="font-size:11px;color:#cbd5e1;margin:4px 0 8px 0;">
      Bao gồm tất cả các kênh VTV, HTV, VTC, Thể thao, Địa phương đã chuyển mã chuẩn QVGA:
    </p>
    <a class="btn btn-large btn-one-touch" href="/e72/playlist.m3u">
      &#128190; TẢI PLAYLIST ĐẦY ĐỦ (nokia_e72_iptv.m3u)
    </a>
  </div>

  <div class="box">
    <strong style="color:#f97316;">2. TẢI PLAYLIST CHỈ ÂM THANH (CHẾ ĐỘ RADIO 64KBPS):</strong>
    <p style="font-size:11px;color:#cbd5e1;margin:4px 0 8px 0;">
      Dành cho bạn muốn nghe thời sự, bình luận bóng đá, tin tức hoặc nghe qua tai nghe khi chạy xe / tắt màn hình. Tiết kiệm 90% dữ liệu 3G:
    </p>
    <a class="btn btn-large btn-audio" href="/e72/playlist-audio.m3u">
      &#128251; TẢI PLAYLIST RADIO (nokia_e72_radio_iptv.m3u)
    </a>
  </div>

  <div class="box">
    <strong style="color:#38bdf8;">3. TẢI PLAYLIST THEO TỪNG NHÓM KÊNH RIÊNG BIỆT:</strong>
    <div style="margin-top:6px;">
      <a class="btn btn-ts" style="display:block;margin-bottom:4px;" href="/e72/playlist/VTV.m3u">&#9654; Tải nhóm kênh VTV (nokia_e72_vtv.m3u)</a>
      <a class="btn btn-ts" style="display:block;margin-bottom:4px;" href="/e72/playlist/HTV.m3u">&#9654; Tải nhóm kênh HTV (nokia_e72_htv.m3u)</a>
      <a class="btn btn-ts" style="display:block;margin-bottom:4px;" href="/e72/playlist/VTC.m3u">&#9654; Tải nhóm kênh VTC (nokia_e72_vtc.m3u)</a>
      <a class="btn btn-ts" style="display:block;margin-bottom:4px;" href="/e72/playlist/Thể%20thao.m3u">&#9654; Tải nhóm THỂ THAO (nokia_e72_the_thao.m3u)</a>
      <a class="btn btn-ts" style="display:block;margin-bottom:4px;" href="/e72/playlist/Tin%20tức.m3u">&#9654; Tải nhóm TIN TỨC (nokia_e72_tin_tuc.m3u)</a>
    </div>
  </div>

  <div class="box">
    <strong style="color:#f59e0b;">CÁCH DÙNG FILE M3U TRÊN NOKIA E72:</strong>
    <div class="guide-step">1. Bấm vào nút tải ở trên, trình duyệt S60 sẽ lưu file vào thư mục <code>E:\\Downloads\\</code> hoặc <code>E:\\Others\\</code>.</div>
    <div class="guide-step">2. Mở <b>CorePlayer</b> &gt; bấm <b>Menu</b> &gt; <b>Open File...</b> &gt; duyệt đến thẻ nhớ <b>E:\\</b> &gt; chọn file <code>.m3u</code> vừa tải.</div>
    <div class="guide-step">3. Toàn bộ danh sách kênh sẽ hiển thị trong CorePlayer! Bạn chỉ cần dùng phím 5 chiều (D-pad) để bấm chọn kênh xem trực tiếp.</div>
  </div>

  <div class="footer">
    <a href="/legacy">&laquo; Quay lại Danh sách kênh</a> |
    <a href="/legacy/help">Cài đặt CorePlayer</a>
  </div>
</body>
</html>`;
}

export function renderLegacyHelp(): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="HandheldFriendly" content="true" />
  <meta name="MobileOptimized" content="320" />
  <title>Hướng Dẫn Tối Ưu CorePlayer Nokia E72</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; HƯỚNG DẪN CÀI ĐẶT COREPLAYER 1.3.x TRÊN SYMBIAN S60
  </div>

  <div class="header">
    <h1>TỐI ƯU COREPLAYER E72</h1>
    <div style="font-size:11px;color:#f59e0b;">Cấu hình chuẩn để xem mượt mà 100%, không giật lag</div>
  </div>

  <div class="nav-bar">
    <a accesskey="1" href="/legacy"><b>[1] Danh sách kênh</b></a>
    <a accesskey="4" href="/legacy/playlists"><b>[4] Tải Playlist M3U</b></a>
  </div>

  <div class="box">
    <strong style="color:#10b981;">1. CẤU HÌNH BỘ ĐỆM MẠNG (NETWORK BUFFER):</strong>
    <div class="guide-step">&#8226; Mở CorePlayer &gt; bấm <b>Menu</b> &gt; <b>Tools</b> &gt; <b>Preferences</b> &gt; mục <b>Network</b>.</div>
    <div class="guide-step">&#8226; <b>Buffer Size:</b> Đặt thành <b>128 KB</b> (hoặc 256 KB nếu dùng Wi-Fi cáp quang).</div>
    <div class="guide-step">&#8226; <b>Pre-buffer:</b> Đặt thành <b>30% - 50%</b> để khi bấm là phát ngay sau 1-2 giây.</div>
  </div>

  <div class="box">
    <strong style="color:#38bdf8;">2. CẤU HÌNH BỘ XUẤT HÌNH ẢNH (VIDEO OUTPUT):</strong>
    <div class="guide-step">&#8226; Vào <b>Tools</b> &gt; <b>Preferences</b> &gt; mục <b>Video</b>.</div>
    <div class="guide-step">&#8226; <b>Video Output:</b> Chọn <b>DirectDraw</b> (chế độ này tăng tốc phần cứng tốt nhất trên Nokia E72).</div>
    <div class="guide-step">&#8226; <b>Quality:</b> Chọn <b>Medium</b> hoặc <b>High (Bi-linear)</b>.</div>
    <div class="guide-step">&#8226; <b>Drop Frames:</b> Đánh dấu chọn (<b>Tick</b>) để âm thanh và hình ảnh luôn đồng bộ.</div>
  </div>

  <div class="box">
    <strong style="color:#f59e0b;">3. CẤU HÌNH ÂM THANH (AUDIO OUTPUT):</strong>
    <div class="guide-step">&#8226; Vào mục <b>Audio</b> trong Preferences.</div>
    <div class="guide-step">&#8226; <b>Audio Output:</b> Chọn <b>Symbian Multimedia (MMF)</b>.</div>
    <div class="guide-step">&#8226; <b>Volume Boost:</b> Đặt <b>0 dB</b> hoặc <b>+3 dB</b> để loa ngoài E72 to rõ.</div>
  </div>

  <div class="box">
    <strong style="color:#a78bfa;">4. CÁC PHÍM TẮT HỮU ÍCH TRONG COREPLAYER KHI XEM:</strong>
    <div class="guide-step">&#8226; Phím <b>Phím trắng giữa D-Pad:</b> Tạm dừng / Phát tiếp (Play / Pause).</div>
    <div class="guide-step">&#8226; Phím <b>Phím sao (*)</b> hoặc <b>Phím 0:</b> Bật chế độ toàn màn hình (Full Screen).</div>
    <div class="guide-step">&#8226; Phím <b>Volume bên sườn máy:</b> Tăng giảm âm lượng.</div>
  </div>

  <div class="footer">
    <a href="/legacy">&laquo; Danh sách kênh</a> |
    <a href="/legacy/playlists">Tải Playlist</a> |
    <a href="/?view=modern">Bản hiện đại</a>
  </div>
</body>
</html>`;
}

export function renderLegacyNotFound(): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="vi" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="HandheldFriendly" content="true" />
  <meta name="MobileOptimized" content="320" />
  <title>404 - Không tìm thấy trang</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="header">
    <h1>KHÔNG TÌM THẤY TRANG</h1>
  </div>
  <div class="box" style="text-align:center;padding:16px;">
    <p>Kênh hoặc liên kết bạn truy cập không tồn tại hoặc đã thay đổi.</p>
    <a class="btn btn-large btn-one-touch" href="/legacy">&#171; QUAY VỀ TRANG CHỦ NOKIA S60</a>
  </div>
  <div class="footer">
    <a href="/legacy">MY IPTV S60</a>
  </div>
</body>
</html>`;
}
