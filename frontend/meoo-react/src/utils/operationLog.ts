// 操作日志工具模块

export interface OperationLog {
  id: string;
  timestamp: string;
  action: string;
  storeId: string;
  storeName: string;
  details: string;
  result: 'success' | 'failed';
}

const STORAGE_KEY = 'dianfx_operation_logs';
const MAX_LOGS = 1000;

// 所有操作类型定义
export const LOG_ACTIONS = {
  LOGIN: '登录账号',
  LOGOUT: '退出登录',
  REGISTER: '注册账号',
  UPLOAD_DATA: '上传数据',
  DELETE_UPLOAD: '删除上传记录',
  ADD_STORE: '添加店铺',
  DELETE_STORE: '删除店铺',
  CLEAR_ORDER: '清除订单数据',
  CLEAR_PROMOTION: '清除推广数据',
  CLEAR_FINANCIAL: '清除财务数据',
  CLEAR_COST: '清除成本配置',
  CLEAR_ALL: '清空全部数据',
  CLEAR_DEMO: '清除演示数据',
  DATA_RECOVERY: '数据恢复',
  UPDATE_COST: '修改成本配置',
  UPDATE_PACKAGING: '修改包装费',
  UPDATE_SHIPPING: '修改快递费',
  UPDATE_COMMISSION: '修改平台佣金率',
  UPDATE_TAX: '修改税费配置',
  UPDATE_DEDUCTION: '修改自定义扣费',
  UPDATE_ABNORMAL: '修改异常订单标记',
  IMPORT_DEMO: '导入演示数据',
  SYNC_DATA: '同步数据到云端',
  PULL_DATA: '从云端拉取数据',
  RECHARGE_APPLY: '提交充值申请',
} as const;

export function readLogs(): OperationLog[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function addLog(entry: Omit<OperationLog, 'id' | 'timestamp'>): void {
  const logs = readLogs();
  const newEntry: OperationLog = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newEntry);
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function clearLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}
