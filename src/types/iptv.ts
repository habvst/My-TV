export interface Channel {
  id: string;
  playlist_id?: string;
  name: string;
  group: string;
  logo: string;
  stream_url: string;
  format: 'hls' | 'mp4' | 'http' | 'unknown';
  tvg_id?: string;
  tvg_name?: string;
  video_codec?: string;
  audio_codec?: string;
  resolution?: string;
  status?: 'active' | 'check' | 'offline';
  description?: string;
  updated_at?: string;
  created_at?: string;
  view_count?: number;
}

export type ChannelSortOption = 'default' | 'popular' | 'recent' | 'name';

export interface Playlist {
  id: string;
  name: string;
  type: 'url' | 'content';
  url?: string;
  content?: string;
  enabled: boolean;
  channel_count: number;
  last_updated: string;
  status: 'active' | 'error' | 'syncing';
  error_message?: string;
}

export interface StreamTestResult {
  url: string;
  status: 'online' | 'warning' | 'offline';
  http_status?: number;
  content_type?: string;
  is_https: boolean;
  response_time_ms: number;
  message: string;
}

export type DeviceType = 'NOKIA_S60' | 'MOBILE_MODERN' | 'TABLET' | 'DESKTOP' | 'UNKNOWN';

export interface DeviceInfo {
  type: DeviceType;
  isNokiaS60: boolean;
  isMobile: boolean;
  userAgent: string;
  recommendedView: 'legacy' | 'modern';
  clientIp?: string;
}

export interface AdminStats {
  totalPlaylists: number;
  activePlaylists: number;
  totalChannels: number;
  activeChannels: number;
  groups: string[];
}

export interface DailyTrafficPoint {
  date: string;
  fullDate: string;
  dayName: string;
  views: number;
  channels: number;
}

export interface ChannelTrafficStats {
  daily: DailyTrafficPoint[];
  total7dViews: number;
  todayViews: number;
  growthPercent: number;
  topChannels: Array<{ id: string; name: string; views: number; group: string }>;
}
