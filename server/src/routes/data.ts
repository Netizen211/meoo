import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dataService from '../services/dataService';
import { DATA_CATEGORIES } from '../shared-types';

const router = Router();

// POST /api/data/sync — 全量同步店铺数据
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId, storeName, clientUpdatedAt, data, configs, uploadRecords } = req.body;

    if (!storeId || !data) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }

    // 确保店铺存在
    const existingStore = await dataService.loadStoreData(storeId);
    const storeExists = existingStore !== null;
    const { db } = require('../db');
    if (!storeExists) {
      // 创建店铺记录（如果不存在）
      const existingStoreRow = await db('stores').where('id', storeId).first();
      if (!existingStoreRow) {
        await db('stores').insert({
          id: storeId,
          user_id: req.user!.userId,
          name: storeName || '未命名店铺',
        });
      }
    }

    // 保存各类数据
    for (const category of DATA_CATEGORIES) {
      const categoryData = data[category];
      if (categoryData) {
        await dataService.saveStoreData(
          storeId,
          category,
          JSON.stringify(categoryData),
          Array.isArray(categoryData) ? categoryData.length : 0
        );
      }
    }

    // 保存可用字段
    if (data.availableFields) {
      await dataService.saveAvailableFields(storeId, data.availableFields);
    }

    // 保存配置
    if (configs) {
      for (const [key, value] of Object.entries(configs)) {
        await dataService.saveStoreConfig(storeId, key, JSON.stringify(value));
      }
    }

    // 保存上传记录
    if (uploadRecords && uploadRecords.length > 0) {
      await dataService.saveUploadRecords(storeId, req.user!.userId, uploadRecords);
    }

    res.json({
      success: true,
      data: { syncedAt: new Date().toISOString() },
    });
  } catch (err: any) {
    console.error('[data] sync error:', err);
    res.status(500).json({ success: false, error: '同步失败' });
  }
});

// POST /api/data/pull — 拉取店铺数据
router.post('/pull', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      res.status(400).json({ success: false, error: '缺少店铺 ID' });
      return;
    }

    const storeData = await dataService.loadStoreData(storeId);
    const configs = await dataService.loadStoreConfigs(storeId);
    const availableFields = await dataService.loadAvailableFields(storeId);
    const uploadRecords = await dataService.loadUploadRecords(storeId);

    if (storeData) {
      storeData.availableFields = availableFields;
    }

    res.json({
      success: true,
      data: {
        storeName: '',
        data: storeData,
        configs,
        uploadRecords,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[data] pull error:', err);
    res.status(500).json({ success: false, error: '拉取失败' });
  }
});

// DELETE /api/data/store/:storeId
router.delete('/store/:storeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;

    // 验证店铺属于当前用户
    const { db } = require('../db');
    const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
    if (!store && req.user!.role !== 'admin' && req.user!.role !== 'test') {
      res.status(403).json({ success: false, error: '无权操作此店铺' });
      return;
    }

    await dataService.deleteStoreData(storeId);
    res.json({ success: true, message: '数据已删除' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

export default router;
