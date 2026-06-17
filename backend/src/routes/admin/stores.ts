/**
 * 店铺路由 — 数据统计、店铺数据浏览、店铺删除
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

// GET /api/admin/data-stats — 数据监控
router.get('/data-stats', async (_req: Request, res: Response) => {
  try {
    const rawStats = await db('store_data')
      .select('store_id', 'category')
      .sum({ total_rows: 'row_count' })
      .groupBy('store_id', 'category');
    const stores = await db('stores')
      .select('stores.id', 'stores.name', 'users.username')
      .leftJoin('users', 'stores.user_id', 'users.id');

    const uploadInfo = await db('upload_records')
      .select('store_id', db.raw('MAX(uploaded_at) as last_upload_at'))
      .groupBy('store_id');
    const uploadMap: Record<string, string | null> = {};
    for (const r of uploadInfo as any[]) {
      uploadMap[r.store_id] = r.last_upload_at;
    }

    const storageInfo = await db('store_data')
      .select('store_id', db.raw('SUM(LENGTH(payload_json)) as storage_bytes'))
      .groupBy('store_id');
    const storageMap: Record<string, number> = {};
    for (const r of storageInfo as any[]) {
      storageMap[r.store_id] = Number(r.storage_bytes ?? 0);
    }

    const storeMap: Record<string, any> = {};
    for (const s of stores) {
      storeMap[s.id] = {
        storeId: s.id, storeName: s.name || '未命名', userName: s.username || '-',
        orders: 0, promotionSummary: 0, promotionProducts: 0,
        starStoreSummary: 0, liveStreamSummary: 0,
        shippingInsurance: 0, afterSaleRecords: 0, financialRecords: 0, totalRows: 0,
        lastUploadAt: null as string | null, storageBytes: 0,
      };
    }
    for (const row of rawStats as any[]) {
      if (!storeMap[row.store_id]) {
        storeMap[row.store_id] = {
          storeId: row.store_id, storeName: '未知店铺', userName: '-',
          orders: 0, promotionSummary: 0, promotionProducts: 0,
          starStoreSummary: 0, liveStreamSummary: 0,
          shippingInsurance: 0, afterSaleRecords: 0, financialRecords: 0, totalRows: 0,
          lastUploadAt: null as string | null, storageBytes: 0,
        };
      }
      const cat = row.category as string;
      if (storeMap[row.store_id][cat] !== undefined) {
        storeMap[row.store_id][cat] = Number(row.total_rows) || 0;
      }
      storeMap[row.store_id].totalRows += Number(row.total_rows) || 0;
    }

    for (const storeId of Object.keys(storeMap)) {
      storeMap[storeId].lastUploadAt = uploadMap[storeId] || null;
      storeMap[storeId].storageBytes = storageMap[storeId] || 0;
    }

    res.json({ success: true, data: Object.values(storeMap) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取数据统计失败' });
  }
});

// GET /api/admin/stores/:id/data — 浏览店铺上传数据
router.get('/stores/:id/data', async (req: Request, res: Response) => {
  try {
    const { category, page = 1, pageSize = 20 } = req.query;
    const storeId = req.params.id;
    const offset = (Number(page) - 1) * Number(pageSize);

    const store = await db('stores').where('id', storeId).first();
    if (!store) { res.status(404).json({ success: false, error: '店铺不存在' }); return; }

    let query = db('store_data').where('store_id', storeId);
    if (category && category !== 'all') {
      query = query.where('category', category as string);
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query
      .select('id', 'category', 'row_count', 'uploaded_at')
      .orderBy('uploaded_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    const categoryStats = await db('store_data')
      .where('store_id', storeId)
      .select('category', db.raw('SUM(row_count) as total_rows'), db.raw('MAX(uploaded_at) as last_upload'))
      .groupBy('category');

    const availableFields = await db('store_available_fields')
      .where('store_id', storeId)
      .select('category', 'field_name', 'field_label');

    res.json({
      success: true,
      data: {
        store: { id: store.id, name: store.name, userId: store.user_id, createdAt: store.created_at },
        categoryStats: (categoryStats as any[]).map(c => ({
          category: c.category,
          totalRows: Number(c.total_rows),
          lastUpload: c.last_upload,
        })),
        availableFields,
        records: (rows as any[]).map(r => ({
          id: r.id,
          category: r.category,
          rowCount: r.row_count,
          uploadedAt: r.uploaded_at,
        })),
      },
      total: Number((total as any)?.count) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] store data error:', err);
    res.status(500).json({ success: false, error: '获取店铺数据失败' });
  }
});

// DELETE /api/admin/stores/:storeId — 管理员删除店铺及数据
router.delete('/stores/:storeId', async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId;
    const store = await db('stores').where('id', storeId).first();
    if (!store) { res.status(404).json({ success: false, error: '店铺不存在' }); return; }

    await db('store_data').where('store_id', storeId).del();
    await db('store_configs').where('store_id', storeId).del();
    await db('store_available_fields').where('store_id', storeId).del();
    await db('upload_records').where('store_id', storeId).del();
    await db('sub_account_stores').where('store_id', storeId).del();
    await db('stores').where('id', storeId).del();

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'delete_store',
      target_type: 'store',
      target_id: storeId,
      details: `管理员删除店铺: ${store.name} (用户: ${store.user_id})`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: '店铺及所有数据已删除' });
  } catch (err: any) {
    console.error('[admin] delete store error:', err);
    res.status(500).json({ success: false, error: '删除店铺失败' });
  }
});

export default router;