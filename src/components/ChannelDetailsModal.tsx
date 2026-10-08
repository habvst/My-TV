import React, { useState } from 'react';
import { Channel } from '../types/iptv';
import { X, Copy, Check, ExternalLink, Play, Tv, ShieldCheck, Smartphone, Zap, Film } from 'lucide-react';

interface ChannelDetailsModalProps {
  channel: Channel | null;
  onClose: () => void;
  onPlayChannel: (channel: Channel) => void;
}

export const ChannelDetailsModal: React.FC<ChannelDetailsModalProps> = ({
  channel,
  onClose,
  onPlayChannel,
}) => {
  const [copiedOriginal, setCopiedOriginal] = useState<boolean>(false);
  const [copiedE72, setCopiedE72] = useState<boolean>(false);

  if (!channel) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const e72StreamTsUrl = `${origin}/e72/stream/${channel.id}.ts`;
  const e72M3uLauncherUrl = `${origin}/e72/play/${channel.id}?type=m3u`;
  const e72StreamMp4Url = `${origin}/e72/stream/${channel.id}.mp4`;
  const corePlayerLink = `/open/${channel.id}`;

  const handleCopyOriginal = () => {
    navigator.clipboard.writeText(channel.stream_url);
    setCopiedOriginal(true);
    setTimeout(() => setCopiedOriginal(false), 2000);
  };

  const handleCopyE72 = () => {
    navigator.clipboard.writeText(e72StreamTsUrl);
    setCopiedE72(true);
    setTimeout(() => setCopiedE72(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-3">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-10 h-10 object-contain bg-neutral-900 rounded p-1 border border-neutral-800"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center justify-center rounded text-xs">
                IPTV
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-white leading-tight">{channel.name}</h3>
              <p className="text-xs text-neutral-400">Nhóm: {channel.group}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Stream URL Box */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              URL LUỒNG PHÁT GỐC (ORIGINAL STREAM URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={channel.stream_url}
                className="w-full bg-neutral-950 border border-neutral-800 text-emerald-400 text-xs font-mono p-2.5 rounded-lg focus:outline-none selection:bg-emerald-950"
              />
              <button
                type="button"
                onClick={handleCopyOriginal}
                className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition flex-shrink-0 border border-neutral-700"
              >
                {copiedOriginal ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copiedOriginal ? 'Đã copy' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Dedicated Nokia E72 / CorePlayer Stream Section */}
          <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                    Luồng stream chuyên dụng Nokia E72
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    H.264 Baseline Level 1.2 &bull; QVGA 320x240 &bull; 350 kbps &bull; HTTP thuần
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-500/30">
                CorePlayer S60
              </span>
            </div>

            {/* E72 Stream URL Input */}
            <div>
              <label className="text-[11px] font-medium text-neutral-300 block mb-1">
                URL Luồng MPEG-TS E72 (Dán vào CorePlayer &gt; Open URL):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={e72StreamTsUrl}
                  className="w-full bg-neutral-950 border border-neutral-800 text-blue-300 text-xs font-mono p-2.5 rounded-lg focus:outline-none selection:bg-blue-950"
                />
                <button
                  type="button"
                  onClick={handleCopyE72}
                  className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition flex-shrink-0 border border-neutral-700"
                  title="Copy URL luồng E72"
                >
                  {copiedE72 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
                  <span>{copiedE72 ? 'Đã copy' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Quick Action Buttons for E72 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={e72M3uLauncherUrl}
                className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-between transition shadow-md shadow-blue-900/30"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 fill-current text-amber-300" />
                  <span>Mở luồng E72 (.M3U 1-Chạm)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              <a
                href={e72StreamTsUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-blue-400" />
                  <span>Phát trực tiếp (.TS 320x240)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={e72StreamMp4Url}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-purple-400" />
                  <span>Phát MP4 (RealPlayer)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`/legacy/channel/${channel.id}`}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Xem bản Nokia E72 HTML</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>

            {/* Specs explanation */}
            <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-lg p-2.5 text-[11px] text-neutral-300 space-y-1">
              <div className="font-semibold text-blue-300">
                Thông số luồng chuyển mã cho Nokia E72:
              </div>
              <ul className="list-disc list-inside text-neutral-400 space-y-0.5">
                <li>Server downscale tự động về <strong>320x240</strong>, CPU E72 chỉ chạy ~35%, không bị tràn RAM.</li>
                <li>Chuẩn nén <strong>H.264 Baseline Profile Level 1.2</strong>, bitrate <strong>350 kbps</strong>, âm thanh <strong>AAC-LC 64k</strong>.</li>
                <li>Truyền qua <strong>HTTP thuần</strong>, loại bỏ hoàn toàn lỗi chứng chỉ bảo mật SSL/TLS hết hạn trên S60.</li>
              </ul>
            </div>
          </div>

          {/* Quick External Launchers */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              MỞ BẰNG ỨNG DỤNG BÊN NGOÀI
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <a
                href={corePlayerLink}
                className="p-2.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-200 rounded-lg font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-rose-400" />
                  <span>CorePlayer / S60</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`vlc://${channel.stream_url}`}
                className="p-2.5 bg-orange-950/40 hover:bg-orange-900/50 border border-orange-800/50 text-orange-200 rounded-lg font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-orange-400" />
                  <span>VLC Media Player</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`potplayer://${channel.stream_url}`}
                className="p-2.5 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-800/50 text-yellow-200 rounded-lg font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-yellow-400" />
                  <span>PotPlayer (PC)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={channel.stream_url}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-200 rounded-lg font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                  <span>Direct HTTP Stream</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>
          </div>

          {/* CorePlayer on Nokia E72 Tutorial */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>Hướng dẫn xem trên Nokia E72 (Symbian S60)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-[11px] leading-relaxed">
              <li>Mở trình duyệt mặc định trên Nokia E72, truy cập trang web (hệ thống sẽ tự nhận diện E72).</li>
              <li>Chọn kênh và bấm <strong className="text-white">[ Mở CorePlayer ]</strong> hoặc copy URL trên.</li>
              <li>Trong <strong>CorePlayer</strong>: Bấm <strong>Menu &gt; Open URL...</strong></li>
              <li>Dán (Paste) đường dẫn stream và bấm <strong>OK</strong> để phát.</li>
            </ol>
          </div>

          {/* Technical Specs */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-neutral-300 block">THÔNG SỐ KỸ THUẬT</span>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-neutral-400">
              <div>
                Giao thức: <strong className="text-neutral-200">{channel.format.toUpperCase()}</strong>
              </div>
              <div>
                Độ phân giải: <strong className="text-neutral-200">{channel.resolution || 'HD'}</strong>
              </div>
              <div>
                Video Codec: <strong className="text-neutral-200">{channel.video_codec || 'H.264'}</strong>
              </div>
              <div>
                Audio Codec: <strong className="text-neutral-200">{channel.audio_codec || 'AAC'}</strong>
              </div>
              <div className="col-span-2">
                Trạng thái: <span className="inline-flex items-center gap-1 text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" /> Hoạt động</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
          <a
            href={`/legacy/channel/${channel.id}`}
            className="text-xs text-amber-400 hover:underline"
          >
            Xem phiên bản Nokia E72
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onPlayChannel(channel);
                onClose();
              }}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Phát ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
