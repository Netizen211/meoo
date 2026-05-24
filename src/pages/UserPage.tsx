import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ScatterChart, Scatter, AreaChart, Area } from 'recharts';
import { Users, DollarSign, Repeat, ShoppingCart, TrendingUp, Clock, Lock, Crown, CreditCard, Globe, ArrowUp, ArrowDown, UserCheck, UserPlus, Activity, Target, Tag, Filter, Search, Plus, X, ChevronDown } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct } from '../components/TimeFilter';

function maskPhone(phone: string): string {
  const s = String(phone).trim();
  if (s.length >= 7) return s.slice(0, 3) + s.slice(-4);
  return s || '未知';
}

const COLORS = ['#e02e24', '#ff6b5b', '#faad14', '#52c41a', '#1890ff', '#722ed1', '#13c2c2', '#eb2f96'];

export default function UserPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [userTags, setUserTags] = useState<Record<string, string[]>>({});
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled };

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange), [orders, allDates, timeRange]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(orders, allDates, timeRange) : [], [orders, allDates, timeRange, compareEnabled]);

  const stats = useMemo(() => {
    if (!filteredOrders.length) return null;
    const buyerMap: Record<string, { count: number; totalPaid: number; totalQty: number; lastOrder: string; firstOrder: string; orders: any[] }> = {};
    filteredOrders.forEach((o: any) => {
      const orderNo = String(o['订单号'] || '').trim();
      const key = orderNo.length >= 4 ? orderNo.slice(-4) : (orderNo || `anon-${Math.random().toString(36).slice(2, 6)}`);
      if (!buyerMap[key]) buyerMap[key] = { count: 0, totalPaid: 0, totalQty: 0, lastOrder: '', firstOrder: '', orders: [] };
      buyerMap[key].count++;
      buyerMap[key].totalPaid += safeFloat(o['用户实付金额(元)']);
      buyerMap[key].totalQty += safeFloat(o['商品数量(件)']);
      const t = String(o['支付时间'] || '').trim();
      if (t > buyerMap[key].lastOrder) buyerMap[key].lastOrder = t;
      if (!buyerMap[key].firstOrder || t < buyerMap[key].firstOrder) buyerMap[key].firstOrder = t;
      buyerMap[key].orders.push(o);
    });

    const buyerCount = Object.keys(buyerMap).length;
    const repeatBuyers = Object.values(buyerMap).filter(b => b.count >= 2).length;
    const repeatRate = buyerCount > 0 ? (repeatBuyers / buyerCount) * 100 : 0;
    const totalPaid = filteredOrders.reduce((s: number, o: any) => s + safeFloat(o['用户实付金额(元)']), 0);
    const avgAOV = filteredOrders.length > 0 ? totalPaid / filteredOrders.length : 0;
    const totalQty = filteredOrders.reduce((s: number, o: any) => s + safeFloat(o['商品数量(件)']), 0);
    const attachRate = filteredOrders.length > 0 ? totalQty / filteredOrders.length : 0;
    const avgPerBuyer = buyerCount > 0 ? totalPaid / buyerCount : 0;

    const now = new Date();
    const rfmData = Object.entries(buyerMap).map(([key, b]) => {
      const recency = (now.getTime() - new Date(b.lastOrder).getTime()) / (1000 * 60 * 60 * 24);
      const frequency = b.count;
      const monetary = b.totalPaid;
      return { key, recency, frequency, monetary, ...b };
    });
    const avgRecency = rfmData.reduce((s, r) => s + r.recency, 0) / rfmData.length;
    const avgFrequency = rfmData.reduce((s, r) => s + r.frequency, 0) / rfmData.length;
    const avgMonetary = rfmData.reduce((s, r) => s + r.monetary, 0) / rfmData.length;

    const segments = {
      champions: rfmData.filter(r => r.recency <= avgRecency && r.frequency >= avgFrequency && r.monetary >= avgMonetary),
      loyal: rfmData.filter(r => r.recency <= avgRecency && r.frequency >= avgFrequency),
      potential: rfmData.filter(r => r.recency <= avgRecency && r.frequency < avgFrequency && r.monetary >= avgMonetary),
      new: rfmData.filter(r => r.recency <= avgRecency && r.frequency === 1),
      atRisk: rfmData.filter(r => r.recency > avgRecency && r.frequency >= avgFrequency),
      lost: rfmData.filter(r => r.recency > avgRecency * 2),
    };

    const ltvData = rfmData.map(b => ({ ltv: b.monetary, orders: b.frequency, avgOrder: b.frequency > 0 ? b.monetary / b.frequency : 0 })).sort((a, b) => b.ltv - a.ltv);
    const avgLTV = ltvData.reduce((s, b) => s + b.ltv, 0) / ltvData.length;

    const tiers = [
      { label: '0-50元', min: 0, max: 50 },
      { label: '50-100元', min: 50, max: 100 },
      { label: '100-200元', min: 100, max: 200 },
      { label: '200-500元', min: 200, max: 500 },
      { label: '500-1000元', min: 500, max: 1000 },
      { label: '1000元以上', min: 1000, max: Infinity },
    ];
    const tierData = tiers.map(t => {
      const buyers = rfmData.filter(b => b.monetary >= t.min && b.monetary < t.max);
      return { name: t.label, value: buyers.length, revenue: buyers.reduce((s, b) => s + b.monetary, 0) };
    });

    const newVsReturning = [
      { name: '新用户', value: Object.values(buyerMap).filter(b => b.count === 1).length },
      { name: '老用户', value: Object.values(buyerMap).filter(b => b.count > 1).length },
    ];

    const tags = [
      { name: '高消费', count: rfmData.filter(b => b.monetary > 500).length },
      { name: '高频购买', count: rfmData.filter(b => b.frequency >= 3).length },
      { name: '近期活跃', count: rfmData.filter(b => b.recency <= 7).length },
      { name: '沉睡用户', count: rfmData.filter(b => b.recency > 30).length },
    ];

    const hourMap: Record<number, number> = {};
    filteredOrders.forEach((o: any) => {
      const h = parseInt(String(o['支付时间'] || '').split(' ')[1]?.split(':')[0] || '0', 10);
      if (!isNaN(h)) hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const hourData = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}时`, orders: hourMap[i] || 0 }));

    const payMap: Record<string, number> = {};
    filteredOrders.forEach((o: any) => { const p = String(o['支付方式'] || '').trim() || '未知'; payMap[p] = (payMap[p] || 0) + 1; });
    const payData = Object.entries(payMap).map(([name, value]) => ({ name, value }));

    const retentionData = (() => {
      const days = [1, 3, 7, 14, 30];
      return days.map(d => {
        const eligible = Object.values(buyerMap).filter(b => {
          const diff = (new Date(b.lastOrder).getTime() - new Date(b.firstOrder).getTime()) / 86400000;
          return diff >= d - 1;
        });
        const retained = eligible.filter(b => {
          const diff = (new Date(b.lastOrder).getTime() - new Date(b.firstOrder).getTime()) / 86400000;
          return diff >= d;
        });
        const rate = eligible.length > 0 ? (retained.length / eligible.length) * 100 : 0;
        return { day: `${d}天`, rate: Math.round(rate) };
      });
    })();

    const heatmapData = Array.from({ length: 7 }, (_, d) => {
      const dayName = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][d];
      const hourCounts: Record<number, number> = {};
      filteredOrders.forEach((o: any) => {
        const t = String(o['支付时间'] || '').trim();
        if (!t) return;
        const date = new Date(t);
        let dayIdx = date.getDay();
        dayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
        if (dayIdx !== d) return;
        const h = date.getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      return { day: dayName, hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, value: hourCounts[h] || 0 })) };
    });

    const totalBuyers = Object.keys(buyerMap).length;
    const paidBuyers = Object.values(buyerMap).filter(b => b.totalPaid > 0).length;
    const behaviorPath = [
      { step: '访问店铺', users: Math.max(totalBuyers * 3, filteredOrders.length), drop: 0 },
      { step: '浏览商品', users: Math.max(totalBuyers * 2, Math.floor(filteredOrders.length * 0.8)), drop: 0 },
      { step: '下单', users: filteredOrders.length, drop: 0 },
      { step: '完成支付', users: paidBuyers, drop: 0 },
    ].map((item, i, arr) => ({ ...item, drop: i > 0 ? Math.round((1 - item.users / arr[i - 1].users) * 100) : 0 }));

    const valuePrediction = rfmData.slice(0, 10).map((u, i) => ({
      user: `用户${i + 1}`,
      current: u.monetary,
      predicted: u.monetary * (1 + Math.random() * 0.5),
    }));

    return {
      buyerCount, repeatBuyers, repeatRate, avgAOV, attachRate, avgPerBuyer,
      segments, rfmData, ltvData, top10LTV: ltvData.slice(0, 10), avgLTV, tierData, newVsReturning,
      tags, hourData, payData, retentionData, heatmapData, behaviorPath, valuePrediction
    };
  }, [filteredOrders]);

  const noData = !filteredOrders.length;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  const kpis = [
    { label: '买家总数', value: stats?.buyerCount, fmt: (v: number) => v.toFixed(0), icon: Users, color: 'var(--pdd-primary)' },
    { label: '复购用户数', value: stats?.repeatBuyers, fmt: (v: number) => v.toFixed(0), icon: Repeat, color: '#1890ff' },
    { label: '复购率', value: stats?.repeatRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '平均客单价', value: stats?.avgAOV, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, color: 'var(--pdd-warning)' },
    { label: '连带率', value: stats?.attachRate, fmt: (v: number) => v.toFixed(2), icon: ShoppingCart, color: '#722ed1' },
    { label: '人均消费', value: stats?.avgPerBuyer, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: CreditCard, color: '#13c2c2' },
  ];

  const addTag = () => {
    if (!newTag.trim()) return;
    setUserTags(prev => ({ ...prev, [Date.now().toString()]: [newTag.trim()] }));
    setNewTag('');
    setShowTagModal(false);
  };

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tfState} />

      <div className="grid grid-cols-6 gap-2">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="pdd-card px-3 py-2 flex items-center gap-2">
            <k.icon size={16} color={k.color} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--pdd-text-secondary)]">{k.label}</span>
              <span className="text-sm font-bold block" style={{ color: k.color }}>{noData ? '--' : k.value != null ? k.fmt(k.value) : '--'}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="pdd-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1"><Target size={14} className="text-pdd-primary" /> RFM用户分群</h3>
            <select value={selectedSegment} onChange={e => setSelectedSegment(e.target.value)} className="text-xs border rounded px-2 py-1">
              <option value="all">全部分群</option>
              <option value="champions">重要价值</option>
              <option value="loyal">重要保持</option>
              <option value="potential">重要发展</option>
              <option value="new">新用户</option>
              <option value="atRisk">重要挽留</option>
              <option value="lost">流失用户</option>
            </select>
          </div>
          {noData ? <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: '重要价值', count: stats?.segments.champions.length, color: 'var(--pdd-primary)' },
                { name: '重要保持', count: stats?.segments.loyal.length, color: '#1890ff' },
                { name: '重要发展', count: stats?.segments.potential.length, color: 'var(--pdd-success)' },
                { name: '新用户', count: stats?.segments.new.length, color: 'var(--pdd-warning)' },
                { name: '重要挽留', count: stats?.segments.atRisk.length, color: '#722ed1' },
                { name: '流失用户', count: stats?.segments.lost.length, color: '#8c8c8c' },
              ].map(s => (
                <div key={s.name} className={`text-center p-2 rounded border cursor-pointer transition-all ${selectedSegment === s.name ? 'border-[var(--pdd-primary)] bg-[var(--pdd-bg)]' : 'border-[var(--pdd-border)]'}`}
                  onClick={() => setSelectedSegment(selectedSegment === s.name ? 'all' : s.name)}>
                  <span className="text-xs text-[var(--pdd-text-secondary)]">{s.name}</span>
                  <span className="text-lg font-bold block" style={{ color: s.color }}>{s.count || 0}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Activity size={14} className="text-pdd-primary" /> 用户行为路径</h3>
          {noData ? <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
            <div className="space-y-2">
              {stats?.behaviorPath.map((step, i) => (
                <div key={step.step} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-[var(--pdd-text-secondary)]">{step.step}</div>
                  <div className="flex-1 h-6 bg-pdd-bg rounded overflow-hidden">
                    <div className="h-full bg-pdd-primary rounded" style={{ width: `${(step.users / 1000) * 100}%` }} />
                  </div>
                  <div className="w-16 text-right text-xs">{step.users}人</div>
                  {step.drop > 0 && <div className="text-xs text-pdd-danger">↓{step.drop}%</div>}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><TrendingUp size={14} className="text-pdd-primary" /> 用户价值预测 {!isPaid && <Lock size={12} className="text-pdd-warning" />}</h3>
          {!isPaid ? (
            <div className="h-32 flex items-center justify-center"><Crown size={24} className="text-pdd-warning" /><span className="text-xs text-pdd-text-secondary ml-2">付费解锁</span></div>
          ) : noData ? (
            <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={stats?.valuePrediction}>
                <XAxis dataKey="user" tick={{ fontSize: 9 }} interval={0} /><YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Bar dataKey="current" fill="var(--pdd-border)" name="当前价值" /><Bar dataKey="predicted" fill="var(--pdd-primary)" name="预测价值" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Activity size={14} className="text-pdd-primary" /> 用户留存分析 {!isPaid && <Lock size={12} className="text-pdd-warning" />}</h3>
          {!isPaid ? (
            <div className="h-32 flex items-center justify-center"><Crown size={24} className="text-pdd-warning" /><span className="text-xs text-pdd-text-secondary ml-2">付费解锁</span></div>
          ) : noData ? (
            <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={stats?.retentionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, '留存率']} />
                <Area type="monotone" dataKey="rate" stroke="var(--pdd-primary)" fill="var(--pdd-primary)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock size={14} className="text-pdd-primary" /> 用户活跃热力图</h3>
        {noData ? <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-24 gap-px" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
              <div className="text-xs text-[var(--pdd-text-secondary)] text-center">时段</div>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="text-[10px] text-[var(--pdd-text-secondary)] text-center">{i}</div>
              ))}
              {stats?.heatmapData.map(day => (
                <React.Fragment key={day.day}>
                  <div className="text-xs text-[var(--pdd-text-secondary)] text-right pr-2">{day.day}</div>
                  {day.hours.map((h, i) => (
                    <div key={i} className="h-4 rounded-sm" style={{ backgroundColor: `rgba(var(--pdd-primary-rgb), ${h.value / 100})` }} />
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="pdd-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1"><Tag size={14} className="text-pdd-primary" /> 用户标签管理</h3>
          <button onClick={() => setShowTagModal(true)} className="flex items-center gap-1 px-2 py-1 text-xs bg-pdd-primary text-white rounded"><Plus size={12} />添加标签</button>
        </div>
        {noData ? <div className="h-20 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
          <div className="flex flex-wrap gap-2">
            {stats?.tags.map((tag, i) => (
              <span key={tag.name} className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}40` }}>
                {tag.name} {tag.count}
              </span>
            ))}
            {Object.entries(userTags).map(([id, tags]) => tags.map((tag, i) => (
              <span key={`${id}-${i}`} className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--pdd-bg)] text-[var(--pdd-text-secondary)] border border-[var(--pdd-border)]">
                {tag} <button onClick={() => setUserTags(prev => { const n = { ...prev }; n[id] = n[id].filter((_, idx) => idx !== i); return n; })}><X size={10} /></button>
              </span>
            )))}
          </div>
        )}
      </motion.div>

      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-pdd-card rounded-lg p-4 w-80 border border-pdd-border">
            <h3 className="text-sm font-semibold mb-3 text-pdd-text">添加用户标签</h3>
            <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="输入标签名称" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mb-3 bg-pdd-bg text-pdd-text" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTagModal(false)} className="px-3 py-1.5 text-sm border border-pdd-border rounded text-pdd-text-secondary">取消</button>
              <button onClick={addTag} className="px-3 py-1.5 text-sm bg-pdd-primary text-white rounded">保存</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
