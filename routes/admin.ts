import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getAdminCredentials,
  generateToken,
  verifyToken,
  requireAdminAuth,
} from '../src/auth/adminAuth.js';
import {
  getPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  syncPlaylist,
  syncAllPlaylists,
  getAllChannelsAdmin,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  testStreamUrl,
  batchUpdateChannelsStatus,
  resetChannelsStatus,
} from '../src/db/storage.js';

const router = Router();

// -----------------------------------------------------------------------------
// AUTH ENDPOINTS
// -----------------------------------------------------------------------------

router.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const creds = getAdminCredentials();

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  }

  // Constant time comparison to prevent timing attacks
  const userBuf = Buffer.from(username.trim());
  const expectedUserBuf = Buffer.from(creds.username);
  const passBuf = Buffer.from(password.trim());
  const expectedPassBuf = Buffer.from(creds.password);

  const userMatch = userBuf.length === expectedUserBuf.length && crypto.timingSafeEqual(userBuf, expectedUserBuf);
  const passMatch = passBuf.length === expectedPassBuf.length && crypto.timingSafeEqual(passBuf, expectedPassBuf);

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  const token = generateToken(creds.username);
  res.json({
    success: true,
    token,
    username: creds.username,
  });
});

router.get('/api/admin/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }
  const token = authHeader.substring(7);
  const result = verifyToken(token);
  res.json({ authenticated: result.valid, username: result.username });
});

// All following routes require admin auth
router.use('/api/admin', requireAdminAuth);

// -----------------------------------------------------------------------------
// PLAYLISTS MANAGEMENT
// -----------------------------------------------------------------------------

router.get('/api/admin/playlists', async (_req: Request, res: Response) => {
  try {
    const playlists = await getPlaylists();
    res.json(playlists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/playlists', async (req: Request, res: Response) => {
  try {
    const { name, type, url, content, enabled } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên playlist không được để trống.' });
    }
    if (type === 'url' && !url) {
      return res.status(400).json({ error: 'Vui lòng nhập URL của playlist M3U.' });
    }
    if (type === 'content' && !content) {
      return res.status(400).json({ error: 'Vui lòng dán nội dung playlist M3U.' });
    }

    const playlist = await createPlaylist({
      name: name.trim(),
      type: type || 'url',
      url,
      content,
      enabled: enabled !== undefined ? enabled : true,
    });

    res.status(201).json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/admin/playlists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, content, enabled } = req.body;

    const updated = await updatePlaylist(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(url !== undefined ? { url: url.trim() } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy playlist.' });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/admin/playlists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await deletePlaylist(id);
    if (!success) {
      return res.status(404).json({ error: 'Không tìm thấy playlist để xóa.' });
    }
    res.json({ success: true, message: 'Đã xóa playlist và các kênh liên quan.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/playlists/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await syncPlaylist(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Cập nhật playlist thất bại.' });
    }
    const updated = await getPlaylistById(id);
    res.json({ success: true, count: result.count, playlist: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/playlists/refresh-all', async (_req: Request, res: Response) => {
  try {
    const result = await syncAllPlaylists();
    res.json({
      success: true,
      message: `Đã làm mới xong tất cả playlist (${result.totalSuccess} thành công, ${result.totalFailed} lỗi).`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// CHANNELS MANAGEMENT
// -----------------------------------------------------------------------------

router.get('/api/admin/channels', async (req: Request, res: Response) => {
  try {
    const { q, playlist_id, group } = req.query;
    let channels = await getAllChannelsAdmin();

    if (playlist_id && typeof playlist_id === 'string' && playlist_id !== 'all') {
      channels = channels.filter((c) => c.playlist_id === playlist_id);
    }

    if (group && typeof group === 'string' && group !== 'all') {
      channels = channels.filter((c) => c.group.toLowerCase() === group.toLowerCase());
    }

    if (q && typeof q === 'string' && q.trim()) {
      const query = q.toLowerCase().trim();
      channels = channels.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.group.toLowerCase().includes(query) ||
          (c.tvg_id && c.tvg_id.toLowerCase().includes(query)) ||
          c.stream_url.toLowerCase().includes(query)
      );
    }

    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/channels', async (req: Request, res: Response) => {
  try {
    const channelData = req.body;
    if (!channelData.name || !channelData.stream_url) {
      return res.status(400).json({ error: 'Tên kênh và URL stream là bắt buộc.' });
    }
    const created = await createChannel(channelData);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/admin/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channelData = req.body;
    const updated = await updateChannel(id, channelData);
    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy kênh.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/admin/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await deleteChannel(id);
    if (!success) {
      return res.status(404).json({ error: 'Không tìm thấy kênh để xóa.' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// STREAM TEST ENDPOINT
// -----------------------------------------------------------------------------

router.post('/api/admin/test-stream', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Thiếu tham số url để kiểm tra.' });
    }
    const result = await testStreamUrl(url.trim());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// BATCH CHANNEL HEALTH SCANNER & AUTO-MARK
// -----------------------------------------------------------------------------

router.post('/api/admin/channels/scan-batch', async (req: Request, res: Response) => {
  try {
    const { channelIds, updateStatus = true } = req.body;
    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({ error: 'Danh sách channelIds không hợp lệ.' });
    }

    // Limit batch size to protect resources (max 50 per batch request)
    const targetIds = channelIds.slice(0, 50);
    const channels = await getAllChannelsAdmin();
    const channelMap = new Map(channels.map((c) => [c.id, c]));

    const results: Array<{
      id: string;
      name: string;
      group: string;
      stream_url: string;
      status: 'online' | 'warning' | 'offline';
      http_status?: number;
      message: string;
      response_time_ms: number;
    }> = [];

    const updates: Array<{ id: string; status: 'active' | 'offline' | 'check' }> = [];

    // Controlled concurrency pool (5 simultaneous probes per batch)
    const concurrency = 5;
    for (let i = 0; i < targetIds.length; i += concurrency) {
      const chunk = targetIds.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (id) => {
        const ch = channelMap.get(id);
        if (!ch) {
          return {
            id,
            name: 'Kênh không tồn tại',
            group: '',
            stream_url: '',
            status: 'offline' as const,
            message: 'Không tìm thấy kênh trong hệ thống',
            response_time_ms: 0,
          };
        }

        const testRes = await testStreamUrl(ch.stream_url);
        return {
          id: ch.id,
          name: ch.name,
          group: ch.group,
          stream_url: ch.stream_url,
          status: testRes.status,
          http_status: testRes.http_status,
          message: testRes.message,
          response_time_ms: testRes.response_time_ms,
        };
      });

      const chunkResults = await Promise.all(chunkPromises);
      for (const r of chunkResults) {
        results.push(r);
        if (updateStatus) {
          updates.push({
            id: r.id,
            status: r.status === 'offline' ? 'offline' : 'active',
          });
        }
      }
    }

    let updatedCount = 0;
    if (updateStatus && updates.length > 0) {
      updatedCount = await batchUpdateChannelsStatus(updates);
    }

    res.json({
      success: true,
      results,
      updatedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/channels/reset-status', async (req: Request, res: Response) => {
  try {
    const { playlist_id, status = 'active' } = req.body;
    const count = await resetChannelsStatus(status, playlist_id);
    res.json({
      success: true,
      message: `Đã khôi phục trạng thái ${status} cho ${count} kênh.`,
      count,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN STATS
// -----------------------------------------------------------------------------

router.get('/api/admin/stats', async (_req: Request, res: Response) => {
  try {
    const playlists = await getPlaylists();
    const channels = await getAllChannelsAdmin();

    const groupsSet = new Set<string>();
    for (const c of channels) {
      if (c.group) groupsSet.add(c.group);
    }

    res.json({
      totalPlaylists: playlists.length,
      activePlaylists: playlists.filter((p) => p.enabled).length,
      totalChannels: channels.length,
      activeChannels: channels.filter((c) => c.status === 'active').length,
      groups: Array.from(groupsSet),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
