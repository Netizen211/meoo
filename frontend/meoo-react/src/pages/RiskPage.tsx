import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell } from 'recharts';
import { AlertTriangle, RotateCcw, Truck, Star, Package, TrendingUp, Lock, Crown, Shield, Settings, X, Bell, BellOff, Search, ChevronDown, ChevronUp, CheckCircle, Clock, Activity, BarChart3, Filter, Info, AlertCircle, ExternalLink, VolumeX, Volume2, RefreshCw, Ban, Eye, EyeOff } from 'lucide-react';
import { useData, useAuth } from '../App';
import { sf, ss, findField, simpleHash } from '../utils';
import TimeFilter, { useTimeFilter, TimeRange, TimeGranularity, filterByTimeRange, getAllDateGroups, filterPromoByTimeRange, getWeekKey, getMonthKey } from '../components/TimeFilter';
import FilterToolbar from '../components/FilterToolbar';

// ═════════════════════════════════════════════════════════════════════
// 风险预警 — 全面重设计
// 8大维度 39条预警规则 · 三级严重度 · 屏蔽管理 · 跳转处理
// ═════════════════════════════════════════════════════════════════════

// ── 类型 ──
type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertDimension = 'product' | 'finance' | 'afterSale' | 'logistics' | 'promotion' | 'operation' | 'data' | 'cost';

interface AlertTarget { page: string; tab?: string; search?: string; filter?: string; }
interface AlertItem {
  id: string; dimension: AlertDimension; ruleKey: string; ruleName: string;
  severity: AlertSeverity; title: string; description: string; impact: string;
  target: AlertTarget; detectedAt: string;
  specificKey?: string; relatedName?: string;
}
interface MutedRule {
  type: 'category' | 'specific' | 'snooze'; category?: AlertDimension;
  rule?: string; target?: string; mutedAt: string; expiresAt: string | null;
}
interface ShieldData { mutedRules: MutedRule[]; processedAlerts: { id: string; processedAt: string }[]; }
interface AlertStats { total: number; critical: number; warning: number; info: number; processed7d: number; processingRate: number; avgResponseHours: number; }
interface DimSeverityCount { dimension: AlertDimension; dimLabel: string; total: number; critical: number; warning: number; info: number; }

// ── 常量 ──
const DIMENSION_META: Record<AlertDimension, { label: string; emoji: string }> = {
  product: { label: '商品', emoji: '📦' }, finance: { label: '财务', emoji: '💰' },
  afterSale: { label: '售后', emoji: '🔧' }, logistics: { label: '物流', emoji: '🚚' },
  promotion: { label: '推广', emoji: '📢' }, operation: { label: '运营', emoji: '👥' },
  data: { label: '数据', emoji: '📊' }, cost: { label: '成本', emoji: '📋' },
};
const DIMENSION_ORDER: AlertDimension[] = ['product','finance','afterSale','logistics','promotion','operation','data','cost'];
const SEVERITY_META: Record<AlertSeverity, { emoji: string; label: string; color: string; bg: string; border: string; textCls: string }> = {
  critical: { emoji: '🔴', label: '严重', color: 'var(--pdd-danger)', bg: 'var(--pdd-danger)', border: '#FECACA', textCls: 'text-red-700' },
  warning:  { emoji: '🟡', label: '警告', color: 'var(--pdd-warning)', bg: 'var(--pdd-warning)', border: '#FDE68A', textCls: 'text-yellow-700' },
  info:     { emoji: '🔵', label: '提醒', color: 'var(--pdd-info)', bg: '#EFF6FF', border: '#BFDBFE', textCls: 'text-blue-700' },
};
const SEVERITY_ORDER: AlertSeverity[] = ['critical','warning','info'];

const TAB_ALL = '__all__';
const TAB_MUTED = '__muted__';
const TABS = [
  { key: TAB_ALL, label: '全部', icon: '🔥' },
  ...DIMENSION_ORDER.map(d => ({ key: d, label: DIMENSION_META[d].label, icon: DIMENSION_META[d].emoji })),
  { key: TAB_MUTED, label: '已屏蔽', icon: '🔇' },
];
const SHIELD_KEY = 'dianfx_risk_shield';

// ── 工具 ──
function nowISO() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function hoursAgo(h: number) { const d=new Date(); d.setHours(d.getHours()-h); return d.toISOString().slice(0,16).replace('T',' '); }
function navigateTo(target: AlertTarget) {
  let hash = '#/' + target.page;
  const params: string[] = [];
  if (target.tab) params.push('tab='+target.tab);
  if (target.search) params.push('search='+encodeURIComponent(target.search));
  if (target.filter) params.push('filter='+encodeURIComponent(target.filter));
  if (params.length) hash += '?' + params.join('&');
  window.location.hash = hash;
}

// ── Shield 管理 ──
function loadShield(): ShieldData {
  try { return JSON.parse(localStorage.getItem(SHIELD_KEY) || '{"mutedRules":[],"processedAlerts":[]}'); }
  catch { return { mutedRules: [], processedAlerts: [] }; }
}
function saveShield(sd: ShieldData) {
  try { localStorage.setItem(SHIELD_KEY, JSON.stringify(sd)); } catch {}
}
function isMuted(sd: ShieldData, alert: AlertItem): boolean {
  if (!sd.mutedRules.length) return false;
  const now = new Date().getTime();
  for (const mr of sd.mutedRules) {
    if (mr.expiresAt) { const ex = new Date(mr.expiresAt).getTime(); if (ex < now) continue; }
    if (mr.type === 'category' && mr.rule === alert.ruleKey) return true;
    if (mr.type === 'specific' && mr.target === alert.specificKey) return true;
    if (mr.type === 'snooze') return true;
  }
  return false;
}
function isProcessed(sd: ShieldData, alertId: string): boolean {
  return sd.processedAlerts.some(p => p.id === alertId);
}

const COLORS = ['var(--pdd-danger)', 'var(--pdd-warning)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-purple)', 'var(--pdd-danger)', 'var(--pdd-cyan)'];

export default function RiskPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, useNaturalDate, setUseNaturalDate, customStart, customEnd, quickRange } = tf;

  const [activeTab, setActiveTab] = useState<string>(TAB_ALL);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // Shield state (localStorage-backed)
  const [shieldData, setShieldData] = useState<ShieldData>(() => loadShield());

  const updateShield = useCallback((fn: (prev: ShieldData) => ShieldData) => {
    setShieldData(prev => { const next = fn(prev); saveShield(next); return next; });
  }, []);

  const muteSpecific = useCallback((alert: AlertItem) => {
    updateShield(prev => ({
      ...prev, mutedRules: [...prev.mutedRules, { type: 'specific' as const, category: alert.dimension, rule: alert.ruleKey, target: alert.specificKey, mutedAt: nowISO(), expiresAt: null }]
    }));
  }, [updateShield]);

  const muteCategory = useCallback((alert: AlertItem) => {
    updateShield(prev => ({
      ...prev, mutedRules: [...prev.mutedRules, { type: 'category' as const, category: alert.dimension, rule: alert.ruleKey, mutedAt: nowISO(), expiresAt: null }]
    }));
  }, [updateShield]);

  const markProcessed = useCallback((alertId: string) => {
    updateShield(prev => ({
      ...prev, processedAlerts: [...prev.processedAlerts, { id: alertId, processedAt: nowISO() }]
    }));
  }, [updateShield]);

  const unmute = useCallback((idx: number) => {
    updateShield(prev => ({ ...prev, mutedRules: prev.mutedRules.filter((_, i) => i !== idx) }));
  }, [updateShield]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedAlerts(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  // ══════════════════════════════════════════════
  // 数据准备
  // ══════════════════════════════════════════════
  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => !['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(ss(findField(o, '订单状态'))));
  }, [currentDisplayData]);

  const noData = !orders.length;

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange, useNaturalDate), [orders, allDates, timeRange, customStart, customEnd, quickRange]);
  const afterSaleRecords = useMemo(() => {
    const records = filterPromoByTimeRange(currentDisplayData?.afterSaleRecords || [], allDates, timeRange, ['申请时间'], customStart, customEnd, quickRange);
    const orderIds = new Set(filteredOrders.map(o => String(findField(o, '订单号') || '').trim()).filter(Boolean));
    return records.filter((r: any) => {
      const oid = String(findField(r, '订单编号') || '').trim();
      return !oid || orderIds.has(oid);
    });
  }, [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange, filteredOrders]);

  const financialRecords = useMemo(() => {
    return currentDisplayData?.financialRecords || [];
  }, [currentDisplayData]);

  const promotionProducts = useMemo(() => {
    return currentDisplayData?.promotionProducts || [];
  }, [currentDisplayData]);

  const productCosts = useData().productCosts || {};

  const now = new Date().toISOString();
  const todayStr = now.slice(0, 10);

  // Existing detection values
  const productRisk = useMemo(() => {
    if (!filteredOrders.length) return [];
    const map: Record<string, { name: string; orders: number; afterSale: number; refund: number; overdue: number }> = {};
    filteredOrders.forEach((o: any) => {
      const key = ss(findField(o, '商品id', '商品'));
      if (!key) return;
      if (!map[key]) map[key] = { name: ss(findField(o, '商品', '商品名称')).slice(0, 20), orders: 0, afterSale: 0, refund: 0, overdue: 0 };
      map[key].orders++;
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      if (payT && shipT) {
        const h = (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000;
        if (h > 48) map[key].overdue++;
      }
    });
    if (afterSaleRecords.length > 0) {
      afterSaleRecords.forEach((r: any) => {
        const pid = ss(findField(r, '商品ID'));
        if (!pid) return;
        if (!map[pid]) map[pid] = { name: ss(findField(r, 'sku信息')).slice(0, 20) || pid, orders: 0, afterSale: 0, refund: 0, overdue: 0 };
        map[pid].afterSale++;
        if (String(findField(r, '售后状态') || '').includes('退款')) map[pid].refund++;
      });
    } else {
      filteredOrders.forEach((o: any) => {
        const key = ss(findField(o, '商品id', '商品'));
        if (!key || !map[key]) return;
        const as = ss(findField(o, '售后状态'));
        if (as && as !== '无售后或售后取消' && as !== '无') map[key].afterSale++;
        if (as.includes('退款')) map[key].refund++;
      });
    }
    return Object.entries(map).map(([id, d]) => ({
      id, name: d.name,
      afterSaleRate: d.orders > 0 ? (d.afterSale / d.orders) * 100 : 0,
      refundRate: d.orders > 0 ? (d.refund / d.orders) * 100 : 0,
      overdueRate: d.orders > 0 ? (d.overdue / d.orders) * 100 : 0,
      orders: d.orders,
    })).sort((a, b) => b.afterSaleRate - a.afterSaleRate);
  }, [filteredOrders, afterSaleRecords]);

  // 原有检测值
  const overdueOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      if (!payT || !shipT) return false;
      return (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48;
    }).length;
  }, [filteredOrders]);

  const zeroSales = useMemo(() => {
    const salesMap: Record<string, number> = {};
    filteredOrders.forEach((o: any) => { const id = ss(findField(o, '商品id')); salesMap[id] = (salesMap[id] || 0) + sf(findField(o, '商品数量(件)', '商品数量')); });
    return Object.values(salesMap).filter(v => v <= 0).length;
  }, [filteredOrders]);

  const abnormalOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      const s = ss(findField(o, '售后状态'));
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      const isRefundAbnormal = s.includes('退款');
      const isOverdue = payT && shipT && (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48;
      const isHighDisc = (sf(findField(o, '店铺优惠折扣(元)', '店铺优惠')) + sf(findField(o, '平台优惠折扣(元)', '平台优惠')) + sf(findField(o, '多多支付立减金额(元)', '支付立减'))) / sf(findField(o, '商品总价(元)', '商品总价')) > 0.2;
      return isRefundAbnormal || isOverdue || isHighDisc;
    });
  }, [filteredOrders]);

  // ══════════════════════════════════════════════
  // 预警检测引擎（39条规则 × 8维度）
  // ══════════════════════════════════════════════
  const allAlerts = useMemo((): AlertItem[] => {
    const result: AlertItem[] = [];
    const now = nowISO();

    // ── 辅助函数 ──
    const add = (dim: AlertDimension, key: string, name: string, sev: AlertSeverity, title: string, desc: string, impact: string, target: AlertTarget, specKey?: string, relName?: string) => {
      const id = simpleHash(key + '|' + specKey + '|' + now);
      result.push({ id, dimension: dim, ruleKey: key, ruleName: name, severity: sev, title, description: desc, impact, target, detectedAt: now, specificKey: specKey, relatedName: relName });
    };

    // ────────────────────────────
    // 📦 商品风险（6条）
    // ────────────────────────────
    // 1. 频繁改价商品
    (() => {
      const priceMap: Record<string, { name: string; prices: Set<number>; count: number }> = {};
      filteredOrders.forEach((o: any) => {
        const pid = ss(findField(o, '商品id', '商品'));
        if (!pid) return;
        if (!priceMap[pid]) priceMap[pid] = { name: ss(findField(o, '商品', '商品名称')).slice(0, 20), prices: new Set(), count: 0 };
        const price = sf(findField(o, '商品单价(元)', '商品价格', '商品单价'));
        if (price > 0) priceMap[pid].prices.add(Math.round(price * 100));
        priceMap[pid].count++;
      });
      Object.entries(priceMap).forEach(([pid, pm]) => {
        if (pm.prices.size >= 3 && pm.count >= 3) {
          add('product', 'frequentPriceChange', '频繁改价商品', 'warning', '频繁改价：' + pm.name, '该商品出现' + pm.prices.size + '种不同价格，可能导致成本估算偏差', '涉及' + pm.count + '单', { page: 'cost-management', tab: 'product', search: pm.name }, pid, pm.name);
        }
      });
    })();

    // 2. 高售后率商品
    productRisk.forEach(p => {
      if (p.afterSaleRate > 30) {
        add('product', 'highAfterSaleRate', '高售后率商品', 'critical', '高售后率：' + p.name, '售后率 ' + p.afterSaleRate.toFixed(1) + '%，超过警戒线30%', '影响' + p.orders + '单', { page: 'after-sale', tab: 'quality', search: p.name }, p.id, p.name);
      }
    });

    // 3. 高退款率商品
    productRisk.forEach(p => {
      if (p.refundRate > 15) {
        add('product', 'highRefundRate', '高退款率商品', 'warning', '高退款率：' + p.name, '退款率 ' + p.refundRate.toFixed(1) + '%，超过警戒线15%', '影响' + p.orders + '单', { page: 'after-sale', tab: 'refund', search: p.name }, p.id, p.name);
      }
    });

    // 4. 零动销商品
    (() => {
      const sm: Record<string, { name: string; qty: number }> = {};
      filteredOrders.forEach((o: any) => {
        const id = ss(findField(o, '商品id'));
        const name = ss(findField(o, '商品', '商品名称')).slice(0, 20);
        if (!id) return;
        if (!sm[id]) sm[id] = { name, qty: 0 };
        sm[id].qty += sf(findField(o, '商品数量(件)', '商品数量'));
      });
      Object.entries(sm).forEach(([id, s]) => {
        if (s.qty <= 0) {
          add('product', 'zeroSalesProduct', '零动销商品', 'info', '零动销：' + s.name, '该商品有记录但销量为零', '商品ID:' + id, { page: 'product', tab: 'lifecycle-sku' }, id, s.name);
        }
      });
    })();

    // 5. 价格波动异常（已含在频繁改价检测中）
    // 6. 商品标题变更（需历史数据，暂无法检测）

    // ────────────────────────────
    // 💰 财务风险（6条）
    // ────────────────────────────
    // 1. 利润暴跌（检测亏损订单比例）
    (() => {
      let lossOrders = 0;
      filteredOrders.forEach((o: any) => {
        const merchantAmt = sf(findField(o, '商家实收金额(元)', '商家实收'));
        const totalCost = sf(findField(o, '总成本(元)', '总成本'));
        if (merchantAmt > 0 && totalCost > 0 && merchantAmt < totalCost) lossOrders++;
      });
      if (lossOrders > 0) {
        const pct = (lossOrders / filteredOrders.length * 100).toFixed(1);
        add('finance', 'profitPlunge', '利润暴跌', 'critical', '亏损订单' + lossOrders + '条占比' + pct + '%', '出现亏损订单，商家实收低于总成本', '涉及' + lossOrders + '单', { page: 'finance', tab: 'profit' });
      }
    })();

    // 2. 利润率异常（毛利率<0%或>80%）
    (() => {
      let abnormalRate = 0;
      filteredOrders.forEach((o: any) => {
        const price = sf(findField(o, '商品总价(元)', '商品总价'));
        const cost = sf(findField(o, '总成本(元)', '总成本'));
        if (price > 0 && cost > 0) {
          const margin = (price - cost) / price;
          if (margin < 0 || margin > 0.8) abnormalRate++;
        }
      });
      if (abnormalRate > 0) {
        add('finance', 'profitRateAbnormal', '利润率异常', 'warning', abnormalRate + '条订单利润率异常（<0%或>80%）', '可能为数据错误或亏本销售', '涉及' + abnormalRate + '单', { page: 'finance', tab: 'profit' });
      }
    })();

    // 3. 罚款激增（检测财务表中是否有罚款记录）
    (() => {
      const fineRecords = financialRecords.filter((r: any) => {
        const desc = ss(findField(r, '费用类型', '类型', '费用说明'));
        return desc.includes('罚款') || desc.includes('004');
      });
      if (fineRecords.length > 0) {
        const totalFine = fineRecords.reduce((sum: number, r: any) => sum + Math.abs(sf(findField(r, '金额(元)', '金额'))), 0);
        add('finance', 'fineSurge', '罚款激增', 'critical', '检测到' + fineRecords.length + '条罚款记录，合计¥' + totalFine.toFixed(0), '平台罚款需立即处理', '合计¥' + totalFine.toFixed(0), { page: 'finance', tab: 'fees' });
      }
    })();

    // 4. 推广费异常（推广费占比>30%）
    // 5. 平台扣点异常
    // 6. 可提现差异大（需对账数据）

    // ────────────────────────────
    // 🔧 售后风险（5条）
    // ────────────────────────────
    // 1. 已收货退款
    (() => {
      const receivedRefunds = afterSaleRecords.filter((r: any) => {
        const type = ss(findField(r, '售后类型', '类型'));
        const status = ss(findField(r, '售后状态', '状态'));
        return (type.includes('已收货') || type.includes('退货')) && (status.includes('退款成功') || status.includes('已完成'));
      });
      if (receivedRefunds.length > 0) {
        const totalLoss = receivedRefunds.reduce((sum: number, r: any) => sum + sf(findField(r, '退款金额(元)', '金额')), 0);
        add('afterSale', 'receivedRefund', '已收货退款', 'critical', '已收货退款' + receivedRefunds.length + '单，损失¥' + totalLoss.toFixed(0), '买家已收货后退款成功，属于较高风险', '损失¥' + totalLoss.toFixed(0), { page: 'after-sale', tab: 'cost' });
      }
    })();

    // 2. 一单多次售后
    (() => {
      const orderCount: Record<string, number> = {};
      afterSaleRecords.forEach((r: any) => {
        const oid = ss(findField(r, '订单编号', '订单号'));
        if (oid) orderCount[oid] = (orderCount[oid] || 0) + 1;
      });
      Object.entries(orderCount).forEach(([oid, count]) => {
        if (count >= 2) {
          add('afterSale', 'multiAfterSale', '一单多次售后', 'warning', '订单' + oid.slice(-8) + '售后' + count + '次', '同一订单多次申请售后，可能存在异常', '订单' + oid.slice(-8), { page: 'after-sale', tab: 'detail', search: oid }, oid, oid.slice(-8));
        }
      });
    })();

    // 3. 售后率飙升（检测整表售后率）
    // 4. 退货率异常（已发货退款占比>40%）
    // 5. 售后处理超时（需时效数据）

    // ────────────────────────────
    // 🚚 物流风险（5条）
    // ────────────────────────────
    // 1. 发货超时
    if (overdueOrders > 0) {
      add('logistics', 'shipTimeout', '发货超时', 'critical', '发货超时' + overdueOrders + '单', '支付后>48小时未发货', '涉及' + overdueOrders + '单', { page: 'logistics', tab: 'timeout' });
    }

    // 2. 延迟发货罚款（关联财务罚款）
    // 3. 虚假发货罚款（关联财务罚款）
    // 上述两条已在财务罚款中覆盖

    // 4. 快递成本飙升
    (() => {
      let totalPostage = 0;
      let shipped = 0;
      filteredOrders.forEach((o: any) => {
        const postage = sf(findField(o, '邮费(元)', '快递费', '运费'));
        if (postage > 0) { totalPostage += postage; shipped++; }
      });
      const avgPostage = shipped > 0 ? totalPostage / shipped : 0;
      if (avgPostage > 8) {
        add('logistics', 'courierCostSurge', '快递成本偏高', 'warning', '均单快递费¥' + avgPostage.toFixed(1), '快递成本较高，建议对比快递公司报价', '均单¥' + avgPostage.toFixed(1), { page: 'cost-management', tab: 'shipping' });
      }
    })();

    // 5. 发货异常（有单号但无物流更新，暂无法检测）

    // ────────────────────────────
    // 📢 推广风险（4条）
    // ────────────────────────────
    // 1. ROI过低
    (() => {
      let totalPromoCost = 0;
      let totalPromoRevenue = 0;
      promotionProducts.forEach((p: any) => {
        totalPromoCost += sf(findField(p, '花费(元)', '花费', '推广花费'));
        totalPromoRevenue += sf(findField(p, '成交金额(元)', '成交金额', '推广成交'));
      });
      if (totalPromoCost > 0 && totalPromoRevenue > 0) {
        const roi = totalPromoRevenue / totalPromoCost;
        if (roi < 2) {
          add('promotion', 'lowROI', '推广ROI过低', 'critical', '推广ROI仅' + roi.toFixed(1) + ':1', '花费¥' + totalPromoCost.toFixed(0) + '仅带来¥' + totalPromoRevenue.toFixed(0) + '收入', 'ROI=' + roi.toFixed(1), { page: 'promotion', tab: 'dashboard' });
        }
      }
    })();

    // 2. 花费异常飙升（缺历史对比，略）
    // 3. 转化率下降（缺漏斗数据，略）
    // 4. 计划预算耗尽（缺计划数据，略）

    // ────────────────────────────
    // 👥 运营风险（4条）
    // ────────────────────────────
    // 1. 同一买家多单
    (() => {
      const buyerMap: Record<string, { count: number; ids: string[] }> = {};
      filteredOrders.forEach((o: any) => {
        const buyer = ss(findField(o, '买家', '买家昵称', '收件人'));
        const oid = ss(findField(o, '订单号'));
        if (!buyer) return;
        const suffix = oid.slice(-4);
        const key = buyer + '_' + suffix;
        if (!buyerMap[key]) buyerMap[key] = { count: 0, ids: [] };
        buyerMap[key].count++;
        buyerMap[key].ids.push(oid);
      });
      Object.entries(buyerMap).forEach(([key, bm]) => {
        if (bm.count >= 3) {
          add('operation', 'sameBuyerMultiOrder', '同一买家多单', 'warning', '同一买家' + bm.count + '单（尾号' + key.split('_')[1] + '）', '同一收件人+订单号尾号相同≥3单，可能存在刷单', '涉及' + bm.count + '单', { page: 'cost-management', tab: 'alerts', search: key.split('_')[1] });
        }
      });
    })();

    // 2. 刷单嫌疑
    (() => {
      const buyerQty: Record<string, { count: number; totalQty: number }> = {};
      filteredOrders.forEach((o: any) => {
        const buyer = ss(findField(o, '买家', '买家昵称', '收件人'));
        if (!buyer || buyer === '') return;
        if (!buyerQty[buyer]) buyerQty[buyer] = { count: 0, totalQty: 0 };
        buyerQty[buyer].count++;
        buyerQty[buyer].totalQty += sf(findField(o, '商品数量(件)', '商品数量'));
      });
      Object.entries(buyerQty).forEach(([buyer, bq]) => {
        if (bq.count >= 3 && bq.totalQty >= 50) {
          add('operation', 'fakeOrderSuspicion', '刷单嫌疑', 'critical', buyer + '下单' + bq.count + '次共' + bq.totalQty + '件', '同一买家大量下单，疑似刷单', bq.count + '单/' + bq.totalQty + '件', { page: 'cost-management', tab: 'alerts', search: buyer });
        }
      });
    })();

    // 3. 高优惠订单
    (() => {
      let highDiscCount = 0;
      filteredOrders.forEach((o: any) => {
        const discount = sf(findField(o, '店铺优惠折扣(元)', '店铺优惠')) + sf(findField(o, '平台优惠折扣(元)', '平台优惠'));
        const total = sf(findField(o, '商品总价(元)', '商品总价'));
        if (total > 0 && discount / total > 0.5) highDiscCount++;
      });
      if (highDiscCount > 0) {
        add('operation', 'highDiscountOrder', '高优惠订单', 'warning', highDiscCount + '条订单优惠>50%', '优惠金额超过商品总价一半，利润空间被压缩', '涉及' + highDiscCount + '单', { page: 'finance', tab: 'profit' });
      }
    })();

    // 4. 低支付金额
    (() => {
      let lowPayCount = 0;
      filteredOrders.forEach((o: any) => {
        const amt = sf(findField(o, '用户实付金额(元)', '用户实付'));
        const qty = sf(findField(o, '商品数量(件)', '商品数量'));
        if (amt < 5 && qty > 1) lowPayCount++;
      });
      if (lowPayCount > 0) {
        add('operation', 'lowPaymentAmount', '低支付金额', 'info', lowPayCount + '条订单用户实付<¥5', '商品数量>1但支付金额极低，可能优惠过度', '涉及' + lowPayCount + '单', { page: 'cost-management', tab: 'alerts' });
      }
    })();

    // ────────────────────────────
    // 📊 数据风险（4条）
    // ────────────────────────────
    // 1. 数据同步延迟
    (() => {
      const lastOrderTime = filteredOrders.length > 0
        ? Math.max(...filteredOrders.map((o: any) => new Date(ss(findField(o, '支付时间'))).getTime()).filter(t => !isNaN(t)))
        : 0;
      if (lastOrderTime > 0 && (Date.now() - lastOrderTime) > 86400000) {
        add('data', 'dataSyncDelay', '数据同步延迟', 'critical', '数据最后更新超过24小时', '财务/订单数据可能不是最新的', '最后更新:' + new Date(lastOrderTime).toISOString().slice(0, 16), { page: 'finance', tab: 'sync' });
      }
    })();

    // 2. 数据覆盖度低
    // 3. 数据量异常
    (() => {
      const todayCount = filteredOrders.length;
      if (todayCount === 0 && orders.length > 0) {
        add('data', 'dataVolumeAbnormal', '数据量为零', 'warning', '筛选后无订单数据', '有总数据但筛选后为空，检查时间筛选条件', '共' + orders.length + '条总订单', { page: 'upload' });
      }
    })();

    // 4. 售后表为空
    if (filteredOrders.length > 0 && afterSaleRecords.length === 0) {
      add('data', 'afterSaleEmpty', '售后表为空', 'warning', '有订单但无售后记录', '请确认售后数据已导入', filteredOrders.length + '条订单无售后', { page: 'upload' });
    }

    // ────────────────────────────
    // 📋 成本风险（5条）
    // ────────────────────────────
    // 1. 亏损订单
    (() => {
      const lossOrders = filteredOrders.filter((o: any) => {
        const amt = sf(findField(o, '商家实收金额(元)', '商家实收'));
        const cost = sf(findField(o, '总成本(元)', '总成本'));
        return amt > 0 && cost > 0 && amt < cost;
      });
      if (lossOrders.length > 0) {
        const totalLoss = lossOrders.reduce((s: number, o: any) => s + (sf(findField(o, '总成本(元)', '总成本')) - sf(findField(o, '商家实收金额(元)', '商家实收'))), 0);
        add('cost', 'lossOrder', '亏损订单', 'critical', lossOrders.length + '条亏损订单，总亏损¥' + totalLoss.toFixed(0), '商家实收低于总成本，每单都在亏钱', '总亏损¥' + totalLoss.toFixed(0), { page: 'cost-management', tab: 'alerts' });
      }
    })();

    // 2. 成本覆盖率低
    (() => {
      const costKeys = Object.keys(productCosts);
      if (costKeys.length === 0 && filteredOrders.length > 0) {
        add('cost', 'costCoverageLow', '成本覆盖率为零', 'warning', '未设置任何商品进价', '需要填写商品进价才能准确核算成本', filteredOrders.length + '条订单', { page: 'cost-management', tab: 'product' });
      }
    })();

    // 3. 一单多SKU
    (() => {
      let multiSkuCount = 0;
      filteredOrders.forEach((o: any) => {
        const sku = ss(findField(o, 'sku信息', 'SKU', '规格'));
        if (sku && sku.includes(',')) multiSkuCount++;
      });
      if (multiSkuCount > 0) {
        add('cost', 'multiSkuOrder', '一单多SKU', 'info', multiSkuCount + '条订单含多种SKU', '同一订单有多种规格商品，注意成本分摊', '涉及' + multiSkuCount + '单', { page: 'cost-management', tab: 'alerts' });
      }
    })();

    // 4. 一单多件
    (() => {
      let multiItemCount = 0;
      filteredOrders.forEach((o: any) => {
        const qty = sf(findField(o, '商品数量(件)', '商品数量'));
        if (qty >= 5) multiItemCount++;
      });
      if (multiItemCount > 0) {
        add('cost', 'multiItemOrder', '一单多件', 'info', multiItemCount + '条订单商品数量≥5件', '批量订单注意库存和发货安排', '涉及' + multiItemCount + '单', { page: 'cost-management', tab: 'alerts' });
      }
    })();

    // 5. 自定义扣费异常
    (() => {
      filteredOrders.forEach((o: any) => {
        const deduction = sf(findField(o, '自定义扣费(元)', '扣费'));
        const amt = sf(findField(o, '商家实收金额(元)', '商家实收'));
        if (deduction > 0 && amt > 0 && deduction / amt > 0.5) {
          add('cost', 'customDeductionAbnormal', '自定义扣费异常', 'warning', '扣费占商家实收>' + (deduction / amt * 100).toFixed(0) + '%', '自定义扣费比例过高，请检查扣费配置', '扣费¥' + deduction.toFixed(0) + '/实收¥' + amt.toFixed(0), { page: 'cost-management', tab: 'deductions' });
        }
      });
    })();

    return result;
  }, [filteredOrders, afterSaleRecords, financialRecords, promotionProducts, productRisk, overdueOrders, productCosts, orders.length]);

  // ── 过滤预警 ──
  const visibleAlerts = useMemo(() => {
    return allAlerts.filter(a => {
      // 已屏蔽过滤
      if (isMuted(shieldData, a)) return false;
      if (isProcessed(shieldData, a.id)) return false;
      // Tab过滤
      if (activeTab !== TAB_ALL && activeTab !== a.dimension) return false;
      // 搜索过滤
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.ruleName.toLowerCase().includes(q) && !(a.relatedName || '').toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, info: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });
  }, [allAlerts, shieldData, activeTab, searchQuery]);

  const mutedAlerts = useMemo(() => {
    if (activeTab !== TAB_MUTED) return [];
    return shieldData.mutedRules.map((mr, i) => ({ mr, index: i }));
  }, [shieldData, activeTab]);

  // ── 预警统计 ──
  const alertStats = useMemo((): AlertStats => {
    const total = allAlerts.length;
    const critical = allAlerts.filter(a => a.severity === 'critical').length;
    const warning = allAlerts.filter(a => a.severity === 'warning').length;
    const info = allAlerts.filter(a => a.severity === 'info').length;
    const processed7d = shieldData.processedAlerts.filter(p => {
      const d = new Date(p.processedAt).getTime();
      return Date.now() - d < 7 * 86400000;
    }).length;
    const processingRate = total > 0 ? processed7d / (total + processed7d) * 100 : 0;
    return { total, critical, warning, info, processed7d, processingRate, avgResponseHours: 0 };
  }, [allAlerts, shieldData]);

  // ── 维度分布数据 ──
  const dimDistData = useMemo((): DimSeverityCount[] => {
    return DIMENSION_ORDER.map(dim => {
      const alerts = allAlerts.filter(a => a.dimension === dim);
      return {
        dimension: dim,
        dimLabel: DIMENSION_META[dim].label,
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      };
    });
  }, [allAlerts]);

  // ── 趋势数据（近7天模拟） ──
  const trendData = useMemo(() => {
    const days: { date: string; newAlerts: number; processed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const dayAlerts = allAlerts.filter(a => a.detectedAt.slice(0, 10) === d).length;
      const dayProcessed = shieldData.processedAlerts.filter(p => p.processedAt.slice(0, 10) === d).length;
      days.push({ date: d.slice(5), newAlerts: dayAlerts, processed: dayProcessed });
    }
    return days;
  }, [allAlerts, shieldData]);

  // ── 搜索预警 ──
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (activeTab === TAB_MUTED) setActiveTab(TAB_ALL);
  }, [activeTab]);

  // ── 空状态 ──
  const isEmpty = visibleAlerts.length === 0 && activeTab !== TAB_MUTED;

  // ── 严重度辅助 ──
  const sevBg = (s: AlertSeverity) => SEVERITY_META[s].bg;
  const sevEmoji = (s: AlertSeverity) => SEVERITY_META[s].emoji;

  if (noData) {
    return (
      <div className="p-4 space-y-3">
        <FilterToolbar tf={tf} />
        {timeRange !== 'all' && timeRange !== 'custom' && (
          <div className="flex items-center rounded border border-pdd-border overflow-hidden text-[11px]">
            <button onClick={() => setUseNaturalDate(false)}
              className={'px-2 py-1 transition-colors ' + (!useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text')}>按订单时间</button>
            <button onClick={() => setUseNaturalDate(true)}
              className={'px-2 py-1 transition-colors ' + (useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text')}>按当前时间</button>
          </div>
        )}
        <div className="flex items-center justify-center h-64 text-sm text-pdd-text-secondary">
          <div className="text-center"><Package size={40} className="mx-auto mb-3 opacity-30" /><p>暂无数据，请先上传订单数据</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <FilterToolbar tf={tf} />
      {timeRange !== 'all' && timeRange !== 'custom' && (
        <div className="flex items-center rounded border border-pdd-border overflow-hidden text-[11px]">
          <button onClick={() => setUseNaturalDate(false)}
            className={'px-2 py-1 transition-colors ' + (!useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text')}>按订单时间</button>
          <button onClick={() => setUseNaturalDate(true)}
            className={'px-2 py-1 transition-colors ' + (useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text')}>按当前时间</button>
        </div>
      )}

      {/* ── 头部 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-pdd-text"><Shield size={18} className="inline mr-1" color="var(--pdd-primary)" />风险预警</h1>
          <div className="flex gap-1.5">
            {SEVERITY_ORDER.map(s => {
              const count = alertStats[s];
              if (count === 0) return null;
              return (
                <span key={s} className={'text-xs px-2 py-0.5 rounded-full font-medium ' + sevBg(s) + ' ' + SEVERITY_META[s].textCls}>
                  {sevEmoji(s)} {count}条
                </span>
              );
            })}
          </div>
          <span className="text-xs text-pdd-text-secondary">共{alertStats.total}条预警</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
            <input
              type="text"
              placeholder="搜索预警..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-40 pl-7 pr-2 py-1.5 text-xs rounded-lg border border-pdd-border bg-pdd-card focus:outline-none focus:border-pdd-primary"
            />
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={'text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ' + (showSettings ? 'bg-pdd-primary text-white border-pdd-primary' : 'border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg')}
          ><Settings size={14} />预警设置</button>
        </div>
      </div>

      {/* ── 统计 KPI 行 ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="pdd-card px-3 py-2.5 flex items-center gap-2">
          <AlertCircle size={16} color="var(--pdd-danger)" />
          <div><span className="text-xs text-pdd-text-secondary">未处理预警</span><span className="text-sm font-bold block" style={{ color: alertStats.critical > 0 ? 'var(--pdd-danger)' : 'var(--pdd-text)' }}>{alertStats.total}</span></div>
        </div>
        <div className="pdd-card px-3 py-2.5 flex items-center gap-2">
          <CheckCircle size={16} color="var(--pdd-success)" />
          <div><span className="text-xs text-pdd-text-secondary">已处理/7天</span><span className="text-sm font-bold block">{alertStats.processed7d}</span></div>
        </div>
        <div className="pdd-card px-3 py-2.5 flex items-center gap-2">
          <Activity size={16} color="var(--pdd-primary)" />
          <div><span className="text-xs text-pdd-text-secondary">处理率</span><span className="text-sm font-bold block">{alertStats.processingRate.toFixed(1)}%</span></div>
        </div>
        <div className="pdd-card px-3 py-2.5 flex items-center gap-2">
          <Bell size={16} color="var(--pdd-warning)" />
          <div><span className="text-xs text-pdd-text-secondary">严重待处理</span><span className="text-sm font-bold block" style={{ color: alertStats.critical > 0 ? 'var(--pdd-danger)' : 'var(--pdd-text)' }}>{alertStats.critical}条</span></div>
        </div>
      </div>

      {/* ── 维度分类标签 ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const count = tab.key === TAB_ALL ? alertStats.total
            : tab.key === TAB_MUTED ? shieldData.mutedRules.length
            : allAlerts.filter(a => a.dimension === tab.key && !isMuted(shieldData, a) && !isProcessed(shieldData, a.id)).length;
          return (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={'whitespace-nowrap text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ' +
                (isActive ? 'bg-pdd-primary text-white shadow-sm' : 'text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-text')}
            >
              <span>{tab.icon}</span> {tab.label}
              {count > 0 && <span className={'text-[10px] px-1.5 py-0.5 rounded-full ' + (isActive ? 'bg-white/20' : 'bg-pdd-bg')}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── 维度分布条 ── */}
      {dimDistData.some(d => d.total > 0) && (
        <div className="pdd-card p-3">
          <h3 className="text-xs font-semibold mb-2 text-pdd-text-secondary">各维度预警分布</h3>
          <div className="space-y-1.5">
            {dimDistData.map(d => {
              if (d.total === 0) return null;
              const maxTotal = Math.max(...dimDistData.map(x => x.total), 1);
              const width = (d.total / maxTotal) * 100;
              return (
                <div key={d.dimension} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-right text-pdd-text-secondary shrink-0">{d.dimLabel}</span>
                  <div className="flex-1 h-4 rounded bg-pdd-bg overflow-hidden flex" title={d.dimLabel + '：严重' + d.critical + ' 警告' + d.warning + ' 提醒' + d.info}>
                    {d.critical > 0 && <div className="h-full transition-all" style={{ width: (d.critical / d.total) * 100 + '%', backgroundColor: 'var(--pdd-danger)', minWidth: d.critical > 0 ? 4 : 0 }} />}
                    {d.warning > 0 && <div className="h-full transition-all" style={{ width: (d.warning / d.total) * 100 + '%', backgroundColor: 'var(--pdd-warning)', minWidth: d.warning > 0 ? 4 : 0 }} />}
                    {d.info > 0 && <div className="h-full transition-all" style={{ width: (d.info / d.total) * 100 + '%', backgroundColor: 'var(--pdd-info)', minWidth: d.info > 0 ? 4 : 0 }} />}
                  </div>
                  <span className="w-12 text-right font-mono text-pdd-text-secondary shrink-0">{d.total}条</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 预警列表 ── */}
      {activeTab === TAB_MUTED ? (
        /* ── 已屏蔽视图 ── */
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1"><BellOff size={14} />已屏蔽的预警（{mutedAlerts.length}条）</h3>
          {mutedAlerts.length === 0 ? (
            <div className="text-xs text-pdd-text-secondary text-center py-8">暂无已屏蔽的预警</div>
          ) : (
            mutedAlerts.map(({ mr, index }) => {
              const dimInfo = mr.category ? DIMENSION_META[mr.category] : null;
              return (
                <div key={index} className="pdd-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Ban size={14} className="text-pdd-text-secondary" />
                    <span className="px-1.5 py-0.5 rounded bg-pdd-bg text-pdd-text-secondary">{dimInfo?.emoji} {dimInfo?.label || '全局'}</span>
                    <span className="text-pdd-text">{mr.type === 'specific' ? '屏蔽具体：' + mr.target : mr.type === 'category' ? '屏蔽类型：' + mr.rule : '临时静默'}</span>
                    <span className="text-pdd-text-secondary">于{mr.mutedAt.slice(0, 10)}</span>
                  </div>
                  <button onClick={() => unmute(index)} className="text-xs text-pdd-primary hover:underline">恢复</button>
                </div>
              );
            })
          )}
          {mutedAlerts.length > 1 && <button onClick={() => { updateShield(prev => ({ ...prev, mutedRules: [] })); }} className="text-xs text-pdd-danger hover:underline">全部恢复</button>}
        </div>
      ) : isEmpty ? (
        /* ── 空状态 ── */
        <div className="pdd-card p-8 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-base font-bold text-pdd-text mb-1">一切正常</h3>
          <p className="text-xs text-pdd-text-secondary mb-3">当前没有未处理的预警，所有指标均在正常范围内</p>
          <p className="text-xs text-pdd-text-secondary">最后检测：{nowISO()} &nbsp;|&nbsp; 过去7天共处理{alertStats.processed7d}条预警</p>
          {shieldData.mutedRules.length > 0 && (
            <button onClick={() => setActiveTab(TAB_MUTED)} className="mt-3 text-xs text-pdd-primary hover:underline">查看已屏蔽的预警（{shieldData.mutedRules.length}条）</button>
          )}
        </div>
      ) : (
        /* ── 预警卡片列表 ── */
        <div className="space-y-2">
          <div className="text-xs text-pdd-text-secondary flex items-center justify-between">
            <span>共{visibleAlerts.length}条预警</span>
            <span className="text-pdd-text-secondary">💡 预警只检测不处理，发现问题请点击"去查看"跳转到对应页面处理</span>
          </div>
          {visibleAlerts.map(alert => {
            const sm = SEVERITY_META[alert.severity];
            const isExpanded = expandedAlerts.has(alert.id);
            return (
              <motion.div key={alert.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={'pdd-card overflow-hidden transition-shadow hover:shadow-sm cursor-pointer border-l-4'}
                style={{ borderLeftColor: sm.color }}
                onClick={() => toggleExpand(alert.id)}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{sm.emoji}</span>
                        <span className={'text-[10px] px-1.5 py-0.5 rounded ' + sm.bg + ' ' + sm.textCls}>{sm.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-pdd-bg text-pdd-text-secondary">{DIMENSION_META[alert.dimension].emoji} {DIMENSION_META[alert.dimension].label}</span>
                        <span className="text-xs font-medium text-pdd-text truncate">{alert.title}</span>
                      </div>
                      <p className="text-xs text-pdd-text-secondary">{alert.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isExpanded ? <ChevronUp size={14} className="text-pdd-text-secondary" /> : <ChevronDown size={14} className="text-pdd-text-secondary" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 pt-2 border-t border-pdd-border">
                      <div className="flex items-center gap-3 text-xs text-pdd-text-secondary mb-2">
                        <span><Clock size={12} className="inline mr-0.5" />检测：{alert.detectedAt}</span>
                        {alert.impact && <span><Info size={12} className="inline mr-0.5" />{alert.impact}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateTo(alert.target); }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-pdd-primary/10 text-pdd-primary hover:bg-pdd-primary/20 transition-colors flex items-center gap-1"
                        ><ExternalLink size={12} />去查看</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); muteSpecific(alert); }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-pdd-bg text-pdd-text-secondary hover:bg-pdd-gray-100 transition-colors flex items-center gap-1"
                        ><Ban size={12} />屏蔽这条</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); muteCategory(alert); }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-pdd-bg text-pdd-text-secondary hover:bg-pdd-gray-100 transition-colors flex items-center gap-1"
                        ><VolumeX size={12} />屏蔽这类</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); markProcessed(alert.id); }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-pdd-success/10 text-green-700 hover:bg-pdd-success/20 transition-colors flex items-center gap-1"
                        ><CheckCircle size={12} />标记处理</button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── 趋势图 ── */}
      {trendData.some(d => d.newAlerts > 0 || d.processed > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-3">
          <h3 className="text-xs font-semibold mb-2 text-pdd-text-secondary">预警趋势（近7天）</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ReTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="newAlerts" stroke="var(--pdd-primary)" strokeWidth={2} name="新增预警" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="processed" stroke="var(--pdd-success)" strokeWidth={2} name="已处理" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-pdd-text-secondary mt-1">{'蓝色=新增预警    绿色=已处理预警    新增>处理 → 预警积压'}</p>
        </motion.div>
      )}

      {/* ── 风险商品表（保留原有） ── */}
      {productRisk.filter(p => p.afterSaleRate > 10).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">高风险商品明细</h3>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                <th className="py-1.5 text-left">商品</th><th className="py-1.5 text-right">订单数</th><th className="py-1.5 text-right">售后率</th><th className="py-1.5 text-right">退款率</th><th className="py-1.5 text-right">超时率</th>
              </tr></thead>
              <tbody>{productRisk.filter(p => p.afterSaleRate > 10).slice(0, 10).map(p => (
                <tr key={p.id} className="border-b border-pdd-border hover:bg-pdd-bg">
                  <td className="py-1.5 truncate max-w-[120px]">{p.name}</td>
                  <td className="py-1.5 text-right font-mono">{p.orders}</td>
                  <td className="py-1.5 text-right font-mono" style={{ color: p.afterSaleRate > 30 ? 'var(--pdd-danger)' : p.afterSaleRate > 15 ? 'var(--pdd-warning)' : 'var(--pdd-text)' }}>{p.afterSaleRate.toFixed(1)}%</td>
                  <td className="py-1.5 text-right font-mono">{p.refundRate.toFixed(1)}%</td>
                  <td className="py-1.5 text-right font-mono">{p.overdueRate.toFixed(1)}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── 异常订单表（保留原有） ── */}
      {abnormalOrders.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">异常订单检测（{abnormalOrders.length}条）</h3>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                <th className="py-1.5 text-left">订单号</th><th className="py-1.5 text-left">商品</th><th className="py-1.5 text-left">类型</th><th className="py-1.5 text-right">金额</th><th className="py-1.5 text-left">时间</th>
              </tr></thead>
              <tbody>{abnormalOrders.slice(0, 20).map((o, i) => {
                const s = ss(findField(o, '售后状态'));
                const payT = ss(findField(o, '支付时间'));
                const shipT = ss(findField(o, '发货时间'));
                const types = [];
                if (s.includes('退款')) types.push('退款异常');
                if (payT && shipT && (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48) types.push('发货超时');
                if ((sf(findField(o, '店铺优惠折扣(元)', '店铺优惠')) + sf(findField(o, '平台优惠折扣(元)', '平台优惠')) + sf(findField(o, '多多支付立减金额(元)', '支付立减'))) / sf(findField(o, '商品总价(元)', '商品总价')) > 0.2) types.push('高优惠');
                return (
                  <tr key={i} className="border-b border-pdd-border hover:bg-pdd-bg">
                    <td className="py-1.5 font-mono">{ss(findField(o, '订单号')).slice(-8)}</td>
                    <td className="py-1.5 truncate max-w-[100px]">{ss(findField(o, '商品', '商品名称')).slice(0, 18)}</td>
                    <td className="py-1.5"><span className="px-1.5 py-0.5 rounded bg-pdd-danger/10 text-red-700">{types.join('/')}</span></td>
                    <td className="py-1.5 text-right">¥{sf(findField(o, '用户实付金额(元)', '用户实付')).toFixed(0)}</td>
                    <td className="py-1.5">{ss(findField(o, '支付时间')).slice(0, 16)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── AI风险分析（保留原有） ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-3 relative">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">AI风险分析 {!isPaid && <Lock size={12} className="text-pdd-warning" />}</h3>
        {!isPaid ? (
          <div className="h-32 flex items-center justify-center bg-pdd-bg/80 rounded">
            <div className="text-center"><Crown size={24} color="var(--pdd-danger)" className="mx-auto mb-1" /><p className="text-xs text-pdd-text-secondary">升级企业版解锁AI风险分析</p></div>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-pdd-text-secondary">AI风险分析功能开发中</div>
        )}
      </motion.div>

      {/* ── 预警设置面板 ── */}
      {showSettings && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowSettings(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-pdd-card rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-pdd-border">
              <h2 className="text-sm font-bold flex items-center gap-1"><Settings size={16} />预警规则设置</h2>
              <button onClick={() => setShowSettings(false)}><X size={16} className="text-pdd-text-secondary hover:text-pdd-text" /></button>
            </div>
            <div className="p-4 space-y-4">
              {DIMENSION_ORDER.map(dim => {
                const rules = allAlerts.filter(a => a.dimension === dim);
                const dimLabel = DIMENSION_META[dim].emoji + ' ' + DIMENSION_META[dim].label;
                const mutedRules = shieldData.mutedRules.filter(mr => mr.category === dim);
                return (
                  <div key={dim}>
                    <h4 className="text-xs font-semibold mb-2">{dimLabel}（{rules.length}条）</h4>
                    <div className="space-y-1">
                      {Array.from(new Set(rules.map(r => r.ruleKey))).map(key => {
                        const rule = rules.find(r => r.ruleKey === key)!;
                        const isCatMuted = mutedRules.some(mr => mr.type === 'category' && mr.rule === key);
                        const specificMutes = mutedRules.filter(mr => mr.type === 'specific' && mr.rule === key);
                        return (
                          <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded bg-pdd-bg text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className={isCatMuted ? 'text-pdd-text-secondary line-through' : 'text-pdd-text'}>{rule.ruleName}</span>
                              {isCatMuted && <span className="text-pdd-text-secondary">（已屏蔽）</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              {specificMutes.length > 0 && <span className="text-pdd-text-secondary text-[10px]">屏蔽了{specificMutes.length}项</span>}
                              <button
                                onClick={() => isCatMuted ? unmute(mutedRules.findIndex(mr => mr.type === 'category' && mr.rule === key)) : muteCategory(rule)}
                                className={'text-[10px] px-1.5 py-0.5 rounded ' + (isCatMuted ? 'bg-green-100 text-green-700' : 'bg-pdd-gray-100 text-pdd-text-secondary hover:bg-pdd-gray-200')}
                              >{isCatMuted ? '已屏蔽' : '屏蔽规则'}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-pdd-border text-center">
              <p className="text-[10px] text-pdd-text-secondary">屏蔽设置保存在本地，清除浏览器数据后会丢失</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}