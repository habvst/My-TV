import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Channel, DeviceInfo, ChannelSortOption } from './types/iptv';
import { VideoPlayer } from './components/VideoPlayer';
import { ChannelCard, ChannelCardSkeleton } from './components/ChannelCard';
import { ChannelDetailsModal } from './components/ChannelDetailsModal';
import { NokiaSimulatorModal } from './components/NokiaSimulatorModal';
import { M3uImporterModal } from './components/M3uImporterModal';
import { CategoryScrollNav } from './components/CategoryScrollNav';
import { AdminPortal } from './components/AdminPortal';
import { Pagination } from './components/Pagination';
import { ChannelTrafficChart } from './components/ChannelTrafficChart';
import {
  Tv,
  Search,
  Smartphone,
  Upload,
  Download,
  Shield,
  ArrowUpRight,
  RefreshCw,
  Flame,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

const STORAGE_FAVORITES_KEY = 'my_iptv_favorites_v1';
const STORAGE_RECENT_KEY = 'my_iptv_recent_v1';

export default function App() {
  const [viewMode, setViewMode] = useState<'app' | 'admin'>(() => {
    return typeof window !== 'undefined' && window.location.pathname === '/admin' ? 'admin' : 'app';
  });

  // Channel & Pagination state (strict 60 channels per page limit)
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [playTrigger, setPlayTrigger] = useState<number>(0);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<ChannelSortOption>('default');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalMatching, setTotalMatching] = useState<number>(0);

  // Global Categories & System stats from server
  const [categories, setCategories] = useState<string[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [totalSystemChannels, setTotalSystemChannels] = useState<number>(0);

  // Local user state
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // Stable refs to prevent loadChannels recreation when channel or favorites change
  const favoritesRef = useRef<string[]>(favorites);
  favoritesRef.current = favorites;

  const recentIdsRef = useRef<string[]>(recentIds);
  recentIdsRef.current = recentIds;

  const selectedChannelRef = useRef<Channel | null>(selectedChannel);
  selectedChannelRef.current = selectedChannel;

  // Modals
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);
  const [isNokiaSimOpen, setIsNokiaSimOpen] = useState<boolean>(false);
  const [isM3uModalOpen, setIsM3uModalOpen] = useState<boolean>(false);

  const channelListRef = useRef<HTMLDivElement>(null);

  // Listen to popstate for back/forward
  useEffect(() => {
    const handlePopState = () => {
      setViewMode(window.location.pathname === '/admin' ? 'admin' : 'app');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load favorites & recent from localStorage
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem(STORAGE_FAVORITES_KEY);
      if (savedFavs) setFavorites(JSON.parse(savedFavs));

      const savedRecent = localStorage.getItem(STORAGE_RECENT_KEY);
      if (savedRecent) setRecentIds(JSON.parse(savedRecent));
    } catch (e) {
      console.warn('Could not read localStorage:', e);
    }
  }, []);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch device info & global categories list
  const fetchMetadata = useCallback(async () => {
    try {
      const [groupsRes, deviceRes] = await Promise.all([
        fetch('/api/groups'),
        fetch('/api/device-info')
      ]);

      if (groupsRes.ok) {
        const gData = await groupsRes.json();
        setCategories(gData.groups || []);
        setGroupCounts(gData.counts || {});
        setTotalSystemChannels(gData.totalChannels || 0);
      }

      if (deviceRes.ok) {
        const dData = await deviceRes.json();
        setDeviceInfo(dData);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Server-Side Channels Fetcher with Pagination, Sorting & Filtering (Strict 60 channels per page)
  const loadChannels = useCallback(
    async (group: string, query: string, page: number = 1, sort: ChannelSortOption = 'default') => {
      setLoading(true);

      try {
        // Special local tabs: favorites and recent
        if (group === 'favorites' || group === 'recent') {
          const res = await fetch('/api/channels?limit=all');
          if (res.ok) {
            const data = await res.json();
            const allItems: Channel[] = data.channels || [];
            const targetIds = group === 'favorites' ? favoritesRef.current : recentIdsRef.current;
            let filtered = allItems.filter((c) => targetIds.includes(c.id));

            if (query.trim()) {
              const qLower = query.toLowerCase().trim();
              filtered = filtered.filter(
                (c) =>
                  c.name.toLowerCase().includes(qLower) ||
                  c.group.toLowerCase().includes(qLower) ||
                  (c.description && c.description.toLowerCase().includes(qLower))
              );
            }

            // Apply sorting for local tabs
            if (sort === 'popular') {
              filtered.sort((a, b) => {
                const countA = a.view_count || 0;
                const countB = b.view_count || 0;
                if (countB !== countA) return countB - countA;
                return a.name.localeCompare(b.name);
              });
            } else if (sort === 'recent') {
              filtered.sort((a, b) => {
                const timeA = a.updated_at || a.created_at ? new Date(a.updated_at || a.created_at || '').getTime() : 0;
                const timeB = b.updated_at || b.created_at ? new Date(b.updated_at || b.created_at || '').getTime() : 0;
                if (timeB !== timeA) return timeB - timeA;
                return a.name.localeCompare(b.name);
              });
            } else if (sort === 'name') {
              filtered.sort((a, b) => a.name.localeCompare(b.name));
            }

            const total = filtered.length;
            const limit = 60;
            const computedTotalPages = Math.max(1, Math.ceil(total / limit));
            const validPage = Math.min(Math.max(1, page), computedTotalPages);
            const startIndex = (validPage - 1) * limit;
            const paginated = filtered.slice(startIndex, startIndex + limit);

            setChannels(paginated);
            setTotalMatching(total);
            setCurrentPage(validPage);
            setTotalPages(computedTotalPages);

            if (paginated.length > 0 && !selectedChannelRef.current) {
              setSelectedChannel(paginated[0]);
            }
          }
          return;
        }

        // Standard server-side filtering, sorting & search (60 channels per page)
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '60');
        if (group && group !== 'all') {
          params.set('group', group);
        }
        if (query.trim()) {
          params.set('q', query.trim());
        }
        if (sort && sort !== 'default') {
          params.set('sort', sort);
        }

        const res = await fetch(`/api/channels?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const newChannels: Channel[] = data.channels || [];

          setChannels(newChannels);
          setTotalMatching(data.total || 0);
          setCurrentPage(data.page || 1);
          setTotalPages(data.totalPages || 1);

          if (!selectedChannelRef.current && newChannels.length > 0) {
            setSelectedChannel(newChannels[0]);
          }
        }
      } catch (err) {
        console.error('Error loading channels:', err);
      } finally {
        setLoading(false);
      }
    },
    [] // Stable empty dependency: no re-fetches when channel is selected or favorites modified
  );

  // Trigger load when group, debounced query, or sortOption changes
  useEffect(() => {
    setCurrentPage(1);
    loadChannels(activeGroup, debouncedQuery, 1, sortOption);
  }, [activeGroup, debouncedQuery, sortOption, loadChannels]);

  // Handle sort change
  const handleSortChange = (newSort: ChannelSortOption) => {
    if (newSort === sortOption) return;
    setSortOption(newSort);
  };

  // Handle page navigation
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || loading) return;
    setCurrentPage(newPage);
    loadChannels(activeGroup, debouncedQuery, newPage, sortOption);
    // Smoothly scroll the channel list container to the top ONLY on page change
    if (channelListRef.current) {
      channelListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle select & play channel - keeps list and scroll position intact
  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setPlayTrigger((prev) => prev + 1);

    // Immediately increment view count in React state for instant UI update
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id ? { ...c, view_count: (c.view_count || 0) + 1 } : c
      )
    );

    // Record click on server
    fetch(`/api/channels/${encodeURIComponent(channel.id)}/click`, { method: 'POST' }).catch(() => {});

    // Update recently watched list without re-triggering channel list re-renders
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== channel.id);
      const updated = [channel.id, ...filtered].slice(0, 30);
      try {
        localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return updated;
    });
  };

  // Toggle favorite
  const handleToggleFavorite = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      try {
        localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }
      return updated;
    });
  };

  // Open Channel Detail modal
  const handleOpenDetails = (channel: Channel, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDetailChannel(channel);
  };

  // Import custom channels from M3U parser
  const handleImportChannels = (newChannels: Channel[]) => {
    setChannels(newChannels);
    setTotalMatching(newChannels.length);
    if (newChannels.length > 0) {
      setSelectedChannel(newChannels[0]);
      setActiveGroup('all');
    }
    fetchMetadata();
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setViewMode('admin');
  };

  const navigateToApp = () => {
    window.history.pushState({}, '', '/');
    setViewMode('app');
    fetchMetadata();
    loadChannels(activeGroup, debouncedQuery, 1);
  };

  // ---------------------------------------------------------------------------
  // IF VIEW MODE IS ADMIN, RENDER ADMIN PORTAL
  // ---------------------------------------------------------------------------
  if (viewMode === 'admin') {
    return <AdminPortal onBackToApp={navigateToApp} />;
  }

  // ---------------------------------------------------------------------------
  // MAIN MODERN IPTV INTERFACE
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-neutral-950 font-black">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white leading-tight">
                  MY IPTV
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Universal
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {totalSystemChannels.toLocaleString()} kênh &bull; CorePlayer &bull; Modern Web
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation Bridge */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Admin Portal Button */}
            <button
              onClick={navigateToAdmin}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 border border-neutral-700/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Mở bảng điều khiển quản trị playlist và kênh"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Quản Trị</span>
            </button>

            {/* Nokia Simulator Button */}
            <button
              onClick={() => setIsNokiaSimOpen(true)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
              title="Mô phỏng trình duyệt Nokia E72 S60"
            >
              <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Mô phỏng</span> E72
            </button>

            {/* Direct Switch to Legacy Page */}
            <a
              href="/legacy"
              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Chuyển sang giao diện HTML thuần siêu nhẹ cho E72"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>S60 (Siêu nhẹ)</span>
            </a>

            {/* Import Custom M3U */}
            <button
              onClick={() => setIsM3uModalOpen(true)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Nhập playlist M3U tạm thời"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden md:inline">Nhập M3U</span>
            </button>

            {/* Download M3U */}
            <a
              href="/playlist.m3u"
              download="playlist.m3u"
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Tải về file playlist.m3u cho VLC / CorePlayer"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden md:inline">Tải M3U</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex flex-col gap-4">
        {/* Auto Device Detection Banner & View Selector */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-neutral-400">
              Tự động nhận diện thiết bị:{' '}
              <strong className="text-white">
                {deviceInfo?.type === 'NOKIA_S60'
                  ? 'Nokia E72 / Symbian S60'
                  : deviceInfo?.type === 'MOBILE_MODERN'
                  ? 'Điện thoại di động (Mobile)'
                  : deviceInfo?.type === 'TABLET'
                  ? 'Máy tính bảng (Tablet)'
                  : 'Máy tính để bàn (Desktop)'}
              </strong>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {totalSystemChannels.toLocaleString()} kênh trực tuyến
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-500 text-[11px]">Chế độ xem:</span>
            <a
              href="/?view=reset"
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] font-medium transition"
              title="Khôi phục nhận diện tự động theo User-Agent"
            >
              Tự động
            </a>
            <a
              href="/?view=legacy"
              className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded text-[11px] font-medium transition"
              title="Chuyển sang giao diện HTML thuần cho Nokia E72"
            >
              Nokia E72 (S60)
            </a>
            <a
              href="/?view=modern"
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium transition"
              title="Giao diện hiện đại đầy đủ"
            >
              Hiện đại
            </a>
          </div>
        </div>

        {/* Layout Container */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column: Player & Stream Hub (Desktop: ~56% width) */}
          <div className="w-full lg:w-[56%] flex flex-col gap-4">
            {/* Main HLS Video Player */}
            <VideoPlayer
              channel={selectedChannel}
              playTrigger={playTrigger}
              onOpenDetails={(ch) => handleOpenDetails(ch)}
            />

            {/* Quick Hub: CorePlayer on Nokia E72 Banner */}
            <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex-shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Đang dùng Nokia E72 hoặc Symbian S60?
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Mở trình duyệt mặc định trên máy để xem giao diện siêu nhẹ và mở CorePlayer:
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href="/legacy"
                      className="text-xs text-amber-400 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      Xem giao diện Nokia E72 thuần HTML &raquo;
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-full sm:w-auto flex sm:flex-col gap-2">
                <button
                  onClick={() => setIsNokiaSimOpen(true)}
                  className="w-full text-center px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-medium transition"
                >
                  Mở giả lập E72
                </button>
              </div>
            </div>

            {/* Server Stats & Health */}
            <div className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Hệ thống: <strong className="text-neutral-200">{totalSystemChannels.toLocaleString()} kênh</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={navigateToAdmin} className="text-amber-400 hover:underline font-medium">
                  Quản trị Playlists
                </button>
                <a href="/health" target="_blank" className="hover:text-amber-400 transition">
                  /health
                </a>
              </div>
            </div>

            {/* 7-Day Channel Traffic Trend Chart (Recharts) */}
            <ChannelTrafficChart />
          </div>

          {/* Right Column: Channels Navigation & Grid (Desktop: ~44% width) */}
          <div className="w-full lg:w-[44%] flex flex-col gap-3">
            {/* Search Box - Searches across all 11,000+ channels */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm kênh trong toàn bộ hệ thống..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs px-1"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Category Tabs with Horizontal Scroll, Swipe, and Channel Counts */}
            <CategoryScrollNav
              categories={categories}
              groupCounts={groupCounts}
              activeGroup={activeGroup}
              onSelectGroup={(grp) => setActiveGroup(grp)}
              totalChannels={totalSystemChannels}
              favoritesCount={favorites.length}
              recentCount={recentIds.length}
            />

            {/* Sort Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-neutral-900/90 border border-neutral-800 rounded-xl">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1 mr-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                  Sắp xếp:
                </span>

                <button
                  type="button"
                  onClick={() => handleSortChange('default')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    sortOption === 'default'
                      ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  }`}
                  title="Thứ tự mặc định"
                >
                  Mặc định
                </button>

                <button
                  type="button"
                  onClick={() => handleSortChange('popular')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    sortOption === 'popular'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/60'
                  }`}
                  title="Sắp xếp theo số lượt xem và lượt click nhiều nhất"
                >
                  <Flame className={`w-3.5 h-3.5 ${sortOption === 'popular' ? 'text-amber-400' : 'text-neutral-500'}`} />
                  <span>Phổ biến nhất</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSortChange('recent')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    sortOption === 'recent'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800/60'
                  }`}
                  title="Sắp xếp theo thời gian mới thêm hoặc cập nhật gần đây"
                >
                  <Clock className={`w-3.5 h-3.5 ${sortOption === 'recent' ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  <span>Mới thêm gần đây</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSortChange('name')}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    sortOption === 'name'
                      ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  }`}
                  title="Sắp xếp theo tên kênh từ A đến Z"
                >
                  <span>Tên A-Z</span>
                </button>
              </div>

              {(activeGroup !== 'all' || debouncedQuery || sortOption !== 'default') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroup('all');
                    setSearchQuery('');
                    handleSortChange('default');
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline transition ml-auto"
                >
                  Đặt lại
                </button>
              )}
            </div>

            {/* Active Filter & Mini Paging Header */}
            <div className="flex flex-wrap items-center justify-between text-xs px-1 text-neutral-400 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeGroup !== 'all' ? (
                  <span>
                    Đang lọc nhóm: <strong className="text-amber-400 font-semibold">{activeGroup}</strong>
                  </span>
                ) : (
                  <span>Tất cả kênh</span>
                )}
                {debouncedQuery && (
                  <span>
                    &bull; Từ khóa: <strong className="text-white">"{debouncedQuery}"</strong>
                  </span>
                )}
                {sortOption === 'popular' && (
                  <span className="text-amber-400 font-medium flex items-center gap-0.5">
                    &bull; <Flame className="w-3 h-3 text-amber-500 inline" /> Phổ biến
                  </span>
                )}
                {sortOption === 'recent' && (
                  <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                    &bull; <Clock className="w-3 h-3 text-emerald-500 inline" /> Mới thêm
                  </span>
                )}
                {sortOption === 'name' && (
                  <span className="text-neutral-300 font-medium">
                    &bull; A-Z
                  </span>
                )}
                <span>
                  &bull; Tìm thấy: <strong className="text-emerald-400 font-semibold">{totalMatching.toLocaleString()} kênh</strong>
                </span>
                {totalPages > 1 && (
                  <span className="text-[11px] text-neutral-300 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md font-mono">
                    Trang <strong className="text-amber-400 font-bold">{currentPage}</strong> / {totalPages}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Quick mini prev/next buttons */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || loading}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="px-2 py-0.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] disabled:opacity-30 disabled:cursor-not-allowed transition text-neutral-300"
                      title="Trang trước"
                    >
                      &larr; Trang trước
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages || loading}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="px-2 py-0.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] disabled:opacity-30 disabled:cursor-not-allowed transition text-neutral-300"
                      title="Trang sau"
                    >
                      Trang sau &rarr;
                    </button>
                  </div>
                )}

                {(activeGroup !== 'all' || debouncedQuery) && (
                  <button
                    onClick={() => {
                      setActiveGroup('all');
                      setSearchQuery('');
                    }}
                    className="text-[11px] text-rose-400 hover:underline ml-1"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* Channels Grid / List with Custom Smooth Scrollbar */}
            <div
              ref={channelListRef}
              className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[620px] pr-1.5 custom-scrollbar"
            >
              {loading ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1 py-1 text-xs text-neutral-400">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      <span className="text-neutral-300 font-medium">Đang tải danh sách kênh (Trang {currentPage})...</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono">Tối đa 60 kênh/trang</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
                    {Array.from({ length: 12 }).map((_, idx) => (
                      <ChannelCardSkeleton key={`skeleton-${idx}`} />
                    ))}
                  </div>
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900/40 rounded-xl border border-neutral-800 p-6">
                  <Tv className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400">Không tìm thấy kênh phù hợp.</p>
                  {(activeGroup !== 'all' || debouncedQuery) && (
                    <button
                      onClick={() => {
                        setActiveGroup('all');
                        setSearchQuery('');
                      }}
                      className="mt-2 text-xs text-amber-400 hover:underline"
                    >
                      Đặt lại bộ lọc để xem tất cả kênh
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
                    {channels.map((channel) => (
                      <ChannelCard
                        key={channel.id}
                        channel={channel}
                        isActive={selectedChannel?.id === channel.id}
                        isFavorite={favorites.includes(channel.id)}
                        onSelect={handleSelectChannel}
                        onPlay={handleSelectChannel}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenDetails={(ch, e) => handleOpenDetails(ch, e)}
                      />
                    ))}
                  </div>

                  {/* Standard Pagination Bar with maximum 60 channels per page */}
                  <div className="pt-2 pb-3">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalMatching}
                      itemsPerPage={60}
                      onPageChange={handlePageChange}
                      disabled={loading}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-800/80 bg-neutral-950 py-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            MY IPTV &copy; 2026 &bull; {totalSystemChannels.toLocaleString()} kênh trực tuyến &bull; Tương thích Nokia E72
          </div>
          <div className="flex items-center gap-3">
            <button onClick={navigateToAdmin} className="hover:text-amber-400 transition font-medium">
              Quản trị Admin
            </button>
            <span>&bull;</span>
            <a href="/legacy" className="hover:text-amber-400 transition">Bản Nokia E72</a>
            <span>&bull;</span>
            <a href="/playlist.m3u" className="hover:text-amber-400 transition">M3U Playlist</a>
            <span>&bull;</span>
            <a href="/health" className="hover:text-amber-400 transition">Health Status</a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ChannelDetailsModal
        channel={detailChannel}
        onClose={() => setDetailChannel(null)}
        onPlayChannel={(ch) => handleSelectChannel(ch)}
      />

      <NokiaSimulatorModal
        isOpen={isNokiaSimOpen}
        onClose={() => setIsNokiaSimOpen(false)}
      />

      <M3uImporterModal
        isOpen={isM3uModalOpen}
        onClose={() => setIsM3uModalOpen(false)}
        onImportChannels={handleImportChannels}
      />
    </div>
  );
}
