import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Copy, Check, TrendingUp, Users, Key, Activity, DollarSign, Hash, RefreshCw } from 'lucide-react';
import ExportButton from '../../components/admin/ExportButton';
import { useInviteCodes, useInviteStats, useGenerateInviteCodes, useDeleteInviteCode } from '../../hooks/useAdminData';

export default function AdminInvite() {
  const [genCount, setGenCount] = useState(5);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { data: codes = [], isLoading, refetch: refetchCodes } = useInviteCodes();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useInviteStats('30d');
  const generateMutation = useGenerateInviteCodes();
  const deleteMutation = useDeleteInviteCode();

  const handleGenerate = async () => {
    const res = await generateMutation.mutateAsync(genCount);
    if (res.success && res.data) {
      setNewCodes(res.data.codes);
    }
  };

  const handleDelete = async (code: string) => {
    deleteMutation.mutate(code);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(newCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 本地计算统计（所有数据）
  const localStats = useMemo(() => {
    const totalUsed = codes.filter(c => c.isUsed);
    return {
      total: codes.length,
      available: codes.filter(c => !c.isUsed).length,
      used: totalUsed.length,
      usageRate: codes.length > 0 ? Math.round((totalUsed.length / codes.length) * 100) : 0,
    };
  }, [codes]);

  // 顶部KPI配置
  const kpiItems = [
    { label: '邀请码总数', value: stats ? String(stats.totalCodes) : String(localStats.total), icon: Hash, color: 'var(--pdd-primary)', bg: 'var(--pdd-gray-100)' },
    { label: '已使用', value: stats ? String(stats.usedCodes) : String(localStats.used), icon: Check, color: 'var(--pdd-success)', bg: 'var(--pdd-success)' },
    { label: '可用', value: stats ? String(stats.availableCodes) : String(localStats.available), icon: Key, color: 'var(--pdd-purple)', bg: 'var(--pdd-purple)' },
    { label: '注册用户', value: stats ? String(stats.totalUsers) : '-', icon: Users, color: 'var(--pdd-cyan)', bg: 'var(--pdd-cyan)' },
    { label: '付费用户', value: stats ? String(stats.payingUsers) : '-', icon: Activity, color: 'var(--pdd-warning)', bg: 'var(--pdd-warning)' },
    { label: '总收入', value: stats ? '¥' + stats.totalRevenue.toLocaleString() : '-', icon: DollarSign, color: 'var(--pdd-danger)', bg: 'var(--pdd-danger)' },
    { label: '注册转化', value: stats ? stats.registrationRate + '%' : '-', icon: TrendingUp, color: 'var(--pdd-primary)', bg: 'var(--pdd-gray-100)' },
    { label: '付费转化率', value: stats ? stats.paymentRate + '%' : '-', icon: TrendingUp, color: 'var(--pdd-purple)', bg: 'var(--pdd-purple)' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--pdd-text)' }}>邀请码与渠道分析</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>管理邀请码、分析渠道转化效果</p>
        </div>
        <button onClick={() => { refetchCodes(); refetchStats(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-pdd-gray-100"
          style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
          <RefreshCw size={13} /> 刷新
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-8 gap-3">
        {kpiItems.map((item, i) => (
          <div key={item.label}
            className="bg-pdd-card rounded-xl border p-3 transition-shadow hover:shadow-sm"
            style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: item.bg }}>
                <item.icon size={12} style={{ color: item.color }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-gray-400)' }}>{item.label}</span>
            </div>
            <div className="text-base font-bold" style={{ color: 'var(--pdd-text)' }}>{statsLoading ? '-' : item.value}</div>
          </div>
        ))}
      </div>

      {/* 生成区域 */}
      <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>生成数量:</span>
          <input type="number" min={1} max={50} value={genCount}
            onChange={e => setGenCount(Number(e.target.value))}
            className="bg-pdd-bg border rounded-lg px-3 py-2 text-xs w-20 outline-none"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)' }} />
          <button onClick={handleGenerate}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white flex items-center gap-1 transition-opacity hover:opacity-90"
            style={{ background: 'var(--pdd-primary)' }}>
            <Plus size={14} /> 生成邀请码
          </button>
        </div>

        {newCodes.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-4 p-3 rounded-lg border"
            style={{ background: 'var(--pdd-success)', borderColor: 'rgba(16, 185, 129, 0.12)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--pdd-success)' }}>已生成 {newCodes.length} 个邀请码</span>
              <button onClick={handleCopyAll}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-pdd-card/50"
                style={{ color: 'var(--pdd-primary)' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? '已复制' : '一键复制'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {newCodes.map(c => (
                <span key={c} className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--pdd-card)', color: 'var(--pdd-text)', border: '1px solid #E3EAF5' }}>
                  {c}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* 渠道/批次分析 */}
      {stats && stats.batchDetails.length > 0 && (
        <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--pdd-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>渠道分析（按批次）</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>渠道/批次</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>邀请码数</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>已使用</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>注册用户</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>付费用户</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>收入贡献</th>
                </tr>
              </thead>
              <tbody>
                {stats.batchDetails.map((b: any, idx: number) => (
                  <tr key={idx} className="border-t" style={{ borderColor: 'var(--pdd-border)' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>{b.channel}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{b.invite_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{b.used_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{b.registered_users}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{b.paying_users}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--pdd-text)' }}>¥{(b.revenue || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 邀请码详情 + 列表 */}
      {stats && stats.codeDetails.length > 0 && (
        <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>邀请码使用详情</h3>
            <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>最近20条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>邀请码</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>批次</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>使用者</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>注册时间</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>累计付费</th>
                </tr>
              </thead>
              <tbody>
                {stats.codeDetails.map((d: any, idx: number) => (
                  <tr key={idx} className="border-t" style={{ borderColor: 'var(--pdd-border)' }}>
                    <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--pdd-text)' }}>{d.code}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text-secondary)' }}>{d.batch_id}</td>
                    <td className="px-4 py-2.5 max-w-[100px] truncate" style={{ color: 'var(--pdd-text-secondary)' }}>{d.used_by}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                      {d.registered_at ? new Date(d.registered_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--pdd-success)' }}>¥{(d.paid_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 邀请码列表 */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>全部邀请码</h3>
          <div className="flex items-center gap-2">
            <ExportButton
              columns={[
                { key: 'code', title: '邀请码' },
                { key: 'batchId', title: '批次' },
                { key: 'isUsed', title: '状态' },
                { key: 'usedBy', title: '使用者' },
                { key: 'usedAt', title: '使用时间' },
                { key: 'createdAt', title: '创建时间' },
              ]}
              data={codes}
              filename="邀请码列表"
              formatRow={(row) => [
                row.code || '',
                row.batchId || '',
                row.isUsed ? '已使用' : '可用',
                row.usedBy || '',
                row.usedAt ? new Date(row.usedAt).toLocaleString('zh-CN') : '',
                new Date(row.createdAt).toLocaleString('zh-CN'),
              ]}
            />
            <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>{isLoading ? '...' : codes.length + ' 条'}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--pdd-gray-400)' }}>
              <RefreshCw size={18} className="animate-spin mx-auto mb-2" />加载中...
            </div>
          ) : codes.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>邀请码</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>批次</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>状态</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>使用者</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>使用时间</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>创建时间</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-t transition-colors hover:bg-pdd-gray-100/30" style={{ borderColor: 'var(--pdd-border)' }}>
                    <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--pdd-text)' }}>{c.code}</td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text-secondary)' }}>{c.batchId || '-'}</td>
                    <td className="px-4 py-2.5">
                      {c.isUsed ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--pdd-success)', color: 'var(--pdd-success)' }}>已使用</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--pdd-gray-100)', color: 'var(--pdd-primary)' }}>可用</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-[100px] truncate" style={{ color: 'var(--pdd-text-secondary)' }}>{c.usedBy || '-'}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                      {c.usedAt ? new Date(c.usedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                      {new Date(c.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!c.isUsed && (
                        <button onClick={() => handleDelete(c.code)}
                          className="p-1.5 rounded hover:bg-pdd-danger/10 transition-colors"
                          style={{ color: 'var(--pdd-danger)' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs py-12 text-center" style={{ color: 'var(--pdd-gray-400)' }}>暂无邀请码</div>
          )}
        </div>
      </div>
    </div>
  );
}
