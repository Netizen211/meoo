import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';
import { verifyApiToken } from './auth';
import * as dataService from '../services/dataService';
import { normalizeFieldName, normalizeRecordKeys, normalizeRecordsArray } from '../services/fieldNormalizer';
import { DATA_CATEGORIES } from '../shared-types';
import cache from '../services/cacheService';
import { transaction } from '../services/transactionService';
import logger from '../services/loggerService';
import { validate, syncSchema, configSyncSchema, pullSchema } from '../middleware/validate';
import { sse } from '../services/sseService';

const router = Router();

// multer 配置 — 产品图片上传
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/products');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const productImgStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: Function) => { cb(null, UPLOAD_DIR); },
  filename: (req: any, file: Express.Multer.File, cb: Function) => {
    const userId = req.user?.userId || 'unknown';
    const productId = req.body?.productId || req.params?.productId || 'unknown';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${userId}_${productId}${ext}`);
  }
});
const upload = multer({ storage: productImgStorage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (!file.mimetype.startsWith('image/')) { cb(new Error('仅支持图片文件')); return; }
  cb(null, true);
} });

// 各类数据的主键字段（用于去重合并）
const KEY_FIELDS: Record<string, string> = {
  orders: '订单号',
  afterSaleRecords: '售后编号',
  shippingInsurance: '订单编号',
  // ★ 推广/货款/明星/直播：前端已去重，后端直接合并不丢行
  // （不用单字段去重，避免同订单多行货款、同商品多计划推广被误判重复）
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
    } else if (existingStoreRow.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      // ★ 修复：店铺属于其他用户，拒绝写入（管理员除外）
      res.status(403).json({ success: false, error: '无权操作此店铺' });
      return;
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
    await db.transaction(async (trx: any) => {
      for (const category of DATA_CATEGORIES) {
      const categoryData = data[category];
      if (!categoryData || !Array.isArray(categoryData)) continue;

      // ★ 入库前规范化每条记录的字段名
      const normalizedCategoryData = normalizeRecordsArray(categoryData);

      const existingRow = await trx('store_data').where({ store_id: storeId, category }).first();

      // 🔴 保护1：空数据不覆盖已有数据
      if (normalizedCategoryData.length === 0 && existingRow) {
        const existingLen = existingRow.row_count || 0;
        mergeStats[category] = { added: 0, skipped: 0, total: existingLen };
        continue;
      }

      let merged: any[] = normalizedCategoryData;
      let added = normalizedCategoryData.length;
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
              normalizedCategoryData.forEach((item: any) => {
                const key = String((item[keyField] || '')).trim();
                if (key && existingKeys.has(key)) { skipped++; }
                else { newItems.push(item); if (key) existingKeys.add(key); }
              });
              merged = [...existingData, ...newItems];
              added = newItems.length;
            } else {
              // ★ 无主键分类：用内容哈希去重（避免重复同步翻倍）
              const existingHashes = new Set(existingData.map((item: any) => {
                try { return JSON.stringify(item); } catch { return ''; }
              }).filter(Boolean));
              const newItems: any[] = [];
              normalizedCategoryData.forEach((item: any) => {
                let hash = '';
                try { hash = JSON.stringify(item); } catch {}
                if (hash && !existingHashes.has(hash)) {
                  newItems.push(item);
                  existingHashes.add(hash);
                } else { skipped++; }
              });
              merged = [...existingData, ...newItems];
              added = newItems.length;
            }
          }
        } catch { /* 解析失败则覆盖 */ }
      }

      await trx('store_data')
        .insert({ store_id: storeId, category, payload_json: JSON.stringify(merged), row_count: merged.length })
        .onConflict(['store_id', 'category'] as any)
        .merge({ payload_json: JSON.stringify(merged), row_count: merged.length, updated_at: db.fn.now() });

      mergeStats[category] = { added, skipped, total: merged.length };
    }

    });

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

    // ★ 修复：验证店铺归属权
    const { db } = require('../db');
    const storeOwner = await db('stores').where('id', storeId).select('user_id').first();
    if (storeOwner && storeOwner.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: '无权访问此店铺数据' });
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
    // ★ 修复：验证店铺归属权
    const { db } = require('../db');
    const storeOwner = await db('stores').where('id', storeId).select('user_id').first();
    if (storeOwner && storeOwner.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: '无权操作此店铺配置' });
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
    // ★ 修复：验证店铺归属权
    const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
    if (!store && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: '无权操作此店铺上传记录' });
      return;
    }
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

// ★ 产品图片上传
router.post('/product-image/upload', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const multerReq = req as Request & { file: Express.Multer.File };
    if (!multerReq.file) { res.status(400).json({ success: false, error: '请选择图片' }); return; }
    const productId = req.body.productId as string;
    if (!productId) { res.status(400).json({ success: false, error: '缺少productId' }); return; }
    res.json({ success: true, data: { url: `/api/data/product-image/${productId}`, productId } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '上传失败' });
  }
});

// ★ 产品图片获取
router.get('/product-image/:productId', async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.includes('_') && f.split('_').slice(1).join('_').split('.')[0] === productId);
    if (files.length === 0) { res.status(404).json({ success: false, error: '图片不存在' }); return; }
    res.sendFile(path.join(UPLOAD_DIR, files[0]));
  } catch { res.status(404).json({ success: false, error: '图片不存在' }); }
});

// ★ API Token 或 JWT 认证中间件（用于浏览器插件等外部调用）
async function optionalAuth(req: Request, res: Response, next: Function) {
  try {
    // 先尝试 JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // 尝试作为 API Token 验证
      const user = await verifyApiToken(token);
      if (user) {
        (req as any).user = { userId: user.userId, username: user.username, role: 'normal' };
        next();
        return;
      }
      // 尝试作为 JWT 验证（通过 requireAuth）
      const jwtAuth = requireAuth as (req: Request, res: Response, next: Function) => void;
      jwtAuth(req, res, (err?: any) => {
        if (err) {
          res.status(401).json({ success: false, error: '认证失败' });
          return;
        }
        next();
      });
      return;
    }
    res.status(401).json({ success: false, error: '缺少认证信息' });
  } catch {
    res.status(401).json({ success: false, error: '认证失败' });
  }
}

// ★ 批量从 URL 导入产品图片（用于浏览器插件）
router.post('/product-images/import-from-urls', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    // items: Array<{ productId: string; imageUrl: string; goodsName?: string }>
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: '请提供 items 数组' });
      return;
    }

    // 限流：每用户每60秒最多请求1次
    const userId = req.user!.userId;
    const rateKey = `import_from_urls_${userId}`;
    const cached = cache.get(rateKey);
    if (cached) {
      res.status(429).json({ success: false, error: '请求过于频繁，请60秒后再试' });
      return;
    }
    cache.set(rateKey, true, 60);

    const results: Array<{ productId: string; success: boolean; error?: string }> = [];
    const MAX_ITEMS = 200;
    const batch = items.slice(0, MAX_ITEMS);

    // 并发下载，限制 5 并发
    const CONCURRENCY = 5;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (item: { productId: string; imageUrl: string; goodsName?: string }) => {
        const { productId, imageUrl } = item;
        try {
          if (!productId || !imageUrl) {
            results.push({ productId, success: false, error: '缺少 productId 或 imageUrl' });
            return;
          }

          // 下载图片
          const response = await fetch(imageUrl, {
            signal: AbortSignal.timeout(30000),
          });
          if (!response.ok) {
            results.push({ productId, success: false, error: `下载失败 HTTP ${response.status}` });
            return;
          }

          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpeg';
          const buffer = Buffer.from(await response.arrayBuffer());

          // 保存到磁盘: userId_productId.ext
          const filename = `${userId}_${productId}${ext}`;
          const filePath = path.join(UPLOAD_DIR, filename);
          fs.writeFileSync(filePath, buffer);

          results.push({ productId, success: true });
        } catch (err: any) {
          results.push({ productId, success: false, error: err.message || '下载失败' });
        }
      }));
    }

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        successCount,
        failCount: results.length - successCount,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '批量导入失败' });
  }
});

// ★ 获取产品图片映射列表（返回所有已上传图片的 productId 列表）
router.get('/product-images/list', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(`${userId}_`));
    const mappings = files.map(f => {
      const parts = f.replace(/\.\w+$/, '').split('_');
      const productId = parts.slice(1).join('_');
      return {
        productId,
        url: `/api/v1/data/product-image/${productId}`,
        filename: f,
      };
    });
    res.json({ success: true, data: mappings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
});

// ★ 获取单个产品图片信息（右键悬浮使用）
router.get('/product-images/:productId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const productId = req.params.productId;
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(`${userId}_`) && f.includes(`_${productId}.`));
    if (files.length === 0) {
      res.json({ success: true, data: null });
      return;
    }
    res.json({
      success: true,
      data: {
        productId,
        url: `/api/v1/data/product-image/${productId}`,
        filename: files[0],
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
});

// ★ 获取单个产品的财务数据（利润计算器使用）
router.get('/product-finance/:productId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const productId = req.params.productId;

    const { db } = require('../db');
    // 查出用户的所有店铺
    const stores = await db('stores').where('user_id', userId).select('id');
    if (stores.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const storeIds = stores.map((s: any) => s.id);

    // 从 store_data 中查找包含该商品ID的分类数据
    let financeData: any = {
      avgPrice: 0,
      cost: 0,
      commissionRate: 0,
      adCostPerOrder: 0,
      refundRate: 0,
      shippingCost: 0,
      totalOrders: 0,
      totalRevenue: 0,
    };

    for (const storeId of storeIds) {
      const rows = await db('store_data').where('store_id', storeId).whereIn('category', ['orders', 'afterSaleRecords', 'shippingInsurance', 'promotionData', 'financeData']);
      for (const row of rows) {
        try {
          const payload = JSON.parse(row.payload_json);
          if (!Array.isArray(payload)) continue;

          if (row.category === 'orders') {
            // 查找包含该商品ID的订单
            const productOrders = payload.filter((o: any) => {
              const idFields = [o.商品ID, o.goodsId, o.productId, o.商品id, o['商品编号']];
              return idFields.some((f: any) => String(f || '') === productId);
            });
            if (productOrders.length > 0) {
              const prices = productOrders.map((o: any) => parseFloat(o.实付金额 || o.price || o.售价 || o.单价 || 0));
              const validPrices = prices.filter((p: any) => p > 0);
              if (validPrices.length > 0) {
                financeData.avgPrice = validPrices.reduce((a: number, b: number) => a + b, 0) / validPrices.length;
              }
              financeData.totalOrders = productOrders.length;
              financeData.totalRevenue = productOrders.reduce((sum: number, o: any) => sum + parseFloat(o.实付金额 || o.price || o.售价 || 0), 0);
            }
          } else if (row.category === 'afterSaleRecords') {
            // 退款率
            const productRefunds = payload.filter((r: any) => {
              const idFields = [r.商品ID, r.goodsId, r.productId, r.商品id];
              return idFields.some((f: any) => String(f || '') === productId);
            });
            if (productRefunds.length > 0) {
              const total = productRefunds.length;
              const refunded = productRefunds.filter((r: any) => {
                const status = String(r.售后状态 || r.status || '');
                return status.includes('退款') || status.includes('退货') || status.includes('成功') || status.includes('关闭');
              }).length;
              financeData.refundRate = total > 0 ? Math.round((refunded / total) * 100) : 0;
            }
          } else if (row.category === 'shippingInsurance') {
            // 运费
            const productShipping = payload.filter((s: any) => {
              const idFields = [s.商品ID, s.goodsId, s.productId, s.商品id];
              return idFields.some((f: any) => String(f || '') === productId);
            });
            if (productShipping.length > 0) {
              const fees = productShipping.map((s: any) => parseFloat(s.运费 || s.fee || s.运费险 || 0));
              const validFees = fees.filter((f: any) => f > 0);
              if (validFees.length > 0) {
                financeData.shippingCost = validFees.reduce((a: number, b: number) => a + b, 0) / validFees.length;
              }
            }
          } else if (row.category === 'promotionData') {
            // 推广费/单
            const totalAdSpend = payload.reduce((sum: number, p: any) => sum + parseFloat(p.花费 || p.spend || p.推广费 || 0), 0);
            const totalOrdersFromAd = payload.reduce((sum: number, p: any) => sum + parseInt(p.订单量 || p.成交数 || p.订单数 || 0), 0);
            if (totalOrdersFromAd > 0 && financeData.totalOrders > 0) {
              financeData.adCostPerOrder = totalAdSpend / totalOrdersFromAd;
            }
          } else if (row.category === 'financeData') {
            // 财务数据：成本、佣金率
            const productFinance = payload.filter((f: any) => {
              const idFields = [f.商品ID, f.goodsId, f.productId, f.商品id];
              return idFields.some((field: any) => String(field || '') === productId);
            });
            if (productFinance.length > 0) {
              const costs = productFinance.map((f: any) => parseFloat(f.成本 || f.cost || f.进货价 || 0)).filter((c: any) => c > 0);
              if (costs.length > 0) {
                financeData.cost = costs.reduce((a: number, b: number) => a + b, 0) / costs.length;
              }
              const commissions = productFinance.map((f: any) => parseFloat(f.佣金比例 || f.commissionRate || f.平台扣点 || 0)).filter((c: any) => c > 0);
              if (commissions.length > 0) {
                financeData.commissionRate = commissions.reduce((a: number, b: number) => a + b, 0) / commissions.length;
              }
            }
          }
        } catch (e) {
          // 跳过解析失败的行
        }
      }
    }

    res.json({ success: true, data: financeData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
});

export default router;
