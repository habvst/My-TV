import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types/iptv';
import {
  Play,
  Pause,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel | null;
  playTrigger?: number;
  onOpenDetails?: (channel: Channel) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  playTrigger = 0,
  onOpenDetails,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const networkRetryCountRef = useRef<number>(0);
  const mediaRetryCountRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [autoplayMuted, setAutoplayMuted] = useState<boolean>(false);

  // Proxy state: auto-enable if stream is insecure HTTP loaded on HTTPS
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && channel?.stream_url) {
      return window.location.protocol === 'https:' && channel.stream_url.startsWith('http:');
    }
    return false;
  });

  // Calculate actual playback URL
  const getStreamSource = useCallback(
    (streamUrl: string, proxyEnabled: boolean): string => {
      const isM3u = streamUrl.includes('.m3u8') || streamUrl.includes('mpegurl');
      const prefix = isM3u ? '/api/proxy/stream.m3u8' : '/api/proxy/stream';
      if (proxyEnabled) {
        return `${prefix}?url=${encodeURIComponent(streamUrl)}`;
      }
      // Force proxy only if mixed-content (HTTP on HTTPS page)
      if (
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        streamUrl.startsWith('http:')
      ) {
        return `${prefix}?url=${encodeURIComponent(streamUrl)}`;
      }
      return streamUrl;
    },
    []
  );

  // Stop and clean up HLS and video element
  const cleanupMedia = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch (err) {
        console.warn('Error during HLS cleanup:', err);
      }
      hlsRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {
        // ignore
      }
    }
  }, []);

  // Load and play stream
  const startPlayback = useCallback(
    (proxyMode: boolean) => {
      if (!channel) return;
      cleanupMedia();

      setHasError(false);
      setErrorMessage('');
      setIsLoading(true);
      networkRetryCountRef.current = 0;
      mediaRetryCountRef.current = 0;

      const rawUrl = channel.stream_url.trim();
      const effectiveSource = getStreamSource(rawUrl, proxyMode);
      const isHls =
        channel.format === 'hls' ||
        rawUrl.includes('.m3u8') ||
        effectiveSource.includes('.m3u8');

      const video = videoRef.current;
      if (!video) {
        return;
      }

      // 1. PRIMARY ENGINE: HLS.js with MediaSource Extensions
      // Must be evaluated first for Chrome, Edge, Firefox, Opera, and Safari Desktop!
      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false, // Standard IPTV streams are regular HLS, not LL-HLS; false prevents buffer underruns
          backBufferLength: 60,
          maxBufferLength: 30, // Maintain a healthy 30-second buffer
          maxMaxBufferLength: 60,
          liveSyncDurationCount: 3, // Safe distance behind live edge
          liveMaxLatencyDurationCount: 8,
          liveDurationInfinity: true,
          // Robust loading and retry settings for live streaming
          manifestLoadingTimeOut: 20000,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingMaxRetryTimeout: 64000,
          levelLoadingTimeOut: 20000,
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 1000,
          levelLoadingMaxRetryTimeout: 64000,
          fragLoadingTimeOut: 30000,
          fragLoadingMaxRetry: 8,
          fragLoadingRetryDelay: 1000,
          fragLoadingMaxRetryTimeout: 64000,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        hls.loadSource(effectiveSource);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setAutoplayMuted(false);
            })
            .catch((err) => {
              console.warn('Autoplay unmuted blocked by browser policy:', err);
              // Autoplay policy: retry with muted audio
              video.muted = true;
              setIsMuted(true);
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setAutoplayMuted(true);
                })
                .catch(() => {
                  setIsPlaying(false);
                });
            });
        });

        // Reset retry counters on successful segment loaded
        hls.on(Hls.Events.FRAG_LOADED, () => {
          networkRetryCountRef.current = 0;
          mediaRetryCountRef.current = 0;
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) {
            // Ignore non-fatal warnings (e.g. minor buffer gap, PTS nudge)
            return;
          }

          console.warn('[HLS Fatal Error]:', data.type, data.details);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetryCountRef.current < 6) {
                networkRetryCountRef.current += 1;
                console.info(
                  `[HLS Recovery] Network glitch detected. Auto-recovering attempt ${networkRetryCountRef.current}/6...`
                );
                setIsLoading(true);
                setTimeout(() => {
                  if (hlsRef.current) {
                    hlsRef.current.startLoad();
                  }
                }, 1000 * Math.min(networkRetryCountRef.current, 3));
              } else {
                networkRetryCountRef.current = 0;
                // If direct mode exhausted retries, try switching to proxy
                if (!proxyMode) {
                  console.info('[HLS Fallback] Direct stream failed, auto-switching to Proxy CORS...');
                  cleanupMedia();
                  setUseProxy(true);
                  setTimeout(() => startPlayback(true), 200);
                } else {
                  cleanupMedia();
                  setHasError(true);
                  setErrorMessage(
                    'Không thể kết nối đến máy chủ IPTV (Server nguồn có thể đang chặn kết nối hoặc quá tải).'
                  );
                  setIsLoading(false);
                }
              }
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              mediaRetryCountRef.current += 1;
              console.info(
                `[HLS Recovery] Media decode error. Recovery attempt ${mediaRetryCountRef.current}/3...`
              );
              if (mediaRetryCountRef.current === 1) {
                hls.recoverMediaError();
              } else if (mediaRetryCountRef.current === 2) {
                hls.swapAudioCodec();
                hls.recoverMediaError();
              } else {
                mediaRetryCountRef.current = 0;
                cleanupMedia();
                setTimeout(() => startPlayback(proxyMode), 500);
              }
              break;

            default:
              cleanupMedia();
              setHasError(true);
              setErrorMessage('Định dạng luồng phát không tương thích với trình duyệt hiện tại.');
              setIsLoading(false);
              break;
          }
        });
        return;
      }

      // 2. SECONDARY FALLBACK: Native HLS (specifically iOS Safari where MSE is not supported)
      if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = effectiveSource;
        video
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            setAutoplayMuted(false);
          })
          .catch((err) => {
            console.warn('Native playback error or unmuted autoplay blocked:', err);
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
                setAutoplayMuted(true);
              })
              .catch(() => {
                if (!proxyMode) {
                  cleanupMedia();
                  setUseProxy(true);
                  setTimeout(() => startPlayback(true), 100);
                } else {
                  cleanupMedia();
                  setIsLoading(false);
                  setHasError(true);
                  setErrorMessage('Trình duyệt không thể phát luồng này trực tiếp.');
                }
              });
          });
        return;
      }

      // 3. Fallback: If it's HLS, but neither native HLS nor Hls.js is supported
      if (isHls) {
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(
          'Trình duyệt không hỗ trợ công nghệ MediaSource HLS để phát luồng IPTV này trực tiếp. Vui lòng mở bằng VLC hoặc CorePlayer.'
        );
        return;
      }

      // 4. Direct HTML5 video fallback (MP4 or HTTP)
      video.src = effectiveSource;
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          if (!proxyMode) {
            cleanupMedia();
            setUseProxy(true);
            setTimeout(() => startPlayback(true), 100);
          } else {
            cleanupMedia();
            setHasError(true);
            setErrorMessage('Trình duyệt không hỗ trợ giải mã trực tiếp luồng này.');
            setIsLoading(false);
          }
        });
    },
    [channel, getStreamSource, cleanupMedia]
  );

  // Catch unhandled native video element errors (only if Hls.js is not handling it)
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    // If Hls.js is active, let Hls.js handle errors through its internal pipeline
    if (hlsRef.current) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const mediaError = videoRef.current?.error;
    console.warn('Caught video element error:', mediaError?.code, mediaError?.message);

    cleanupMedia();
    setIsPlaying(false);
    setIsLoading(false);

    if (!useProxy && channel) {
      console.info('Auto-switching to proxy mode after video element error...');
      setUseProxy(true);
      setTimeout(() => {
        startPlayback(true);
      }, 100);
      return;
    }

    setHasError(true);
    setErrorMessage(
      'Nguồn phát IPTV thường chặn CORS hoặc sử dụng giao thức chỉ hỗ trợ trên app chuyên dụng (VLC, CorePlayer).'
    );
  };

  // Trigger playback when channel changes, playTrigger increments, or useProxy toggles
  useEffect(() => {
    if (!channel) return;
    cleanupMedia();
    setHasError(false);

    const initialProxy =
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      channel.stream_url.startsWith('http:');
    setUseProxy(initialProxy);

    const timer = setTimeout(() => {
      startPlayback(initialProxy);
    }, 50);

    return () => {
      clearTimeout(timer);
      cleanupMedia();
    };
  }, [channel, playTrigger, cleanupMedia, startPlayback]);

  // Synchronize audio muted / volume state with native video element
  const syncAudioState = useCallback(() => {
    if (!videoRef.current) return;
    const isActuallyMuted = videoRef.current.muted || videoRef.current.volume === 0;
    setIsMuted(isActuallyMuted);
    if (!isActuallyMuted) {
      setAutoplayMuted(false);
    }
  }, []);

  // User interactions
  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          syncAudioState();
        })
        .catch(() => {
          // If unmuted play failed, try muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            setAutoplayMuted(true);
            videoRef.current.play().then(() => {
              setIsPlaying(true);
            });
          }
        });
    }
  };

  const handleToggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!videoRef.current) return;
    const currentMuted = videoRef.current.muted || videoRef.current.volume === 0;
    const newMuted = !currentMuted;
    videoRef.current.muted = newMuted;
    if (!newMuted && videoRef.current.volume === 0) {
      videoRef.current.volume = 1;
    }
    setIsMuted(newMuted);
    if (!newMuted) {
      setAutoplayMuted(false);
    }
  };

  const handleUnmuteAudio = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    if (videoRef.current.volume === 0) {
      videoRef.current.volume = 1;
    }
    setIsMuted(false);
    setAutoplayMuted(false);
  };

  const handleToggleProxy = () => {
    cleanupMedia();
    const nextProxy = !useProxy;
    setUseProxy(nextProxy);
    setHasError(false);
    setIsLoading(true);
    setTimeout(() => {
      startPlayback(nextProxy);
    }, 50);
  };

  const handleRetry = () => {
    cleanupMedia();
    setHasError(false);
    setIsLoading(true);
    setTimeout(() => {
      startPlayback(useProxy);
    }, 50);
  };

  const handleForceProxyRetry = () => {
    cleanupMedia();
    setUseProxy(true);
    setHasError(false);
    setIsLoading(true);
    setTimeout(() => {
      startPlayback(true);
    }, 50);
  };

  const handlePlayServerGateway = () => {
    if (!channel) return;
    cleanupMedia();
    setHasError(false);
    setIsLoading(true);
    setErrorMessage('');
    const video = videoRef.current;
    if (!video) return;

    // Use direct progressive MP4 transcoded stream from server gateway
    const gatewayUrl = `/e72/stream/${encodeURIComponent(channel.id)}.mp4`;
    video.src = gatewayUrl;
    video
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
        setAutoplayMuted(false);
      })
      .catch(() => {
        video.muted = true;
        setIsMuted(true);
        video
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            setAutoplayMuted(true);
          })
          .catch((err) => {
            console.error('Server gateway playback failed:', err);
            setHasError(true);
            setErrorMessage('Máy chủ không thể chuyển mã luồng phát này.');
            setIsLoading(false);
          });
      });
  };

  const handleCopy = () => {
    if (!channel) return;
    navigator.clipboard.writeText(channel.stream_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  if (!channel) {
    return (
      <div className="w-full aspect-video bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col items-center justify-center p-6 text-center text-neutral-400 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mb-3 text-amber-500">
          <Play className="w-8 h-8 fill-current ml-1" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-200">Chưa chọn kênh truyền hình</h3>
        <p className="text-xs text-neutral-500 max-w-sm mt-1">
          Chọn một kênh từ danh sách bên phải hoặc bấm vào biểu tượng Play để bắt đầu phát.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Video Canvas Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center group overflow-hidden">
        {!hasError ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-contain cursor-pointer"
              playsInline
              controls
              onClick={handleTogglePlay}
              onPlay={() => {
                setIsPlaying(true);
                syncAudioState();
              }}
              onPause={() => setIsPlaying(false)}
              onVolumeChange={syncAudioState}
              onLoadedMetadata={syncAudioState}
              onError={handleVideoError}
            />

            {/* Top Sound Control (Biểu tượng tiếng trên) */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`absolute top-3 right-3 z-20 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shadow-lg backdrop-blur-md transition cursor-pointer ${
                isMuted
                  ? 'bg-rose-950/85 text-rose-300 border-rose-700/80 hover:bg-rose-900/90'
                  : 'bg-emerald-950/85 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900/90'
              }`}
              title={isMuted ? 'Bật âm thanh (Unmute)' : 'Tắt tiếng (Mute)'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-[11px] font-bold">
                {isMuted ? 'Tắt tiếng' : 'Bật tiếng'}
              </span>
            </button>

            {/* Autoplay / Muted Notice */}
            {isPlaying && isMuted && (
              <button
                type="button"
                onClick={handleUnmuteAudio}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 hover:bg-amber-400 text-neutral-950 px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition animate-bounce border border-amber-300"
                title="Nhấn để bật âm thanh"
              >
                <VolumeX className="w-4 h-4" />
                <span>Đang tắt tiếng. Bấm vào đây để BẬT TIẾNG!</span>
              </button>
            )}

            {/* Big Center Play Button Overlay (when paused and not loading) */}
            {!isPlaying && !isLoading && (
              <button
                type="button"
                onClick={handleTogglePlay}
                className="absolute z-10 w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-2xl shadow-amber-500/50 hover:scale-110 active:scale-95 transition-all"
                title="Bấm để phát (Play)"
              >
                <Play className="w-8 h-8 fill-current ml-1" />
              </button>
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-none z-10">
                <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mb-2" />
                <p className="text-xs text-neutral-300 font-semibold tracking-wide">
                  {useProxy ? 'ĐANG KẾT NỐI QUA PROXY CORS...' : 'ĐANG TẢI LUỒNG PHÁT...'}
                </p>
              </div>
            )}
          </>
        ) : (
          /* Error Fallback Banner */
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
            <h4 className="text-base font-bold text-white">Không thể phát trực tiếp trên trình duyệt</h4>
            <p className="text-xs text-neutral-400 max-w-md mt-1 mb-4 leading-relaxed">
              {errorMessage || 'Nguồn phát IPTV thường chặn CORS hoặc sử dụng giao thức chỉ hỗ trợ trên app chuyên dụng.'}
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {/* Force Proxy Retry Button */}
              {!useProxy ? (
                <button
                  type="button"
                  onClick={handleForceProxyRetry}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Phát qua Proxy CORS (Khuyên dùng)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Thử lại Proxy
                </button>
              )}

              {/* Server-Side Transcoded Fallback Button */}
              <button
                type="button"
                onClick={handlePlayServerGateway}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-md shadow-blue-600/20"
                title="Sử dụng máy chủ chuyển mã luồng thành MP4 trực tiếp cho trình duyệt"
              >
                <Zap className="w-4 h-4 fill-current text-amber-300" />
                Phát qua Gateway Server (MP4)
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                {copied ? 'Đã sao chép' : 'Sao chép URL'}
              </button>

              <a
                href={channel.stream_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở link gốc
              </a>

              <a
                href={`vlc://${channel.stream_url}`}
                className="px-3 py-2 bg-orange-800 hover:bg-orange-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Mở qua VLC
              </a>

              <a
                href={`/open/${channel.id}`}
                className="px-3 py-2 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                CorePlayer / S60
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Player Meta Info Bar */}
      <div className="p-3.5 bg-neutral-900 border-t border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-11 h-11 object-contain bg-neutral-800 rounded-lg p-1 border border-neutral-700 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-11 h-11 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center font-bold text-amber-400 text-xs flex-shrink-0">
              IPTV
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                {channel.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {channel.group}
              </span>
              {useProxy && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Proxy CORS Bật
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {channel.description ||
                `Định dạng ${channel.format.toUpperCase()} • Codec ${channel.video_codec || 'H.264'} / ${channel.audio_codec || 'AAC'}`}
            </p>
          </div>
        </div>

        {/* Quick Actions & Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Proxy Toggle Button */}
          <button
            type="button"
            onClick={handleToggleProxy}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition border ${
              useProxy
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
            }`}
            title="Bật/Tắt máy chủ Proxy CORS giải quyết chặn luồng"
          >
            <Zap className={`w-3.5 h-3.5 ${useProxy ? 'text-emerald-400' : ''}`} />
            <span>Proxy: {useProxy ? 'BẬT' : 'TẮT'}</span>
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs flex items-center gap-1 border border-neutral-700 transition"
            title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
          </button>

          {/* Bottom Sound Control (Biểu tượng tiếng dưới) */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
              isMuted
                ? 'bg-rose-950/60 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
            }`}
            title={isMuted ? 'Bật âm thanh (Unmute)' : 'Tắt tiếng (Mute)'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{isMuted ? 'Tắt tiếng' : 'Bật tiếng'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs flex items-center gap-1 border border-neutral-700 transition"
            title="Sao chép URL stream"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>{copied ? 'Đã chép!' : 'Copy'}</span>
          </button>

          <a
            href={`/open/${channel.id}`}
            className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/50 rounded-lg text-xs flex items-center gap-1 transition"
            title="Link mở qua CorePlayer hoặc Nokia E72"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CorePlayer</span>
          </a>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition"
            title="Toàn màn hình"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          {onOpenDetails && (
            <button
              type="button"
              onClick={() => onOpenDetails(channel)}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition"
            >
              Chi tiết
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
