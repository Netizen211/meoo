import React, { useState, useCallback } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { Upload, FileText, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Trash2, History, AlertTriangle, Store, ChevronDown, ChevronRight, Clock } from 'lucide-react';

import { useData, useStore } from '../App';

import Papa from 'papaparse';

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { changelog } from '../data/changelog';


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

  mismatchWarning?: DataMismatchWarning;

  errorMessage?: string;

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


// 将一行数据的字段名转换为标准字段名

function mapRowFields(row: any): any {

  const mapped: any = {};

  Object.keys(row).forEach(key => {

    const normalizedKey = normalizeFieldName(key);

    const standardKey = FIELD_NAME_MAP[normalizedKey] || key; // 如果不在映射表中，保留原字段名

    const val = row[key];

    // 同时清理字符串值

    mapped[standardKey] = typeof val === 'string' ? val.replace(/[\uFEFF\u00A0\t\r\n]+/g, '').trim() : val;

  });

  return mapped;

}


const FILE_TYPE_RULES: { keywords: string[]; label: string; icon: string }[] = [

  { keywords: ['订单', 'order'], label: '订单数据', icon: '📦' },

  { keywords: ['商品推广', '商品_推广'], label: '商品推广数据', icon: '📢' },

  { keywords: ['明星店铺', '明星店铺'], label: '明星店铺数据', icon: '⭐' },

  { keywords: ['直播推广', '直播'], label: '直播推广数据', icon: '🎥' },

  { keywords: ['运费险', 'report'], label: '运费险数据', icon: '🛡️' },

  { keywords: ['售后', '退款', '退货'], label: '售后数据', icon: '🔄' },

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
  // 拼多多货款明细CSV，字段：商户订单号、收入金额（+元）、支出金额（-元）、账务类型、业务描述
  if (fieldSet.has('商户订单号') && hasAny('收入金额（+元）', '收入金额(元)', '收入金额') && hasAny('支出金额（-元）', '支出金额(元)', '支出金额') && fieldSet.has('账务类型')) {
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

/** 获取货款明细行的唯一标识（商户订单号 + 发生时间） */
function getFinancialRowKey(row: any): string {
  return `${String(findField(row, '商户订单号') || '').trim()}_${String(findField(row, '发生时间') || '').trim()}`;
}

/** 获取运费险行的唯一标识 */
function getInsuranceRowKey(row: any): string {
  return String(findField(row, '订单编号') || '').trim();
}

/** 获取售后行的唯一标识 */
function getAfterSaleRowKey(row: any): string {
  return String(findField(row, '售后编号') || '').trim();
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

  const { getStoreData, setStoreData, uploadRecords, addUploadRecord, deleteUploadRecord, setDataFilter, dataFilter } = useData();

  const { currentStore } = useStore();

  const [files, setFiles] = useState<UploadedFile[]>([]);

  const [dragging, setDragging] = useState(false);

  const [fieldReport, setFieldReport] = useState<{ available: string[]; missing: string[]; type: string } | null>(null);

  const [showHistory, setShowHistory] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);


  const currentStoreUploads = uploadRecords.filter(r => r.storeId === currentStore?.id);


  /** 解析货款明细CSV原始内容：跳过元数据头，找到含"商户订单号"的真实表头行 */
  function parseFinancialCSV(rawContent: string): { fields: string[]; data: any[] } | null {
    const parsed = Papa.parse(rawContent, { header: false, skipEmptyLines: true });
    const rawRows = parsed.data as string[][];
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
      if (rawRows[i].some((cell: string) => cell && cell.includes('商户订单号'))) {
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

          return;

        }

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

      const existingSnapshot = getStoreData(targetStoreId) || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() } };

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

      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done', progress: 100, fieldCount: fields.length, rowCount: data.length, detectedType, missingFields: missing, mismatchWarning, duplicateCount: approxDuplicateCount, newCount: approxNewCount } : f));


      // 使用函数式更新避免闭包陷阱，确保基于最新状态合并

      setStoreData(targetStoreId, ((prevExisting: any) => {

        const existing = prevExisting || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() } };


        if (detectedType === '订单数据') {

          // 清洗字段名和值中的BOM/不可见字符（统一处理CSV和XLSX）
          const cleanCsvRow = (row: any) => {
            const cleaned: any = {};
            Object.keys(row).forEach(k => {
              const val = row[k];
              const cleanKey = typeof k === "string" ? k.replace(/[﻿ \t\r\n]+/g, "").trim() : k;
              cleaned[cleanKey] = typeof val === "string" ? val.replace(/[﻿ \t\r\n]+/g, "").trim() : val;
            });
            return cleaned;
          };
          const cleanedData = data.map(cleanCsvRow);
          const { merged: mergedOrders } = dedupMerge(existing.orders, cleanedData, getOrderRowKey);
          existing.orders = mergedOrders;

          existing.availableFields.csv = new Set(fields);

        } else if (detectedType === '货款明细') {

          if (!existing.financialRecords) existing.financialRecords = [];
          const { merged: mergedFinancial } = dedupMerge(existing.financialRecords, data, getFinancialRowKey);
          existing.financialRecords = mergedFinancial;

        } else if (detectedType === '运费险数据') {
          const { merged: mergedIns } = dedupMerge(existing.shippingInsurance, data, getInsuranceRowKey);
          existing.shippingInsurance = mergedIns;
          existing.availableFields.insurance = new Set(fields);

        } else if (detectedType === '售后数据') {
          if (!existing.afterSaleRecords) existing.afterSaleRecords = [];
          const { merged: mergedAS } = dedupMerge(existing.afterSaleRecords, data, getAfterSaleRowKey);
          existing.afterSaleRecords = mergedAS;
          if (!existing.availableFields.afterSale) existing.availableFields.afterSale = new Set();
          existing.availableFields.afterSale = new Set(fields);

        } else if (detectedType === '商品推广数据') {
          const hasProductId = fields.some((f: string) => {
            const n = f.replace(/[﻿ 	]/g, '').trim().toLowerCase();
            return n === '商品id' || n.includes('productid') || n.includes('商品编号');
          });
          if (hasProductId) {
            const getPromoKey = (r: any) => {
              const d = String(findField(r, '日期') || '').trim();
              if (!/^d{4}-d{2}-d{2}$/.test(d)) return '';
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
              if (/^d{4}-d{2}-d{2}$/.test(d)) summaryMap.set(d, r);
            });
            data.forEach((item: any) => {
              const d = String(findField(item, '日期') || '').trim();
              if (/^d{4}-d{2}-d{2}$/.test(d)) summaryMap.set(d, item);
            });
            existing.promotionSummary = Array.from(summaryMap.values());
          }
          fields.forEach((f: string) => existing.availableFields.promotion.add(f));

        } else if (detectedType === '明星店铺数据') {
          const hasDistinguish = fields.includes('推广名称') || fields.includes('创意样式');
          const starMap = new Map<string, any>();
          existing.starStoreSummary.forEach((r: any) => {
            const d = String(findField(r, '日期') || '').trim();
            if (/^d{4}-d{2}-d{2}$/.test(d)) {
              const suffix = hasDistinguish ? '-' + String(findField(r, '推广名称') || findField(r, '创意样式') || '').trim() : '';
              starMap.set(d + suffix, r);
            }
          });
          data.forEach((item: any) => {
            const d = String(findField(item, '日期') || '').trim();
            if (!/^d{4}-d{2}-d{2}$/.test(d)) return;
            const suffix = hasDistinguish ? '-' + String(findField(item, '推广名称') || findField(item, '创意样式') || '').trim() : '';
            starMap.set(d + suffix, item);
          });
          existing.starStoreSummary = Array.from(starMap.values());

        } else if (detectedType === '直播推广数据') {
          const hasDistinguish = fields.includes('直播间') || fields.includes('推广名称');
          const liveMap = new Map<string, any>();
          existing.liveStreamSummary.forEach((r: any) => {
            const d = String(findField(r, '日期') || '').trim();
            if (/^d{4}-d{2}-d{2}$/.test(d)) {
              const suffix = hasDistinguish ? '-' + String(findField(r, '直播间') || findField(r, '推广名称') || '').trim() : '';
              liveMap.set(d + suffix, r);
            }
          });
          data.forEach((item: any) => {
            const d = String(findField(item, '日期') || '').trim();
            if (!/^d{4}-d{2}-d{2}$/.test(d)) return;
            const suffix = hasDistinguish ? '-' + String(findField(item, '直播间') || findField(item, '推广名称') || '').trim() : '';
            liveMap.set(d + suffix, item);
          });
          existing.liveStreamSummary = Array.from(liveMap.values());

        }


        return { ...existing, availableFields: { ...existing.availableFields } };

      }) as any);

      setDataFilter(targetStoreId); // 上传后自动切换到该店铺的数据视图

      setFieldReport({ available: fields, missing, type: detectedType });

      addUploadRecord({ fileName: file.name, fileType: detectedType, storeId: targetStoreId, storeName: targetStoreName, rowCount: data.length, fieldCount: fields.length });

    })();

  }, [getStoreData, setStoreData, addUploadRecord, setDataFilter]);


  const processXlsxFile = useCallback((file: File, targetStoreId: string, targetStoreName: string) => {

    const reader = new FileReader();

    reader.onprogress = (e) => { if (e.lengthComputable) setFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress: Math.round((e.loaded / e.total) * 80) } : f)); };

    reader.onload = (e) => {

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

          });

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
        const existingSnapshot = getStoreData(targetStoreId) || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() } };
        let mismatchWarning: DataMismatchWarning | undefined;
        if (primaryType === '商品推广数据') {
          const allPromoProducts = sheetInfos
            .filter(info => info.type === '商品推广数据')
            .flatMap(info => info.data)
            .filter(isValidDateRow);
          mismatchWarning = checkDataConsistency(allPromoProducts, '商品推广数据', existingSnapshot);
        }

        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done', progress: 100, fieldCount: allFields.length, rowCount: totalRows, detectedType: primaryType, missingFields: missing, mismatchWarning } : f));

        // 使用 functional updater 合并数据，避免并发上传时的竞态覆盖
        setStoreData(targetStoreId, (prev: any) => {
          const base = prev || { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() } };
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
              csv: new Set(base.availableFields?.csv || []),
              promotion: new Set(base.availableFields?.promotion || []),
              insurance: new Set(base.availableFields?.insurance || []),
              afterSale: new Set(base.availableFields?.afterSale || []),
            },
          };

          const processedTypes = new Set<string>();

          for (const info of sheetInfos) {
            if (processedTypes.has(info.type) && info.type !== '商品推广数据') continue;

            if (info.type === '商品推广数据') {
              const hasProductId = info.fields.includes('商品ID');
              if (hasProductId) {
                if (!processedTypes.has('商品推广_产品')) {
                  merged.promotionProducts = [];
                }
                const seenKeys = new Set<string>();
                info.data.forEach((item: any) => {
                  if (!isValidDateRow(item)) return;
                  const key = `${String(findField(item, '日期') || '').trim()}-${String(findField(item, '商品ID') || '').trim()}-${String(findField(item, '推广名称') || '').trim()}`;
                  if (!seenKeys.has(key)) {
                    merged.promotionProducts.push(item);
                    seenKeys.add(key);
                  }
                });
                info.fields.forEach((f: string) => merged.availableFields.promotion.add(f));
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
                info.fields.forEach((f: string) => merged.availableFields.promotion.add(f));
              }
              processedTypes.add(info.type);
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
              info.data.forEach((item: any) => {
                if (!isValidDateRow(item)) return;
                const promoItem = { ...item, _source: 'starStore' };
                if (!promoItem['商品ID']) promoItem['商品ID'] = findField(item, '推广名称') || findField(item, '创意样式') || '明星店铺';
                if (!promoItem['商品名称']) promoItem['商品名称'] = findField(item, '推广名称') || findField(item, '创意样式') || '明星店铺';
                merged.promotionProducts.push(promoItem);
              });
              processedTypes.add(info.type);
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
              info.data.forEach((item: any) => {
                if (!isValidDateRow(item)) return;
                const promoItem = { ...item, _source: 'liveStream' };
                if (!promoItem['商品ID']) promoItem['商品ID'] = findField(item, '直播间') || '直播推广';
                if (!promoItem['商品名称']) promoItem['商品名称'] = findField(item, '直播间') || '直播推广';
                merged.promotionProducts.push(promoItem);
              });
              processedTypes.add(info.type);
            } else if (info.type === '运费险数据') {
              const { merged: mergedIns } = dedupMerge(merged.shippingInsurance, info.data, getInsuranceRowKey);
              merged.shippingInsurance = mergedIns;
              merged.availableFields.insurance = new Set(info.fields);
              processedTypes.add(info.type);
            } else if (info.type === '售后数据') {
              if (!merged.afterSaleRecords) merged.afterSaleRecords = [];
              const { merged: mergedAS } = dedupMerge(merged.afterSaleRecords, info.data, getAfterSaleRowKey);
              merged.afterSaleRecords = mergedAS;
              if (!merged.availableFields.afterSale) merged.availableFields.afterSale = new Set();
              merged.availableFields.afterSale = new Set(info.fields);
              processedTypes.add(info.type);
            } else if (info.type === '订单数据') {
              const { merged: mergedOrdersX, newCount: orderNew, dupCount: orderDup } = dedupMerge(merged.orders, info.data, getOrderRowKey);
              merged.orders = mergedOrdersX;
              merged.availableFields.csv = new Set(info.fields);
              processedTypes.add(info.type);
            }
          }

          return { ...merged, availableFields: { ...merged.availableFields } };
        });

        setDataFilter(targetStoreId);
        setFieldReport({ available: allFields, missing, type: primaryType });
        addUploadRecord({ fileName: file.name, fileType: primaryType, storeId: targetStoreId, storeName: targetStoreName, rowCount: totalRows, fieldCount: allFields.length });

      } catch (err) {

        const errMsg = `XLSX解析失败: ${err instanceof Error ? err.message : '未知错误'}。请检查文件是否为有效的Excel格式。`;

        console.error('XLSX parse error:', { err, fileName: file.name });

        setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMessage: errMsg } : f));

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
      // 更新 ZIP 文件条目的状态
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done', progress: 100, detectedType: `压缩包 (${entries.length}个子文件)` } : f));
      // 逐个提取并处理子文件
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
    }
  }, [processCsvFile, processXlsxFile]);


  const processFile = useCallback((file: File) => {

    if (!currentStore) { alert('请先选择一个店铺'); return; }
    if (dataFilter === '__all__') { alert('请在下拉菜单中选择一个具体店铺后再上传数据'); return; }

    const targetStoreId = currentStore.id;

    const targetStoreName = currentStore.name;

    // 文件指纹检测：同名文件再次上传时弹窗确认
    const existingRecord = uploadRecords.find((r: any) => r.fileName === file.name && r.storeId === targetStoreId);
    if (existingRecord) {
      const confirmed = window.confirm(
        `文件 "${file.name}" 已上传过（${new Date(existingRecord.uploadedAt).toLocaleString()}）。\n\n是否继续上传？重复数据将自动去重。`
      );
      if (!confirmed) return;
    }

    const isZip = file.name.toLowerCase().endsWith('.zip');
    const ext = file.name.toLowerCase().endsWith('.csv') ? 'csv' : isZip ? 'zip' : 'xlsx';

    const entry: UploadedFile = { name: file.name, type: ext, size: file.size, status: 'parsing', progress: 0, detectedType: '检测中...' };

    setFiles(prev => [...prev, entry]);


    if (ext === 'zip') {
      processZipFile(file, targetStoreId, targetStoreName);
    } else if (ext === 'csv') {

      processCsvFile(file, targetStoreId, targetStoreName);

    } else {

      processXlsxFile(file, targetStoreId, targetStoreName);

    }

  }, [currentStore, dataFilter, processCsvFile, processXlsxFile, processZipFile]);


  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(false); Array.from(e.dataTransfer.files).forEach(processFile); }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { Array.from(e.target.files || []).forEach(processFile); e.target.value = ''; }, [processFile]);

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


  const toggleSelectAll = () => {

    if (selectedRecords.size === currentStoreUploads.length) {

      setSelectedRecords(new Set());

    } else {

      setSelectedRecords(new Set(currentStoreUploads.map(r => r.id)));

    }

  };


  const handleBatchDelete = () => {

    selectedRecords.forEach(id => deleteUploadRecord(id));

    setSelectedRecords(new Set());

    setBatchDeleteConfirm(false);

  };


  return (

    <div className="p-6 max-w-4xl mx-auto">

      <div className="flex items-center justify-between mb-4">

        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">数据上传</motion.h1>

        <div className="flex items-center gap-3">

          {currentStore && (

            <div className="flex items-center gap-2 px-3 py-1.5 bg-pdd-primary/10 border border-pdd-primary/30 rounded-lg">

              <Store size={16} className="text-pdd-primary" />

              <span className="text-sm font-medium text-pdd-primary">当前店铺: {currentStore.name}</span>

            </div>

          )}

          {currentStoreUploads.length > 0 && (

            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-pdd-border hover:bg-pdd-bg transition-colors text-pdd-text-secondary">

              <History size={16} />上传记录 ({currentStoreUploads.length})

            </button>

          )}

        </div>

      </div>


      {!currentStore && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card mb-4 border-l-4 border-pdd-danger"><p className="text-pdd-danger font-medium">请先在店铺管理中创建一个店铺</p></motion.div>}


      <AnimatePresence>

        {showHistory && (

          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">

            <div className="pdd-card">

              <div className="flex items-center justify-between mb-3">

                <h3 className="font-bold flex items-center gap-2"><History size={18} className="text-pdd-danger" />当前店铺上传记录</h3>

                <div className="flex items-center gap-2">

                  {selectedRecords.size > 0 && (

                    <button onClick={() => setBatchDeleteConfirm(true)} className="px-2 py-1 text-xs bg-pdd-danger text-white rounded hover:bg-pdd-danger/80 transition-colors">

                      批量删除 ({selectedRecords.size})

                    </button>

                  )}

                  <button onClick={() => setShowHistory(false)} className="text-pdd-text-secondary hover:text-pdd-text"><X size={18} /></button>

                </div>

              </div>

              {currentStoreUploads.length > 0 && (

                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-pdd-border">

                  <input

                    type="checkbox"

                    checked={selectedRecords.size === currentStoreUploads.length && currentStoreUploads.length > 0}

                    onChange={toggleSelectAll}

                    className="w-4 h-4 rounded border-pdd-border text-pdd-danger focus:ring-pdd-danger"

                  />

                  <span className="text-xs text-pdd-text-secondary">全选 ({currentStoreUploads.length})</span>

                </div>

              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">

                {currentStoreUploads.map(record => (

                  <div key={record.id} className={`flex items-center justify-between p-3 rounded-lg border ${selectedRecords.has(record.id) ? 'bg-pdd-info/10 border-pdd-info' : 'bg-pdd-bg border-pdd-border'}`}>

                    <div className="flex items-center gap-3 flex-1 min-w-0">

                      <input

                        type="checkbox"

                        checked={selectedRecords.has(record.id)}

                        onChange={() => toggleSelectRecord(record.id)}

                        className="w-4 h-4 rounded border-pdd-border text-pdd-danger focus:ring-pdd-danger"

                      />

                      <div className="flex-1 min-w-0">

                        <p className="font-medium truncate text-pdd-text">{record.fileName}</p>

                        <p className="text-xs text-pdd-text-secondary">{record.fileType} · {record.rowCount}行 · {new Date(record.uploadedAt).toLocaleString('zh-CN')}</p>

                      </div>

                    </div>

                    {deleteConfirm === record.id ? (

                      <div className="flex items-center gap-2">

                        <span className="text-xs text-pdd-danger">确认删除?</span>

                        <button onClick={() => handleDeleteRecord(record.id)} className="px-2 py-1 text-xs bg-pdd-danger text-white rounded hover:bg-pdd-danger/80 transition-colors">确认</button>

                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 text-xs border border-pdd-border rounded hover:bg-pdd-bg transition-colors text-pdd-text-secondary">取消</button>

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

                        <button onClick={() => setDeleteConfirm(record.id)} className="p-1.5 text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 rounded transition-colors" title="删除此上传记录"><Trash2 size={16} /></button>

                      </div>

                    )}

                  </div>

                ))}

              </div>

              <div className="mt-3 pt-3 border-t border-pdd-border">

                <p className="text-xs text-pdd-text-secondary flex items-center gap-1"><AlertTriangle size={12} />删除记录会同时清除该文件导入的数据，请谨慎操作</p>

              </div>


              {/* 批量删除确认弹窗 */}

              {batchDeleteConfirm && (

                <div className="fixed inset-0 bg-pdd-text/50 flex items-center justify-center z-50">

                  <div className="bg-pdd-card rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border border-pdd-border">

                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-pdd-text">

                      <AlertTriangle size={20} className="text-pdd-danger" />

                      确认批量删除

                    </h3>

                    <p className="text-sm text-pdd-text-secondary mb-4">

                      确定要删除选中的 {selectedRecords.size} 条上传记录吗？此操作将同时清除这些文件导入的数据，且无法恢复。

                    </p>

                    <div className="flex justify-end gap-2">

                      <button

                        onClick={() => setBatchDeleteConfirm(false)}

                        className="px-4 py-2 text-sm border border-pdd-border rounded hover:bg-pdd-bg transition-colors text-pdd-text-secondary"

                      >

                        取消

                      </button>

                      <button

                        onClick={handleBatchDelete}

                        className="px-4 py-2 text-sm bg-pdd-danger text-white rounded hover:bg-pdd-danger/80 transition-colors"

                      >

                        确认删除

                      </button>

                    </div>

                  </div>

                </div>

              )}

            </div>

          </motion.div>

        )}

      </AnimatePresence>


      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}

        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}

        className={`pdd-card mb-6 text-center cursor-pointer transition-all ${dragging ? 'border-pdd-primary bg-pdd-primary/5 scale-[1.02]' : 'hover:border-pdd-primary'}`}

        onClick={() => document.getElementById('file-input')!.click()}>

        <input id="file-input" type="file" accept=".csv,.xlsx,.xls,.zip" multiple className="hidden" onChange={handleFileInput} />

        <motion.div animate={{ scale: dragging ? 1.1 : 1 }} className="py-12">

          <Upload className="w-12 h-12 mx-auto mb-3 text-pdd-primary" />

          <p className="text-lg font-medium text-pdd-text">拖拽文件到此处上传</p>

          <p className="text-pdd-text-secondary mt-1">支持 CSV、XLSX 格式 | 订单数据、推广数据、运费险数据</p>

        </motion.div>

      </motion.div>


      <AnimatePresence>

        {files.map(f => (

          <motion.div key={f.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="pdd-card mb-3 flex items-center gap-3">

            {f.type === 'csv' ? <FileText className="w-5 h-5 text-pdd-primary" /> : <FileSpreadsheet className="w-5 h-5 text-pdd-primary" />}

            <div className="flex-1 min-w-0">

              <p className="font-medium truncate text-pdd-text">{f.name}</p>

              <p className="text-sm text-pdd-text-secondary">{f.detectedType} · {(f.size / 1024).toFixed(1)}KB</p>

              {f.status === 'parsing' && <div className="mt-2 h-1.5 bg-pdd-border rounded-full overflow-hidden"><motion.div className="h-full bg-pdd-primary rounded-full" initial={{ width: '0%' }} animate={{ width: `${f.progress}%` }} /></div>}

              {f.status === 'done' && (

                <div className="text-sm mt-1 space-y-1">

                  <p className="text-pdd-success">{f.fieldCount}列 × {f.rowCount}行 · {f.missingFields?.length ? `缺${f.missingFields.length}个必填字段` : '字段完整'}</p>

                  {f.duplicateCount !== undefined && f.duplicateCount > 0 && (

                    <p className="text-pdd-warning">已过滤 {f.duplicateCount} 条重复订单，新增 {f.newCount} 条</p>

                  )}

                  {f.mismatchWarning && (

                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className={`mt-2 p-3 rounded-lg border-l-4 ${f.mismatchWarning.type === 'no_overlap' ? 'bg-pdd-danger/10 border-pdd-danger' : 'bg-pdd-warning/10 border-pdd-warning'}`}>

                      <div className="flex items-start gap-2">

                        <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${f.mismatchWarning.type === 'no_overlap' ? 'text-pdd-danger' : 'text-pdd-warning'}`} />

                        <div>

                          <p className={`font-medium text-xs ${f.mismatchWarning.type === 'no_overlap' ? 'text-pdd-danger' : 'text-pdd-warning'}`}>{f.mismatchWarning.message}</p>

                          <p className="text-xs text-pdd-text-secondary mt-1 leading-relaxed">{f.mismatchWarning.details}</p>

                        </div>

                      </div>

                    </motion.div>

                  )}

                </div>

              )}

              {f.status === 'error' && (

                <div className="mt-1">

                  <p className="text-sm text-pdd-danger font-medium">解析失败</p>

                  {f.errorMessage && <p className="text-xs text-pdd-danger mt-0.5 opacity-80">{f.errorMessage}</p>}

                </div>

              )}

            </div>

            {f.status === 'parsing' && <Loader2 className="w-5 h-5 text-pdd-primary animate-spin" />}

            {f.status === 'done' && (

              <div className="flex items-center gap-2">

                <CheckCircle className="w-5 h-5 text-pdd-success" />

                {f.detectedType === '订单数据' && currentStore && (

                  <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/dashboard'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                )}

                {['商品推广数据', '明星店铺数据', '直播推广数据'].includes(f.detectedType || '') && currentStore && (

                  <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/promotion'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                )}

                {f.detectedType === '运费险数据' && currentStore && (

                  <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/shipping-insurance'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                )}

                {f.detectedType === '售后数据' && currentStore && (

                  <button onClick={() => { setDataFilter(currentStore.id); window.location.hash = '#/after-sale'; }} className="px-2 py-1 text-xs bg-pdd-success text-white rounded hover:bg-pdd-success/80 transition-colors">同步</button>

                )}

              </div>

            )}

            {f.status === 'error' && <AlertCircle className="w-5 h-5 text-pdd-danger" />}

            <button onClick={() => removeFile(f.name)} className="text-pdd-text-secondary hover:text-pdd-danger"><X className="w-4 h-4" /></button>

          </motion.div>

        ))}

      </AnimatePresence>


      <AnimatePresence>

        {fieldReport && (

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pdd-card mt-4">

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

          </motion.div>

        )}

      </AnimatePresence>

      {/* 网站更新日志 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="pdd-card mt-4">
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
      </motion.div>

    </div>

  );

}

