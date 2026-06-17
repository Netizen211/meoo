import React, { useState, useEffect } from 'react';
import {
  Server, Database, Cpu, HardDrive, Activity, Shield,
  Wifi, WifiOff, RefreshCw, Clock, Monitor, Globe,
  Terminal, Save, ToggleLeft, ToggleRight, Users,
  AlertTriangle,
} from 'lucide-react';
import { useSystemInfo, useMaintenanceStatus, useUpdateMaintenance, useLoginHistory } from '../../hooks/useAdminData';

export default function AdminSystemInfo() {
  const [activeTab, setActiveTab] = useState<'info' | 'maintenance' | 'loginHistory'>('info');
  const [maintMsg, setMaintMsg] = useState('');
  const [maintIps, setMaintIps] = useState('');
  const [loginPage, setLoginPage] = useState(1);
  const [actionMsg, setActionMsg] = useState('');

  const { data: info, isLoading, refetch: refetchInfo } = useSystemInfo();
  const { data: maint, refetch: refetchMaint } = useMaintenanceStatus();
  const maintMutation = useUpdateMaintenance();
  const { data: loginData, refetch: refetchLogin } = useLoginHistory(activeTab === 'loginHistory' ? loginPage : 0);

  // sync maintenance form state
  useEffect(() => {
    if (maint) {
      setMaintMsg(maint.message);
      setMaintIps(maint.allowedIps.join(', '));
    }
  }, [maint]);

  const loginHistory = loginData?.items ?? [];
  const loginTotal = loginData?.total ?? 0;

  const handleToggleMaintenance = async () => {
    if (!maint) return;
    await maintMutation.mutateAsync({ enabled: !maint.enabled });
    showMsg(maint.enabled ? '维护模式已关闭' : '维护模式已启用');
    refetchMaint();
  };

  const handleSaveMaintenance = async () => {
    const ips = maintIps.split(',').map(s => s.trim()).filter(Boolean);
    await maintMutation.mutateAsync({ message: maintMsg, allowedIps: ips });
    showMsg('维护设置已保存');
  };

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  if (isLoading && !info) return <div className="p-4 text-pdd-text-secondary">加载中...</div>;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary flex items-center gap-2">
            <Server size={20} className="text-blue-400" />系统运维
          </h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">系统信息、维护模式与会话管理</p>
        </div>
        <button onClick={() => { refetchInfo(); refetchMaint(); }} className="px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1.5">
          <RefreshCw size={13} /> 刷新
        </button>
      </div>

      {actionMsg && (
        <div className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded border border-pdd-success/20">{actionMsg}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-pdd-border">
        {[
          { key: 'info' as const, label: '系统信息', icon: Server },
          { key: 'maintenance' as const, label: '维护模式', icon: Shield },
          { key: 'loginHistory' as const, label: '登录历史', icon: Users },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-amber-400 text-amber-400 font-medium'
                : 'border-transparent text-pdd-text-secondary hover:text-pdd-text'
            }`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* System Info Tab */}
      {activeTab === 'info' && info && (
        <div className="space-y-4">
          {/* Server status cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Cpu size={14} className="text-green-400" />
                </div>
                <span className="text-[10px] text-pdd-text-secondary">运行时间</span>
              </div>
              <div className="text-lg font-bold text-pdd-text-primary">{formatUptime(info.uptime)}</div>
            </div>
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Terminal size={14} className="text-blue-400" />
                </div>
                <span className="text-[10px] text-pdd-text-secondary">Node.js</span>
              </div>
              <div className="text-lg font-bold text-pdd-text-primary">{info.nodeVersion}</div>
            </div>
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <HardDrive size={14} className="text-purple-400" />
                </div>
                <span className="text-[10px] text-pdd-text-secondary">内存使用</span>
              </div>
              <div className="text-lg font-bold text-pdd-text-primary">{formatBytes(info.memoryUsage.rss)}</div>
              <div className="text-[10px] text-pdd-text-secondary mt-0.5">
                堆: {formatBytes(info.memoryUsage.heapUsed)} / {formatBytes(info.memoryUsage.heapTotal)}
              </div>
            </div>
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Globe size={14} className="text-amber-400" />
                </div>
                <span className="text-[10px] text-pdd-text-secondary">平台</span>
              </div>
              <div className="text-lg font-bold text-pdd-text-primary">{info.platform}</div>
              <div className="text-[10px] text-pdd-text-secondary mt-0.5">{info.arch}</div>
            </div>
          </div>

          {/* Data counts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(info.counts).map(([key, val]) => (
              <div key={key} className="bg-pdd-card rounded-xl border border-pdd-border p-3 text-center">
                <div className="text-xl font-bold text-pdd-text-primary">{val.toLocaleString()}</div>
                <div className="text-[10px] text-pdd-text-secondary mt-0.5">
                  {key === 'users' ? '用户' : key === 'stores' ? '店铺' : key === 'records' ? '数据记录' : key === 'logs' ? '日志' : '活跃会话'}
                </div>
              </div>
            ))}
          </div>

          {/* Database tables */}
          <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
            <div className="px-4 py-3 border-b border-pdd-border">
              <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
                <Database size={16} className="text-blue-400" /> 数据库表
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-pdd-bg">
                <tr className="text-left text-pdd-text-secondary">
                  <th className="px-4 py-2 font-medium">表名</th>
                  <th className="px-4 py-2 font-medium">大小</th>
                  <th className="px-4 py-2 font-medium">行数</th>
                </tr>
              </thead>
              <tbody>
                {info.tables.map((t: any, i) => (
                  <tr key={i} className="border-t border-pdd-border hover:bg-pdd-bg/50">
                    <td className="px-4 py-2 font-mono text-pdd-text-primary">{t.table_name}</td>
                    <td className="px-4 py-2 text-pdd-text-secondary">{t.size_mb} MB</td>
                    <td className="px-4 py-2 text-pdd-text-secondary">{t.row_count?.toLocaleString() ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && maint && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-pdd-card rounded-xl border border-pdd-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-pdd-text-primary">维护模式</h3>
                <p className="text-xs text-pdd-text-secondary mt-0.5">
                  {maint.enabled
                    ? '网站当前处于维护模式，普通用户无法访问'
                    : '网站正常运行中'}
                </p>
              </div>
              <button onClick={handleToggleMaintenance}
                disabled={maintMutation.isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  maint.enabled
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                }`}>
                {maint.enabled ? (
                  <><ToggleRight size={16} /> 关闭维护模式</>
                ) : (
                  <><ToggleLeft size={16} /> 启用维护模式</>
                )}
              </button>
            </div>

            {maint.enabled && (
              <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-400">
                  维护模式已启用，所有非管理员请求将被拦截。请确保添加管理员的 IP 到白名单。
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-pdd-text-primary mb-1.5 block">维护提示信息</label>
                <input value={maintMsg} onChange={e => setMaintMsg(e.target.value)}
                  placeholder="系统维护中，请稍后再试..."
                  className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-pdd-text-primary mb-1.5 block">IP 白名单（逗号分隔）</label>
                <textarea value={maintIps} onChange={e => setMaintIps(e.target.value)}
                  placeholder="192.168.1.1, 10.0.0.1"
                  rows={2}
                  className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50 resize-none" />
                <p className="text-[10px] text-pdd-text-secondary mt-1">白名单中的 IP 在维护模式下仍可正常访问</p>
              </div>
              <button onClick={handleSaveMaintenance} disabled={maintMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 flex items-center gap-2 disabled:opacity-50">
                <Save size={14} /> {maintMutation.isPending ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login History Tab */}
      {activeTab === 'loginHistory' && (
        <div>
          <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
            <div className="px-4 py-3 border-b border-pdd-border">
              <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
                <Clock size={16} className="text-pdd-text-secondary" /> 最近登录记录
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-pdd-bg">
                <tr className="text-left text-pdd-text-secondary">
                  <th className="px-4 py-2.5 font-medium">用户</th>
                  <th className="px-4 py-2.5 font-medium">IP地址</th>
                  <th className="px-4 py-2.5 font-medium">设备</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">登录时间</th>
                  <th className="px-4 py-2.5 font-medium">最后活动</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-pdd-text-secondary">暂无登录记录</td>
                  </tr>
                ) : (
                  loginHistory.map((l: any) => (
                    <tr key={l.id} className="border-t border-pdd-border hover:bg-pdd-bg/50">
                      <td className="px-4 py-2.5 text-pdd-text-primary font-medium">{l.username}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{l.ipAddress || '-'}</td>
                      <td className="px-4 py-2.5 text-pdd-text-secondary max-w-[150px] truncate">{l.deviceInfo || l.userAgent?.substring(0, 40) || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 w-fit ${
                          l.isActive ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${l.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                          {l.isActive ? '在线' : '已离线'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-pdd-text-secondary">{new Date(l.createdAt).toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-2.5 text-pdd-text-secondary">{new Date(l.lastActivityAt).toLocaleString('zh-CN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {loginTotal > 20 && (
              <div className="px-4 py-3 border-t border-pdd-border flex items-center justify-between">
                <span className="text-xs text-pdd-text-secondary">共 {loginTotal} 条</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setLoginPage(p => Math.max(1, p - 1))} disabled={loginPage <= 1}
                    className="px-2 py-1 text-xs rounded border border-pdd-border text-pdd-text-secondary disabled:opacity-30 hover:bg-pdd-bg">
                    上一页
                  </button>
                  <span className="text-xs text-pdd-text-secondary px-2">{loginPage} / {Math.ceil(loginTotal / 20)}</span>
                  <button onClick={() => setLoginPage(p => p + 1)} disabled={loginPage >= Math.ceil(loginTotal / 20)}
                    className="px-2 py-1 text-xs rounded border border-pdd-border text-pdd-text-secondary disabled:opacity-30 hover:bg-pdd-bg">
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
