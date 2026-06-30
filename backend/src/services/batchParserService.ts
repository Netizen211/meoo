/**
 * 服务端批量文件解析服务 (BatchParserService)
 *
 * 大厂方案：服务端异步解析，SSE 实时推送进度
 * 支持格式: .xlsx / .xls / .csv / .tsv / .txt
 *
 * 架构：
 *   HTTP上传 → multer 存盘 → 队列调度 → Worker 解析 → 批量 DB 写入 → SSE 通知
 *
 * 回退方案：
 *   若服务端解析失败，前端仍可使用旧有客户端解析路径
 */
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { sse } from './sseService';
import { saveStoreData, appendStoreData, saveAvailableFields, saveUploadRecords } from './dataService';
import { normalizeRecordKeys } from './fieldNormalizer';
import logger from './loggerService';

// ===== 类型定义 =====

export type FileCategory =
  | 'orders'
  | 'promotionSummary'
  | 'promotionHourly'
  | 'starStoreSummary'
  | 'liveStreamSummary'
  | 'shippingInsurance'
  | 'afterSaleRecords'
  | 'financialRecords'
  | 'unknown';

export interface BatchTask {
  taskId: string;
  userId: string;
  storeId: string;
  storeName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    parsed: number;
    saved: number;
    failed: number;
    currentFile: string;
  };
  files: Array<{
    originalName: string;
    savedPath: string;
    category: FileCategory;
    rowCount: number;
    error?: string;
  }>;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

// ===== 活跃任务表 =====

const activeTasks = new Map<string, BatchTask>();
const TASK_TTL = 30 * 60 * 1000;

// 定时清理过期任务
setInterval(() => {
  const now = Date.now();
  for (const [taskId, task] of activeTasks.entries()) {
    if (task.completedAt && now - task.completedAt > TASK_TTL) {
      for (const f of task.files) {
        try { fs.unlinkSync(f.savedPath); } catch { /* ignore */ }
      }
      activeTasks.delete(taskId);
    }
  }
}, 60000).unref();

// ===== ★ 全局处理队列：同一时间只处理一个上传任务，防止内存/DB 过载 =====

interface QueueItem {
  task: BatchTask;
  files: Array<{ originalName: string; buffer?: Buffer; path?: string }>;
  resolve: (task: BatchTask) => void;
}

const processingQueue: QueueItem[] = [];
let isProcessing = false;

async function dequeueAndProcess(): Promise<void> {
  if (isProcessing || processingQueue.length === 0) return;
  isProcessing = true;
  const item = processingQueue.shift()!;
  try {
    const result = await processBatchTaskImpl(item.task, item.files);
    item.resolve(result);
  } catch (err: any) {
    item.task.status = 'failed';
    item.task.error = err.message;
    logger.error('Queue processing error', { extra: { taskId: item.task.taskId, error: err.message } as any });
    item.resolve(item.task);
  } finally {
    isProcessing = false;
    dequeueAndProcess();
  }
}

/**
 * ★ 入队并等待处理（替代直接调用 processBatchTask）
 */
export function enqueueBatchTask(
  task: BatchTask,
  files: Array<{ originalName: string; buffer?: Buffer; path?: string }>,
): Promise<BatchTask> {
  return new Promise((resolve) => {
    processingQueue.push({ task, files, resolve });
    dequeueAndProcess();
  });
}

// ===== ★ 内存安全阈值 =====

const FLUSH_INTERVAL_FILES = 10;    // 每解析 N 个文件，把已有数据刷到 DB
const MAX_ROWS_PER_CATEGORY = 2000; // 任一分类超过此行数，触发提前刷库
const MAX_FILES_PER_BATCH = 200;    // 单次上传最多 200 个文件（超过截断）

// ===== 辅助: 推断文件分类 =====

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: FileCategory }> = [
  // ★ 具体推广类型优先匹配（避免被"商品|推广"笼统捕获）
  { pattern: /明星店铺|品牌词|创意|star.?store/i, category: 'starStoreSummary' },
  { pattern: /直播|living|live.?stream/i, category: 'liveStreamSummary' },
  // ★ 商品推广_分小时 → promotionHourly（需在"商品|推广"之前）
  { pattern: /商品推广.*分小时|promotion.*hourly/i, category: 'promotionHourly' },
  // ★ 通用推广（分天汇总）
  { pattern: /商品|推广|promotion/i, category: 'promotionSummary' },
  { pattern: /售后|after.?sale/i, category: 'afterSaleRecords' },
  { pattern: /保险|insurance|shipping|运费险/i, category: 'shippingInsurance' },
  { pattern: /财务|financial|finance/i, category: 'financialRecords' },
  { pattern: /货款|流水|账务|account|明细查询/i, category: 'financialRecords' },
  { pattern: /订单|order/i, category: 'orders' },
];

function inferCategory(fileName: string, headers?: string[], sampleRows?: Record<string, any>[]): FileCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(fileName)) return category;
  }
  if (headers && headers.length > 0) {
    const joined = headers.join(' ');
    // ★ 优先级说明：
    //   1) 先检查各推广类型的唯一关键词——"店铺关注量"→明星店铺，"直播间/直播评论量"→直播推广
    //      这些不会与通用推广/财务字段冲突
    //   2) 所有分小时表都有"时段"，放第二优先（必须在财务之前，因为 promo 数据包含"结算""净成交"）
    //   3) 再检查财务类（已移除"结算""净成交"——这些词也出现在推广表头如"结算投产比""净成交笔数"）
    if (/明星店铺|创意样式|品牌词|店铺关注量|店铺收藏/i.test(joined)) return 'starStoreSummary';
    if (/直播|直播间|直播时长|直播评论量|关注量.*深度观看/i.test(joined)) return 'liveStreamSummary';
    // ★ 分小时数据："时段"是所有分小时表的共有字段（商品推广/明星店铺/直播推广的分解都含）
    if (/时段|分小时|hourly/i.test(joined)) return 'promotionHourly';
    // ★ 财务类检测（不含"结算""净成交"等推广表也有的词）
    if (/账务|流水|货款|交易流水|明细查询|account|financial|bill.?detail/i.test(joined)) return 'financialRecords';
    // ★ 财务特定字段：货款收入、推广费用、技术服务费（不含"净成交"）
    if (/货款收入|推广费用|技术服务费/i.test(joined)) return 'financialRecords';
    if (/推广|消耗|展现|点击|cpc|cpm|roi|投入产出/i.test(joined)) return 'promotionSummary';
    if (/售后|退货|退款|换货/i.test(joined)) return 'afterSaleRecords';
    if (/保险|运费险/i.test(joined)) return 'shippingInsurance';
    // ★ 订单检测放最后，避免"商户订单号"等财务字段误匹配
    if (/订单|买家|收货/i.test(joined)) return 'orders';

    // ★ 智能检测：单列表头 + 内容为交易流水号格式 → 财务记录
    if (headers.length === 1 && sampleRows && sampleRows.length > 0) {
      const sampleVal = String(sampleRows[0][headers[0]] || '');
      // 交易流水号格式：数字-数字（如 260520-355891955240329）
      if (/^\d{5,6}-\d{8,}$/.test(sampleVal)) return 'financialRecords';
      // 摘要行：包含 #支出合计 / #收入合计 / #总计 等
      if (/^#.*(合计|总计|导出时间)/.test(sampleVal)) return 'financialRecords';
    }
  }
  return 'unknown';
}

// ===== 辅助: 解析 CSV（无依赖实现，兼容 GBK/BOM） =====

function detectDelimiter(firstLine: string): string {
  const comma = (firstLine.match(/,/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  const semicolon = (firstLine.match(/;/g) || []).length;
  if (tab > comma && tab > semicolon) return '\t';
  if (semicolon > comma && semicolon > tab) return ';';
  return ',';
}

function parseCSVLines(content: string): string[][] {
  const delimiter = detectDelimiter(content.split('\n')[0] || '');
  const rows: string[] = [];
  let row = '';
  let inQuote = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') { row += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { row += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === '\n') { if (row.trim() || i < content.length - 1) { rows.push(row); row = ''; } }
      else if (ch === '\r') { /* skip CR */ }
      else { row += ch; }
    }
  }
  if (row.trim()) rows.push(row);

  return rows.map(r => {
    const cells: string[] = [];
    let cell = '';
    let inQ = false;
    for (let i = 0; i < r.length; i++) {
      const c = r[i];
      const n = r[i + 1];
      if (inQ) {
        if (c === '"' && n === '"') { cell += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cell += c; }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === delimiter) { cells.push(cell.trim()); cell = ''; }
        else { cell += c; }
      }
    }
    cells.push(cell.trim());
    return cells;
  });
}

function parseCSV(filePath: string): { headers: string[]; rows: Record<string, any>[] } | null {
  try {
    let content: string;
    const raw = fs.readFileSync(filePath);

    // ★ 编码检测：先看 BOM → UTF-8，再试 UTF-8，最后 GBK
    //   修复 UTF-8 with BOM 被 GBK 误解码导致字段名乱码的 bug
    const hasBOM = (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF);
    if (hasBOM) {
      // BOM 明确 => UTF-8，跳过 BOM 直接解码
      content = raw.toString('utf-8', 3);
    } else {
      try {
        const iconv = require('iconv-lite');
        if (iconv.encodingExists('GBK')) {
          // ★ 先试 UTF-8，若正常（无替换字符）则用 UTF-8，否则 GBK
          const utf8Candidate = raw.toString('utf-8');
          if (!utf8Candidate.includes('�')) {
            content = utf8Candidate;
          } else {
            content = iconv.decode(raw, 'GBK');
          }
        } else {
          content = raw.toString('utf-8');
        }
      } catch {
        content = raw.toString('utf-8');
      }
    }
    // 兜底：剥离 BOM 字符（如果前面流程漏掉了）
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

    const cells = parseCSVLines(content);
    if (cells.length < 2) return null;

    const headers = cells[0].map(h => h.trim());
    const rows = cells.slice(1).map(row => {
      const record: Record<string, any> = {};
      headers.forEach((h, i) => { record[h] = row[i] !== undefined ? row[i] : ''; });
      return record;
    });
    return { headers, rows };
  } catch (err: any) {
    logger.error('CSV parse error', { error: err.message, extra: { file: filePath } as any });
    return null;
  }
}

// ===== 辅助: 解析 XLSX =====

/**
 * ★ 熔解宽格式推广数据（匹配前端 meltWidePromoData 逻辑）
 * 拼多多导出的推广数据可能以日期作为列名（宽格式）：
 *   商品ID | 商品名称 | 2026-05-19 | 2026-05-20 | ...
 *   123    | 商品A   | 1234       | 5678       |
 * 熔解为长格式：
 *   { 商品ID: '123', 商品名称: '商品A', '日期': '2026-05-19', '2026-05-19': 1234 }
 *   { 商品ID: '123', 商品名称: '商品A', '日期': '2026-05-20', '2026-05-20': 5678 }
 */
function meltWidePromoData(rows: Record<string, any>[], headers: string[]): { melted: Record<string, any>[]; headers: string[]; isWide: boolean } {
  const DATE_COL_RE = /^\d{4}-\d{2}-\d{2}/;
  const dateFields = headers.filter(h => DATE_COL_RE.test(h));
  if (dateFields.length === 0) return { melted: [], headers, isWide: false };

  const idFields = headers.filter(h => !DATE_COL_RE.test(h));
  const result: Record<string, any>[] = [];
  for (const row of rows) {
    const idPart: Record<string, any> = {};
    for (const f of idFields) idPart[f] = row[f];
    for (const df of dateFields) {
      const val = row[df];
      if (val === undefined || val === null || val === '') continue;
      const newRow: Record<string, any> = { ...idPart, '日期': df };
      newRow[df] = val;
      result.push(newRow);
    }
  }
  // 新表头包含所有 idFields + 日期 + 各日期字段
  const newHeaders = [...idFields, '日期', ...dateFields];
  return { melted: result, headers: newHeaders, isWide: true };
}

/**
 * ★ 修复推广数据中日期在列名上的情况（匹配前端 fixPromoDateField 逻辑）
 * 分小时文件的第一列可能是日期字符串（如 "2026-05-19"），需要提取到 '日期' 字段
 */
function fixPromoDateField(rows: Record<string, any>[], headers: string[]): boolean {
  if (rows.length === 0 || headers.length === 0) return false;
  const firstKey = headers[0];
  const match = firstKey.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return false;
  const dateStr = match[1];
  let fixed = false;
  for (const item of rows) {
    if (!item['日期']) {
      item['日期'] = dateStr;
      fixed = true;
    }
  }
  return fixed;
}

/**
 * ★ 解析商品推广_分小时文件的透视表格式
 * 分小时文件的格式（行=指标，列=时段，日期在表头左上角）：
 *
 *   | 2026-06-04 | 成交花费(元) | 交易额(元) | 实际投产比 | ...
 *   | 9:00-10:00 | 27.92       | 59.39     | 2.13      |
 *
 * 正确输出（每个时段/指标组合一行）：
 *   { "日期": "2026-06-04", "时段": "9:00-10:00", "成交花费(元)": "27.92", "交易额(元)": "59.39", "实际投产比": "2.13" }
 */
function parseHourlyPromo(rows: Record<string, any>[], headers: string[]): { rows: Record<string, any>[]; headers: string[] } | null {
  if (rows.length === 0 || headers.length === 0) return null;

  // 检测第一个表头是否为日期格式
  const firstHeader = headers[0];
  const dateMatch = firstHeader.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;

  const dateStr = dateMatch[1];

  // 收集指标名称（从第二列开始的所有表头）
  const metricHeaders = headers.slice(1).filter(h => h && h.trim());

  // 如果第一个单元格值看起来像时段（如 "9:00-10:00"），则是分小时格式
  const firstVal = String(rows[0][firstHeader] || '').trim();
  const isHourly = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(firstVal);
  if (!isHourly) return null;

  const result: Record<string, any>[] = [];

  for (const row of rows) {
    const timeSlot = String(row[firstHeader] || '').trim();
    if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(timeSlot)) continue;

    const newRow: Record<string, any> = {
      '日期': dateStr,
      '时段': timeSlot,
    };
    // 提取各指标的值
    for (const h of metricHeaders) {
      if (row[h] !== undefined && row[h] !== '') {
        newRow[h] = row[h];
      }
    }
    result.push(newRow);
  }

  if (result.length === 0) return null;

  const newHeaders = ['日期', '时段', ...metricHeaders];
  return { rows: result, headers: newHeaders };
}

function parseXLSX(filePath: string): { headers: string[]; rows: Record<string, any>[] } | null {
  try {
    let XLSX: any;
    try { XLSX = require('xlsx'); }
    catch {
      logger.warn('xlsx package not installed, cannot parse .xlsx files server-side');
      return null;
    }
    const workbook = XLSX.readFile(filePath, { type: 'file', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
    if (jsonData.length === 0) return null;
    const headers = Object.keys(jsonData[0]);
    return { headers, rows: jsonData };
  } catch (err: any) {
    logger.error('XLSX parse error', { error: err.message, extra: { file: filePath } as any });
    return null;
  }
}

// ===== 主解析函数 =====

function parseFile(filePath: string, originalName: string): {
  headers: string[];
  rows: Record<string, any>[];
  category: FileCategory;
} | null {
  const ext = path.extname(originalName).toLowerCase();
  let result: { headers: string[]; rows: Record<string, any>[] } | null = null;

  if (ext === '.csv' || ext === '.txt' || ext === '.tsv') {
    result = parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    result = parseXLSX(filePath);
    // ★ 检测宽格式推广数据（日期作为列名），熔解为长格式
    if (result && result.rows.length > 0) {
      // Step 0: 专用分小时解析（透视表格式：日期在表头、时段在首列值）
      const hourlyResult = parseHourlyPromo(result.rows, result.headers);
      if (hourlyResult) {
        logger.info(`Parsed hourly promo format for "${originalName}": ${hourlyResult.rows.length} rows`);
        result = hourlyResult;
      } else {
        // Step 1: 宽格式熔解（多列日期 → 每日期一行，用于分天汇总表）
        const { melted, headers: newHeaders, isWide } = meltWidePromoData(result.rows, result.headers);
        if (isWide && melted.length > 0) {
          logger.info(`Melted wide-format promo data for "${originalName}": ${result.rows.length} rows → ${melted.length} records`);
          result = { headers: newHeaders, rows: melted };
        }
        // Step 2: 修复首列为日期的情况
        const dateFixed = fixPromoDateField(result.rows, result.headers);
        if (dateFixed) {
          logger.info(`Fixed promo date field for "${originalName}"`);
        }
      }
    }
  } else {
    logger.warn('Unsupported file format', { extra: { file: originalName, ext } as any });
    return null;
  }
  if (!result || result.rows.length === 0) return null;

  const normalizedRows = result.rows.map(row => normalizeRecordKeys(row));
  const category = inferCategory(originalName, result.headers, normalizedRows);
  return { headers: result.headers, rows: normalizedRows, category };
}

// ===== 核心: 创建批量处理任务 =====

function getTempDir(): string {
  const dir = path.resolve(process.cwd(), 'temp_uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function createBatchTask(
  userId: string, storeId: string, storeName: string,
): BatchTask {
  const taskId = `batch-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const task: BatchTask = {
    taskId, userId, storeId, storeName,
    status: 'queued',
    progress: { total: 0, parsed: 0, saved: 0, failed: 0, currentFile: '' },
    files: [],
    createdAt: Date.now(),
  };
  activeTasks.set(taskId, task);
  return task;
}

export function getTask(taskId: string): BatchTask | undefined {
  return activeTasks.get(taskId);
}

export function getAllTasks(userId?: string): BatchTask[] {
  const all = Array.from(activeTasks.values());
  return userId ? all.filter(t => t.userId === userId) : all;
}

/**
 * ★ 入队接口：外部调用此函数替代直接的 processBatchTask
 */
export async function processBatchTask(
  task: BatchTask,
  files: Array<{ originalName: string; buffer?: Buffer; path?: string }>,
): Promise<BatchTask> {
  return enqueueBatchTask(task, files);
}

/**
 * ★ 增量刷库：将当前 parsedData 写入 DB（与已有数据合并），然后清空 parsedData
 */
async function flushAccumulatedData(
  task: BatchTask,
  parsedData: Record<string, any[]>,
  headersPerCategory: Record<string, Set<string>>,
): Promise<void> {
  for (const [category, rows] of Object.entries(parsedData)) {
    if (rows.length === 0) continue;
    try {
      const totalRows = await appendStoreData(task.storeId, category as any, rows);
      task.progress.saved += rows.length;
      logger.info(`Flushed ${rows.length} rows to ${category} (total: ${totalRows})`, { extra: { taskId: task.taskId, storeId: task.storeId } as any });
    } catch (saveErr: any) {
      if (saveErr.message && saveErr.message.includes('foreign key constraint')) {
        throw new Error(`店铺 "${task.storeName || task.storeId}" 不存在或已被删除，数据无法保存。请先添加店铺后再上传`);
      }
      throw saveErr;
    }
    sse.sendToUser(task.userId, 'upload_progress', {
      taskId: task.taskId, progress: { ...task.progress },
      status: 'saving', category, batchSize: rows.length,
    });
  }
  // 清空已刷数据
  for (const key of Object.keys(parsedData)) {
    parsedData[key] = [];
  }
}

/**
 * 执行批量解析（异步，处理完后 task 状态会被更新）
 * ★ 内部实现（带增量刷库），外部通过 processBatchTask（入队）调用
 */
async function processBatchTaskImpl(
  task: BatchTask,
  files: Array<{ originalName: string; buffer?: Buffer; path?: string }>,
): Promise<BatchTask> {
  // ★ 验证店铺存在性（防止重置后 storeId 无效导致外键约束失败）
  try {
    const { db } = require('../db');
    const storeExists = await db('stores').where('id', task.storeId).first();
    if (!storeExists) {
      task.status = 'failed';
      task.error = `店铺 "${task.storeName || task.storeId}" 不存在或已被删除，请先添加店铺后再上传`;
      task.completedAt = Date.now();
      sse.sendToUser(task.userId, 'upload_error', {
        taskId: task.taskId,
        error: task.error,
      });
      logger.error('Batch upload failed: store not found', {
        extra: { taskId: task.taskId, storeId: task.storeId, storeName: task.storeName } as any,
      });
      return task;
    }
  } catch (err: any) {
    task.status = 'failed';
    task.error = '验证店铺信息时出错: ' + err.message;
    task.completedAt = Date.now();
    return task;
  }

  task.status = 'processing';
  task.progress.total = files.length;

  const parsedData: Record<string, any[]> = {
    orders: [],
    promotionSummary: [],
    promotionProducts: [],
    promotionHourly: [],      // ★ 新增：商品推广_分小时
    starStoreSummary: [],     // ★ 新增：明星店铺
    liveStreamSummary: [],    // ★ 新增：直播推广
    afterSaleRecords: [],
    shippingInsurance: [],
    financialRecords: [],
  };
  // ★ 按分类跟踪表头（用于 saveAvailableFields）
  const headersPerCategory: Record<string, Set<string>> = {
    orders: new Set(), promotionSummary: new Set(), promotionProducts: new Set(),
    promotionHourly: new Set(), starStoreSummary: new Set(), liveStreamSummary: new Set(),
    afterSaleRecords: new Set(), shippingInsurance: new Set(), financialRecords: new Set(),
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    task.progress.currentFile = file.originalName;

    let filePath = file.path || '';
    if (!filePath && file.buffer) {
      const tempDir = getTempDir();
      filePath = path.join(tempDir, `${uuidv4()}_${file.originalName}`);
      fs.writeFileSync(filePath, file.buffer);
    }
    if (!filePath || !fs.existsSync(filePath)) {
      task.files.push({ originalName: file.originalName, savedPath: filePath, category: 'unknown', rowCount: 0, error: '文件不存在' });
      task.progress.failed++;
      continue;
    }

    try {
      const result = parseFile(filePath, file.originalName);
      if (!result) {
        task.files.push({ originalName: file.originalName, savedPath: filePath, category: 'unknown', rowCount: 0, error: '无法解析文件' });
        task.progress.failed++;
        sse.sendToUser(task.userId, 'upload_progress', { taskId: task.taskId, progress: { ...task.progress }, file: file.originalName, status: 'failed', error: '无法解析文件' });
        continue;
      }

      task.files.push({ originalName: file.originalName, savedPath: filePath, category: result.category, rowCount: result.rows.length });

      const cat = result.category;
      // ★ 按分类跟踪表头（用于 saveAvailableFields 按类保存）
      if (cat !== 'unknown' && headersPerCategory[cat]) {
        for (const h of result.headers) {
          headersPerCategory[cat].add(h);
        }
      }
      if (cat !== 'unknown' && parsedData[cat]) {
        parsedData[cat].push(...result.rows);
      } else if (cat === 'orders') {
        // ★ 只有明确分类为 orders 才推入，unknown 不推入任何分类
        parsedData.orders.push(...result.rows);
      } else {
        // ★ unknown 或无对应 buckets 的分类 — 记录日志但跳过
        logger.warn(`Batch upload: skipped unknown category "${cat}" for file "${file.originalName}"`, { extra: { file: file.originalName, category: cat } as any });
      }

      task.progress.parsed++;
      sse.sendToUser(task.userId, 'upload_progress', {
        taskId: task.taskId, progress: { ...task.progress },
        file: file.originalName, status: 'parsed', rowCount: result.rows.length,
      });

      // ★ 增量刷库检查：每解析 FLUSH_INTERVAL_FILES 个文件，或某分类行数超阈值，写入 DB
      const totalRows = Object.values(parsedData).reduce((sum, arr) => sum + arr.length, 0);
      const exceedsThreshold = Object.values(parsedData).some(arr => arr.length > MAX_ROWS_PER_CATEGORY);
      if (totalRows > 0 && ((i + 1) % FLUSH_INTERVAL_FILES === 0 || exceedsThreshold)) {
        await flushAccumulatedData(task, parsedData, headersPerCategory);
      }
    } catch (err: any) {
      task.files.push({ originalName: file.originalName, savedPath: filePath, category: 'unknown', rowCount: 0, error: err.message });
      task.progress.failed++;
      sse.sendToUser(task.userId, 'upload_progress', { taskId: task.taskId, progress: { ...task.progress }, file: file.originalName, status: 'failed', error: err.message });
    }
  }

  // ===== 最终刷库：将剩余数据写入 DB（与已有增量数据合并） =====
  try {
    await flushAccumulatedData(task, parsedData, headersPerCategory);

    // ★ 按分类保存可用字段
    const catFields: { csv: string[]; promotion: string[]; insurance: string[]; afterSale: string[]; financial: string[] } = {
      csv: [], promotion: [], insurance: [], afterSale: [], financial: [],
    };
    for (const [cat, headers] of Object.entries(headersPerCategory)) {
      if (headers.size === 0) continue;
      const arr = Array.from(headers);
      if (cat === 'orders') catFields.csv = [...new Set([...catFields.csv, ...arr])];
      else if (['promotionSummary', 'promotionHourly', 'promotionProducts', 'starStoreSummary', 'liveStreamSummary'].includes(cat)) catFields.promotion = [...new Set([...catFields.promotion, ...arr])];
      else if (cat === 'shippingInsurance') catFields.insurance = [...new Set([...catFields.insurance, ...arr])];
      else if (cat === 'afterSaleRecords') catFields.afterSale = [...new Set([...catFields.afterSale, ...arr])];
      else if (cat === 'financialRecords') catFields.financial = [...new Set([...catFields.financial, ...arr])];
    }
    if (catFields.csv.length > 0 || catFields.promotion.length > 0 || catFields.insurance.length > 0 || catFields.afterSale.length > 0 || catFields.financial.length > 0) {
      await saveAvailableFields(task.storeId, catFields);
    }

    // ★ 保存上传记录（每个文件一条），前端同步状态页面依赖此数据
    try {
      const uploadRecords = task.files
        .filter(f => !f.error && f.category !== 'unknown' && f.rowCount > 0)
        .map(f => ({
          id: `${task.taskId}_${f.originalName}`,
          storeId: task.storeId,
          storeName: task.storeName,
          fileName: f.originalName,
          fileType: f.originalName.endsWith('.csv') ? 'csv' : f.originalName.endsWith('.xlsx') ? 'xlsx' : 'other',
          rowCount: f.rowCount,
          fieldCount: 0,
          uploadedAt: new Date(task.createdAt).toISOString(),
        }));
      if (uploadRecords.length > 0) {
        await saveUploadRecords(task.storeId, task.userId, uploadRecords);
      }
    } catch (recErr: any) {
      logger.warn('Failed to save upload records after batch', { extra: { error: recErr.message, taskId: task.taskId } as any });
    }

    // ★ 主动失效该店铺的缓存，确保前端下次请求时拉取最新数据
    try {
      const cache = require('./cacheService').default;
      cache.invalidateStore(task.storeId);
      logger.debug('Cache invalidated for store after batch upload', { extra: { storeId: task.storeId } as any });
    } catch (cacheErr: any) {
      logger.warn('Failed to invalidate cache after batch upload', { extra: { error: cacheErr.message } as any });
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    sse.sendToUser(task.userId, 'upload_complete', {
      taskId: task.taskId, storeId: task.storeId, progress: { ...task.progress },
      files: task.files.map(f => ({ originalName: f.originalName, category: f.category, rowCount: f.rowCount, error: f.error })),
    });
    logger.info('Batch upload completed', {
      extra: { taskId: task.taskId, userId: task.userId, storeId: task.storeId, totalFiles: task.progress.total, totalRows: task.progress.saved, failedFiles: task.progress.failed } as any,
    });
  } catch (err: any) {
    task.status = 'failed';
    task.error = err.message;
    sse.sendToUser(task.userId, 'upload_error', { taskId: task.taskId, storeId: task.storeId, error: err.message });
    logger.error('Batch upload DB save failed', { error: err.message, extra: { taskId: task.taskId } as any });
  }

  setTimeout(() => {
    for (const f of task.files) {
      try { if (f.savedPath && fs.existsSync(f.savedPath)) fs.unlinkSync(f.savedPath); } catch { /* ignore */ }
    }
  }, 5000).unref();

  return task;
}

export default { createBatchTask, processBatchTask, getTask, getAllTasks };
