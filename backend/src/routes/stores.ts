import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { db } from '../db';
import { sse } from '../services/sseService';
import crypto from 'crypto';

const router = Router();

// GET /api/stores
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db('stores')
      .where('user_id', req.user!.userId)
      .orderBy('created_at', 'desc');
    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取店铺列表失败' });
  }
});

// POST /api/stores
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: '店铺名称不能为空' });
      return;
    }
    const id = `store-${Date.now()}`;
    await db('stores').insert({
      id,
      user_id: req.user!.userId,
      name: name.trim(),
    });
    // ★ SSE 推送：通知前端店铺列表变更
    sse.sendToUser(req.user!.userId, 'stores:changed', { storeId: id, action: 'created' });
    res.json({
      success: true,
      data: { id, name: name.trim(), createdAt: new Date().toISOString() },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '创建店铺失败' });
  }
});

// PUT /api/stores/:storeId
router.put('/:storeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    await db('stores').where({ id: req.params.storeId, user_id: req.user!.userId }).update({ name });
    res.json({ success: true, message: '店铺已更名' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// DELETE /api/stores/:storeId
router.delete('/:storeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    // ★ 先校验归属权（事务外，防止任意用户删除他人店铺数据）
    const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
    if (!store && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: '无权删除此店铺' });
      return;
    }
    // ★ 事务保护：全部删除或全部回滚
    await db.transaction(async (trx: any) => {
      await trx('store_data').where('store_id', storeId).del();
      await trx('store_configs').where('store_id', storeId).del();
      await trx('store_available_fields').where('store_id', storeId).del();
      await trx('upload_records').where('store_id', storeId).del();
      await trx('stores').where({ id: storeId }).del();
    });
    // ★ SSE 推送：通知前端店铺已删除
    sse.sendToUser(req.user!.userId, 'stores:changed', { storeId, action: 'deleted' });
    res.json({ success: true, message: '店铺已删除' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// ===== 邀请码管理 =====

// GET /api/stores/invite/list (管理员)
router.get('/invite/list', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    const rows = await db('invite_codes').orderBy('created_at', 'desc').limit(100);
    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        batchId: r.batch_id,
        createdBy: r.created_by,
        usedBy: r.used_by,
        usedAt: r.used_at,
        isUsed: r.is_used,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取邀请码失败' });
  }
});

// POST /api/stores/invite/generate (管理员)
router.post('/invite/generate', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    const { count = 5 } = req.body;
    const batchId = `batch-${Date.now()}`;
    const codes: string[] = [];

    for (let i = 0; i < Math.min(count, 50); i++) {
      const code = `MEOO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      codes.push(code);
    }

    await db('invite_codes').insert(
      codes.map(code => ({
        code,
        batch_id: batchId,
        created_by: req.user!.userId,
      }))
    );

    res.json({ success: true, data: { batchId, codes }, message: `已生成 ${codes.length} 个邀请码` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '生成邀请码失败' });
  }
});

// DELETE /api/stores/invite/:code (管理员)
router.delete('/invite/:code', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    await db('invite_codes').where('code', req.params.code).del();
    res.json({ success: true, message: '邀请码已销毁' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

export default router;
