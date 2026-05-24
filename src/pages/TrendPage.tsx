import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Clock, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct } from '../components/TimeFilter';

const COLORS = ['var(--pdd-danger)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-warning)', 'var(--pdd-purple)', '#13c2c2'];

interface KpiData {
  gmv: number;
  cnt: number;
  avg: number;
}

interface CardItem {
  label: string;
  value: number;
  fmt: (v: number) => string;
  color: string;
  change: number;
}

export default function TrendPage() {
  const { currentDisplayData } = useData();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled } as any;

  const orders = currentDisplayData?.orders || [];
  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange), [orders, allDates, timeRange]);
  const compareOrders = useMemo(() => getCompareOrders(orders, allDates, timeRange), [orders, allDates, timeRange]);

  const kpi: KpiData | null = useMemo(() => {
    if (!filteredOrders.length) return null;
    const gmv = filteredOrders.reduce((s, o) => s + safeFloat(o['商家实收金额(元)']), 0);
    const cnt = filteredOrders.length;
    const avg = cnt > 0 ? gmv / cnt : 0;
    return { gmv, cnt, avg };
  }, [filteredOrders]);

  const compareKpi: KpiData | null = useMemo(() => {
    if (!compareOrders.length) return null;
    const gmv = compareOrders.reduce((s, o) => s + safeFloat(o['商家实收金额(元)']), 0);
    const cnt = compareOrders.length;
    const avg = cnt > 0 ? gmv / cnt : 0;
    return { gmv, cnt, avg };
  }, [compareOrders]);

  const noData = !filteredOrders.length;

  const getChangeColor = (): string => {
    if (!compareEnabled || !compareKpi || !kpi) return 'var(--pdd-danger)';
    const change = changePct(kpi.gmv, compareKpi.gmv || 0) ?? 0;
    return change > 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)';
  };

  const getChangeValue = (): number => {
    if (!compareEnabled || !compareKpi || !kpi) return 0;
    return changePct(kpi.gmv, compareKpi.gmv || 0) ?? 0;
  };

  const getChangeForKpi = (current: number, compare: number | undefined): number => {
    if (!compareEnabled || compare === undefined) return 0;
    return changePct(current, compare || 0) ?? 0;
  };

  const cards: CardItem[] = useMemo(() => {
    if (!kpi) return [];
    const changeGmv = getChangeForKpi(kpi.gmv, compareKpi?.gmv);
    const changeCnt = getChangeForKpi(kpi.cnt, compareKpi?.cnt);
    const changeValue = getChangeValue();
    const result: CardItem[] = [
      { label: 'GMV总额', value: kpi.gmv, fmt: (v: number) => `¥${v.toFixed(0)}`, color: 'var(--pdd-danger)', change: changeGmv },
      { label: '订单量', value: kpi.cnt, fmt: (v: number) => v.toFixed(0), color: 'var(--pdd-primary)', change: changeCnt },
      { label: '平均客单价', value: kpi.avg, fmt: (v: number) => `¥${v.toFixed(2)}`, color: 'var(--pdd-success)', change: 0 },
      { label: '环比变化', value: changeValue, fmt: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`, color: getChangeColor(), change: 0 },
    ];
    return result;
  }, [kpi, compareKpi, compareEnabled]);

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tfState} />

      {kpi && (
        <div className="grid grid-cols-4 gap-2">
          {cards.map((c, i) => {
            const changeVal: number = c.change;
            return (
              <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="pdd-card px-3 py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-[var(--pdd-text-secondary)]">{c.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-base font-bold" style={{ color: c.color }}>{noData ? '--' : c.fmt(c.value)}</span>
                    {Math.abs(changeVal) > 0.01 && (
                      <span className={`text-xs ${changeVal > 0 ? 'text-[var(--pdd-success)]' : 'text-[var(--pdd-danger)]'}`}>{changeVal > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(changeVal).toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {noData ? (
        <div className="pdd-card text-center py-12 text-[var(--pdd-text-secondary)]">
          <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无趋势数据</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">GMV趋势</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="gmv" stroke="var(--pdd-primary-light)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
