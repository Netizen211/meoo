import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';
import { MapPin, TrendingUp, DollarSign, Lock, Mountain, Building2, Flag, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Globe, Truck, Clock, Target } from 'lucide-react';
import { useData, useAuth } from '../App';
import { findField } from '../utils';
import TimeFilter, { useTimeFilter, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct } from '../components/TimeFilter';
import FilterToolbar from '../components/FilterToolbar';
import ChinaMap from '../components/ChinaMap';
import { chartColorArray } from '../utils/colorMap';
import { normalizeProvinceName } from '../utils/chinaMapData';

const REMOTE_PROVINCES = ['新疆', '西藏', '内蒙古', '青海', '甘肃', '宁夏', '海南', '黑龙江', '吉林', '云南'];
const COLORS = chartColorArray;

// 字段查找别名（覆盖常见的拼多多CSV字段名变体）
const FIELD_ALIASES = {
  province: ['省', '省份', '收货省', '收货省份', '所在省份', 'Province'],
  city: ['市', '城市', '收货市', '收货城市', '所在城市', 'City'],
  buyer: ['用户购买手机号', '消费者资料', '买家手机号', '手机号', '收货人手机', '用户手机号', '收货人手机号', '买家ID', '买家id', '用户ID', '用户id', 'buyer_id', '买家账号', '联系人手机', '收货人电话', '联系电话', '收件人手机', '收件人手机号', '收件人电话', '手机号码', '收货人手机号码', '收货人联系方式', '用户手机', '收货人联系电话', '收货人手机', '收件人联系电话', '联系方式'],
  shipTime: ['发货时间', '发货日期', 'ship_time', '发货'],
  payTime: ['支付时间', '下单时间', '付款时间', '订单创建时间', '创建时间', '成交时间', 'pay_time', '订单时间'],
};

export default function RegionPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('all', 'day');
  const { timeRange, granularity, compareEnabled, useNaturalDate, setUseNaturalDate, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'penetration' | 'logistics' | 'growth'>('overview');

  const validOrders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(findField(o, '订单状态') || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(validOrders), [validOrders]);
  const filteredOrders = useMemo(() => filterByTimeRange(validOrders, allDates, timeRange, customStart, customEnd, quickRange, useNaturalDate), [validOrders, allDates, timeRange, customStart, customEnd, quickRange]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(validOrders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange) : [], [validOrders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange, compareEnabled]);

  const noData = filteredOrders.length === 0;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : timeRange === '90' ? '近90天' : timeRange === 'all' ? '全部' : '自定义';

  // 省份统计（含GMV/订单/买家/客单价/偏远标记）
  const provinceStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; paid: number; buyers: Set<string>; postage: number; refund: number }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      if (!prov) return;
      if (!map[prov]) map[prov] = { count: 0, revenue: 0, paid: 0, buyers: new Set(), postage: 0, refund: 0 };
      map[prov].count++;
      map[prov].revenue += safeFloat(findField(o, '商品总价(元)', '商品总价'));
      map[prov].paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
      map[prov].postage += safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费'));
      map[prov].refund += safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)'));
      const buyer = String(findField(o, ...FIELD_ALIASES.buyer) || '').trim();
      if (buyer) map[prov].buyers.add(buyer);
    });
    const totalBuyers = new Set(filteredOrders.map((o: any) => String(findField(o, ...FIELD_ALIASES.buyer) || '').trim()).filter(Boolean)).size;
    return Object.entries(map).map(([name, d]) => {
      const buyerCount = d.buyers.size;
      return {
        name, count: d.count, revenue: d.revenue, paid: d.paid, buyers: buyerCount, postage: d.postage, refund: d.refund,
        isRemote: REMOTE_PROVINCES.includes(name),
        avgOrder: d.count > 0 ? d.paid / d.count : 0,
        rate: filteredOrders.length > 0 ? (d.count / filteredOrders.length) * 100 : 0,
        penetration: filteredOrders.length > 0 && totalBuyers > 0 ? (buyerCount / totalBuyers) * 100 : 0,
        avgBuyerOrder: buyerCount > 0 ? d.count / buyerCount : 0,
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  // 上一周期省份对比数据
  const compareProvinceStats = useMemo(() => {
    if (!compareOrders.length) return null;
    const cmap: Record<string, { count: number; revenue: number; paid: number }> = {};
    compareOrders.forEach((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      if (!prov) return;
      if (!cmap[prov]) cmap[prov] = { count: 0, revenue: 0, paid: 0 };
      cmap[prov].count++;
      cmap[prov].revenue += safeFloat(findField(o, '商品总价(元)', '商品总价'));
      cmap[prov].paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
    });
    return cmap;
  }, [compareOrders]);

  // 城市统计
  const cityStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; paid: number; prov: string; buyers: Set<string>; postage: number }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      const city = String(findField(o, ...FIELD_ALIASES.city) || '').trim();
      if (!city) return;
      const key = `${prov}-${city}`;
      if (!map[key]) map[key] = { count: 0, revenue: 0, paid: 0, prov, buyers: new Set(), postage: 0 };
      map[key].count++;
      map[key].revenue += safeFloat(findField(o, '商品总价(元)', '商品总价'));
      map[key].paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
      map[key].postage += safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费'));
      const buyer = String(findField(o, ...FIELD_ALIASES.buyer) || '').trim();
      if (buyer) map[key].buyers.add(buyer);
    });
    return Object.entries(map).map(([key, d]) => ({
      label: d.prov ? `${d.prov} ${key.split('-').slice(1).join('-')}` : key,
      prov: d.prov, city: key.split('-').slice(1).join('-'),
      count: d.count, revenue: d.revenue, paid: d.paid, buyers: d.buyers.size, postage: d.postage,
      avgOrder: d.count > 0 ? d.paid / d.count : 0,
    })).sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  // 偏远地区分析
  const remoteStats = useMemo(() => {
    const remoteOrders = filteredOrders.filter((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      return REMOTE_PROVINCES.includes(prov);
    });
    const remoteRevenue = remoteOrders.reduce((s: number, o: any) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
    const remoteShipping = remoteOrders.reduce((s: number, o: any) => s + safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费')), 0);
    const remotePaid = remoteOrders.reduce((s: number, o: any) => s + safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')), 0);
    const byProv: Record<string, number> = {};
    remoteOrders.forEach((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      if (prov) byProv[prov] = (byProv[prov] || 0) + 1;
    });
    return {
      count: remoteOrders.length, rate: filteredOrders.length > 0 ? (remoteOrders.length / filteredOrders.length) * 100 : 0,
      revenue: remoteRevenue, shipping: remoteShipping, paid: remotePaid,
      avgShipping: remoteOrders.length > 0 ? remoteShipping / remoteOrders.length : 0,
      byProv: Object.entries(byProv).sort((a, b) => b[1] - a[1]),
    };
  }, [filteredOrders]);

  // 物流时效（按省份）
  const logisticsByProvince = useMemo(() => {
    const map: Record<string, { hours: number[]; count: number; area: string }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      const payT = String(findField(o, ...FIELD_ALIASES.payTime) || '');
      const shipT = String(findField(o, ...FIELD_ALIASES.shipTime) || '');
      if (!prov || !payT || !shipT) return;
      const hours = (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000;
      if (hours < 0 || hours > 720) return; // 过滤异常数据(>30天)
      if (!map[prov]) map[prov] = { hours: [], count: 0, area: REMOTE_PROVINCES.includes(prov) ? '偏远地区' : '非偏远' };
      map[prov].hours.push(hours);
      map[prov].count++;
    });
    return Object.entries(map).map(([name, d]) => {
      const sorted = [...d.hours].sort((a, b) => a - b);
      const len = sorted.length;
      return {
        name, count: d.count, area: d.area,
        avgHours: len > 0 ? sorted.reduce((a, b) => a + b, 0) / len : 0,
        medianHours: len > 0 ? sorted[Math.floor(len / 2)] : 0,
        p90Hours: len > 0 ? sorted[Math.floor(len * 0.9)] : 0,
        maxHours: len > 0 ? sorted[len - 1] : 0,
      };
    }).sort((a, b) => a.avgHours - b.avgHours);
  }, [filteredOrders]);

  // 城市物流时效
  const cityLogistics = useMemo(() => {
    const map: Record<string, { hours: number[]; prov: string }> = {};
    filteredOrders.forEach((o: any) => {
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      const city = String(findField(o, ...FIELD_ALIASES.city) || '').trim();
      const payT = String(findField(o, ...FIELD_ALIASES.payTime) || '');
      const shipT = String(findField(o, ...FIELD_ALIASES.shipTime) || '');
      if (!prov || !city || !payT || !shipT) return;
      const hours = (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000;
      if (hours < 0 || hours > 720) return;
      const key = `${prov}-${city}`;
      if (!map[key]) map[key] = { hours: [], prov };
      map[key].hours.push(hours);
    });
    return Object.entries(map).map(([key, d]) => {
      const cityName = key.split('-').slice(1).join('-');
      const avg = d.hours.length > 0 ? d.hours.reduce((a, b) => a + b, 0) / d.hours.length : 0;
      return { label: `${d.prov} ${cityName}`, prov: d.prov, city: cityName, count: d.hours.length, avgHours: avg };
    }).sort((a, b) => a.avgHours - b.avgHours);
  }, [filteredOrders]);

  // 趋势数据（近30天每日订单按省份）
  const growthTrend = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    filteredOrders.forEach((o: any) => {
      const d = String(findField(o, ...FIELD_ALIASES.payTime) || '').split(' ')[0];
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      if (!d || !prov) return;
      if (!byDate[d]) byDate[d] = {};
      byDate[d][prov] = (byDate[d][prov] || 0) + 1;
    });
    const dates = Object.keys(byDate).sort().slice(-14);
    const topProvinces = provinceStats.slice(0, 5).map(p => p.name);
    return dates.map(d => {
      const row: any = { date: d.slice(5) };
      topProvinces.forEach(p => { row[p] = byDate[d]?.[p] || 0; });
      return row;
    });
  }, [filteredOrders, provinceStats]);

  // 周趋势（按周聚合，用于增长Tab的趋势线）
  const weekTrend = useMemo(() => {
    const byWeek: Record<string, Record<string, number>> = {};
    filteredOrders.forEach((o: any) => {
      const rawDate = String(findField(o, ...FIELD_ALIASES.payTime) || '').split(' ')[0];
      if (!rawDate) return;
      const d = new Date(rawDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.getFullYear(), d.getMonth(), diff);
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const prov = String(findField(o, ...FIELD_ALIASES.province) || '').trim();
      if (!prov) return;
      if (!byWeek[weekKey]) byWeek[weekKey] = {};
      byWeek[weekKey][prov] = (byWeek[weekKey][prov] || 0) + 1;
    });
    const weeks = Object.keys(byWeek).sort().slice(-8);
    const topProvinces = provinceStats.slice(0, 5).map(p => p.name);
    return weeks.map(w => {
      const row: any = { date: w.slice(5) };
      topProvinces.forEach(p => { row[p] = byWeek[w]?.[p] || 0; });
      return row;
    });
  }, [filteredOrders, provinceStats]);

  const toggleProvince = (name: string) => {
    const n = normalizeProvinceName(name);
    setSelectedProvinces(prev => prev.includes(n) ? prev.filter(p => p !== n) : prev.length < 3 ? [...prev, n] : prev);
  };

  const comparedProvinces = useMemo(() => {
    if (selectedProvinces.length < 2) return [];
    return provinceStats.filter(p => selectedProvinces.includes(normalizeProvinceName(p.name)));
  }, [selectedProvinces, provinceStats]);

  const totalBuyers = useMemo(() =>
    new Set(filteredOrders.map((o: any) => String(findField(o, ...FIELD_ALIASES.buyer) || '').trim()).filter(Boolean)).size
  , [filteredOrders]);

  const hasBuyerData = totalBuyers > 0;

  const kpis = useMemo(() => ({
    provCount: provinceStats.length, cityCount: cityStats.length,
    topProv: provinceStats[0]?.name || '--', topProvRate: provinceStats[0]?.rate || 0,
    remoteRate: remoteStats.rate,
    avgPenetration: totalBuyers > 0 && provinceStats.length > 0 ? (provinceStats.reduce((s, p) => s + p.buyers, 0) / provinceStats.length / totalBuyers) * 100 : 0,
    totalBuyers,
  }), [provinceStats, cityStats, remoteStats, totalBuyers]);

  const provTop15 = provinceStats.slice(0, 15);
  const cityTop20 = cityStats.slice(0, 20);

  return (
    <div className="p-4 space-y-3">
      <FilterToolbar tf={tf} />
        {timeRange !== 'all' && timeRange !== 'custom' && (
          <div className="flex items-center rounded border border-pdd-border overflow-hidden text-[11px]">
            <button onClick={() => setUseNaturalDate(false)}
              className={`px-2 py-1 transition-colors ${!useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>按订单时间</button>
            <button onClick={() => setUseNaturalDate(true)}
              className={`px-2 py-1 transition-colors ${useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>按当前时间</button>
          </div>
        )}

      {/* Tab 导航 */}
      <div className="flex gap-2 border-b border-[var(--pdd-border)] pb-2">
        {[{ key: 'overview', label: '概览', icon: Globe }, { key: 'penetration', label: '渗透率', icon: Target }, { key: 'logistics', label: '物流', icon: Truck }, { key: 'growth', label: '增长', icon: TrendingUp }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-[var(--pdd-danger)] text-white' : 'text-[var(--pdd-text-secondary)] hover:bg-[var(--pdd-bg)]'}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* KPI 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ label: '覆盖省份', value: kpis.provCount, fmt: (v: number) => `${v}个`, icon: Flag, color: 'var(--pdd-danger)' },
          { label: '覆盖城市', value: kpis.cityCount, fmt: (v: number) => `${v}个`, icon: Building2, color: 'var(--pdd-primary)' },
          { label: '总买家数', value: kpis.totalBuyers, fmt: (v: number) => v > 0 ? `${v}人` : '--', icon: Target, color: 'var(--pdd-success)' },
          { label: '偏远订单占比', value: kpis.remoteRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Mountain, color: 'var(--pdd-warning)' },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="pdd-card px-3 py-2.5 flex items-center gap-3">
            <card.icon size={16} color={card.color} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--pdd-text-secondary)]">{card.label}</span>
              <span className="text-sm font-bold block" style={{ color: card.color }}>{noData ? '--' : card.fmt(card.value)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ======== Tab 1: 概览 ======== */}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* 省份对比选择 */}
            <div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MapPin size={14} color="var(--pdd-danger)" />省份对比（选择2-3个省份进行对比）</h3>
              <div className="flex flex-wrap gap-2">
                {provinceStats.slice(0, 20).map(p => (
                  <button key={p.name} onClick={() => toggleProvince(p.name)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${selectedProvinces.includes(normalizeProvinceName(p.name)) ? 'bg-[var(--pdd-danger)] text-white border-[var(--pdd-danger)]' : 'border-[var(--pdd-border)] hover:border-[var(--pdd-danger)]'}`}>
                    {p.name}
                  </button>
                ))}
              </div>
              {comparedProvinces.length >= 2 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {comparedProvinces.map(p => (
                    <div key={p.name} className="p-2 rounded bg-[var(--pdd-bg)]">
                      <div className="text-xs font-medium">{p.name}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">订单: {p.count.toLocaleString()}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">GMV: ¥{p.revenue.toFixed(0)}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">买家: {p.buyers}人</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">客单: ¥{p.avgOrder.toFixed(2)}</div>
                      <div className="text-xs text-[var(--pdd-text-secondary)]">邮费: ¥{p.postage.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 中国地图 */}
            <ChinaMap
              provinceStats={provinceStats}
              logisticsByProvince={logisticsByProvince}
              selectedProvinces={selectedProvinces}
              onToggleProvince={toggleProvince}
              rangeLabel={rangeLabel}
              noData={noData}
            />

            {/* 图表 + 表格 双列布局 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 左列：GMV 图表 + 省份数据明细 */}
              <motion.div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">省份GMV TOP10({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div> : (
                  <ResponsiveContainer width="100%" height={200}><BarChart data={provTop15.slice(0, 10)} layout="vertical" margin={{ left: 50 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? (v/1000).toFixed(0) + 'k' : String(v)} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} /><Tooltip formatter={(v: number) => ['¥' + v.toFixed(0), 'GMV']} /><Bar dataKey="revenue" fill="var(--pdd-primary-light)" radius={[0, 4, 4, 0]} barSize={16} /></BarChart></ResponsiveContainer>
                )}
                {/* 省份GMV明细表 */}
                {!noData && (
                  <div className="mt-2 border-t border-[var(--pdd-border)] pt-2 max-h-64 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                        <th className="py-1 px-1 text-left">省份</th>
                        <th className="py-1 px-1 text-right">GMV</th>
                        <th className="py-1 px-1 text-right">实付</th>
                        <th className="py-1 px-1 text-right">客单</th>
                        <th className="py-1 px-1 text-right">占比</th>
                      </tr></thead>
                      <tbody>
                        {provinceStats.map((p, i) => (
                          <tr key={p.name} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} border-b border-[var(--pdd-border)]/30`}>
                            <td className="py-1 px-1 font-medium">{p.name}</td>
                            <td className="py-1 px-1 text-right tabular-nums text-[var(--pdd-primary-light)] font-medium">¥{p.revenue.toFixed(0)}</td>
                            <td className="py-1 px-1 text-right tabular-nums">¥{p.paid.toFixed(0)}</td>
                            <td className="py-1 px-1 text-right tabular-nums">¥{p.avgOrder.toFixed(2)}</td>
                            <td className="py-1 px-1 text-right">{p.rate.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>

              {/* 右列：订单量图表 + 订单明细 */}
              <motion.div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">省份订单量 TOP10({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div> : (
                  <ResponsiveContainer width="100%" height={200}><BarChart data={provTop15.slice(0, 10)} layout="vertical" margin={{ left: 50 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? (v/1000).toFixed(0) + 'k' : String(v)} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} /><Tooltip formatter={(v: number) => [v.toLocaleString(), '订单量']} /><Bar dataKey="count" fill="var(--pdd-success)" radius={[0, 4, 4, 0]} barSize={16} /></BarChart></ResponsiveContainer>
                )}
                {/* 省份订单量明细表 */}
                {!noData && (
                  <div className="mt-2 border-t border-[var(--pdd-border)] pt-2 max-h-64 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                        <th className="py-1 px-1 text-left">省份</th>
                        <th className="py-1 px-1 text-right">订单量</th>
                        <th className="py-1 px-1 text-right">买家</th>
                        <th className="py-1 px-1 text-right">人均</th>
                        <th className="py-1 px-1 text-center">偏远</th>
                      </tr></thead>
                      <tbody>
                        {provinceStats.map((p, i) => (
                          <tr key={p.name} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} border-b border-[var(--pdd-border)]/30`}>
                            <td className="py-1 px-1 font-medium">{p.name}</td>
                            <td className="py-1 px-1 text-right tabular-nums font-medium">{p.count.toLocaleString()}</td>
                            <td className="py-1 px-1 text-right">{p.buyers}</td>
                            <td className="py-1 px-1 text-right tabular-nums">{((p as any).avgBuyerOrder ?? (p.buyers > 0 ? p.count / p.buyers : 0)).toFixed(1)}</td>
                            <td className="py-1 px-1 text-center">{p.isRemote ? <span className="text-[10px] bg-[var(--pdd-warning)]/10 text-[var(--pdd-warning)] px-1 rounded">偏远</span> : <span className="text-[var(--pdd-text-muted)]">-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </div>

            {/* 城市订单量 TOP20 */}
            <motion.div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2">城市订单量 TOP20({rangeLabel})</h3>
              {cityTop20.length === 0 ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-8">未识别到城市数据（CSV中缺少城市字段）</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                      <th className="py-1.5 px-2 text-left w-6">#</th><th className="py-1.5 px-2 text-left">城市</th><th className="py-1.5 px-2 text-right">订单量</th><th className="py-1.5 px-2 text-right">GMV</th><th className="py-1.5 px-2 text-right">买家</th><th className="py-1.5 px-2 text-right">客单价</th><th className="py-1.5 px-2 text-right">邮费</th>
                    </tr></thead>
                    <tbody>
                      {cityTop20.map((c, i) => (
                        <tr key={c.label} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50 cursor-pointer`} onClick={() => setExpandedCity(expandedCity === c.label ? null : c.label)}>
                          <td className="py-1.5 px-2 text-[var(--pdd-text-muted)]">{i + 1}</td>
                          <td className="py-1.5 px-2 font-medium flex items-center gap-1"><ChevronRight size={12} className={`text-[var(--pdd-text-muted)] transition-transform ${expandedCity === c.label ? 'rotate-90' : ''}`} />{c.label}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{c.count.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-pdd-primary-light font-medium">¥{c.revenue.toFixed(0)}</td>
                          <td className="py-1.5 px-2 text-right">{c.buyers}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">¥{c.avgOrder.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">¥{c.postage.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ======== Tab 2: 渗透率 ======== */}
        {activeTab === 'penetration' && (
          <motion.div key="penetration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">地域{hasBuyerData ? '买家数' : '订单数'}分布({rangeLabel}){!hasBuyerData && <span className="text-[10px] text-[var(--pdd-text-muted)] ml-1">未识别买家字段，展示订单数</span>}</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div> : (
                  <ResponsiveContainer width="100%" height={200}><BarChart data={provinceStats.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey={hasBuyerData ? 'buyers' : 'count'} fill="var(--pdd-danger)" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>
                )}
              </div>
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">渗透率饼图({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div> : (
                  <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={provinceStats.slice(0, 8).map(p => ({ name: p.name, value: hasBuyerData ? p.buyers : p.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{provinceStats.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                )}
              </div>
            </div>
            {/* 渗透率详情表 */}
            <div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2">省份渗透率详情({rangeLabel}){!hasBuyerData && <span className="text-[10px] text-[var(--pdd-text-muted)] ml-1">未识别买家字段，渗透率不可用</span>}</h3>
              {noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-8">暂无数据</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-1.5 px-2 text-left">省份</th><th className="py-1.5 px-2 text-right">买家数</th><th className="py-1.5 px-2 text-right">订单数</th><th className="py-1.5 px-2 text-right">人均订单</th><th className="py-1.5 px-2 text-right">GMV</th><th className="py-1.5 px-2 text-right">客单价</th><th className="py-1.5 px-2 text-right">渗透率</th>
                  </tr></thead>
                  <tbody>
                    {provinceStats.slice(0, 20).map((p, i) => (
                      <tr key={p.name} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50`}>
                        <td className="py-1.5 px-2 font-medium">{p.name}</td>
                        <td className="py-1.5 px-2 text-right">{hasBuyerData ? p.buyers : '--'}</td>
                        <td className="py-1.5 px-2 text-right">{p.count.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right">{hasBuyerData ? p.avgBuyerOrder.toFixed(1) : '--'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-pdd-primary-light font-medium">¥{p.revenue.toFixed(0)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">¥{p.avgOrder.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right">{hasBuyerData ? ((p.buyers / totalBuyers) * 100).toFixed(1) : '--'}%</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </div>
            {/* 城市渗透率 */}
            {cityTop20.length > 0 && (
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">城市买家分布 TOP15({rangeLabel})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-1.5 px-2 text-left w-6">#</th><th className="py-1.5 px-2 text-left">城市</th><th className="py-1.5 px-2 text-right">买家数</th><th className="py-1.5 px-2 text-right">订单数</th><th className="py-1.5 px-2 text-right">人均订单</th><th className="py-1.5 px-2 text-right">GMV</th>
                  </tr></thead>
                  <tbody>
                    {cityTop20.slice(0, 15).map((c, i) => (
                      <tr key={c.label} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50`}>
                        <td className="py-1.5 px-2 text-[var(--pdd-text-muted)]">{i + 1}</td>
                        <td className="py-1.5 px-2 font-medium">{c.label}</td>
                        <td className="py-1.5 px-2 text-right">{c.buyers}</td>
                        <td className="py-1.5 px-2 text-right">{c.count.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right">{c.buyers > 0 ? (c.count / c.buyers).toFixed(1) : '0'}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">¥{c.revenue.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ======== Tab 3: 物流 ======== */}
        {activeTab === 'logistics' && (
          <motion.div key="logistics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Truck size={14} color="var(--pdd-danger)" />省份平均发货时长 TOP10({rangeLabel})</h3>
                {logisticsByProvince.length === 0 ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">未识别到发货时间数据</div> : (
                  <ResponsiveContainer width="100%" height={220}><BarChart data={logisticsByProvince.slice(0, 10)} layout="vertical" margin={{ left: 50 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis type="number" tick={{ fontSize: 10 }} unit="h" /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} /><Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, '平均时长']} /><Bar dataKey="avgHours" fill="var(--pdd-danger)" radius={[0, 4, 4, 0]} barSize={14} /></BarChart></ResponsiveContainer>
                )}
              </div>
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">偏远地区物流分析({rangeLabel})</h3>
                {noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">暂无数据</div> : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-[var(--pdd-bg)]"><div className="text-[10px] text-[var(--pdd-text-secondary)]">偏远订单数</div><div className="text-sm font-bold text-[var(--pdd-warning)]">{remoteStats.count}单</div></div>
                      <div className="p-2 rounded bg-[var(--pdd-bg)]"><div className="text-[10px] text-[var(--pdd-text-secondary)]">偏远占比</div><div className="text-sm font-bold text-[var(--pdd-warning)]">{remoteStats.rate.toFixed(1)}%</div></div>
                      <div className="p-2 rounded bg-[var(--pdd-bg)]"><div className="text-[10px] text-[var(--pdd-text-secondary)]">偏远GMV</div><div className="text-sm font-bold">¥{remoteStats.revenue.toFixed(0)}</div></div>
                      <div className="p-2 rounded bg-[var(--pdd-bg)]"><div className="text-[10px] text-[var(--pdd-text-secondary)]">偏远邮费合计</div><div className="text-sm font-bold">¥{remoteStats.shipping.toFixed(0)}</div></div>
                      <div className="p-2 rounded bg-[var(--pdd-bg)]"><div className="text-[10px] text-[var(--pdd-text-secondary)]">平均邮费/单</div><div className="text-sm font-bold">¥{remoteStats.avgShipping.toFixed(2)}</div></div>
                      <div className="p-2 rounded bg-[var(--pdd-bg)]"><div className="text-[10px] text-[var(--pdd-text-secondary)]">偏远实付</div><div className="text-sm font-bold">¥{remoteStats.paid.toFixed(0)}</div></div>
                    </div>
                    <div className="text-xs font-medium mt-2 text-[var(--pdd-text-secondary)]">偏远省份明细</div>
                    {remoteStats.byProv.length > 0 ? remoteStats.byProv.map(([prov, count]) => (
                      <div key={prov} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[var(--pdd-bg)]"><span>{prov}</span><span className="font-mono">{count}单</span></div>
                    )) : <div className="text-xs text-[var(--pdd-text-muted)]">当前范围内无偏远省份订单</div>}
                  </div>
                )}
              </div>
            </div>
            {/* 物流时效详细表 */}
            <div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2">全部省份物流时效明细({rangeLabel})</h3>
              {logisticsByProvince.length === 0 ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-8">未识别到发货时间数据（CSV中缺少"发货时间"字段）</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-1.5 px-2 text-left">省份</th><th className="py-1.5 px-2 text-right">发货订单</th><th className="py-1.5 px-2 text-right">平均时长</th><th className="py-1.5 px-2 text-right">中位数</th><th className="py-1.5 px-2 text-right">P90</th><th className="py-1.5 px-2 text-right">最大时长</th><th className="py-1.5 px-2 text-center">区域</th>
                  </tr></thead>
                  <tbody>
                    {logisticsByProvince.map((d, i) => (
                      <tr key={d.name} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50`}>
                        <td className="py-1.5 px-2 font-medium">{d.name}</td>
                        <td className="py-1.5 px-2 text-right">{d.count}</td>
                        <td className="py-1.5 px-2 text-right font-medium tabular-nums">{d.avgHours.toFixed(1)}h</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{d.medianHours.toFixed(1)}h</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{d.p90Hours.toFixed(1)}h</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{d.maxHours.toFixed(1)}h</td>
                        <td className="py-1.5 px-2 text-center">{d.area === '偏远地区' ? <span className="text-[10px] bg-[var(--pdd-warning)]/10 text-[var(--pdd-warning)] px-1.5 py-0.5 rounded">偏远</span> : <span className="text-[10px] text-[var(--pdd-text-muted)]">普通</span>}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </div>
            {/* 城市物流时效 */}
            {cityLogistics.length > 0 && (
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2">城市物流时效 TOP15({rangeLabel})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-1.5 px-2 text-left w-6">#</th><th className="py-1.5 px-2 text-left">城市</th><th className="py-1.5 px-2 text-right">发货订单</th><th className="py-1.5 px-2 text-right">平均时长</th><th className="py-1.5 px-2 text-left">省份</th>
                  </tr></thead>
                  <tbody>
                    {cityLogistics.slice(0, 15).map((d, i) => (
                      <tr key={d.label} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50`}>
                        <td className="py-1.5 px-2 text-[var(--pdd-text-muted)]">{i + 1}</td>
                        <td className="py-1.5 px-2 font-medium">{d.label}</td>
                        <td className="py-1.5 px-2 text-right">{d.count}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{d.avgHours.toFixed(1)}h</td>
                        <td className="py-1.5 px-2 text-[var(--pdd-text-muted)]">{d.prov}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ======== Tab 4: 增长 ======== */}
        {activeTab === 'growth' && (
          <motion.div key="growth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingUp size={14} color="var(--pdd-danger)" />TOP5省份每日趋势({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div> : (
                  <ResponsiveContainer width="100%" height={220}><LineChart data={growthTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />{provinceStats.slice(0, 5).map((p, i) => <Line key={p.name} type="monotone" dataKey={p.name} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 2 }} />)}</LineChart></ResponsiveContainer>
                )}
              </div>
              <div className="pdd-card p-3">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><TrendingUp size={14} color="var(--pdd-primary)" />TOP5省份周趋势({rangeLabel})</h3>
                {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div> : (
                  <ResponsiveContainer width="100%" height={220}><LineChart data={weekTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />{provinceStats.slice(0, 5).map((p, i) => <Line key={p.name} type="monotone" dataKey={p.name} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer>
                )}
              </div>
            </div>
            {/* 增长潜力分析表 */}
            <div className="pdd-card p-3">
              <h3 className="text-sm font-semibold mb-2">省份增长分析({rangeLabel})</h3>
              {noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-8">暂无数据</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-1.5 px-2 text-left">省份</th><th className="py-1.5 px-2 text-right">订单量</th><th className="py-1.5 px-2 text-right">GMV</th><th className="py-1.5 px-2 text-right">买家数</th><th className="py-1.5 px-2 text-right">客单价</th>
                    {compareEnabled && compareProvinceStats && <th className="py-1.5 px-2 text-right">环比变化</th>}
                    <th className="py-1.5 px-2 text-right">潜力评级</th>
                  </tr></thead>
                  <tbody>
                    {provinceStats.map((p, i) => {
                      const prev = compareEnabled && compareProvinceStats ? compareProvinceStats[p.name] : null;
                      const growthPct = prev ? changePct(p.count, prev.count) : null;
                      // 潜力评级：基于订单量+增长率综合
                      let rating: string; let ratingColor: string;
                      if (p.count > 100 || (growthPct != null && growthPct > 20)) { rating = '高潜力'; ratingColor = 'text-[var(--pdd-success)] bg-[var(--pdd-success)]/10'; }
                      else if (p.count > 50 || (growthPct != null && growthPct > 0)) { rating = '中等'; ratingColor = 'text-[var(--pdd-warning)] bg-[var(--pdd-warning)]/10'; }
                      else if (growthPct != null && growthPct < -10) { rating = '下滑'; ratingColor = 'text-[var(--pdd-danger)] bg-[var(--pdd-danger)]/10'; }
                      else { rating = '待观察'; ratingColor = 'text-[var(--pdd-text-secondary)] bg-[var(--pdd-bg)]'; }
                      return (
                        <tr key={p.name} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50`}>
                          <td className="py-1.5 px-2 font-medium">{p.name}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{p.count.toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-pdd-primary-light font-medium">¥{p.revenue.toFixed(0)}</td>
                          <td className="py-1.5 px-2 text-right">{p.buyers}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">¥{p.avgOrder.toFixed(2)}</td>
                          {compareEnabled && compareProvinceStats && (
                            <td className="py-1.5 px-2 text-right">
                              {growthPct != null ? (
                                <span className={`inline-flex items-center gap-0.5 ${growthPct > 0 ? 'text-[var(--pdd-success)]' : growthPct < 0 ? 'text-[var(--pdd-danger)]' : 'text-[var(--pdd-text-muted)]'}`}>
                                  {growthPct > 0 ? <ArrowUp size={10} /> : growthPct < 0 ? <ArrowDown size={10} /> : null}
                                  {growthPct === 0 ? '--' : Math.abs(growthPct).toFixed(1) + '%'}
                                </span>
                              ) : <span className="text-[var(--pdd-text-muted)]">--</span>}
                            </td>
                          )}
                          <td className="py-1.5 px-2 text-right"><span className={`px-1.5 py-0.5 rounded text-[10px] ${ratingColor}`}>{rating}</span></td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
