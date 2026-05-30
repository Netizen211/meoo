/**
 * 服务端分析API — 所有KPI计算在服务端完成，前端纯渲染
 * 数据源：MySQL store_data 表
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';

const router = Router();
router.use(requireAuth);

// 店铺归属校验中间件
async function requireStoreOwnership(req: Request, res: Response, next: any) {
  const storeId = (req.query.storeId || req.body.storeId) as string;
  if (!storeId) { res.status(400).json({ error: '缺少storeId' }); return; }
  const store = await db('stores').where({ id: storeId, user_id: req.user!.userId }).first();
  if (!store) { res.status(403).json({ error: '无权访问此店铺数据' }); return; }
  next();
}

// 辅助函数
function sv(arr: any[], key: string): number {
  return arr.reduce((s, x) => s + (parseFloat(x[key]) || 0), 0);
}
function cnt(arr: any[], key: string, cond?: (v: string) => boolean): number {
  if (cond) return arr.filter(x => cond(String(x[key] || '').trim())).length;
  return arr.filter(x => x[key] != null && String(x[key]).trim() !== '').length;
}

async function getStoreData(storeId: string): Promise<Record<string, any[]>> {
  const rows = await db('store_data').where('store_id', storeId);
  const data: Record<string, any[]> = {};
  for (const row of rows) {
    try { data[row.category] = JSON.parse(row.payload_json); } catch { data[row.category] = []; }
  }
  return data;
}

// GET /api/analytics/dashboard — 数据中心所有KPI
router.get('/dashboard', requireStoreOwnership, async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: '缺少storeId' }); return; }

    const data = await getStoreData(storeId);
    const orders: any[] = data.orders || [];
    const promo: any[] = data.promotionProducts || [];
    const afterSale: any[] = data.afterSaleRecords || [];
    const insurance: any[] = data.shippingInsurance || [];
    const financial: any[] = data.financialRecords || [];

    const totalGmv = sv(orders, '商品总价(元)');
    const totalRevenue = sv(orders, '商家实收金额(元)');
    const totalPaid = sv(orders, '用户实付金额(元)');
    const totalRefund = sv(orders, '退款金额(元)');
    const refundOrders = orders.filter(o => parseFloat(o['退款金额(元)'] || '0') > 0);
    const totalDiscount = sv(orders, '店铺优惠折扣(元)') + sv(orders, '平台优惠折扣(元)') + sv(orders, '多多支付立减金额(元)');
    const platformFee = sv(orders, '平台技术服务费(元)');
    const totalPostage = sv(orders, '邮费(元)');
    const totalPromoCost = sv(promo, '总花费(元)');
    const totalPromoGmv = sv(promo, '交易额(元)');
    const totalPromoOrders = Math.round(sv(promo, '成交笔数'));
    const promoROI = totalPromoCost > 0 ? totalPromoGmv / totalPromoCost : 0;
    const totalAfterSale = afterSale.length;
    const insuranceFee = sv(insurance, '服务费用（元）') || sv(insurance, '服务费用(元)') || sv(insurance, '保费（元）') || sv(insurance, '保费(元)');
    const penalties = financial.filter(f => String(f['业务描述'] || '').startsWith('004'))
      .reduce((s, f) => s + Math.abs(parseFloat(f['支出金额（-元）'] || f['支出金额(元)'] || '0') || 0), 0);
    const profit = totalRevenue - totalRefund - totalPromoCost - platformFee - insuranceFee - penalties;
    const profitRate = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;
    // 发货统计
    const shippedOrders = orders.filter(o => { const v = o['发货时间']; return v != null && String(v).trim() !== ''; });
    const avgShipHours = shippedOrders.length > 0
      ? shippedOrders.reduce((s, o) => {
          const payT = new Date(String(o['支付时间'] || ''));
          const shipT = new Date(String(o['发货时间'] || ''));
          return s + (isNaN(shipT.getTime()) || isNaN(payT.getTime()) ? 0 : (shipT.getTime() - payT.getTime()) / 3600000);
        }, 0) / shippedOrders.length : 0;
    const conversionRate = orders.length > 0 ? (shippedOrders.length / orders.length) * 100 : 0;
    // 自然单 = 总订单 - 推广订单
    const organicOrders = Math.max(0, orders.length - totalPromoOrders);
    const organicGmv = Math.max(0, totalGmv - totalPromoGmv);

    // 状态分布
    const statusMap: Record<string, number> = {};
    orders.forEach(o => { const s = String(o['订单状态'] || ''); statusMap[s] = (statusMap[s] || 0) + 1; });

    // 省份TOP5
    const provMap: Record<string, number> = {};
    orders.forEach(o => { const p = String(o['省'] || '').trim(); if (p) provMap[p] = (provMap[p] || 0) + 1; });

    res.json({ success: true, data: {
      kpi: {
        gmv: totalGmv, revenue: totalRevenue, paid: totalPaid, refund: totalRefund,
        orders: orders.length, refundOrders: refundOrders.length,
        refundRate: orders.length > 0 ? (refundOrders.length / orders.length) * 100 : 0,
        afterSaleRate: orders.length > 0 ? (totalAfterSale / orders.length) * 100 : 0,
        avgOrder, discount: totalDiscount, platformFee, profit, profitRate,
        postage: totalPostage, conversionRate, avgShipHours,
        organicOrders, organicGmv,
        products: new Set(orders.map(o => String(o['商品ID'] || o['商品id'] || ''))).size,
        promoCost: totalPromoCost, promoGmv: totalPromoGmv, promoROI,
        promoOrders: totalPromoOrders,
        promoRatio: totalGmv > 0 ? (totalPromoCost / totalGmv) * 100 : 0,
        ctr: sv(promo, '点击量') / Math.max(1, sv(promo, '曝光量')) * 100,
        cvr: sv(promo, '成交笔数') / Math.max(1, sv(promo, '点击量')) * 100,
        insuranceFee, penalties,
        buyers: new Set(orders.map(o => String(o['订单号'] || '').trim()).filter(Boolean)).size,
        productCount: new Set(orders.map(o => String(o['商品ID'] || o['商品id'] || '').trim()).filter(id => id && id !== '-')).size,
      },
      status: Object.entries(statusMap).map(([k, v]) => ({ name: k, value: v })),
      provinces: Object.entries(provMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ name: k, value: v })),
    }});
  } catch (err: any) {
    res.status(500).json({ error: '计算失败' });
  }
});

// GET /api/analytics/products — 商品列表+每个商品的KPI
router.get('/products', async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: '缺少storeId' }); return; }
    const data = await getStoreData(storeId);
    const orders: any[] = data.orders || [];
    const promo: any[] = data.promotionProducts || [];
    const costsStr = (await db('store_configs').where({ store_id: storeId, config_key: `dianfx_product_costs_${storeId}` }).first())?.payload_json;
    const costs: Record<string, number> = costsStr ? JSON.parse(costsStr) : {};

    const byPid: Record<string, { orders: any[]; gmv: number; revenue: number; refund: number; refundCnt: number; name: string }> = {};
    orders.forEach(o => {
      const pid = String(o['商品ID'] || o['商品id'] || '');
      if (!byPid[pid]) byPid[pid] = { orders: [], gmv: 0, revenue: 0, refund: 0, refundCnt: 0, name: String(o['商品名称'] || pid) };
      byPid[pid].orders.push(o);
      byPid[pid].gmv += parseFloat(o['商品总价(元)'] || '0') || 0;
      byPid[pid].revenue += parseFloat(o['商家实收金额(元)'] || '0') || 0;
      byPid[pid].refund += parseFloat(o['退款金额(元)'] || '0') || 0;
      if (parseFloat(o['退款金额(元)'] || '0') > 0) byPid[pid].refundCnt++;
    });

    const promoByPid: Record<string, { cost: number; gmv: number }> = {};
    promo.forEach(p => {
      const pid = String(p['商品ID'] || '');
      if (!promoByPid[pid]) promoByPid[pid] = { cost: 0, gmv: 0 };
      promoByPid[pid].cost += parseFloat(p['总花费(元)'] || '0') || 0;
      promoByPid[pid].gmv += parseFloat(p['交易额(元)'] || '0') || 0;
    });

    const products = Object.entries(byPid).map(([pid, pr]) => {
      const promoData = promoByPid[pid] || { cost: 0, gmv: 0 };
      const rfRate = pr.orders.length > 0 ? (pr.refundCnt / pr.orders.length) * 100 : 0;
      const roi = promoData.cost > 0 ? promoData.gmv / promoData.cost : 0;
      return { id: pid, name: pr.name, orders: pr.orders.length, gmv: pr.gmv, revenue: pr.revenue, refund: pr.refund, refundRate: rfRate, promoCost: promoData.cost, promoGmv: promoData.gmv, roi };
    });

    res.json({ success: true, data: products });
  } catch (err: any) {
    res.status(500).json({ error: '计算失败' });
  }
});

// GET /api/analytics/promotion — 推广分析
router.get('/promotion', async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: '缺少storeId' }); return; }
    const data = await getStoreData(storeId);
    const promo: any[] = data.promotionProducts || [];
    const summary: any[] = data.promotionSummary || [];

    const totalCost = sv(promo, '总花费(元)');
    const totalGmv = sv(promo, '交易额(元)');
    const totalOrders = sv(promo, '成交笔数');
    const totalImp = sv(promo, '曝光量');
    const totalClick = sv(promo, '点击量');

    res.json({ success: true, data: {
      summary: { rows: summary.length, cost: totalCost, gmv: totalGmv, orders: Math.round(totalOrders), impressions: totalImp, clicks: totalClick, roi: totalCost > 0 ? totalGmv / totalCost : 0, ctr: totalImp > 0 ? (totalClick / totalImp) * 100 : 0, cvr: totalClick > 0 ? (totalOrders / totalClick) * 100 : 0 },
      byProduct: promo,
    }});
  } catch (err: any) {
    res.status(500).json({ error: '计算失败' });
  }
});

// GET /api/analytics/aftersale — 售后分析
router.get('/aftersale', async (req: Request, res: Response) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) { res.status(400).json({ error: '缺少storeId' }); return; }
    const data = await getStoreData(storeId);
    const as: any[] = data.afterSaleRecords || [];
    const orders: any[] = data.orders || [];

    const reasons: Record<string, number> = {};
    as.forEach(r => {
      const reason = String(r['退款原因'] || r['售后原因'] || '其他').trim();
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    res.json({ success: true, data: {
      total: as.length,
      refundAmount: sv(as, '退款金额(元)'),
      asRate: orders.length > 0 ? (as.length / orders.length) * 100 : 0,
      reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, count: v })),
    }});
  } catch (err: any) {
    res.status(500).json({ error: '计算失败' });
  }
});

export default router;
