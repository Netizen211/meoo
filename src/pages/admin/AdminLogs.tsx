import React, { useEffect, useState } from 'react';
import { adminApi, type AdminLog } from '../../api/adminApi';

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  ban_user: { label: '封禁用户', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  unban_user: { label: '解封用户', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  admin_adjust_membership: { label: '调整会员', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  delete_data: { label: '删除数据', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  generate_invite: { label: '生成邀请码', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delete_invite: { label: '删除邀请码', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  system_config: { label: '系统配置', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.getLogs(page).then(res => {
      if (res.success) { setLogs(res.data); setTotal((res as any).total); }
      setLoading(false);
    });
  }, [page]);

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { label: action, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-pdd-text-primary">操作日志</h2>
        <p className="text-xs text-pdd-text-secondary mt-0.5">管理员操作审计记录</p>
      </div>

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
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary w-40">时间</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">操作者</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">操作类型</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">详情</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const ac = getActionConfig(log.action);
                  return (
                    <tr key={log.id} className="border-b border-pdd-border/30 hover:bg-pdd-bg/50">
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-pdd-text-primary font-medium">{log.adminId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ac.color} whitespace-nowrap`}>
                          {ac.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs">{log.details || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-pdd-border text-sm text-pdd-text-secondary">
              <span>共 {total} 条</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 bg-pdd-bg rounded text-xs disabled:opacity-30 hover:bg-pdd-border transition-colors">上一页</button>
                <span className="px-3 py-1 text-xs">{page} / {Math.ceil(total / 50)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}
                  className="px-3 py-1 bg-pdd-bg rounded text-xs disabled:opacity-30 hover:bg-pdd-border transition-colors">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
