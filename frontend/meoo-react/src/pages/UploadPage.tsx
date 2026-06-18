import React, { useState, useCallback, useMemo, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { Upload, FileText, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Trash2, History, AlertTriangle, Store, ChevronDown, ChevronRight, Clock, Database, Search, Shield, RefreshCw, Trash, Settings, BarChart3, Activity, Info, FolderOpen } from 'lucide-react';

import { useData, useStore, useAuth } from '../App';
import { useDataStore } from '../store/dataStore';
import { findField } from '../utils';

import Papa from 'papaparse';

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { changelog } from '../data/changelog';
import DataOverview from '../components/data-management/DataOverview';
import DataQualityCheck from '../components/data-management/DataQualityCheck';
import DataCleanup from '../components/data-management/DataCleanup';
import SyncStatus from '../components/data-management/SyncStatus';

// shadcn/ui 组件
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from '../components/ui/toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';


interface DataMismatchWarning {

  type: 'product_mismatch' | 'category_mismatch' | 'no_overlap';

  message: string;

  details: string;

}


interface UploadedFile {

  name: string;

  type: 'csv' | 'xlsx' | 'zip';

  size: number;

  status: 'parsing' | 'done' | 'error';

  progress: number;

  detectedType?: string;

  fieldCount?: number;

  rowCount?: number;

  missingFields?: string[];

  duplicateCount?: number;

  newCount?: number;

  intraDupCount?: number;

  crossDupCount?: number;

  mismatchWarning?: DataMismatchWarning;

  errorMessage?: string;

  /** 诊断信息 */
  dateStart?: string; dateEnd?: string;
  privacyFields?: string[];
  jsonEstimateKB?: number;
}


// 标准字段名映射表：将各种变体字段名统一转换为标准名称

// key: 清理后的原始字段名（小写、去空格/分隔符）, value: 标准字段名

const FIELD_NAME_MAP: Record<string, string> = {

  // 商品标识

  '商品id': 'productId', '商品ID': 'productId', 'productid': 'productId', '商品编号': 'productId',

  '商品名称': 'productName', '商品': 'productName', '宝贝标题': 'productName', 'productname': 'productName',

  '商家编码-规格维度': 'productCode', '商家编码-商品维度': 'productCode', '商家编码': 'productCode', 'skucode': 'productCode',


  // 订单金额

  '用户实付金额(元)': 'actualPay', '用户实付': 'actualPay', '实付金额': 'actualPay',

  '商品总价(元)': 'productTotal', '商品总价': 'productTotal',

  '商家实收金额(元)': 'revenue', '商家实收': 'revenue', '实收金额': 'revenue',

  '邮费(元)': 'postage', '邮费': 'postage',


  // 优惠折扣

  '店铺优惠折扣(元)': 'shopDiscount', '店铺优惠': 'shopDiscount',

  '平台优惠折扣(元)': 'platDiscount', '平台优惠': 'platDiscount',

  '多多支付立减金额(元)': 'payDiscount', '支付立减': 'payDiscount',


  // 退款售后

  '退款金额(元)': 'refundAmount', '退款金额': 'refundAmount', '退款(元)': 'refundAmount',

  '售后状态': 'afterSaleStatus',


  // 订单信息

  '订单号': 'orderId', '订单编号': 'orderId',

  '支付时间': 'payTime', '下单时间': 'payTime',

  '商品数量(件)': 'quantity', '商品数量': 'quantity', '数量': 'quantity',

  '订单状态': 'orderStatus',


  // 推广数据

  '总花费(元)': 'promoCost', '花费(元)': 'promoCost', '成交花费(元)': 'promoCost', '推广花费': 'promoCost',

  '交易额(元)': 'promoTransaction', '成交金额(元)': 'promoTransaction', '净交易额(元)': 'promoTransaction',

  '点击量': 'clicks', '点击': 'clicks',

  '曝光量': 'impressions', '展现量': 'impressions', '展示': 'impressions',

  '成交笔数': 'promoOrders', '成交订单数': 'promoOrders', '订单数': 'promoOrders',

  '日期': 'date',


  // 售后数据

  '售后编号': 'afterSaleId',

  'sku信息': 'skuInfo',


  // 运费险数据

  '服务费用（元）': 'insuranceFee',

  '保费': 'insuranceFee',

  '收费状态': 'chargeStatus',

  '理赔状态': 'claimStatus',

  '运费补偿状态': 'compensationStatus',

  '运费补偿生效时间': 'compensationTime',


  // 明星店铺数据

  '投入产出比': 'roi',

  '店铺关注量': 'storeFollows',

  '商品收藏量': 'productFavorites',

  '千次曝光花费(元)': 'cpm',


  // 直播推广数据

  '关注量': 'follows',

  '深度观看': 'deepViews',

  '直播评论量': 'comments',

  '千次曝光转化数': 'conversionCount',

  '千次曝光交易额(元)': 'gmvPerThousand',

  '千次曝光增粉数': 'fansPerThousand',

};


// 清理字段名：去除BOM、制表符、空格等不可见字符，并转小写用于匹配

function normalizeFieldName(name: string): string {

  return name.replace(/[\uFEFF\u00A0\t\r\n\s\-_]/g, '').toLowerCase();

}


const FILE_TYPE_RULES: { keywords: string[]; label: string; icon: string }[] = [

  { keywords: ['订单', 'order'], label: '订单数据', icon: '📦' },

  { keywords: ['商品推广', '商品_推广'], label: '商品推广数据', icon: '📢' },

  { keywords: ['明星店铺', '明星店铺'], label: '明星店铺数据', icon: '⭐' },

  { keywords: ['直播推广', '直播'], label: '直播推广数据', icon: '🎥' },

  { keywords: ['运费险', 'report'], label: '运费险数据', icon: '🛡️' },

  { keywords: ['售后', '退款', '退货'], label: '售后数据', icon: '🔄' },

  { keywords: ['货款', 'bill', 'mall-bill'], label: '货款明细', icon: '💰' },

];


/**

 * 基于固定字段组合检测文件类型

 * 优先使用字段组合判断，字段组合无法区分时用sheet名/文件名辅助

 * @param fields 字段名列表

 * @param sheetName 可选的sheet名称（用于辅助判断）

 * @param fileName 可选的文件名（用于辅助判断）

 */

function detectFileTypeByContent(fields: string[], sheetName?: string, fileName?: string): string {

  const fieldSet = new Set(fields);


  // 辅助函数：检查是否包含任意一个字段

  const hasAny = (...fieldNames: string[]) => fieldNames.some(f => fieldSet.has(f));

  // 辅助函数：检查是否包含所有字段

  const hasAll = (...fieldNames: string[]) => fieldNames.every(f => fieldSet.has(f));

  // 辅助函数：检查名称中是否包含关键词

  const nameContains = (name: string | undefined, ...keywords: string[]) => {

    if (!name) return false;

    const lowerName = name.toLowerCase();

    return keywords.some(kw => lowerName.includes(kw.toLowerCase()));

  };


  // ========== 0. 货款明细检测 ==========
  // 拼多多货款明细CSV，字段：商户订单号/商家订单号、收入金额（+元）/收入（+元）、支出金额（-元）/支出（-元）、账务类型、业务描述
  if ((fieldSet.has('商户订单号') || fieldSet.has('商家订单号')) && hasAny('收入金额（+元）', '收入金额(元)', '收入金额', '收入（+元）') && hasAny('支出金额（-元）', '支出金额(元)', '支出金额', '支出（-元）') && fieldSet.has('账务类型')) {
    return '货款明细';
  }

  // ========== 1. 售后数据检测 ==========

  // 固定字段：售后编号、订单编号、售后状态

  if (hasAll('售后编号', '订单编号', '售后状态')) {

    return '售后数据';

  }


  // ========== 2. 订单数据检测 ==========

  // 固定字段：订单号、商品名称、商品数量、商品ID、商家编码-规格维度、商品总价(元)、商家实收金额(元)

  // 核心识别：订单号 + (商家实收金额 或 商品总价)

  if (fieldSet.has('订单号')) {

    if (hasAny('商家实收金额(元)', '商品总价(元)', '商家实收', '实收金额')) {

      return '订单数据';

    }

  }


  // ========== 3. 运费险数据检测 ==========

  // 固定字段：订单编号、收费编号、服务费用（元）

  // 注意：运费险也有"订单编号"，但没有"订单号"，且有"服务费用（元）"或"收费编号"

  if (fieldSet.has('订单编号') && !fieldSet.has('订单号')) {

    if (hasAny('服务费用（元）', '收费编号', '保费', '理赔状态')) {

      return '运费险数据';

    }

  }

  // 兼容旧格式：有订单编号+服务费用/保费/理赔状态

  if (fieldSet.has('订单编号') && hasAny('服务费用（元）', '保费', '理赔状态')) {

    return '运费险数据';

  }


  // ========== 4. 直播推广数据检测 ==========

  // 独特字段：直播间、深度观看、直播评论量

  if (fieldSet.has('直播间')) {

    return '直播推广数据';

  }

  // 有深度观看或直播评论量，且无商品ID（排除商品推广）

  if (hasAny('深度观看', '直播评论量') && !fieldSet.has('商品ID')) {

    return '直播推广数据';

  }


  // ========== 5. 明星店铺数据检测 ==========

  // 独特字段：投入产出比、品牌词、店铺关注量、创意样式、品牌词包

  // 关键区分点：无商品ID

  if (!fieldSet.has('商品ID')) {

    if (hasAny('投入产出比', '品牌词', '店铺关注量', '创意样式', '品牌词包')) {

      return '明星店铺数据';

    }

  }


  // ========== 6. 商品推广数据检测 ==========

  // 固定字段：日期、商品ID、曝光量、点击量 + 花费类字段

  if (fieldSet.has('商品ID')) {

    // 有商品ID + 日期 + 推广指标 → 明确是商品推广

    if (hasAny('日期') && hasAny('曝光量', '点击量', '总花费(元)', '花费(元)', '成交花费(元)')) {

      return '商品推广数据';

    }

    // 有商品ID + 花费类字段 → 也是商品推广

    if (hasAny('总花费(元)', '花费(元)', '成交花费(元)', '推广花费')) {

      return '商品推广数据';

    }

  }

  // 商品推广汇总数据：无商品ID但有成交花费+交易额+曝光量+点击量

  if (hasAny('成交花费(元)', '总花费(元)') && hasAny('交易额(元)', '成交金额(元)') && hasAll('曝光量', '点击量')) {

    // 名称辅助判断

    if (nameContains(sheetName, '商品', '推广') || nameContains(fileName, '商品', '推广')) {

      return '商品推广数据';

    }

    // 默认归类为商品推广

    return '商品推广数据';

  }


  return '未知类型';

}


// 必填字段分组：每组是一组别名，只要有一个匹配就算通过

// 显示缺失时使用第一个名称作为提示

const REQUIRED_FIELD_GROUPS: Record<string, string[][]> = {

  '订单数据': [

    ['orderId', '订单号', '订单编号'],

    ['productId', '商品id', '商品ID', '商品编号'],

    ['productTotal', '商品总价(元)', '商品总价'],

    ['revenue', '商家实收金额(元)', '商家实收', '实收金额'],

    ['payTime', '支付时间', '下单时间'],

    ['orderStatus', '订单状态'],

  ],

  '商品推广数据': [

    ['date', '日期'],

    ['promoCost', '总花费(元)', '花费(元)', '成交花费(元)', '推广花费'],

    ['promoTransaction', '交易额(元)', '成交金额(元)', '净交易额(元)'],

  ],

  '明星店铺数据': [

    ['date', '日期'],

    ['promoCost', '花费(元)', '总花费(元)', '成交花费(元)'],

    ['promoTransaction', '交易额(元)', '成交金额(元)'],

  ],

  '直播推广数据': [

    ['date', '日期'],

    ['promoCost', '总花费(元)', '花费(元)', '成交花费(元)'],

    ['promoTransaction', '交易额(元)', '成交金额(元)'],

  ],

  '运费险数据': [

    ['orderId', '订单编号', '订单号'],

  ],

  '售后数据': [

    ['afterSaleId', '售后编号'],

    ['orderId', '订单编号', '订单号'],

    ['afterSaleStatus', '售后状态'],

    ['refundAmount', '退款金额', '退款金额(元)', '退款(元)'],

  ],

};


// 检查必填字段，返回缺失的字段显示名列表

function checkRequiredFields(fields: string[], type: string): string[] {

  const groups = REQUIRED_FIELD_GROUPS[type];

  if (!groups) return [];

  const fieldSet = new Set(fields);

  // 同时加入映射后的标准名（处理原始中文列名带不可见字符的情况）

  fields.forEach(f => {

    // 先尝试原始字段名匹配

    let standardKey = FIELD_NAME_MAP[f];

    // 如果没匹配到，再尝试规范化后的字段名

    if (!standardKey) {

      const normalized = normalizeFieldName(f);

      standardKey = FIELD_NAME_MAP[normalized];

    }

    if (standardKey) fieldSet.add(standardKey);

  });

  const missing: string[] = [];

  for (const group of groups) {

    const found = group.some(alias => fieldSet.has(alias));

    if (!found) missing.push(group[0]); // 用标准名作为缺失提示

  }

  return missing;

}


/** 扫描前5行找到真实表头行（跳过描述文本/空行），返回表头行索引 */
function findHeaderRow(rawRows: any[][]): number {
  const headerKeywords = /[订单|售后|金额|日期|时间|商品|推广|运费|编号|名称|数量|快递|退款|花费|成交|曝光|投产|店铺|支出|收入]/;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    let matchCount = 0;
    for (const cell of row) {
      const s = String(cell ?? '').trim();
      if (s && headerKeywords.test(s)) matchCount++;
    }
    if (matchCount >= 2) return i;
  }
  return 0;
}



function detectFileType(filename: string): string {

  for (const rule of FILE_TYPE_RULES) {

    if (rule.keywords.some(k => filename.toLowerCase().includes(k.toLowerCase()))) return rule.label;

  }

  return '未知类型';

}


function resolveType(contentType: string, fileName: string): string {

  if (contentType !== '未知类型') return contentType;

  return detectFileType(fileName);

}


// 提取数据中的商品ID集合和品类信息

function extractProductInfo(data: any[], type: string): { productIds: Set<string>; categories: Set<string>; sampleNames: string[] } {

  const productIds = new Set<string>();

  const categories = new Set<string>();

  const sampleNames: string[] = [];


  if (type === '订单数据') {

    data.forEach((row: any) => {

      const pid = String(row['商品id'] || row['商品ID'] || '').trim();

      if (pid) productIds.add(pid);

      const cat = String(row['商品一级类目'] || '').trim();

      if (cat) categories.add(cat);

      const name = String(row['商品'] || row['商品名称'] || '').trim();

      if (name && sampleNames.length < 3) sampleNames.push(name.substring(0, 20));

    });

  } else if (type === '商品推广数据') {

    data.forEach((row: any) => {

      const pid = String(row['商品ID'] || row['商品id'] || '').trim();

      if (pid) productIds.add(pid);

      const name = String(row['商品名称'] || row['商品'] || '').trim();

      if (name && sampleNames.length < 3) sampleNames.push(name.substring(0, 20));

    });

  }


  return { productIds, categories, sampleNames };

}


// 检测新上传数据与已有数据的一致性

function checkDataConsistency(

  newData: any[],

  newType: string,

  existingData: any

): DataMismatchWarning | undefined {

  // 只检测订单和推广数据的交叉匹配

  if (!['订单数据', '商品推广数据'].includes(newType)) return undefined;


  const newInfo = extractProductInfo(newData, newType);

  if (newInfo.productIds.size === 0) return undefined;


  // 获取已有数据的商品信息

  let existingInfo: { productIds: Set<string>; categories: Set<string>; sampleNames: string[] };

  if (newType === '订单数据' && existingData.promotionProducts?.length > 0) {

    existingInfo = extractProductInfo(existingData.promotionProducts, '商品推广数据');

  } else if (newType === '商品推广数据' && existingData.orders?.length > 0) {

    existingInfo = extractProductInfo(existingData.orders, '订单数据');

  } else {

    return undefined; // 没有可对比的数据

  }


  if (existingInfo.productIds.size === 0) return undefined;


  // 计算交集

  const overlap = [...newInfo.productIds].filter(id => existingInfo.productIds.has(id));

  const overlapRate = overlap.length / Math.max(newInfo.productIds.size, existingInfo.productIds.size);


  // 品类不匹配检测

  if (newInfo.categories.size > 0 && existingInfo.categories.size > 0) {

    const categoryOverlap = [...newInfo.categories].some(c => existingInfo.categories.has(c));

    if (!categoryOverlap) {

      return {

        type: 'category_mismatch',

        message: '品类不一致警告',

        details: `新上传的${newType}品类为「${[...newInfo.categories].join('、')}」，但已有数据品类为「${[...existingInfo.categories].join('、')}」。请确认是否属于同一店铺。`

      };

    }

  }


  // 商品ID完全不匹配

  if (overlap.length === 0) {

    return {

      type: 'no_overlap',

      message: '商品ID无交集警告',

      details: `新上传的${newType}包含 ${newInfo.productIds.size} 个商品，但与已有数据的 ${existingInfo.productIds.size} 个商品完全没有交集。示例商品：${newInfo.sampleNames.join('、') || '未知'}。这可能导致推广花费无法关联到订单。`

    };

  }


  // 匹配率过低

  if (overlapRate < 0.1) {

    return {

      type: 'product_mismatch',

      message: '商品匹配率过低',

      details: `新上传的${newType}与已有数据仅有 ${overlap.length} 个商品匹配（匹配率 ${(overlapRate * 100).toFixed(1)}%）。建议检查数据来源是否为同一店铺。`

    };

  }


  return undefined;

}

// ===== 去重工具函数 =====

/** 获取订单行的唯一标识（使用 findField 做模糊匹配，兼容不同 PDD 导出格式） */
function getOrderRowKey(row: any): string {
  return String(findField(row, '订单号') || '').trim();
}

/** 获取货款明细行的唯一标识（商户订单号/商家订单号 + 发生时间 + 交易类型 + 金额，防误删） */
function getFinancialRowKey(row: any): string {
  const orderNo = String(findField(row, '商户订单号', '商家订单号') || '').trim();
  const time = String(findField(row, '发生时间') || '').trim();
  const type = String(findField(row, '交易类型') || findField(row, '业务描述') || '').trim();
  const amount = String(findField(row, '收入金额（+元）', '收入金额(+元)', '收入金额(元)', '收入金额', '收入（+元）', '收入(+元)') || findField(row, '支出金额（-元）', '支出金额(-元)', '支出金额(元)', '支出金额', '支出（-元）', '支出(-元)') || '').trim();
  return `${orderNo}_${time}_${type}_${amount}`;
}

/** 获取运费险行的唯一标识 */
function getInsuranceRowKey(row: any): string {
  return String(findField(row, '订单编号') || '').trim();
}

/** 获取售后行的唯一标识 */
function getAfterSaleRowKey(row: any): string {
  return String(findField(row, '售后编号') || '').trim();
}

/** 获取推广数据的唯一标识（日期+商品ID+推广名称） */
function getPromoProductKey(row: any): string {
  const d = String(findField(row, '日期') || '').trim();
  const pid = String(findField(row, '商品ID') || findField(row, '商品id') || '').trim();
  const name = String(findField(row, '推广名称') || '').trim();
  return `${d}-${pid}-${name}`;
}

// ★ 全局已见密钥追踪器（跨文件去重，持久化到 sessionStorage）
const GLOBAL_SEEN_KEYS: Record<string, Set<string>> = (() => {
  try {
    const saved = sessionStorage.getItem('dianfx_global_seen_keys');
    if (saved) {
      const parsed = JSON.parse(saved);
      const result: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = new Set(v as string[]);
      }
      return result;
    }
  } catch {}
  return { orders: new Set(), financial: new Set(), insurance: new Set(), afterSale: new Set(), promoProducts: new Set() };
})();

// ★ 上传字段归一化映射
const UPLOAD_ALIASES: Record<string, string> = {
  '下单日期': '支付时间', '下单时间': '支付时间', '订单创建时间': '支付时间',
  '订单成交时间': '支付时间', '入账时间': '支付时间',
  '商家实收(元)': '商家实收金额(元)', '用户实付(元)': '用户实付金额(元)',
  '退款(元)': '退款金额(元)', '技术服务费(元)': '平台技术服务费(元)',
  '成交量(件)': '商品数量(件)', '成交金额(元)': '交易额(元)',
  '快递费(元)': '邮费(元)', '保费(元)': '保费(元)',
};
function normalizeUploadFields(row: any): any {
  const out: any = {};
  Object.keys(row).forEach(k => {
    const val = row[k];
    let key = typeof k === 'string' ? k.replace(/[﻿ \t\r\n]+/g, '').trim() : k;
    key = UPLOAD_ALIASES[key] || key;
    out[key] = typeof val === 'string' ? val.replace(/[﻿ \t\r\n]+/g, '').trim() : val;
  });
  return out;
}

/** 清空跨文件去重缓存 */
function resetGlobalSeenKeys() {
  Object.values(GLOBAL_SEEN_KEYS).forEach(s => s.clear());
  try { sessionStorage.removeItem('dianfx_global_seen_keys'); } catch {}
}

function saveGlobalSeenKeys() {
  try {
    const plain: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(GLOBAL_SEEN_KEYS)) {
      plain[k] = Array.from(v).slice(-50000); // 最多保留5万条
    }
    sessionStorage.setItem('dianfx_global_seen_keys', JSON.stringify(plain));
  } catch {}
}

/**
 * ★ 三层去重引擎
 * Layer 1: 文件内部去重 — 同一文件内的重复行
 * Layer 2: 全局跨文件去重 — 本次会话中所有已上传数据的密钥
 * Layer 3: 存量合并去重 — 与当前店铺已有数据合并
 */
function tripleDedup<T>(
  incoming: T[],
  getKey: (item: T) => string,
  globalKeySet: Set<string>,
  existingData: T[],
): { merged: T[]; intraDup: number; crossDup: number; mergeDup: number; newCount: number; totalNew: T[] } {
  let intraDup = 0;
  let crossDup = 0;
  let mergeDup = 0;

  // === Layer 1: 文件内部去重 ===
  const intraSeen = new Set<string>();
  const afterIntra: T[] = [];
  incoming.forEach(item => {
    const key = getKey(item);
    if (!key) { afterIntra.push(item); return; } // 无密钥的数据保留
    if (intraSeen.has(key)) {
      intraDup++;
    } else {
      intraSeen.add(key);
      afterIntra.push(item);
    }
  });

  // === Layer 2: 全局跨文件去重 ===
  const afterCross: T[] = [];
  afterIntra.forEach(item => {
    const key = getKey(item);
    if (!key) { afterCross.push(item); return; }
    if (globalKeySet.has(key)) {
      crossDup++;
    } else {
      globalKeySet.add(key);
      afterCross.push(item);
    }
  });
  saveGlobalSeenKeys();

  // === Layer 3: 存量合并去重 ===
  const existingKeys = new Set(existingData.map(getKey).filter(Boolean));
  const finalNew: T[] = [];
  afterCross.forEach(item => {
    const key = getKey(item);
    if (key && existingKeys.has(key)) {
      mergeDup++;
    } else {
      finalNew.push(item);
      if (key) existingKeys.add(key);
    }
  });

  const merged = [...existingData, ...finalNew];
  const newCount = finalNew.length;

  return { merged, intraDup, crossDup, mergeDup, newCount, totalNew: finalNew };
}

// ★ 上传诊断：提取日期范围、隐私字段、JSON 预估值
const PRIVACY_FIELDS_LIST = ['收货人','收货人姓名','收件人','收货人手机','收货人电话','手机号','手机','联系电话','买家手机','电话','收货地址','详细地址','街道/镇','街道','镇','区','买家留言','买家信息','买家备注','商家备注','卖家备注','备注','身份证','身份证号','微信','QQ','邮箱','Email'];

/** 从数据行中剥离隐私字段 */
function stripPrivacyFields(rows: any[]): any[] {
  const lowerMap: Record<string, string> = {};
  if (rows.length === 0) return rows;
  Object.keys(rows[0]).forEach(k => { lowerMap[k.replace(/[\s\-_]/g, '').toLowerCase()] = k; });
  const toStrip = new Set<string>();
  PRIVACY_FIELDS_LIST.forEach(pf => {
    const key = pf.replace(/[\s\-_]/g, '').toLowerCase();
    if (lowerMap[key]) toStrip.add(lowerMap[key]);
    // 也匹配部分包含（如"手机号"匹配"买家手机号"）
    Object.entries(lowerMap).forEach(([lk, ok]) => {
      // ★ 短关键词(≤2字符)不做正向模糊匹配，避免误伤（如"区"匹配"地区"、"手机"匹配"手机壳"）
      // ★ 反向匹配（关键词包含字段名）对所有长度开放，主要用于"收货人姓名"→"收货人"这类场景
      if (key.length >= 3 && lk.includes(key)) { toStrip.add(ok); return; }
      if (key.includes(lk)) { toStrip.add(ok); }
    });
  });
  return rows.map(row => {
    const clean: any = {};
    Object.keys(row).forEach(k => {
      if (!toStrip.has(k)) clean[k] = row[k];
    });
    return clean;
  });
}
function extractDiagnostics(data: any[], fields: string[], detectedType?: string) {
  const diag: { dateStart?: string; dateEnd?: string; privacyFields: string[]; jsonEstimateKB: number } = { privacyFields: [], jsonEstimateKB: 0 };
  // 日期范围
  const dateField = detectedType === '售后数据' ? '申请时间'
    : detectedType === '货款明细' ? '入账时间'
    : '支付时间';
  // 货款明细降级：入账时间 → 发生时间 → 日期
  const dateFallback = detectedType === '货款明细' ? ['发生时间', '日期'] : [];
  const dates = data.map(r => {
    let d = findField(r, dateField);
    if (!d) for (const fb of dateFallback) { d = findField(r, fb); if (d) break; }
    if (!d) d = findField(r, '日期') || findField(r, '下单时间');
    return String(d || '').trim().slice(0, 10);
  }).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (dates.length > 0) { diag.dateStart = dates[0]; diag.dateEnd = dates[dates.length - 1]; }
  // 隐私字段
  diag.privacyFields = PRIVACY_FIELDS_LIST.filter(pf => fields.some(f => f === pf));
  // JSON 预估值 (KB)
  try { diag.jsonEstimateKB = Math.round(JSON.stringify(data).length / 1024); } catch { diag.jsonEstimateKB = 0; }
  return diag;
}

/** 通用去重合并：根据 getKey 去重，返回合并后的数组及统计 */
function dedupMerge<T>(existing: T[], incoming: T[], getKey: (item: T) => string): { merged: T[]; newCount: number; dupCount: number } {
  const existingKeys = new Set(existing.map(getKey).filter(Boolean));
  let newCount = 0, dupCount = 0;
  const newItems: T[] = [];
  incoming.forEach(item => {
    const key = getKey(item);
    if (key && existingKeys.has(key)) {
      dupCount++;
    } else {
      newItems.push(item);
      if (key) existingKeys.add(key);
      newCount++;
    }
  });
  return { merged: [...existing, ...newItems], newCount, dupCount };
}


export default function UploadPage() {

  const { getStoreData, setStoreData, setStoreDataLocal, uploadRecords, addUploadRecord, deleteUploadRecord, setDataFilter, dataFilter, clearOrderData, clearFinancialData, clearAllData } = useData();

  const { user: authUser } = useAuth();
  const { currentStore } = useStore();
  const lastSyncError = useDataStore(s => s.lastSyncError);
  const clearSyncError = useDataStore(s => s.clearSyncError);
  const storageMode = useDataStore(s => s.storageMode);
  const setStorageMode = useDataStore(s => s.setStorageMode);
  // ★ 上传模式选择
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [files, setFiles] = useState<UploadedFile[]>([]);

  const [dragging, setDragging] = useState(false);

  const [fieldReport, setFieldReport] = useState<{ available: string[]; missing: string[]; type: string } | null>(null);

  const [showHistory, setShowHistory] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [confirmFile, setConfirmFile] = useState<{ file: File; existingRecord: any } | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  // --- ⭐ 权益1: 批量上传队列管理 ---
  const [batchQueue, setBatchQueue] = useState<{ total: number; done: number; failed: number }>({ total: 0, done: 0, failed: 0 });
  const [showBatchQueue, setShowBatchQueue] = useState(false);

  // --- ⭐ 权益2: 上传历史搜索 ---
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ★ 最小解析时间（保证进度条可见）
  const MIN_PARSE_MS = 500;
  const parsingStartRef = useRef<Record<string, number>>({});
  const ensureMinParseTime = async (fileName: string) => {
    const start = parsingStartRef.current[fileName] || Date.now();
    const elapsed = Date.now() - start;
    if (elapsed < MIN_PARSE_MS) {
      await new Promise(r => setTimeout(r, MIN_PARSE_MS - elapsed));
    }
  };

  // ══════════════════════════════════════════════
  // 数据管理 Tab 系统
  // ══════════════════════════════════════════════
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [cleanupStore, setCleanupStore] = useState<string>('');
  const [cleanupTypes, setCleanupTypes] = useState<Set<string>>(new Set());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const TABS = [
    { key: 'upload', label: '上传', icon: '📤' },
    { key: 'overview', label: '数据总览', icon: '📊' },
    { key: 'quality', label: '数据质量检查', icon: '🔍' },
    { key: 'cleanup', label: '数据清理', icon: '🧹' },
    { key: 'sync', label: '同步状态', icon: '🔄' },
  ];

  const currentStoreUploads = uploadRecords.filter(r => r.storeId === currentStore?.id);

  // --- ⭐ 权益2: 上传历史搜索/筛选 ---
  const filteredRecords = useMemo(() => {
    return currentStoreUploads.filter(r => {
      const matchSearch = !historySearch || r.fileName.toLowerCase().includes(historySearch.toLowerCase());
      const matchType = historyTypeFilter === 'all' || r.fileType === historyTypeFilter;
      return matchSearch && matchType;
    });
  }, [currentStoreUploads, historySearch, historyTypeFilter]);


  /** 解析货款明细CSV原始内容：跳过元数据头，找到含"商户订单号"/"商家订单号"的真实表头行 */
  function parseFinancialCSV(rawContent: string): { fields: string[]; data: any[] } | null {
    const parsed = Papa.parse(rawContent, { header: false, skipEmptyLines: true });
    const rawRows = parsed.data as string[][];
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
      if (rawRows[i].some((cell: string) => cell && (cell.includes('商户订单号') || cell.includes('商家订单号')))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) return null;
    const headers = rawRows[headerIdx].map(h => String(h || '').replace(/[﻿ \t\r\n]+/g, '').trim());
    const dataRows = rawRows.slice(headerIdx + 1).filter(r =>
      r.length >= 4 && r.some(c => String(c || '').trim())
    );
    const data = dataRows.map((row: string[]) => {
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
      return obj;
    });
    return { fields: headers, data };
  }

  const processCsvFile = useCallback((file: File, targetStoreId: string, targetStoreName: string) => {

    const tryParse = (encoding: string): Promise<{ fields: string[]; data: any[] }> => {

      return new Promise((resolve, reject) => {

        Papa.parse(file, {

          header: true, skipEmptyLines: true, encoding,

          complete: (result) => resolve({ fields: result.meta.fields || [], data: result.data as any[] }),

          error: () => reject(new Error(`parse failed with ${encoding}`)),

        });

      });

    };

    const isGarbled = (fields: string[]) => fields.length > 0 && fields.some(f => /[\ufffd]/.test(f));


    (async () => {

      let fields: string[] = [];

      let data: any[] = [];

      const toastId = `csv-${file.name}-${Date.now()}`;
      toast.loading(`正在解析 ${file.name}...`, { id: toastId });

      try {

        const utf8 = await tryParse('UTF-8');

        fields = utf8.fields;

        data = utf8.data;

        if (isGarbled(fields)) {

          const gbk = await tryParse('GBK');

          fields = gbk.fields;

          data = gbk.data;

        }

      } catch (utf8Err) {

        try {

          const gbk = await tryParse('GBK');

          fields = gbk.fields;

          data = gbk.data;

        } catch (gbkErr) {

          const errMsg = `CSV解析失败: UTF-8和GBK编码均无法解析。请检查文件是否为有效的CSV格式。`;

          console.error('CSV parse error:', { utf8Err, gbkErr, fileName: file.name });

          setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));

          toast.error(errMsg, { id: toastId });

          return;

        }

      }



      try {
      // ★ 自动剥离隐私字段（手机号、收货地址、买家备注等）
      const csvPrivacyFields = PRIVACY_FIELDS_LIST.filter(pf => fields.some(f => f === pf));
      if (csvPrivacyFields.length > 0) {
        data = stripPrivacyFields(data);
        fields = Object.keys(data[0] || {});
      }
      let detectedType = resolveType(detectFileTypeByContent(fields, undefined, file.name), file.name);

      // 如果检测结果是未知类型或字段异常少，尝试按货款明细CSV重新解析（跳过元数据头）
      if (detectedType === '未知类型' || fields.length <= 2) {
        try {
          const buf = await file.arrayBuffer();
          let rawContent = new TextDecoder('utf-8').decode(buf);
          if (rawContent.includes('�')) {
            rawContent = new TextDecoder('gbk').decode(buf);
          }
          const financialResult = parseFinancialCSV(rawContent);
          if (financialResult) {
            fields = financialResult.fields;
            data = financialResult.data;
            detectedType = '货款明细';
          }
        } catch (_) { /* 非文本文件，忽略 */ }
      }

      let missing = checkRequiredFields(fields, detectedType);


      // 数据一致性检测（使用当前快照，仅用于展示警告）

      const existingSnapshot = getStoreData(targetStoreId) || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: [], promotion: [], insurance: [], afterSale: [], financial: [] } };

      const mismatchWarning = checkDataConsistency(data, detectedType, existingSnapshot);


      // 用快照估算去重计数（仅用于UI展示，实际去重由 functional updater 保证数据正确）
      let approxDuplicateCount = 0;
      let approxNewCount = 0;
      if (detectedType === '订单数据') {
        const snapshotOrderIds = new Set((existingSnapshot.orders || []).map(getOrderRowKey).filter(Boolean));
        data.forEach((row: any) => {
          const orderId = getOrderRowKey(row);
          if (orderId && snapshotOrderIds.has(orderId)) approxDuplicateCount++;
          else if (orderId) { approxNewCount++; snapshotOrderIds.add(orderId); }
        });
      } else if (detectedType === '运费险数据') {
        const snapshotKeys = new Set((existingSnapshot.shippingInsurance || []).map(getInsuranceRowKey).filter(Boolean));
        data.forEach((row: any) => {
          const key = getInsuranceRowKey(row);
          if (key && snapshotKeys.has(key)) approxDuplicateCount++;
          else if (key) { approxNewCount++; snapshotKeys.add(key); }
        });
      } else if (detectedType === '售后数据') {
        const snapshotKeys = new Set((existingSnapshot.afterSaleRecords || []).map(getAfterSaleRowKey).filter(Boolean));
        data.forEach((row: any) => {
          const key = getAfterSaleRowKey(row);
          if (key && snapshotKeys.has(key)) approxDuplicateCount++;
          else if (key) { approxNewCount++; snapshotKeys.add(key); }
        });
      } else if (detectedType === '货款明细') {
        const snapshotKeys = new Set((existingSnapshot.financialRecords || []).map(getFinancialRowKey).filter(Boolean));
        data.forEach((row: any) => {
          const key = getFinancialRowKey(row);
          if (key && snapshotKeys.has(key)) approxDuplicateCount++;
          else if (key) { approxNewCount++; snapshotKeys.add(key); }
        });
      }

      const diag = extractDiagnostics(data, fields, detectedType);
      await ensureMinParseTime(file.name);
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done', progress: 100, fieldCount: fields.length, rowCount: data.length, detectedType, missingFields: missing, mismatchWarning, duplicateCount: approxDuplicateCount, newCount: approxNewCount, dateStart: diag.dateStart, dateEnd: diag.dateEnd, privacyFields: diag.privacyFields, jsonEstimateKB: diag.jsonEstimateKB } : f));

      // ★ 针对 订单数据 用三重去重引擎计算精确统计（在 setStoreData 外执行 setFiles）
      if (detectedType === '订单数据') {
        const snapshot = getStoreData(targetStoreId);
        const existingOrders = snapshot?.orders || [];
        const cleanedData = data.map(normalizeUploadFields);
        // ★ 传副本避免污染 GLOBAL_SEEN_KEYS —— 否则第二次调用（真正合并）时会误判全部为跨文件重复
        const dedupResult = tripleDedup(cleanedData, getOrderRowKey, new Set(GLOBAL_SEEN_KEYS.orders), existingOrders);
        setFiles(prev => prev.map(f => f.name === file.name ? {
          ...f,
          duplicateCount: dedupResult.intraDup + dedupResult.crossDup + dedupResult.mergeDup,
          intraDupCount: dedupResult.intraDup,
          crossDupCount: dedupResult.crossDup,
          newCount: dedupResult.newCount,
        } : f));
      }


      // 使用函数式更新避免闭包陷阱，确保基于最新状态合并

      // ★ 先记录上传，再同步数据（确保 uploadRecord 包含在 sync payload 中）
      addUploadRecord({ fileName: file.name, fileType: detectedType, storeId: targetStoreId, storeName: targetStoreName, rowCount: data.length, fieldCount: fields.length });

      // ★ 增量同步：只发送变更的分类
      const csvSyncCategories: string[] | undefined = (() => {
        if (detectedType === '订单数据') return ['orders'];
        if (detectedType === '货款明细') return ['financialRecords'];
        if (detectedType === '运费险数据') return ['shippingInsurance'];
        if (detectedType === '售后数据') return ['afterSaleRecords'];
        if (detectedType === '商品推广数据') return ['promotionProducts', 'promotionSummary'];
        if (detectedType === '明星店铺数据') return ['starStoreSummary'];
        if (detectedType === '直播推广数据') return ['liveStreamSummary'];
        return undefined;
      })();

      setStoreData(targetStoreId, (prevExisting: any) => {

        const base = prevExisting || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: [], promotion: [], insurance: [], afterSale: [], financial: [] } };
        // ★ 建立全新副本，避免直接突变 Zustand store 引用
        const existing = {
          ...base,
          availableFields: { ...base.availableFields },
          orders: [...(base.orders || [])],
          promotionSummary: [...(base.promotionSummary || [])],
          promotionProducts: [...(base.promotionProducts || [])],
          starStoreSummary: [...(base.starStoreSummary || [])],
          liveStreamSummary: [...(base.liveStreamSummary || [])],
          shippingInsurance: [...(base.shippingInsurance || [])],
          afterSaleRecords: [...(base.afterSaleRecords || [])],
          financialRecords: [...(base.financialRecords || [])],
        };


        if (detectedType === '订单数据') {

          const cleanedData = data.map(normalizeUploadFields);
          // ★ 三层去重引擎
          const dedupResult = tripleDedup(cleanedData, getOrderRowKey, GLOBAL_SEEN_KEYS.orders, existing.orders);
          const mergedOrders = dedupResult.merged;
          existing.orders = mergedOrders;

          existing.availableFields.csv = [...fields];

        } else if (detectedType === '货款明细') {

          if (!existing.financialRecords) existing.financialRecords = [];
          const { merged: mergedFinancial } = dedupMerge(base.financialRecords, data, getFinancialRowKey);
          existing.financialRecords = mergedFinancial;

        } else if (detectedType === '运费险数据') {
          const { merged: mergedIns } = dedupMerge(base.shippingInsurance, data, getInsuranceRowKey);
          existing.shippingInsurance = mergedIns;
          existing.availableFields.insurance = [...fields];

        } else if (detectedType === '售后数据') {
          if (!existing.afterSaleRecords) existing.afterSaleRecords = [];
          const { merged: mergedAS } = dedupMerge(base.afterSaleRecords, data, getAfterSaleRowKey);
          existing.afterSaleRecords = mergedAS;
          if (!existing.availableFields.afterSale) existing.availableFields.afterSale = [];
          existing.availableFields.afterSale = [...fields];

        } else if (detectedType === '商品推广数据') {
          const hasProductId = fields.some((f: string) => {
            const n = f.replace(/[﻿ 	]/g, '').trim().toLowerCase();
            return n === '商品id' || n.includes('productid') || n.includes('商品编号');
          });
          if (hasProductId) {
            const getPromoKey = (r: any) => {
              const d = String(findField(r, '日期') || '').trim();
              if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
              return d + '-' + String(findField(r, '商品ID') || '').trim() + '-' + String(findField(r, '推广名称') || '').trim();
            };
            const seenKeys = new Set(existing.promotionProducts.map(getPromoKey).filter(Boolean));
            data.forEach((item: any) => {
              const key = getPromoKey(item);
              if (key && !seenKeys.has(key)) {
                existing.promotionProducts.push(item);
                seenKeys.add(key);
              }
            });
          } else {
            const summaryMap = new Map<string, any>();
            existing.promotionSummary.forEach((r: any) => {
              const d = String(findField(r, '日期') || '').trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(d)) summaryMap.set(d, r);
            });
            data.forEach((item: any) => {
              const d = String(findField(item, '日期') || '').trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(d)) summaryMap.set(d, item);
            });
            existing.promotionSummary = Array.from(summaryMap.values());
          }
          // ★ availableFields 已改为 string[]，不能用 Set.add
          const promArr = existing.availableFields.promotion || [];
          fields.forEach((f: string) => { if (!promArr.includes(f)) promArr.push(f); });
          existing.availableFields.promotion = promArr;

        } else if (detectedType === '明星店铺数据') {
          const hasDistinguish = fields.includes('推广名称') || fields.includes('创意样式');
          const starMap = new Map<string, any>();
          base.starStoreSummary.forEach((r: any) => {
            const d = String(findField(r, '日期') || '').trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
              const suffix = hasDistinguish ? '-' + String(findField(r, '推广名称') || findField(r, '创意样式') || '').trim() : '';
              starMap.set(d + suffix, r);
            }
          });
          data.forEach((item: any) => {
            const d = String(findField(item, '日期') || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
            const suffix = hasDistinguish ? '-' + String(findField(item, '推广名称') || findField(item, '创意样式') || '').trim() : '';
            starMap.set(d + suffix, item);
          });
          existing.starStoreSummary = Array.from(starMap.values());

        } else if (detectedType === '直播推广数据') {
          const hasDistinguish = fields.includes('直播间') || fields.includes('推广名称');
          const liveMap = new Map<string, any>();
          base.liveStreamSummary.forEach((r: any) => {
            const d = String(findField(r, '日期') || '').trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
              const suffix = hasDistinguish ? '-' + String(findField(r, '直播间') || findField(r, '推广名称') || '').trim() : '';
              liveMap.set(d + suffix, r);
            }
          });
          data.forEach((item: any) => {
            const d = String(findField(item, '日期') || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
            const suffix = hasDistinguish ? '-' + String(findField(item, '直播间') || findField(item, '推广名称') || '').trim() : '';
            liveMap.set(d + suffix, item);
          });
          existing.liveStreamSummary = Array.from(liveMap.values());

        }


        return existing;

      });

      setDataFilter(targetStoreId); // 上传后自动切换到该店铺的数据视图

      setFieldReport({ available: fields, missing, type: detectedType });

      // ★ 上传完成后留在当前页面（不上传自动跳转），改用 toast 提示
      const privacyNote = csvPrivacyFields.length > 0 ? `，已自动剥离 ${csvPrivacyFields.length} 个隐私字段` : '';
      toast.success(`${detectedType} 解析完成：${data.length} 行 × ${fields.length} 列${privacyNote}`, { id: toastId });

      } catch (err: any) {
        const errMsg = `文件处理失败：${err?.message || '未知错误'}`;
        console.error('processCsvFile error:', err, { fileName: file.name });
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));
        toast.error(errMsg, { id: toastId });
      }

    })();

  }, [getStoreData, setStoreData, addUploadRecord, setDataFilter]);


  const processXlsxFile = useCallback((file: File, targetStoreId: string, targetStoreName: string) => {

    const reader = new FileReader();
    const toastId = `xlsx-${file.name}-${Date.now()}`;
    let settled = false;  // 防止重复toast

    reader.onprogress = (e) => { if (e.lengthComputable) setFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress: Math.round((e.loaded / e.total) * 80) } : f)); };

    reader.onerror = (err) => {
      if (settled) return; settled = true;
      const errMsg = `文件读取失败：${file.name}`;
      console.error('FileReader error:', err, { fileName: file.name });
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));
      toast.error(errMsg, { id: toastId });
    };

    reader.onload = async (e) => {

      toast.loading(`正在解析 ${file.name}...`, { id: toastId });

      // ★ 整个解析过程最多120秒（XLSX.read可能卡死大文件）
      const parseTimeout = setTimeout(() => {
        if (settled) return; settled = true;
        const errMsg = `解析超时：${file.name} 超过120秒仍未完成`;
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));
        toast.error(errMsg, { id: toastId });
      }, 120000);

      try {

        const wb = XLSX.read(e.target!.result, { type: 'array' });

        // 统一清洗函数：去除BOM、制表符、空格等不可见字符

        const cleanField = (s: string) => String(s).replace(/[\uFEFF\u00A0\t\r\n]+/g, '').trim();

        const cleanRow = (row: any) => {

          const cleaned: any = {};

          Object.keys(row).forEach(key => {

            const cleanKey = cleanField(key);

            const val = row[key];

            cleaned[cleanKey] = typeof val === 'string' ? cleanField(val) : val;

          });

          return cleaned;

        };

        const sheets: Record<string, any[]> = {};

        wb.SheetNames.forEach(sn => {
          // 先获取原始行数组，自动检测偏移表头（跳过描述文本/空行）
          const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
          const headerRow = findHeaderRow(rawRows);
          const rawData = headerRow > 0
            ? XLSX.utils.sheet_to_json(wb.Sheets[sn], { range: headerRow })
            : XLSX.utils.sheet_to_json(wb.Sheets[sn]);

          // 保持原始中文字段名（页面组件和findField依赖中文key），仅清理值中的不可见字符

          sheets[sn] = rawData.map((row: any) => {

            const cleaned: any = {};

            Object.keys(row).forEach(k => {

              const val = row[k];

              const cleanKey = typeof k === 'string' ? k.replace(/[\uFEFF\u00A0\t\r\n]+/g, '').trim() : k;

              cleaned[cleanKey] = typeof val === 'string' ? val.replace(/[\uFEFF\u00A0\t\r\n]+/g, '').trim() : val;

            });

            return cleaned;

          }).map(normalizeUploadFields);

        });


        // 预计算所有sheet的类型和统计（不依赖store状态）
        const sheetInfos: { name: string; type: string; fields: string[]; data: any[] }[] = [];
        let totalRows = 0;
        let allFields: string[] = [];
        let primaryType = '未知类型';
        const isValidDateRow = (item: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(findField(item, '日期') || '').trim());

        for (const sn of wb.SheetNames) {
          const sheetData = sheets[sn];
          if (!sheetData || sheetData.length === 0) continue;
          const sheetFields = Object.keys(sheetData[0]);
          let sheetType = detectFileTypeByContent(sheetFields, sn, file.name);

          if (sheetType === '未知类型') {
            if (sn.includes('商品')) sheetType = '商品推广数据';
            else if (sn.includes('品牌词') || sn.includes('创意')) sheetType = '明星店铺数据';
            else if (sn.includes('直播间')) sheetType = '直播推广数据';
            else sheetType = detectFileType(file.name);
          }

          if (allFields.length === 0) allFields = sheetFields;
          if (sheetType !== '未知类型') totalRows += sheetData.length;
          if (primaryType === '未知类型' && sheetType !== '未知类型') primaryType = sheetType;

          sheetInfos.push({ name: sn, type: sheetType, fields: sheetFields, data: sheetData });
        }

        if (primaryType === '未知类型') primaryType = detectFileType(file.name);
        const missing = checkRequiredFields(allFields, primaryType);

        // 数据一致性检测（使用快照，仅用于展示警告）
        const existingSnapshot = getStoreData(targetStoreId) || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: [], promotion: [], insurance: [], afterSale: [], financial: [] } };
        let mismatchWarning: DataMismatchWarning | undefined;
        if (primaryType === '商品推广数据') {
          const allPromoProducts = sheetInfos
            .filter(info => info.type === '商品推广数据')
            .flatMap(info => info.data)
            .filter(isValidDateRow);
          mismatchWarning = checkDataConsistency(allPromoProducts, '商品推广数据', existingSnapshot);
        }

        const xlsxDiag = extractDiagnostics(sheetInfos.flatMap(info => info.data), allFields, primaryType);
        await ensureMinParseTime(file.name);
        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done', progress: 100, fieldCount: allFields.length, rowCount: totalRows, detectedType: primaryType, missingFields: missing, mismatchWarning, dateStart: xlsxDiag.dateStart, dateEnd: xlsxDiag.dateEnd, privacyFields: xlsxDiag.privacyFields, jsonEstimateKB: xlsxDiag.jsonEstimateKB } : f));

        // ★ 先记录上传，再同步数据
        addUploadRecord({ fileName: file.name, fileType: primaryType, storeId: targetStoreId, storeName: targetStoreName, rowCount: totalRows, fieldCount: allFields.length });

        // ★ 增量同步：从 sheetInfos 推导出变更的分类
        const xlsxSyncCategories: string[] | undefined = (() => {
          const cats = new Set<string>();
          for (const info of sheetInfos) {
            if (info.type === '订单数据') cats.add('orders');
            else if (info.type === '货款明细') cats.add('financialRecords');
            else if (info.type === '运费险数据') cats.add('shippingInsurance');
            else if (info.type === '售后数据') cats.add('afterSaleRecords');
            else if (info.type === '商品推广数据') { cats.add('promotionProducts'); cats.add('promotionSummary'); }
            else if (info.type === '明星店铺数据') cats.add('starStoreSummary');
            else if (info.type === '直播推广数据') cats.add('liveStreamSummary');
          }
          return cats.size > 0 ? Array.from(cats) : undefined;
        })();

        // ★ 自动剥离隐私字段
        for (const info of sheetInfos) {
          info.data = stripPrivacyFields(info.data);
        }
        // 重新计算总字段
        allFields = sheetInfos.length > 0 && sheetInfos[0].data.length > 0 ? Object.keys(sheetInfos[0].data[0]) : [];
        setStoreData(targetStoreId, (prev: any) => {
          const base = prev || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: [], promotion: [], insurance: [], afterSale: [], financial: [] } };
          const merged = {
            ...base,
            orders: [...(base.orders || [])],
            promotionSummary: [...(base.promotionSummary || [])],
            promotionProducts: [...(base.promotionProducts || [])],
            starStoreSummary: [...(base.starStoreSummary || [])],
            liveStreamSummary: [...(base.liveStreamSummary || [])],
            shippingInsurance: [...(base.shippingInsurance || [])],
            afterSaleRecords: [...(base.afterSaleRecords || [])],
            financialRecords: [...(base.financialRecords || [])],
            availableFields: {
              csv: [...(base.availableFields?.csv || [])],
              promotion: [...(base.availableFields?.promotion || [])],
              insurance: [...(base.availableFields?.insurance || [])],
              afterSale: [...(base.availableFields?.afterSale || [])],
            },
          };

          // 仅用于推广产品 sheet 首次清空（多次推广 sheet 不清空已合并的产品列表）
          const processedTypes = new Set<string>();
          // 跨 sheet 去重：推广产品 sheet 间按 日期+商品ID+推广名称 去重
          const crossSheetPromoKeys = new Set<string>();

          for (const info of sheetInfos) {

            if (info.type === '商品推广数据') {
              const hasProductId = info.fields.includes('商品ID');
              if (hasProductId) {
                if (!processedTypes.has('商品推广_产品')) {
                  merged.promotionProducts = [];
                }
                info.data.forEach((item: any) => {
                  if (!isValidDateRow(item)) return;
                  const key = `${String(findField(item, '日期') || '').trim()}-${String(findField(item, '商品ID') || '').trim()}-${String(findField(item, '推广名称') || '').trim()}`;
                  if (!crossSheetPromoKeys.has(key)) {
                    merged.promotionProducts.push(item);
                    crossSheetPromoKeys.add(key);
                  }
                });
                const promArr1 = merged.availableFields.promotion || [];
                info.fields.forEach((f: string) => { if (!promArr1.includes(f)) promArr1.push(f); });
                merged.availableFields.promotion = promArr1;
                processedTypes.add('商品推广_产品');
              } else {
                const summaryMap = new Map<string, any>();
                merged.promotionSummary.forEach((r: any) => {
                  const d = String(findField(r, '日期') || '').trim();
                  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) summaryMap.set(d, r);
                });
                info.data.forEach((item: any) => {
                  if (!isValidDateRow(item)) return;
                  summaryMap.set(String(findField(item, '日期') || '').trim(), item);
                });
                merged.promotionSummary = Array.from(summaryMap.values());
                const promArr2 = merged.availableFields.promotion || [];
                info.fields.forEach((f: string) => { if (!promArr2.includes(f)) promArr2.push(f); });
                merged.availableFields.promotion = promArr2;
              }
            } else if (info.type === '明星店铺数据') {
              const hasDistinguishField = info.fields.includes('推广名称') || info.fields.includes('创意样式');
              const starMap = new Map<string, any>();
              merged.starStoreSummary.forEach((r: any) => {
                const d = String(findField(r, '日期') || '').trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                  const suffix = hasDistinguishField ? `-${findField(r, '推广名称') || findField(r, '创意样式') || ''}` : '';
                  starMap.set(`${d}${suffix}`, r);
                }
              });
              info.data.forEach((item: any) => {
                if (!isValidDateRow(item)) return;
                const suffix = hasDistinguishField ? `-${findField(item, '推广名称') || findField(item, '创意样式') || ''}` : '';
                const key = `${String(findField(item, '日期') || '').trim()}${suffix}`;
                starMap.set(key, item);
              });
              merged.starStoreSummary = Array.from(starMap.values());
            } else if (info.type === '直播推广数据') {
              const hasDistinguishField = info.fields.includes('直播间') || info.fields.includes('推广名称');
              const liveMap = new Map<string, any>();
              merged.liveStreamSummary.forEach((r: any) => {
                const d = String(findField(r, '日期') || '').trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                  const suffix = hasDistinguishField ? `-${findField(r, '直播间') || findField(r, '推广名称') || ''}` : '';
                  liveMap.set(`${d}${suffix}`, r);
                }
              });
              info.data.forEach((item: any) => {
                if (!isValidDateRow(item)) return;
                const suffix = hasDistinguishField ? `-${findField(item, '直播间') || findField(item, '推广名称') || ''}` : '';
                const key = `${String(findField(item, '日期') || '').trim()}${suffix}`;
                liveMap.set(key, item);
              });
              merged.liveStreamSummary = Array.from(liveMap.values());
            } else if (info.type === '运费险数据') {
              const { merged: mergedIns } = dedupMerge(merged.shippingInsurance, info.data, getInsuranceRowKey);
              merged.shippingInsurance = mergedIns;
              // 合并字段列表，不覆盖已有字段
              info.fields.forEach((f: string) => { if (!merged.availableFields.insurance.includes(f)) merged.availableFields.insurance.push(f); });
            } else if (info.type === '售后数据') {
              if (!merged.afterSaleRecords) merged.afterSaleRecords = [];
              const { merged: mergedAS } = dedupMerge(merged.afterSaleRecords, info.data, getAfterSaleRowKey);
              merged.afterSaleRecords = mergedAS;
              if (!merged.availableFields.afterSale) merged.availableFields.afterSale = [];
              info.fields.forEach((f: string) => { if (!merged.availableFields.afterSale.includes(f)) merged.availableFields.afterSale.push(f); });
            } else if (info.type === '订单数据') {
              const odResult = tripleDedup(info.data, getOrderRowKey, GLOBAL_SEEN_KEYS.orders, merged.orders);
              merged.orders = odResult.merged;
              info.fields.forEach((f: string) => { if (!merged.availableFields.csv.includes(f)) merged.availableFields.csv.push(f); });
              // 更新 UI 统计
              setFiles(prev => prev.map(f => {
                if (f.name !== file.name) return f;
                const prevIntra = f.intraDupCount || 0;
                const prevCross = f.crossDupCount || 0;
                const prevDup = f.duplicateCount || 0;
                const prevNew = f.newCount || 0;
                return {
                  ...f,
                  duplicateCount: prevDup + odResult.intraDup + odResult.crossDup + odResult.mergeDup,
                  intraDupCount: prevIntra + odResult.intraDup,
                  crossDupCount: prevCross + odResult.crossDup,
                  newCount: prevNew + odResult.newCount,
                };
              }));
            }
          }

          return { ...merged, availableFields: { ...merged.availableFields } };
        }, xlsxSyncCategories);

        setDataFilter(targetStoreId);
        setFieldReport({ available: allFields, missing, type: primaryType });
        // ★ 上传完成后留在当前页面（不上传自动跳转），改用 toast 提示
        toast.success(`${primaryType} 解析完成：${totalRows} 行 × ${allFields.length} 列`, { id: toastId });

      } catch (err) {

        const errMsg = `XLSX解析失败: ${err instanceof Error ? err.message : '未知错误'}。请检查文件是否为有效的Excel格式。`;

        console.error('XLSX parse error:', { err, fileName: file.name });

        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));

        toast.error(errMsg, { id: toastId });

      } finally {
        clearTimeout(parseTimeout);
      }

    };

    reader.readAsArrayBuffer(file);

  }, [getStoreData, setStoreData, addUploadRecord, setDataFilter]);


  const processZipFile = useCallback(async (file: File, targetStoreId: string, targetStoreName: string) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.entries(zip.files).filter(([name, f]) =>
        !f.dir && !name.startsWith('__MACOSX') && !name.startsWith('.') && !name.includes('/.')
      );
      // ★ 所有子文件处理完再标记完成
      let processedCount = 0;
      for (const [name, zipEntry] of entries) {
        const blob = await zipEntry.async('blob');
        const lowerName = name.toLowerCase();
        const ext = lowerName.endsWith('.csv') ? 'csv' : 'xlsx';
        const subFile = new File([blob], name.split('/').pop() || name, {
          type: ext === 'csv' ? 'text/csv' : 'application/vnd.ms-excel'
        });
        const entry: UploadedFile = { name: subFile.name, type: ext, size: subFile.size, status: 'parsing', progress: 0, detectedType: '检测中...' };
        setFiles(prev => [...prev, entry]);
        if (ext === 'csv') {
          processCsvFile(subFile, targetStoreId, targetStoreName);
        } else {
          processXlsxFile(subFile, targetStoreId, targetStoreName);
        }
      }
    } catch (err) {
      const errMsg = `ZIP解压失败: ${err instanceof Error ? err.message : '未知错误'}`;
      console.error('ZIP parse error:', { err, fileName: file.name });
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));
      toast.error(errMsg);
    }
  }, [processCsvFile, processXlsxFile]);


  const processFile = useCallback((file: File) => {

    if (!currentStore) { toast.error('请先选择一个店铺'); return; }
    if (dataFilter === '__all__') { toast.error('请在下拉菜单中选择一个具体店铺后再上传数据'); return; }

    const targetStoreId = currentStore.id;

    const targetStoreName = currentStore.name;

    // 文件指纹检测：同名文件再次上传时弹窗确认
    const existingRecord = uploadRecords.find((r: any) => r.fileName === file.name && r.storeId === targetStoreId);
    if (existingRecord) {
      setConfirmFile({ file, existingRecord });
      return;
    }

    const isZip = file.name.toLowerCase().endsWith('.zip');
    const ext = file.name.toLowerCase().endsWith('.csv') ? 'csv' : isZip ? 'zip' : 'xlsx';

    const entry: UploadedFile = { name: file.name, type: ext, size: file.size, status: 'parsing', progress: 0, detectedType: '检测中...' };
parsingStartRef.current[file.name] = Date.now();
    setFiles(prev => [...prev, entry]);


    if (ext === 'zip') {
      processZipFile(file, targetStoreId, targetStoreName);
    } else if (ext === 'csv') {

      processCsvFile(file, targetStoreId, targetStoreName);

    } else {

      processXlsxFile(file, targetStoreId, targetStoreName);

    }

  }, [currentStore, dataFilter, processCsvFile, processXlsxFile, processZipFile]);

  // ★ 递归遍历文件夹（带超时保护和错误处理）
  const traverseDirectory = useCallback(async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
    const files: File[] = [];
    const reader = entry.createReader();
    const BATCH_TIMEOUT = 15000; // 每批15秒超时

    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('readEntries超时')), BATCH_TIMEOUT);
        try {
          reader.readEntries(
            (entries: FileSystemEntry[]) => {
              clearTimeout(timer);
              resolve(entries);
            },
            (err: Error) => {
              clearTimeout(timer);
              reject(err);
            }
          );
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      if (batch.length === 0) break; // 读取完毕

      for (const e of batch) {
        if (e.isFile) {
          try {
            const file = await new Promise<File>((resolve, reject) => {
              (e as FileSystemFileEntry).file(resolve, reject);
            });
            files.push(file);
          } catch (err) {
            console.warn('[Upload] 跳过文件:', e.name, err);
          }
        } else if (e.isDirectory) {
          try {
            const subFiles = await traverseDirectory(e as FileSystemDirectoryEntry);
            files.push(...subFiles);
          } catch (err) {
            console.warn('[Upload] 跳过子目录:', e.name, err);
          }
        }
      }
    }

    return files;
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); resetGlobalSeenKeys();
    try {
      // ★ 同步提取所有信息（React 17事件池化，必须在异步前读完）
      const dt = e.dataTransfer;
      const rawFiles = Array.from(dt.files);
      const items = Array.from(dt.items);

      // ★ 检测是否有文件夹拖入
      const hasWebkitApi = items.some(item => typeof item.webkitGetAsEntry === 'function');
      let hasDirectory = false;
      let entries: (FileSystemEntry | null)[] = [];
      if (hasWebkitApi) {
        entries = items.map(item => item.webkitGetAsEntry());
        hasDirectory = entries.some(e => e?.isDirectory);
      }

      if (hasDirectory) {
        // ── 文件夹拖入 ──
        const allFiles: File[] = [];
        for (const entry of entries) {
          if (!entry) continue;
          if (entry.isDirectory) {
            const dirFiles = await traverseDirectory(entry as FileSystemDirectoryEntry)
              .catch(err => {
                console.error('[Upload] 遍历文件夹失败:', entry.name, err);
                toast.error(`遍历文件夹失败: ${entry.name}`);
                return [] as File[];
              });
            allFiles.push(...dirFiles);
          } else if (entry.isFile) {
            try {
              const file = await new Promise<File>((resolve, reject) => {
                (entry as FileSystemFileEntry).file(resolve, reject);
              });
              allFiles.push(file);
            } catch (err) {
              console.warn('[Upload] 跳过文件:', entry.name, err);
            }
          }
        }
        const supportedFiles = allFiles.filter(f => /\.(csv|xlsx|xls|zip)$/i.test(f.name));
        if (supportedFiles.length === 0) {
          toast.error('文件夹中未找到支持的数据文件（.csv/.xlsx）');
          return;
        }
        toast.success(`📁 从文件夹中找到 ${supportedFiles.length} 个数据文件，开始批量上传`, { duration: 3000 });
        if (!storageMode[dataFilter]) {
          setPendingFiles(supportedFiles); setShowModeDialog(true);
        } else {
          supportedFiles.forEach(processFile);
        }
        return;
      }

      // ── 普通文件拖入 ──
      if (rawFiles.length === 0) {
        // 浏览器不支持 webkitGetAsEntry 且 files 为空 → 无法读取
        toast.error('无法读取拖入的内容，请使用"选择文件"或"选择文件夹"按钮上传');
        return;
      }
      if (!storageMode[dataFilter]) {
        setPendingFiles(rawFiles); setShowModeDialog(true);
      } else {
        rawFiles.forEach(processFile);
      }
    } catch (err) {
      console.error('[Upload] drop处理异常:', err);
      toast.error('文件拖入处理失败，请尝试使用按钮上传');
    }
  }, [processFile, dataFilter, storageMode]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    resetGlobalSeenKeys();
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!storageMode[dataFilter] && files.length > 0) {
      setPendingFiles(files); setShowModeDialog(true);
    } else { files.forEach(processFile); }
  }, [processFile, dataFilter, storageMode]);

  // ★ 文件夹上传：递归扫描所有支持的文件
  const handleFolderInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    resetGlobalSeenKeys();
    const allFiles = Array.from(e.target.files || []);
    e.target.value = '';
    const supportedFiles = allFiles.filter(f =>
      /\.(csv|xlsx|xls|zip)$/i.test(f.name)
    );
    if (supportedFiles.length === 0) {
      toast.error('文件夹中未找到支持的文件类型（.csv/.xlsx/.xls/.zip）');
      return;
    }
    toast.info(`📁 找到 ${supportedFiles.length} 个数据文件，开始批量上传...`, { duration: 3000 });
    if (!storageMode[dataFilter]) {
      setPendingFiles(supportedFiles); setShowModeDialog(true);
    } else {
      supportedFiles.forEach(processFile);
    }
  }, [processFile, dataFilter, storageMode]);

  const removeFile = useCallback((name: string) => setFiles(prev => prev.filter(f => f.name !== name)), []);


  const handleDeleteRecord = (id: string) => { deleteUploadRecord(id); setDeleteConfirm(null); };


  const toggleSelectRecord = (id: string) => {

    setSelectedRecords(prev => {

      const next = new Set(prev);

      if (next.has(id)) next.delete(id);

      else next.add(id);

      return next;

    });

  };


  // --- ⭐ 权益1: 批量上传队列追踪 ---
  React.useEffect(() => {
    if (files.length === 0) { setBatchQueue({ total: 0, done: 0, failed: 0 }); setShowBatchQueue(false); return; }
    const done = files.filter(f => f.status === 'done').length;
    const failed = files.filter(f => f.status === 'error').length;
    const parsing = files.filter(f => f.status === 'parsing').length;
    setBatchQueue({ total: files.length, done, failed });
    if (files.length > 1 || parsing > 0) setShowBatchQueue(true);
    if (done + failed === files.length && files.length > 0) {
      // All done - auto hide after 5s
      const timer = setTimeout(() => setShowBatchQueue(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [files]);

  // ★ 安全网：超过5分钟还在parsing的文件自动标记为失败
  const STUCK_TIMEOUT_MS = 300000;
  React.useEffect(() => {
    if (files.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setFiles(prev => prev.map(f => {
        if (f.status !== 'parsing') return f;
        const startTime = parsingStartRef.current[f.name];
        if (startTime && (now - startTime) > STUCK_TIMEOUT_MS) {
          console.warn('[Upload] 文件解析超时(5分钟)，自动标记失败:', f.name);
          toast.error(`文件 ${f.name} 解析超时，请检查文件是否损坏`);
          return { ...f, status: 'error', errorMessage: '解析超时（超过5分钟未完成）' };
        }
        return f;
      }));
    }, 30000);
    return () => clearInterval(timer);
  }, [files.length]);

  const toggleSelectAll = () => {

    if (selectedRecords.size === filteredRecords.length) {

      setSelectedRecords(new Set());

    } else {

      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));

    }

  };


  const handleBatchDelete = () => {
    selectedRecords.forEach(id => deleteUploadRecord(id));
    setSelectedRecords(new Set());
    setBatchDeleteConfirm(false);
  };

  const handleConfirmFileUpload = () => {
    if (!confirmFile) return;
    const { file } = confirmFile;
    setConfirmFile(null);
    const targetStoreId = currentStore?.id;
    const targetStoreName = currentStore?.name;
    if (!targetStoreId || !targetStoreName) return;
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const ext = file.name.toLowerCase().endsWith('.csv') ? 'csv' : isZip ? 'zip' : 'xlsx';
    const entry: UploadedFile = { name: file.name, type: ext, size: file.size, status: 'parsing', progress: 0, detectedType: '检测中...' };
    parsingStartRef.current[file.name] = Date.now();
    setFiles(prev => [...prev, entry]);
    if (ext === 'zip') {
      processZipFile(file, targetStoreId, targetStoreName);
    } else if (ext === 'csv') {
      processCsvFile(file, targetStoreId, targetStoreName);
    } else {
      processXlsxFile(file, targetStoreId, targetStoreName);
    }
  };

  return (

    <div className="p-4 space-y-3">

      {/* ── Tab 导航（shadcn/ui Tabs 风格） ── */}
      <div className="relative group">
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-pdd-primary/30 via-purple-500/20 to-pink-500/20 opacity-40 blur-[1px]" />
        <Card className="relative border-0" style={{ background: 'rgba(15, 18, 35, 0.9)' }}>
          <CardContent className="p-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={'whitespace-nowrap text-xs px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 font-medium ' +
                    (activeTab === tab.key
                      ? 'bg-gradient-to-r from-pdd-primary to-purple-500 text-white shadow-sm'
                      : 'text-pdd-text-secondary hover:bg-pdd-bg/50 hover:text-pdd-text')}
                ><span>{tab.icon}</span> {tab.label}</button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tab1: 上传（保留现有功能） ── */}
      {activeTab === 'upload' && (<>


      {!currentStore && <Card className="mb-4 border-l-4 border-pdd-danger"><CardContent className="p-3"><p className="text-pdd-danger font-medium text-sm">请先在店铺管理中创建一个店铺</p></CardContent></Card>}


      <AnimatePresence>

        {showHistory && (

          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">

            <Card>

              <CardContent className="p-4">

              <div className="flex items-center justify-between mb-3">

                <h3 className="font-semibold flex items-center gap-2 text-sm"><History size={16} className="text-pdd-danger" />当前店铺上传记录</h3>

                <div className="flex items-center gap-2">

                  {selectedRecords.size > 0 && (

                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteConfirm(true)}>
                      批量删除 ({selectedRecords.size})
                    </Button>

                  )}

                  <button onClick={() => setShowHistory(false)} className="text-pdd-text-secondary hover:text-pdd-text"><X size={16} /></button>

                </div>

              </div>

              {/* ⭐ 权益2: 上传历史搜索 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
                  <input
                    type="text" placeholder="搜索文件名..." value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text placeholder:text-pdd-text-secondary outline-none focus:border-pdd-primary transition-colors"
                  />
                </div>
                <select
                  value={historyTypeFilter}
                  onChange={e => setHistoryTypeFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary"
                >
                  <option value="all">全部类型</option>
                  <option value="订单数据">订单</option>
                  <option value="货款明细">货款</option>
                  <option value="售后数据">售后</option>
                  <option value="运费险数据">运费险</option>
                  <option value="商品推广数据">推广</option>
                </select>
              </div>
              {historySearch && (
                <p className="text-xs text-pdd-text-secondary mb-2">
                  搜索 &quot;{historySearch}&quot;，共 {filteredRecords.length} 条结果
                </p>
              )}

              {filteredRecords.length > 0 && (

                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-pdd-border">

                  <Checkbox

                    checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}

                    onCheckedChange={toggleSelectAll}

                    className="border-pdd-text-secondary data-[state=checked]:bg-pdd-danger data-[state=checked]:border-pdd-danger"

                  />

                  <span className="text-xs text-pdd-text-secondary">全选 ({filteredRecords.length})</span>

                </div>

              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">

                {filteredRecords.map(record => (

                  <div key={record.id} className={`flex items-center justify-between p-3 rounded-lg border ${selectedRecords.has(record.id) ? 'bg-pdd-info/10 border-pdd-info' : 'bg-pdd-bg border-pdd-border'}`}>

                    <div className="flex items-center gap-3 flex-1 min-w-0">

                      <Checkbox

                        checked={selectedRecords.has(record.id)}

                        onCheckedChange={() => toggleSelectRecord(record.id)}

                        className="border-pdd-border data-[state=checked]:bg-pdd-danger data-[state=checked]:border-pdd-danger"

                      />

                      <div className="flex-1 min-w-0">

                        <p className="font-medium truncate text-pdd-text">{record.fileName}</p>

                        <p className="text-xs text-pdd-text-secondary">{record.fileType} · {record.rowCount}行 · {new Date(record.uploadedAt).toLocaleString('zh-CN')}</p>

                      </div>

                    </div>

                    {deleteConfirm === record.id ? (

                      <div className="flex items-center gap-2">

                        <span className="text-xs text-pdd-danger">确认删除?</span>

                        <Button size="sm" variant="destructive" onClick={() => handleDeleteRecord(record.id)}>确认</Button>

                        <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>

                      </div>

                    ) : (

                      <div className="flex items-center gap-2">

                        {['商品推广数据', '明星店铺数据', '直播推广数据'].includes(record.fileType) && (

                          <button onClick={() => { setDataFilter(record.storeId); window.location.hash = '#/promotion'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                        )}

                        {record.fileType === '订单数据' && (

                          <button onClick={() => { setDataFilter(record.storeId); window.location.hash = '#/dashboard'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                        )}

                        {record.fileType === '运费险数据' && (

                          <button onClick={() => { setDataFilter(record.storeId); window.location.hash = '#/shipping-insurance'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                        )}

                        {record.fileType === '售后数据' && (

                          <button onClick={() => { setDataFilter(record.storeId); window.location.hash = '#/after-sale'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                        )}

                        {record.fileType === '货款明细' && (

                          <button onClick={() => { setDataFilter(record.storeId); window.location.hash = '#/reconciliation'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                        )}

                        <button onClick={() => setDeleteConfirm(record.id)} className="p-1.5 text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 rounded transition-colors" title="删除此上传记录"><Trash2 size={16} /></button>

                      </div>

                    )}

                  </div>

                ))}

              </div>

              <div className="mt-3 pt-3 border-t border-pdd-border">

                <p className="text-xs text-pdd-text-secondary flex items-center gap-1"><AlertTriangle size={12} />删除记录会同时清除该文件导入的数据，请谨慎操作</p>

              </div>


              {/* 批量删除确认弹窗 — shadcn/ui Dialog */}
              <Dialog open={batchDeleteConfirm} onOpenChange={setBatchDeleteConfirm}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-pdd-text">
                      <AlertTriangle size={20} className="text-pdd-danger" />
                      确认批量删除
                    </DialogTitle>
                    <DialogDescription className="text-pdd-text-secondary">
                      确定要删除选中的 {selectedRecords.size} 条上传记录吗？此操作将同时清除这些文件导入的数据，且无法恢复。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBatchDeleteConfirm(false)}>取消</Button>
                    <Button variant="destructive" onClick={handleBatchDelete}>确认删除</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* 同名文件重复上传确认 — shadcn/ui Dialog */}
              <Dialog open={!!confirmFile} onOpenChange={() => setConfirmFile(null)}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-pdd-text">
                      <AlertTriangle size={20} className="text-pdd-warning" />
                      文件已上传过
                    </DialogTitle>
                    <DialogDescription className="text-pdd-text-secondary">
                      文件 &quot;{confirmFile?.file?.name}&quot; 已上传过
                      {confirmFile?.existingRecord && `（${new Date(confirmFile.existingRecord.uploadedAt).toLocaleString()}）`}。
                      是否继续上传？重复数据将自动去重。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmFile(null)}>取消</Button>
                    <Button variant="default" onClick={handleConfirmFileUpload}>继续上传</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              </CardContent>
            </Card>

          </motion.div>

        )}

      </AnimatePresence>

      {/* ★ 上传模式选择弹窗 — shadcn/ui Dialog */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-pdd-text">选择数据存储方式</DialogTitle>
            <DialogDescription className="text-sm text-pdd-text-secondary">
              首次上传需选择该店铺的存储方式，后续可在店铺设置中更改
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const level = authUser?.membershipLevel || 'free';
            const storageLimitText = level === 'enterprise' ? '企业版不限量'
              : level === 'pro' ? '专业版300MB'
              : '免费版30MB';
            return (
              <div className="space-y-4 py-2">
                <button onClick={() => { setStorageMode(dataFilter, 'cloud'); setShowModeDialog(false); pendingFiles.forEach(processFile); setPendingFiles([]); }}
                  className="w-full p-4 border-2 border-pdd-primary rounded-xl text-left hover:bg-pdd-primary/5 transition-colors">
                  <div className="flex items-center gap-3 mb-1"><span className="text-2xl">☁️</span><span className="font-semibold text-pdd-text">私人云盘（推荐）</span></div>
                  <p className="text-xs text-pdd-text-secondary ml-9">数据存入您的专属私人云盘空间。{storageLimitText}。计算精准、多设备同步、数据随时可删除。</p>
                </button>
                <button onClick={() => { setStorageMode(dataFilter, 'local'); setShowModeDialog(false); pendingFiles.forEach(processFile); setPendingFiles([]); }}
                  className="w-full p-4 border-2 border-pdd-border rounded-xl text-left hover:bg-pdd-bg transition-colors">
                  <div className="flex items-center gap-3 mb-1"><span className="text-2xl">💻</span><span className="font-semibold text-pdd-text">仅本地保存</span></div>
                  <p className="text-xs text-pdd-text-secondary ml-9">数据只存在浏览器本地。清除缓存或换设备后数据丢失。免费版同样可用，不占云盘空间。</p>
                </button>
              </div>
            );
          })()}
          <p className="text-[10px] text-pdd-text-secondary text-center">选择私人云盘后，该店铺数据以云盘为准，本地缓存自动同步。</p>
        </DialogContent>
      </Dialog>

      <div className="relative group mb-6">
        {/* 动态渐变边框 */}
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-pdd-primary via-purple-500 to-pink-500 opacity-40 group-hover:opacity-70 blur-[2px] transition-all duration-700" />
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-pdd-primary via-purple-500 to-pink-500 opacity-15 animate-pulse blur-[4px]" />
        <Card
          onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}
          className={`relative border-0 rounded-xl text-center cursor-pointer transition-all ${dragging ? 'bg-pdd-primary/10 scale-[1.02]' : 'hover:bg-pdd-primary/5'}`}
          style={{ background: 'rgba(15, 18, 35, 0.85)' }}
          onClick={() => fileInputRef.current?.click()}>
          <CardContent>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.zip" multiple className="hidden" onChange={handleFileInput} />
          <input ref={folderInputRef} type="file" {...{ webkitdirectory: true, directory: true } as any} className="hidden" onChange={handleFolderInput} />

          <motion.div animate={{ scale: dragging ? 1.1 : 1 }} className="py-12">

            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pdd-primary/20 to-purple-500/20 flex items-center justify-center shadow-lg shadow-pdd-primary/10">
              <Upload className="w-8 h-8 text-pdd-primary" />
            </div>

            <p className="text-lg font-medium text-pdd-text">拖拽文件或文件夹到此处上传</p>
            <p className="text-pdd-text-secondary mt-1">支持 CSV、XLSX 格式 | 订单数据、推广数据、运费险数据</p>
            <p className="text-[11px] text-pdd-text-secondary/60 mt-2">点击选择文件或拖拽到此处</p>

            {/* ★ 文件夹上传快捷入口 */}
            <div className="mt-5 flex items-center justify-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="px-4 py-2 rounded-lg bg-pdd-primary/10 text-pdd-primary hover:bg-pdd-primary/20 border border-pdd-primary/30 transition-all text-xs font-medium">
                📄 选择文件
              </button>
              <span className="text-pdd-text-secondary/40 text-xs">或</span>
              <button onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                className="px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 transition-all text-xs font-medium">
                📁 选择文件夹（批量上传）
              </button>
            </div>

          </motion.div>
          </CardContent>
        </Card>
      </div>


      {/* ⭐ 权益1: 批量上传队列状态 */}
      {showBatchQueue && batchQueue.total > 0 && (
        <Card className="mb-3 border-pdd-primary/30 bg-pdd-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-pdd-text flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                批量上传队列
              </span>
              <span className="text-xs text-pdd-text-secondary">
                {batchQueue.done + batchQueue.failed}/{batchQueue.total}
                {batchQueue.failed > 0 && <span className="text-pdd-danger ml-1">({batchQueue.failed} 失败)</span>}
              </span>
            </div>
            <Progress value={((batchQueue.done + batchQueue.failed) / batchQueue.total) * 100} className="h-1.5" />
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-pdd-text-secondary">
              <span className="text-pdd-success">✅ {batchQueue.done} 成功</span>
              {batchQueue.failed > 0 && <span className="text-pdd-danger">❌ {batchQueue.failed} 失败</span>}
              <span className="text-pdd-text-secondary">⏳ {batchQueue.total - batchQueue.done - batchQueue.failed} 进行中</span>
            </div>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>

        {files.map(f => (

          <motion.div key={f.name} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}>
            <Card className="mb-3 border-pdd-border/60 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">

                  {/* 类型图标 */}
                  <div className="w-9 h-9 rounded-lg bg-pdd-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {f.type === 'csv' ? <FileText className="w-4 h-4 text-pdd-primary" /> : <FileSpreadsheet className="w-4 h-4 text-pdd-primary" />}
                  </div>

                  {/* 内容区域 */}
                  <div className="flex-1 min-w-0">

                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-pdd-text truncate">{f.name}</p>
                      <button onClick={() => removeFile(f.name)} className="shrink-0 text-pdd-text-secondary hover:text-pdd-danger transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-pdd-text-secondary mt-0.5">
                      {f.detectedType || '检测中...'} · {(f.size / 1024).toFixed(1)}KB
                      {f.detectedType && f.detectedType !== '检测中...' && f.status === 'parsing' && <span className="ml-2 text-pdd-primary">解析中...</span>}
                    </p>

                    {/* ★ 进度条：解析状态始终显示 */}
                    {f.status === 'parsing' && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-pdd-border/50 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-pdd-primary to-purple-500"
                            initial={{ width: '0%' }}
                            animate={{ width: `${f.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-[10px] text-pdd-text-secondary mt-1">{f.progress}%</p>
                      </div>
                    )}

                    {/* ★ 完成状态 */}
                    {f.status === 'done' && (
                      <div className="text-xs mt-1.5 space-y-1">

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-pdd-success/10 text-pdd-success border-pdd-success/30 text-[10px] px-2 py-0">
                            ✅ {f.fieldCount}列 × {f.rowCount}行
                          </Badge>
                          {f.missingFields?.length ? (
                            <Badge variant="outline" className="bg-pdd-warning/10 text-pdd-warning border-pdd-warning/30 text-[10px] px-2 py-0">
                              ⚠️ 缺{f.missingFields.length}个字段
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-pdd-success/10 text-pdd-success border-pdd-success/30 text-[10px] px-2 py-0">
                              ✓ 字段完整
                            </Badge>
                          )}
                        </div>

                        {f.duplicateCount !== undefined && f.duplicateCount > 0 && (
                          <p className="text-pdd-warning/80 text-[10px]">🔄 已过滤 {f.duplicateCount} 条重复，实际新增 {f.newCount} 条</p>
                        )}

                        {f.mismatchWarning && (
                          <div className={`mt-1 p-2 rounded border-l-4 ${f.mismatchWarning.type === 'no_overlap' ? 'bg-pdd-danger/10 border-pdd-danger' : 'bg-pdd-warning/10 border-pdd-warning'}`}>
                            <p className={`font-medium text-[10px] ${f.mismatchWarning.type === 'no_overlap' ? 'text-pdd-danger' : 'text-pdd-warning'}`}>{f.mismatchWarning.message}</p>
                            <p className="text-[10px] text-pdd-text-secondary mt-0.5">{f.mismatchWarning.details}</p>
                          </div>
                        )}

                        {/* 同步按钮 */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-pdd-success" />
                          <span className="text-pdd-success text-[10px]">解析完成</span>
                          {f.detectedType === '订单数据' && currentStore && (
                            <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/dashboard'; }} className="px-2 py-0.5 text-[10px] bg-pdd-success/20 text-pdd-success rounded hover:bg-pdd-success/30 transition-colors">查看仪表盘</button>
                          )}
                          {['商品推广数据', '明星店铺数据', '直播推广数据'].includes(f.detectedType || '') && currentStore && (
                            <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/promotion'; }} className="px-2 py-0.5 text-[10px] bg-pdd-success/20 text-pdd-success rounded hover:bg-pdd-success/30 transition-colors">查看推广</button>
                          )}
                          {f.detectedType === '运费险数据' && currentStore && (
                            <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/shipping-insurance'; }} className="px-2 py-0.5 text-[10px] bg-pdd-success/20 text-pdd-success rounded hover:bg-pdd-success/30 transition-colors">查看运费险</button>
                          )}
                          {f.detectedType === '售后数据' && currentStore && (
                            <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/after-sale'; }} className="px-2 py-0.5 text-[10px] bg-pdd-success/20 text-pdd-success rounded hover:bg-pdd-success/30 transition-colors">查看售后</button>
                          )}
                          {f.detectedType === '货款明细' && currentStore && (
                            <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/reconciliation'; }} className="px-2 py-0.5 text-[10px] bg-pdd-success/20 text-pdd-success rounded hover:bg-pdd-success/30 transition-colors">查看财务</button>
                          )}
                        </div>

                      </div>
                    )}

                    {/* ★ 错误状态 */}
                    {f.status === 'error' && (
                      <div className="mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-pdd-danger" />
                          <span className="text-xs text-pdd-danger font-medium">解析失败</span>
                        </div>
                        {f.errorMessage && <p className="text-[10px] text-pdd-danger/70 mt-0.5">{f.errorMessage}</p>}
                      </div>
                    )}

                  </div>

                  {/* 右侧状态图标 */}
                  <div className="shrink-0 flex items-center mt-0.5">
                    {f.status === 'parsing' && <Loader2 className="w-4 h-4 text-pdd-primary animate-spin" />}
                    {f.status === 'done' && <CheckCircle className="w-4 h-4 text-pdd-success" />}
                    {f.status === 'error' && <AlertCircle className="w-4 h-4 text-pdd-danger" />}
                  </div>

                </div>
              </CardContent>
            </Card>
          </motion.div>

        ))}

      </AnimatePresence>

      {/* ★ 上传诊断面板 */}
      {files.filter(f => f.status === 'done').length > 0 && (() => {
        const doneFiles = files.filter(f => f.status === 'done');
        const totalRows = doneFiles.reduce((s, f) => s + (f.rowCount || 0), 0);
        const totalJsonKB = doneFiles.reduce((s, f) => s + (f.jsonEstimateKB || 0), 0);
        const allDates = doneFiles.flatMap(f => [f.dateStart, f.dateEnd]).filter(Boolean) as string[];
        const allPrivacy = [...new Set(doneFiles.flatMap(f => f.privacyFields || []))];
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-medium text-sm">上传诊断</span>
              <span className="text-blue-400/50 text-xs">{doneFiles.length} 个文件 · {totalRows.toLocaleString()} 行 · 预估 {totalJsonKB >= 1024 ? (totalJsonKB / 1024).toFixed(1) + ' MB' : totalJsonKB + ' KB'}</span>
            </div>
            {allDates.length > 0 && (
              <p className="text-blue-400/70 text-xs mb-2">
                数据日期范围：{allDates.sort()[0]} 至 {allDates.sort().reverse()[0]}
              </p>
            )}
            {allPrivacy.length > 0 && (
              <div className="flex items-start gap-2 text-xs">
                <span className="text-amber-400 shrink-0 mt-0.5">⚠</span>
                <span className="text-amber-400/80">
                  检测到隐私字段（{allPrivacy.join('、')}），同步时会被拒绝。请在 Excel 中删除这些列后重新上传。
                </span>
              </div>
            )}
            {totalJsonKB > 4096 && (
              <p className="text-amber-400/70 text-xs mt-2">⚠ JSON 数据量较大（{totalJsonKB >= 1024 ? (totalJsonKB / 1024).toFixed(1) + ' MB' : totalJsonKB + ' KB'}），建议拆分文件上传以避免同步超时。</p>
            )}
            {doneFiles.map(f => (
              <div key={f.name} className="mt-2 pt-2 border-t border-blue-500/10 text-xs text-blue-400/60">
                <span className="text-blue-300">{f.name}</span> · {f.detectedType || '未知'} · {f.rowCount?.toLocaleString()} 行
                {f.dateStart && f.dateEnd && <span> · {f.dateStart} ~ {f.dateEnd}</span>}
                {f.jsonEstimateKB ? <span> · {f.jsonEstimateKB >= 1024 ? (f.jsonEstimateKB / 1024).toFixed(1) + 'MB' : f.jsonEstimateKB + 'KB'}</span> : null}
              </div>
            ))}
          </motion.div>
        );
      })()}

      {lastSyncError && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-red-300 font-medium text-sm">同步到云端失败</p>
              <p className="text-red-400/80 text-xs mt-1">
                数据已保存在本地，当前页面可见，但刷新后会丢失。
              </p>
              <p className="text-red-400/80 text-xs mt-1 whitespace-pre-wrap">{lastSyncError}</p>
              <button onClick={clearSyncError} className="mt-2 text-xs text-red-400 hover:text-red-300 underline">关闭</button>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>

        {fieldReport && (

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card><CardContent className="p-4">
            <h3 className="font-bold mb-3 text-pdd-text">字段检测报告 · {fieldReport.type}</h3>

            {fieldReport.missing.length > 0 && (

              <div className="mb-3">

                <p className="text-pdd-danger font-medium mb-1">缺失必填字段 ({fieldReport.missing.length})</p>

                <div className="flex flex-wrap gap-2">{fieldReport.missing.map(f => <span key={f} className="pdd-badge-insufficient">{f}</span>)}</div>

              </div>

            )}

            <div>

              <p className="text-pdd-success font-medium mb-1">可用字段 ({fieldReport.available.length})</p>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-thin">{fieldReport.available.map(f => <span key={f} className="pdd-badge-free">{f}</span>)}</div>

            </div>

            </CardContent></Card>
          </motion.div>

        )}

      </AnimatePresence>

      {/* 网站更新日志 */}
      <Card className="mt-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <CardContent className="p-4">
        <button
          onClick={() => setShowChangelog(!showChangelog)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-bold flex items-center gap-2 text-pdd-text">
            <Clock size={18} className="text-pdd-primary" />网站更新日志
          </span>
          <span className="text-pdd-text-secondary">
            {showChangelog ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
        </button>
        <AnimatePresence>
          {showChangelog && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3">
                {changelog.map((entry) => (
                  <div key={entry.version} className="border border-pdd-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedVersion(expandedVersion === entry.version ? null : entry.version)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-pdd-bg hover:bg-pdd-border/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 text-xs font-bold bg-pdd-primary text-white rounded">{entry.version}</span>
                        <span className="text-xs text-pdd-text-secondary">{entry.date}</span>
                      </div>
                      <span className="text-pdd-text-secondary">
                        {expandedVersion === entry.version ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedVersion === entry.version && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <ul className="px-4 py-3 space-y-1.5 border-t border-pdd-border">
                            {entry.changes.map((change, i) => (
                              <li key={i} className="text-sm text-pdd-text-secondary flex items-start gap-2">
                                <span className="text-pdd-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-pdd-primary flex-shrink-0" />
                                {change}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </CardContent>
      </motion.div>
      </Card>
      </>)} {/* end Tab1: upload */}

      {/* ══════════════════════════════════════════════
          Tab2: 数据总览
         ══════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <DataOverview
          orders={getStoreData(currentStore?.id || '')?.orders || []}
          financialRecords={getStoreData(currentStore?.id || '')?.financialRecords || []}
          afterSaleRecords={getStoreData(currentStore?.id || '')?.afterSaleRecords || []}
          promotionProducts={getStoreData(currentStore?.id || '')?.promotionProducts || []}
        />
      )}

      {/* ══════════════════════════════════════════════
          Tab3: 数据质量检查
         ══════════════════════════════════════════════ */}
      {activeTab === 'quality' && (
        <DataQualityCheck
          orders={getStoreData(currentStore?.id || '')?.orders || []}
          financialRecords={getStoreData(currentStore?.id || '')?.financialRecords || []}
          afterSaleRecords={getStoreData(currentStore?.id || '')?.afterSaleRecords || []}
          promotionProducts={getStoreData(currentStore?.id || '')?.promotionProducts || []}
          filter={qualityFilter}
          onFilterChange={setQualityFilter}
        />
      )}

      {/* ══════════════════════════════════════════════
          Tab4: 数据清理
         ══════════════════════════════════════════════ */}
      {activeTab === 'cleanup' && (
        <DataCleanup
          stores={currentStore ? [currentStore] : []}
          uploadRecords={currentStoreUploads}
          onCleanup={(storeId, types) => {
            types.forEach(t => {
              if (t === 'orders') clearOrderData?.(storeId);
              else if (t === 'financialRecords') clearFinancialData?.(storeId);
              else if (t === 'afterSaleRecords') clearOrderData?.(storeId);
            });
            setCleanupTypes(new Set());
          }}
          onReset={() => clearAllData?.()}
        />
      )}

      {/* ══════════════════════════════════════════════
          Tab5: 同步状态
         ══════════════════════════════════════════════ */}
      {activeTab === 'sync' && (
        <SyncStatus
          orders={getStoreData(currentStore?.id || '')?.orders || []}
          financialRecords={getStoreData(currentStore?.id || '')?.financialRecords || []}
          afterSaleRecords={getStoreData(currentStore?.id || '')?.afterSaleRecords || []}
          shippingInsurance={getStoreData(currentStore?.id || '')?.shippingInsurance || []}
          promotionProducts={getStoreData(currentStore?.id || '')?.promotionProducts || []}
        />
      )}

    </div>

  );

}

