import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Playlist, Channel, StreamTestResult, AdminStats, ChannelScanResult } from '../types/iptv';
import { VideoPlayer } from './VideoPlayer';
import {
  Shield,
  Layers,
  Tv,
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Lock,
  LogOut,
  ArrowLeft,
  Search,
  Upload,
  Globe,
  FileText,
  Play,
  Database,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Radio,
  Pause,
  Zap,
  Download,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';

const ADMIN_TOKEN_KEY = 'my_iptv_admin_token';

interface AdminPortalProps {
  onBackToApp: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToApp }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'playlists' | 'channels' | 'tester'>('playlists');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Forms
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState<boolean>(false);
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    type: 'url' as 'url' | 'content',
    url: '',
    content: '',
    enabled: true,
  });

  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const [isChannelModalOpen, setIsChannelModalOpen] = useState<boolean>(false);
  const [channelForm, setChannelForm] = useState<Partial<Channel>>({
    name: '',
    group: 'VTV',
    logo: '',
    stream_url: '',
    format: 'hls',
    tvg_id: '',
    tvg_name: '',
    status: 'active',
  });
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState<Channel | null>(null);

  // Filter & Search in Channels tab
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [filterPlaylist, setFilterPlaylist] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'offline' | 'check'>('all');

  // Scanner modal & execution state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerScope, setScannerScope] = useState<'all' | 'playlist' | 'group'>('all');
  const [scannerPlaylistId, setScannerPlaylistId] = useState<string>('all');
  const [scannerGroup, setScannerGroup] = useState<string>('all');
  const [scannerLimit, setScannerLimit] = useState<number>(0); // 0 = all
  const [scannerAutoMark, setScannerAutoMark] = useState<boolean>(true);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{
    total: number;
    scanned: number;
    online: number;
    warning: number;
    offline: number;
    currentChannelName?: string;
  }>({ total: 0, scanned: 0, online: 0, warning: 0, offline: 0 });

  const [scanResults, setScanResults] = useState<ChannelScanResult[]>([]);
  const [scanResultFilter, setScanResultFilter] = useState<'all' | 'offline' | 'online'>('all');
  const scanAbortRef = useRef<boolean>(false);
  const scanPausedRef = useRef<boolean>(false);

  // Pagination state in Channels tab
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');
  const tableScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-reset page to 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [channelSearch, filterPlaylist, filterGroup, filterStatus, pageSize]);

  // Stream probe state
  const [testUrlInput, setTestUrlInput] = useState<string>('');
  const [testResult, setTestResult] = useState<StreamTestResult | null>(null);
  const [isTestingStream, setIsTestingStream] = useState<boolean>(false);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  // Check login status on mount
  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập không thành công');
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setToken(data.token);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Lỗi đăng nhập');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  };

  const fetchAdminData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [statsRes, playlistsRes, channelsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders() }),
        fetch('/api/admin/playlists', { headers: authHeaders() }),
        fetch('/api/admin/channels', { headers: authHeaders() }),
      ]);

      if (statsRes.status === 401 || playlistsRes.status === 401) {
        handleLogout();
        return;
      }

      if (statsRes.ok) setStats(await statsRes.json());
      if (playlistsRes.ok) setPlaylists(await playlistsRes.json());
      if (channelsRes.ok) setChannels(await channelsRes.json());
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PLAYLIST ACTIONS
  // ---------------------------------------------------------------------------

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistForm.name.trim()) {
      showNotification('Vui lòng nhập tên playlist', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/playlists', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(playlistForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo playlist thất bại');

      showNotification(`Đã tạo playlist "${data.name}" và đồng bộ ${data.channel_count} kênh!`);
      setIsAddPlaylistOpen(false);
      setPlaylistForm({ name: '', type: 'url', url: '', content: '', enabled: true });
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleTogglePlaylist = async (playlist: Playlist) => {
    try {
      const res = await fetch(`/api/admin/playlists/${playlist.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !playlist.enabled }),
      });
      if (!res.ok) throw new Error('Không thể thay đổi trạng thái');
      showNotification(`Đã ${!playlist.enabled ? 'bật' : 'tắt'} playlist "${playlist.name}"`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleRefreshPlaylist = async (id: string, name: string) => {
    showNotification(`Đang làm mới playlist "${name}"...`);
    try {
      const res = await fetch(`/api/admin/playlists/${id}/refresh`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật playlist thất bại');
      showNotification(`Playlist "${name}" cập nhật thành công (${data.count} kênh)!`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleRefreshAll = async () => {
    showNotification('Đang làm mới tất cả playlist...');
    try {
      const res = await fetch('/api/admin/playlists/refresh-all', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi làm mới');
      showNotification(data.message);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa playlist "${name}" và toàn bộ kênh của nó?`)) return;
    try {
      const res = await fetch(`/api/admin/playlists/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Xóa playlist thất bại');
      showNotification(`Đã xóa playlist "${name}"`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPlaylistForm((prev) => ({
        ...prev,
        type: 'content',
        content,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ''),
      }));
    };
    reader.readAsText(file);
  };

  // ---------------------------------------------------------------------------
  // CHANNEL ACTIONS
  // ---------------------------------------------------------------------------

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.name || !channelForm.stream_url) {
      showNotification('Tên kênh và URL stream là bắt buộc', 'error');
      return;
    }

    try {
      if (editingChannelId) {
        // Update
        const res = await fetch(`/api/admin/channels/${editingChannelId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(channelForm),
        });
        if (!res.ok) throw new Error('Cập nhật kênh thất bại');
        showNotification(`Đã lưu thay đổi cho kênh "${channelForm.name}"`);
      } else {
        // Create
        const res = await fetch('/api/admin/channels', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(channelForm),
        });
        if (!res.ok) throw new Error('Thêm kênh mới thất bại');
        showNotification(`Đã thêm kênh mới "${channelForm.name}"`);
      }

      setIsChannelModalOpen(false);
      setEditingChannelId(null);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteChannel = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa kênh "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/channels/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Xóa kênh thất bại');
      showNotification(`Đã xóa kênh "${name}"`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleTestChannelStream = async (url: string, channelId?: string) => {
    if (channelId) setTestingChannelId(channelId);
    else setIsTestingStream(true);

    try {
      const res = await fetch('/api/admin/test-stream', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url }),
      });
      const data: StreamTestResult = await res.json();
      setTestResult(data);
      if (channelId) {
        showNotification(`${data.status === 'online' ? '✅' : '⚠️'} ${data.message}`);
        const nextStatus = data.status === 'offline' ? 'offline' : 'active';
        fetch(`/api/admin/channels/${channelId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ status: nextStatus }),
        }).catch(() => {});
        setChannels((prev) =>
          prev.map((c) => (c.id === channelId ? { ...c, status: nextStatus } : c))
        );
      }
    } catch (err: any) {
      showNotification('Không thể kiểm tra luồng phát', 'error');
    } finally {
      setTestingChannelId(null);
      setIsTestingStream(false);
    }
  };

  // Toggle single channel status between active and offline
  const handleToggleChannelStatus = async (ch: Channel) => {
    const nextStatus = ch.status === 'offline' ? 'active' : 'offline';
    try {
      const res = await fetch(`/api/admin/channels/${ch.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Không thể cập nhật trạng thái');
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, status: nextStatus } : c))
      );
      showNotification(`Đã chuyển kênh "${ch.name}" sang ${nextStatus === 'active' ? 'HOẠT ĐỘNG' : 'OFFLINE / LỖI'}`);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Reset all channels or playlist channels back to active
  const handleResetAllStatus = async (playlistId?: string) => {
    const targetName = playlistId && playlistId !== 'all'
      ? playlists.find((p) => p.id === playlistId)?.name || 'Playlist này'
      : 'toàn bộ kênh hệ thống';
    if (!confirm(`Bạn có chắc muốn khôi phục trạng thái HOẠT ĐỘNG (Active) cho ${targetName}?`)) return;

    try {
      const res = await fetch('/api/admin/channels/reset-status', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ playlist_id: playlistId, status: 'active' }),
      });
      const data = await res.json();
      showNotification(data.message || 'Đã khôi phục trạng thái thành công');
      fetchAdminData();
    } catch (err: any) {
      showNotification('Khôi phục thất bại: ' + err.message, 'error');
    }
  };

  // Automated Channel Health Scanner
  const handleStartScan = async () => {
    let targetList = [...channels];
    if (scannerScope === 'playlist' && scannerPlaylistId !== 'all') {
      targetList = targetList.filter((c) => c.playlist_id === scannerPlaylistId);
    } else if (scannerScope === 'group' && scannerGroup !== 'all') {
      targetList = targetList.filter((c) => c.group.toLowerCase() === scannerGroup.toLowerCase());
    }

    if (scannerLimit > 0) {
      targetList = targetList.slice(0, scannerLimit);
    }

    if (targetList.length === 0) {
      showNotification('Không tìm thấy kênh nào trong phạm vi quét đã chọn', 'error');
      return;
    }

    scanAbortRef.current = false;
    scanPausedRef.current = false;
    setIsScanning(true);
    setIsPaused(false);
    setScanResults([]);
    setScanProgress({
      total: targetList.length,
      scanned: 0,
      online: 0,
      warning: 0,
      offline: 0,
    });

    const batchSize = 10;
    let scanned = 0;
    let online = 0;
    let warning = 0;
    let offline = 0;

    for (let i = 0; i < targetList.length; i += batchSize) {
      if (scanAbortRef.current) break;

      while (scanPausedRef.current && !scanAbortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (scanAbortRef.current) break;

      const chunk = targetList.slice(i, i + batchSize);
      setScanProgress((prev) => ({
        ...prev,
        currentChannelName: chunk[0]?.name,
      }));

      try {
        const res = await fetch('/api/admin/channels/scan-batch', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            channelIds: chunk.map((c) => c.id),
            updateStatus: scannerAutoMark,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const results: ChannelScanResult[] = data.results || [];
          scanned += chunk.length;
          const bOnline = results.filter((r) => r.status === 'online').length;
          const bWarning = results.filter((r) => r.status === 'warning').length;
          const bOffline = results.filter((r) => r.status === 'offline').length;
          online += bOnline;
          warning += bWarning;
          offline += bOffline;

          setScanProgress({
            total: targetList.length,
            scanned,
            online,
            warning,
            offline,
            currentChannelName: chunk[chunk.length - 1]?.name,
          });

          setScanResults((prev) => [...results, ...prev]);

          if (scannerAutoMark) {
            const statusMap = new Map(results.map((r) => [r.id, r.status]));
            setChannels((prev) =>
              prev.map((ch) => {
                const s = statusMap.get(ch.id);
                if (s) {
                  return { ...ch, status: s === 'offline' ? 'offline' : 'active' };
                }
                return ch;
              })
            );
          }
        }
      } catch (err) {
        console.error('Scan batch error:', err);
      }
    }

    setIsScanning(false);
    setIsPaused(false);
    showNotification(
      `Đã quét xong: ${scanned} kênh. Phát hiện ${offline} kênh lỗi (${scannerAutoMark ? 'đã tự động đánh dấu OFFLINE' : 'chưa đánh dấu'}).`,
      offline > 0 ? 'error' : 'success'
    );
    fetchAdminData();
  };

  const handlePauseScan = () => {
    scanPausedRef.current = !scanPausedRef.current;
    setIsPaused(scanPausedRef.current);
  };

  const handleStopScan = () => {
    scanAbortRef.current = true;
    scanPausedRef.current = false;
    setIsScanning(false);
    setIsPaused(false);
    showNotification('Đã dừng tiến trình quét kênh');
  };

  const handleExportScanReport = () => {
    const offlineList = scanResults.filter((r) => r.status === 'offline');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalScanned: scanProgress.scanned,
        online: scanProgress.online,
        warning: scanProgress.warning,
        offline: scanProgress.offline,
      },
      offlineChannels: offlineList,
      allResults: scanResults,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iptv_health_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter channels with useMemo for high performance with 10,000+ items
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (filterPlaylist !== 'all' && c.playlist_id !== filterPlaylist) return false;
      if (filterGroup !== 'all' && c.group.toLowerCase() !== filterGroup.toLowerCase()) return false;
      if (filterStatus !== 'all' && (c.status || 'active') !== filterStatus) return false;
      if (channelSearch.trim()) {
        const q = channelSearch.toLowerCase().trim();
        return (
          c.name.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q) ||
          (c.tvg_id && c.tvg_id.toLowerCase().includes(q)) ||
          c.stream_url.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [channels, filterPlaylist, filterGroup, filterStatus, channelSearch]);

  // Pagination calculations
  const totalChannelsCount = filteredChannels.length;
  const totalPages = Math.max(1, Math.ceil(totalChannelsCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedChannels = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredChannels.slice(start, start + pageSize);
  }, [filteredChannels, safeCurrentPage, pageSize]);

  const startChannelIndex = totalChannelsCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endChannelIndex = Math.min(safeCurrentPage * pageSize, totalChannelsCount);

  // Smooth scroll table to top on page change
  const handlePageChange = (newPage: number) => {
    const target = Math.min(Math.max(1, newPage), totalPages);
    setCurrentPage(target);
    if (tableScrollContainerRef.current) {
      tableScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      handlePageChange(p);
      setJumpPageInput('');
    }
  };

  // Helper to generate a sliding window of page numbers around current page
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(safeCurrentPage - 1);
        pages.push(safeCurrentPage);
        pages.push(safeCurrentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // ---------------------------------------------------------------------------
  // RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  // ---------------------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBackToApp}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Về trang chủ IPTV</span>
            </button>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">Đăng Nhập Quản Trị IPTV</h2>
          <p className="text-xs text-neutral-400 mt-1 mb-6">
            Quản lý playlist M3U, danh mục kênh, và kiểm tra luồng phát trực tiếp.
          </p>

          {loginError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                Tên đăng nhập (ADMIN_USERNAME)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                Mật khẩu (ADMIN_PASSWORD)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10 mt-2"
            >
              {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Đăng nhập trang quản trị</span>
            </button>
          </form>

          <div className="mt-6 p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl text-[11px] text-neutral-400 leading-relaxed">
            <strong className="text-amber-400">Gợi ý bảo mật:</strong> Mặc định cấu hình <code className="text-neutral-200">admin</code> / <code className="text-neutral-200">admin123</code>. Trên Render, bạn có thể thay đổi bằng biến môi trường <code className="text-neutral-200">ADMIN_USERNAME</code> và <code className="text-neutral-200">ADMIN_PASSWORD</code>.
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN ADMIN DASHBOARD
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black shadow-md">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-white">Quản Trị MY IPTV</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Hệ thống quản lý Playlist &amp; Luồng phát</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAll}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Đồng bộ lại toàn bộ playlist đang bật"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Refresh All Playlists</span>
            </button>

            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Tv className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Xem IPTV</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Toast */}
      {actionMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5 duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-neutral-900 border-emerald-500/50 text-emerald-300'
              : 'bg-neutral-900 border-rose-500/50 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Playlists</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{stats?.totalPlaylists ?? playlists.length}</span>
              <span className="text-xs text-emerald-400 font-medium">({stats?.activePlaylists ?? 0} bật)</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Tổng số kênh</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{stats?.totalChannels ?? channels.length}</span>
              <span className="text-xs text-neutral-400">kênh</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Danh mục</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{stats?.groups.length ?? 0}</span>
              <span className="text-xs text-neutral-400">nhóm</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Lưu trữ</span>
            <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-amber-400">
              <Database className="w-3.5 h-3.5" />
              <span>PostgreSQL / Persistent</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'playlists'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Quản Lý Playlist ({playlists.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'channels'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Quản Lý Kênh ({channels.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'tester'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Kiểm Tra Luồng (Probe)</span>
          </button>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: PLAYLISTS MANAGEMENT */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'playlists' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Danh sách Playlist IPTV</h3>
                <p className="text-xs text-neutral-400">
                  Hỗ trợ thêm URL online, dán trực tiếp, hoặc tải lên file .m3u
                </p>
              </div>

              <button
                onClick={() => setIsAddPlaylistOpen(true)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Playlist M3U</span>
              </button>
            </div>

            {/* Playlists Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Tên Playlist</th>
                      <th className="py-3 px-4">Loại &amp; Nguồn</th>
                      <th className="py-3 px-4">Số Kênh</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4">Cập Nhật</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {playlists.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                          Chưa có playlist nào. Hãy bấm "Thêm Playlist M3U" để bắt đầu.
                        </td>
                      </tr>
                    ) : (
                      playlists.map((pl) => (
                        <tr key={pl.id} className="hover:bg-neutral-850/50 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{pl.name}</span>
                              {pl.status === 'error' && (
                                <span
                                  className="text-rose-400 hover:text-rose-300"
                                  title={pl.error_message || 'Lỗi cập nhật playlist'}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                            {pl.error_message && (
                              <p className="text-[10px] text-rose-400 mt-0.5 line-clamp-1">{pl.error_message}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-300">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                              {pl.type === 'url' ? 'URL M3U' : 'Raw Content'}
                            </span>
                            {pl.url && (
                              <p className="text-[10px] text-neutral-400 mt-1 truncate max-w-xs">{pl.url}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-neutral-200">
                            {pl.channel_count} kênh
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleTogglePlaylist(pl)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                                pl.enabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              }`}
                            >
                              {pl.enabled ? 'ON' : 'OFF'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-400 text-[11px]">
                            {new Date(pl.last_updated).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRefreshPlaylist(pl.id, pl.name)}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                                title="Đồng bộ lại"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeletePlaylist(pl.id, pl.name)}
                                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                                title="Xóa playlist"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: CHANNELS MANAGEMENT */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Danh sách Kênh Truyền Hình</h3>
                <p className="text-xs text-neutral-400">
                  Xem, tìm kiếm, chỉnh sửa codec, thông số, và kiểm tra URL stream
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-rose-950/20 cursor-pointer"
                  title="Mở bộ quét tự động kiểm tra tình trạng luồng kênh IPTV"
                >
                  <Activity className="w-4 h-4 text-neutral-950 animate-pulse" />
                  <span>Quét Kênh &amp; Đánh Dấu Lỗi</span>
                  {channels.filter((c) => c.status === 'offline').length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-neutral-950 text-rose-400 text-[10px] font-mono font-bold">
                      {channels.filter((c) => c.status === 'offline').length} lỗi
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setEditingChannelId(null);
                    setChannelForm({
                      name: '',
                      group: 'VTV',
                      logo: '',
                      stream_url: '',
                      format: 'hls',
                      status: 'active',
                    });
                    setIsChannelModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Kênh Thủ Công</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Tìm kiếm kênh theo tên, nhóm, tvg-id, URL..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={filterPlaylist}
                onChange={(e) => setFilterPlaylist(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
              >
                <option value="all">Tất cả Playlist ({playlists.length})</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
              >
                <option value="all">Tất cả Nhóm/Thể loại</option>
                {stats?.groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className={`rounded-xl px-3 py-2 text-xs focus:outline-none cursor-pointer border ${
                  filterStatus === 'offline'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 font-semibold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                <option value="all">Tất cả trạng thái ({channels.length})</option>
                <option value="active">Chỉ kênh Hoạt động ({channels.filter((c) => (c.status || 'active') === 'active').length})</option>
                <option value="offline">Chỉ kênh Bị Lỗi / Offline ({channels.filter((c) => c.status === 'offline').length})</option>
                <option value="check">Kênh cần kiểm tra ({channels.filter((c) => c.status === 'check').length})</option>
              </select>

              {channels.some((c) => c.status === 'offline') && (
                <button
                  type="button"
                  onClick={() => handleResetAllStatus(filterPlaylist)}
                  className="px-2.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                  title="Khôi phục trạng thái tất cả kênh thành Active"
                >
                  <RefreshCw className="w-3 h-3 text-amber-400" />
                  <span>Khôi phục Active</span>
                </button>
              )}
            </div>

            {/* Pagination & Filter Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1 py-1 text-xs">
              <div className="text-neutral-400">
                Hiển thị kênh <span className="font-bold text-amber-400">{startChannelIndex.toLocaleString()}</span> -{' '}
                <span className="font-bold text-amber-400">{endChannelIndex.toLocaleString()}</span> trong{' '}
                <span className="font-bold text-white">{totalChannelsCount.toLocaleString()}</span> kênh{' '}
                {channelSearch && <span className="text-neutral-500 font-normal">(kết quả lọc)</span>}
                <span className="text-neutral-500 ml-2">
                  • Trang <span className="text-amber-400 font-bold">{safeCurrentPage}</span> / {totalPages}
                </span>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <span className="text-[11px]">Kênh/trang:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>

                {/* Quick Prev/Next Mini Nav */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => handlePageChange(safeCurrentPage - 1)}
                    className="p-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono text-neutral-400 px-1">
                    {safeCurrentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => handlePageChange(safeCurrentPage + 1)}
                    className="p-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Channels Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow">
              <div ref={tableScrollContainerRef} className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Kênh</th>
                      <th className="py-3 px-4">Nhóm</th>
                      <th className="py-3 px-4">Định Dạng</th>
                      <th className="py-3 px-4">URL Luồng Phát</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {paginatedChannels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                          Không tìm thấy kênh nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      paginatedChannels.map((ch) => (
                        <tr key={ch.id} className="hover:bg-neutral-850/50 transition">
                          <td className="py-3 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2.5">
                              {ch.logo ? (
                                <img
                                  src={ch.logo}
                                  alt={ch.name}
                                  className="w-7 h-7 object-contain bg-neutral-950 rounded p-0.5 border border-neutral-800 flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-neutral-800 flex items-center justify-center text-[10px] text-amber-400 font-bold flex-shrink-0">
                                  TV
                                </div>
                              )}
                              <div className="truncate max-w-xs">
                                <div>{ch.name}</div>
                                {ch.tvg_id && (
                                  <span className="text-[10px] text-neutral-500 font-mono">id: {ch.tvg_id}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {ch.group}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] uppercase text-neutral-300">
                            {ch.format}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">
                            <div className="truncate max-w-xs" title={ch.stream_url}>
                              {ch.stream_url}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleChannelStatus(ch)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                                ch.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                  : ch.status === 'offline'
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 shadow-sm shadow-rose-950/40'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                              }`}
                              title="Nhấn để đổi nhanh trạng thái kênh (Active <-> Offline)"
                            >
                              {ch.status === 'active' ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>ACTIVE</span>
                                </>
                              ) : ch.status === 'offline' ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>LỖI / OFFLINE</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  <span>CHECK</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Play Preview in Modal */}
                              <button
                                onClick={() => setPreviewChannel(ch)}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                                title="Xem phát thử kênh này (Play Stream)"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>

                              {/* Ping / Stream Test */}
                              <button
                                onClick={() => handleTestChannelStream(ch.stream_url, ch.id)}
                                disabled={testingChannelId === ch.id}
                                className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded transition"
                                title="Kiểm tra ping phản hồi luồng (Test Ping)"
                              >
                                {testingChannelId === ch.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                  <Activity className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => {
                                  setEditingChannelId(ch.id);
                                  setChannelForm(ch);
                                  setIsChannelModalOpen(true);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                                title="Chỉnh sửa thông tin kênh"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteChannel(ch.id, ch.name)}
                                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                                title="Xóa kênh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Bar */}
              {totalPages > 1 && (
                <div className="px-4 py-3 bg-neutral-950 border-t border-neutral-800/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-neutral-400 text-[11px]">
                    Hiển thị <span className="font-bold text-white">{startChannelIndex.toLocaleString()} - {endChannelIndex.toLocaleString()}</span> trên{' '}
                    <span className="font-bold text-white">{totalChannelsCount.toLocaleString()}</span> kênh
                  </div>

                  {/* Page Controls */}
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    {/* First Page */}
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => handlePageChange(1)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Trang đầu tiên"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Prev Page */}
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Page Numbers */}
                    {getPageNumbers().map((p, idx) => {
                      if (p === '...') {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-2 text-neutral-600 font-mono select-none">
                            ...
                          </span>
                        );
                      }
                      const pageNum = Number(p);
                      const isCurrent = pageNum === safeCurrentPage;
                      return (
                        <button
                          key={`page-${pageNum}`}
                          type="button"
                          onClick={() => handlePageChange(pageNum)}
                          className={`min-w-[32px] h-8 px-2 rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-bold'
                              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {/* Next Page */}
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Trang sau"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Last Page */}
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => handlePageChange(totalPages)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Trang cuối cùng"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Fast Jump Input */}
                  <form onSubmit={handleJumpToPage} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <span>Đến trang:</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpPageInput}
                      onChange={(e) => setJumpPageInput(e.target.value)}
                      placeholder={String(safeCurrentPage)}
                      className="w-14 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-center font-mono text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={!jumpPageInput}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 rounded-lg font-medium text-xs border border-neutral-700 transition cursor-pointer"
                    >
                      Đi
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: STREAM PROBE & DIAGNOSTICS */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'tester' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Kiểm Tra Luồng Phát (Stream Probe)</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Kiểm tra HTTP Status, Content-Type, SSL, và độ trễ phản hồi mà không tải toàn bộ video về server.
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <label className="text-xs font-semibold text-neutral-300 block">URL Stream cần kiểm tra:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testUrlInput}
                  onChange={(e) => setTestUrlInput(e.target.value)}
                  placeholder="https://example.com/live/channel.m3u8"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={isTestingStream || !testUrlInput.trim()}
                  onClick={() => handleTestChannelStream(testUrlInput)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition flex-shrink-0"
                >
                  {isTestingStream ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  <span>Kiểm tra</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">KẾT QUẢ ĐO KIỂM:</span>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      testResult.status === 'online'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : testResult.status === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {testResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                  <div>
                    Mã phản hồi: <strong className="text-white">{testResult.http_status || 'N/A'}</strong>
                  </div>
                  <div>
                    Độ trễ: <strong className="text-white">{testResult.response_time_ms} ms</strong>
                  </div>
                  <div>
                    Content-Type: <strong className="text-white truncate block">{testResult.content_type || 'N/A'}</strong>
                  </div>
                  <div>
                    Bảo mật SSL: <strong className={testResult.is_https ? 'text-emerald-400' : 'text-amber-400'}>{testResult.is_https ? 'HTTPS (Có)' : 'HTTP'}</strong>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 p-2.5 rounded border border-neutral-800/80">
                  {testResult.message}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD PLAYLIST */}
      {/* --------------------------------------------------------------------- */}
      {isAddPlaylistOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white">Thêm Playlist IPTV Mới</h3>
              <button
                onClick={() => setIsAddPlaylistOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">Tên Playlist:</label>
                <input
                  type="text"
                  required
                  value={playlistForm.name}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                  placeholder="Ví dụ: VTV & Kênh Việt Nam"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">Nguồn Playlist:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPlaylistForm({ ...playlistForm, type: 'url' })}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      playlistForm.type === 'url'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>URL Trực Tuyến</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlaylistForm({ ...playlistForm, type: 'content' })}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      playlistForm.type === 'content'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Dán / File M3U</span>
                  </button>
                </div>
              </div>

              {playlistForm.type === 'url' ? (
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Đường dẫn URL Playlist (.m3u / .m3u8):
                  </label>
                  <input
                    type="url"
                    required
                    value={playlistForm.url}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, url: e.target.value })}
                    placeholder="https://example.com/playlist.m3u"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-300">Nội dung M3U hoặc Tải file:</label>
                    <label className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Chọn file .m3u</span>
                      <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={playlistForm.content}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, content: e.target.value })}
                    placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-id=&quot;VTV1&quot; group-title=&quot;VTV&quot;,VTV1&#10;https://..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={playlistForm.enabled}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, enabled: e.target.checked })}
                  className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-0"
                />
                <label htmlFor="enabledCheck" className="text-xs text-neutral-300">
                  Bật playlist này ngay sau khi thêm
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddPlaylistOpen(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs"
                >
                  Tạo &amp; Đồng Bộ Kênh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: EDIT / CREATE CHANNEL */}
      {/* --------------------------------------------------------------------- */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingChannelId ? 'Chỉnh Sửa Thông Tin Kênh' : 'Thêm Kênh Mới Thủ Công'}
              </h3>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Tên kênh:</label>
                  <input
                    type="text"
                    required
                    value={channelForm.name || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Nhóm / Thể loại:</label>
                  <input
                    type="text"
                    required
                    value={channelForm.group || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, group: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Định dạng:</label>
                  <select
                    value={channelForm.format || 'hls'}
                    onChange={(e) => setChannelForm({ ...channelForm, format: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="hls">HLS (M3U8)</option>
                    <option value="mp4">MP4</option>
                    <option value="http">HTTP Direct</option>
                    <option value="unknown">Khác</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">URL Luồng Phát:</label>
                  <input
                    type="url"
                    required
                    value={channelForm.stream_url || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, stream_url: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">tvg-id:</label>
                  <input
                    type="text"
                    value={channelForm.tvg_id || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, tvg_id: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">tvg-name:</label>
                  <input
                    type="text"
                    value={channelForm.tvg_name || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, tvg_name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">URL Logo kênh:</label>
                  <input
                    type="url"
                    value={channelForm.logo || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, logo: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Trạng thái:</label>
                  <select
                    value={channelForm.status || 'active'}
                    onChange={(e) => setChannelForm({ ...channelForm, status: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="active">Active (Hoạt động)</option>
                    <option value="offline">Offline (Tắt)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Độ phân giải:</label>
                  <input
                    type="text"
                    value={channelForm.resolution || 'HD'}
                    onChange={(e) => setChannelForm({ ...channelForm, resolution: e.target.value })}
                    placeholder="1080p / 720p"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs"
                >
                  Lưu Thông Tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Stream Preview Modal */}
      {previewChannel && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Xem thử luồng: {previewChannel.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewChannel(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <VideoPlayer channel={previewChannel} />
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: AUTOMATED CHANNEL HEALTH SCANNER & ERROR MARKER */}
      {/* --------------------------------------------------------------------- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-rose-950/30">
                  <Activity className={`w-5 h-5 ${isScanning ? 'animate-pulse text-white' : 'text-neutral-950'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Quét Kênh Tự Động &amp; Đánh Dấu Lỗi</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      IPTV Health Auditor
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Kiểm tra trực tiếp phản hồi luồng phát và tự động gắn cờ các kênh bị chết, timeout, hoặc chặn kết nối.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isScanning) {
                    if (confirm('Tiến trình quét đang chạy. Bạn có muốn dừng và đóng cửa sổ?')) {
                      handleStopScan();
                      setIsScannerOpen(false);
                    }
                  } else {
                    setIsScannerOpen(false);
                  }
                }}
                className="text-neutral-400 hover:text-white p-1.5 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Configuration Controls Card */}
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                  <h4 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    Thiết lập phạm vi quét kênh
                  </h4>
                  {isScanning && (
                    <span className="text-[11px] font-bold text-amber-400 animate-pulse flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      Đang thực hiện kiểm tra luồng phát...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Scope Selection */}
                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Phạm vi quét:
                    </label>
                    <select
                      disabled={isScanning}
                      value={scannerScope}
                      onChange={(e) => setScannerScope(e.target.value as any)}
                      className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value="all">Toàn bộ kênh hệ thống ({channels.length.toLocaleString()} kênh)</option>
                      <option value="playlist">Theo từng Playlist M3U</option>
                      <option value="group">Theo từng Thể loại / Nhóm kênh</option>
                    </select>
                  </div>

                  {/* Playlist Specific Dropdown */}
                  {scannerScope === 'playlist' && (
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                        Chọn Playlist cần quét:
                      </label>
                      <select
                        disabled={isScanning}
                        value={scannerPlaylistId}
                        onChange={(e) => setScannerPlaylistId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
                      >
                        <option value="all">Tất cả playlist ({playlists.length})</option>
                        {playlists.map((p) => {
                          const pChannels = channels.filter((c) => c.playlist_id === p.id).length;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} ({pChannels.toLocaleString()} kênh)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Group Specific Dropdown */}
                  {scannerScope === 'group' && (
                    <div>
                      <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                        Chọn Thể loại / Nhóm:
                      </label>
                      <select
                        disabled={isScanning}
                        value={scannerGroup}
                        onChange={(e) => setScannerGroup(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
                      >
                        <option value="all">Tất cả nhóm</option>
                        {stats?.groups.map((g) => {
                          const gChannels = channels.filter((c) => c.group.toLowerCase() === g.toLowerCase()).length;
                          return (
                            <option key={g} value={g}>
                              {g} ({gChannels.toLocaleString()} kênh)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Limit Option */}
                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Giới hạn số lượng kênh:
                    </label>
                    <select
                      disabled={isScanning}
                      value={scannerLimit}
                      onChange={(e) => setScannerLimit(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value={0}>Quét toàn bộ trong phạm vi</option>
                      <option value={25}>25 kênh đầu (thử nhanh)</option>
                      <option value={50}>50 kênh đầu</option>
                      <option value={100}>100 kênh đầu</option>
                      <option value={250}>250 kênh đầu</option>
                      <option value={500}>500 kênh đầu</option>
                    </select>
                  </div>
                </div>

                {/* Auto-mark checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scannerAutoMark}
                      disabled={isScanning}
                      onChange={(e) => setScannerAutoMark(e.target.checked)}
                      className="rounded border-neutral-700 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span>
                      Tự động lưu và đánh dấu kênh bị lỗi thành <strong className="text-rose-400">OFFLINE</strong> trong cơ sở dữ liệu (kênh hoạt động sẽ được cập nhật thành <strong className="text-emerald-400">ACTIVE</strong>).
                    </span>
                  </label>
                </div>
              </div>

              {/* Progress and Live Metrics Card */}
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-semibold text-neutral-200 flex items-center gap-2">
                    <span>Tiến độ kiểm tra</span>
                    {scanProgress.total > 0 && (
                      <span className="font-mono text-amber-400">
                        {scanProgress.scanned} / {scanProgress.total} kênh ({Math.round((scanProgress.scanned / scanProgress.total) * 100) || 0}%)
                      </span>
                    )}
                  </div>
                  {scanProgress.currentChannelName && (
                    <div className="text-neutral-400 truncate max-w-xs text-[11px]">
                      Đang xử lý: <span className="text-white font-medium">{scanProgress.currentChannelName}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isScanning
                        ? 'bg-gradient-to-r from-amber-500 via-emerald-500 to-rose-500 animate-pulse'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${scanProgress.total > 0 ? Math.min(100, Math.round((scanProgress.scanned / scanProgress.total) * 100)) : 0}%`,
                    }}
                  />
                </div>

                {/* Live Stat Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">Đã kiểm tra</div>
                    <div className="text-lg font-black text-white font-mono mt-0.5">
                      {scanProgress.scanned}
                      <span className="text-xs text-neutral-500 font-normal ml-1">/ {scanProgress.total}</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/90 border border-emerald-900/40 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Hoạt động (Online)</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                      {scanProgress.online}
                    </div>
                  </div>

                  <div className="bg-neutral-900/90 border border-amber-900/40 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Cảnh báo / Chậm</div>
                    <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
                      {scanProgress.warning}
                    </div>
                  </div>

                  <div className="bg-neutral-900/90 border border-rose-900/40 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold">BỊ LỖI (Offline)</div>
                    <div className="text-lg font-black text-rose-400 font-mono mt-0.5">
                      {scanProgress.offline}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  {!isScanning ? (
                    <button
                      type="button"
                      onClick={handleStartScan}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-rose-950/20 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-neutral-950" />
                      <span>{scanResults.length > 0 ? 'Bắt đầu quét lại' : 'Bắt đầu quét ngay'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handlePauseScan}
                        className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                        <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStopScan}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
                      >
                        <X className="w-4 h-4" />
                        <span>Dừng quét</span>
                      </button>
                    </>
                  )}

                  {/* Reset all button */}
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => handleResetAllStatus(scannerScope === 'playlist' ? scannerPlaylistId : undefined)}
                    className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                    title="Khôi phục tất cả kênh về trạng thái Active"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Khôi phục tất cả Active</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {scanResults.length > 0 && (
                    <>
                      {/* Filter in table button */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterStatus('offline');
                          setCurrentPage(1);
                          setIsScannerOpen(false);
                        }}
                        className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Xem {scanProgress.offline} kênh lỗi trong bảng</span>
                      </button>

                      {/* Export report */}
                      <button
                        type="button"
                        onClick={handleExportScanReport}
                        className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Tải về file báo cáo JSON"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Xuất báo cáo</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Scanned Channels Feed / Table */}
              {scanResults.length > 0 && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden space-y-2">
                  <div className="p-3 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between gap-2">
                    <h5 className="font-semibold text-neutral-300 text-xs flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      Kết quả kiểm tra chi tiết ({scanResults.length})
                    </h5>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setScanResultFilter('all')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                          scanResultFilter === 'all'
                            ? 'bg-amber-500 text-neutral-950'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Tất cả ({scanResults.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanResultFilter('offline')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                          scanResultFilter === 'offline'
                            ? 'bg-rose-500 text-white'
                            : 'text-rose-400 hover:text-rose-300'
                        }`}
                      >
                        Chỉ kênh lỗi ({scanResults.filter((r) => r.status === 'offline').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanResultFilter('online')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                          scanResultFilter === 'online'
                            ? 'bg-emerald-500 text-neutral-950'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        Kênh hoạt động ({scanResults.filter((r) => r.status !== 'offline').length})
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-neutral-850/60 text-[11px]">
                    {scanResults
                      .filter((r) => {
                        if (scanResultFilter === 'offline') return r.status === 'offline';
                        if (scanResultFilter === 'online') return r.status !== 'offline';
                        return true;
                      })
                      .map((item) => (
                        <div
                          key={item.id}
                          className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-neutral-900/50 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                item.status === 'online'
                                  ? 'bg-emerald-400'
                                  : item.status === 'warning'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-500 animate-pulse'
                              }`}
                            />
                            <div className="truncate">
                              <span className="font-semibold text-neutral-200">{item.name}</span>
                              <span className="text-neutral-500 ml-1.5 text-[10px]">({item.group})</span>
                              <div className="text-[10px] text-neutral-400 font-mono truncate">{item.message}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                item.status === 'online'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : item.status === 'warning'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {item.status === 'online' ? 'ONLINE' : item.status === 'warning' ? 'CHẬM' : 'LỖI'}
                            </span>

                            {item.response_time_ms > 0 && (
                              <span className="text-[10px] font-mono text-neutral-400">
                                {item.response_time_ms}ms
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs">
              <span className="text-neutral-500 text-[11px]">
                Mẹo IPTV: Quét theo từng playlist nhỏ trước để xác định nhanh các liên kết bị gián đoạn.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isScanning) {
                    handleStopScan();
                  }
                  setIsScannerOpen(false);
                }}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-medium text-xs cursor-pointer transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
