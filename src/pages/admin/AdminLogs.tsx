import React, { useEffect, useState } from 'react';
import { adminApi, type AdminLog } from '../../api/adminApi';

const ACTION_LABELS: Record<string, string> = {
  ban_user: '封禁用户',
  unban_user: '解封用户',
  upgrade_membership: '调整会员',
  delete_data: '删除数据',
  generate_invite: '生成邀请码',
  delete_invite: '删除邀请码',
  system_config: '系统配置',
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.getLogs(page).then(res => {
      if (res.success) { setLogs(res.data); setTotal(res.total); }
      setLoading(false);
    });
  }, [page]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-pdd-text-primary">操作日志</h2>

      {loading ? <div className="text-pdd-text-secondary">加载中...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pdd-border text-pdd-text-secondary">
                <th className="text-left py-3 px-2">时间</th>
                <th className="text-left py-3 px-2">操作者</th>
                <th className="text-left py-3 px-2">操作</th>
                <th className="text-left py-3 px-2">目标</th>
                <th className="text-left py-3 px-2">详情</th>
                <th className="text-left py-3 px-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-pdd-border/30">
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">
                    {new Date(log.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="py-3 px-2 text-pdd-text-primary">{log.adminId}</td>
                  <td className="py-3 px-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-pdd-bg text-pdd-text-primary">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">
                    {log.targetType}/{log.targetId || '-'}
                  </td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs max-w-48 truncate">
                    {log.details || '-'}
                  </td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs font-mono">
                    {log.ipAddress || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 50 && (
            <div className="flex items-center justify-between pt-4 text-sm text-pdd-text-secondary">
              <span>共 {total} 条记录</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-pdd-bg rounded disabled:opacity-50">上一页</button>
                <span className="px-3 py-1">{page} / {Math.ceil(total / 50)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)} className="px-3 py-1 bg-pdd-bg rounded disabled:opacity-50">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
