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
const MAX_LOGS = 500;

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
