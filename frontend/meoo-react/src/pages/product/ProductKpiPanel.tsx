/**
 * 商品分析 KPI 面板 — 直接沿用数据中心KPI系统
 *
 * 最大程度保持与数据中心KPI系统一致的UI结构：
 * - 分组搜索选择器（5列分组）
 * - 卡片拖拽排序（一排5个，最多10个）
 * - 折线图默认隐藏，点击卡片切换趋势线
 * - 纯灰卡片，无任何装饰条
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, TrendingUp, X, Search, Package, DollarSign, ShoppingCart, Percent, AlertTriangle, Zap, Clock, Activity, Target, BarChart3, RotateCcw, Eye, Shield, Tag, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChartTooltip } from '../../utils/trendData';

/* ============================================================
 * 商品分析 KPI 定义
 * ============================================================ */

export interface ProductKpiItem {
  label: string;
  key: string;
  group: string;
  icon: any;
  fmt: (v: number) => string;
}

export const ALL_PRODUCT_KPIS: ProductKpiItem[] = [
  // ── 商品概况 ──
  { label: '商品数', key: 'productCount', group: '商品概况', icon: Package, fmt: (v) => (v || 0).toFixed(0) },
  { label: '动销率', key: 'sellThroughRate', group: '商品概况', icon: Activity, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '零销品', key: 'zeroSalesCount', group: '商品概况', icon: AlertTriangle, fmt: (v) => (v || 0).toFixed(0) },
  { label: '低库存品', key: 'lowInventoryCount', group: '商品概况', icon: AlertTriangle, fmt: (v) => (v || 0).toFixed(0) },
  { label: '平均周转', key: 'avgTurnover', group: '商品概况', icon: Clock, fmt: (v) => (v || 0).toFixed(0) + '天' },
  { label: '动销商品', key: 'activeProductCount', group: '商品概况', icon: Package, fmt: (v) => (v || 0).toFixed(0) },
  { label: '新品数', key: 'newProductCount', group: '商品概况', icon: Package, fmt: (v) => (v || 0).toFixed(0) },
  { label: '平均活跃天数', key: 'avgActiveDays', group: '商品概况', icon: Activity, fmt: (v) => (v || 0).toFixed(0) + '天' },
  { label: '平均售价', key: 'avgSellingPrice', group: '商品概况', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '日均销量', key: 'avgDailySales', group: '商品概况', icon: ShoppingCart, fmt: (v) => (v || 0).toFixed(1) },
  { label: '商品生命周期', key: 'productLifecycle', group: '商品概况', icon: Clock, fmt: (v) => (v || 0).toFixed(0) + '天' },
  { label: '库存预估', key: 'inventoryEstimate', group: '商品概况', icon: Package, fmt: (v) => (v || 0) >= 10000 ? ((v || 0) / 10000).toFixed(1) + '万' : (v || 0).toFixed(0) },
  { label: '库存深度(天)', key: 'inventoryDepth', group: '商品概况', icon: BarChart3, fmt: (v) => (v || 0) > 0 ? (v || 0).toFixed(0) + '天' : '-' },
  // ── 收入 ──
  { label: '总GMV', key: 'totalGmv', group: '收入', icon: TrendingUp, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '总实收', key: 'totalRevenue', group: '收入', icon: DollarSign, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '总销量', key: 'totalSales', group: '收入', icon: ShoppingCart, fmt: (v) => (v || 0).toFixed(0) },
  { label: '客单价', key: 'avgPrice', group: '收入', icon: Target, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '总订单量', key: 'totalOrders', group: '收入', icon: ShoppingCart, fmt: (v) => (v || 0).toFixed(0) },
  { label: '单均GMV', key: 'gmvPerOrder', group: '收入', icon: TrendingUp, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '单均实收', key: 'revenuePerOrder', group: '收入', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '单均订单量', key: 'ordersPerProduct', group: '收入', icon: ShoppingCart, fmt: (v) => (v || 0).toFixed(1) },
  { label: '平均折扣率', key: 'avgDiscountRatio', group: '收入', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '退款金额', key: 'totalRefund', group: '收入', icon: RotateCcw, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '净收入', key: 'netRevenue', group: '收入', icon: DollarSign, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '折扣总额', key: 'totalDiscount', group: '收入', icon: Percent, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '退款损失率', key: 'refundLossRate', group: '收入', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '折扣率', key: 'discountRate', group: '收入', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  // ── 利润 ──
  { label: '利润总额', key: 'totalProfit', group: '利润', icon: TrendingUp, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '利润率', key: 'profitRate', group: '利润', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '单商品利润', key: 'profitPerProduct', group: '利润', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '单均利润', key: 'profitPerOrder', group: '利润', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '毛利率', key: 'grossProfitRate', group: '利润', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '毛利润', key: 'grossProfit', group: '利润', icon: DollarSign, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '税前利润', key: 'preTaxProfit', group: '利润', icon: DollarSign, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '税后净利润', key: 'netProfitAfterTax', group: '利润', icon: DollarSign, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '毛利润率', key: 'grossProfitMargin', group: '利润', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '净利率', key: 'netProfitMargin', group: '利润', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  // ── 成本 ──
  { label: '总成本', key: 'totalCost', group: '成本', icon: BarChart3, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '单品成本', key: 'avgUnitCost', group: '成本', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '单品利润', key: 'avgUnitProfit', group: '成本', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '成本率', key: 'costRate', group: '成本', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '物流成本', key: 'totalLogistics', group: '成本', icon: BarChart3, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '平台佣金', key: 'totalPlatformFee', group: '成本', icon: BarChart3, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '包装费', key: 'totalPackagingFee', group: '成本', icon: Package, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '运费', key: 'totalShippingFee', group: '成本', icon: Package, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '产品进价', key: 'totalProductCost', group: '成本', icon: Package, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '折扣/折让', key: 'totalAllowance', group: '成本', icon: Percent, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '税金', key: 'totalTaxes', group: '成本', icon: BarChart3, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '自定义扣除', key: 'totalCustomDeductions', group: '成本', icon: BarChart3, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  // ── 退款/售后 ──
  { label: '退款率', key: 'refundRate', group: '退款/售后', icon: RotateCcw, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '售后率', key: 'afterSaleRate', group: '退款/售后', icon: RotateCcw, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '高退款品', key: 'highRefundCount', group: '退款/售后', icon: AlertTriangle, fmt: (v) => (v || 0).toFixed(0) },
  { label: '退款订单数', key: 'totalRefundOrders', group: '退款/售后', icon: RotateCcw, fmt: (v) => (v || 0).toFixed(0) },
  { label: '售后订单数', key: 'totalAfterSale', group: '退款/售后', icon: RotateCcw, fmt: (v) => (v || 0).toFixed(0) },
  { label: '高售后品', key: 'highAfterSaleCount', group: '退款/售后', icon: AlertTriangle, fmt: (v) => (v || 0).toFixed(0) },
  { label: '单品退款', key: 'refundPerProduct', group: '退款/售后', icon: RotateCcw, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '售后金额', key: 'afterSaleAmount', group: '退款/售后', icon: DollarSign, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '品质退款率', key: 'qualityRefundRate', group: '退款/售后', icon: AlertTriangle, fmt: (v) => (v || 0).toFixed(1) + '%' },
  // ── 推广 ──
  { label: '推广花费', key: 'totalPromoCost', group: '推广', icon: BarChart3, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '推广ROI', key: 'avgRoi', group: '推广', icon: Activity, fmt: (v) => (v || 0) > 0 ? (v || 0).toFixed(1) : '-' },
  { label: '高推广品', key: 'highPromoCount', group: '推广', icon: Zap, fmt: (v) => (v || 0).toFixed(0) },
  { label: '推广费比', key: 'avgPromoRatio', group: '推广', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '推广成交', key: 'totalPromoTransaction', group: '推广', icon: TrendingUp, fmt: (v) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
  { label: '推广点击', key: 'totalPromoClicks', group: '推广', icon: Activity, fmt: (v) => (v || 0).toFixed(0) },
  { label: '单品推广费', key: 'avgPromoCostPerProduct', group: '推广', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '推广成交率', key: 'promoConvertRate', group: '推广', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: '最高ROI', key: 'maxRoi', group: '推广', icon: TrendingUp, fmt: (v) => (v || 0) > 0 ? (v || 0).toFixed(1) : '-' },
  { label: '最低ROI', key: 'minRoi', group: '推广', icon: TrendingUp, fmt: (v) => (v || 0) > 0 ? (v || 0).toFixed(1) : '-' },
  { label: '推广订单数', key: 'totalPromoOrders', group: '推广', icon: ShoppingCart, fmt: (v) => (v || 0).toFixed(0) },
  { label: '推广展示量', key: 'totalPromoImpressions', group: '推广', icon: Eye, fmt: (v) => (v || 0) >= 10000 ? ((v || 0) / 10000).toFixed(1) + '万' : (v || 0).toFixed(0) },
  { label: 'CPC', key: 'avgCpc', group: '推广', icon: DollarSign, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(2) : '-' },
  { label: '推广订单占比', key: 'promoOrderRatio', group: '推广', icon: Percent, fmt: (v) => (v || 0).toFixed(1) + '%' },
  { label: 'CTR', key: 'avgCtr', group: '推广', icon: Percent, fmt: (v) => (v || 0) ? (v || 0).toFixed(2) + '%' : '-' },
  { label: 'CVR', key: 'avgCvr', group: '推广', icon: Percent, fmt: (v) => (v || 0) ? (v || 0).toFixed(2) + '%' : '-' },
  { label: '单品推广成交', key: 'promoTransactionPerProduct', group: '推广', icon: TrendingUp, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
  { label: '单品推广点击', key: 'promoClicksPerProduct', group: '推广', icon: Activity, fmt: (v) => (v || 0).toFixed(0) },
  { label: 'CPM', key: 'avgCpm', group: '推广', icon: BarChart3, fmt: (v) => (v || 0) ? '¥' + (v || 0).toFixed(2) : '-' },
  { label: '时均推广订单', key: 'hourlyPromotedOrders', group: '推广', icon: Clock, fmt: (v) => (v || 0).toFixed(1) },
];

/**
 * ── 10大场景分组（同一KPI可归属多个分组） ──
 *
 * 按商家实际使用场景交叉分类，方便快速定位所需指标：
 *
 *  ① 快速看板  → 一眼看清整体生意（核心指标集合）
 *  ② 营收分析  → 销售额/收入/订单
 *  ③ 利润分析  → 各维度利润/利润率
 *  ④ 成本拆解  → 成本构成细项
 *  ⑤ 推广效果  → 广告投放全链路
 *  ⑥ 商品结构  → 商品组合/生命周期
 *  ⑦ 库存周转  → 库存效率/风险
 *  ⑧ 售后服务  → 退款/售后质量
 *  ⑨ 定价折扣  → 定价策略/折扣
 *  ⑩ 风控预警  → 问题指标监控
 */
export const KPI_GROUPS: { name: string; labels: string[] }[] = [
  {
    name: '① 快速看板',
    labels: [
      '商品数', '总GMV', '总实收', '利润总额', '总订单量', '总销量',
      '动销率', '退款率', '推广ROI', '总成本', '净收入', '毛利率',
      '推广费比', '客单价', '净利率',
    ],
  },
  {
    name: '② 营收分析',
    labels: [
      '总GMV', '总实收', '总销量', '总订单量', '客单价', '净收入',
      '单均GMV', '单均实收', '单均订单量', '退款金额', '折扣总额',
      '退款损失率', '折扣率', '推广成交', '推广订单数', '推广订单占比',
    ],
  },
  {
    name: '③ 利润分析',
    labels: [
      '利润总额', '利润率', '毛利率', '净利率', '毛利润', '税前利润',
      '税后净利润', '毛利润率', '单商品利润', '单均利润', '单品利润',
      '净收入', '总实收', '成本率', '单品成本',
    ],
  },
  {
    name: '④ 成本拆解',
    labels: [
      '总成本', '成本率', '单品成本', '物流成本', '平台佣金', '包装费',
      '运费', '产品进价', '折扣/折让', '税金', '自定义扣除',
      '推广花费', '单品推广费', '单品利润',
    ],
  },
  {
    name: '⑤ 推广效果',
    labels: [
      '推广花费', '推广ROI', '推广费比', '推广成交', '推广点击',
      '推广成交率', '推广订单数', '推广展示量', 'CPC', '推广订单占比',
      'CTR', 'CVR', 'CPM', '最高ROI', '最低ROI', '单品推广费',
      '单品推广成交', '单品推广点击', '时均推广订单', '高推广品',
    ],
  },
  {
    name: '⑥ 商品结构',
    labels: [
      '商品数', '动销商品', '零销品', '动销率', '新品数',
      '商品生命周期', '平均活跃天数', '平均售价', '日均销量',
      '单均订单量', '库存预估', '库存深度(天)', '平均周转',
      '低库存品',
    ],
  },
  {
    name: '⑦ 库存周转',
    labels: [
      '平均周转', '库存预估', '库存深度(天)', '低库存品', '日均销量',
      '商品生命周期', '平均活跃天数', '零销品', '库存预估',
    ],
  },
  {
    name: '⑧ 售后服务',
    labels: [
      '退款率', '售后率', '退款金额', '退款订单数', '售后订单数',
      '高退款品', '高售后品', '单品退款', '售后金额', '品质退款率',
      '退款损失率',
    ],
  },
  {
    name: '⑨ 定价折扣',
    labels: [
      '平均售价', '客单价', '平均折扣率', '折扣率', '折扣总额',
      '单品成本', '单品利润', '毛利率', '成本率', '单均GMV',
      '单均实收', '毛利润率',
    ],
  },
  {
    name: '⑩ 风控预警',
    labels: [
      '零销品', '低库存品', '高退款品', '高售后品', '高推广品',
      '退款率', '售后率', '品质退款率', '退款损失率', '成本率',
      '最低ROI', '推广费比', '利润总额', '净收入',
    ],
  },
];

export const KPI_DATAKEY_MAP = {
  '商品数': 'productCount',
  '动销率': null,
  '零销品': null,
  '低库存品': null,
  '平均周转': null,
  '动销商品': null,
  '新品数': null,
  '平均活跃天数': null,
  '平均售价': null,
  '总GMV': 'gmv',
  '总实收': 'revenue',
  '总销量': 'sales',
  '客单价': 'avgPrice',
  '总订单量': 'orders',
  '单均GMV': null,
  '单均实收': null,
  '单均订单量': null,
  '平均折扣率': null,
  '利润总额': 'profit',
  '利润率': 'profitRate',
  '毛利率': 'profitRate',
  '单商品利润': null,
  '单均利润': null,
  '总成本': null,
  '单品成本': null,
  '单品利润': null,
  '成本率': null,
  '物流成本': null,
  '平台佣金': null,
  '退款率': 'refundRate',
  '售后率': 'afterSaleRate',
  '高退款品': null,
  '退款订单数': null,
  '售后订单数': null,
  '高售后品': null,
  '推广花费': 'promoCost',
  '推广ROI': 'avgRoi',
  '高推广品': null,
  '推广费比': 'avgPromoRatio',
  '推广成交': null,
  '推广点击': null,
  '单品推广费': null,
  '推广成交率': null,
  '最高ROI': null,
  '最低ROI': null,
  '日均销量': null,
  '商品生命周期': null,
  '库存预估': null,
  '库存深度(天)': null,
  '退款金额': null,
  '净收入': null,
  '折扣总额': null,
  '退款损失率': null,
  '折扣率': null,
  '毛利润': null,
  '税前利润': null,
  '税后净利润': null,
  '毛利润率': null,
  '净利率': null,
  '包装费': null,
  '运费': null,
  '产品进价': null,
  '折扣/折让': null,
  '税金': null,
  '自定义扣除': null,
  '单品退款': null,
  '售后金额': null,
  '品质退款率': null,
  '推广订单数': 'promoOrders',
  '推广展示量': null,
  'CPC': null,
  '推广订单占比': null,
  'CTR': null,
  'CVR': null,
  '单品推广成交': null,
  '单品推广点击': null,
  'CPM': null,
  '时均推广订单': null,
};

const LINE_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

// ─── 可拖拽 KPI 卡片（与数据中心完全一致，纯灰无装饰） ───
function SortableKpiCard({ card, value, change, noData, onCardClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.label });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : 'auto',
  };
  const Icon = card.icon;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick(card.label)}
      className="bg-pdd-card rounded-lg border border-pdd-border px-4 py-3 cursor-grab active:cursor-grabbing hover:border-pdd-primary/30 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={13} className="text-pdd-text-secondary" />
        <span className="text-[11px] font-medium text-pdd-text-secondary/80">{card.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-pdd-text tracking-tight">{noData ? '--' : card.fmt(value || 0)}</span>
        {change != null && Math.abs(change) > 0.01 && (
          <span className={`text-[11px] ${change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
            {change > 0 ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────
export default function ProductKpiPanel({
  kpiCards, allKpiCards, kpiValues, kpiChanges,
  visibleKpis, setVisibleKpis, showKpiSelector, setShowKpiSelector,
  noData, onCardClick, onCardReorder, onKpiSelect,
  dailyTrendData, selectedTrendKpis, onClearLine,
}) {
  const [kpiSearch, setKpiSearch] = useState('');
  const selectorRef = useRef(null);

  // label → {value, fmt} 映射（选择器显示数值用）
  const kpiValueMap = useMemo(() => {
    const map = new Map();
    allKpiCards.forEach(k => map.set(k.label, { value: kpiValues[k.key] || 0, fmt: k.fmt }));
    return map;
  }, [allKpiCards, kpiValues]);

  // 点击外部关闭选择面板
  useEffect(() => {
    if (!showKpiSelector) return;
    const handler = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setShowKpiSelector(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showKpiSelector, setShowKpiSelector]);

  const toggleKpi = (label) => {
    const wasChecked = visibleKpis.has(label);
    const newSet = new Set(visibleKpis);
    if (wasChecked) {
      newSet.delete(label);
    } else {
      if (newSet.size >= 10) return;
      newSet.add(label);
    }
    setVisibleKpis(newSet);
    if (!wasChecked && onKpiSelect) onKpiSelect(label);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = kpiCards.findIndex(c => c.label === active.id);
    const newIndex = kpiCards.findIndex(c => c.label === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newCards = arrayMove(kpiCards, oldIndex, newIndex);
    onCardReorder?.(newCards);
  };

  const checkedCount = visibleKpis.size;

  return (
    <div>
      {/* 指标选择面板 — 分组式（与数据中心完全一致） */}
      <div ref={selectorRef}>
        {showKpiSelector && (
          <div className="bg-pdd-card rounded-lg border border-pdd-border mb-3 overflow-hidden shadow-lg">
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-pdd-border/50">
              <Search size={13} className="text-pdd-text-secondary/50 shrink-0" />
              <input
                type="text"
                value={kpiSearch}
                onChange={e => setKpiSearch(e.target.value)}
                placeholder="搜索指标…"
                className="flex-1 bg-transparent text-xs text-pdd-text outline-none placeholder:text-pdd-text-secondary/30"
              />
              {!kpiSearch.trim() && (
                <div className="flex items-center gap-2 text-[10px]">
                  {checkedCount === allKpiCards.length ? (
                    <button onClick={() => { setVisibleKpis(new Set()); }} className="text-pdd-text-secondary/40 hover:text-pdd-danger transition-colors">清空</button>
                  ) : (
                    <button onClick={() => { setVisibleKpis(new Set(allKpiCards.map(k => k.label))); }} className="text-pdd-text-secondary/40 hover:text-pdd-primary transition-colors">全选</button>
                  )}
                </div>
              )}
              <span className="text-[10px] text-pdd-text-secondary/40 tabular-nums">{checkedCount}/{allKpiCards.length}</span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {kpiSearch.trim() ? (
                (() => {
                  const q = kpiSearch.trim().toLowerCase();
                  const matched = allKpiCards.filter(k => k.label.toLowerCase().includes(q));
                  if (matched.length === 0) return <div className="text-xs text-pdd-text-secondary/40 text-center py-4">无匹配指标</div>;
                  return (
                    <div className="grid grid-cols-2">
                      {matched.map(k => {
                        const isChecked = visibleKpis.has(k.label);
                        return (
                          <div key={k.label} className="border border-dashed border-pdd-border/25 -mr-px -mb-px">
                            <button onClick={() => toggleKpi(k.label)}
                              className={`w-full inline-flex items-center gap-1 px-1.5 py-1 text-[11px] leading-tight transition-all ${isChecked ? 'bg-pdd-primary/10 text-pdd-primary' : 'text-pdd-text-secondary/70 hover:bg-pdd-gray-100/50'}`}
                            >
                              {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-pdd-primary shrink-0" />}
                              <span className="truncate">{k.label}</span>
                              {(() => {
                                const vm = kpiValueMap.get(k.label);
                                if (!vm) return null;
                                return <span className="ml-auto text-[10px] tabular-nums text-pdd-text-secondary/50 font-medium">{vm.fmt(vm.value)}</span>;
                              })()}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {KPI_GROUPS.map(group => {
                    const groupCards = allKpiCards.filter(k => group.labels.includes(k.label));
                    if (groupCards.length === 0) return null;
                    const checkedInGroup = groupCards.filter(k => visibleKpis.has(k.label)).length;
                    const allChecked = checkedInGroup === groupCards.length;
                    const noneChecked = checkedInGroup === 0;
                    return (
                      <div key={group.name} className="border border-solid border-pdd-border/40 rounded-md px-2 pt-1.5 pb-1">
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-dashed border-pdd-border/30">
                          <span className="text-[11px] font-semibold text-pdd-text-secondary/70">{group.name}</span>
                          <button
                            onClick={() => {
                              const newSet = new Set(visibleKpis);
                              if (allChecked) {
                                groupCards.forEach(k => newSet.delete(k.label));
                              } else {
                                groupCards.forEach(k => newSet.add(k.label));
                              }
                              setVisibleKpis(newSet);
                              if (!allChecked && onKpiSelect) {
                                groupCards.forEach(k => { if (!visibleKpis.has(k.label)) onKpiSelect(k.label); });
                              }
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${allChecked ? 'text-pdd-primary/60 hover:text-pdd-primary bg-pdd-primary/5' : noneChecked ? 'text-pdd-text-secondary/30 hover:text-pdd-text-secondary/60' : 'text-pdd-warning/60 hover:text-pdd-warning'}`}
                          >
                            {allChecked ? '取消全选' : noneChecked ? '全选' : `已选${checkedInGroup}/${groupCards.length}`}
                          </button>
                        </div>
                        <div className="grid grid-cols-2">
                          {groupCards.map((k, ki) => {
                            const isChecked = visibleKpis.has(k.label);
                            const colSpan = groupCards.length === 3 && ki === 2 ? 'col-span-2' : '';
                            return (
                              <div key={k.label} className={`border border-dashed border-pdd-border/25 -mr-px -mb-px ${colSpan}`}>
                                <button onClick={() => toggleKpi(k.label)}
                                  className={`w-full inline-flex items-center gap-1 px-1.5 py-1 text-[11px] leading-tight transition-all ${isChecked ? 'bg-pdd-primary/10 text-pdd-primary' : 'text-pdd-text-secondary/70 hover:bg-pdd-gray-100/50'}`}
                                >
                                  {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-pdd-primary shrink-0" />}
                                  <span className="truncate">{k.label}</span>
                                  {(() => {
                                    const vm = kpiValueMap.get(k.label);
                                    if (!vm) return null;
                                    return <span className="ml-auto text-[10px] tabular-nums text-pdd-text-secondary/50 font-medium">{vm.fmt(vm.value)}</span>;
                                  })()}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* KPI 卡片网格 — 一排5个，最多10个，可拖拽排序 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={kpiCards.map(c => c.label)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-5 gap-3">
            {kpiCards.map((c) => (
              <SortableKpiCard
                key={c.label}
                card={c}
                value={kpiValues[c.key] || 0}
                change={kpiChanges[c.key] ?? null}
                noData={noData}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 趋势图（默认不展示，点击卡片后显示） */}
      {selectedTrendKpis.length > 0 && dailyTrendData.length > 1 && (
        <div className="mt-4 bg-pdd-card rounded-lg border border-pdd-border overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 className="text-xs font-bold text-pdd-text flex items-center gap-1.5">
              <TrendingUp size={13} className="text-pdd-primary" />指标趋势
            </h3>
            <button
              onClick={() => { if (onClearLine) selectedTrendKpis.forEach(l => onClearLine(l)); }}
              className="text-[10px] px-2 py-0.5 rounded border border-pdd-border text-pdd-text-secondary hover:text-pdd-danger hover:border-pdd-danger/30 transition-colors"
            >清屏</button>
          </div>
          <div className="flex items-center flex-wrap gap-1 px-4 py-1">
            {selectedTrendKpis.map((label, idx) => {
              const kpi = allKpiCards.find(k => k.label === label);
              const dataKey = KPI_DATAKEY_MAP[label];
              const hasData = dataKey != null;
              const color = LINE_COLORS[idx % LINE_COLORS.length];
              return (
                <span
                  key={label}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: color + '15',
                    color: hasData ? color : '#9CA3AF',
                    border: '1px solid ' + (hasData ? color : '#E5E7EB') + '30',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: hasData ? color : '#d1d5db', display: 'inline-block' }} />
                  {kpi?.icon && <kpi.icon size={9} />}
                  {label}
                  {!hasData && <span className="text-[8px] opacity-60">无日趋势</span>}
                  {onClearLine && (
                    <X size={9} className="opacity-60 hover:opacity-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClearLine(label); }} />
                  )}
                </span>
              );
            })}
          </div>
          <div className="px-3 pb-3">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)', strokeOpacity: 0.5 }} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={<ChartTooltip />} />
                {selectedTrendKpis.map((label, idx) => {
                  const dataKey = KPI_DATAKEY_MAP[label];
                  if (!dataKey) return null;
                  return (
                    <Line
                      key={label}
                      type="monotone"
                      dataKey={dataKey}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}