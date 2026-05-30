import React, { useEffect, useState, useCallback } from 'react';
import { adminApi, type AdminLog } from '../../api/adminApi';
import { motion } from 'framer-motion';
import { Download, Trash2, Search, Filter, Calendar, X } from 'lucide-react';

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  ban_user: { label: '封禁用户', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  unban_user: { label: '解封用户', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  admin_adjust_membership: { label: '调整会员', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  delete_data: { label: '删除数据', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  generate_invite: { label: '生成邀请码', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delete_invite: { label: '删除邀请码', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  system_config: { label: '系统配置', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  impersonate_user: { label: '模拟登录', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  auto_cleanup_expired: { label: '自动清理', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

const PAGE_SIZE = 30;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  // 筛选状态
  const [filterAction, setFilterAction] = useState('all');
  const [filterAdmin, setFilterAdmin] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // 日期快捷方式
  const [datePreset, setDatePreset] = useState<string>('all');

  // 清理对话框
  const [showCleanDialog, setShowCleanDialog] = useState(false);
  const [cleanDays, setCleanDays] = useState(365);
  const [cleaning, setCleaning] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 消息
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  // 加载操作类型列表
  useEffect(() => {
    adminApi.getLogActions().then(setActionTypes).catch(() => {});
  }, []);

  // 加载日志
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getLogs({
        page, pageSize: PAGE_SIZE,
        action: filterAction,
        admin: filterAdmin || undefined,
        startDate: filterStart || undefined,
        endDate: filterEnd || undefined,
      });
      if (res.success) {
        setLogs(res.data ?? []);
        setTotal((res as any).total ?? 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, filterAction, filterAdmin, filterStart, filterEnd]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // 日期快捷筛选
  const setDateRange = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();
    const end = formatDate(now);
    let start = '';

    if (preset === 'today') {
      start = end;
    } else if (preset === '7days') {
      start = formatDate(new Date(now.getTime() - 7 * 86400000));
    } else if (preset === '30days') {
      start = formatDate(new Date(now.getTime() - 30 * 86400000));
    } else if (preset === '90days') {
      start = formatDate(new Date(now.getTime() - 90 * 86400000));
    }

    setFilterStart(start);
    setFilterEnd(preset === 'all' ? '' : end);
  };

  // 导出 CSV
  const handleExport = async () => {
    setExporting(true);
    const ok = await adminApi.exportLogsCSV({
      action: filterAction,
      startDate: filterStart || undefined,
      endDate: filterEnd || undefined,
    });
    showMsg(ok ? 'success' : 'error', ok ? '日志导出成功' : '日志导出失败');
    setExporting(false);
  };

  // 清理日志
  const handleClean = async () => {
    setCleaning(true);
    try {
      const res = await adminApi.cleanLogs(cleanDays);
      if (res.success) {
        showMsg('success', (res as any).message || '清理完成');
        setShowCleanDialog(false);
      } else {
        showMsg('error', (res as any).error || '清理失败');
      }
    } catch {
      showMsg('error', '清理失败');
    }
    setCleaning(false);
  };

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { label: action, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">操作日志</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">管理员操作审计记录</p>
        </div>
      </div>

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={'text-sm px-4 py-2.5 rounded-lg border ' + (
            msg.type === 'success'
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          )}
        >
          {msg.text}
        </motion.div>
      )}

      {/* 筛选栏 */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-3 space-y-3">
        {/* 日期快捷筛选 */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: '全部' },
            { key: 'today', label: '今天' },
            { key: '7days', label: '近7天' },
            { key: '30days', label: '近30天' },
            { key: '90days', label: '近90天' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setDateRange(p.key)}
              className={'px-3 py-1 text-xs rounded-full border transition-colors ' +
                (datePreset === p.key
                  ? 'bg-pdd-primary/10 text-pdd-primary border-pdd-primary/30'
                  : 'border-pdd-border text-pdd-text-secondary hover:border-pdd-text-secondary')
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 操作类型筛选 */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-pdd-text-secondary" />
            <select
              value={filterAction}
              onChange={e => { setFilterAction(e.target.value); setPage(1); }}
              className="bg-pdd-bg border border-pdd-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
            >
              <option value="all">全部类型</option>
              {actionTypes.map(a => {
                const ac = getActionConfig(a);
                return <option key={a} value={a}>{ac.label}</option>;
              })}
            </select>
          </div>

          {/* 操作者筛选 */}
          <div className="flex items-center gap-1.5">
            <Search size={14} className="text-pdd-text-secondary" />
            <input
              type="text" value={filterAdmin}
              onChange={e => { setFilterAdmin(e.target.value); setPage(1); }}
              placeholder="搜索操作者..."
              className="bg-pdd-bg border border-pdd-border rounded-lg px-2.5 py-1.5 text-xs outline-none w-36"
            />
          </div>

          {/* 自定义日期 */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-pdd-text-secondary" />
            <input
              type="date" value={filterStart}
              onChange={e => { setFilterStart(e.target.value); setDatePreset('custom'); setPage(1); }}
              className="bg-pdd-bg border border-pdd-border rounded-lg px-2 py-1 text-xs outline-none"
            />
            <span className="text-xs text-pdd-text-secondary">~</span>
            <input
              type="date" value={filterEnd}
              onChange={e => { setFilterEnd(e.target.value); setDatePreset('custom'); setPage(1); }}
              className="bg-pdd-bg border border-pdd-border rounded-lg px-2 py-1 text-xs outline-none"
            />
          </div>

          {/* 清除筛选 */}
          {(filterAction !== 'all' || filterAdmin || filterStart) && (
            <button
              onClick={() => {
                setFilterAction('all'); setFilterAdmin('');
                setFilterStart(''); setFilterEnd('');
                setDatePreset('all'); setPage(1);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
            >
              <X size={12} /> 清除
            </button>
          )}

          <div className="flex-1" />

          {/* 操作按钮 */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pdd-border text-xs
              text-pdd-text-secondary hover:bg-pdd-bg disabled:opacity-50 transition-colors"
          >
            <Download size={12} /> {exporting ? '导出中...' : '导出 CSV'}
          </button>
          <button
            onClick={() => setShowCleanDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs
              text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} /> 清理日志
          </button>
        </div>
      </div>

      {/* 日志表格 */}
      {loading ? (
        <div className="text-center py-12 text-pdd-text-secondary">加载中...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
          <p className="text-sm">暂无操作记录</p>
        </div>
      ) : (
        <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border bg-pdd-bg">
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary whitespace-nowrap">时间</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary whitespace-nowrap">操作者</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary whitespace-nowrap">操作类型</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary whitespace-nowrap">目标</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary whitespace-nowrap">详情</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary whitespace-nowrap">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const ac = getActionConfig(log.action);
                  return (
                    <tr key={log.id} className="border-b border-pdd-border/30 hover:bg-pdd-bg/50 transition-colors">
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-pdd-text-primary font-medium text-xs">{log.adminId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={'text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ' + ac.color}>
                          {ac.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs whitespace-nowrap">
                        {log.targetType}{log.targetId ? '/' + log.targetId : ''}
                      </td>
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs max-w-[300px] truncate" title={log.details || ''}>
                        {log.details || '-'}
                      </td>
                      <td className="py-3 px-4 text-pdd-text-secondary text-[10px] whitespace-nowrap font-mono">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-pdd-border text-sm text-pdd-text-secondary">
            <span>共 {total} 条记录</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-pdd-bg rounded text-xs disabled:opacity-30 hover:bg-pdd-border transition-colors"
              >
                上一页
              </button>
              <span className="px-3 py-1 text-xs">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-pdd-bg rounded text-xs disabled:opacity-30 hover:bg-pdd-border transition-colors"
              >
                下一页
              </button>
              {/* 页码跳转 */}
              <input
                type="number" min={1} max={totalPages}
                placeholder="页"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = parseInt((e.target as HTMLInputElement).value, 10);
                    if (v >= 1 && v <= totalPages) setPage(v);
                  }
                }}
                className="w-12 px-2 py-1 bg-pdd-bg border border-pdd-border rounded text-xs text-center outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 清理确认对话框 */}
      {showCleanDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCleanDialog(false)}>
          <div className="bg-pdd-card rounded-xl border border-pdd-border p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-pdd-text-primary mb-2">清理旧日志</h3>
            <p className="text-xs text-pdd-text-secondary mb-4">
              将删除指定天数之前的所有操作日志，此操作不可恢复。
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-pdd-text-secondary">删除</span>
              <input
                type="number" min={1} max={3650}
                value={cleanDays}
                onChange={e => setCleanDays(Number(e.target.value))}
                className="w-20 px-2 py-1.5 bg-pdd-bg border border-pdd-border rounded text-sm text-center outline-none"
              />
              <span className="text-xs text-pdd-text-secondary">天前的日志</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCleanDialog(false)}
                className="px-4 py-2 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg"
              >
                取消
              </button>
              <button
                onClick={handleClean}
                disabled={cleaning}
                className="px-4 py-2 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              >
                {cleaning ? '清理中...' : '确认清理'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
