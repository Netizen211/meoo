import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertTriangle, RotateCcw, Truck, Star, Package, TrendingUp, Lock, Crown, Shield } from 'lucide-react';
import { useData, useAuth } from '../App';
import { sf, ss, findField } from '../utils';
import TimeFilter, { useTimeFilter, TimeRange, TimeGranularity, filterByTimeRange, getAllDateGroups, filterPromoByTimeRange } from '../components/TimeFilter';

const COLORS = ['var(--pdd-danger)', 'var(--pdd-warning)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-purple)', 'var(--pdd-danger)', 'var(--pdd-cyan)'];

export default function RiskPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => ss(findField(o, '订单状态')) !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange), [orders, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredAfterSaleRecords = useMemo(() => {
    const records = filterPromoByTimeRange(currentDisplayData?.afterSaleRecords || [], allDates, timeRange, ['申请时间'], customStart, customEnd, quickRange);
    const orderIds = new Set(filteredOrders.map(o => String(findField(o, '订单号') || '').trim()).filter(Boolean));
    return records.filter((r: any) => {
      const oid = String(findField(r, '订单编号') || '').trim();
      return !oid || orderIds.has(oid);
    });
  }, [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange, filteredOrders]);

  const noData = !filteredOrders.length;

  const productRisk = useMemo(() => {
    if (!filteredOrders.length) return [];
    const map: Record<string, { name: string; orders: number; afterSale: number; refund: number; overdue: number }> = {};
    filteredOrders.forEach((o: any) => {
      const key = ss(findField(o, '商品id', '商品'));
      if (!key) return;
      if (!map[key]) map[key] = { name: ss(findField(o, '商品', '商品名称')).slice(0, 20), orders: 0, afterSale: 0, refund: 0, overdue: 0 };
      map[key].orders++;
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      if (payT && shipT) {
        const h = (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000;
        if (h > 48) map[key].overdue++;
      }
    });
    if (filteredAfterSaleRecords.length > 0) {
      filteredAfterSaleRecords.forEach((r: any) => {
        const pid = ss(findField(r, '商品ID'));
        if (!pid) return;
        if (!map[pid]) map[pid] = { name: ss(findField(r, 'sku信息')).slice(0, 20) || pid, orders: 0, afterSale: 0, refund: 0, overdue: 0 };
        map[pid].afterSale++;
        if (String(findField(r, '售后状态') || '').includes('退款')) map[pid].refund++;
      });
    } else {
      filteredOrders.forEach((o: any) => {
        const key = ss(findField(o, '商品id', '商品'));
        if (!key || !map[key]) return;
        const as = ss(findField(o, '售后状态'));
        if (as && as !== '无售后或售后取消' && as !== '无') map[key].afterSale++;
        if (as.includes('退款')) map[key].refund++;
      });
    }
    return Object.entries(map).map(([id, d]) => ({
      id, name: d.name,
      afterSaleRate: d.orders > 0 ? (d.afterSale / d.orders) * 100 : 0,
      refundRate: d.orders > 0 ? (d.refund / d.orders) * 100 : 0,
      overdueRate: d.orders > 0 ? (d.overdue / d.orders) * 100 : 0,
      orders: d.orders,
      riskLevel: (d.orders > 0 ? (d.afterSale / d.orders) * 100 : 0) > 30 ? '高' : (d.orders > 0 ? (d.afterSale / d.orders) * 100 : 0) > 15 ? '中' : '低',
    })).sort((a, b) => b.afterSaleRate - a.afterSaleRate);
  }, [filteredOrders, filteredAfterSaleRecords]);

  const highAfterSale = productRisk.filter(p => p.afterSaleRate > 30).length;
  const overdueOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      if (!payT || !shipT) return false;
      return (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48;
    }).length;
  }, [filteredOrders]);

  const zeroSales = useMemo(() => {
    const salesMap: Record<string, number> = {};
    filteredOrders.forEach((o: any) => { const id = ss(findField(o, '商品id')); salesMap[id] = (salesMap[id] || 0) + sf(findField(o, '商品数量(件)', '商品数量')); });
    return Object.values(salesMap).filter(v => v <= 0).length;
  }, [filteredOrders]);

  const riskScore = useMemo(() => {
    if (!filteredOrders.length) return 0;
    const asRate = filteredOrders.filter(o => { const s = ss(findField(o, '售后状态')); return s && s !== '无售后或售后取消' && s !== '无'; }).length / filteredOrders.length * 100;
    const rfRate = filteredOrders.filter(o => ss(findField(o, '售后状态')).includes('退款')).length / filteredOrders.length * 100;
    const ovRate = overdueOrders / filteredOrders.length * 100;
    return Math.min(100, asRate * 1.5 + rfRate * 2 + ovRate * 1.2);
  }, [filteredOrders, overdueOrders]);

  const riskTypePie = useMemo(() => [
    { name: '售后风险', value: highAfterSale },
    { name: '物流超时', value: overdueOrders },
    { name: '退款异常', value: filteredOrders.filter(o => ss(findField(o, '售后状态')).includes('退款')).length },
    { name: '动销风险', value: zeroSales },
  ], [highAfterSale, overdueOrders, filteredOrders, zeroSales]);

  const trendData = useMemo(() => {
    if (!filteredOrders.length) return [];
    const byDate: Record<string, { total: number; as: number; rf: number; ov: number }> = {};
    filteredOrders.forEach((o: any) => {
      const d = ss(findField(o, '支付时间')).split(' ')[0];
      if (!d) return;
      if (!byDate[d]) byDate[d] = { total: 0, as: 0, rf: 0, ov: 0 };
      byDate[d].total++;
      const s = ss(findField(o, '售后状态'));
      if (s && s !== '无售后或售后取消' && s !== '无') byDate[d].as++;
      if (s.includes('退款')) byDate[d].rf++;
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      if (payT && shipT && (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48) byDate[d].ov++;
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-7).map(([d, v]) => ({
      date: d.slice(5),
      asRate: v.total > 0 ? (v.as / v.total) * 100 : 0,
      rfRate: v.total > 0 ? (v.rf / v.total) * 100 : 0,
      ovRate: v.total > 0 ? (v.ov / v.total) * 100 : 0,
    }));
  }, [filteredOrders]);

  const abnormalOrders = useMemo(() => {
    return filteredOrders.filter((o: any) => {
      const s = ss(findField(o, '售后状态'));
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      const isRefundAbnormal = s.includes('退款');
      const isOverdue = payT && shipT && (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48;
      const isHighDisc = (sf(findField(o, '店铺优惠折扣(元)', '店铺优惠')) + sf(findField(o, '平台优惠折扣(元)', '平台优惠')) + sf(findField(o, '多多支付立减金额(元)', '支付立减'))) / sf(findField(o, '商品总价(元)', '商品总价')) > 0.2;
      return isRefundAbnormal || isOverdue || isHighDisc;
    }).slice(0, 20).map((o: any) => {
      const s = ss(findField(o, '售后状态'));
      const payT = ss(findField(o, '支付时间'));
      const shipT = ss(findField(o, '发货时间'));
      const types: string[] = [];
      if (s.includes('退款')) types.push('退款异常');
      if (payT && shipT && (new Date(shipT).getTime() - new Date(payT).getTime()) / 3600000 > 48) types.push('发货超时');
      if ((sf(findField(o, '店铺优惠折扣(元)', '店铺优惠')) + sf(findField(o, '平台优惠折扣(元)', '平台优惠')) + sf(findField(o, '多多支付立减金额(元)', '支付立减'))) / sf(findField(o, '商品总价(元)', '商品总价')) > 0.2) types.push('高优惠');
      return { id: ss(findField(o, '订单号')).slice(-8), product: ss(findField(o, '商品', '商品名称')).slice(0, 18), type: types.join('/'), amount: sf(findField(o, '用户实付金额(元)', '用户实付')), time: ss(findField(o, '支付时间')).slice(0, 16) };
    });
  }, [filteredOrders]);

  const rules = useMemo(() => {
    if (!filteredOrders.length) return [];
    const asRate = filteredOrders.filter(o => { const s = ss(findField(o, '售后状态')); return s && s !== '无售后或售后取消' && s !== '无'; }).length / filteredOrders.length * 100;
    const rfRate = filteredOrders.filter(o => ss(findField(o, '售后状态')).includes('退款')).length / filteredOrders.length * 100;
    const ship48Rate = (() => {
      const shipped = filteredOrders.filter(o => ss(findField(o, '发货时间')) !== '');
      const in48 = shipped.filter(o => (new Date(ss(findField(o, '发货时间'))).getTime() - new Date(ss(findField(o, '支付时间'))).getTime()) / 3600000 <= 48);
      return shipped.length > 0 ? (in48.length / shipped.length) * 100 : 100;
    })();
    const zeroRate = (() => {
      const salesMap: Record<string, number> = {};
      filteredOrders.forEach(o => { const id = ss(findField(o, '商品id')); salesMap[id] = (salesMap[id] || 0) + sf(findField(o, '商品数量(件)', '商品数量')); });
      const total = Object.keys(salesMap).length;
      const zero = Object.values(salesMap).filter(v => v <= 0).length;
      return total > 0 ? (zero / total) * 100 : 0;
    })();
    return [
      { name: '售后率>30%', value: asRate, status: asRate > 30 ? '危险' : asRate > 15 ? '预警' : '正常' },
      { name: '48h发货率<90%', value: ship48Rate, status: ship48Rate < 90 ? '危险' : ship48Rate < 95 ? '预警' : '正常' },
      { name: '退款率>15%', value: rfRate, status: rfRate > 15 ? '危险' : rfRate > 8 ? '预警' : '正常' },
      { name: '零动销>20%', value: zeroRate, status: zeroRate > 20 ? '危险' : zeroRate > 10 ? '预警' : '正常' },
    ];
  }, [filteredOrders]);

  const kpis = [
    { label: '高售后率商品', value: highAfterSale, icon: AlertTriangle, color: 'var(--pdd-danger)' },
    { label: '超时发货订单', value: overdueOrders, icon: Truck, color: 'var(--pdd-warning)' },
    { label: '异常订单数', value: abnormalOrders.length, icon: RotateCcw, color: 'var(--pdd-danger)' },
    { label: '零动销商品', value: zeroSales, icon: Package, color: '#8c8c8c' },
    { label: '风险评分', value: riskScore.toFixed(0), icon: Shield, color: riskScore > 60 ? 'var(--pdd-danger)' : riskScore > 30 ? 'var(--pdd-warning)' : 'var(--pdd-success)' },
  ];

  const badgeColor = (level: string) => level === '高' ? 'bg-pdd-danger/10 text-red-700' : level === '中' ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-success/10 text-green-700';
  const statusColor = (status: string) => status === '危险' ? 'var(--pdd-danger)' : status === '预警' ? 'var(--pdd-warning)' : 'var(--pdd-success)';

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tf} />
      <div className="grid grid-cols-5 gap-2">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="pdd-card px-3 py-2.5 flex items-center gap-2">
            <k.icon size={16} color={k.color} />
            <div>
              <span className="text-xs text-[var(--pdd-text-secondary)]">{k.label}</span>
              <span className="text-sm font-bold" style={{ color: k.color }}>{noData ? '--' : k.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">风险类型分布</h3>
          {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart><Pie data={riskTypePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}:${value}`} labelLine={{ strokeWidth: 1 }} fontSize={10}>
                {riskTypePie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">高风险商品</h3>
          {noData ? <div className="text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
            <div className="overflow-auto" style={{ maxHeight: 180 }}>
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                  <th className="py-1.5 text-left">商品</th><th className="py-1.5 text-right">售后率</th><th className="py-1.5 text-right">退款率</th><th className="py-1.5 text-right">超时率</th><th className="py-1.5 text-center">风险</th>
                </tr></thead>
                <tbody>{productRisk.filter(p => p.afterSaleRate > 10).slice(0, 10).map((p, i) => (
                  <tr key={p.id} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                    <td className="py-1.5 truncate max-w-[100px]">{p.name}</td>
                    <td className="py-1.5 text-right font-mono" style={{ color: p.afterSaleRate > 30 ? 'var(--pdd-primary-light)' : 'var(--pdd-text)' }}>{p.afterSaleRate.toFixed(1)}%</td>
                    <td className="py-1.5 text-right font-mono">{p.refundRate.toFixed(1)}%</td>
                    <td className="py-1.5 text-right font-mono">{p.overdueRate.toFixed(1)}%</td>
                    <td className="py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded ${badgeColor(p.riskLevel)}`}>{p.riskLevel}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2">风险趋势(近7日)</h3>
        {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传数据</div> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip /><Line type="monotone" dataKey="asRate" stroke="var(--pdd-warning)" strokeWidth={2} name="售后率" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rfRate" stroke="var(--pdd-primary-light)" strokeWidth={2} name="退款率" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ovRate" stroke="var(--pdd-primary)" strokeWidth={2} name="超时率" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2">异常订单检测({abnormalOrders.length}条)</h3>
        {noData || !abnormalOrders.length ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">无异常订单</div> : (
          <table className="w-full text-xs">
            <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
              <th className="py-1.5 text-left">订单号</th><th className="py-1.5 text-left">商品</th><th className="py-1.5 text-left">异常类型</th><th className="py-1.5 text-right">金额</th><th className="py-1.5 text-left">时间</th>
            </tr></thead>
            <tbody>{abnormalOrders.map((o, i) => (
              <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                <td className="py-1.5 font-mono">{o.id}</td>
                <td className="py-1.5 truncate max-w-[100px]">{o.product}</td>
                <td className="py-1.5"><span className="px-1.5 py-0.5 rounded bg-pdd-danger/10 text-red-700">{o.type}</span></td>
                <td className="py-1.5 text-right">¥{o.amount.toFixed(0)}</td>
                <td className="py-1.5">{o.time}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2">风险预警规则</h3>
        {noData ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">请先上传数据</div> : (
          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded border border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                <span className="text-xs font-medium">{r.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono">{typeof r.value === 'number' ? r.value.toFixed(1) : r.value}%</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === '危险' ? 'bg-pdd-danger/10 text-red-700' : r.status === '预警' ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-success/10 text-green-700'}`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="pdd-card p-3 relative">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">AI风险分析 {!isPaid && <Lock size={12} className="text-[var(--pdd-warning)]" />}</h3>
        {!isPaid ? (
          <div className="h-32 flex items-center justify-center bg-[rgba(248,250,252,0.8)] rounded">
            <div className="text-center"><Crown size={24} color="var(--pdd-danger)" className="mx-auto mb-1" /><p className="text-xs text-[var(--pdd-text-secondary)]">升级企业版解锁AI风险分析</p></div>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">AI风险分析功能开发中</div>
        )}
      </motion.div>
    </div>
  );
}