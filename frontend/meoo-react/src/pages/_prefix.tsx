import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Search, Download,
  AlertCircle, BarChart3,
  Calculator, RefreshCw, CheckCircle2, CheckCircle,
  AlertTriangle, Settings,
  FileText, XCircle, ShieldCheck
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useData } from '../App';
import { sf, exportCSV, findField, ss } from '../utils';
import { OrderFinancialActual, UnlinkedFinancials } from '../utils/financialActuals';
import type { DailyTrend } from '../../api/analyticsApi';

// ─── Types ────────────────────────────────────────────────

type ViewType = 'accounting' | 'operations' | 'boss';

interface ReconRow {
  orderNo: string; productName: string; payTime: string; orderStatus: string;
  totalAmount: number; merchantReceived: number; userPaid: number;
  refundAmount: number; shippingFee: number;
  commissionShould: number; insuranceShould: number;
  commissionActual: number; subsidyActual: number;
  insuranceActual: number; penaltiesActual: number;
  marketingActual: number; adTransferActual: number;
  productCost: number; packagingFee: number;
  hasActualData: boolean; isSubsidy: boolean;
  penaltyDetails: { time: string; amount: number; type: string; desc: string }[];
  insuranceClaimsActual: number;
}

interface ReconSummary {
  totalOrders: number; matchedOrders: number; diffOrders: number;
  totalMerchantReceived: number; totalUserPaid: number; totalRefundAmount: number;
  totalCommissionShould: number; totalCommissionActual: number; totalCommissionDiff: number;
  totalInsuranceShould: number; totalInsuranceActual: number; totalInsuranceDiff: number;
  totalPenalties: number; totalMarketing: number;
  totalInsuranceClaims: number;
  totalFeesActual: number; totalFeesShould: number;
  totalGrossProfit: number; totalProductCost: number;
  currentCommissionRate: number; averageInsuranceFee: number;
  refundOrderCount: number; unmatchedFinancials: number;
}

interface BalanceReconciliation {
  platformIncome: number; platformRefund: number; platformFees: number; platformNet: number;
  orderIncome: number; orderRefund: number; transitOrders: number;
  orderNet: number; diff: number;
}

// ─── Column definitions (shared) ────────────────────────

const COLUMN_GROUPS = [
  { key: 'order', label: '订单' },
  { key: 'amount', label: '金额' },
  { key: 'fee', label: '费用' },
  { key: 'cost', label: '成本' },
  { key: 'profit', label: '利润' },
];

interface ColumnDef {
  id: string; label: string; group: string;
  width: number; align: 'left' | 'right'; frozen: boolean;
  formula?: string; source?: string;
  getValue: (r: ReconRow) => string;
  getColor?: (r: ReconRow) => string;
}

const COLUMNS: ColumnDef[] = [
  { id:'orderNo', label:'订单号', group:'order', width:120, align:'left', frozen:true,
    getValue: r => r.orderNo, source:'订单CSV' },
  { id:'productName', label:'商品', group:'order', width:140, align:'left', frozen:true,
    getValue: r => r.productName, source:'订单CSV' },
  { id:'payTime', label:'支付日', group:'order', width:80, align:'left', frozen:false,
    getValue: r => r.payTime, source:'订单CSV' },
  { id:'orderStatus', label:'状态', group:'order', width:76, align:'left', frozen:false,
    getValue: r => r.orderStatus, source:'订单CSV' },
  { id:'subsidyTag', label:'补', group:'order', width:40, align:'center', frozen:false,
    getValue: r => r.isSubsidy ? '✓' : '—',
    getColor: r => r.isSubsidy ? 'var(--pdd-warning)' : 'var(--pdd-text-secondary)' },
  { id:'merchantReceived', label:'商家实收', group:'amount', width:100, align:'right', frozen:false,
    formula:'=用户实付-平台扣款', source:'订单CSV',
    getValue: r => '¥'+r.merchantReceived.toFixed(2) },
  { id:'userPaid', label:'用户实付', group:'amount', width:100, align:'right', frozen:false,
    formula:'=商品总价+邮费-优惠', source:'订单CSV',
    getValue: r => '¥'+r.userPaid.toFixed(2) },
  { id:'refundAmount', label:'退款', group:'amount', width:80, align:'right', frozen:false,
    getValue: r => r.refundAmount>0?'¥'+r.refundAmount.toFixed(2):'-',
    getColor: r => r.refundAmount>0?'var(--pdd-danger)':'' },
  { id:'shippingFee', label:'邮费', group:'amount', width:68, align:'right', frozen:false,
    getValue: r => r.shippingFee>0?'¥'+r.shippingFee.toFixed(2):'-' },
  { id:'commissionShould', label:'佣金应扣', group:'fee', width:96, align:'right', frozen:false,
    formula:'=用户实付×费率', source:'按配置计算',
    getValue: r => '¥'+r.commissionShould.toFixed(2) },
  { id:'commissionActual', label:'佣金实扣', group:'fee', width:96, align:'right', frozen:false,
    formula:'=0030002+0030003', source:'货款明细',
    getValue: r => r.hasActualData?'¥'+r.commissionActual.toFixed(2):'-',
    getColor: r => r.hasActualData?'':'var(--pdd-text-secondary)' },
  { id:'commissionDiff', label:'佣金差异', group:'fee', width:86, align:'right', frozen:false,
    getValue: r => {
      if(!r.hasActualData) return '-';
      const d=r.commissionShould-r.commissionActual;
      return (d>=0?'+':'')+'¥'+d.toFixed(2);
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const d=r.commissionShould-r.commissionActual;
      return Math.abs(d)<0.01?'var(--pdd-text-secondary)':d>0?'var(--pdd-warning)':'var(--pdd-danger)';
    }},
  { id:'insuranceShould', label:'保费应扣', group:'fee', width:88, align:'right', frozen:false,
    getValue: r => '¥'+r.insuranceShould.toFixed(2) },
  { id:'insuranceActual', label:'保费实扣', group:'fee', width:88, align:'right', frozen:false,
    formula:'=0050002', source:'货款明细',
    getValue: r => r.hasActualData?'¥'+r.insuranceActual.toFixed(2):'-',
    getColor: r => r.hasActualData?'':'var(--pdd-text-secondary)' },
  { id:'insuranceDiff', label:'保费差异', group:'fee', width:86, align:'right', frozen:false,
    getValue: r => {
      if(!r.hasActualData) return '-';
      const d=r.insuranceShould-r.insuranceActual;
      return (d>=0?'+':'')+'¥'+d.toFixed(2);
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const d=r.insuranceShould-r.insuranceActual;
      return Math.abs(d)<0.01?'var(--pdd-text-secondary)':d>0?'var(--pdd-warning)':'var(--pdd-danger)';
    }},
  { id:'penaltiesActual', label:'罚款', group:'fee', width:72, align:'right', frozen:false,
    formula:'=004xxxx', source:'货款明细',
    getValue: r => r.penaltiesActual>0?'¥'+r.penaltiesActual.toFixed(2):'-',
    getColor: r => r.penaltiesActual>0?'var(--pdd-danger)':'' },
  { id:'marketingActual', label:'营销', group:'fee', width:72, align:'right', frozen:false,
    formula:'=006xxxx', source:'货款明细',
    getValue: r => r.marketingActual>0?'¥'+r.marketingActual.toFixed(2):'-',
    getColor: r => r.marketingActual>0?'var(--pdd-warning)':'' },
  { id:'totalFees', label:'费用合计', group:'fee', width:96, align:'right', frozen:false,
    getValue: r => {
      const t=r.commissionActual+r.insuranceActual+r.penaltiesActual+r.marketingActual;
      return r.hasActualData?'¥'+t.toFixed(2):'-';
    }},
  { id:'productCost', label:'商品成本', group:'cost', width:96, align:'right', frozen:false,
    formula:'=配置匹配', source:'成本配置',
    getValue: r => r.productCost>0?'¥'+r.productCost.toFixed(2):'-',
    getColor: r => r.productCost>0?'':'var(--pdd-text-secondary)' },
  { id:'packagingFee', label:'包装费', group:'cost', width:68, align:'right', frozen:false,
    getValue: r => r.packagingFee>0?'¥'+r.packagingFee.toFixed(2):'-' },
  { id:'grossProfit', label:'毛利', group:'profit', width:96, align:'right', frozen:false,
    getValue: r => {
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return r.hasActualData?'¥'+p.toFixed(2):'-';
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return p<0?'var(--pdd-danger)':'var(--pdd-success)';
    }},
  { id:'grossProfitMargin', label:'毛利率', group:'profit', width:68, align:'right', frozen:false,
    getValue: r => {
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return r.hasActualData && r.merchantReceived>0?(p/r.merchantReceived*100).toFixed(1)+'%':'-';
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return p<0?'var(--pdd-danger)':p<r.merchantReceived*0.1?'var(--pdd-warning)':'var(--pdd-success)';
    }},
];

// ─── Helpers ────────────────────────────────────────────

function fmt(n: number): string { return '¥' + n.toFixed(2); }
function fmtd(n: number, alwaysSign = false): string {
  if (alwaysSign) return (n >= 0 ? '+' : '') + '¥' + n.toFixed(2);
  return '¥' + n.toFixed(2);
}
function pct(n: number, total: number): string {
  return total > 0 ? (n / total * 100).toFixed(1) + '%' : '-';
}

function StatusBadge({ status }: { status: 'matched' | 'diff' | 'unmatched' }) {
  const m = {
    matched: { bg: 'bg-green-500/10', txt: 'text-green-600 dark:text-green-400', label: '已平' },
    diff: { bg: 'bg-amber-500/10', txt: 'text-amber-600 dark:text-amber-400', label: '差异' },
    unmatched: { bg: 'bg-red-500/10', txt: 'text-red-600 dark:text-red-400', label: '无匹配' },
  };
  const s = m[status];
  return <span className={'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ' + s.bg + ' ' + s.txt}>{s.label}</span>;
}

// ─── Marketing breakdown types ─────────────────────────

interface MarketingChannel {
  channel: string; cost: number; gmv: number;
}

interface MarketingBreakdown {
  totalCost: number; totalGMV: number;
  channels: { label: string; cost: number; gmv: number; children?: MarketingChannel[] }[];
}

function detectChannel(name: string): string {
  const parts = name.split('-');
  const last = parts[parts.length - 1] || '';
  if (last.includes('多多搜索')) return '多多搜索';
  if (last.includes('场景展示')) return '场景展示';
  if (last.includes('放心推')) return '放心推';
  return '其他';
}

function computeMarketingBreakdown(
  promo: any[], live: any[], star: any[],
): MarketingBreakdown {
  const channels: { label: string; cost: number; gmv: number; children?: MarketingChannel[] }[] = [];
  // 商品推广
  const sub: Record<string, { cost: number; gmv: number }> = {};
  let pc = 0, pg = 0;
  (promo || []).forEach((p: any) => {
    const name = String(p['推广名称'] || '');
    const cost = sf(p['总花费(元)'] || p['成交花费(元)'] || p['花费(元)'] || 0);
    const gmv = sf(p['交易额(元)'] || p['成交金额(元)'] || 0);
    const ch = detectChannel(name);
    if (!sub[ch]) sub[ch] = { cost: 0, gmv: 0 };
    sub[ch].cost += cost; sub[ch].gmv += gmv;
    pc += cost; pg += gmv;
  });
  const children = Object.entries(sub).filter(([_, v]) => v.cost > 0).map(([k, v]) => ({ channel: k, ...v }));
  if (pc > 0) channels.push({ label: '商品推广', cost: pc, gmv: pg, children });
  // 直播
  let lc = 0, lg = 0;
  (live || []).forEach((p: any) => {
    lc += sf(p['总花费(元)'] || p['成交花费(元)'] || p['花费(元)'] || 0);
    lg += sf(p['交易额(元)'] || p['成交金额(元)'] || 0);
  });
  if (lc > 0) channels.push({ label: '直播推广', cost: lc, gmv: lg });
  // 明星店铺
  let sc = 0, sg = 0;
  (star || []).forEach((p: any) => {
    sc += sf(p['总花费(元)'] || p['成交花费(元)'] || p['花费(元)'] || 0);
    sg += sf(p['交易额(元)'] || p['成交金额(元)'] || 0);
  });
  if (sc > 0) channels.push({ label: '明星店铺', cost: sc, gmv: sg });
  const totalCost = channels.reduce((s, c) => s + c.cost, 0);
  const totalGMV = channels.reduce((s, c) => s + c.gmv, 0);
  return { totalCost, totalGMV, channels };
}

// ─── Data computation ───────────────────────────────────

function buildReconRows(
  orders: any[],
  index: Record<string, OrderFinancialActual>,
  platformRate: number,
  subsidyRate: number,
  insuranceFee: number,
  costs: Record<string, number>,
  pkgFee: number,
): ReconRow[] {
  const seen = new Set<string>();
  const rows: ReconRow[] = [];
  orders.forEach(o => {
    const no = ss(findField(o, '订单号'));
    if (!no || seen.has(no)) return;
    seen.add(no);
    const up = sf(findField(o, '用户实付金额(元)', '用户实付', '实付金额'));
    const mr = sf(findField(o, '商家实收金额(元)', '商家实收', '实收金额'));
    const actual = index[no];
    const has = actual?.hasData ?? false;
    const subsidy = has && (actual!.subTechFee > 0);
    const name = ss(findField(o, '商品名称', '商品')).slice(0, 30);
    rows.push({
      orderNo: no,
      productName: name || '--',
      payTime: ss(findField(o, '支付时间')).slice(0, 10),
      orderStatus: ss(findField(o, '订单状态')),
      totalAmount: sf(findField(o, '商品总价(元)', '商品总价')),
      merchantReceived: mr,
      userPaid: up,
      refundAmount: sf(findField(o, '退款金额(元)', '退款金额')),
      shippingFee: sf(findField(o, '邮费(元)', '邮费')),
      commissionShould: subsidy ? up * (subsidyRate / 100) : up * (platformRate / 100),
      insuranceShould: insuranceFee || 0,
      commissionActual: has ? Math.abs(actual!.baseTechFee) + Math.abs(actual!.subTechFee) : 0,
      subsidyActual: has ? Math.abs(actual!.subTechFee) : 0,
      insuranceActual: has ? Math.abs(actual!.experiencePlan) : 0,
      penaltiesActual: has ? Math.abs(actual!.penalties) : 0,
      marketingActual: has ? Math.abs(actual!.marketingFees) : 0,
      adTransferActual: has ? Math.abs(actual!.adTransfer) : 0,
      productCost: costs[name] || 0,
      packagingFee: pkgFee || 0,
      hasActualData: has,
      isSubsidy: subsidy,
      penaltyDetails: has ? (actual!.penaltyRecords || []) : [],
      insuranceClaimsActual: has ? Math.abs(actual!.insuranceClaims) : 0,
    });
  });
  return rows;
}

function computeSummary(rows: ReconRow[]): ReconSummary {
  let cs = 0, ca = 0, is_ = 0, ia = 0, pen = 0, mkt = 0, pc = 0, ic = 0;
  let mr = 0, up = 0, rf = 0, mt = 0, df = 0;
  rows.forEach(r => {
    mr += r.merchantReceived; up += r.userPaid; rf += r.refundAmount;
    cs += r.commissionShould; ca += r.commissionActual;
    is_ += r.insuranceShould; ia += r.insuranceActual;
    pen += r.penaltiesActual; mkt += r.marketingActual;
    ic += r.insuranceClaimsActual;
    pc += r.productCost;
    if (r.hasActualData) {
      const d = Math.abs(r.commissionShould - r.commissionActual) + Math.abs(r.insuranceShould - r.insuranceActual);
      if (d < 0.01) mt++; else df++;
    }
  });
  return {
    totalOrders: rows.length, matchedOrders: mt, diffOrders: df,
    totalMerchantReceived: mr, totalUserPaid: up, totalRefundAmount: rf,
    totalCommissionShould: cs, totalCommissionActual: ca, totalCommissionDiff: cs - ca,
    totalInsuranceShould: is_, totalInsuranceActual: ia, totalInsuranceDiff: is_ - ia,
    totalPenalties: pen, totalMarketing: mkt,
    totalInsuranceClaims: ic,
    totalFeesActual: ca + ia + pen + mkt, totalFeesShould: cs + is_,
    totalGrossProfit: mr - (ca + ia + pen + mkt) - pc, totalProductCost: pc,
    currentCommissionRate: 0, averageInsuranceFee: 0,
    refundOrderCount: 0, unmatchedFinancials: 0,
  };
}

function computeBalance(financialRecords: any[], rows: ReconRow[]): BalanceReconciliation {
  let pi = 0, pr = 0, pf = 0;
  (financialRecords || []).forEach((r: any) => {
    const desc = String(r['业务描述'] || '');
    const code = (desc.split('|')[0] || '').trim();
    const inc = sf(r['收入金额(+元)'] || r['收入金额'] || 0);
    const exp = sf(r['支出金额(-元)'] || r['支出金额'] || 0);
    if (code === '0010002') pi += inc;
    else if (code === '0020002') pr += Math.abs(exp);
    else if (code.startsWith('003') || code.startsWith('004') || code.startsWith('005') || code.startsWith('006') || code.startsWith('007'))
      pf += Math.abs(exp + inc);
  });
  let oi = 0, orf = 0, tr = 0;
  rows.forEach(r => {
    if (r.orderStatus.includes('完成') || r.orderStatus.includes('确认收货')) oi += r.merchantReceived;
    if (r.refundAmount > 0) orf += r.refundAmount;
    if (r.orderStatus.includes('发货') && !r.orderStatus.includes('完成') && !r.orderStatus.includes('确认收货'))
      tr += r.merchantReceived;
  });
  const pnet = pi - pr - pf;
  const onet = oi - orf;
  return {
    platformIncome: pi, platformRefund: pr, platformFees: pf, platformNet: pnet,
    orderIncome: oi, orderRefund: orf, transitOrders: tr, orderNet: onet,
    diff: pnet - (onet + tr),
  };
}

// ============================================================
// COLUMN DEFINITIONS (for OperationsView)
// ============================================================

const COLUMN_GROUPS = [
  { key: 'order', label: '订单信息' },
  { key: 'amount', label: '金额' },
  { key: 'fee', label: '费用' },
  { key: 'cost', label: '成本' },
  { key: 'profit', label: '利润' },
];

interface ColumnDef {
  id: string; label: string; group: string;
  width: number; align: 'left'|'right'; frozen: boolean;
  formula?: string; source?: string;
  getValue: (r: ReconRow) => string;
  getColor?: (r: ReconRow) => string;
}

const COLUMNS: ColumnDef[] = [
  { id:'orderNo', label:'订单号', group:'order', width:120, align:'left', frozen:true,
    getValue: r => r.orderNo, source:'订单CSV' },
  { id:'productName', label:'商品名称', group:'order', width:160, align:'left', frozen:true,
    getValue: r => r.productName, source:'订单CSV' },
  { id:'payTime', label:'支付时间', group:'order', width:100, align:'left', frozen:false,
    getValue: r => r.payTime, source:'订单CSV' },
  { id:'orderStatus', label:'订单状态', group:'order', width:90, align:'left', frozen:false,
    getValue: r => r.orderStatus, source:'订单CSV' },
  { id:'subsidyTag', label:'补贴', group:'order', width:56, align:'center', frozen:false,
    getValue: r => r.isSubsidy ? '✓' : '—',
    getColor: r => r.isSubsidy ? 'var(--pdd-warning)' : 'var(--pdd-text-secondary)' },

  { id:'merchantReceived', label:'商家实收', group:'amount', width:100, align:'right', frozen:false,
    formula:'=用户实付-平台佣金-运费险-其他扣款', source:'订单CSV',
    getValue: r => '¥'+r.merchantReceived.toFixed(2) },
  { id:'userPaid', label:'用户实付', group:'amount', width:100, align:'right', frozen:false,
    formula:'=商品总价+邮费-优惠', source:'订单CSV',
    getValue: r => '¥'+r.userPaid.toFixed(2) },
  { id:'refundAmount', label:'退款金额', group:'amount', width:100, align:'right', frozen:false,
    getValue: r => r.refundAmount>0?'¥'+r.refundAmount.toFixed(2):'-',
    getColor: r => r.refundAmount>0?'var(--pdd-danger)':'' },
  { id:'shippingFee', label:'邮费', group:'amount', width:80, align:'right', frozen:false,
    getValue: r => r.shippingFee>0?'¥'+r.shippingFee.toFixed(2):'-' },

  { id:'commissionShould', label:'佣金(应扣)', group:'fee', width:100, align:'right', frozen:false,
    formula:'=用户实付×费率(补贴用补贴费率)', source:'按配置费率计算',
    getValue: r => '¥'+r.commissionShould.toFixed(2) },
  { id:'commissionActual', label:'佣金(实扣)', group:'fee', width:100, align:'right', frozen:false,
    formula:'=0030002+0030003', source:'货款明细CSV',
    getValue: r => r.hasActualData?'¥'+r.commissionActual.toFixed(2):'-',
    getColor: r => r.hasActualData?'':'var(--pdd-text-secondary)' },
  { id:'commissionDiff', label:'佣金差异', group:'fee', width:90, align:'right', frozen:false,
    formula:'=应扣-实扣', source:'',
    getValue: r => {
      if(!r.hasActualData) return '-';
      const d=r.commissionShould-r.commissionActual;
      return (d>=0?'+':'')+'¥'+d.toFixed(2);
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const d=r.commissionShould-r.commissionActual;
      return Math.abs(d)<0.01?'var(--pdd-text-secondary)':d>0?'var(--pdd-warning)':'var(--pdd-danger)';
    }},
  { id:'insuranceShould', label:'运费险(应扣)', group:'fee', width:100, align:'right', frozen:false,
    formula:'=每单保费(可配置)', source:'配置',
    getValue: r => '¥'+r.insuranceShould.toFixed(2) },
  { id:'insuranceActual', label:'运费险(实扣)', group:'fee', width:100, align:'right', frozen:false,
    formula:'=0050002', source:'货款明细CSV',
    getValue: r => r.hasActualData?'¥'+r.insuranceActual.toFixed(2):'-',
    getColor: r => r.hasActualData?'':'var(--pdd-text-secondary)' },
  { id:'insuranceDiff', label:'运费险差异', group:'fee', width:90, align:'right', frozen:false,
    formula:'=应扣-实扣', source:'',
    getValue: r => {
      if(!r.hasActualData) return '-';
      const d=r.insuranceShould-r.insuranceActual;
      return (d>=0?'+':'')+'¥'+d.toFixed(2);
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const d=r.insuranceShould-r.insuranceActual;
      return Math.abs(d)<0.01?'var(--pdd-text-secondary)':d>0?'var(--pdd-warning)':'var(--pdd-danger)';
    }},
  { id:'penaltiesActual', label:'罚款', group:'fee', width:80, align:'right', frozen:false,
    formula:'=004xxxx', source:'货款明细CSV',
    getValue: r => r.penaltiesActual>0?'¥'+r.penaltiesActual.toFixed(2):'-',
    getColor: r => r.penaltiesActual>0?'var(--pdd-danger)':'' },
  { id:'marketingActual', label:'营销费', group:'fee', width:80, align:'right', frozen:false,
    formula:'=006xxxx', source:'货款明细CSV',
    getValue: r => r.marketingActual>0?'¥'+r.marketingActual.toFixed(2):'-',
    getColor: r => r.marketingActual>0?'var(--pdd-warning)':'' },
  { id:'totalFees', label:'费用合计', group:'fee', width:100, align:'right', frozen:false,
    formula:'=佣金+运费险+罚款+营销费', source:'',
    getValue: r => {
      const t=r.commissionActual+r.insuranceActual+r.penaltiesActual+r.marketingActual;
      return r.hasActualData?'¥'+t.toFixed(2):'-';
    }},

  { id:'productCost', label:'商品成本', group:'cost', width:100, align:'right', frozen:false,
    formula:'=配置表匹配', source:'产品成本配置',
    getValue: r => r.productCost>0?'¥'+r.productCost.toFixed(2):'-',
    getColor: r => r.productCost>0?'':'var(--pdd-text-secondary)' },
  { id:'packagingFee', label:'包装费', group:'cost', width:80, align:'right', frozen:false,
    formula:'=每单包装费(可配置)', source:'配置',
    getValue: r => r.packagingFee>0?'¥'+r.packagingFee.toFixed(2):'-' },

  { id:'grossProfit', label:'毛利', group:'profit', width:100, align:'right', frozen:false,
    formula:'=商家实收-费用合计-商品成本', source:'',
    getValue: r => {
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return r.hasActualData?'¥'+p.toFixed(2):'-';
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return p<0?'var(--pdd-danger)':'var(--pdd-success)';
    }},
  { id:'grossProfitMargin', label:'毛利率', group:'profit', width:80, align:'right', frozen:false,
    formula:'=毛利÷商家实收×100%', source:'',
    getValue: r => {
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return r.hasActualData && r.merchantReceived>0?(p/r.merchantReceived*100).toFixed(1)+'%':'-';
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const p=r.merchantReceived-r.commissionActual-r.insuranceActual-r.penaltiesActual-r.marketingActual-r.productCost;
      return p<0?'var(--pdd-danger)':p<r.merchantReceived*0.1?'var(--pdd-warning)':'var(--pdd-success)';
    }},
];

function StatusBadge({ status }: { status:'matched'|'diff'|'unmatched' }) {
  const m = { matched: {bg:'bg-pdd-success/10',txt:'text-pdd-success',label:'已平'},
    diff: {bg:'bg-pdd-warning/10',txt:'text-pdd-warning',label:'差异'},
    unmatched: {bg:'bg-pdd-danger/10',txt:'text-pdd-danger',label:'无匹配'} };
  const s = m[status];
  return <span className={'text-[10px] px-1.5 py-0.5 rounded ' + s.bg + ' ' + s.txt}>{s.label}</span>;
}

