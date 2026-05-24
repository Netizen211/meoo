import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { MapPin, TrendingUp, DollarSign, Lock, Mountain, Building2, Flag, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Globe, Truck, Clock, Target } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct } from '../components/TimeFilter';

const REMOTE_PROVINCES = ['新疆', '西藏', '内蒙古', '青海', '甘肃', '宁夏', '海南', '黑龙江', '吉林', '云南'];
const COLORS = ['var(--pdd-danger)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-warning)', 'var(--pdd-purple)', 'var(--pdd-cyan)', 'var(--pdd-pink)', 'var(--pdd-orange)'];

export default function RegionPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'penetration' | 'logistics' | 'growth'>('overview');
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled } as any;

  const validOrders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(validOrders), [validOrders]);
  const filteredOrders = useMemo(() => filterByTimeRange(validOrders, allDates, timeRange), [validOrders, allDates, timeRange]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(validOrders, allDates, timeRange) : [], [validOrders, allDates, timeRange, compareEnabled]);

  const provinceStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; paid: number; buyers: Set<string> }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(o['省'] || '').trim();
      if (!prov) return;
      if (!map[prov]) map[prov] = { count: 0, revenue: 0, paid: 0, buyers: new Set() };
      map[prov].count++;
      map[prov].revenue += safeFloat(o['商家实收金额(元)']);
      map[prov].paid += safeFloat(o['用户实付金额(元)']);
      const buyer = String(o['用户购买手机号'] || o['消费者资料'] || '').trim();
      if (buyer) map[prov].buyers.add(buyer);
    });
    return Object.entries(map).map(([name, d]) => {
      const buyerCount = d.buyers.size;
      const totalBuyers = new Set(filteredOrders.map((o: any) => String(o['用户购买手机号'] || o['消费者资料'] || '').trim()).filter(Boolean)).size;
      return {
        name, count: d.count, revenue: d.revenue, paid: d.paid, buyers: buyerCount,
        avgOrder: d.count > 0 ? d.paid / d.count : 0,
        rate: filteredOrders.length > 0 ? (d.count / filteredOrders.length) * 100 : 0,
        penetration: filteredOrders.length > 0 && totalBuyers > 0 ? (buyerCount / totalBuyers) * 100 : 0
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  const compareProvinceStats = useMemo(() => {
    if (!compareOrders.length) return null;
    const map: Record<string, { count: number; revenue: number }> = {};
    compareOrders.forEach((o: any) => {
      const prov = String(o['省'] || '').trim();
      if (!prov) return;
      if (!map[prov]) map[prov] = { count: 0, revenue: 0 };
      map[prov].count++;
      map[prov].revenue += safeFloat(o['商家实收金额(元)']);
    });
    return Object.entries(map).map(([name, d]) => ({ name, count: d.count, revenue: d.revenue })).sort((a, b) => b.count - a.count);
  }, [compareOrders]);

  const cityStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; paid: number; prov: string; buyers: Set<string> }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(o['省'] || '').trim();
      const city = String(o['市'] || '').trim();
      if (!city) return;
      const key = `${prov}-${city}`;
      if (!map[key]) map[key] = { count: 0, revenue: 0, paid: 0, prov, buyers: new Set() };
      map[key].count++;
      map[key].revenue += safeFloat(o['商家实收金额(元)']);
      map[key].paid += safeFloat(o['用户实付金额(元)']);
      const buyer = String(o['用户购买手机号'] || o['消费者资料'] || '').trim();
      if (buyer) map[key].buyers.add(buyer);
    });
    return Object.entries(map).map(([key, d]) => ({
      label: `${d.prov} ${key.split('-')[1]}`, prov: d.prov, city: key.split('-')[1],
      count: d.count, revenue: d.revenue, paid: d.paid, buyers: d.buyers.size,
      avgOrder: d.count > 0 ? d.paid / d.count : 0,
    })).sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  const remoteStats = useMemo(() => {
    const remoteOrders = filteredOrders.filter((o: any) => {
      const prov = String(o['省'] || '').trim();
      return REMOTE_PROVINCES.includes(prov);
    });
    const remoteRevenue = remoteOrders.reduce((s: number, o: any) => s + safeFloat(o['商家实收金额(元)']), 0);
    const remoteShipping = remoteOrders.reduce((s: number, o: any) => s + safeFloat(o['邮费(元)']), 0);
    const byProv: Record<string, number> = {};
    remoteOrders.forEach((o: any) => {
      const prov = String(o['省'] || '').trim();
      if (prov) byProv[prov] = (byProv[prov] || 0) + 1;
    });
    return { count: remoteOrders.length, rate: filteredOrders.length > 0 ? (remoteOrders.length / filteredOrders.length) * 100 : 0, revenue: remoteRevenue, shipping: remoteShipping, byProv: Object.entries(byProv).sort((a, b) => b[1] - a[1]) };
  }, [filteredOrders]);

  const logisticsByProvince = useMemo(() => {
    const map: Record<string, { hours: number[]; count: number }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(o['省'] || '').trim();
      const payT = String(o['支付时间'] || '');
      const shipT = String(o['发货时间'] || '');
      if (!prov || !payT || !shipT) return;
      const hours = (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000;
      if (hours < 0) return;
      if (!map[prov]) map[prov] = { hours: [], count: 0 };
      map[prov].hours.push(hours);
      map[prov].count++;
    });
    return Object.entries(map).map(([name, d]) => ({ name, avgHours: d.hours.length > 0 ? d.hours.reduce((a, b) => a + b, 0) / d.hours.length : 0, count: d.count })).sort((a, b) => a.avgHours - b.avgHours);
  }, [filteredOrders]);

  const growthTrend = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    filteredOrders.forEach((o: any) => {
      const d = String(o['支付时间'] || '').split(' ')[0];
      const prov = String(o['省'] || '').trim();
      if (!d || !prov) return;
      if (!byDate[d]) byDate[d] = {};
      byDate[d][prov] = (byDate[d][prov] || 0) + 1;
    });
    const dates = Object.keys(byDate).sort().slice(-7);
    const topProvinces = provinceStats.slice(0, 5).map(p => p.name);
    return dates.map(d => {
      const row: any = { date: d.slice(5) };
      topProvinces.forEach(p => { row[p] = byDate[d]?.[p] || 0; });
      return row;
    });
  }, [filteredOrders, provinceStats]);

  const toggleProvince = (name: string) => {
    setSelectedProvinces(prev => prev.includes(name) ? prev.filter(p => p !== name) : prev.length < 3 ? [...prev, name] : prev);
  };

  const comparedProvinces = useMemo(() => {
    if (selectedProvinces.length < 2) return [];
    return provinceStats.filter(p => selectedProvinces.includes(p.name));
  }, [selectedProvinces, provinceStats]);

  const kpis = useMemo(() => ({
    provCount: provinceStats.length, cityCount: cityStats.length, topProv: provinceStats[0]?.name || '--', remoteRate: remoteStats.rate,
    avgPenetration: provinceStats.length > 0 ? provinceStats.reduce((s, p) => s + p.buyers, 0) / provinceStats.length : 0,
    totalBuyers: provinceStats.reduce((s, p) => s + p.buyers, 0)
  }), [provinceStats, cityStats, remoteStats]);

  const noData = filteredOrders.length === 0;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';
  const provTop10 = provinceStats.slice(0, 10);
  const cityTop10 = cityStats.slice(0, 10);

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tfState} />
      
      <div className="flex gap-2 border-b border-[var(--pdd-border)] pb-2">
        {[{ key: 'overview', label: '概览', icon: Globe }, { key: 'penetration', label: '渗透率', icon: Target }, { key: 'logistics', label: '物流', icon: Truck }, { key: 'growth', label: '增长', icon: TrendingUp }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-[var(--pdd-danger)] text-white' : 'text-[var(--pdd-text-secondary)] hover:bg-[var(--pdd-bg)]'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[{ label: '覆盖省份', value: kpis.provCount, fmt: (v: number) => `${v}个`, icon: Flag, color: 'var(--pdd-danger)' }, { label: '覆盖城市', value: kpis.cityCount, fmt: (v: number) => `${v}个`, icon: Building2, color: 'var(--pdd-primary)' }, { label: 'TOP1省份', value: kpis.topProv, fmt: (v: string) => v, icon: MapPin, color: 'var(--pdd-success)' }, { label: '偏远占比', value: kpis.remoteRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Mountain, color: 'var(--pdd-warning)' }].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="pdd-card px-3 py-2.5 flex items-center gap-3">
            <card.icon size={16} color={card.color} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--pdd-text-secondary)]">{card.label}</span>
              <span className="text-sm font-bold block" style={{ color: card.color }}>{noData ? '--' : (card.fmt as any)(card.value)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MapPin size={14} color="var(--pdd-danger)" />省份对比选择（最多3个）</h3>
              <div className="flex flex-wrap gap-2">
                {provinceStats.slice(0, 15).map(p => (
                  <button key={p.name} onClick={() => toggleProvince(p.name)} className={`px-2 py-1 rounded text-xs border transition-colors ${selectedProvinces.includes(p.name) ? 'bg-[var(--pdd-danger)] text-white border-[pdd-danger]' : 'border-[var(--pdd-border)] hover:border-[pdd-danger]'}`}>{p.name}</button>
                ))}
              </div>
              {comparedProvinces.length >= 2 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {comparedProvinces.map(p => (
                    <div key={p.name} className="p-2 rounded bg-[var(--pdd-bg)]">
                      <div className="text-xs font-medium">{p.name}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">订单: {p.count}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">实收: ¥{p.revenue.toFixed(0)}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">客单: ¥{p.avgOrder.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <motion.div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">省份订单量TOP10({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
                  <ResponsiveContainer width="100%" height={200}><BarChart data={provTop10} layout="vertical" margin={{ left: 50 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} /><Tooltip /><Bar dataKey="count" fill="var(--pdd-primary-light)" radius={[0, 4, 4, 0]} barSize={14} /></BarChart></ResponsiveContainer>
                )}
              </motion.div>
              <motion.div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">省份热力分布({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
                  <div className="grid grid-cols-6 gap-1.5">
                    {provinceStats.slice(0, 30).map((p) => {
                      const maxCount = provinceStats[0]?.count || 1;
                      const intensity = Math.max(0.1, p.count / maxCount);
                      return <div key={p.name} className="text-center py-1.5 px-1 rounded text-xs" style={{ backgroundColor: `rgba(224, 46, 36, ${intensity})`, color: intensity > 0.5 ? 'white' : 'var(--pdd-text)' }}><div className="font-medium truncate">{p.name}</div><div className="font-mono text-[10px]">{p.count}单</div></div>;
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div className="pdd-card p-3 relative">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Globe size={14} color="var(--pdd-danger)" />地图可视化({rangeLabel})</h3>
              {!isPaid && <div className="absolute inset-0 bg-[rgba(255,255,255,0.8)] backdrop-blur-sm flex items-center justify-center z-10 rounded-lg"><div className="text-center"><Lock size={24} className="mx-auto mb-2 text-[var(--pdd-text-secondary)]" /><p className="text-sm font-medium text-[var(--pdd-text-secondary)]">付费会员专享</p><p className="text-xs text-[var(--pdd-text-secondary)] mt-1">升级解锁地图可视化</p></div></div>}
              <div className="h-48 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">地图组件占位</div>
            </motion.div>

            <motion.div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2">城市订单量TOP10({rangeLabel})</h3>
              {noData ? <div className="h-20 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
                <div className="space-y-1">
                  {cityTop10.map((c, i) => (
                    <div key={c.label} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--pdd-bg)] cursor-pointer" onClick={() => setExpandedCity(expandedCity === c.label ? null : c.label)}>
                      <div className="flex items-center gap-2"><span className="text-xs text-[var(--pdd-text-secondary)] w-4">{i + 1}</span><span className="text-xs font-medium">{c.label}</span></div>
                      <div className="flex items-center gap-3"><span className="text-xs font-mono">{c.count}单</span><span className="text-xs font-mono text-[var(--pdd-text-secondary)]">¥{c.revenue.toFixed(0)}</span><ChevronRight size={14} className="text-[var(--pdd-text-secondary)]" /></div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'penetration' && (
          <motion.div key="penetration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2">地域买家数分布({rangeLabel})</h3>{noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : <ResponsiveContainer width="100%" height={180}><BarChart data={provinceStats.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="buyers" fill="#e02e24" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>}</div>
              <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2">地域渗透率排名({rangeLabel})</h3>{noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={provinceStats.slice(0, 8).map(p => ({ name: p.name, value: p.buyers }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{provinceStats.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}</div>
            </div>
            <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2">省份渗透率详情({rangeLabel})</h3>{noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">请先上传数据</div> : (
              <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]"><th className="py-1.5 text-left">省份</th><th className="py-1.5 text-right">买家数</th><th className="py-1.5 text-right">订单数</th><th className="py-1.5 text-right">人均订单</th><th className="py-1.5 text-right">渗透率</th></tr></thead>
                <tbody>{provinceStats.slice(0, 15).map((p, i) => (<tr key={p.name} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]"><td className="py-1.5 font-medium">{p.name}</td><td className="py-1.5 text-right">{p.buyers}</td><td className="py-1.5 text-right">{p.count}</td><td className="py-1.5 text-right">{(p.count / p.buyers).toFixed(1)}</td><td className="py-1.5 text-right">{kpis.totalBuyers > 0 ? ((p.buyers / kpis.totalBuyers) * 100).toFixed(1) : 0}%</td></tr>))}</tbody>
              </table>
            )}</div>
          </motion.div>
        )}

        {activeTab === 'logistics' && (
          <motion.div key="logistics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Truck size={14} color="var(--pdd-danger)" />省份物流时效对比({rangeLabel})</h3>{noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : <ResponsiveContainer width="100%" height={200}><BarChart data={logisticsByProvince.slice(0, 10)} layout="vertical" margin={{ left: 50 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis type="number" tick={{ fontSize: 10 }} unit="h" /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} /><Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, '平均时长']} /><Bar dataKey="avgHours" fill="#e02e24" radius={[0, 4, 4, 0]} barSize={14} /></BarChart></ResponsiveContainer>}</div>
            <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2">偏远地区物流分析({rangeLabel})</h3>{noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">请先上传数据</div> : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded bg-[var(--pdd-bg)]"><span className="text-xs">偏远订单占比</span><span className="text-sm font-bold text-[var(--pdd-warning)]">{remoteStats.rate.toFixed(1)}%</span></div>
                  <div className="flex items-center justify-between p-2 rounded"><span className="text-xs">偏远订单数</span><span className="text-xs font-mono">{remoteStats.count}单</span></div>
                  <div className="flex items-center justify-between p-2 rounded"><span className="text-xs">偏远商家实收</span><span className="text-xs font-mono">¥{remoteStats.revenue.toFixed(0)}</span></div>
                </div>
                <div className="space-y-1">{remoteStats.byProv.slice(0, 8).map(([prov, count]) => (<div key={prov} className="flex items-center justify-between text-xs py-1"><span>{prov}</span><span className="font-mono">{count}单</span></div>))}</div>
              </div>
            )}</div>
          </motion.div>
        )}

        {activeTab === 'growth' && (
          <motion.div key="growth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingUp size={14} color="var(--pdd-danger)" />TOP5省份增长趋势({rangeLabel})</h3>{noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : <ResponsiveContainer width="100%" height={200}><LineChart data={growthTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{provinceStats.slice(0, 5).map((p, i) => <Line key={p.name} type="monotone" dataKey={p.name} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer>}</div>
            <div className="pdd-card p-3"><h3 className="text-sm font-semibold mb-2">地域增长潜力分析({rangeLabel})</h3>{noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">请先上传数据</div> : (
              <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]"><th className="py-1.5 text-left">省份</th><th className="py-1.5 text-right">订单量</th><th className="py-1.5 text-right">增长率</th><th className="py-1.5 text-right">潜力评级</th></tr></thead>
                <tbody>{provinceStats.slice(0, 10).map((p, i) => (<tr key={p.name} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]"><td className="py-1.5 font-medium">{p.name}</td><td className="py-1.5 text-right">{p.count}</td><td className="py-1.5 text-right">{compareEnabled && compareProvinceStats ? (() => { const prev = compareProvinceStats.find(cp => cp.name === p.name); return prev ? changePct(p.count, prev.count)?.toFixed(1) + '%' : '--'; })() : '--'}</td><td className="py-1.5 text-right"><span className={`px-1.5 py-0.5 rounded text-[10px] ${p.count > 100 ? 'bg-pdd-success/10 text-green-700' : p.count > 50 ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-bg text-pdd-text'}`}>{p.count > 100 ? '高' : p.count > 50 ? '中' : '低'}</span></td></tr>))}</tbody>
              </table>
            )}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
