import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ChannelTrafficStats } from '../types/iptv';
import { TrendingUp, Activity, RefreshCw, Eye, Sparkles } from 'lucide-react';

interface ChannelTrafficChartProps {
  className?: string;
}

export const ChannelTrafficChart: React.FC<ChannelTrafficChartProps> = ({ className = '' }) => {
  const [stats, setStats] = useState<ChannelTrafficStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeMetric, setActiveMetric] = useState<'views' | 'channels'>('views');

  const fetchStats = async (isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data: ChannelTrafficStats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Failed to load traffic stats:', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats every 60 seconds
    const interval = setInterval(() => fetchStats(false), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm ${className}`}
    >
      {/* Header with Title & Quick Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <span>Xu hướng truy cập</span>
              <span className="text-[10px] font-normal text-neutral-400 font-mono">(7 ngày qua)</span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              Dữ liệu lưu lượng &amp; số kênh theo dõi trực tiếp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Metric Switch */}
          <div className="bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 flex items-center text-[10px]">
            <button
              type="button"
              onClick={() => setActiveMetric('views')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                activeMetric === 'views'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Lượt xem
            </button>
            <button
              type="button"
              onClick={() => setActiveMetric('channels')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                activeMetric === 'channels'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Kênh bật
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchStats(true)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
            title="Làm mới thống kê"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 py-1 px-2.5 bg-neutral-950/60 border border-neutral-800/60 rounded-lg text-xs">
          <div>
            <span className="text-[10px] text-neutral-400 block">Tổng 7 ngày</span>
            <span className="font-bold text-white font-mono text-xs">
              {stats.total7dViews.toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-neutral-400 block">Hôm nay</span>
            <span className="font-bold text-amber-400 font-mono text-xs flex items-center gap-1">
              <Eye className="w-3 h-3 inline text-amber-500" />
              {stats.todayViews.toLocaleString()}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-neutral-400 block">Tăng trưởng</span>
            <span className="font-semibold text-emerald-400 font-mono text-xs flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              +{stats.growthPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Recharts Chart Area */}
      <div className="h-[155px] w-full pt-1">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            <span>Đang tải biểu đồ xu hướng...</span>
          </div>
        ) : stats && stats.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={stats.daily}
              margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="trafficViewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="trafficChannelsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: '#333' }}
                tick={{ fill: '#888', fontSize: 10 }}
                dy={4}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#666', fontSize: 9 }}
                tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))}
                domain={['auto', 'auto']}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-neutral-900/95 border border-neutral-700/80 rounded-xl p-2.5 shadow-2xl backdrop-blur text-xs min-w-[130px]">
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-1 mb-1.5">
                          <span className="font-semibold text-white">{data.dayName}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{data.date}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-400 font-medium">
                          <span className="text-neutral-400 text-[11px]">Lượt xem:</span>
                          <span className="font-mono font-bold">{data.views.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-blue-400 mt-0.5">
                          <span className="text-neutral-400 text-[11px]">Kênh phát:</span>
                          <span className="font-mono">{data.channels.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {activeMetric === 'views' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#f59e0b"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#trafficViewsGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="#f59e0b"
                    strokeWidth={2.2}
                    dot={{ r: 2.5, fill: '#f59e0b', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="channels"
                    stroke="#3b82f6"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#trafficChannelsGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="channels"
                    stroke="#3b82f6"
                    strokeWidth={2.2}
                    dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-neutral-500">
            Chưa có dữ liệu thống kê lưu lượng.
          </div>
        )}
      </div>

      {/* Top Trending Channels Footer Pills */}
      {stats && stats.topChannels && stats.topChannels.length > 0 && (
        <div className="pt-1 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Top kênh:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[70%]">
            {stats.topChannels.slice(0, 3).map((ch, idx) => (
              <span
                key={ch.id}
                className="bg-neutral-950 px-1.5 py-0.5 rounded text-[10px] text-neutral-300 font-mono truncate max-w-[90px]"
                title={`${ch.name} (${ch.views.toLocaleString()} lượt xem)`}
              >
                #{idx + 1} {ch.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
