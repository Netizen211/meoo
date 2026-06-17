/**
 * 服务端分析API — 所有KPI计算在服务端完成，前端纯渲染
 * 数据源：MySQL store_data 表
 *
 * 缓存策略：
 * - 原始数据 30s TTL（同页面多次请求复用一次 MySQL 读取）
 * - 计算结果 60s TTL（计算密集，复用收益高）
 * - 数据同步时主动失效
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import * as analytics from '../services/analyticsService';
import cache from '../services/cacheService';
import logger from '../services/loggerService';
import { dbCircuit, analyticsCircuit, CircuitOpenError } from '../services/circuitBreakerService';

/** 获取数据（带断路器保护 + 缓存） */
async function safeCachedStoreData(storeId: string): Promise<Record<string, any[]>> {
  const cacheKey = `raw:${storeId}`;
  const cached = cache.get<Record<string, any[]>>(cacheKey);
  if (cached) return cached;
  const data = await dbCircuit.execute(() => analytics.loadStoreData(storeId));
  cache.set(cacheKey, data, 30);
  return data;
}

async function safeAllStoresData(userId: string): Promise<Record<string, any[]>> {
  const cacheKey = `raw:all:${userId}`;
  const cached = cache.get<Record<string, any[]>>(cacheKey);
  if (cached) return cached;
  const data = await dbCircuit.execute(() => analytics.loadAllUserStoreData(userId));
  cache.set(cacheKey, data, 30);
  return data;
}

/** 安全路由包装：自动处理断路器 + 通用错误 */
function safeRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      if (err instanceof CircuitOpenError) {
        logger.warn('Circuit open', { error: err.message, path: req.originalUrl });
        res.status(503).json({
          success: false,
          error: err.message,
          retryAfter: 30,
        });
        return;
      }
      logger.error('Route error', { error: err.message, path: req.originalUrl, stack: err.stack });
      res.status(500).json({ success: false, error: '服务器内部错误' });
    }
  };
}

const router = Router();
router.use(requireAuth);

// ★ 缓存辅助：force=1 强制刷新，绕过所有缓存
function cachedOrCompute(req: Request, key: string): any | null {
  if (req.query.force === '1' || req.query.force === 'true') return null;
  return cache.get(key);
}

// ★ 全局断路器错误处理 — 所有分析路由的兜底
router.use((_req: Request, res: Response, next: any) => {
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // 添加缓存控制头，force模式下禁用缓存
    const force = _req.query.force === '1';
    res.setHeader('Cache-Control', force ? 'no-cache, no-store, must-revalidate' : 'private, max-age=30');
    return originalJson(body);
  } as any;
  next();
});

// 店铺归属校验中间件（管理员/test/__all__ 跳过校验）
async function requireStoreOwnership(req: Request, res: Response, next: any) {
  const storeId = (req.query.storeId || req.body.storeId) as string;
  if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
  // __all__ 是全店虚拟模式，不校验单个店铺归属
  if (storeId === '__all__') { next(); return; }
  if (req.user!.role === 'admin' || req.user!.role === 'test') { next(); return; }
  const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
  if (!store) { res.status(403).json({ success: false, error: '无权访问此店铺数据' }); return; }
  next();
}

// ★ 全店配置加载
async function allStoresConfigs(userId: string): Promise<Record<string, any>> {
  const cacheKey = `config:all:${userId}`;
  const cached = cache.get<Record<string, any>>(cacheKey);
  if (cached) return cached;
  const configs = await dbCircuit.execute(() => analytics.loadAllStoresConfigs(userId));
  cache.set(cacheKey, configs, 30);
  return configs;
}

// GET /api/analytics/dashboard
router.get('/dashboard', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const isAll = storeId === '__all__';
    const cacheKey = `kpi:dashboard:${storeId}`;
    const cached = cachedOrCompute(req, cacheKey);
    if (cached) { res.json({ success: true, data: cached }); return; }
    const data = isAll ? await safeAllStoresData(req.user!.userId) : await safeCachedStoreData(storeId);
    const result = analytics.computeDashboardKPI(data);
    cache.set(cacheKey, result, 60);
    res.json({ success: true, data: result });
  } catch (err: any) { logger.error('dashboard error', { error: err.message }); res.status(500).json({ success: false, error: '计算失败' }); }
});

// GET /api/analytics/overview — 前端 v2 使用的聚合端点（dashboard + products 一站式）
router.get('/overview', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const isAll = storeId === '__all__';
    const cacheKey = `kpi:overview:${storeId}`;
    const cached = cachedOrCompute(req, cacheKey);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const data = isAll ? await safeAllStoresData(req.user!.userId) : await safeCachedStoreData(storeId);

    // 并行计算 dashboard 和 products
    const [dashboardResult, productsList] = await Promise.all([
      Promise.resolve(analytics.computeDashboardKPI(data)),
      isAll ? Promise.resolve([] as any[]) : analytics.computeProductsList(data, storeId),
    ]);

    // ★ 映射为前端 OverviewResponse 格式
    const overview = {
      dashboard: {
        kpi: {
          gmv: dashboardResult.kpi.gmv,
          revenue: dashboardResult.kpi.revenue,
          paid: dashboardResult.kpi.paid || 0,
          refund: dashboardResult.kpi.refund,
          orders: dashboardResult.kpi.orders,
          refundRate: dashboardResult.kpi.refundRate,
          avgOrder: dashboardResult.kpi.avgOrder,
          profit: dashboardResult.kpi.profit,
          profitRate: dashboardResult.kpi.profitRate,
          promoCost: dashboardResult.kpi.promoCost,
          promoGmv: dashboardResult.kpi.promoGmv,
          promoROI: dashboardResult.kpi.promoROI,
          buyers: dashboardResult.kpi.buyers,
          productCount: dashboardResult.kpi.productCount,
          ...(dashboardResult.kpi.afterSaleRate !== undefined && { afterSaleRate: dashboardResult.kpi.afterSaleRate }),
          ...(dashboardResult.kpi.insuranceFee !== undefined && { insuranceFee: dashboardResult.kpi.insuranceFee }),
          ...(dashboardResult.kpi.penalties !== undefined && { penalties: dashboardResult.kpi.penalties }),
        },
      },
      products: productsList.map((p: any) => ({
        id: p.id,
        name: p.name,
        orders: p.orders,
        gmv: p.gmv,
        revenue: p.revenue,
        refund: p.refund || 0,
        refundRate: p.refundRate || 0,
        promoCost: p.promoCost || 0,
        promoGmv: p.promoGmv || 0,
        roi: p.roi || 0,
      })),
      serverVersion: 2,
    };

    cache.set(cacheKey, overview, 30);
    res.json({ success: true, data: overview });
  } catch (err: any) {
    logger.error('overview error', { error: err.message });
    res.status(500).json({ success: false, error: '计算失败' });
  }
});

// GET /api/analytics/products
router.get('/products', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const isAll = storeId === '__all__';
    const cacheKey = `kpi:products:${storeId}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) { res.json({ success: true, data: cached, _cached: true }); return; }
    const data = isAll ? await safeAllStoresData(req.user!.userId) : await safeCachedStoreData(storeId);
    const products = await analytics.computeProductsList(data, storeId);
    cache.set(cacheKey, products, 60);
    res.json({ success: true, data: products });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// GET /api/analytics/promotion
router.get('/promotion', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const isAll = storeId === '__all__';
    const cacheKey = `kpi:promotion:${storeId}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) { res.json({ success: true, data: cached, _cached: true }); return; }
    const data = isAll ? await safeAllStoresData(req.user!.userId) : await safeCachedStoreData(storeId);
    const result = analytics.computePromotionStats(data);
    cache.set(cacheKey, result, 60);
    res.json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// GET /api/analytics/aftersale
router.get('/aftersale', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const isAll = storeId === '__all__';
    const cacheKey = `kpi:aftersale:${storeId}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) { res.json({ success: true, data: cached, _cached: true }); return; }
    const data = isAll ? await safeAllStoresData(req.user!.userId) : await safeCachedStoreData(storeId);
    const result = analytics.computeAfterSaleStats(data);
    cache.set(cacheKey, result, 60);
    res.json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// GET /analytics/products/stats（支持分页）
router.get('/products/stats', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    // ★ 时间筛选：按支付时间过滤订单
    const timeRange = req.query.timeRange as string;
    let orders = data.orders || [];
    if (timeRange && timeRange !== 'all') {
      const rangeDays = parseInt(timeRange) || 7;
      const allDates = orders.map((o: any) => String(o['支付时间'] || o['下单时间'] || '').trim().slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      if (allDates.length > 0) {
        const maxDate = new Date(allDates[allDates.length - 1]);
        const cutoff = new Date(maxDate);
        cutoff.setDate(cutoff.getDate() - rangeDays + 1);
        const startStr = cutoff.toISOString().split('T')[0];
        const endStr = maxDate.toISOString().split('T')[0];
        orders = orders.filter((o: any) => {
          const d = String(o['支付时间'] || o['下单时间'] || '').trim().slice(0, 10);
          return d >= startStr && d <= endStr;
        });
      }
    }
    const stats = analytics.computeAllProductStats(
      orders,
      data.promotionProducts || [],
      data.starStoreSummary || [],
      data.liveStreamSummary || [],
      data.afterSaleRecords || [],
      productCosts,
      configs
    );
    // ★ 上一周期数据（用于环比）
    const prevTimeRange = req.query.prevTimeRange as string;
    let prevStats: Record<string, any> | null = null;
    if (prevTimeRange && prevTimeRange !== 'all') {
      const prevDays = parseInt(prevTimeRange) || 7;
      const allDates = (data.orders || []).map((o: any) => String(o['支付时间'] || o['下单时间'] || '').trim().slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      if (allDates.length > 0) {
        const maxDate = new Date(allDates[allDates.length - 1]);
        const currentCutoff = new Date(maxDate);
        currentCutoff.setDate(currentCutoff.getDate() - parseInt(timeRange || '7') + 1);
        const prevEnd = new Date(currentCutoff);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevCutoff = new Date(prevEnd);
        prevCutoff.setDate(prevCutoff.getDate() - prevDays + 1);
        const prevStartStr = prevCutoff.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];
        const prevOrders = (data.orders || []).filter((o: any) => {
          const d = String(o['支付时间'] || o['下单时间'] || '').trim().slice(0, 10);
          return d >= prevStartStr && d <= prevEndStr;
        });
        prevStats = analytics.computeAllProductStats(
          prevOrders,
          data.promotionProducts || [],
          data.starStoreSummary || [],
          data.liveStreamSummary || [],
          data.afterSaleRecords || [],
          productCosts,
          configs
        );
      }
    }
    const entries = Object.entries(stats);
    const total = entries.length;
    const paged = Object.fromEntries(entries.slice((page - 1) * pageSize, page * pageSize));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({ success: true, data: paged, prevData: prevStats, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// GET /analytics/product/deep/:productId
router.get('/product/deep/:productId', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    const productId = req.params.productId;
    if (!storeId || !productId) { res.status(400).json({ error: '缺少参数' }); return; }
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const allStats = analytics.computeAllProductStats(
      data.orders || [], data.promotionProducts || [],
      data.starStoreSummary || [], data.liveStreamSummary || [],
      data.afterSaleRecords || [], productCosts, configs
    );
    const deep = analytics.computeDeepAnalysis(productId, allStats, data.orders || [], data.promotionProducts || [], data.afterSaleRecords || [], productCosts);
    if (!deep) { res.status(404).json({ error: '商品不存在' }); return; }
    res.json({ success: true, data: deep });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 每日趋势 (GMV/订单/退款按天)
router.get('/trends', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const trends = analytics.computeDailyTrends(data.orders || [], data.afterSaleRecords || []);
    res.json({ success: true, data: trends });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 地区分布
router.get('/regions', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const regions = analytics.computeRegionDistribution(data.orders || []);
    res.json({ success: true, data: regions });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 财务汇总
router.get('/financial', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const financial = analytics.computeFinancialSummary(data.financialRecords || [], data.orders || []);
    res.json({ success: true, data: financial });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 物流分析
router.get('/logistics', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const logistics = analytics.computeShipTimeDistribution(data.orders || []);
    res.json({ success: true, data: logistics });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 环比数据
router.get('/compare', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    const days = parseInt(req.query.days as string) || 7;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const compare = analytics.computePeriodCompare(data.orders || [], data.promotionProducts || [], data.afterSaleRecords || [], days);
    res.json({ success: true, data: compare });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 推广按日趋势
router.get('/promo-trends', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const trends = analytics.computePromoByDate(data.promotionProducts || [], data.starStoreSummary || [], data.liveStreamSummary || []);
    res.json({ success: true, data: trends });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 增强: 成本汇总（完整概览含罚金/营销/退款/多SKU重复扣费）
// 可选 startDate/endDate 参数做时间过滤
router.get('/costs', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);

    let orders = data.orders || [];
    // 时间过滤
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (startDate || endDate) {
      orders = orders.filter((o: any) => {
        const d = (o['支付时间'] || '').split(' ')[0];
        if (!d) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    const costs = analytics.computeCostSummary(
      orders, productCosts, configs,
      data.financialRecords || [], data.afterSaleRecords || [],
      storeId
    );
    res.json({ success: true, data: costs });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 新增: 成本环比趋势（接受时间范围，对比前后周期）
router.get('/cost-trend', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);

    // 当前时间范围
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    // 比较期天数（默认 7 天）
    const compareDays = parseInt(req.query.compareDays as string) || 7;

    let currentOrders = data.orders || [];
    if (startDate || endDate) {
      currentOrders = data.orders.filter((o: any) => {
        const d = (o['支付时间'] || '').split(' ')[0];
        if (!d) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    // 比较期：当前范围往前推 compareDays 天
    let prevStart = '', prevEnd = '';
    if (startDate && endDate) {
      const daysDiff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      const prevEndDate = new Date(new Date(startDate).getTime() - 86400000);
      const prevStartDate = new Date(prevEndDate.getTime() - daysDiff * 86400000);
      prevStart = prevStartDate.toISOString().slice(0, 10);
      prevEnd = prevEndDate.toISOString().slice(0, 10);
    }

    let prevOrders: any[] = [];
    if (prevStart && prevEnd) {
      prevOrders = data.orders.filter((o: any) => {
        const d = (o['支付时间'] || '').split(' ')[0];
        if (!d) return false;
        return d >= prevStart && d <= prevEnd;
      });
    }

    // 计算
    const getCosts = (ords: any[]) => analytics.computeCostSummary(
      ords, productCosts, configs,
      data.financialRecords || [], data.afterSaleRecords || [],
      storeId
    );
    const current = getCosts(currentOrders);
    const previous = getCosts(prevOrders);

    const chg = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);

    res.json({
      success: true,
      data: {
        current: {
          revenue: current.totalRevenue,
          cost: current.totalCost,
          profit: current.profit,
          penalties: current.penalties,
          marketingFees: current.marketingFees,
        },
        previous: {
          revenue: previous.totalRevenue,
          cost: previous.totalCost,
          profit: previous.profit,
        },
        changes: {
          revenue: chg(current.totalRevenue, previous.totalRevenue),
          cost: chg(current.totalCost, previous.totalCost),
          profit: previous.profit !== 0 ? ((current.profit - previous.profit) / Math.abs(previous.profit)) * 100 : (current.profit > 0 ? 100 : -100),
        },
      },
    });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 增强: Dashboard 包含成本分解
router.get('/dashboard-full', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const kpi = analytics.computeDashboardKPI(data);
    const costs = analytics.computeCostSummary(
      data.orders || [], productCosts, configs,
      data.financialRecords || [], data.afterSaleRecords || [],
      storeId
    );
    const compare = analytics.computePeriodCompare(
      data.orders || [], data.promotionProducts || [], data.afterSaleRecords || [], 7,
      productCosts, configs, storeId
    );
    const promoByDate = analytics.computePromoByDate(data.promotionProducts || [], data.starStoreSummary || [], data.liveStreamSummary || []);
    res.json({ success: true, data: { kpi: kpi.kpi, status: kpi.status, provinces: kpi.provinces, costs, compare, promoByDate } });
  } catch (err: any) { res.status(500).json({ success: false, error: '计算失败' }); }
});

// ★ 批量分析端点 — 单次请求获取所有分析数据（减少 N+1 请求瀑布）
router.get('/bulk', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ success: false, error: '缺少storeId' }); return; }
    const isAll = storeId === '__all__';
    const cacheKey = `kpi:bulk:${storeId}`;
    const cached = cachedOrCompute(req, cacheKey);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const startTime = Date.now();
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);

    // 并行计算所有分析结果
    const [
      dashboardKpi,
      productsList,
      promotionStats,
      afterSaleStats,
      dailyTrends,
      regionDistribution,
      shipTimeDistribution,
      promoByDate,
      costSummary,
      periodCompare,
      financialSummary,
    ] = await Promise.all([
      Promise.resolve(analytics.computeDashboardKPI(data)),
      isAll
        ? Promise.resolve([]) // __all__ 模式不计算商品列表（数据量可能很大）
        : analytics.computeProductsList(data, storeId),
      Promise.resolve(analytics.computePromotionStats(data)),
      Promise.resolve(analytics.computeAfterSaleStats(data)),
      Promise.resolve(analytics.computeDailyTrends(data.orders || [], data.afterSaleRecords || [])),
      Promise.resolve(analytics.computeRegionDistribution(data.orders || [])),
      Promise.resolve(analytics.computeShipTimeDistribution(data.orders || [])),
      Promise.resolve(analytics.computePromoByDate(
        data.promotionProducts || [], data.starStoreSummary || [], data.liveStreamSummary || []
      )),
      Promise.resolve(analytics.computeCostSummary(
        data.orders || [], productCosts, configs,
        data.financialRecords || [], data.afterSaleRecords || [],
        storeId
      )),
      Promise.resolve(analytics.computePeriodCompare(
        data.orders || [], data.promotionProducts || [], data.afterSaleRecords || [], 7,
        productCosts, configs, storeId
      )),
      Promise.resolve(analytics.computeFinancialSummary(data.financialRecords || [], data.orders || [])),
    ]);

    const elapsed = Date.now() - startTime;

    const result = {
      dashboard: { kpi: dashboardKpi.kpi, status: dashboardKpi.status, provinces: dashboardKpi.provinces },
      products: productsList,
      promotion: promotionStats,
      afterSale: afterSaleStats,
      trends: dailyTrends,
      regions: regionDistribution,
      logistics: shipTimeDistribution,
      promoByDate,
      costs: costSummary,
      compare: periodCompare,
      financial: financialSummary,
      meta: { storeId, computedInMs: elapsed, dataRows: data.orders?.length || 0 },
    };

    cache.set(cacheKey, result, 30); // 30s TTL（比单端点短，因为数据量大）
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('bulk analytics error', { error: err.message });
    res.status(500).json({ success: false, error: '批量计算失败' });
  }
});

// GET /api/analytics/products/retrospective — 商品复盘数据
router.get('/products/retrospective', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    const productId = req.query.productId as string;
    if (!storeId || !productId) { res.status(400).json({ success: false, error: '缺少storeId或productId' }); return; }
    const timeRange = (req.query.timeRange as string) || '30';
    const customStart = req.query.customStart as string;
    const customEnd = req.query.customEnd as string;
    const compareWindow = parseInt(req.query.compareWindow as string) || 7;
    const { data, configs, productCosts } = await analytics.resolveStoreContext(storeId, req.user!.userId);
    const result = await analytics.computeProductRetrospective(data, productCosts, configs, productId, timeRange, customStart, customEnd, compareWindow);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('retrospective error', { error: err.message, path: req.originalUrl });
    res.status(500).json({ success: false, error: '复盘计算失败' });
  }
});

export default router;
