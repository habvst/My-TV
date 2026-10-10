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
  Zap,
  SkipForward,
  SkipBack,
  WifiOff,
  AlertTriangle
} from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel | null;
  playTrigger?: number;
  onOpenDetails?: (channel: Channel) => void;
  onNextChannel?: () => void;
  onPreviousChannel?: () => void;
  onChannelError?: (channel: Channel, errorType?: string) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  playTrigger = 0,
  onOpenDetails,
  onNextChannel,
  onPreviousChannel,
  onChannelError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const networkRetryCountRef = useRef<number>(0);
  const mediaRetryCountRef = useRef<number>(0);

  // Watchdog & Loading Ticker refs
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTickerRef = useRef<NodeJS.Timeout | null>(null);
  const lastToggleTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingSeconds, setLoadingSeconds] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>('Đang kết nối luồng phát...');

  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorType, setErrorType] = useState<'TIMEOUT' | 'OFFLINE' | 'DECODE' | 'UNKNOWN'>('UNKNOWN');
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

  // Clear watchdog timers
  const clearWatchdogs = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (loadingTickerRef.current) {
      clearInterval(loadingTickerRef.current);
      loadingTickerRef.current = null;
    }
  }, []);

  // Stop and clean up HLS and video element
  const cleanupMedia = useCallback(() => {
    clearWatchdogs();
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
  }, [clearWatchdogs]);

  // Load and play stream with watchdog protection
  const startPlayback = useCallback(
    (proxyMode: boolean) => {
      if (!channel) return;
      cleanupMedia();

      setHasError(false);
      setErrorMessage('');
      setErrorType('UNKNOWN');
      setIsLoading(true);
      setLoadingSeconds(0);
      setLoadingMessage(
        proxyMode ? 'Đang kết nối qua Proxy CORS bảo vệ...' : 'Đang kết nối luồng phát trực tiếp...'
      );

      networkRetryCountRef.current = 0;
      mediaRetryCountRef.current = 0;

      const rawUrl = channel.stream_url.trim();
      const effectiveSource = getStreamSource(rawUrl, proxyMode);
      const isHls =
        channel.format === 'hls' ||
        rawUrl.includes('.m3u8') ||
        effectiveSource.includes('.m3u8');

      const video = videoRef.current;
      if (!video) return;

      // -------------------------------------------------------------
      // 1. WATCHDOG TIMER: Maximum 8 seconds per stream attempt
      // -------------------------------------------------------------
      loadingTickerRef.current = setInterval(() => {
        setLoadingSeconds((prev) => {
          const next = prev + 1;
          if (next === 3 && !proxyMode) {
            setLoadingMessage('Máy chủ chậm hoặc chặn CORS. Đang tự động chuyển qua Proxy...');
          } else if (next === 5) {
            setLoadingMessage('Đang phân tích định dạng luồng và giải mã dữ liệu...');
          }
          return next;
        });
      }, 1000);

      // Auto-switch to proxy at 3.5s if direct mode hasn't received data
      let autoProxyTimer: NodeJS.Timeout | null = null;
      if (!proxyMode) {
        autoProxyTimer = setTimeout(() => {
          if (!videoRef.current?.paused && videoRef.current?.currentTime && videoRef.current.currentTime > 0) {
            return;
          }
          console.info('[Watchdog] Direct stream unresponsive after 3.5s. Auto-switching to Proxy CORS...');
          clearWatchdogs();
          cleanupMedia();
          setUseProxy(true);
          startPlayback(true);
        }, 3500);
      }

      // Hard timeout after 8 seconds: Mark channel dead/offline
      watchdogTimerRef.current = setTimeout(() => {
        if (autoProxyTimer) clearTimeout(autoProxyTimer);
        console.warn(`[Watchdog Timeout] Stream not responding after 8s for channel: ${channel.name}`);
        clearWatchdogs();
        cleanupMedia();
        setIsLoading(false);
        setHasError(true);
        setErrorType('TIMEOUT');
        setErrorMessage(
          'Thời gian kết nối vượt quá 8 giây. Máy chủ nguồn IPTV này hiện đang ngoại tuyến, băng thông bị nghẽn hoặc chặn IP.'
        );
        onChannelError?.(channel, 'TIMEOUT');
      }, 8000);

      // Helper to mark playback successfully started
      const onStreamSuccess = () => {
        if (autoProxyTimer) clearTimeout(autoProxyTimer);
        clearWatchdogs();
        setIsLoading(false);
        setHasError(false);
      };

      // -------------------------------------------------------------
      // 2. PRIMARY ENGINE: HLS.js with MediaSource Extensions
      // -------------------------------------------------------------
      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 8,
          liveDurationInfinity: true,
          // Aggressive IPTV timeouts: fast fail rather than hanging for minutes
          manifestLoadingTimeOut: 4500,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 600,
          manifestLoadingMaxRetryTimeout: 8000,
          levelLoadingTimeOut: 4500,
          levelLoadingMaxRetry: 1,
          levelLoadingRetryDelay: 600,
          levelLoadingMaxRetryTimeout: 8000,
          fragLoadingTimeOut: 7000,
          fragLoadingMaxRetry: 2,
          fragLoadingRetryDelay: 800,
          fragLoadingMaxRetryTimeout: 12000,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        hls.loadSource(effectiveSource);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          onStreamSuccess();
          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setAutoplayMuted(false);
            })
            .catch((err) => {
              console.warn('Autoplay unmuted blocked by browser policy:', err);
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
          onStreamSuccess();
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) {
            return;
          }

          console.warn('[HLS Fatal Error]:', data.type, data.details);

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!proxyMode) {
                // If direct network failed, switch to proxy IMMEDIATELY without waiting
                if (autoProxyTimer) clearTimeout(autoProxyTimer);
                clearWatchdogs();
                cleanupMedia();
                console.info('[HLS Fallback] Direct stream failed with network error, auto-switching to Proxy CORS...');
                setUseProxy(true);
                setTimeout(() => startPlayback(true), 100);
              } else {
                // Proxy mode also failed: Mark stream as offline
                if (autoProxyTimer) clearTimeout(autoProxyTimer);
                clearWatchdogs();
                cleanupMedia();
                setIsLoading(false);
                setHasError(true);
                setErrorType('OFFLINE');
                setErrorMessage('Máy chủ IPTV từ chối kết nối hoặc đã ngừng phát sóng.');
                onChannelError?.(channel, 'OFFLINE');
              }
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              mediaRetryCountRef.current += 1;
              console.info(`[HLS Recovery] Media decode error. Attempt ${mediaRetryCountRef.current}/2...`);
              if (mediaRetryCountRef.current === 1) {
                hls.recoverMediaError();
              } else {
                mediaRetryCountRef.current = 0;
                if (autoProxyTimer) clearTimeout(autoProxyTimer);
                clearWatchdogs();
                cleanupMedia();
                setIsLoading(false);
                setHasError(true);
                setErrorType('DECODE');
                setErrorMessage('Định dạng video/audio này không hỗ trợ giải mã trực tiếp trên trình duyệt web.');
                onChannelError?.(channel, 'DECODE');
              }
              break;

            default:
              if (autoProxyTimer) clearTimeout(autoProxyTimer);
              clearWatchdogs();
              cleanupMedia();
              setIsLoading(false);
              setHasError(true);
              setErrorType('DECODE');
              setErrorMessage('Định dạng luồng phát không tương thích với trình duyệt hiện tại.');
              onChannelError?.(channel, 'DECODE');
              break;
          }
        });
        return;
      }

      // -------------------------------------------------------------
      // 3. SECONDARY FALLBACK: Native HLS (iOS Safari)
      // -------------------------------------------------------------
      if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = effectiveSource;
        video
          .play()
          .then(() => {
            onStreamSuccess();
            setIsPlaying(true);
            setAutoplayMuted(false);
          })
          .catch((err) => {
            console.warn('Native playback error or unmuted autoplay blocked:', err);
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                onStreamSuccess();
                setIsPlaying(true);
                setAutoplayMuted(true);
              })
              .catch(() => {
                if (!proxyMode) {
                  cleanupMedia();
                  setUseProxy(true);
                  setTimeout(() => startPlayback(true), 100);
                } else {
                  clearWatchdogs();
                  cleanupMedia();
                  setIsLoading(false);
                  setHasError(true);
                  setErrorType('OFFLINE');
                  setErrorMessage('Trình duyệt không thể phát luồng này trực tiếp.');
                  onChannelError?.(channel, 'OFFLINE');
                }
              });
          });
        return;
      }

      // -------------------------------------------------------------
      // 4. DIRECT HTML5 VIDEO FALLBACK (MP4 or HTTP)
      // -------------------------------------------------------------
      video.src = effectiveSource;
      video
        .play()
        .then(() => {
          onStreamSuccess();
          setIsPlaying(true);
        })
        .catch(() => {
          if (!proxyMode) {
            cleanupMedia();
            setUseProxy(true);
            setTimeout(() => startPlayback(true), 100);
          } else {
            clearWatchdogs();
            cleanupMedia();
            setIsLoading(false);
            setHasError(true);
            setErrorType('OFFLINE');
            setErrorMessage('Trình duyệt không hỗ trợ giải mã trực tiếp luồng này.');
            onChannelError?.(channel, 'OFFLINE');
          }
        });
    },
    [channel, getStreamSource, cleanupMedia, clearWatchdogs, onChannelError]
  );

  // Catch unhandled native video element errors
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    if (hlsRef.current) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const mediaError = videoRef.current?.error;
    console.warn('Caught video element error:', mediaError?.code, mediaError?.message);

    clearWatchdogs();
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
    setErrorType('OFFLINE');
    setErrorMessage(
      'Nguồn phát IPTV thường chặn CORS hoặc sử dụng giao thức chỉ hỗ trợ trên app chuyên dụng (VLC, CorePlayer).'
    );
    if (channel) {
      onChannelError?.(channel, 'OFFLINE');
    }
  };

  // Trigger playback on channel change or playTrigger
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

  // User interactions: Reliable Play/Pause toggle with cooldown
  const handleTogglePlay = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const video = videoRef.current;
    if (!video) return;

    const now = Date.now();
    if (now - lastToggleTimeRef.current < 400) {
      return;
    }
    lastToggleTimeRef.current = now;

    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
    } else {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          syncAudioState();
        })
        .catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            setAutoplayMuted(true);
            videoRef.current
              .play()
              .then(() => {
                setIsPlaying(true);
              })
              .catch((err) => {
                console.warn('Playback error:', err);
              });
          }
        });
    }
  };

  // Click on video surface outside native controls bar
  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const isControlsArea = e.clientY > rect.bottom - 56;
    if (isControlsArea) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    handleTogglePlay(e);
  };

  const handleToggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    if (e) e.stopPropagation();
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
            setErrorType('OFFLINE');
            setErrorMessage('Máy chủ không thể chuyển mã luồng phát này.');
            setIsLoading(false);
            onChannelError?.(channel, 'GATEWAY_ERROR');
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
              onClick={handleVideoClick}
              onPlay={() => {
                setIsPlaying(true);
                syncAudioState();
              }}
              onPause={() => setIsPlaying(false)}
              onVolumeChange={syncAudioState}
              onLoadedMetadata={syncAudioState}
              onError={handleVideoError}
            />

            {/* Top Sound Control */}
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

            {/* Big Center Play Button Overlay */}
            {!isPlaying && !isLoading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePlay(e);
                }}
                className="absolute z-10 w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-2xl shadow-amber-500/50 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Bấm để phát (Play)"
              >
                <Play className="w-8 h-8 fill-current ml-1" />
              </button>
            )}

            {/* Smart Loading Overlay with Dynamic Multi-Stage Status & Skip Button */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center z-10 p-6 text-center animate-fadeIn">
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
                  <span className="absolute text-[11px] font-bold text-amber-400">
                    {loadingSeconds}s
                  </span>
                </div>
                <p className="text-xs font-bold text-neutral-200 tracking-wide max-w-sm leading-relaxed">
                  {loadingMessage}
                </p>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Đang giám sát luồng phát • Giới hạn chờ tối đa 8 giây
                </p>

                {/* Instant Skip button during loading */}
                {onNextChannel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNextChannel();
                    }}
                    className="mt-3.5 px-3 py-1.5 bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 border border-neutral-700 shadow-md transition pointer-events-auto cursor-pointer"
                    title="Bỏ qua kênh này để chuyển kênh kế tiếp ngay"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bỏ qua sang kênh kế tiếp</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          /* Rich Diagnostic Error Fallback Banner */
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-2 shadow-lg shadow-rose-950/50">
              {errorType === 'TIMEOUT' ? (
                <WifiOff className="w-6 h-6 animate-pulse" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/70 border border-rose-700/50 text-rose-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <span>
                {errorType === 'TIMEOUT'
                  ? 'Quá thời gian phản hồi (Hết 8s)'
                  : errorType === 'OFFLINE'
                  ? 'Máy chủ ngoại tuyến / Chặn kết nối'
                  : 'Không hỗ trợ định dạng'}
              </span>
            </div>

            <h4 className="text-base font-bold text-white max-w-md truncate">
              {channel.name}
            </h4>

            <p className="text-xs text-neutral-400 max-w-md mt-1 mb-4 leading-relaxed">
              {errorMessage || 'Nguồn phát IPTV thường chặn CORS hoặc sử dụng giao thức chỉ hỗ trợ trên app chuyên dụng.'}
            </p>

            {/* Quick Action Matrix */}
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {/* PRIMARY: Next Channel button (Fastest way to keep user happy!) */}
              {onNextChannel && (
                <button
                  type="button"
                  onClick={onNextChannel}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/25 cursor-pointer hover:scale-105 active:scale-95"
                  title="Chuyển ngay sang kênh tiếp theo trong danh sách"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                  Chuyển kênh kế tiếp
                </button>
              )}

              {/* Retry with Proxy */}
              {!useProxy ? (
                <button
                  type="button"
                  onClick={handleForceProxyRetry}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Thử qua Proxy CORS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  Thử lại kết nối
                </button>
              )}

              {/* Server Transcode Gateway Button */}
              <button
                type="button"
                onClick={handlePlayServerGateway}
                className="px-3 py-2 bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 border border-blue-800/60 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Sử dụng máy chủ chuyển mã luồng thành MP4 trực tiếp cho trình duyệt"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                Chuyển mã Gateway (MP4)
              </button>

              {/* Copy Direct URL */}
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-neutral-800 transition cursor-pointer"
                title="Sao chép link stream để dán vào VLC/PotPlayer"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                {copied ? 'Đã sao chép!' : 'Copy URL'}
              </button>

              {/* Open in CorePlayer / VLC external link */}
              <a
                href={`/open/${channel.id}`}
                className="px-2.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/60 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                title="Mở qua CorePlayer trên Nokia E72 hoặc VLC"
              >
                <ExternalLink className="w-3.5 h-3.5 text-rose-300" />
                Mở CorePlayer / VLC
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
                  Proxy Bật
                </span>
              )}
              {hasError && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Lỗi nguồn
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {channel.description ||
                `Định dạng ${channel.format.toUpperCase()} • Codec ${channel.video_codec || 'H.264'} / ${channel.audio_codec || 'AAC'}`}
            </p>
          </div>
        </div>

        {/* Quick Actions & Navigation Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Previous Channel */}
          {onPreviousChannel && (
            <button
              type="button"
              onClick={onPreviousChannel}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition cursor-pointer"
              title="Kênh trước đó"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Next Channel */}
          {onNextChannel && (
            <button
              type="button"
              onClick={onNextChannel}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition cursor-pointer"
              title="Kênh kế tiếp"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Proxy Toggle Button */}
          <button
            type="button"
            onClick={handleToggleProxy}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition border cursor-pointer ${
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
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs flex items-center gap-1 border border-neutral-700 transition cursor-pointer"
            title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
          </button>

          {/* Sound Control */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
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
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs flex items-center gap-1 border border-neutral-700 transition cursor-pointer"
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
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition cursor-pointer"
            title="Toàn màn hình"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          {onOpenDetails && (
            <button
              type="button"
              onClick={() => onOpenDetails(channel)}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition cursor-pointer"
            >
              Chi tiết
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
