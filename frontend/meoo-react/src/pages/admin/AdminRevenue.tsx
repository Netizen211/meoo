import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  Download, Calendar, Users, BarChart3, PieChart,
  RefreshCw, Filter,
} from 'lucide-react';
import { adminApi, RevenueSummary } from '../../../api/adminApi';

export default function AdminRevenue() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txFilter, setTxFilter] = useState({ status: 'all', plan: 'all' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const s = await adminApi.getRevenueSummary();
    if (s) setSummary(s);
    const tx = await adminApi.getRevenueTransactions({ page: 1, pageSize: 20 });
    if (tx.success) {
      setTransactions(tx.data || []);
      setTxTotal(tx.total || 0);
    }
    setLoading(false);
  };

  const loadTransactions = async (page: number) => {
    const tx = await adminApi.getRevenueTransactions({
      page, pageSize: 20, ...txFilter,
    });
    if (tx.success) {
      setTransactions(tx.data || []);
      setTxTotal(tx.total || 0);
    }
    setTxPage(page);
  };

  const handleExport = async () => {
    const ok = await adminApi.exportRevenueCSV();
    if (ok) {
      alert('导出成功');
    }
  };

  if (loading) return <div className="p-4 text-pdd-text-secondary">加载中...</div>;

  const maxMonthly = summary?.monthlyTrend.length
    ? Math.max(...summary.monthlyTrend.map(m => m.amount), 1)
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary flex items-center gap-2">
            <DollarSign size={20} className="text-green-400" />营收仪表盘
          </h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">财务数据汇总与分析</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1.5">
            <Download size={13} /> 导出CSV
          </button>
          <button onClick={loadAll} className="px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1.5">
            <RefreshCw size={13} /> 刷新
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign size={14} className="text-green-400" />
            </div>
            <span className="text-[10px] text-pdd-text-secondary">总营收</span>
          </div>
          <div className="text-xl font-bold text-pdd-text-primary">¥{summary?.totalRevenue?.toLocaleString() ?? 0}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar size={14} className="text-blue-400" />
            </div>
            <span className="text-[10px] text-pdd-text-secondary">本月营收</span>
          </div>
          <div className="text-xl font-bold text-pdd-text-primary">¥{summary?.monthlyRevenue?.toLocaleString() ?? 0}</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Users size={14} className="text-amber-400" />
            </div>
            <span className="text-[10px] text-pdd-text-secondary">付费用户</span>
          </div>
          <div className="text-xl font-bold text-pdd-text-primary">{summary?.payingUsers ?? 0}
            <span className="text-xs text-pdd-text-secondary ml-1">/ {summary?.totalUsers ?? 0}</span>
          </div>
          <div className="text-[10px] text-pdd-text-secondary mt-0.5">转化率 {summary?.conversionRate ?? 0}%</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-red-400" />
            </div>
            <span className="text-[10px] text-pdd-text-secondary">待审核金额</span>
          </div>
          <div className="text-xl font-bold text-pdd-text-primary">¥{summary?.pendingAmount?.toLocaleString() ?? 0}</div>
        </motion.div>
      </div>

      {/* Monthly trend chart */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
        <h3 className="text-sm font-semibold text-pdd-text-primary mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-400" /> 近12个月营收趋势
        </h3>
        {summary?.monthlyTrend && (
          <div className="flex items-end gap-1 h-40 px-2">
            {summary.monthlyTrend.map((m, i) => {
              const height = Math.max((m.amount / maxMonthly) * 100, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <span className="text-[9px] text-pdd-text-secondary opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                    ¥{(m.amount / 1000).toFixed(1)}k
                  </span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-blue-500/60 to-blue-400/30 hover:from-blue-500 hover:to-blue-400 transition-all cursor-pointer min-h-[2px]"
                    style={{ height: `${height}%` }}
                    title={`${m.month}: ¥${m.amount.toLocaleString()} (${m.count}笔)`}
                  />
                  <span className="text-[9px] text-pdd-text-secondary whitespace-nowrap">
                    {m.month.split('-')[1]}月
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan/Duration breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3 flex items-center gap-2">
            <PieChart size={16} className="text-purple-400" /> 按套餐统计
          </h3>
          {summary?.byPlan?.map(p => (
            <div key={p.plan} className="flex items-center justify-between py-2 border-b border-pdd-border last:border-0">
              <span className="text-xs text-pdd-text-primary">{p.plan === 'pro' ? '专业版' : '企业版'}</span>
              <div className="text-xs">
                <span className="text-pdd-text-primary font-medium">¥{p.total.toLocaleString()}</span>
                <span className="text-pdd-text-secondary ml-2">({p.count}笔)</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3 flex items-center gap-2">
            <PieChart size={16} className="text-green-400" /> 按时长统计
          </h3>
          {summary?.byDuration?.map(d => (
            <div key={d.duration} className="flex items-center justify-between py-2 border-b border-pdd-border last:border-0">
              <span className="text-xs text-pdd-text-primary">{d.duration === 'monthly' ? '月付' : '年付'}</span>
              <div className="text-xs">
                <span className="text-pdd-text-primary font-medium">¥{d.total.toLocaleString()}</span>
                <span className="text-pdd-text-secondary ml-2">({d.count}笔)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
        <div className="px-4 py-3 border-b border-pdd-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
            <CreditCard size={16} className="text-pdd-text-secondary" /> 交易明细
          </h3>
          <div className="flex items-center gap-2">
            <select value={txFilter.status} onChange={e => { setTxFilter({ ...txFilter, status: e.target.value }); loadTransactions(1); }}
              className="px-2 py-1 text-[10px] rounded border border-pdd-border bg-pdd-bg text-pdd-text-primary outline-none">
              <option value="all">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
            <select value={txFilter.plan} onChange={e => { setTxFilter({ ...txFilter, plan: e.target.value }); loadTransactions(1); }}
              className="px-2 py-1 text-[10px] rounded border border-pdd-border bg-pdd-bg text-pdd-text-primary outline-none">
              <option value="all">全部套餐</option>
              <option value="pro">专业版</option>
              <option value="enterprise">企业版</option>
            </select>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-pdd-bg">
            <tr className="text-left text-pdd-text-secondary">
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">用户</th>
              <th className="px-4 py-2.5 font-medium">套餐</th>
              <th className="px-4 py-2.5 font-medium">时长</th>
              <th className="px-4 py-2.5 font-medium">金额</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="border-t border-pdd-border hover:bg-pdd-bg/50">
                <td className="px-4 py-2.5 font-mono">{tx.id}</td>
                <td className="px-4 py-2.5 text-pdd-text-primary">{tx.username}</td>
                <td className="px-4 py-2.5">{tx.plan === 'pro' ? '专业版' : '企业版'}</td>
                <td className="px-4 py-2.5">{tx.duration === 'monthly' ? '月付' : '年付'}</td>
                <td className="px-4 py-2.5 text-pdd-text-primary font-medium">¥{tx.amount}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    tx.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                    tx.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {tx.status === 'approved' ? '已通过' : tx.status === 'rejected' ? '已拒绝' : '待审核'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-pdd-text-secondary">{new Date(tx.createdAt).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {txTotal > 20 && (
          <div className="px-4 py-3 border-t border-pdd-border flex items-center justify-between">
            <span className="text-xs text-pdd-text-secondary">共 {txTotal} 条</span>
            <div className="flex items-center gap-1">
              <button onClick={() => loadTransactions(txPage - 1)} disabled={txPage <= 1}
                className="px-2 py-1 text-xs rounded border border-pdd-border text-pdd-text-secondary disabled:opacity-30 hover:bg-pdd-bg">
                上一页
              </button>
              <span className="text-xs text-pdd-text-secondary px-2">{txPage} / {Math.ceil(txTotal / 20)}</span>
              <button onClick={() => loadTransactions(txPage + 1)} disabled={txPage >= Math.ceil(txTotal / 20)}
                className="px-2 py-1 text-xs rounded border border-pdd-border text-pdd-text-secondary disabled:opacity-30 hover:bg-pdd-bg">
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
