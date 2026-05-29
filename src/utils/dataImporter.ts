/**
 * 数据导入工具 - 自动加载 assets 中的示例数据
 */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { findField } from './index';
import { setItem, isIndexedDBAvailable } from '../services/localDataStore';

export interface StoreDataItem {
  orders: any[];
  promotionSummary: any[];
  promotionProducts: any[];
  starStoreSummary: any[];
  liveStreamSummary: any[];
  shippingInsurance: any[];
  afterSaleRecords: any[];
  financialRecords: any[];
  availableFields: { csv: Set<string>; promotion: Set<string>; insurance: Set<string>; afterSale: Set<string> };
}

const EMPTY_STORE_DATA: StoreDataItem = {
  orders: [],
  promotionSummary: [],
  promotionProducts: [],
  starStoreSummary: [],
  liveStreamSummary: [],
  shippingInsurance: [],
  afterSaleRecords: [],
  financialRecords: [],
  availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() }
};

// 清理字段名
function cleanField(s: string): string {
  return String(s).replace(/[\uFEFF\u00A0\t\r\n]+/g, '').trim();
}

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

  // ========== 1. 货款明细检测 ==========
  // 拼多多货款明细CSV，字段：商户订单号、收入金额（+元）、支出金额（-元）、账务类型
  if (fieldSet.has('商户订单号') && hasAny('收入金额（+元）', '收入金额(元)', '收入金额') && hasAny('支出金额（-元）', '支出金额(元)', '支出金额') && fieldSet.has('账务类型')) {
    return '货款明细';
  }

  // ========== 2. 售后数据检测 ==========
  // 固定字段：售后编号、订单编号、售后状态
  if (hasAll('售后编号', '订单编号', '售后状态')) {
    return '售后数据';
  }

  // ========== 2. 运费险数据检测 ==========
  // 优先检测运费险（避免被订单数据检测误判）
  // 固定字段：订单编号、服务费用/保费/理赔状态/收费编号
  if (fieldSet.has('订单编号') || fieldSet.has('订单号')) {
    if (hasAny('服务费用（元）', '服务费用(元)', '服务费用', '收费编号', '保费', '保费（元）', '保费(元)', '理赔状态', '运费补偿状态', '补偿状态', '收费状态')) {
      return '运费险数据';
    }
  }

  // ========== 3. 订单数据检测 ==========
  // 固定字段：订单号、商品名称、商品数量、商品ID、商家编码-规格维度、商品总价(元)、商家实收金额(元)
  // 核心识别：订单号 + (商家实收金额 或 商品总价)
  if (fieldSet.has('订单号')) {
    if (hasAny('商家实收金额(元)', '商品总价(元)', '商家实收', '实收金额')) {
      return '订单数据';
    }
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

// 解析 CSV 文件
async function parseCSV(content: string): Promise<{ fields: string[]; data: any[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (result) => resolve({ fields: result.meta.fields || [], data: result.data as any[] }),
      error: (err: Error) => reject(err)
    });
  });
}

// 解析 XLSX 文件
async function parseXLSX(arrayBuffer: ArrayBuffer): Promise<Record<string, { fields: string[]; data: any[]; type: string }>> {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const result: Record<string, { fields: string[]; data: any[]; type: string }> = {};

  wb.SheetNames.forEach(sn => {
    const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sn]);
    if (rawData.length === 0) return;

    const cleanedData = rawData.map((row: any) => {
      const cleaned: any = {};
      Object.keys(row).forEach(k => {
        const val = row[k];
        cleaned[k] = typeof val === 'string' ? cleanField(val) : val;
      });
      return cleaned;
    });

    const fields = Object.keys(cleanedData[0]);
    const type = detectFileTypeByContent(fields, sn);
    result[sn] = { fields, data: cleanedData, type };
  });

  return result;
}

// 处理订单数据
function processOrderData(existing: StoreDataItem, data: any[], fields: string[]): void {
  const existingOrderIds = new Set(existing.orders.map((o: any) => String(o['订单号'] || '').trim()));
  const newOrders: any[] = [];

  data.forEach((row: any) => {
    const orderId = String(row['订单号'] || '').trim();
    if (orderId && !existingOrderIds.has(orderId)) {
      newOrders.push(row);
      existingOrderIds.add(orderId);
    }
  });

  existing.orders = [...existing.orders, ...newOrders];
  fields.forEach(f => existing.availableFields.csv.add(f));
}

// 处理商品推广数据
function processPromotionData(existing: StoreDataItem, sheets: Record<string, { fields: string[]; data: any[]; type: string }>): void {
  const isValidDateRow = (item: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(item['日期'] || '').trim());
  const processedTypes = new Set<string>();

  for (const [sn, sheet] of Object.entries(sheets)) {
    if (sheet.type !== '商品推广数据') continue;

    const hasProductId = sheet.fields.includes('商品ID');

    if (hasProductId) {
      if (!processedTypes.has('商品推广_产品')) {
        existing.promotionProducts = [];
      }
      const seenKeys = new Set<string>();
      sheet.data.forEach((item: any) => {
        if (!isValidDateRow(item)) return;
        const key = `${item['日期'] || ''}-${item['商品ID'] || ''}-${item['推广名称'] || ''}`;
        if (!seenKeys.has(key)) {
          existing.promotionProducts.push(item);
          seenKeys.add(key);
        }
      });
      sheet.fields.forEach(f => existing.availableFields.promotion.add(f));
      processedTypes.add('商品推广_产品');
    } else {
      const summaryMap = new Map<string, any>();
      existing.promotionSummary.forEach((r: any) => {
        const d = String(r['日期'] || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) summaryMap.set(d, r);
      });
      sheet.data.forEach((item: any) => {
        if (!isValidDateRow(item)) return;
        summaryMap.set(String(item['日期']).trim(), item);
      });
      existing.promotionSummary = Array.from(summaryMap.values());
      sheet.fields.forEach(f => existing.availableFields.promotion.add(f));
      processedTypes.add('商品推广_汇总');
    }
  }
}

// 处理明星店铺数据
function processStarStoreData(existing: StoreDataItem, sheets: Record<string, { fields: string[]; data: any[]; type: string }>): void {
  const isValidDateRow = (item: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(item['日期'] || '').trim());

  for (const [sn, sheet] of Object.entries(sheets)) {
    if (sheet.type !== '明星店铺数据') continue;

    // 汇总sheet无推广名称/创意样式字段，仅用日期作为key
    const hasDistinguishField = sheet.fields.includes('推广名称') || sheet.fields.includes('创意样式');
    const starMap = new Map<string, any>();
    existing.starStoreSummary.forEach((r: any) => {
      const d = String(r['日期'] || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const suffix = hasDistinguishField ? `-${r['推广名称'] || r['创意样式'] || ''}` : '';
        starMap.set(`${d}${suffix}`, r);
      }
    });

    sheet.data.forEach((item: any) => {
      if (!isValidDateRow(item)) return;
      const suffix = hasDistinguishField ? `-${item['推广名称'] || item['创意样式'] || ''}` : '';
      const key = `${String(item['日期']).trim()}${suffix}`;
      starMap.set(key, item);
    });

    existing.starStoreSummary = Array.from(starMap.values());

    sheet.fields.forEach(f => existing.availableFields.promotion.add(f));
  }
}

// 处理直播推广数据
function processLiveStreamData(existing: StoreDataItem, sheets: Record<string, { fields: string[]; data: any[]; type: string }>): void {
  const isValidDateRow = (item: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(item['日期'] || '').trim());

  for (const [sn, sheet] of Object.entries(sheets)) {
    if (sheet.type !== '直播推广数据') continue;

    // 汇总sheet无直播间/推广名称字段，仅用日期作为key
    const hasDistinguishField = sheet.fields.includes('直播间') || sheet.fields.includes('推广名称');
    const liveMap = new Map<string, any>();
    existing.liveStreamSummary.forEach((r: any) => {
      const d = String(r['日期'] || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const suffix = hasDistinguishField ? `-${r['直播间'] || r['推广名称'] || ''}` : '';
        liveMap.set(`${d}${suffix}`, r);
      }
    });

    sheet.data.forEach((item: any) => {
      if (!isValidDateRow(item)) return;
      const suffix = hasDistinguishField ? `-${item['直播间'] || item['推广名称'] || ''}` : '';
      const key = `${String(item['日期']).trim()}${suffix}`;
      liveMap.set(key, item);
    });

    existing.liveStreamSummary = Array.from(liveMap.values());

    sheet.fields.forEach(f => existing.availableFields.promotion.add(f));
  }
}

// 处理运费险数据
function processInsuranceData(existing: StoreDataItem, sheets: Record<string, { fields: string[]; data: any[]; type: string }>): void {
  for (const [sn, sheet] of Object.entries(sheets)) {
    if (sheet.type !== '运费险数据') continue;

    const existingKeys = new Set(existing.shippingInsurance.map((r: any) => String(findField(r, '订单编号', '订单号') || '')));
    sheet.data.forEach((item: any) => {
      const key = String(findField(item, '订单编号', '订单号') || '');
      if (key && !existingKeys.has(key)) {
        existing.shippingInsurance.push(item);
        existingKeys.add(key);
      }
    });
    existing.availableFields.insurance = new Set(sheet.fields);
  }
}

// 处理售后数据
function processAfterSaleData(existing: StoreDataItem, sheets: Record<string, { fields: string[]; data: any[]; type: string }>): void {
  for (const [sn, sheet] of Object.entries(sheets)) {
    if (sheet.type !== '售后数据') continue;

    if (!existing.afterSaleRecords) existing.afterSaleRecords = [];
    const existingKeys = new Set(existing.afterSaleRecords.map((r: any) => String(r['售后编号'] || '')));
    sheet.data.forEach((item: any) => {
      const key = String(item['售后编号'] || '');
      if (key && !existingKeys.has(key)) {
        // 字段名规范化：统一商品ID字段名
        const normalized: any = { ...item };
        const pidFields = ['商品ID', '商品id', '商品编号', '商品Id'];
        let normalizedPid = '';
        for (const f of pidFields) {
          if (item[f] != null && String(item[f]).trim() !== '') {
            normalizedPid = String(item[f]).trim();
            break;
          }
        }
        if (normalizedPid) normalized['商品ID'] = normalizedPid;
        existing.afterSaleRecords!.push(normalized);
        existingKeys.add(key);
      }
    });
    if (!existing.availableFields.afterSale) existing.availableFields.afterSale = new Set();
    existing.availableFields.afterSale = new Set(sheet.fields);
  }
}

// 处理货款明细数据（GBK编码的CSV，含元数据头）
function processFinancialData(existing: StoreDataItem, rawContent: string): number {
  // 货款明细CSV前几行是元数据：标题行、日期范围行、分隔线行
  // 需要找到含"商户订单号"的表头行
  const allRows = Papa.parse(rawContent, { skipEmptyLines: true }).data as string[][];

  let headerIndex = -1;
  for (let i = 0; i < Math.min(allRows.length, 20); i++) {
    if (allRows[i].some((cell: string) => cell && cell.includes('商户订单号'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) return 0;

  const headers = allRows[headerIndex].map((h: string) => String(h || '').replace(/[﻿ \t\r\n]+/g, '').trim());
  const dataRows = allRows.slice(headerIndex + 1).filter(r => r.length >= 4 && r.some((c: string) => String(c || '').trim()));

  if (!existing.financialRecords) existing.financialRecords = [];
  const existingKeys = new Set(existing.financialRecords.map((r: any) => `${r['商户订单号'] || ''}_${r['发生时间'] || ''}`));

  const newRecords: any[] = [];
  dataRows.forEach((row: string[]) => {
    const record: any = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] || '').trim();
    });
    const key = `${record['商户订单号'] || ''}_${record['发生时间'] || ''}`;
    if (key.trim() && !existingKeys.has(key)) {
      newRecords.push(record);
      existingKeys.add(key);
    }
  });

  existing.financialRecords = [...existing.financialRecords, ...newRecords];
  return newRecords.length;
}

// 导入单个文件
async function importFile(filePath: string, existing: StoreDataItem): Promise<{ success: boolean; type: string; rowCount: number }> {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filePath}`);
    }

    if (filePath.endsWith('.csv')) {
      // 先用UTF-8尝试，如果字段检测不到再尝试GBK
      const arrayBuffer = await response.arrayBuffer();
      let content = new TextDecoder('utf-8').decode(arrayBuffer);
      let fields: string[] = [];
      let data: any[] = [];

      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      fields = parsed.meta.fields || [];
      data = parsed.data as any[];

      let type = detectFileTypeByContent(fields, undefined, filePath);

      // 如果UTF-8解析失败（字段为空或乱码），尝试GBK
      if (type === '未知类型' || fields.length === 0 || fields.some(f => f.includes('��'))) {
        content = new TextDecoder('gbk').decode(arrayBuffer);
        const gbkParsed = Papa.parse(content, { header: true, skipEmptyLines: true });
        fields = gbkParsed.meta.fields || [];
        data = gbkParsed.data as any[];
        type = detectFileTypeByContent(fields, undefined, filePath);
      }

      if (type === '订单数据') {
        processOrderData(existing, data, fields);
        return { success: true, type, rowCount: data.length };
      } else if (type === '货款明细') {
        const rowCount = processFinancialData(existing, content);
        return { success: true, type, rowCount };
      }

      return { success: true, type, rowCount: data.length };
    } else if (filePath.endsWith('.xlsx')) {
      const arrayBuffer = await response.arrayBuffer();
      const sheets = await parseXLSX(arrayBuffer);

      let totalRows = 0;
      let primaryType = '未知类型';

      // 处理各种类型的数据
      processPromotionData(existing, sheets);
      processStarStoreData(existing, sheets);
      processLiveStreamData(existing, sheets);
      processInsuranceData(existing, sheets);
      processAfterSaleData(existing, sheets);

      for (const [sn, sheet] of Object.entries(sheets)) {
        totalRows += sheet.data.length;
        if (primaryType === '未知类型' && sheet.type !== '未知类型') {
          primaryType = sheet.type;
        }
      }

      return { success: true, type: primaryType, rowCount: totalRows };
    }

    return { success: false, type: '未知类型', rowCount: 0 };
  } catch (err) {
    console.error(`导入失败 ${filePath}:`, err);
    return { success: false, type: '错误', rowCount: 0 };
  }
}

// 主导入函数
export async function importSampleData(): Promise<{ storeId: string; storeName: string; results: { file: string; type: string; rowCount: number }[] }> {
  const storeId = 'demo-store-' + Date.now();
  const storeName = '演示店铺（可删除）';
  const existing: StoreDataItem = { ...EMPTY_STORE_DATA };
  const results: { file: string; type: string; rowCount: number }[] = [];

  // 要导入的文件列表（全功能演示数据）
  const filesToImport = [
    '/demo_orders.csv',
    '/demo_promo.xlsx',
    '/demo_aftersale.xlsx',
    '/demo_insurance.xlsx',
    '/demo_finance.csv',
  ];

  for (const file of filesToImport) {
    const result = await importFile(file, existing);
    if (result.success) {
      results.push({ file: file.split('/').pop()!, type: result.type, rowCount: result.rowCount });
    }
  }

  // 保存到 localStorage - 使用与 App.tsx DataProvider 一致的存储格式
  const storeDataForSave = {
    ...existing,
    availableFields: {
      csv: Array.from(existing.availableFields.csv),
      promotion: Array.from(existing.availableFields.promotion),
      insurance: Array.from(existing.availableFields.insurance),
      afterSale: Array.from(existing.availableFields.afterSale)
    }
  };

  // 使用 dianfx_store_data_map 格式保存（与 App.tsx 加载逻辑一致）
  const existingMap = JSON.parse(localStorage.getItem('dianfx_store_data_map') || '{}');
  existingMap[storeId] = storeDataForSave;
  localStorage.setItem('dianfx_store_data_map', JSON.stringify(existingMap));

  // 直接写入 IndexedDB（绕过一次性迁移的 bug）
  if (isIndexedDBAvailable()) {
    setItem('storeData', storeId, storeDataForSave).catch(() => {});
  }

  // 创建店铺
  const stores = JSON.parse(localStorage.getItem('dianfx_stores') || '[]');
  stores.push({ id: storeId, name: storeName, createdAt: new Date().toISOString() });
  localStorage.setItem('dianfx_stores', JSON.stringify(stores));

  // 设置为当前店铺
  localStorage.setItem('dianfx_current_store', JSON.stringify({ id: storeId, name: storeName }));
  localStorage.setItem('dianfx_data_filter', storeId);

  // 添加上传记录
  const uploadRecords = JSON.parse(localStorage.getItem('dianfx_upload_records') || '[]');
  results.forEach(r => {
    uploadRecords.push({
      id: `upload-${Date.now()}-${Math.random()}`,
      fileName: r.file,
      fileType: r.type,
      storeId,
      storeName,
      uploadedAt: new Date().toISOString(),
      rowCount: r.rowCount,
      fieldCount: 0
    });
  });
  localStorage.setItem('dianfx_upload_records', JSON.stringify(uploadRecords));

  // === 写入演示 SKU 成本（与 CostManagementPage 相同格式）===
  const demoCosts: Record<string, number> = {
    'PD00001_SKU001': 28, 'PD00001_SKU002': 33, 'PD00001_SKU003': 28,
    'PD00002_SKU004': 45, 'PD00002_SKU005': 65,
    'PD00003_SKU006': 18, 'PD00003_SKU007': 30,
    'PD00004_SKU008': 15, 'PD00004_SKU009': 20,
    'PD00005_SKU010': 42, 'PD00005_SKU011': 42, 'PD00005_SKU012': 42,
    'PD00006_SKU013': 22, 'PD00006_SKU014': 22,
    'PD00007_SKU015': 12, 'PD00007_SKU016': 22,
    'PD00008_SKU017': 5,  'PD00008_SKU018': 8,
  };
  localStorage.setItem(`dianfx_product_costs_${storeId}`, JSON.stringify(demoCosts));

  // === 写入默认费用配置 ===
  const costConfigs = {
    packagingFeePerOrder: 1.5,    // 包装费(元/单)
    shippingFeePerOrder: 3.0,     // 快递费(元/单)
    platformCommissionRate: 0.6,  // 平台佣金(%)
    insuranceFeePerOrder: 1.0,    // 运费险(元/单)
    defaultCostRatio: 30,         // 默认成本比例(%)
    laborFeePerOrder: 2.0,        // 人工费(元/单)
  };
  localStorage.setItem(`dianfx_cost_configs_${storeId}`, JSON.stringify(costConfigs));

  return { storeId, storeName, results };
}

// 检查是否已导入示例数据
export function hasSampleData(): boolean {
  const stores: { id: string; name: string }[] = JSON.parse(localStorage.getItem('dianfx_stores') || '[]');
  // 不仅要店名含"演示"，还必须确认有实际订单数据
  return stores.some(s => {
    if (!s.name || !s.name.includes('演示')) return false;
    const key = `dianfx_store_data_${s.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      return (data.orders?.length > 0) || (data.promotionSummary?.length > 0);
    } catch { return false; }
  });
}

// 清除示例数据
export function clearSampleData(): void {
  const stores = JSON.parse(localStorage.getItem('dianfx_stores') || '[]');
  const demoStore = stores.find((s: any) => s.name && s.name.includes('演示'));
  if (demoStore) {
    const id = demoStore.id;
    const keysToRemove = [
      'dianfx_store_data_',
      'dianfx_product_costs_',
      'dianfx_cost_configs_',
      'dianfx_packaging_fee_',
      'dianfx_shipping_fee_',
      'dianfx_platform_commission_',
      'dianfx_labor_fee_',
      'dianfx_insurance_fee_',
      'dianfx_default_cost_ratio_',
      'dianfx_tax_configs_',
      'dianfx_custom_deductions_',
      'dianfx_abnormal_orders_',
      'dianfx_cost_history_',
      'dianfx_pricing_presets_',
    ];
    keysToRemove.forEach(prefix => localStorage.removeItem(`${prefix}${id}`));
    localStorage.removeItem(`dianfx_store_${id}`);
    localStorage.setItem('dianfx_stores', JSON.stringify(stores.filter((s: any) => s.id !== id)));
  }
}
