import React from 'react';
import { Channel } from '../types/iptv';
import { Play, Star, Info, ExternalLink, Flame } from 'lucide-react';

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (channel: Channel) => void;
  onPlay?: (channel: Channel, e: React.MouseEvent) => void;
  onToggleFavorite: (channelId: string, e: React.MouseEvent) => void;
  onOpenDetails: (channel: Channel, e: React.MouseEvent) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isActive,
  isFavorite,
  onSelect,
  onPlay,
  onToggleFavorite,
  onOpenDetails,
}) => {
  return (
    <div
      onClick={() => onSelect(channel)}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
        isActive
          ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
          : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Logo / Thumbnail */}
        <div className="w-12 h-12 bg-neutral-950 rounded-lg p-1 border border-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:border-neutral-700 transition">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs font-bold text-neutral-500 uppercase">
              {channel.group.substring(0, 3)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-6">
          <h3 className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-amber-400' : 'text-neutral-200'}`}>
            {channel.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] font-medium text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
              {channel.group}
            </span>
            <span className="text-[10px] text-neutral-400">
              {channel.resolution || 'HD'}
            </span>
            {channel.view_count !== undefined && channel.view_count > 0 && (
              <span
                className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium"
                title={`${channel.view_count.toLocaleString()} lượt xem / click`}
              >
                <Flame className="w-2.5 h-2.5 text-amber-500" />
                {channel.view_count.toLocaleString()}
              </span>
            )}
            {isActive && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Đang phát
              </span>
            )}
          </div>
        </div>

        {/* Favorite Button */}
        <button
          type="button"
          onClick={(e) => onToggleFavorite(channel.id, e)}
          className="absolute top-3 right-3 text-neutral-500 hover:text-amber-400 transition p-1"
          title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        >
          <Star
            className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-neutral-500'}`}
          />
        </button>
      </div>

      {/* Bottom Bar: Action buttons */}
      <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
        <span className="text-[11px] font-mono text-neutral-400 uppercase">
          {channel.format}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => onOpenDetails(channel, e)}
            className="p-1 hover:text-white rounded hover:bg-neutral-800 transition"
            title="Xem chi tiết & link CorePlayer"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          <a
            href={`/open/${channel.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40 transition"
            title="Mở bằng CorePlayer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onPlay) onPlay(channel, e);
              else onSelect(channel);
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-sm ${
              isActive
                ? 'bg-amber-500 text-neutral-950 ring-2 ring-amber-500/40 hover:bg-amber-400 scale-105'
                : 'bg-neutral-800 text-neutral-300 hover:bg-amber-500 hover:text-neutral-950 group-hover:bg-amber-500/80 group-hover:text-neutral-950'
            }`}
            title="Phát kênh này ngay"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ChannelCardSkeleton: React.FC = () => {
  return (
    <div className="relative p-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 flex flex-col justify-between overflow-hidden animate-pulse">
      {/* Shimmer subtle gradient overlay */}
      <div className="flex items-start gap-3">
        {/* Logo / Thumbnail Skeleton */}
        <div className="w-12 h-12 bg-neutral-800 rounded-lg flex-shrink-0" />

        {/* Info Skeleton */}
        <div className="flex-1 min-w-0 pr-6 space-y-2 py-0.5">
          {/* Channel Name Line */}
          <div className="h-4 bg-neutral-800 rounded-md w-3/4" />
          
          {/* Badges Line */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="h-3.5 bg-neutral-800/90 rounded w-16" />
            <div className="h-3 bg-neutral-800/70 rounded w-8" />
          </div>
        </div>

        {/* Favorite Icon Placeholder */}
        <div className="absolute top-3 right-3 w-4 h-4 bg-neutral-800/80 rounded" />
      </div>

      {/* Bottom Bar Skeleton */}
      <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
        <div className="h-3 bg-neutral-800/80 rounded w-10 font-mono" />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-neutral-800/70" />
          <div className="w-5 h-5 rounded bg-neutral-800/70" />
          <div className="w-7 h-7 rounded-full bg-neutral-800" />
        </div>
      </div>
    </div>
  );
};
