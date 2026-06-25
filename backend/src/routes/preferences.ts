/**
 * 用户偏好路由 (User Preferences API)
 *
 * 企业级跨设备偏好同步，替代前端 localStorage 直读。
 * 所有端点均需要认证（JWT）。
 *
 * API 设计：
 * GET  /preferences        — 获取当前用户所有偏好（全量加载）
 * GET  /preferences/:key   — 获取单个偏好
 * PUT  /preferences/:key   — 设置偏好（支持版本冲突检测）
 * POST /preferences/batch  — 批量设置偏好
 * POST /preferences/migrate — 从 localStorage 迁移旧数据
 * DELETE /preferences/:key — 删除偏好
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import logger from '../services/loggerService';
import * as prefService from '../services/preferencesService';

const router = Router();

// 所有偏好路由都需要认证
router.use(requireAuth);

/**
 * GET /api/v1/preferences
 * 获取当前用户所有偏好
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const prefs = await prefService.getAllPreferences(userId);
    res.json({ success: true, data: prefs });
  } catch (error: any) {
    logger.error('GET /preferences failed', { extra: { error: error.message } });
    res.status(500).json({ success: false, error: '获取偏好失败' });
  }
});

/**
 * GET /api/v1/preferences/:key
 * 获取单个偏好
 */
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { key } = req.params;

    // 校验 key 格式（只允许字母、数字、下划线）
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return res.status(400).json({ success: false, error: '无效的偏好 key' });
    }

    const pref = await prefService.getPreference(userId, key);
    if (!pref) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: { [key]: pref } });
  } catch (error: any) {
    logger.error('GET /preferences/:key failed', { extra: { error: error.message } });
    res.status(500).json({ success: false, error: '获取偏好失败' });
  }
});

/**
 * PUT /api/v1/preferences/:key
 * 设置偏好（upsert）
 * Body: { value: any, version?: number }
 */
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { key } = req.params;
    const { value, version } = req.body;

    // 校验 key 格式
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return res.status(400).json({ success: false, error: '无效的偏好 key' });
    }

    // value 不能为 undefined
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'value 不能为空' });
    }

    const result = await prefService.setPreference(userId, key, value, version);

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        error: '版本冲突，请刷新后重试',
        currentVersion: result.version,
        conflict: true,
      });
    }

    res.json({
      success: true,
      data: { version: result.version },
    });
  } catch (error: any) {
    logger.error('PUT /preferences/:key failed', { extra: { error: error.message } });
    res.status(500).json({ success: false, error: '保存偏好失败' });
  }
});

/**
 * POST /api/v1/preferences/batch
 * 批量设置偏好
 * Body: { prefs: Array<{ key: string, value: any, version?: number }> }
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { prefs } = req.body;

    if (!Array.isArray(prefs) || prefs.length === 0) {
      return res.status(400).json({ success: false, error: 'prefs 必须是非空数组' });
    }

    // 校验所有 key
    for (const pref of prefs) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(pref.key)) {
        return res.status(400).json({
          success: false,
          error: `无效的偏好 key: ${pref.key}`,
        });
      }
    }

    const result = await prefService.setPreferencesBatch(userId, prefs);
    if (!result.success) {
      return res.status(500).json({ success: false, error: '批量保存失败' });
    }

    // 检查是否有冲突
    const conflicts = result.results.filter(r => r.conflict);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: `有 ${conflicts.length} 个偏好版本冲突`,
        results: result.results,
        conflict: true,
      });
    }

    res.json({ success: true, data: { results: result.results } });
  } catch (error: any) {
    logger.error('POST /preferences/batch failed', { extra: { error: error.message } });
    res.status(500).json({ success: false, error: '批量保存偏好失败' });
  }
});

/**
 * POST /api/v1/preferences/migrate
 * 从 localStorage 迁移旧数据
 * Body: { prefs: Record<string, any> }
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { prefs } = req.body;

    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ success: false, error: 'prefs 必须是对象' });
    }

    const count = await prefService.migrateFromLocalStorage(userId, prefs);
    res.json({ success: true, data: { migrated: count } });
  } catch (error: any) {
    logger.error('POST /preferences/migrate failed', { extra: { error: error.message } });
    res.status(500).json({ success: false, error: '迁移偏好失败' });
  }
});

/**
 * DELETE /api/v1/preferences/:key
 * 删除偏好
 */
router.delete('/:key', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { key } = req.params;

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return res.status(400).json({ success: false, error: '无效的偏好 key' });
    }

    await prefService.deletePreference(userId, key);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('DELETE /preferences/:key failed', { extra: { error: error.message } });
    res.status(500).json({ success: false, error: '删除偏好失败' });
  }
});

export default router;
