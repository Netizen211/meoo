import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import * as dataService from '../services/dataService';
import { DATA_CATEGORIES } from '../shared-types';
import cache from '../services/cacheService';
import { transaction } from '../services/transactionService';
import logger from '../services/loggerService';
import { validate, syncSchema, configSyncSchema, pullSchema } from '../middleware/validate';
import { sse } from '../services/sseService';

const router = Router();

// 各类数据的主键字段（用于去重合并）
const KEY_FIELDS: Record<string, string> = {
  orders: '订单号',
  afterSaleRecords: '售后编号',
  shippingInsurance: '订单编号',
};

// POST /api/data/sync — 智能合并同步（多设备安全，追加去重）
router.post('/sync', requireAuth, validate(syncSchema), async (req: Request, res: Response) => {
  try {
    const { storeId, storeName, data, configs, uploadRecords } = req.body;

    if (!storeId || !data) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }

    // 确保店铺存在
    const { db } = require('../db');
    const existingStoreRow = await db('stores').where('id', storeId).first();
    if (!existingStoreRow) {
      await db('stores').insert({
        id: storeId, user_id: req.user!.userId, name: storeName || '未命名店铺',
      });
    }

    // 隐私合规检查：禁止上传含个人信息的字段
    const PROHIBITED_FIELDS = ['收货人', '收货人姓名', '收件人', '收货人手机', '收货人电话',
      '手机号', '买家手机', '收货地址', '详细地址', '街道/镇', '街道', '镇', '区',
      '买家留言', '商家备注'];
    const foundProhibited: string[] = [];
    for (const cat of ['orders', 'afterSaleRecords'] as const) {
      if (data[cat] && Array.isArray(data[cat]) && data[cat].length > 0) {
        const fields = Object.keys(data[cat][0]);
        for (const f of PROHIBITED_FIELDS) {
          if (fields.includes(f) && !foundProhibited.includes(f)) {
            foundProhibited.push(f);
          }
        }
      }
    }
    if (foundProhibited.length > 0) {
      res.status(400).json({
        success: false,
        error: `数据包含个人信息字段：${foundProhibited.join('、')}。请在导出时去掉这些列后重新上传，保护买家隐私。`,
        prohibitedFields: foundProhibited,
      });
      return;
    }

    const mergeStats: Record<string, { added: number; skipped: number; total: number }> = {};

    // 智能合并各类数据
    for (const category of DATA_CATEGORIES) {
      const categoryData = data[category];
      if (!categoryData || !Array.isArray(categoryData)) continue;

      const existingRow = await db('store_data').where({ store_id: storeId, category }).first();

      // 🔴 保护1：空数据不覆盖已有数据
      if (categoryData.length === 0 && existingRow) {
        const existingLen = existingRow.row_count || 0;
        mergeStats[category] = { added: 0, skipped: 0, total: existingLen };
        continue;
      }

      let merged: any[] = categoryData;
      let added = categoryData.length;
      let skipped = 0;

      if (existingRow) {
        try {
          const existingData = JSON.parse(existingRow.payload_json);
          if (Array.isArray(existingData) && existingData.length > 0) {
            // 🔴 保护2：合并前备份旧数据到 payload_json_backup
            const keyField = KEY_FIELDS[category];
            if (keyField) {
              const existingKeys = new Set(existingData.map((item: any) => String(item[keyField] || '').trim()).filter(Boolean));
              const newItems: any[] = [];
              categoryData.forEach((item: any) => {
                const key = String((item[keyField] || '')).trim();
                if (key && existingKeys.has(key)) { skipped++; }
                else { newItems.push(item); if (key) existingKeys.add(key); }
              });
              merged = [...existingData, ...newItems];
              added = newItems.length;
            }
          }
        } catch { /* 解析失败则覆盖 */ }
      }

      await db('store_data')
        .insert({ store_id: storeId, category, payload_json: JSON.stringify(merged), row_count: merged.length })
        .onConflict(['store_id', 'category'] as any)
        .merge({ payload_json: JSON.stringify(merged), row_count: merged.length, updated_at: db.fn.now() });

      mergeStats[category] = { added, skipped, total: merged.length };
    }

    // 保存可用字段（合并）
    if (data.availableFields) {
      await dataService.saveAvailableFields(storeId, data.availableFields);
    }

    // 保存配置（覆盖式，配置不需要合并）
    if (configs) {
      for (const [key, value] of Object.entries(configs)) {
        await dataService.saveStoreConfig(storeId, key, JSON.stringify(value));
      }
    }

    // 保存上传记录（追加）
    if (uploadRecords && uploadRecords.length > 0) {
      await dataService.saveUploadRecords(storeId, req.user!.userId, uploadRecords);
    }

    // ★ 数据更新后主动失效该店铺的缓存
    cache.invalidateStore(storeId);

    // ★ SSE 实时推送（单实例fork模式，无需延迟）
    sse.sendToUser(req.user!.userId, 'sync:completed', {
      storeId,
      syncedAt: new Date().toISOString(),
      stats: mergeStats,
    });

    res.json({
      success: true,
      data: { syncedAt: new Date().toISOString(), mergeStats },
    });
  } catch (err: any) {
    logger.error('sync error', { error: err.message });
    res.status(500).json({ success: false, error: '同步失败' });
  }
});

// POST /api/data/pull — 拉取店铺数据
router.post('/pull', requireAuth, validate(pullSchema), async (req: Request, res: Response) => {
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
    logger.error('pull error', { error: err.message });
    res.status(500).json({ success: false, error: '拉取失败' });
  }
});

// POST /api/data/config — 单条配置即时同步（毫秒级，用于用户操作的实时持久化）
router.post('/config', requireAuth, validate(configSyncSchema), async (req: Request, res: Response) => {
  try {
    const { storeId, configKey, payloadJson } = req.body;
    if (!storeId || !configKey) {
      res.status(400).json({ success: false, error: '缺少storeId或configKey' });
      return;
    }
    await dataService.saveStoreConfig(storeId, configKey, payloadJson);
    cache.invalidateStore(storeId);

    // ★ SSE 实时推送：通知所有同用户设备配置已变更
    sse.sendToUser(req.user!.userId, 'config:updated', {
      storeId,
      configKey,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '配置保存失败' });
  }
});

// DELETE /api/data/store/:storeId
router.delete('/store/:storeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { db } = require('../db');
    const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
    if (!store && req.user!.role !== 'admin' && req.user!.role !== 'test') {
      res.status(403).json({ success: false, error: '无权操作此店铺' });
      return;
    }
    await dataService.deleteStoreData(storeId);
    cache.invalidateStore(storeId);
    // ★ SSE 推送：通知前端数据已删除
    sse.sendToUser(req.user!.userId, 'data:deleted', { storeId, deletedAt: new Date().toISOString() });
    res.json({ success: true, message: '数据已删除' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// DELETE /api/data/store/:storeId/category/:category — 按分类清除数据
router.delete('/store/:storeId/category/:category', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId, category } = req.params;
    const { db } = require('../db');
    const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
    if (!store && req.user!.role !== 'admin' && req.user!.role !== 'test') {
      res.status(403).json({ success: false, error: '无权操作此店铺' });
      return;
    }
    await db('store_data').where({ store_id: storeId, category }).del();
    cache.invalidateStore(storeId);
    res.json({ success: true, message: `分类 ${category} 数据已删除` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// DELETE /api/data/store/:storeId/configs — 清除店铺配置
router.delete('/store/:storeId/configs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { db } = require('../db');
    const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
    if (!store && req.user!.role !== 'admin' && req.user!.role !== 'test') {
      res.status(403).json({ success: false, error: '无权操作此店铺' });
      return;
    }
    await db('store_configs').where('store_id', storeId).del();
    cache.invalidateStore(storeId);
    res.json({ success: true, message: '配置已清除' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '清除失败' });
  }
});

// DELETE /api/data/store/:storeId/uploads — 清除上传记录
router.delete('/store/:storeId/uploads', requireAuth, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { db } = require('../db');
    await db('upload_records').where('store_id', storeId).del();
    res.json({ success: true, message: '上传记录已清除' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '清除失败' });
  }
});

// POST /api/data/clear-all — 清除当前用户所有店铺数据（事务保护）
router.post('/clear-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { db } = require('../db');
    const userId = req.user!.userId;
    const userStores = await db('stores').where('user_id', userId).select('id');
    const storeIds = userStores.map((s: any) => s.id);

    // ★ 使用事务确保全部删除或全部回滚
    await transaction(async (trx) => {
      for (const sid of storeIds) {
        await trx('store_data').where('store_id', sid).del();
        await trx('store_configs').where('store_id', sid).del();
        await trx('store_available_fields').where('store_id', sid).del();
        await trx('upload_records').where('store_id', sid).del();
        await trx('stores').where('id', sid).del();
        cache.invalidateStore(sid);
      }
    });

    cache.clear(); // 全量清除兜底
    logger.info(`User ${userId} cleared all data: ${storeIds.length} stores`);
    res.json({ success: true, message: `已清除 ${storeIds.length} 个店铺的全部数据` });
  } catch (err: any) {
    logger.error('clear-all failed', { error: err.message, userId: req.user!.userId });
    res.status(500).json({ success: false, error: '清除失败' });
  }
});

export default router;
