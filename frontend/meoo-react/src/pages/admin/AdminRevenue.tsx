import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  Download, Calendar, Users, BarChart3,
  RefreshCw, Activity, Target, Percent, AlertTriangle,
} from 'lucide-react';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import {
  useRevenueSummary,
  useMrrTrend,
  useChurnRate,
  useRevenueTransactions,
} from '../../hooks/useAdminData';

export default function AdminRevenue() {
  const [txPage, setTxPage] = useState(1);
  const [txFilter, setTxFilter] = useState({ status: 'all', plan: 'all' });
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Date params for transactions
  const txParams = { page: txPage, pageSize: 20, ...txFilter };
  if (timeRange === 'custom' && startDate && endDate) {
    (txParams as any).startDate = startDate;
    (txParams as any).endDate = endDate;
  }

  const { data: summary, isLoading: summLoading, refetch: refetchSummary } = useRevenueSummary();
  const { data: mrrTrend = [], isLoading: mrrLoading, refetch: refetchMrr } = useMrrTrend(12);
  const { data: churnData = [], isLoading: churnLoading, refetch: refetchChurn } = useChurnRate('monthly');
  const { data: txRes, isLoading: txLoading, refetch: refetchTx } = useRevenueTransactions(txParams);

  const transactions = txRes?.transactions ?? [];
  const txTotal = txRes?.total ?? 0;
  const isLoading = summLoading || mrrLoading || churnLoading || txLoading;

  const handleRefresh = () => {
    refetchSummary();
    refetchMrr();
    refetchChurn();
    refetchTx();
  };

  const loadTransactions = (page: number) => {
    setTxPage(page);
    // react-query auto-refetches when txParams changes
  };

  if (isLoading && !summary) return <div className="p-4" style={{ color: 'var(--pdd-text-secondary)' }}>加载中...</div>;

  const maxMonthly = summary?.monthlyTrend.length
    ? Math.max(...summary.monthlyTrend.map(m => m.amount), 1)
    : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--pdd-text)' }}>营收仪表盘</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>财务数据汇总与分析</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-pdd-gray-100"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
            <RefreshCw size={13} /> 刷新
          </button>
        </div>
      </div>

      {/* Filter */}
      <FilterPanel
        dateRange={startDate && endDate ? { start: startDate, end: endDate } : undefined}
        onDateRangeChange={(range) => { setStartDate(range.start); setEndDate(range.end); setTimeRange('custom'); }}
        extraFilters={
          <div className="flex items-center gap-1.5 bg-pdd-card rounded-lg border p-0.5" style={{ borderColor: 'var(--pdd-border)' }}>
            {[
              { label: '近7天', value: '7d' },
              { label: '近30天', value: '30d' },
              { label: '近90天', value: '90d' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTimeRange(opt.value)}
                className={"px-3 py-1.5 text-xs rounded-md font-medium transition-all " + (timeRange === opt.value ? "text-white shadow-sm" : "hover:bg-pdd-gray-100")}
                style={{ backgroundColor: timeRange === opt.value ? 'var(--pdd-primary)' : 'transparent', color: timeRange === opt.value ? 'var(--pdd-card)' : 'var(--pdd-text-secondary)' }}>
                {opt.label}
              </button>
            ))}
          </div>
        }
        onReset={() => { setTimeRange('30d'); setStartDate(''); setEndDate(''); }}
      />

      {/* KPI Cards */}
      {(() => {
        const latestMrr = mrrTrend.length > 0 ? mrrTrend[mrrTrend.length - 1] : null;
        const mrr = latestMrr?.revenue ?? 0;
        const arr = mrr * 12;
        const payingUsers = summary?.payingUsers ?? 0;
        const arpu = payingUsers > 0 ? ((summary?.monthlyRevenue ?? 0) / payingUsers) : 0;
        const latestChurn = churnData.length > 0 ? churnData[churnData.length - 1] : null;
        const churnRate = latestChurn?.churn_rate ?? 0;
        return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-success)' }}>
                <DollarSign size={14} style={{ color: 'var(--pdd-success)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>总营收</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>¥{summary?.totalRevenue?.toLocaleString() ?? 0}</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-gray-100)' }}>
                <Calendar size={14} style={{ color: 'var(--pdd-primary)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>本月营收</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>¥{summary?.monthlyRevenue?.toLocaleString() ?? 0}</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-warning)' }}>
                <Target size={14} style={{ color: 'var(--pdd-warning)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>MRR (月经常性收入)</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>¥{mrr.toLocaleString()}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>ARR ¥{arr.toLocaleString()}</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-purple)' }}>
                <Activity size={14} style={{ color: 'var(--pdd-purple)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>ARPU (每用户收入)</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>¥{arpu.toFixed(2)}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>付费用户 {payingUsers} 人</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-cyan)' }}>
                <Percent size={14} style={{ color: 'var(--pdd-cyan)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>付费转化率</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>{summary?.conversionRate ?? 0}%</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>付费/总用户</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-danger)' }}>
                <TrendingDown size={14} style={{ color: 'var(--pdd-danger)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>流失率</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>{churnRate}%</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>最近月份</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-pink)' }}>
                <Users size={14} style={{ color: 'var(--pdd-pink)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>付费用户</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>{summary?.payingUsers ?? 0}
              <span className="text-xs ml-1" style={{ color: 'var(--pdd-text-secondary)' }}>/ {summary?.totalUsers ?? 0}</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>当前付费/总用户</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--pdd-danger)' }}>
                <AlertTriangle size={14} style={{ color: 'var(--pdd-danger)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>待审核金额</span>
            </div>
            <div className="text-xl font-bold" style={{ color: 'var(--pdd-text)' }}>¥{summary?.pendingAmount?.toLocaleString() ?? 0}</div>
          </motion.div>
        </div>
        );
      })()}

      {/* MRR Trend + Churn Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-pdd-card rounded-xl border p-4 lg:col-span-2" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>
            <BarChart3 size={16} className="inline mr-1 text-blue-400" /> MRR趋势（近12个月）
          </h3>
          {mrrTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrrTrend}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pdd-primary)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--pdd-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="revenue" name="MRR" stroke="var(--pdd-primary)" fill="url(#mrrGrad)" strokeWidth={2} dot={{ r: 3, fill: 'var(--pdd-primary)' }} />
                <Area type="monotone" dataKey="paying_users" name="付费用户" stroke="var(--pdd-purple)" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs py-16 text-center" style={{ color: 'var(--pdd-gray-400)' }}>暂无MRR数据</div>
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>
            <TrendingDown size={16} className="inline mr-1 text-red-400" /> 月度流失率
          </h3>
          {churnData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={churnData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="churn_rate" name="流失率" fill="var(--pdd-danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs py-16 text-center" style={{ color: 'var(--pdd-gray-400)' }}>暂无流失率数据</div>
          )}
        </div>
      </div>

      {/* Plan distribution using Recharts PieChart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>按套餐统计</h3>
          {summary?.byPlan && summary.byPlan.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={summary.byPlan.map(p => ({ ...p, name: p.plan === 'pro' ? '专业版' : '企业版' }))}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="total" nameKey="name"
                    paddingAngle={4}>
                    {summary.byPlan.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? 'var(--pdd-purple)' : 'var(--pdd-primary)'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid #E3EAF5', borderRadius: 8, fontSize: 12 }} formatter={(value: any) => '¥' + Number(value).toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {summary.byPlan.map((p, idx) => (
                  <div key={p.plan} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: idx === 0 ? 'var(--pdd-purple)' : 'var(--pdd-primary)' }} />
                      {p.plan === 'pro' ? '专业版' : '企业版'}
                    </span>
                    <span style={{ color: 'var(--pdd-text)' }}>¥{p.total.toLocaleString()} <span style={{ color: 'var(--pdd-gray-400)' }}>({p.count}笔)</span></span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs py-12 text-center" style={{ color: 'var(--pdd-gray-400)' }}>暂无数据</div>
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>按时长统计</h3>
          {summary?.byDuration && summary.byDuration.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={summary.byDuration.map(d => ({ ...d, name: d.duration === 'monthly' ? '月付' : '年付' }))}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="total" nameKey="name"
                    paddingAngle={4}>
                    {summary.byDuration.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? 'var(--pdd-success)' : 'var(--pdd-warning)'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid #E3EAF5', borderRadius: 8, fontSize: 12 }} formatter={(value: any) => '¥' + Number(value).toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {summary.byDuration.map((d, idx) => (
                  <div key={d.duration} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: idx === 0 ? 'var(--pdd-success)' : 'var(--pdd-warning)' }} />
                      {d.duration === 'monthly' ? '月付' : '年付'}
                    </span>
                    <span style={{ color: 'var(--pdd-text)' }}>¥{d.total.toLocaleString()} <span style={{ color: 'var(--pdd-gray-400)' }}>({d.count}笔)</span></span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs py-12 text-center" style={{ color: 'var(--pdd-gray-400)' }}>暂无数据</div>
          )}
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-pdd-card rounded-xl border overflow-hidden" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--pdd-text)' }}>
            <CreditCard size={16} style={{ color: 'var(--pdd-text-secondary)' }} /> 交易明细
          </h3>
          <div className="flex items-center gap-2">
            <ExportButton
              columns={[
                { key: 'id', title: 'ID' },
                { key: 'username', title: '用户' },
                { key: 'plan', title: '套餐' },
                { key: 'duration', title: '时长' },
                { key: 'amount', title: '金额' },
                { key: 'status', title: '状态' },
                { key: 'createdAt', title: '时间' },
              ]}
              data={transactions}
              filename="交易明细"
              formatRow={(row) => [
                String(row.id || ''),
                row.username || '',
                row.plan === 'pro' ? '专业版' : '企业版',
                row.duration === 'monthly' ? '月付' : '年付',
                '¥' + (row.amount || 0),
                row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已拒绝' : '待审核',
                row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '',
              ]}
            />
            <select value={txFilter.status} onChange={e => { setTxFilter({ ...txFilter, status: e.target.value }); setTxPage(1); }}
              className="px-2 py-1 text-[10px] rounded border outline-none"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
              <option value="all">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
            <select value={txFilter.plan} onChange={e => { setTxFilter({ ...txFilter, plan: e.target.value }); setTxPage(1); }}
              className="px-2 py-1 text-[10px] rounded border outline-none"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
              <option value="all">全部套餐</option>
              <option value="pro">专业版</option>
              <option value="enterprise">企业版</option>
            </select>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--pdd-gray-50)' }}>
              <th className="px-4 py-2.5 font-medium text-left" style={{ color: 'var(--pdd-text-secondary)' }}>ID</th>
              <th className="px-4 py-2.5 font-medium text-left" style={{ color: 'var(--pdd-text-secondary)' }}>用户</th>
              <th className="px-4 py-2.5 font-medium text-left" style={{ color: 'var(--pdd-text-secondary)' }}>套餐</th>
              <th className="px-4 py-2.5 font-medium text-left" style={{ color: 'var(--pdd-text-secondary)' }}>时长</th>
              <th className="px-4 py-2.5 font-medium text-left" style={{ color: 'var(--pdd-text-secondary)' }}>金额</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="border-t transition-colors hover:bg-pdd-gray-100/50" style={{ borderColor: 'var(--pdd-border)' }}>
                <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--pdd-text-secondary)' }}>{tx.id}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text)' }}>{tx.username}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text-secondary)' }}>{tx.plan === 'pro' ? '专业版' : '企业版'}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text-secondary)' }}>{tx.duration === 'monthly' ? '月付' : '年付'}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>¥{tx.amount}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      background: tx.status === 'approved' ? 'var(--pdd-success)' : tx.status === 'rejected' ? 'var(--pdd-danger)' : 'var(--pdd-warning)',
                      color: tx.status === 'approved' ? 'var(--pdd-success)' : tx.status === 'rejected' ? 'var(--pdd-danger)' : 'var(--pdd-warning)',
                    }}>
                    {tx.status === 'approved' ? '已通过' : tx.status === 'rejected' ? '已拒绝' : '待审核'}
                  </span>
                </td>
                <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text-secondary)' }}>{new Date(tx.createdAt).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {txTotal > 20 && (
          <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>共 {txTotal} 条</span>
            <div className="flex items-center gap-1">
              <button onClick={() => loadTransactions(txPage - 1)} disabled={txPage <= 1}
                className="px-2 py-1 text-xs rounded border disabled:opacity-30 transition-colors hover:bg-pdd-gray-100"
                style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
                上一页
              </button>
              <span className="text-xs px-2" style={{ color: 'var(--pdd-text-secondary)' }}>{txPage} / {Math.ceil(txTotal / 20)}</span>
              <button onClick={() => loadTransactions(txPage + 1)} disabled={txPage >= Math.ceil(txTotal / 20)}
                className="px-2 py-1 text-xs rounded border disabled:opacity-30 transition-colors hover:bg-pdd-gray-100"
                style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
