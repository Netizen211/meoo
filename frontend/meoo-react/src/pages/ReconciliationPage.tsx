import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  // After-sale dimensions
  afterSaleType: string; afterSaleStatus: string; afterSaleAmount: number;
  afterSaleTime: string; hasAfterSale: boolean;
  // ★ 完整成本核算字段（在 buildReconRows 中预计算）
  laborFee: number;           // 人工费（配置值）
  effectiveShippingFee: number; // 快递费（配置值，非订单CSV运费）
  computedGrossProfit: number;  // 毛利 = 实收 - 所有费用 - 成本 - 快递费 - 人工费
  computedGrossProfitMargin: number; // 毛利率
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
  { key: 'aftersale', label: '售后' },
];

interface ColumnDef {
  id: string; label: string; group: string;
  width: number; align: 'left' | 'right' | 'center'; frozen: boolean;
  formula?: string; source?: string;
  sourceType: 'order' | 'financial' | 'calculated' | 'config';
  tooltip?: string;
  getValue: (r: ReconRow) => string;
  getColor?: (r: ReconRow) => string;
  getSortValue?: (r: ReconRow) => number;
}

const SOURCE_CONFIG = { order: '#3B82F6', financial: '#10B981', calculated: '#F59E0B', config: '#6B7280' } as const;
const SOURCE_LABEL = { order: '订单CSV', financial: '货款明细', calculated: '计算值', config: '配置' } as const;

const COLUMNS: ColumnDef[] = [
  { id:'orderNo', label:'订单号', group:'order', width:120, align:'left', frozen:true,
    source:'订单CSV', sourceType:'order', tooltip:'原始数据来自订单CSV',
    getValue: r => r.orderNo, getSortValue: r => parseFloat(r.orderNo.replace(/\D/g,'').slice(0,10))||0 },
  { id:'productName', label:'商品', group:'order', width:140, align:'left', frozen:true,
    source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 商品名称',
    getValue: r => r.productName },
  { id:'payTime', label:'支付日', group:'order', width:80, align:'left', frozen:false,
    source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 支付时间',
    getValue: r => r.payTime },
  { id:'orderStatus', label:'状态', group:'order', width:76, align:'left', frozen:false,
    source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 订单状态',
    getValue: r => r.orderStatus },
  { id:'subsidyTag', label:'补', group:'order', width:40, align:'center', frozen:false,
    source:'货款明细', sourceType:'financial', tooltip:'技术服务费>0为补贴订单',
    getValue: r => r.isSubsidy ? '✓' : '—',
    getColor: r => r.isSubsidy ? 'var(--pdd-warning)' : 'var(--pdd-text-secondary)' },
  { id:'merchantReceived', label:'商家实收', group:'amount', width:100, align:'right', frozen:false,
    formula:'=用户实付-平台扣款', source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 商家实收金额',
    getValue: r => '¥'+r.merchantReceived.toFixed(2), getSortValue: r => r.merchantReceived },
  { id:'userPaid', label:'用户实付', group:'amount', width:100, align:'right', frozen:false,
    formula:'=商品总价+邮费-优惠', source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 用户实付金额',
    getValue: r => '¥'+r.userPaid.toFixed(2), getSortValue: r => r.userPaid },
  { id:'refundAmount', label:'退款', group:'amount', width:80, align:'right', frozen:false,
    source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 退款金额',
    getValue: r => r.refundAmount>0?'¥'+r.refundAmount.toFixed(2):'-',
    getColor: r => r.refundAmount>0?'var(--pdd-danger)':'',
    getSortValue: r => r.refundAmount },
  { id:'shippingFee', label:'邮费', group:'amount', width:68, align:'right', frozen:false,
    source:'订单CSV', sourceType:'order', tooltip:'订单CSV > 邮费',
    getValue: r => r.shippingFee>0?'¥'+r.shippingFee.toFixed(2):'-',
    getSortValue: r => r.shippingFee },
  // After-sale dimension columns
  { id:'hasAfterSale', label:'售后', group:'aftersale', width:50, align:'center', frozen:false,
    source:'售后CSV', sourceType:'order', tooltip:'是否有售后记录',
    getValue: r => r.hasAfterSale ? '✓' : '—',
    getColor: r => r.hasAfterSale ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)' },
  { id:'afterSaleType', label:'售后类型', group:'aftersale', width:80, align:'left', frozen:false,
    source:'售后CSV', sourceType:'order', tooltip:'售后CSV > 售后类型',
    getValue: r => r.hasAfterSale ? r.afterSaleType : '—',
    getColor: r => r.hasAfterSale && r.afterSaleType.includes('退货') ? 'var(--pdd-warning)' : '' },
  { id:'afterSaleStatus', label:'售后状态', group:'aftersale', width:80, align:'left', frozen:false,
    source:'售后CSV', sourceType:'order', tooltip:'售后CSV > 售后状态',
    getValue: r => r.hasAfterSale ? r.afterSaleStatus : '—' },
  { id:'afterSaleAmount', label:'售后金额', group:'aftersale', width:80, align:'right', frozen:false,
    source:'售后CSV', sourceType:'order', tooltip:'售后CSV > 退款金额',
    getValue: r => r.hasAfterSale && r.afterSaleAmount > 0 ? '¥'+r.afterSaleAmount.toFixed(2) : '—',
    getColor: r => r.hasAfterSale && r.afterSaleAmount > 0 ? 'var(--pdd-danger)' : '' },
  { id:'afterSaleTime', label:'售后时间', group:'aftersale', width:80, align:'left', frozen:false,
    source:'售后CSV', sourceType:'order', tooltip:'售后CSV > 申请时间',
    getValue: r => r.hasAfterSale ? r.afterSaleTime : '—' },
  { id:'commissionShould', label:'佣金应扣', group:'fee', width:96, align:'right', frozen:false,
    formula:'=用户实付×费率', source:'按配置计算', sourceType:'calculated',
    tooltip:'应扣佣金 = 用户实付 × 配置费率（标准或补贴）',
    getValue: r => '¥'+r.commissionShould.toFixed(2), getSortValue: r => r.commissionShould },
  { id:'commissionActual', label:'佣金实扣', group:'fee', width:96, align:'right', frozen:false,
    formula:'=0030002+0030003', source:'货款明细', sourceType:'financial',
    tooltip:'实扣佣金 = 基础技术服务费(0030002) + 技术服务费(0030003)。来源：货款明细 > 业务描述',
    getValue: r => r.hasActualData?'¥'+r.commissionActual.toFixed(2):'-',
    getColor: r => r.hasActualData?'':'var(--pdd-text-secondary)',
    getSortValue: r => r.commissionActual },
  { id:'commissionDiff', label:'佣金差异', group:'fee', width:86, align:'right', frozen:false,
    source:'计算值', sourceType:'calculated', tooltip:'佣金差异 = 应扣 - 实扣。正值表示多扣了',
    getValue: r => {
      if(!r.hasActualData) return '-';
      const d=r.commissionShould-r.commissionActual;
      return (d>=0?'+':'')+'¥'+d.toFixed(2);
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const d=r.commissionShould-r.commissionActual;
      return Math.abs(d)<0.01?'var(--pdd-text-secondary)':d>0?'var(--pdd-warning)':'var(--pdd-danger)';
    },
    getSortValue: r => r.hasActualData ? r.commissionShould - r.commissionActual : 0 },
  { id:'insuranceShould', label:'保费应扣', group:'fee', width:88, align:'right', frozen:false,
    source:'配置', sourceType:'config', tooltip:'应扣保费 = 配置的运费险单价（默认每单¥1.50）',
    getValue: r => '¥'+r.insuranceShould.toFixed(2), getSortValue: r => r.insuranceShould },
  { id:'insuranceActual', label:'保费实扣', group:'fee', width:88, align:'right', frozen:false,
    formula:'=0050002', source:'货款明细', sourceType:'financial',
    tooltip:'实扣保费 = 体验计划(0050002)。来源：货款明细 > 业务描述',
    getValue: r => r.hasActualData?'¥'+r.insuranceActual.toFixed(2):'-',
    getColor: r => r.hasActualData?'':'var(--pdd-text-secondary)',
    getSortValue: r => r.insuranceActual },
  { id:'insuranceDiff', label:'保费差异', group:'fee', width:86, align:'right', frozen:false,
    source:'计算值', sourceType:'calculated', tooltip:'保费差异 = 应扣 - 实扣',
    getValue: r => {
      if(!r.hasActualData) return '-';
      const d=r.insuranceShould-r.insuranceActual;
      return (d>=0?'+':'')+'¥'+d.toFixed(2);
    },
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      const d=r.insuranceShould-r.insuranceActual;
      return Math.abs(d)<0.01?'var(--pdd-text-secondary)':d>0?'var(--pdd-warning)':'var(--pdd-danger)';
    },
    getSortValue: r => r.hasActualData ? r.insuranceShould - r.insuranceActual : 0 },
  { id:'penaltiesActual', label:'罚款', group:'fee', width:72, align:'right', frozen:false,
    formula:'=004xxxx', source:'货款明细', sourceType:'financial',
    tooltip:'罚款 = 理赔扣款(0040002) + 其他扣款(0040004/0040005)。来源：货款明细 > 业务描述',
    getValue: r => r.penaltiesActual>0?'¥'+r.penaltiesActual.toFixed(2):'-',
    getColor: r => r.penaltiesActual>0?'var(--pdd-danger)':'',
    getSortValue: r => r.penaltiesActual },
  { id:'marketingActual', label:'营销', group:'fee', width:72, align:'right', frozen:false,
    formula:'=006xxxx', source:'货款明细', sourceType:'financial',
    tooltip:'营销费 = 多多搜索/场景展示/放心推等(006xxxx)。来源：货款明细 > 业务描述',
    getValue: r => r.marketingActual>0?'¥'+r.marketingActual.toFixed(2):'-',
    getColor: r => r.marketingActual>0?'var(--pdd-warning)':'',
    getSortValue: r => r.marketingActual },
  { id:'totalFees', label:'费用合计', group:'fee', width:96, align:'right', frozen:false,
    source:'计算值', sourceType:'calculated', tooltip:'费用合计 = 佣金实扣 + 保费实扣 + 罚款 + 营销费',
    getValue: r => {
      const t=r.commissionActual+r.insuranceActual+r.penaltiesActual+r.marketingActual;
      return r.hasActualData?'¥'+t.toFixed(2):'-';
    },
    getSortValue: r => r.hasActualData ? r.commissionActual+r.insuranceActual+r.penaltiesActual+r.marketingActual : 0 },
  { id:'productCost', label:'商品成本', group:'cost', width:96, align:'right', frozen:false,
    formula:'=配置匹配', source:'成本配置', sourceType:'config',
    tooltip:'商品成本 = 按商品名称匹配配置中的成本价。未配置则为0',
    getValue: r => r.productCost>0?'¥'+r.productCost.toFixed(2):'-',
    getColor: r => r.productCost>0?'':'var(--pdd-text-secondary)',
    getSortValue: r => r.productCost },
  { id:'packagingFee', label:'包装费', group:'cost', width:68, align:'right', frozen:false,
    source:'配置', sourceType:'config', tooltip:'包装费 = 配置中的每单包装费',
    getValue: r => r.packagingFee>0?'¥'+r.packagingFee.toFixed(2):'-',
    getSortValue: r => r.packagingFee },
  { id:'grossProfit', label:'毛利', group:'profit', width:96, align:'right', frozen:false,
    source:'计算值', sourceType:'calculated', tooltip:'毛利 = 商家实收 - 费用合计 - 商品成本 - 包装费 - 快递费 - 人工费',
    getValue: r => r.hasActualData ? '¥' + r.computedGrossProfit.toFixed(2) : '-',
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      return r.computedGrossProfit<0?'var(--pdd-danger)':'var(--pdd-success)';
    },
    getSortValue: r => r.hasActualData ? r.computedGrossProfit : 0 },
  { id:'grossProfitMargin', label:'毛利率', group:'profit', width:68, align:'right', frozen:false,
    source:'计算值', sourceType:'calculated', tooltip:'毛利率 = 毛利 / 商家实收 × 100%',
    getValue: r => r.hasActualData && r.merchantReceived>0 ? r.computedGrossProfitMargin.toFixed(1)+'%' : '-',
    getColor: r => {
      if(!r.hasActualData) return 'var(--pdd-text-secondary)';
      return r.computedGrossProfitMargin < 0 ? 'var(--pdd-danger)' : r.computedGrossProfitMargin < 10 ? 'var(--pdd-warning)' : 'var(--pdd-success)';
    },
    getSortValue: r => r.hasActualData && r.merchantReceived>0 ? r.computedGrossProfitMargin : 0 },
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
  afterSaleRecords?: any[],
  shippingFeePerOrder?: number,
  laborFeePerOrder?: number,
): ReconRow[] {
  // Build after-sale lookup index: orderNo -> first after-sale record
  const afterSaleIndex: Record<string, any> = {};
  (afterSaleRecords || []).forEach((r: any) => {
    const no = ss(r['订单号'] || r['原订单号'] || '').trim();
    if (no && !afterSaleIndex[no]) afterSaleIndex[no] = r;
  });

  // ★ 模糊匹配商品成本：支持名称含促销标签的情况
  const costKeys = Object.keys(costs);
  const findCostKey = (name: string): string | undefined => {
    if (costKeys.includes(name)) return name;
    const match = costKeys.find(k => name.includes(k));
    if (match) return match;
    return costKeys.find(k => k.includes(name));
  };

  const seen = new Set<string>();
  const rows: ReconRow[] = [];
  orders.forEach(o => {
    const noRaw = ss(findField(o, '订单号'));
    if (!noRaw || seen.has(noRaw)) return;
    seen.add(noRaw);

    // Normalize order number: trim and remove non-printable chars
    const no = noRaw.replace(/[﻿ \t\r\n]/g, '').trim();

    const up = sf(findField(o, '用户实付金额(元)', '用户实付', '实付金额'));
    const mr = sf(findField(o, '商家实收金额(元)', '商家实收', '实收金额'));
    const actual = index[no];
    const has = actual?.hasData ?? false;
    const subsidy = has && (actual!.subTechFee > 0);
    const name = ss(findField(o, '商品名称', '商品')).slice(0, 30);

    // ★ 商品成本：模糊匹配
    const costKey = findCostKey(name);
    const productCost = costKey ? (costs[costKey] || 0) : 0;

    // ★ 快递费：使用配置值（不含订单CSV中的运费，那是用户付的）
    const effectiveShippingFee = (shippingFeePerOrder ?? 0);
    // ★ 人工费
    const laborFee = (laborFeePerOrder ?? 0);

    // 费用合计
    const totalFees = has
      ? Math.abs(actual!.baseTechFee) + Math.abs(actual!.subTechFee)
        + Math.abs(actual!.experiencePlan)
        + Math.abs(actual!.penalties)
        + Math.abs(actual!.marketingFees)
      : 0;
    const commissionActual = has ? Math.abs(actual!.baseTechFee) + Math.abs(actual!.subTechFee) : 0;
    const insuranceActual = has ? Math.abs(actual!.experiencePlan) : 0;

    // ★ 毛利 = 实收 - 平台扣费 - 成本 - 快递费 - 人工费
    const grossProfit = has
      ? mr - commissionActual - insuranceActual - Math.abs(actual!.penalties) - Math.abs(actual!.marketingFees)
        - productCost - pkgFee - effectiveShippingFee - laborFee
      : mr - productCost - pkgFee - effectiveShippingFee - laborFee;
    const grossProfitMargin = mr > 0 ? (grossProfit / mr) * 100 : 0;

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
      commissionActual,
      subsidyActual: has ? Math.abs(actual!.subTechFee) : 0,
      insuranceActual,
      penaltiesActual: has ? Math.abs(actual!.penalties) : 0,
      marketingActual: has ? Math.abs(actual!.marketingFees) : 0,
      adTransferActual: has ? Math.abs(actual!.adTransfer) : 0,
      productCost,
      packagingFee: pkgFee || 0,
      hasActualData: has,
      isSubsidy: subsidy,
      penaltyDetails: has ? (actual!.penaltyRecords || []) : [],
      insuranceClaimsActual: has ? Math.abs(actual!.insuranceClaims) : 0,
      // ★ 新增完整成本字段
      laborFee,
      effectiveShippingFee,
      computedGrossProfit: grossProfit,
      computedGrossProfitMargin: grossProfitMargin,
      // After-sale dimensions
      afterSaleType: afterSaleIndex[no] ? ss(afterSaleIndex[no]['售后类型'] || '') : '',
      afterSaleStatus: afterSaleIndex[no] ? ss(afterSaleIndex[no]['售后状态'] || '') : '',
      afterSaleAmount: afterSaleIndex[no] ? Math.abs(sf(afterSaleIndex[no]['退款金额(元)'] || afterSaleIndex[no]['退款金额'] || 0)) : 0,
      afterSaleTime: afterSaleIndex[no] ? ss(afterSaleIndex[no]['申请时间'] || afterSaleIndex[no]['创建时间'] || '').slice(0, 10) : '',
      hasAfterSale: !!afterSaleIndex[no],
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
    totalGrossProfit: rows.reduce((s, r) => s + r.computedGrossProfit, 0), totalProductCost: pc,
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
    else if (code === '0010005') pi += Math.abs(inc); // ★ 优惠券结算收入
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
// UNIFIED HIGH-FREEDOM TABLE — 单屏数据表（高自由度）
// ============================================================

// ─── Source Color Indicator ─────────────────────────────
const SRC_COLORS: Record<string, string> = {
  order: '#3B82F6', financial: '#10B981',
  calculated: '#F59E0B', config: '#6B7280',
};
const SRC_LABELS: Record<string, string> = {
  order: '订单原始', financial: '货款明细',
  calculated: '公式计算', config: '系统配置',
};
function SrcDot({ st }: { st: string }) {
  const c = SRC_COLORS[st] || '#6B7280';
  return <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5 flex-shrink-0" style={{ backgroundColor: c }} title={SRC_LABELS[st] || st} />;
}

// ─── Column Group Theme ────────────────────────────────
const GROUP_THEME: Record<string, { bg: string; text: string; border: string; solidBg: string }> = {
  order:  { bg: 'rgba(59,130,246,0.08)', text: '#3B82F6', border: 'rgba(59,130,246,0.2)', solidBg: '#EFF6FF' },
  amount: { bg: 'rgba(16,185,129,0.08)', text: '#10B981', border: 'rgba(16,185,129,0.2)', solidBg: '#ECFDF5' },
  fee:    { bg: 'rgba(245,158,11,0.08)', text: '#D97706', border: 'rgba(245,158,11,0.2)', solidBg: '#FFFBEB' },
  cost:   { bg: 'rgba(107,114,128,0.08)', text: '#6B7280', border: 'rgba(107,114,128,0.2)', solidBg: '#F3F4F6' },
  profit: { bg: 'rgba(139,92,246,0.08)', text: '#8B5CF6', border: 'rgba(139,92,246,0.2)', solidBg: '#F5F3FF' },
  aftersale: { bg: 'rgba(239,68,68,0.08)', text: '#DC2626', border: 'rgba(239,68,68,0.2)', solidBg: '#FEF2F2' },
};

// ─── Column Config Dropdown ────────────────────────────
function ColumnConfig({ columns, order, onChangeOrder, frozenSet, onToggleFrozen, visibleSet, onToggleVisible }: {
  columns: ColumnDef[]; order: string[];
  onChangeOrder: (id: string, dir: -1|1) => void;
  frozenSet: Set<string>; onToggleFrozen: (id: string) => void;
  visibleSet: Set<string>; onToggleVisible: (id: string) => void;
}) {
  return (
    <div className="p-3 w-72 max-h-[420px] overflow-y-auto">
      <p className="text-[11px] font-semibold text-pdd-text mb-2">列配置</p>
      {COLUMN_GROUPS.map(g => {
        const groupCols = columns.filter(c => c.group === g.key);
        if (!groupCols.length) return null;
        return (
          <div key={g.key} className="mb-2.5">
            <p className="text-[9px] font-medium mb-1 uppercase tracking-wider" style={{ color: GROUP_THEME[g.key]?.text || '#999' }}>{g.label}</p>
            <div className="space-y-0.5">
              {groupCols.map(c => {
                const idx = order.indexOf(c.id);
                const canUp = idx > 0;
                const canDown = idx < order.length - 1;
                return (
                  <div key={c.id} className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-pdd-bg/40 text-xs">
                    <input type="checkbox" checked={visibleSet.has(c.id)} onChange={() => onToggleVisible(c.id)}
                      className="w-3 h-3 rounded border-pdd-border text-pdd-primary focus:ring-pdd-primary/30" />
                    <span className="flex-1 text-pdd-text truncate">{c.label}</span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => onChangeOrder(c.id, -1)}
                        className={'p-0.5 rounded '+(canUp?'hover:bg-pdd-bg text-pdd-text-secondary':'text-pdd-text-secondary/20 cursor-not-allowed')}
                        disabled={!canUp} title="左移">◀</button>
                      <button onClick={() => onChangeOrder(c.id, 1)}
                        className={'p-0.5 rounded '+(canDown?'hover:bg-pdd-bg text-pdd-text-secondary':'text-pdd-text-secondary/20 cursor-not-allowed')}
                        disabled={!canDown} title="右移">▶</button>
                    </div>
                    <button onClick={() => onToggleFrozen(c.id)}
                      className={'text-[9px] px-1 py-0.5 rounded '+(frozenSet.has(c.id)?'bg-pdd-primary/10 text-pdd-primary':'text-pdd-text-secondary/40 hover:text-pdd-text-secondary')}>
                      {frozenSet.has(c.id) ? '固定' : '浮动'}
                    </button>
                    <SrcDot st={c.sourceType} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="mt-2 pt-2 border-t border-pdd-border/40 text-[10px] text-pdd-text-secondary leading-relaxed">
        <p>拖拽列头 ⇄ 调整顺序</p>
        <p>拖拽列右边缘 ↔ 调整宽度</p>
      </div>
    </div>
  );
}

// ============================================================
// NEW UNIFIED SINGLE-SCREEN TABLE (高自由度)
// ============================================================

// ─── Summary Bar ────────────────────────────────────────
function SummaryBar({ rows, summary, balance }: {
  rows: ReconRow[]; summary: ReconSummary; balance: BalanceReconciliation;
}) {
  return (
    <div className="flex items-center gap-5 px-4 py-2.5 bg-pdd-card border border-pdd-border rounded-lg text-xs">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pdd-primary/60" />
          <span className="text-pdd-text-secondary">总订单</span>
          <b className="text-pdd-text">{rows.length}</b>
        </div>
        <span className="w-px h-4 bg-pdd-border/40" />
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pdd-success" />
          <span className="text-pdd-text-secondary">已平</span>
          <b className="text-pdd-success">{summary.matchedOrders}</b>
          <span className="text-pdd-text-secondary text-[10px]">
            ({rows.length > 0 ? (summary.matchedOrders/rows.length*100).toFixed(0) : 0}%)
          </span>
        </div>
        <span className="w-px h-4 bg-pdd-border/40" />
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pdd-warning" />
          <span className="text-pdd-text-secondary">差异</span>
          <b className="text-pdd-warning">{summary.diffOrders}</b>
        </div>
        <span className="w-px h-4 bg-pdd-border/40" />
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pdd-text-secondary/40" />
          <span className="text-pdd-text-secondary">无匹配</span>
          <b className="text-pdd-text-secondary">{rows.length - rows.filter(r=>r.hasActualData).length}</b>
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3 text-pdd-text-secondary">
        <span>实收 <b className="text-pdd-text">¥{summary.totalMerchantReceived.toFixed(0)}</b></span>
        <span>费用 <b className="text-pdd-warning">¥{summary.totalFeesActual.toFixed(0)}</b></span>
        <span>毛利 <b className={summary.totalGrossProfit >= 0 ? 'text-pdd-success' : 'text-pdd-danger'}>
          ¥{summary.totalGrossProfit.toFixed(0)}
        </b></span>
        <span>结算 <b className={Math.abs(balance.diff)<0.01 ? 'text-pdd-success' : 'text-pdd-warning'}>
          {Math.abs(balance.diff)<0.01 ? '✓ 平衡' : '⚠ 差¥'+balance.diff.toFixed(2)}
        </b></span>
      </div>
    </div>
  );
}

// ─── Cost Breakdown Summary ───────────────────────────
function CostBreakdownSummary({ summary, rows, shippingFeePerOrder, laborFeePerOrder, packagingFeePerOrder }: {
  summary: ReconSummary;
  rows: ReconRow[];
  shippingFeePerOrder: number;
  laborFeePerOrder: number;
  packagingFeePerOrder: number;
}) {
  const totalShipping = rows.length * shippingFeePerOrder;
  const totalLabor = rows.length * laborFeePerOrder;
  const totalPkg = rows.length * packagingFeePerOrder;
  const allFees = summary.totalFeesActual + totalShipping + totalLabor;
  const realizedRows = rows.filter(r => r.hasActualData);
  const diffCom = realizedRows.reduce((s, r) => s + (r.commissionShould - r.commissionActual), 0);
  const diffIns = realizedRows.reduce((s, r) => s + (r.insuranceShould - r.insuranceActual), 0);
  const lossCount = realizedRows.filter(r => r.computedGrossProfit < 0).length;

  const feeItems = [
    { label: '佣金', val: summary.totalCommissionActual, color: '#3B82F6' },
    { label: '保费', val: summary.totalInsuranceActual, color: '#10B981' },
    { label: '罚款', val: summary.totalPenalties, color: '#EF4444' },
    { label: '营销', val: summary.totalMarketing, color: '#F59E0B' },
    { label: '商品成本', val: summary.totalProductCost, color: '#8B5CF6' },
    { label: '包装费', val: totalPkg, color: '#6B7280' },
    { label: '快递费', val: totalShipping, color: '#EC4899' },
    { label: '人工费', val: totalLabor, color: '#F97316' },
  ].filter(f => f.val > 0.01);

  const missingItems: string[] = [];
  if (shippingFeePerOrder <= 0) missingItems.push('快递费未配置');
  if (laborFeePerOrder <= 0) missingItems.push('人工费未配置');

  return (
    <div className="border border-pdd-border rounded-lg overflow-hidden bg-pdd-card">
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-pdd-border/30">
        {/* 成本构成 */}
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider flex items-center gap-1">
            <BarChart3 size={11} /> 成本构成
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            {feeItems.map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-pdd-text-secondary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: f.color }} />
                  {f.label}
                </span>
                <span className="text-pdd-text font-mono tabular-nums">¥{f.val.toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-pdd-border/20 pt-1 mt-1 flex justify-between text-[10px]">
            <span className="font-medium text-pdd-text">总成本</span>
            <span className="font-semibold font-mono text-pdd-text">¥{(allFees + summary.totalProductCost).toFixed(0)}</span>
          </div>
        </div>

        {/* 差额分析 */}
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider flex items-center gap-1">
            <Calculator size={11} /> 差额分析
          </p>
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-pdd-text-secondary">佣金差异</span>
              <span className={'font-mono tabular-nums ' + (Math.abs(diffCom) < 0.01 ? 'text-pdd-text-secondary' : diffCom > 0 ? 'text-pdd-warning' : 'text-pdd-danger')}>
                {diffCom >= 0 ? '+' : ''}¥{diffCom.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pdd-text-secondary">保费差异</span>
              <span className={'font-mono tabular-nums ' + (Math.abs(diffIns) < 0.01 ? 'text-pdd-text-secondary' : diffIns > 0 ? 'text-pdd-warning' : 'text-pdd-danger')}>
                {diffIns >= 0 ? '+' : ''}¥{diffIns.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-pdd-border/20 pt-1">
              <span className="text-pdd-text">差异合计</span>
              <span className={'font-mono font-semibold tabular-nums ' + (Math.abs(diffCom + diffIns) < 0.01 ? 'text-pdd-success' : 'text-pdd-danger')}>
                {(diffCom + diffIns) >= 0 ? '+' : ''}¥{(diffCom + diffIns).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="border-t border-pdd-border/20 pt-1 mt-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-pdd-text-secondary">亏损订单</span>
              <span className={lossCount > 0 ? 'text-pdd-danger font-medium' : 'text-pdd-success'}>
                {lossCount} 单 / {realizedRows.length} 单
              </span>
            </div>
            {lossCount > 0 && (
              <p className="text-pdd-danger/70 text-[9px] mt-0.5">建议检查亏损商品的成本或定价</p>
            )}
          </div>
        </div>

        {/* 缺失警告 */}
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider flex items-center gap-1">
            <AlertCircle size={11} /> 配置检查
          </p>
          {missingItems.length > 0 ? (
            <div className="space-y-1">
              {missingItems.map(msg => (
                <div key={msg} className="flex items-center gap-1.5 text-[10px] text-pdd-warning bg-pdd-warning/5 px-2 py-1 rounded">
                  <AlertTriangle size={10} />
                  {msg}
                  <span className="text-pdd-warning/60 ml-auto">→ 设置中心配置</span>
                </div>
              ))}
              <p className="text-[9px] text-pdd-text-secondary/60 mt-1">缺少的费用项将导致毛利虚高，请在"设置中心 {">"} 成本设置"中配置</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-pdd-success bg-pdd-success/5 px-2 py-1.5 rounded">
              <CheckCircle2 size={11} />
              所有成本项已配置
            </div>
          )}
          {rows.length > 0 && rows.filter(r => r.productCost <= 0 && r.hasActualData).length > 5 && (
            <div className="flex items-center gap-1.5 text-[10px] text-pdd-warning bg-pdd-warning/5 px-2 py-1 rounded">
              <AlertTriangle size={10} />
              {rows.filter(r => r.productCost <= 0 && r.hasActualData).length} 单商品成本为0
            </div>
          )}
          <div className="border-t border-pdd-border/20 pt-1 mt-1 text-[9px] text-pdd-text-secondary/40">
            数据来源: 订单CSV + 货款明细 + 成本配置
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cell Tooltip ──────────────────────────────────────
function CellInfo({ col, row }: { col: ColumnDef; row: ReconRow }) {
  const val = col.getValue(row);
  return (
    <div className="text-[11px] leading-relaxed max-w-[260px]">
      <div className="font-semibold text-pdd-text mb-1">{col.label}</div>
      <div className="text-pdd-text-secondary mb-1.5">{col.tooltip || col.source || ''}</div>
      {col.formula && <div className="text-[10px] font-mono bg-pdd-bg/60 px-1.5 py-1 rounded text-pdd-text-secondary mb-1">{col.formula}</div>}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-pdd-text-secondary">来源:</span>
        <span className="flex items-center gap-1">
          <SrcDot st={col.sourceType} />
          <span className="text-pdd-text">{SRC_LABELS[col.sourceType] || col.sourceType}</span>
        </span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-pdd-border/30 text-pdd-text font-mono">{val}</div>
    </div>
  );
}

// ─── Column Resize Handle ─────────────────────────────
function ResizeHandle({ onResizeStart }: { onResizeStart: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-pdd-primary/30 group"
      onMouseDown={onResizeStart}
    >
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-pdd-border/0 group-hover:bg-pdd-primary/50 transition-colors" />
    </div>
  );
}

// ─── Unified Data Table ───────────────────────────────
function UnifiedTable({
  rows, summary, columns, columnOrder, columnWidths, frozenSet, visibleSet,
  onReorder, onResize, onToggleVisible, onToggleFrozen,
  onRowClick,
  afterSaleRecords, shippingInsurance,
}: {
  rows: ReconRow[]; summary: ReconSummary;
  columns: ColumnDef[]; columnOrder: string[]; columnWidths: Record<string, number>;
  frozenSet: Set<string>; visibleSet: Set<string>;
  onReorder: (id: string, dir: -1|1) => void;
  onResize: (id: string, width: number) => void;
  onToggleVisible: (id: string) => void;
  onToggleFrozen: (id: string) => void;
  onRowClick: (row: ReconRow) => void;
  afterSaleRecords: any[]; shippingInsurance: any[];
}) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all'|'diff'|'unmatched'|'subsidy'>('all');
  const [threshold, setThreshold] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [showColConfig, setShowColConfig] = useState(false);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [tooltipCell, setTooltipCell] = useState<{col: ColumnDef; row: ReconRow; x: number; y: number} | null>(null);
  const [resizing, setResizing] = useState<{id: string; startX: number; startWidth: number} | null>(null);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showTotal, setShowTotal] = useState(true);
  const [filterOpenCol, setFilterOpenCol] = useState<string | null>(null);
  const [columnFilterSets, setColumnFilterSets] = useState<Record<string, Set<string>>>({});
  const [fullScreen, setFullScreen] = useState(false);
  const [pageSize, setPageSize] = useState(200);
  const [page, setPage] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{rowIdx: number; colId: string} | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableElementRef = useRef<HTMLTableElement>(null);

  // Column resize handling
  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(40, resizing.startWidth + diff);
      onResize(resizing.id, newWidth);
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, onResize]);

  // Column drag handling
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDragCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };
  const handleDrop = (colId: string) => {
    if (dragCol && dragCol !== colId) {
      const order = [...columnOrder];
      const fromIdx = order.indexOf(dragCol);
      const toIdx = order.indexOf(colId);
      if (fromIdx !== -1 && toIdx !== -1) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, dragCol);
        // Apply reorder by moving one step at a time
        const dir = toIdx > fromIdx ? 1 : -1;
        onReorder(dragCol, dir);
      }
    }
    setDragCol(null);
    setDragOverCol(null);
  };

  const handleSort = (id: string) => {
    if (sortKey === id) setSortAsc(!sortAsc);
    else { setSortKey(id); setSortAsc(false); }
  };

  const handleColumnFilterToggle = (colId: string, value: string) => {
    setColumnFilterSets(prev => {
      const next = { ...prev };
      const set = next[colId] ? new Set(next[colId]) : new Set<string>();
      if (set.has(value)) set.delete(value);
      else set.add(value);
      if (set.size > 0) next[colId] = set;
      else delete next[colId];
      return next;
    });
    setPage(0);
  };
  const handleColumnFilterSelectAll = (colId: string, values: string[]) => {
    setColumnFilterSets(prev => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
    setPage(0);
  };
  const handleColumnFilterClear = (colId: string, allValues: string[]) => {
    setColumnFilterSets(prev => {
      const next = { ...prev };
      // 排除所有值 → 什么都不显示
      next[colId] = new Set(allValues);
      return next;
    });
    setPage(0);
  };

  // Get ordered visible columns
  const orderedCols = useMemo(() => {
    return columnOrder
      .filter(id => visibleSet.has(id))
      .map(id => columns.find(c => c.id === id))
      .filter(Boolean) as ColumnDef[];
  }, [columnOrder, visibleSet, columns]);

  const frozenCols = orderedCols.filter(c => frozenSet.has(c.id));
  const scrollCols = orderedCols.filter(c => !frozenSet.has(c.id));

  // Filter and sort rows
  const displayRowsAll = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x => x.orderNo.includes(q) || x.productName.toLowerCase().includes(q) || x.orderStatus.includes(q));
    }
    if (filterMode === 'diff') r = r.filter(x => x.hasActualData && (Math.abs(x.commissionShould-x.commissionActual)>0.01||Math.abs(x.insuranceShould-x.insuranceActual)>0.01));
    if (filterMode === 'unmatched') r = r.filter(x => !x.hasActualData);
    if (filterMode === 'subsidy') r = r.filter(x => x.isSubsidy);
    const minDiff = parseFloat(threshold);
    if (minDiff > 0) {
      r = r.filter(x => x.hasActualData && (Math.abs(x.commissionShould-x.commissionActual)+Math.abs(x.insuranceShould-x.insuranceActual) >= minDiff));
    }
        // Per-column multi-select filters (排除模式：勾选 = 显示，取消勾选 = 隐藏)
    const filterCols = Object.keys(columnFilterSets);
    if (filterCols.length > 0) {
      r = r.filter(row => {
        return filterCols.every(colId => {
          const excludeSet = columnFilterSets[colId];
          if (!excludeSet || excludeSet.size === 0) return true;
          const col = columns.find(c => c.id === colId);
          if (!col) return true;
          const cellVal = col.getValue(row);
          // 如果单元格值在排除集里 → 隐藏这一行
          return !excludeSet.has(cellVal);
        });
      });
    }
    if (sortKey) {
      const col = columns.find(c => c.id === sortKey);
      if (col) {
        r = [...r].sort((a, b) => {
          if (col.getSortValue) {
            const va = col.getSortValue(a);
            const vb = col.getSortValue(b);
            return sortAsc ? va - vb : vb - va;
          }
          const sa = col.getValue(a), sb = col.getValue(b);
          const na = parseFloat(sa.replace(/[¥+\-%,]/g, ''));
          const nb = parseFloat(sb.replace(/[¥+\-%,]/g, ''));
          if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
          return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
      }
    }
    return r;
  }, [rows, search, filterMode, sortKey, sortAsc, threshold, columns, columnFilterSets]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(displayRowsAll.length / pageSize));
  const displayRows = useMemo(() => {
    if (pageSize >= 999999) return displayRowsAll;
    const start = page * pageSize;
    return displayRowsAll.slice(start, start + pageSize);
  }, [displayRowsAll, page, pageSize]);

  // Click outside column config
  useEffect(() => {
    if (!showColConfig) return;
    const handleClick = () => setShowColConfig(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [showColConfig]);

  // Click outside filter dropdown + scroll to close
  useEffect(() => {
    if (!filterOpenCol) return;
    const handleClick = () => setFilterOpenCol(null);
    const handleScroll = () => setFilterOpenCol(null);
    // Use setTimeout to avoid the same click that opened it from closing it immediately
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
      window.addEventListener('scroll', handleScroll, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [filterOpenCol]);

  // ─── Cell selection & keyboard navigation (WPS/Excel-style) ──────
  const handleCellClick = useCallback((rowIdx: number, colId: string) => {
    setSelectedCell({ rowIdx, colId });
  }, []);

  const handleCellDoubleClick = useCallback((rowIdx: number, colId: string) => {
    // Excel-style: double-click to open detail drawer (via row click)
    if (displayRows[rowIdx]) {
      onRowClick(displayRows[rowIdx]);
    }
  }, [displayRows, onRowClick]);

  // Keyboard navigation on the table
  useEffect(() => {
    const tableEl = tableElementRef.current;
    if (!tableEl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      // Don't handle if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const { rowIdx, colId } = selectedCell;
      const colIndex = orderedCols.findIndex(c => c.id === colId);
      if (colIndex === -1) return;

      let newRow = rowIdx;
      let newCol = colIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newRow = Math.min(displayRows.length - 1, rowIdx + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newRow = Math.max(0, rowIdx - 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newCol = Math.max(0, colIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newCol = Math.min(orderedCols.length - 1, colIndex + 1);
          break;
        case 'Tab':
          e.preventDefault();
          newCol = e.shiftKey ? Math.max(0, colIndex - 1) : Math.min(orderedCols.length - 1, colIndex + 1);
          break;
        case 'Enter':
          e.preventDefault();
          newRow = Math.min(displayRows.length - 1, rowIdx + 1);
          break;
        case 'Home':
          e.preventDefault();
          newCol = 0;
          break;
        case 'End':
          e.preventDefault();
          newCol = orderedCols.length - 1;
          break;
        default:
          return; // not a navigation key
      }

      if (newRow !== rowIdx || orderedCols[newCol]?.id !== colId) {
        setSelectedCell({ rowIdx: newRow, colId: orderedCols[newCol]?.id || colId });
        // Scroll the cell into view
        const cellEl = tableEl.querySelector(`[data-cell-idx="${newRow}-${orderedCols[newCol]?.id}"]`);
        if (cellEl) {
          cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, orderedCols, displayRows.length]);

  const getTotal = (id: string): number | null => {
    if (id === 'merchantReceived') return summary.totalMerchantReceived;
    if (id === 'userPaid') return summary.totalUserPaid;
    if (id === 'refundAmount') return summary.totalRefundAmount;
    if (id === 'commissionShould') return summary.totalCommissionShould;
    if (id === 'commissionActual') return summary.totalCommissionActual;
    if (id === 'commissionDiff') return summary.totalCommissionDiff;
    if (id === 'insuranceShould') return summary.totalInsuranceShould;
    if (id === 'insuranceActual') return summary.totalInsuranceActual;
    if (id === 'insuranceDiff') return summary.totalInsuranceDiff;
    if (id === 'penaltiesActual') return summary.totalPenalties;
    if (id === 'marketingActual') return summary.totalMarketing;
    if (id === 'productCost') return summary.totalProductCost;
    if (id === 'totalFees') return summary.totalFeesActual;
    if (id === 'grossProfit') return summary.totalGrossProfit;
    if (id === 'afterSaleAmount') return rows.reduce((s, r) => s + r.afterSaleAmount, 0);
    return null;
  };

  // Find last frozen column id for separator shadow
  const lastFrozenId = useMemo(() => {
    let last: string | null = null;
    for (const c of orderedCols) {
      if (frozenSet.has(c.id)) last = c.id;
    }
    return last;
  }, [orderedCols, frozenSet]);

  return (
    <div className="space-y-2">


      {/* Table container */}
      <div className={'border border-pdd-border rounded-lg overflow-hidden bg-pdd-card '+(fullScreen ? 'fixed inset-0 z-50 rounded-none border-0' : '')}>
        {/* Internal toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-pdd-border/30 bg-pdd-card text-[10px] text-pdd-text-secondary select-none">
          <div className="flex items-center gap-3">
            <span>共 <b className="text-pdd-text">{displayRowsAll.length}</b> 行</span>
            <span>展示 <b className="text-pdd-text">{displayRows.length}</b> 行</span>
            <span className="text-pdd-text-secondary/30">|</span>
            <span><b className="text-pdd-text">{orderedCols.length}</b> 列</span>
            {sortKey && <span>排序: <b className="text-pdd-text">{columns.find(c=>c.id===sortKey)?.label||''}</b> {sortAsc ? '↑' : '↓'}</span>}
            {Object.keys(columnFilterSets).length > 0 && <span>筛选 <b className="text-pdd-primary">{Object.keys(columnFilterSets).length}</b> 列</span>}
            <span className="text-pdd-text-secondary/40">冻 {frozenSet.size}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 列设置按钮 */}
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowColConfig(!showColConfig); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-pdd-bg/60 text-pdd-text-secondary"
                title="列设置">
                <Settings size={12} />
              </button>
              {showColConfig && (
                <div className="absolute right-0 top-full mt-1 z-[9999] bg-pdd-card border border-pdd-border rounded-lg shadow-xl"
                  onClick={e => e.stopPropagation()}>
                  <ColumnConfig
                    columns={columns}
                    order={columnOrder}
                    onChangeOrder={onReorder}
                    frozenSet={frozenSet}
                    onToggleFrozen={onToggleFrozen}
                    visibleSet={visibleSet}
                    onToggleVisible={onToggleVisible}
                  />
                </div>
              )}
            </div>
            <button onClick={() => { setPage(0); setFullScreen(!fullScreen); }}
              className={'flex items-center gap-1 px-2 py-0.5 rounded '+(fullScreen ? 'bg-pdd-danger/10 text-pdd-danger' : 'hover:bg-pdd-bg/60 text-pdd-text-secondary')}
              title={fullScreen ? '退出全屏' : '全屏查看'}>{'⬶'}</button>
          </div>
        </div>
        <div className="overflow-auto" ref={tableRef}
          style={fullScreen ? { maxHeight: 'calc(100vh - 80px)', minHeight: '100vh' } : { maxHeight: 'calc(100vh - 370px)', minHeight: 200 }}>
          
          <table ref={tableElementRef} className="w-full text-xs whitespace-nowrap" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            {/* Column group header row */}
            {orderedCols.length > 0 && (
              <thead>
                <tr className="border-b border-pdd-border/60">
                  <th className="sticky top-0 left-0 z-40 py-1.5 px-2 text-center text-[10px] text-pdd-text-secondary/60 font-medium"
                    style={{ width: 40, minWidth: 40, backgroundColor: 'var(--pdd-bg)', borderRight: '1px solid var(--pdd-border)' }}>
                    #
                  </th>
                  {(() => {
                    // Group columns by their group key for the group header row
                    const groups: { key: string; cols: ColumnDef[] }[] = [];
                    orderedCols.forEach(c => {
                      const existing = groups.find(g => g.key === c.group);
                      if (existing) existing.cols.push(c);
                      else groups.push({ key: c.group, cols: [c] });
                    });
                    let groupLeftPos = 36;
                    return groups.map(g => {
                      const theme = GROUP_THEME[g.key] || { solidBg: '#F9FAFB', text: '#999', border: 'transparent' };
                      const totalWidth = g.cols.reduce((s, c) => s + (columnWidths[c.id] || c.width), 0);
                      const groupLabel = COLUMN_GROUPS.find(cg => cg.key === g.key)?.label || g.key;
                      const groupHasFrozen = g.cols.some(c => frozenSet.has(c.id));
                      const isFrozenGroup = g.cols.every(c => frozenSet.has(c.id));
                      const thisLeft = isFrozenGroup ? groupLeftPos : undefined;
                      if (isFrozenGroup) groupLeftPos += totalWidth;
                      return (
                        <th key={g.key} colSpan={g.cols.length}
                          className={'sticky top-0 z-30 py-1 px-2 text-[9px] font-semibold uppercase tracking-wider text-center '+(isFrozenGroup ? 'z-35 ' : '')}
                          style={{ width: totalWidth, backgroundColor: theme.solidBg, color: theme.text, left: thisLeft, borderRight: '1px solid var(--pdd-border)' }}>
                          {groupLabel}
                        </th>
                      );
                    });
                  })()}
                </tr>
                {/* Column header row */}
                <tr className="border-b border-pdd-border/50">
                  <th className="sticky top-[28px] left-0 z-40 py-1 px-2 text-pdd-text-secondary/50 text-[10px] font-medium text-center"
                    style={{ width: 40, minWidth: 40, backgroundColor: 'var(--pdd-bg)', borderRight: '1px solid var(--pdd-border)' }}>
                    #
                  </th>
                  {orderedCols.map(c => {
                    const w = columnWidths[c.id] || c.width;
                    const isDragOver = dragOverCol === c.id;
                    const isFrozen = frozenSet.has(c.id);
                    const isLastFrozen = isFrozen && c.id === lastFrozenId;
                    // Calculate left position for frozen columns
                    let leftPos: number | undefined;
                    if (isFrozen) {
                      leftPos = 36;
                      for (const fc of orderedCols) {
                        if (fc.id === c.id) break;
                        if (frozenSet.has(fc.id)) leftPos += (columnWidths[fc.id] || fc.width);
                      }
                    }
                    return (
                      <th key={c.id} data-col-id={c.id}
                        draggable
                        onDragStart={e => handleDragStart(e, c.id)}
                        onDragOver={e => handleDragOver(e, c.id)}
                        onDrop={() => handleDrop(c.id)}
                        onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
                        onMouseEnter={() => setHoveredCol(c.id)}
                        onMouseLeave={() => setHoveredCol(null)}
                        onClick={() => handleSort(c.id)}
                        className={'sticky top-[28px] z-30 py-1 px-2 text-[11px] font-medium select-none '+
                          (isDragOver ? 'bg-pdd-primary/10 ' : '')+
                          (isFrozen ? 'z-35 ' : '')+
                          (c.align === 'right' ? 'text-right ' : c.align === 'center' ? 'text-center ' : 'text-left ')}
                        style={{ width: w, minWidth: w, maxWidth: w * 2, left: leftPos,
                          backgroundColor: isDragOver ? undefined : 'var(--pdd-bg)',
                          borderRight: isLastFrozen ? '2px solid rgba(0,0,0,0.2)' : '1px solid var(--pdd-border)',
                          boxShadow: isLastFrozen ? undefined : undefined }}>
                        <div className="flex items-center gap-1">
                          <span className="text-pdd-text-secondary truncate">{c.label}</span>                          <span className="flex items-center gap-0.5 ml-auto">                            {c.id !== 'orderNo' && c.id !== 'productName' && (                              <span onClick={e => { e.stopPropagation(); setFilterOpenCol(filterOpenCol === c.id ? null : c.id); }}                                className={'inline-block text-[9px] cursor-pointer rounded px-0.5 '+(columnFilterSets[c.id] ? 'text-pdd-primary bg-pdd-primary/10' : 'text-pdd-text-secondary/30 hover:text-pdd-text-secondary')}                                title="筛选此列">▾</span>                            )}                            {sortKey === c.id && <span className="text-[9px] text-pdd-primary">{sortAsc ? '↑' : '↓'}</span>}                          </span>
                        </div>
                        {c.formula && <div className="text-[8px] text-pdd-text-secondary/30 font-normal leading-none mt-0.5">{c.formula}</div>}
                        <ResizeHandle onResizeStart={(e) => {
                          e.preventDefault();
                          setResizing({ id: c.id, startX: e.clientX, startWidth: w });
                        }} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}

          {/* === DATA ROWS === */}
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={orderedCols.length + 1} className="py-16 text-center text-pdd-text-secondary/50 text-xs"
                  style={{ borderBottom: '1px solid var(--pdd-border)' }}>
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={28} className="text-pdd-text-secondary/20" />
                    <span>暂无数据</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayRows.map((row, i) => (
                <tr key={row.orderNo}
                  className={'border-b border-pdd-border/20 hover:bg-pdd-bg/40 cursor-pointer transition-colors ' +
                    (i % 2 === 0 ? 'bg-pdd-card' : 'bg-pdd-bg/20')}
                >
                  <td className="sticky left-0 z-20 py-1 px-2 text-center text-[10px] text-pdd-text-secondary/40 select-none"
                    style={{ width: 40, minWidth: 40, backgroundColor: 'var(--pdd-bg)', borderRight: '1px solid var(--pdd-border)' }}>
                    {page * pageSize + i + 1}
                  </td>
                  {orderedCols.map(c => {
                    const val = c.getValue(row);
                    const color = c.getColor ? c.getColor(row) : '';
                    const isFrozen = frozenSet.has(c.id);
                    const isLastFrozen = isFrozen && c.id === lastFrozenId;
                    // Calculate left position for frozen columns
                    let leftPos: number | undefined;
                    if (isFrozen) {
                      leftPos = 36;
                      for (const fc of orderedCols) {
                        if (fc.id === c.id) break;
                        if (frozenSet.has(fc.id)) leftPos += (columnWidths[fc.id] || fc.width);
                      }
                    }
                    return (
                      <td key={c.id} data-cell-idx={`${i}-${c.id}`}
                        onMouseEnter={(e) => {
                          if (c.tooltip) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipCell({ col: c, row, x: rect.right + 4, y: rect.top - 4 });
                          }
                        }}
                        onMouseLeave={() => setTooltipCell(null)}
                        onClick={() => handleCellClick(i, c.id)}
                        onDoubleClick={() => handleCellDoubleClick(i, c.id)}
                        className={'py-0.5 px-1.5 text-[11px] tabular-nums cursor-pointer '+
                          (c.align === 'right' ? 'text-right ' : c.align === 'center' ? 'text-center ' : 'text-left ') +
                          (isFrozen ? 'sticky z-10 bg-pdd-card ' : 'bg-pdd-card ') +
                          (c.id === 'grossProfit' || c.id === 'grossProfitMargin' ? 'font-medium ' : '') +
                          (selectedCell?.rowIdx === i && selectedCell?.colId === c.id ? 'ring-2 ring-inset ring-pdd-primary/70 ' : '')
                        }
                        style={{
                          width: columnWidths[c.id] || c.width,
                          color: color || undefined,
                          left: leftPos,
                          borderRight: isLastFrozen ? '2px solid rgba(0,0,0,0.2)' : '1px solid var(--pdd-border)',
                          borderBottom: '1px solid var(--pdd-border)',
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>

          {/* === TOTALS ROW === */}
          {showTotal && displayRows.length > 0 && (
            <tfoot>
              <tr className="sticky bottom-0 z-30 border-t-2 border-pdd-border/60 bg-pdd-card shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
                <th className="sticky bottom-0 left-0 z-40 py-1 px-2 text-center text-[10px] font-semibold text-pdd-text select-none"
                  style={{ width: 40, minWidth: 40, backgroundColor: 'var(--pdd-bg)', borderRight: '1px solid var(--pdd-border)' }}>
                  合计
                </th>
                {orderedCols.map(c => {
                  const total = getTotal(c.id);
                  const isFrozen = frozenSet.has(c.id);
                  const isLastFrozen = isFrozen && c.id === lastFrozenId;
                  let leftPos: number | undefined;
                  if (isFrozen) {
                    leftPos = 36;
                    for (const fc of orderedCols) {
                      if (fc.id === c.id) break;
                      if (frozenSet.has(fc.id)) leftPos += (columnWidths[fc.id] || fc.width);
                    }
                  }
                  return (
                    <td key={c.id}
                      className={'py-1 px-2 text-[11px] font-semibold tabular-nums ' +
                        (c.align === 'right' ? 'text-right ' : c.align === 'center' ? 'text-center ' : 'text-left ') +
                        (isFrozen ? 'bg-pdd-card sticky bottom-0 z-30 ' : '') +
                        (total !== null ? 'text-pdd-text' : 'text-pdd-text-secondary/50')
                      }
                      style={{
                        width: columnWidths[c.id] || c.width,
                        left: leftPos,
                        borderRight: isLastFrozen ? '2px solid rgba(0,0,0,0.2)' : '1px solid var(--pdd-border)',
                        borderBottom: '1px solid var(--pdd-border)',
                      }}
                    >
                      {total !== null ? '¥' + total.toFixed(2) : '-'}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>

        {/* === Filter Dropdown (fixed position at column header) === */}
        {filterOpenCol && (() => {
          const col = columns.find(c => c.id === filterOpenCol);
          if (!col) return null;
          const allValues = new Set<string>();
          displayRowsAll.forEach(r => allValues.add(col.getValue(r)));
          const sortedValues = Array.from(allValues).sort();
          const activeSet = columnFilterSets[filterOpenCol] || new Set();
          const thEl = tableRef.current?.querySelector(`[data-col-id="${filterOpenCol}"]`);
          let leftPos = 200, topPos = 200;
          if (thEl) {
            const rect = thEl.getBoundingClientRect();
            leftPos = rect.left;
            topPos = rect.bottom + 2;
          }
          return (
            <div className="fixed z-[9999]" style={{ left: leftPos, top: topPos }}
              onClick={e => e.stopPropagation()}>
              <div className="bg-pdd-card border border-pdd-border rounded-lg shadow-xl py-1.5 min-w-[180px] max-h-[320px] overflow-y-auto">
                <div className="flex items-center justify-between px-2.5 pb-1.5 border-b border-pdd-border/20 mb-1">
                  <span className="text-[10px] font-medium text-pdd-text">{col.label}</span>
                  <button onClick={() => setFilterOpenCol(null)}
                    className="text-pdd-text-secondary/40 hover:text-pdd-text-secondary text-[9px] px-1">✕</button>
                </div>
                <div className="flex items-center gap-2 px-2.5 pb-1.5 border-b border-pdd-border/20 mb-1">
                  <button onClick={() => handleColumnFilterSelectAll(filterOpenCol, sortedValues)}
                    className="text-[10px] text-pdd-primary hover:underline">全选</button>
                  <button onClick={() => handleColumnFilterClear(filterOpenCol, sortedValues)}
                    className="text-[10px] text-pdd-danger hover:underline">清除</button>
                </div>
                {sortedValues.map(v => (
                  <label key={v} className="flex items-center gap-2 px-2.5 py-1 hover:bg-pdd-bg/40 cursor-pointer text-xs">
                    <input type="checkbox" checked={!activeSet || !activeSet.has(v)}
                      onChange={() => handleColumnFilterToggle(filterOpenCol, v)}
                      className="w-3 h-3 rounded border-pdd-border text-pdd-primary focus:ring-pdd-primary/30" />
                    <span className="text-pdd-text truncate">{v}</span>
                  </label>
                ))}
                {sortedValues.length === 0 && (
                  <div className="px-2.5 py-2 text-[10px] text-pdd-text-secondary/40 text-center">无可用值</div>
                )}
              </div>
            </div>
          );
        })()}
      </div> {/* overflow-auto */}

      {/* === Pagination Footer === */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-pdd-border/30 bg-pdd-card text-[10px] text-pdd-text-secondary select-none">
        <div className="flex items-center gap-2">
          <span>每页</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="text-[10px] border border-pdd-border/40 rounded px-1 py-0.5 bg-pdd-card text-pdd-text outline-none focus:border-pdd-primary/40">
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={999999}>全部</option>
          </select>
          <span className="text-pdd-text-secondary/40">|</span>
          <span>共 <b className="text-pdd-text">{displayRowsAll.length}</b> 行</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page <= 0}
            className={'px-2 py-0.5 rounded border border-pdd-border/30 text-[10px] ' + (page <= 0 ? 'text-pdd-text-secondary/20 cursor-not-allowed' : 'hover:bg-pdd-bg/60 text-pdd-text-secondary')}>
            上一页
          </button>
          <span className="text-pdd-text text-[10px]">{page + 1}/{totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className={'px-2 py-0.5 rounded border border-pdd-border/30 text-[10px] ' + (page >= totalPages - 1 ? 'text-pdd-text-secondary/20 cursor-not-allowed' : 'hover:bg-pdd-bg/60 text-pdd-text-secondary')}>
            下一页
          </button>
        </div>
      </div>
    </div>


    {tooltipCell && (
      <div className="fixed z-[9999] pointer-events-none" style={{ left: tooltipCell.x, top: tooltipCell.y }}>
        <div className="bg-pdd-card border border-pdd-border/50 rounded-lg shadow-lg p-2.5">
          <CellInfo col={tooltipCell.col} row={tooltipCell.row} />
        </div>
      </div>
    )}
  </div>
);
}

// ============================================================
// MAIN PAGE — 对账中心（单屏高自由度）
// ============================================================

export default function ReconciliationPage() {
  const {
    currentDisplayData, orderFinancialActuals, unlinkedFinancials,
    platformCommissionRate, setPlatformCommissionRate,
    subsidyCommissionRate,
    insuranceFeePerOrder, productCosts, packagingFeePerOrder,
    shippingFeePerOrder, laborFeePerOrder,   // ★ 新增：快递费 + 人工费
    syncStatus, dataLoading,
  } = useData();

  const orders = currentDisplayData.orders || [];
  const financialRecords = currentDisplayData.financialRecords || [];
  const afterSaleRecords = currentDisplayData.afterSaleRecords || [];
  const shippingInsurance = currentDisplayData.shippingInsurance || [];

  // Data computation
  const rows = useMemo(() => {
    return buildReconRows(
      orders, orderFinancialActuals || {},
      platformCommissionRate, subsidyCommissionRate,
      insuranceFeePerOrder,
      productCosts, packagingFeePerOrder,
      afterSaleRecords,
      shippingFeePerOrder, laborFeePerOrder,  // ★ 新增：完整成本参数
    );
  }, [orders, orderFinancialActuals, platformCommissionRate, subsidyCommissionRate, insuranceFeePerOrder, productCosts, packagingFeePerOrder, afterSaleRecords, shippingFeePerOrder, laborFeePerOrder]);

  const summary = useMemo(() => {
    const s = computeSummary(rows);
    const matchedRows = rows.filter(r => r.hasActualData);
    const refundCount = rows.filter(r => r.refundAmount > 0.01).length;
    const unmatchedCount = (unlinkedFinancials?.records?.length) || 0;
    return {
      ...s,
      currentCommissionRate: platformCommissionRate,
      averageInsuranceFee: matchedRows.length > 0
        ? matchedRows.reduce((a, r) => a + r.insuranceActual, 0) / matchedRows.length
        : insuranceFeePerOrder,
      refundOrderCount: refundCount,
      unmatchedFinancials: unmatchedCount,
    };
  }, [rows, platformCommissionRate, insuranceFeePerOrder, unlinkedFinancials]);

  const balance = useMemo(() => {
    return computeBalance(financialRecords, rows);
  }, [financialRecords, rows]);

  const marketingBreakdown = useMemo(() => {
    return computeMarketingBreakdown(
      currentDisplayData.promotionProducts || [],
      currentDisplayData.liveStreamSummary || [],
      currentDisplayData.starStoreSummary || [],
    );
  }, [currentDisplayData]);

  // Column state
  const [columnOrder, setColumnOrder] = useState<string[]>(() => COLUMNS.map(c => c.id));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    COLUMNS.forEach(c => { w[c.id] = c.width; });
    return w;
  });
  const [visibleSet, setVisibleSet] = useState<Set<string>>(() => new Set([
    'orderNo','productName','payTime','subsidyTag',
    'merchantReceived','userPaid',
    'commissionShould','commissionActual','commissionDiff',
    'insuranceShould','insuranceActual','insuranceDiff',
    'penaltiesActual','totalFees','grossProfit','grossProfitMargin',
  ]));
  const [frozenSet, setFrozenSet] = useState<Set<string>>(() => new Set(['orderNo','productName']));

  // Opening balance
  const [openingBalance, setOpeningBalanceRaw] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem('meoo_recon_ob') || '0') || 0; } catch { return 0; }
  });
  const setOpeningBalance = useCallback((v: number) => {
    setOpeningBalanceRaw(v);
    try { localStorage.setItem('meoo_recon_ob', String(v)); } catch {}
  }, []);

  // Detail drawer state
  const [selectedRow, setSelectedRow] = useState<ReconRow | null>(null);

  // Column handlers
  const handleReorder = useCallback((id: string, dir: -1 | 1) => {
    setColumnOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  const handleResize = useCallback((id: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [id]: width }));
  }, []);

  const handleToggleVisible = useCallback((id: string) => {
    setVisibleSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleToggleFrozen = useCallback((id: string) => {
    setFrozenSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Export
  const handleExport = useCallback(() => {
    const csvHeaders = COLUMNS.map(c => c.label);
    const csvRows: any[][] = rows.map(r => COLUMNS.map(c => c.getValue(r)));
    exportCSV(csvHeaders, csvRows, '对账中心_' + new Date().toISOString().slice(0, 10));
  }, [rows]);

  return (
    <div className="p-4 lg:p-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-pdd-primary/20 to-purple-500/10 border border-pdd-primary/10">
            <Calculator size={18} className="text-pdd-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-pdd-text">对账中心</h1>
            <p className="text-[10px] text-pdd-text-secondary">平台结算 vs 订单系统 · 单屏全览</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dataLoading && <RefreshCw size={13} className="animate-spin text-pdd-text-secondary" />}
          <span className={'text-[10px] px-2 py-0.5 rounded '+(syncStatus==='done'?'bg-pdd-success/10 text-pdd-success':'bg-pdd-warning/10 text-pdd-warning')}>
            {syncStatus==='done'?'已同步':'同步中'}
          </span>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-pdd-border/60 text-xs text-pdd-text-secondary hover:text-pdd-text transition-colors">
            <Download size={13} /> 导出CSV
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <SummaryBar rows={rows} summary={summary} balance={balance} />

      {/* ★ 成本剖析 — 完整成本构成 + 差额分析 + 缺失警告 */}
      <CostBreakdownSummary
        summary={summary}
        rows={rows}
        shippingFeePerOrder={shippingFeePerOrder}
        laborFeePerOrder={laborFeePerOrder}
        packagingFeePerOrder={packagingFeePerOrder}
      />

      {/* Main data table */}
      <UnifiedTable
        rows={rows} summary={summary}
        columns={COLUMNS}
        columnOrder={columnOrder} columnWidths={columnWidths}
        frozenSet={frozenSet} visibleSet={visibleSet}
        onReorder={handleReorder}
        onResize={handleResize}
        onToggleVisible={handleToggleVisible}
        onToggleFrozen={handleToggleFrozen}
        onRowClick={(r) => setSelectedRow(r)}
        afterSaleRecords={afterSaleRecords}
        shippingInsurance={shippingInsurance}
      />

      {/* Balance reconciliation (collapsible at bottom) */}
      <BalanceReconPanel
        balance={balance} rows={rows} summary={summary}
        unlinked={unlinkedFinancials}
        openingBalance={openingBalance}
        onSetOpeningBalance={setOpeningBalance}
        marketingBreakdown={marketingBreakdown}
      />

      {/* Detail drawer */}
      <DetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        afterSaleRecords={afterSaleRecords}
        shippingInsurance={shippingInsurance}
      />
    </div>
  );
}

// ============================================================
// Balance Reconciliation Panel (可折叠)
// ============================================================
function BalanceReconPanel({ balance, rows, summary, unlinked, openingBalance, onSetOpeningBalance, marketingBreakdown }: {
  balance: BalanceReconciliation;
  rows: ReconRow[];
  summary: ReconSummary;
  unlinked: UnlinkedFinancials | null;
  openingBalance: number;
  onSetOpeningBalance: (v: number) => void;
  marketingBreakdown: MarketingBreakdown;
}) {
  const [open, setOpen] = useState(true);
  const [feeOpen, setFeeOpen] = useState<Record<string, boolean>>({});
  const [obEdit, setObEdit] = useState(false);
  const [obVal, setObVal] = useState(String(openingBalance));

  const effectiveTotal = balance.platformNet - openingBalance;
  const finalDiff = effectiveTotal - (balance.orderNet + balance.transitOrders);

  return (
    <div className="border border-pdd-border rounded-lg overflow-hidden bg-pdd-card">
      {/* Header */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-pdd-text bg-pdd-bg/30 hover:bg-pdd-bg/50 transition-colors">
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-pdd-primary" />
          余额核对
        </span>
        <span className={'transform transition-transform ' + (open ? 'rotate-180' : '')}>▼</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Overview grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">平台收入</p>
              <p className="text-sm font-semibold text-pdd-text">{fmt(balance.platformIncome)}</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">平台退款</p>
              <p className="text-sm font-semibold text-pdd-danger">{fmt(balance.platformRefund)}</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">平台扣费</p>
              <p className="text-sm font-semibold text-pdd-warning">{fmt(balance.platformFees)}</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">平台净额</p>
              <p className="text-sm font-semibold text-pdd-text">{fmt(balance.platformNet)}</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">订单收入</p>
              <p className="text-sm font-semibold text-pdd-text">{fmt(balance.orderIncome)}</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">订单退款</p>
              <p className="text-sm font-semibold text-pdd-danger">{fmt(balance.orderRefund)}</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">在途订单</p>
              <p className="text-sm font-semibold text-pdd-text">{fmt(balance.transitOrders)}</p>
              <p className="text-[9px] text-pdd-text-secondary">({summary.totalOrders}单中在途)</p>
            </div>
            <div className="bg-pdd-bg/40 rounded-lg p-3">
              <p className="text-[10px] text-pdd-text-secondary mb-1">订单净额</p>
              <p className="text-sm font-semibold text-pdd-text">{fmt(balance.orderNet)}</p>
            </div>
          </div>

          {/* Opening balance */}
          <div className="flex items-center gap-3 text-xs bg-pdd-bg/30 rounded-lg px-4 py-2">
            <span className="text-pdd-text-secondary">期初余额</span>
            {obEdit ? (
              <div className="flex items-center gap-1">
                <input type="number" step="0.01" value={obVal}
                  onChange={e => setObVal(e.target.value)}
                  className="w-28 text-xs border border-pdd-border/40 rounded px-2 py-0.5 bg-pdd-card text-pdd-text outline-none focus:border-pdd-primary/40"
                  autoFocus />
                <button onClick={() => { onSetOpeningBalance(parseFloat(obVal) || 0); setObEdit(false); }}
                  className="px-2 py-0.5 rounded bg-pdd-primary/10 text-pdd-primary text-[10px]">确定</button>
                <button onClick={() => { setObVal(String(openingBalance)); setObEdit(false); }}
                  className="px-2 py-0.5 rounded text-pdd-text-secondary/50 hover:text-pdd-text-secondary text-[10px]">取消</button>
              </div>
            ) : (
              <button onClick={() => { setObVal(String(openingBalance)); setObEdit(true); }}
                className="px-2 py-0.5 rounded bg-pdd-bg/60 border border-pdd-border/30 text-pdd-text font-mono text-xs hover:border-pdd-primary/30">
                {fmt(openingBalance)}
              </button>
            )}
            <span className="text-pdd-text-secondary/40">|</span>
            <span className="text-pdd-text-secondary">平台净额 - 期初 = <b className="text-pdd-text">{fmt(effectiveTotal)}</b></span>
            <span className="text-pdd-text-secondary/40">|</span>
            <span className="text-pdd-text-secondary">差异 = <b className={Math.abs(finalDiff) < 0.01 ? 'text-pdd-success' : 'text-pdd-danger'}>
              {fmt(finalDiff, true)}
            </b></span>
            {Math.abs(finalDiff) < 0.01 && <span className="text-pdd-success text-[10px]">✓ 平衡</span>}
          </div>

          {/* Fee breakdown */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider">扣费构成</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { key: 'commission', label: '佣金', total: summary.totalCommissionActual, color: '#3B82F6' },
                { key: 'insurance', label: '保费', total: summary.totalInsuranceActual, color: '#10B981' },
                { key: 'penalties', label: '罚款', total: summary.totalPenalties, color: '#EF4444' },
                { key: 'marketing', label: '营销', total: summary.totalMarketing, color: '#F59E0B' },
              ].map(fee => (
                <div key={fee.key} className="bg-pdd-bg/20 rounded-lg p-2.5 relative cursor-pointer hover:bg-pdd-bg/40 transition-colors"
                  onClick={() => setFeeOpen(prev => ({ ...prev, [fee.key]: !prev[fee.key] }))}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-pdd-text-secondary">{fee.label}</span>
                    <span className="text-[9px]" style={{ color: fee.color }}>{feeOpen[fee.key] ? '▲' : '▼'}</span>
                  </div>
                  <p className="text-xs font-semibold text-pdd-text">{fmt(fee.total)}</p>
                  <p className="text-[9px] text-pdd-text-secondary">{pct(fee.total, summary.totalFeesActual)}</p>
                </div>
              ))}
            </div>

            {/* Marketing channel detail */}
            {feeOpen.marketing && marketingBreakdown.channels.length > 0 && (
              <div className="bg-pdd-bg/20 rounded-lg p-3 mt-1">
                <p className="text-[10px] font-medium text-pdd-text-secondary mb-2">营销渠道明细</p>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-pdd-border/20 text-pdd-text-secondary/60">
                      <th className="text-left py-1 pr-2">渠道</th>
                      <th className="text-right py-1 px-2">花费</th>
                      <th className="text-right py-1 px-2">GMV</th>
                      <th className="text-right py-1 pl-2">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketingBreakdown.channels.map((ch, i) => (
                      <React.Fragment key={i}>
                        <tr className="border-b border-pdd-border/10">
                          <td className="py-1 pr-2 text-pdd-text font-medium">{ch.label}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-pdd-text">{fmt(ch.cost)}</td>
                          <td className="py-1 px-2 text-right tabular-nums text-pdd-text">{ch.gmv > 0 ? fmt(ch.gmv) : '-'}</td>
                          <td className="py-1 pl-2 text-right tabular-nums" style={{ color: ch.cost > 0 ? (ch.gmv / ch.cost >= 3 ? '#10B981' : '#F59E0B') : 'inherit' }}>
                            {ch.cost > 0 ? (ch.gmv / ch.cost).toFixed(2) : '-'}
                          </td>
                        </tr>
                        {ch.children?.map((sub, j) => (
                          <tr key={`${i}-${j}`} className="border-b border-pdd-border/5">
                            <td className="py-0.5 pr-2 text-pdd-text-secondary pl-3">└ {sub.channel}</td>
                            <td className="py-0.5 px-2 text-right tabular-nums text-pdd-text-secondary">{fmt(sub.cost)}</td>
                            <td className="py-0.5 px-2 text-right tabular-nums text-pdd-text-secondary">{sub.gmv > 0 ? fmt(sub.gmv) : '-'}</td>
                            <td className="py-0.5 pl-2 text-right tabular-nums text-pdd-text-secondary">{sub.cost > 0 ? (sub.gmv / sub.cost).toFixed(2) : '-'}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unlinked financial records */}
          {unlinked && unlinked.records.length > 0 && (
            <div className="bg-pdd-warning/5 border border-pdd-warning/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-pdd-warning" />
                <span className="text-[10px] font-semibold text-pdd-warning">未关联扣费（{unlinked.records.length}条）</span>
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-pdd-warning/20 text-pdd-warning/60">
                    <th className="text-left py-1 pr-2">时间</th>
                    <th className="text-left py-1 px-2">类型</th>
                    <th className="text-left py-1 px-2">说明</th>
                    <th className="text-right py-1 pl-2">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {unlinked.records.map((r, i) => (
                    <tr key={i} className="border-b border-pdd-warning/10">
                      <td className="py-1 pr-2 text-pdd-text">{r.time}</td>
                      <td className="py-1 px-2">
                        <span className="px-1 py-0.5 rounded bg-pdd-warning/10 text-pdd-warning text-[9px]">{r.type}</span>
                      </td>
                      <td className="py-1 px-2 text-pdd-text-secondary">{r.desc}</td>
                      <td className="py-1 pl-2 text-right tabular-nums text-pdd-danger">-{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Balance difference breakdown */}
          <div className="bg-pdd-bg/40 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-pdd-text-secondary mb-2">差额分析</p>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between py-0.5">
                <span className="text-pdd-text-secondary">平台净额</span>
                <span className="text-pdd-text font-mono">{fmt(balance.platformNet)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-pdd-text-secondary">期初余额</span>
                <span className="text-pdd-text font-mono">- {fmt(openingBalance)}</span>
              </div>
              <div className="flex justify-between py-0.5 border-t border-pdd-border/20 pt-1">
                <span className="text-pdd-text">有效平台净额</span>
                <span className="text-pdd-text font-semibold font-mono">{fmt(effectiveTotal)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-pdd-text-secondary">订单净额</span>
                <span className="text-pdd-text font-mono">- {fmt(balance.orderNet)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-pdd-text-secondary">在途订单</span>
                <span className="text-pdd-text font-mono">- {fmt(balance.transitOrders)}</span>
              </div>
              <div className="flex justify-between py-0.5 border-t border-pdd-border/20 pt-1">
                <span className="text-pdd-text font-semibold">最终差异</span>
                <span className={'font-semibold font-mono ' + (Math.abs(finalDiff) < 0.01 ? 'text-pdd-success' : 'text-pdd-danger')}>
                  {Math.abs(finalDiff) < 0.01 ? '✓ 平衡' : fmt(finalDiff, true)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Detail Drawer (订单详情抽屉)
// ============================================================
function DetailDrawer({ row, onClose, afterSaleRecords, shippingInsurance }: {
  row: ReconRow | null;
  onClose: () => void;
  afterSaleRecords: any[];
  shippingInsurance: any[];
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (row) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [row, onClose]);

  if (!row) return null;

  const relatedAfterSale = afterSaleRecords?.filter((r: any) =>
    String(r['订单号'] || r['原订单号'] || '').trim() === row.orderNo
  ) || [];

  const penaltyTotal = row.penaltyDetails?.reduce((s, p) => s + p.amount, 0) || 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] z-50 bg-pdd-card border-l border-pdd-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-pdd-card border-b border-pdd-border/30 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-pdd-primary" />
            <span className="text-sm font-semibold text-pdd-text">订单详情</span>
          </div>
          <button onClick={onClose}
            className="p-1 rounded hover:bg-pdd-bg/60 text-pdd-text-secondary/50 hover:text-pdd-text-secondary transition-colors">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Order info */}
          <section>
            <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">基本信息</h3>
            <div className="bg-pdd-bg/30 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">订单号</span>
                <span className="text-pdd-text font-mono text-[10px]">{row.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">商品</span>
                <span className="text-pdd-text text-right max-w-[240px] truncate">{row.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">支付日</span>
                <span className="text-pdd-text">{row.payTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">状态</span>
                <span className="text-pdd-text">{row.orderStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">补贴</span>
                <span className={row.isSubsidy ? 'text-pdd-warning' : 'text-pdd-text-secondary'}>{row.isSubsidy ? '是' : '否'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">数据匹配</span>
                <StatusBadge status={row.hasActualData ? (Math.abs(row.commissionShould - row.commissionActual) > 0.01 || Math.abs(row.insuranceShould - row.insuranceActual) > 0.01 ? 'diff' : 'matched') : 'unmatched'} />
              </div>
            </div>
          </section>

          {/* Amounts */}
          <section>
            <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">金额信息</h3>
            <div className="bg-pdd-bg/30 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">商家实收</span>
                <span className="text-pdd-text font-semibold">{fmt(row.merchantReceived)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">用户实付</span>
                <span className="text-pdd-text">{fmt(row.userPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">退款金额</span>
                <span className={row.refundAmount > 0 ? 'text-pdd-danger' : 'text-pdd-text'}>{row.refundAmount > 0 ? fmt(row.refundAmount) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">邮费</span>
                <span className="text-pdd-text">{row.shippingFee > 0 ? fmt(row.shippingFee) : '-'}</span>
              </div>
            </div>
          </section>

          {/* Fees */}
          <section>
            <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">费用明细</h3>
            <div className="bg-pdd-bg/30 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">佣金应扣</span>
                <span className="text-pdd-text">{fmt(row.commissionShould)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">佣金实扣</span>
                <span className={row.hasActualData ? 'text-pdd-text' : 'text-pdd-text-secondary'}>{row.hasActualData ? fmt(row.commissionActual) : '-'}</span>
              </div>
              {row.hasActualData && (
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">佣金差异</span>
                  <span className={Math.abs(row.commissionShould - row.commissionActual) < 0.01 ? 'text-pdd-text-secondary' : 'text-pdd-warning'}>
                    {fmtd(row.commissionShould - row.commissionActual, true)}
                  </span>
                </div>
              )}
              <div className="border-t border-pdd-border/10 my-1" />
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">保费应扣</span>
                <span className="text-pdd-text">{fmt(row.insuranceShould)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">保费实扣</span>
                <span className={row.hasActualData ? 'text-pdd-text' : 'text-pdd-text-secondary'}>{row.hasActualData ? fmt(row.insuranceActual) : '-'}</span>
              </div>
              {row.hasActualData && (
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">保费差异</span>
                  <span className={Math.abs(row.insuranceShould - row.insuranceActual) < 0.01 ? 'text-pdd-text-secondary' : 'text-pdd-warning'}>
                    {fmtd(row.insuranceShould - row.insuranceActual, true)}
                  </span>
                </div>
              )}
              <div className="border-t border-pdd-border/10 my-1" />
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">罚款</span>
                <span className={row.penaltiesActual > 0 ? 'text-pdd-danger' : 'text-pdd-text-secondary'}>{row.penaltiesActual > 0 ? fmt(row.penaltiesActual) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">营销费</span>
                <span className={row.marketingActual > 0 ? 'text-pdd-warning' : 'text-pdd-text-secondary'}>{row.marketingActual > 0 ? fmt(row.marketingActual) : '-'}</span>
              </div>
              {row.hasActualData && (
                <>
                  <div className="border-t border-pdd-border/10 my-1" />
                  <div className="flex justify-between">
                    <span className="text-pdd-text-secondary font-medium">费用合计</span>
                    <span className="text-pdd-text font-semibold">{fmt(row.commissionActual + row.insuranceActual + row.penaltiesActual + row.marketingActual)}</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Cost & Profit */}
          <section>
            <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">成本与利润</h3>
            <div className="bg-pdd-bg/30 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">商品成本</span>
                <span className={row.productCost > 0 ? 'text-pdd-text' : 'text-pdd-text-secondary'}>{row.productCost > 0 ? fmt(row.productCost) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">包装费</span>
                <span className={row.packagingFee > 0 ? 'text-pdd-text' : 'text-pdd-text-secondary'}>{row.packagingFee > 0 ? fmt(row.packagingFee) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">快递费</span>
                <span className={row.effectiveShippingFee > 0 ? 'text-pdd-text' : 'text-pdd-text-secondary'}>{row.effectiveShippingFee > 0 ? fmt(row.effectiveShippingFee) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-pdd-text-secondary">人工费</span>
                <span className={row.laborFee > 0 ? 'text-pdd-text' : 'text-pdd-text-secondary'}>{row.laborFee > 0 ? fmt(row.laborFee) : '-'}</span>
              </div>
              <div className="border-t border-pdd-border/10 my-1" />
              {row.hasActualData ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-pdd-text-secondary font-medium">毛利（含快递/人工）</span>
                    <span className={'font-semibold ' + (row.computedGrossProfit >= 0 ? 'text-pdd-success' : 'text-pdd-danger')}>
                      {fmt(row.computedGrossProfit)}
                    </span>
                  </div>
                  {row.merchantReceived > 0 && (
                    <div className="flex justify-between">
                      <span className="text-pdd-text-secondary">毛利率</span>
                      <span className={row.computedGrossProfitMargin >= 10 ? 'text-pdd-success' : row.computedGrossProfitMargin >= 0 ? 'text-pdd-warning' : 'text-pdd-danger'}>
                        {row.computedGrossProfitMargin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-pdd-text-secondary/50 text-[10px] text-center py-1">无实际数据，无法计算毛利</div>
              )}
            </div>
          </section>

          {/* Penalty details */}
          {row.penaltyDetails && row.penaltyDetails.length > 0 && (
            <section>
              <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">罚款明细（{row.penaltyDetails.length}项）</h3>
              <div className="bg-pdd-danger/5 rounded-lg p-3 space-y-2 text-xs">
                {row.penaltyDetails.map((p, i) => (
                  <div key={i} className="flex justify-between items-start border-b border-pdd-danger/10 pb-1.5 last:border-0">
                    <div>
                      <span className="text-pdd-text text-[10px]">{p.desc || p.type}</span>
                      <p className="text-[9px] text-pdd-text-secondary">{p.time}</p>
                    </div>
                    <span className="text-pdd-danger font-mono text-[10px]">-{fmt(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 font-semibold">
                  <span className="text-pdd-text-secondary">罚款合计</span>
                  <span className="text-pdd-danger">{fmt(penaltyTotal)}</span>
                </div>
              </div>
            </section>
          )}

          {/* After-sale info */}
          {relatedAfterSale.length > 0 && (
            <section>
              <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">售后记录（{relatedAfterSale.length}条）</h3>
              <div className="space-y-2">
                {relatedAfterSale.map((r: any, i: number) => (
                  <div key={i} className="bg-pdd-bg/30 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-pdd-text-secondary">类型</span>
                      <span className="text-pdd-text">{r['售后类型'] || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-pdd-text-secondary">状态</span>
                      <span className="text-pdd-text">{r['售后状态'] || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-pdd-text-secondary">金额</span>
                      <span className="text-pdd-danger">{fmt(Math.abs(sf(r['退款金额(元)'] || r['退款金额'] || 0)))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-pdd-text-secondary">时间</span>
                      <span className="text-pdd-text">{r['申请时间'] || r['创建时间'] || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Shipping insurance */}
          {shippingInsurance && shippingInsurance.length > 0 && (() => {
            const relatedSi = shippingInsurance.filter((s: any) =>
              String(s['订单号'] || '').trim() === row.orderNo
            );
            if (relatedSi.length === 0) return null;
            return (
              <section>
                <h3 className="text-[10px] font-semibold text-pdd-text-secondary uppercase tracking-wider mb-2">运费险（{relatedSi.length}条）</h3>
                <div className="space-y-2">
                  {relatedSi.map((s: any, i: number) => (
                    <div key={i} className="bg-pdd-bg/30 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-pdd-text-secondary">保费</span>
                        <span className="text-pdd-text">{fmt(sf(s['保费(元)'] || s['保费'] || 0))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-pdd-text-secondary">理赔</span>
                        <span className="text-pdd-success">{fmt(sf(s['理赔金额(元)'] || s['理赔金额'] || 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}
        </div>
      </div>
    </>
  );
}