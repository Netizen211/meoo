import React, { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine, ComposedChart, Area } from 'recharts';
import { Truck, Clock, CheckCircle, AlertTriangle, Package, Lock, ArrowUp, ArrowDown, MapPin, TrendingUp, DollarSign, Filter, Download, ChevronDown, BarChart3 as BarChartIcon } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { useTimeFilter, TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct } from '../components/TimeFilter';
import { UnifiedFilterBar } from '../components/FilterToolbar';
import { ss, hoursDiff, exportCSV, findField } from '../utils';
import { CHART_COLORS } from '../ui';

const COLORS = CHART_COLORS;

export default function LogisticsPage() {
 const { currentDisplayData } = useData();
 const { isPaid } = useAuth();
 const tf = useTimeFilter('7', 'day');
 const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;
 const [selectedCourier, setSelectedCourier] = useState<string>('all');
 const [showOverdueOnly, setShowOverdueOnly] = useState(false);

 const orders = currentDisplayData?.orders || [];
 const noData = !orders.length;

 const validOrders = useMemo(() => orders.filter((o: any) => ss(findField(o, '订单状态')) !== '已取消'), [orders]);
 const allDates = useMemo(() => getAllDateGroups(validOrders), [validOrders]);
 const filteredOrders = useMemo(() => filterByTimeRange(validOrders, allDates, timeRange, customStart, customEnd, quickRange), [validOrders, allDates, timeRange, customStart, customEnd, quickRange]);
 const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(validOrders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange) : [], [validOrders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange, compareEnabled]);

 const shippedOrders = useMemo(() => filteredOrders.filter((o: any) => ss(findField(o, '发货时间')) !== ''), [filteredOrders]);
 const pendingOrders = useMemo(() => filteredOrders.filter((o: any) => ss(findField(o, '发货时间')) === '' && ss(findField(o, '订单状态')) !== '已取消'), [filteredOrders]);
 const compareShipped = useMemo(() => compareOrders.filter((o: any) => ss(findField(o, '发货时间')) !== ''), [compareOrders]);

 const shipHours = useMemo(() => shippedOrders.map((o: any) => hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')))).filter(h => h >= 0), [shippedOrders]);
 const compareShipHours = useMemo(() => compareShipped.map((o: any) => hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')))).filter(h => h >= 0), [compareShipped]);

 const avgShipH = useMemo(() => shipHours.length ? shipHours.reduce((a, b) => a + b, 0) / shipHours.length : 0, [shipHours]);
 const rate48 = useMemo(() => shipHours.length ? shipHours.filter(h => h <= 48).length / shipHours.length * 100 : 0, [shipHours]);
 const rate72 = useMemo(() => shipHours.length ? shipHours.filter(h => h <= 72).length / shipHours.length * 100 : 0, [shipHours]);
 const overdueCount = useMemo(() => shipHours.filter(h => h > 48).length, [shipHours]);

 const compareAvgH = useMemo(() => compareShipHours.length ? compareShipHours.reduce((a, b) => a + b, 0) / compareShipHours.length : 0, [compareShipHours]);
 const compareRate48 = useMemo(() => compareShipHours.length ? compareShipHours.filter(h => h <= 48).length / compareShipHours.length * 100 : 0, [compareShipHours]);

 const durationDist = useMemo(() => {
 const bins = [{ label: '0-6h', min: 0, max: 6, color: COLORS[1] }, { label: '6-12h', min: 6, max: 12, color: COLORS[0] }, { label: '12-24h', min: 12, max: 24, color: COLORS[2] }, { label: '24-48h', min: 24, max: 48, color: COLORS[5] }, { label: '48-72h', min: 48, max: 72, color: COLORS[4] }, { label: '72h+', min: 72, max: Infinity, color: COLORS[6] }];
 return bins.map(b => ({ ...b, count: shipHours.filter(h => h >= b.min && h < b.max).length }));
 }, [shipHours]);

 const courierData = useMemo(() => {
 const map: Record<string, { count: number; hours: number[]; postage: number }> = {};
 shippedOrders.forEach((o: any) => {
 const c = ss(findField(o, '快递公司'));
 if (!c) return;
 if (!map[c]) map[c] = { count: 0, hours: [], postage: 0 };
 map[c].count++;
 const h = hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')));
 if (h >= 0) map[c].hours.push(h);
 map[c].postage += safeFloat(findField(o, '邮费(元)', '邮费'));
 });
 return Object.entries(map).sort((a, b) => b[1].count - a[1].count).map(([name, d], i) => ({
 name, count: d.count, pct: shippedOrders.length ? (d.count / shippedOrders.length * 100).toFixed(1) : '0',
 avgH: d.hours.length ? (d.hours.reduce((a, b) => a + b, 0) / d.hours.length).toFixed(1) : '--',
 rate48: d.hours.length ? (d.hours.filter(h => h <= 48).length / d.hours.length * 100).toFixed(1) : '0',
 postage: d.postage, color: COLORS[i % COLORS.length]
 }));
 }, [shippedOrders]);

 const courierCompareData = useMemo(() => {
 if (!compareEnabled) return [];
 const map: Record<string, { hours: number[] }> = {};
 compareShipped.forEach((o: any) => {
 const c = ss(findField(o, '快递公司'));
 if (!c) return;
 if (!map[c]) map[c] = { hours: [] };
 const h = hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')));
 if (h >= 0) map[c].hours.push(h);
 });
 return Object.entries(map).map(([name, d]) => ({ name, prevAvgH: d.hours.length ? (d.hours.reduce((a, b) => a + b, 0) / d.hours.length).toFixed(1) : '--' }));
 }, [compareShipped, compareEnabled]);

 const mergedCourierData = useMemo(() => {
 if (!compareEnabled) return courierData;
 return courierData.map(c => ({ ...c, prevAvgH: courierCompareData.find(p => p.name === c.name)?.prevAvgH || '--' })) as Array<typeof courierData[0] & { prevAvgH: string }>;
 }, [courierData, courierCompareData, compareEnabled]);

 const dailyTrend = useMemo(() => {
 const map: Record<string, { total: number; overdue: number }> = {};
 shippedOrders.forEach((o: any) => {
 const d = ss(findField(o, '支付时间')).split(' ')[0];
 if (!d) return;
 const h = hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')));
 if (!map[d]) map[d] = { total: 0, overdue: 0 };
 map[d].total++;
 if (h > 48) map[d].overdue++;
 });
 return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-parseInt(timeRange)).map(([date, v]) => ({ date: date.slice(5), avgH: 0, overdueRate: v.total > 0 ? (v.overdue / v.total) * 100 : 0 }));
 }, [shippedOrders, timeRange]);

 const provinceData = useMemo(() => {
 const map: Record<string, { hours: number[]; postage: number; count: number }> = {};
 shippedOrders.forEach((o: any) => {
 const p = ss(findField(o, '省', '省份'));
 if (!p) return;
 if (!map[p]) map[p] = { hours: [], postage: 0, count: 0 };
 const h = hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')));
 if (h >= 0) map[p].hours.push(h);
 map[p].postage += safeFloat(findField(o, '邮费(元)', '邮费'));
 map[p].count++;
 });
 return Object.entries(map).sort((a, b) => (b[1].hours.reduce((s, v) => s + v, 0) / b[1].hours.length) - (a[1].hours.reduce((s, v) => s + v, 0) / a[1].hours.length)).slice(0, 10).map(([name, d]) => ({
 name, avgH: +(d.hours.reduce((a, b) => a + b, 0) / d.hours.length).toFixed(1), postage: d.postage, count: d.count
 }));
 }, [shippedOrders]);

 const pendingList = useMemo(() => {
 const now = new Date();
 return pendingOrders.map((o: any) => {
 const promiseTime = ss(findField(o, '承诺发货时间'));
 const remain = promiseTime ? (new Date(promiseTime).getTime() - now.getTime()) / 3600000 : null;
 return { id: ss(findField(o, '订单号')), product: ss(findField(o, '商品', '商品名称', '商品名')).slice(0, 20), payTime: ss(findField(o, '支付时间')).slice(0, 16), promiseTime: promiseTime.slice(0, 16), remain, province: ss(findField(o, '省', '省份')) };
 }).filter(p => !showOverdueOnly || (p.remain != null && p.remain < 6)).sort((a, b) => (a.remain ?? 999) - (b.remain ?? 999)).slice(0, 20);
 }, [pendingOrders, showOverdueOnly]);

 const overdueOrders = useMemo(() => {
 return shippedOrders.filter((o: any) => {
 const h = hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间')));
 return h > 48;
 }).map((o: any) => ({ id: ss(findField(o, '订单号')), product: ss(findField(o, '商品', '商品名称', '商品名')).slice(0, 20), hours: hoursDiff(ss(findField(o, '发货时间')), ss(findField(o, '支付时间'))).toFixed(1), courier: ss(findField(o, '快递公司')) || '未知', province: ss(findField(o, '省', '省份')) })).slice(0, 15);
 }, [shippedOrders]);

 const logisticsCost = useMemo(() => {
 const totalPostage = shippedOrders.reduce((s, o) => s + safeFloat(findField(o, '邮费(元)', '邮费')), 0);
 const avgPostage = shippedOrders.length > 0 ? totalPostage / shippedOrders.length : 0;
 const freeShipCount = shippedOrders.filter(o => safeFloat(findField(o, '邮费(元)', '邮费')) === 0).length;
 const freeShipRate = shippedOrders.length > 0 ? (freeShipCount / shippedOrders.length) * 100 : 0;
 return { totalPostage, avgPostage, freeShipRate };
 }, [shippedOrders]);

 const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

 const kpis = [
 { label: '平均发货时长', value: avgShipH, fmt: `${avgShipH.toFixed(1)}h`, icon: Clock, change: compareEnabled ? changePct(avgShipH, compareAvgH) : null },
 { label: '48h发货率', value: rate48, fmt: `${rate48.toFixed(1)}%`, icon: CheckCircle, change: compareEnabled ? changePct(rate48, compareRate48) : null },
 { label: '72h发货率', value: rate72, fmt: `${rate72.toFixed(1)}%`, icon: CheckCircle, change: null },
 { label: '已发货', value: shippedOrders.length, fmt: `${shippedOrders.length}`, icon: Truck, change: compareEnabled ? changePct(shippedOrders.length, compareShipped.length) : null },
 { label: '待发货', value: pendingOrders.length, fmt: `${pendingOrders.length}`, icon: Package, change: null },
 { label: '超时发货', value: overdueCount, fmt: `${overdueCount}`, icon: AlertTriangle, change: null },
 ];

 return (
 <div className="p-4 lg:p-6 space-y-4">
 <UnifiedFilterBar timeFilter={tf} />

 <div className="grid grid-cols-6 gap-3">
 {kpis.map((k, i) => (
 <div key={k.label} className="pdd-card px-4 py-3 flex items-center gap-3">
 <k.icon size={16} className="text-pdd-text-secondary" />
 <div className="flex-1 min-w-0">
 <p className="text-[11px] font-medium text-pdd-text-secondary">{k.label}</p>
 <div className="flex items-center gap-1.5">
 <p className="text-lg font-bold text-pdd-text">{noData ? '--' : k.fmt}</p>
 {k.change != null && Math.abs(k.change) > 0.01 && (
 <span className={`text-xs font-medium ${k.change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
 {k.change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(k.change).toFixed(1)}%
 </span>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div className="pdd-card">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><BarChartIcon size={13} className="text-pdd-text-secondary" />发货时效分布({rangeLabel})</h4>
 {noData ? <div className="h-32 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传数据</div> : (
 <ResponsiveContainer width="100%" height={180}><BarChart data={durationDist}><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--pdd-text-secondary)" }} /><YAxis tick={{ fontSize: 11, fill: "var(--pdd-text-secondary)" }} /><Tooltip formatter={(v: number) => [v, '订单数']} /><Bar dataKey="count">{durationDist.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar></BarChart></ResponsiveContainer>
 )}
 </div>

 <div className="pdd-card">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><DollarSign size={13} className="text-pdd-text-secondary" />物流成本分析({rangeLabel})</h4>
 {noData ? <div className="h-32 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传数据</div> : (
 <div className="space-y-3 py-2">
 <div className="flex items-center justify-between"><span className="text-xs text-pdd-text-secondary">总邮费</span><span className="text-2xl font-bold text-pdd-text tabular-nums">¥{logisticsCost.totalPostage.toFixed(0)}</span></div>
 <div className="flex items-center justify-between"><span className="text-xs text-pdd-text-secondary">平均邮费</span><span className="text-sm font-medium text-pdd-text tabular-nums">¥{logisticsCost.avgPostage.toFixed(2)}</span></div>
 <div className="flex items-center justify-between"><span className="text-xs text-pdd-text-secondary">免邮率</span><span className="text-sm font-medium text-pdd-text-secondary tabular-nums">{logisticsCost.freeShipRate.toFixed(1)}%</span></div>
 </div>
 )}
 </div>
 </div>

 <div className="pdd-card">
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><Truck size={13} className="text-pdd-text-secondary" />快递公司时效对比({rangeLabel}){compareEnabled && <span className="text-xs text-pdd-text-secondary">+环比</span>}</h4>
 <select value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)} className="text-xs px-2.5 py-1.5 rounded-lg border border-pdd-border/60 bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary/40 transition-colors">
 <option value="all">全部快递</option>
 {courierData.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
 </select>
 </div>
 {noData ? <div className="h-32 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传数据</div> : (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead><tr className="text-pdd-text-secondary bg-pdd-bg/40 border-b border-pdd-border/50">
 <th className="py-2 px-2 text-left text-[11px] font-medium">快递</th><th className="py-2 px-2 text-right text-[11px] font-medium">订单</th><th className="py-2 px-2 text-right text-[11px] font-medium">占比</th><th className="py-2 px-2 text-right text-[11px] font-medium">均时长</th><th className="py-2 px-2 text-right text-[11px] font-medium">48h率</th><th className="py-2 px-2 text-right text-[11px] font-medium">邮费</th>
 {compareEnabled && <th className="py-2 px-2 text-right text-[11px] font-medium">环比时长</th>}
 </tr></thead>
 <tbody>{mergedCourierData.filter(c => selectedCourier === 'all' || c.name === selectedCourier).map(d => (
 <tr key={d.name} className="border-b border-pdd-border/50 hover:bg-pdd-bg/40">
 <td className="py-2 px-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name}</td>
 <td className="py-2 px-2 text-right font-mono tabular-nums">{d.count}</td>
 <td className="py-2 px-2 text-right font-mono tabular-nums text-pdd-text-secondary">{d.pct}%</td>
 <td className="py-2 px-2 text-right font-medium tabular-nums">{d.avgH}h</td>
 <td className="py-2 px-2 text-right font-mono tabular-nums text-pdd-text-secondary">{d.rate48}%</td>
 <td className="py-2 px-2 text-right font-mono tabular-nums">¥{d.postage.toFixed(0)}</td>
 {compareEnabled && <td className="py-2 px-2 text-right text-pdd-text-secondary tabular-nums">{(d as any).prevAvgH}h</td>}
 </tr>
 ))}</tbody>
 </table>
 </div>
 )}
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div className="pdd-card">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><MapPin size={13} className="text-pdd-text-secondary" />省份物流时效TOP10({rangeLabel})</h4>
 {noData ? <div className="h-32 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传数据</div> : (
 <ResponsiveContainer width="100%" height={160}>
 <BarChart data={provinceData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" /><XAxis type="number" tick={{ fontSize: 11, fill: "var(--pdd-text-secondary)" }} unit="h" /><YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "var(--pdd-text-secondary)" }} width={50} /><Tooltip formatter={(v: number) => [`${v}h`, '平均时长']} /><Bar dataKey="avgH" fill="var(--pdd-primary)" radius={[0, 4, 4, 0]} /></BarChart>
 </ResponsiveContainer>
 )}
 </div>

 <div className="pdd-card">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><AlertTriangle size={13} className="text-pdd-text-secondary" />物流异常预警</h4>
 {noData ? <div className="h-32 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传数据</div> : (
 <div className="space-y-2">
 <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg/50"><span className="text-xs">超时订单</span><span className="text-sm font-bold text-pdd-danger">{overdueCount}单</span></div>
 <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg/50"><span className="text-xs">待发货预警(&lt;6h)</span><span className="text-sm font-bold text-pdd-warning">{pendingOrders.filter((o: any) => { const p = ss(findField(o, '承诺发货时间')); return p && (new Date(p).getTime() - Date.now()) / 3600000 < 6; }).length}单</span></div>
 <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg/50"><span className="text-xs">平均邮费偏高</span><span className="text-sm font-bold text-pdd-text">{logisticsCost.avgPostage > 8 ? '是' : '否'}</span></div>
 </div>
 )}
 </div>
 </div>

 <div className="pdd-card">
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><Package size={13} className="text-pdd-text-secondary" />待发货订单（{pendingOrders.length}条）</h4>
 <div className="flex items-center gap-2">
 <button onClick={() => setShowOverdueOnly(!showOverdueOnly)} className={`text-xs px-2.5 py-1.5 rounded-lg ${showOverdueOnly ? 'bg-pdd-danger text-white shadow-sm' : 'border border-pdd-border/60 text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-text'}`}><Filter size={12} className="inline mr-1" />仅看预警</button>
 <button onClick={() => { const headers = ['订单号','商品','省份','支付时间','承诺发货','剩余(h)']; const rows = pendingList.map(p => [p.id, p.product, p.province, p.payTime, p.promiseTime, p.remain != null ? (p.remain < 0 ? '已超时' : p.remain.toFixed(1)) : '--']); exportCSV(headers, rows, '待发货订单'); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-pdd-border/60 bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary/40 transition-colors"><Download size={12} className="inline mr-1" />导出</button>
 </div>
 </div>
 {noData || !pendingList.length ? <div className="py-4 text-center text-xs text-pdd-text-secondary">无待发货订单</div> : (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead><tr className="text-pdd-text-secondary bg-pdd-bg/40 border-b border-pdd-border/50">
 <th className="py-2 px-2 text-left text-[11px] font-medium">订单号</th><th className="py-2 px-2 text-left text-[11px] font-medium">商品</th><th className="py-2 px-2 text-left text-[11px] font-medium">省份</th><th className="py-2 px-2 text-left text-[11px] font-medium">支付时间</th><th className="py-2 px-2 text-left text-[11px] font-medium">承诺发货</th><th className="py-2 px-2 text-right text-[11px] font-medium">剩余(h)</th>
 </tr></thead>
 <tbody>{pendingList.map(p => (
 <tr key={p.id} className={`border-b border-pdd-border/50 hover:bg-pdd-bg/40 ${p.remain != null && p.remain < 6 ? 'text-pdd-danger font-medium bg-pdd-danger/5' : ''}`}>
 <td className="py-2 px-2 font-mono">{p.id.slice(-8)}</td>
 <td className="py-2 px-2 max-w-[100px] truncate">{p.product}</td>
 <td className="py-2 px-2">{p.province}</td>
 <td className="py-2 px-2">{p.payTime}</td>
 <td className="py-2 px-2">{p.promiseTime}</td>
 <td className="py-2 px-2 text-right tabular-nums">{p.remain != null ? (p.remain < 0 ? '已超时' : p.remain.toFixed(1)) : '--'}</td>
 </tr>
 ))}</tbody>
 </table>
 </div>
 )}
 </div>

 <div className="pdd-card">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><AlertTriangle size={13} className="text-pdd-text-secondary" />超时订单追踪({overdueOrders.length}条)</h4>
 {noData || !overdueOrders.length ? <div className="py-4 text-center text-xs text-pdd-text-secondary">无超时订单</div> : (
 <div className="overflow-x-auto">
 <table className="w-full text-xs">
 <thead><tr className="text-pdd-text-secondary bg-pdd-bg/40 border-b border-pdd-border/50">
 <th className="py-2 px-2 text-left text-[11px] font-medium">订单号</th><th className="py-2 px-2 text-left text-[11px] font-medium">商品</th><th className="py-2 px-2 text-left text-[11px] font-medium">快递</th><th className="py-2 px-2 text-left text-[11px] font-medium">省份</th><th className="py-2 px-2 text-right text-[11px] font-medium">超时时长</th>
 </tr></thead>
 <tbody>{overdueOrders.map((o, i) => (
 <tr key={i} className="border-b border-pdd-border/50 hover:bg-pdd-bg/40">
 <td className="py-2 px-2 font-mono">{o.id.slice(-8)}</td>
 <td className="py-2 px-2 max-w-[100px] truncate">{o.product}</td>
 <td className="py-2 px-2">{o.courier}</td>
 <td className="py-2 px-2">{o.province}</td>
 <td className="py-2 px-2 text-right text-pdd-text font-medium tabular-nums">{o.hours}h</td>
 </tr>
 ))}</tbody>
 </table>
 </div>
 )}
 </div>

 <div className="pdd-card relative">
 <h4 className="text-xs font-semibold text-pdd-text-secondary flex items-center gap-1.5 mb-2"><TrendingUp size={13} className="text-pdd-text-secondary" />发货时效预测{!isPaid && <Lock size={12} className="text-pdd-text-secondary" />}</h4>
 {!isPaid ? (
 <div className="h-32 flex items-center justify-center bg-[rgba(248,250,252,0.8)] rounded">
 <div className="text-center"><Lock size={24} className="mx-auto mb-1 text-pdd-text-secondary" /><p className="text-xs text-pdd-text-secondary">升级会员解锁AI预测</p></div>
 </div>
 ) : (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-xs"><span>明日预计平均发货时长</span><span className="font-bold text-pdd-text">{(avgShipH * 0.95).toFixed(1)}h</span></div>
 <div className="flex items-center justify-between text-xs"><span>预计48h发货率</span><span className="font-bold text-pdd-success">{(rate48 * 1.02).toFixed(1)}%</span></div>
 <div className="flex items-center justify-between text-xs"><span>建议优化快递</span><span className="font-medium">{courierData.length > 0 ? courierData.sort((a, b) => parseFloat(b.avgH) - parseFloat(a.avgH))[0]?.name : '--'}</span></div>
 </div>
 )}
 </div>
 </div>
 );
}
