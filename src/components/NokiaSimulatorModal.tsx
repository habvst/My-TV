import React, { useRef, useState } from 'react';
import { X, ExternalLink, Smartphone, RefreshCw, Volume2, Radio, BookOpen, Download } from 'lucide-react';

interface NokiaSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NokiaSimulatorModal: React.FC<NokiaSimulatorModalProps> = ({ isOpen, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('/legacy');
  const [iframeKey, setIframeKey] = useState<number>(0);

  if (!isOpen) return null;

  const navigateTo = (url: string) => {
    setCurrentUrl(url);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const reloadIframe = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleDPadScroll = (direction: 'up' | 'down') => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.scrollBy({
          top: direction === 'down' ? 80 : -80,
          behavior: 'smooth',
        });
      }
    } catch {
      // Cross-origin fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          title="Đóng giả lập"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-1 text-amber-400">
          <Smartphone className="w-5 h-5" />
          <h3 className="text-base font-bold tracking-wide uppercase">Mô Phỏng Trình Duyệt Nokia E72 (S60)</h3>
        </div>
        <p className="text-xs text-neutral-400 text-center mb-3 max-w-sm">
          Chuẩn màn hình QVGA 320x240 px &bull; Bộ mã hóa ARM11 &bull; 0 JavaScript &bull; Tích hợp 1-Chạm CorePlayer &amp; Radio Audio.
        </p>

        {/* Quick Simulator Navigation Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3 w-full">
          <button
            onClick={() => navigateTo('/legacy')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              currentUrl === '/legacy' ? 'bg-amber-500 text-black font-bold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            [1] Kênh QVGA
          </button>
          <button
            onClick={() => navigateTo('/legacy/playlists')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
              currentUrl === '/legacy/playlists' ? 'bg-amber-500 text-black font-bold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            <Download className="w-3 h-3" />
            [4] Tải Playlist
          </button>
          <button
            onClick={() => navigateTo('/legacy/help')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 ${
              currentUrl === '/legacy/help' ? 'bg-amber-500 text-black font-bold' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            [7] Cài CorePlayer
          </button>
          <button
            onClick={reloadIframe}
            className="p-1 rounded bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition"
            title="Làm mới trình duyệt giả lập"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Nokia E72 Phone Mockup Bezel */}
        <div className="w-[356px] bg-neutral-950 p-3.5 rounded-3xl border-4 border-neutral-700 shadow-2xl flex flex-col items-center">
          {/* Earpiece / Nokia Brand */}
          <div className="w-full flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-black tracking-widest text-neutral-400">NOKIA</span>
            <div className="w-12 h-1 bg-neutral-700 rounded-full" />
            <span className="text-[11px] font-black text-amber-500">E72</span>
          </div>

          {/* Exact 320x240 QVGA Screen Container (Pixel-Perfect Nokia E72 Specification) */}
          <div className="w-[320px] h-[240px] bg-[#121212] rounded border-2 border-neutral-800 overflow-hidden shadow-inner relative flex-shrink-0">
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={currentUrl}
              title="Nokia E72 Browser"
              className="w-full h-full border-0 select-none bg-[#121212]"
            />
          </div>

          {/* S60 Softkeys & D-Pad Mockup */}
          <div className="mt-3 w-full flex flex-col items-center">
            {/* Top Function Keys (Softkeys Left/Right + Menu/Call/End) */}
            <div className="flex items-center justify-between w-full px-4 mb-1.5">
              <button
                onClick={() => navigateTo('/legacy')}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded font-bold border border-neutral-600 active:bg-amber-400 active:text-black transition"
                title="Softkey Trái (Danh sách)"
              >
                Menu
              </button>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" title="Phím gọi" />
                <span className="text-[9px] text-neutral-500">Symbian 9.3</span>
                <div className="w-2 h-2 rounded-full bg-red-500" title="Phím gác máy" />
              </div>
              <button
                onClick={() => navigateTo('/legacy/playlists')}
                className="px-2.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded font-bold border border-neutral-600 active:bg-amber-400 active:text-black transition"
                title="Softkey Phải (Playlist)"
              >
                Thoát
              </button>
            </div>

            {/* D-Pad Optical Navi Key Center */}
            <div className="relative w-24 h-16 bg-neutral-800 rounded-xl border border-neutral-600 flex items-center justify-center shadow-lg my-1">
              <button
                onClick={() => handleDPadScroll('up')}
                className="absolute top-0.5 inset-x-0 h-4 flex items-center justify-center text-neutral-400 hover:text-white text-[10px]"
                title="D-Pad Lên"
              >
                ▲
              </button>
              <button
                onClick={() => handleDPadScroll('down')}
                className="absolute bottom-0.5 inset-x-0 h-4 flex items-center justify-center text-neutral-400 hover:text-white text-[10px]"
                title="D-Pad Xuống"
              >
                ▼
              </button>
              {/* Center Action Key */}
              <button
                onClick={reloadIframe}
                className="w-8 h-6 bg-neutral-900 rounded border border-neutral-500 flex items-center justify-center hover:border-amber-400 active:bg-amber-400 transition"
                title="Phím Chọn (OK / Refresh)"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/90" />
              </button>
            </div>

            {/* E72 QWERTY Keypad Grid */}
            <div className="mt-2 grid grid-cols-10 gap-1 w-full px-2">
              {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
                <div key={k} className="h-3 bg-neutral-800 rounded-xs border border-neutral-700/60 flex items-center justify-center text-[7px] text-neutral-500 font-mono">
                  {k}
                </div>
              ))}
              {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '↵'].map((k) => (
                <div key={k} className="h-3 bg-neutral-800 rounded-xs border border-neutral-700/60 flex items-center justify-center text-[7px] text-neutral-500 font-mono">
                  {k}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Links */}
        <div className="mt-4 flex flex-wrap items-center gap-2 w-full justify-center">
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Toàn Màn Hình Trong Tab Mới
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
