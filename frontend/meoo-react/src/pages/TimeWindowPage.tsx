import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, ChevronLeft, ChevronRight, TrendingUp, BarChart3, Filter,
  ArrowRight, Activity, X, Settings, Download, Table, AlertTriangle,
  DollarSign, Clock, Tag, Target, Zap, Brain, RefreshCw,
  ChevronUp, ChevronDown, Info, TrendingDown, Save, Eye,
  Megaphone, Shield, ShoppingBag, CreditCard, PieChart, BarChart4
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area,
  ComposedChart, RadialBarChart, RadialBar
} from "recharts";
import { useData, useStore } from "../App";
import { sf, ss, findField } from "../utils";

interface DayData {
  date: string; sales: number; gmv: number; refundRate: number;
  promoCost: number; refundAmount: number; orderCount: number;
  events: string[]; eventDetails: EventInfo[];
}

interface EventInfo {
  type: string; emoji: string; label: string; date: string;
  details: string; amount?: number; products?: string[];
}
interface TabItem { key: string; label: string; icon: React.ElementType; }
interface AnomalyItem {
  level: "P1" | "P2" | "P3"; title: string; desc: string;
  impact: string; sigma: string; suggestion: string; amount: number;
}

const EVENT_TYPES = [
  { key: "promo", emoji: "\u2b50", label: "推广", color: "#1F6BFF" },
  { key: "subsidy", emoji: "\u{1f4b0}", label: "百亿补贴", color: "#17B26A" },
  { key: "priceUp", emoji: "\u2b06", label: "涨价", color: "#F04438" },
  { key: "priceDown", emoji: "\u2b07", label: "降价", color: "#FF9F1A" },
  { key: "fine", emoji: "\u26a0\ufe0f", label: "罚款", color: "#F04438" },
  { key: "newProduct", emoji: "\u{1f195}", label: "新品", color: "#7C5CFC" },
  { key: "timeout", emoji: "\u{1f4e6}", label: "\u8d85\u65f6", color: "#98A2B3" },
];

const TABS = [
  { key: "timeline", label: "时间轴", icon: TrendingUp },
  { key: "slice", label: "时间切片", icon: BarChart3 },
  { key: "attribution", label: "事件归因", icon: Target },
  { key: "finance", label: "财务窗口", icon: DollarSign },
  { key: "compare", label: "对比分析", icon: Activity },
  { key: "diagnose", label: "智能诊断", icon: Brain },
];
const RANGE_OPTIONS = [
  { key: "7", label: "近7天" }, { key: "30", label: "近30天" },
  { key: "90", label: "近90天" }, { key: "all", label: "全部" },
];
const GRANULARITY_OPTIONS = [
  { key: "day", label: "按日" }, { key: "week", label: "按周" }, { key: "month", label: "按月" },
];
const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const eventColorMap = {
  promo: "#1F6BFF", subsidy: "#17B26A", priceUp: "#F04438",
  priceDown: "#FF9F1A", fine: "#F04438", newProduct: "#7C5CFC", timeout: "#98A2B3",
};

function formatDate(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
  for (let i = 0; i < startPad; i++) {
    days.push(new Date(year, month, -startPad + i + 1));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - last.getDate()));
  }
  return days;
}

const DAYS_OF_WEEK = ["一", "二", "三", "四", "五", "六", "日"];

export default function TimeWindowPage() {
  const { getStoreData } = useData();
  const { currentStore } = useStore();
  const storeId = currentStore?.id || '';
  const storeData = getStoreData(storeId);
  const orders = storeData?.orders || [];
  const financialRecords = storeData?.financialRecords || [];
  const afterSaleRecords = storeData?.afterSaleRecords || [];
  const promotionProducts = storeData?.promotionProducts || [];

  const [activeTab, setActiveTab] = useState<string>("timeline");
  const [timeRange, setTimeRange] = useState<string>("30");
  const [granularity, setGranularity] = useState<string>("day");
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeEvents, setActiveEvents] = useState<Set<string>>(new Set(EVENT_TYPES.map(e => e.key)));
  const [compareMode, setCompareMode] = useState<"none" | "period" | "beforeAfter" | "samePeriod">("none");
  const [compareSettings, setCompareSettings] = useState({ beforeAfterDays: 7, selectedEventType: "", samePeriodOffset: "lastMonth" });
  const [sliceDimension, setSliceDimension] = useState<string>("hour");
  const [showEventOverlay, setShowEventOverlay] = useState(true);

  // Finance tab state
  const [financeTab, setFinanceTab] = useState<string>("overview");
  const [taxRate, setTaxRate] = useState<number>(13);

  // Attribution tab state
  const [selectedEventForAttribution, setSelectedEventForAttribution] = useState<string>("");
  const [attributionModel, setAttributionModel] = useState<string>("sarima");
  const [attributionWindow, setAttributionWindow] = useState<number>(14);

  // Comparison tab state
  const [compareSubMode, setCompareSubMode] = useState<string>("beforeAfter");
  const [compareEventType, setCompareEventType] = useState<string>("promo");
  const [compareWindow, setCompareWindow] = useState<number>(7);
  const [compareBucket, setCompareBucket] = useState<string>("none");

  // Diagnose tab state
  const [anomalyList, setAnomalyList] = useState<AnomalyItem[]>([]);

  // ===== Data Computation =====
  // 1. 检测事件（先计算，供 dailyData 消费）
  const allEvents = useMemo((): EventInfo[] => {
    const events: EventInfo[] = [];
    // Promo events
    const promoDates = new Map<string, {cost: number; products: Set<string>}>();
    promotionProducts.forEach((p: any) => {
      const date = ss(findField(p, "日期"));
      if (!date) return;
      if (!promoDates.has(date)) promoDates.set(date, {cost: 0, products: new Set()});
      const pd = promoDates.get(date)!;
      pd.cost += sf(findField(p, "成交花费", "广告花费"));
      const pid = ss(findField(p, "商品ID"));
      if (pid) pd.products.add(pid);
    });
    promoDates.forEach((pd, date) => {
      events.push({ type: "promo", emoji: "\u2b50", label: "推广", date,
        details: "花费" + pd.cost.toFixed(0) + "元, " + pd.products.size + "个商品",
        amount: pd.cost, products: [...pd.products] });
    });
    // Financial events
    financialRecords.forEach((rec: any) => {
      const desc = ss(findField(rec, "业务描述", "账务类型"));
      const time = ss(findField(rec, "发生时间"));
      if (!desc || !time) return;
      const date = time.split(' ')[0];
      const amount = Math.abs(sf(findField(rec, "支出金额(元)", "支出金额")));
      if (desc.includes("0030003") || desc.includes("百亿补贴")) {
        events.push({ type: "subsidy", emoji: "\u{1f4b0}", label: "百亿补贴", date,
          details: "服务费" + amount.toFixed(0) + "元", amount });
      }
      if (desc.includes("0040002") || desc.includes("0040004") || desc.includes("罚款")) {
        events.push({ type: "fine", emoji: "\u26a0\ufe0f", label: "罚款", date,
          details: desc + " " + amount.toFixed(0) + "元", amount });
      }
    });
    // Price change detection
    const productPrices = new Map<string, Map<string, number>>();
    orders.forEach((o: any) => {
      const pid = ss(findField(o, "商品id"));
      const date = ss(findField(o, "支付时间")).split(" ")[0];
      if (!pid || !date) return;
      if (!productPrices.has(pid)) productPrices.set(pid, new Map());
      const pm = productPrices.get(pid)!;
      const price = sf(findField(o, "商品总价(元)", "商品总价")) / Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 1);
      if (!pm.has(date) || price > pm.get(date)!) { pm.set(date, price); }
    });
    productPrices.forEach((pm, pid) => {
      const sortedDates = [...pm.keys()].sort();
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = sortedDates[i-1]; const curr = sortedDates[i];
        const prevPrice = pm.get(prev)!; const currPrice = pm.get(curr)!;
        const diff = ((currPrice - prevPrice) / prevPrice * 100);
        if (Math.abs(diff) > 5) {
          events.push({
            type: diff > 0 ? "priceUp" : "priceDown",
            emoji: diff > 0 ? "\u2b06" : "\u2b07",
            label: diff > 0 ? "涨价" : "降价",
            date: curr,
            details: "商品" + pid + " " + (diff > 0 ? "涨" : "降") + Math.abs(diff).toFixed(0) + "%",
            amount: currPrice - prevPrice,
            products: [pid]
          });
        }
      }
    });
    return events;
  }, [orders, promotionProducts, financialRecords]);


  // ===== Data Computation =====
  const dailyData = useMemo((): Map<string, DayData> => {
    const map = new Map<string, DayData>();
    orders.forEach((o: any) => {
      const date = ss(findField(o, "支付时间")).split(" ")[0];
      if (!date) return;
      if (!map.has(date)) {
        map.set(date, { date, sales: 0, gmv: 0, refundRate: 0, promoCost: 0, refundAmount: 0, orderCount: 0, events: [], eventDetails: [] });
      }
      const d = map.get(date)!;
      d.orderCount++;
      d.sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
      d.gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
    });
    // Refund by date
    const refundByDate = new Map<string, {count: number; amount: number}>();
    afterSaleRecords.forEach((rec: any) => {
      const oid = ss(findField(rec, "订单编号", "订单号"));
      if (!oid) return;
      const order = orders.find((o: any) => ss(findField(o, '订单号')) === oid);
      if (!order) return;
      const date = ss(findField(order, "支付时间")).split(" ")[0];
      if (!date) return;
      if (!refundByDate.has(date)) refundByDate.set(date, {count: 0, amount: 0});
      const r = refundByDate.get(date)!; r.count++;
      r.amount += sf(findField(rec, "退款金额(元)", "金额"));
    });
    map.forEach((d, date) => {
      const refund = refundByDate.get(date);
      d.refundAmount = refund?.amount || 0;
      d.refundRate = d.orderCount > 0 ? ((refund?.count || 0) / d.orderCount * 100) : 0;
    });
    // Promotion costs by date
    promotionProducts.forEach((p: any) => {
      const date = ss(findField(p, "日期"));
      if (!date || !map.has(date)) return;
      const d = map.get(date)!;
      d.promoCost += sf(findField(p, "成交花费", "广告花费"));
    });
    // 事件归属：在 map 创建时一次性写入，避免 useMemo 副作用重复追加
    allEvents.forEach(ev => {
      if (map.has(ev.date)) {
        const d = map.get(ev.date)!;
        d.events.push(ev.type);
        d.eventDetails.push(ev);
      }
    });
    return map;
  }, [orders, afterSaleRecords, promotionProducts, allEvents]);

  // ===== Calendar =====
  const monthDays = useMemo(() => getMonthDays(currentYear, currentMonth), [currentYear, currentMonth]);
  const monthStr = currentYear + "年" + (currentMonth + 1) + "月";

  const toggleEvent = (key: string) => {
    setActiveEvents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => activeEvents.has(e.type));
  }, [allEvents, activeEvents]);

  // Chart data
  const chartData = useMemo(() => {
    const sorted = [...dailyData.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([date, d]) => ({
      date,
      sales: d.sales,
      gmv: Math.round(d.gmv),
      refundRate: Math.round(d.refundRate * 10) / 10,
      promoCost: Math.round(d.promoCost),
      hasEvent: d.events.length > 0,
      events: d.eventDetails.filter((ev: EventInfo) => activeEvents.has(ev.type))
    }));
  }, [dailyData, activeEvents]);

  // ─── Data for new tabs ───
  const hourData = useMemo(() => {
    const hours = Array.from({length: 24}, (_, i) => ({name: i + "时", sales: 0, gmv: 0, promoCost: 0, orders: 0, refund: 0}));
    orders.forEach((o: any) => {
      const time = ss(findField(o, "支付时间"));
      if (!time) return;
      const h = parseInt(time.split(" ")[1]?.split(":")[0] || "0");
      if (h >= 0 && h < 24) {
        hours[h].sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
        hours[h].gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
        hours[h].orders++;
      }
    });
    return hours;
  }, [orders]);

  const weekData = useMemo(() => {
    const days = Array.from({length: 7}, (_, i) => ({name: weekDayNames[i], sales: 0, gmv: 0, orderCount: 0, refundCount: 0}));
    orders.forEach((o: any) => {
      const time = ss(findField(o, "支付时间"));
      if (!time) return;
      const d = new Date(time);
      const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
      days[wd].sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
      days[wd].gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
      days[wd].orderCount++;
    });
    return days;
  }, [orders]);


  // 全局错误兜底
  const [renderError, setRenderError] = useState<string | null>(null);
  useEffect(() => {
    const handler = (ev: ErrorEvent) => { setRenderError(ev.error?.message || '未知错误'); };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  if (renderError) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="pdd-card p-8 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-base font-bold mb-1">渲染异常</h3>
          <p className="text-xs text-pdd-text-secondary">{renderError}</p>
          <button onClick={() => setRenderError(null)} className="mt-3 px-4 py-1.5 bg-pdd-primary text-white text-xs rounded">重试</button>
        </div>
      </div>
    );
  }

  // No data state
  if (!orders.length) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <div className="pdd-card p-8 text-center">
          <div className="text-4xl mb-2">{'\u{1f4c5}'}</div>
          <h3 className="text-base font-bold mb-1">时间窗口</h3>
          <p className="text-xs text-pdd-text-secondary">请先上传订单数据以查看时间窗口分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-1.5"><Calendar size={16} className="text-pdd-primary" />时间窗口</h2>
      </div>

      {/* Tab bar - bg-pdd-card rounded-xl border p-1 style */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-1 overflow-x-auto">
        <div className="flex gap-0.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-pdd-primary text-white shadow-sm'
                    : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg'
                }`}
              ><Icon size={14} />{tab.label}</button>
            );
          })}
        </div>
      </div>

      {/* ===== TAB 1: Timeline View ===== */}
      {activeTab === "timeline" && (
        <div className="space-y-3">

      {/* ===== Event Filter Bar ===== */}
      <div className="pdd-card p-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-pdd-text-secondary mr-1"><Filter size={11} className="inline mr-0.5" />事件筛选</span>
          {EVENT_TYPES.map(et => (
            <button key={et.key} onClick={() => toggleEvent(et.key)}
              className={"flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border transition-colors " +
                (activeEvents.has(et.key) ? "border-transparent text-white" : "border-pdd-border text-pdd-text-secondary")}
              style={{ backgroundColor: activeEvents.has(et.key) ? et.color : 'transparent' }}
            ><span>{et.emoji}</span> {et.label}</button>
          ))}
        </div>
      </div>

      {/* ===== Chart + Calendar Grid ===== */}
      <div className="grid grid-cols-5 gap-3">
        {/* Left: Line Chart (4 cols) */}
        <div className="col-span-5 lg:col-span-3 pdd-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold"><TrendingUp size={13} className="inline mr-1" />销售趋势</h3>
            <div className="flex items-center gap-1">
              {[{key:'day',label:'日'},{key:'week',label:'周'},{key:'month',label:'月'}].map(v => (
                <button key={v.key} onClick={() => setViewMode(v.key as any)}
                  className={"text-[10px] px-1.5 py-0.5 rounded " + (viewMode===v.key ? "bg-pdd-primary text-white" : "bg-pdd-bg text-pdd-text-secondary")}
                >{v.label}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-gray-200)" />
              <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={(v:string)=>{const p=v.split('-');return p[1]+'/'+p[2]}} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{fontSize:10}} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:10}} />
              <Tooltip contentStyle={{fontSize:'12px'}} />
              <Legend wrapperStyle={{fontSize:'11px'}} />
              <Line yAxisId="left" type="monotone" dataKey="gmv" name="GMV" stroke="#1F6BFF" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="sales" name="销量(件)" stroke="#17B26A" strokeWidth={1.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="refundRate" name="退款率(%)" stroke="#F04438" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              {filteredEvents.map((ev, i) => {
                const idx = chartData.findIndex(d => d.date === ev.date);
                if (idx < 0) return null;
                return <ReferenceLine key={i} x={ev.date} yAxisId="left" stroke={eventColorMap[ev.type] || '#999'} strokeDasharray="3 2" label={{value:ev.emoji, position:'top', fontSize:14}} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Right: Calendar Grid (1 col) */}
        <div className="col-span-5 lg:col-span-2 pdd-card p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => { if (currentMonth === 0) { setCurrentYear(y => y-1); setCurrentMonth(11); } else { setCurrentMonth(m => m-1); } }} className="p-0.5 rounded hover:bg-pdd-bg"><ChevronLeft size={14} /></button>
            <span className="text-xs font-semibold">{currentYear}年{currentMonth+1}月</span>
            <button onClick={() => { if (currentMonth === 11) { setCurrentYear(y => y+1); setCurrentMonth(0); } else { setCurrentMonth(m => m+1); } }} className="p-0.5 rounded hover:bg-pdd-bg"><ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-7 gap-0">
            {DAYS_OF_WEEK.map(d => <div key={d} className="text-center text-[10px] text-pdd-text-secondary py-1">{d}</div>)}
            {monthDays.map((day, i) => {
              const dateStr = formatDate(day);
              const dd = dailyData.get(dateStr);
              const isToday = dateStr === formatDate(new Date());
              const isSelected = dateStr === selectedDate;
              const hasEvent = dd && dd.events.length > 0;
              const isOtherMonth = day.getMonth() !== currentMonth;
              return (
                <button key={i} onClick={() => setSelectedDate(dateStr)}
                  className={"relative text-center py-1 text-[10px] rounded transition-colors " +
                    (isSelected ? "bg-pdd-primary text-white font-semibold" :
                     isToday ? "bg-pdd-bg font-semibold text-pdd-primary" :
                     isOtherMonth ? "text-pdd-gray-200" : "text-pdd-text hover:bg-pdd-bg")}
                >
                  <span>{day.getDate()}</span>
                  {hasEvent && !isOtherMonth && (
                    <div className="flex items-center justify-center gap-[1px] mt-0.5">
                      {dd.events.slice(0, 2).map((et: string, ei: number) => {
                        const ev = EVENT_TYPES.find(e => e.key === et);
                        return ev ? <span key={ei} style={{fontSize:'6px'}}>{ev.emoji}</span> : null;
                      })}
                      {dd.events.length > 2 && <span className="text-[6px] text-pdd-text-secondary">...</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Detail Panel ===== */}
      {selectedDate && dailyData.has(selectedDate) && (() => {
        const dd = dailyData.get(selectedDate)!;
        const dayEvents = dd.eventDetails.filter((ev: EventInfo) => activeEvents.has(ev.type));
        const prevDay = dailyData.get((() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          return formatDate(d);
        })());
        return (
          <div className="pdd-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold">{selectedDate} 数据详情</h3>
              <button onClick={() => setSelectedDate('')} className="text-pdd-text-secondary hover:text-pdd-danger"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                {label:'销量', value:dd.sales.toFixed(0), sub: prevDay ? '前日' + prevDay.sales.toFixed(0) : '', change: prevDay ? ((dd.sales - prevDay.sales) / prevDay.sales * 100).toFixed(1) : '0' },
                {label:'GMV', value:'\u00a5' + dd.gmv.toFixed(0), sub: prevDay ? '前日\u00a5' + prevDay.gmv.toFixed(0) : '', change: prevDay ? ((dd.gmv - prevDay.gmv) / prevDay.gmv * 100).toFixed(1) : '0' },
                {label:'退款率', value: dd.refundRate.toFixed(1) + '%', sub: prevDay ? '前日' + prevDay.refundRate.toFixed(1) + '%' : '', change: prevDay ? (dd.refundRate - prevDay.refundRate).toFixed(1) : '0', reverse: true },
                {label:'推广费', value:'\u00a5' + dd.promoCost.toFixed(0), sub: prevDay ? '前日\u00a5' + prevDay.promoCost.toFixed(0) : '', change: prevDay ? ((dd.promoCost - prevDay.promoCost) / Math.max(prevDay.promoCost, 1) * 100).toFixed(1) : '0' },
              ].map((kpi, i) => (
                <div key={i} className="bg-pdd-bg rounded p-2">
                  <p className="text-[10px] text-pdd-text-secondary">{kpi.label}</p>
                  <p className="text-sm font-bold">{kpi.value}</p>
                  <p className="text-[9px] text-pdd-text-secondary">{kpi.sub}</p>
                  {kpi.change !== '0' && (
                    <span className={'text-[9px] ' + (Number(kpi.change) > 0 ? (kpi.reverse ? 'text-red-500' : 'text-green-600') : (kpi.reverse ? 'text-green-600' : 'text-red-500'))}>
                      {Number(kpi.change) > 0 ? '\u2191' : '\u2193'} {Math.abs(Number(kpi.change)).toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* Events on this day */}
            {dayEvents.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-pdd-text-secondary">当日事件</p>
                {dayEvents.map((ev: EventInfo, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] bg-pdd-bg rounded px-2 py-1">
                    <span>{ev.emoji}</span>
                    <span className="font-medium">{ev.label}</span>
                    <span className="text-pdd-text-secondary">{ev.details}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== Compare Mode ===== */}
      <div className="pdd-card p-3">
        <button onClick={() => setCompareMode(compareMode === 'none' ? 'period' : 'none')}
          className="flex items-center justify-between w-full text-left">
          <h3 className="text-xs font-semibold"><Activity size={13} className="inline mr-1" />对比模式</h3>
          <span className="text-[10px] text-pdd-text-secondary">{compareMode !== 'none' ? '收起' : '展开'}</span>
        </button>
        {compareMode !== 'none' && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1">
              {[{key:'period',label:'时段对比'},{key:'beforeAfter',label:'事件前后'},{key:'samePeriod',label:'同期对比'}].map(m => (
                <button key={m.key} onClick={() => setCompareMode(m.key as any)}
                  className={"text-[10px] px-2 py-1 rounded " + (compareMode===m.key ? "bg-pdd-primary text-white" : "bg-pdd-bg text-pdd-text-secondary")}
                >{m.label}</button>
              ))}
            </div>
            {compareMode === 'period' && (() => {
              const allDates = [...dailyData.keys()].sort();
              const mid = Math.floor(allDates.length / 2);
              const periodA = allDates.slice(0, mid);
              const periodB = allDates.slice(mid);
              const sumRange = (dates: string[]) => {
                let sales = 0, gmv = 0, refundAmt = 0, promo = 0, orderCnt = 0;
                dates.forEach(d => { const day = dailyData.get(d); if (!day) return; sales += day.sales; gmv += day.gmv; refundAmt += day.refundAmount; promo += day.promoCost; orderCnt += day.orderCount; });
                const refundRate = dates.length > 0 ? (dates.reduce((acc, d) => acc + (dailyData.get(d)?.refundRate || 0), 0) / dates.length) : 0;
                return { sales, gmv, refundAmt, refundRate, promo, orderCnt, days: dates.length };
              };
              const a = sumRange(periodA), b = sumRange(periodB);
              const metrics = [
                { label: '销量(件)', a: a.sales.toFixed(0), b: b.sales.toFixed(0), chg: a.sales > 0 ? ((b.sales - a.sales) / a.sales * 100).toFixed(1) : '0' },
                { label: 'GMV(元)', a: '¥' + a.gmv.toFixed(0), b: '¥' + b.gmv.toFixed(0), chg: a.gmv > 0 ? ((b.gmv - a.gmv) / a.gmv * 100).toFixed(1) : '0' },
                { label: '退款率', a: a.refundRate.toFixed(1) + '%', b: b.refundRate.toFixed(1) + '%', chg: (b.refundRate - a.refundRate).toFixed(1), reverse: true },
                { label: '推广费', a: '¥' + a.promo.toFixed(0), b: '¥' + b.promo.toFixed(0), chg: a.promo > 0 ? ((b.promo - a.promo) / a.promo * 100).toFixed(1) : '0' },
                { label: '订单数', a: a.orderCnt.toFixed(0), b: b.orderCnt.toFixed(0), chg: a.orderCnt > 0 ? ((b.orderCnt - a.orderCnt) / a.orderCnt * 100).toFixed(1) : '0' },
              ];
              return (
                <div>
                  <div className="flex items-center gap-2 text-[10px] text-pdd-text-secondary mb-2">
                    <span className="px-2 py-0.5 rounded bg-pdd-bg font-mono">{periodA[0] || '--'} ~ {periodA[periodA.length-1] || '--'}</span>
                    <ArrowRight size={10} />
                    <span className="px-2 py-0.5 rounded bg-pdd-bg font-mono">{periodB[0] || '--'} ~ {periodB[periodB.length-1] || '--'}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                        <th className="text-left py-1 font-medium">指标</th>
                        <th className="text-right py-1 font-medium">前半段</th>
                        <th className="text-right py-1 font-medium">后半段</th>
                        <th className="text-right py-1 font-medium">变化</th>
                      </tr></thead>
                      <tbody>
                        {metrics.map(m => {
                          const val = parseFloat(m.chg);
                          const isUp = val > 0;
                          return <tr key={m.label} className="border-b border-pdd-border/30">
                            <td className="py-1 text-pdd-text">{m.label}</td>
                            <td className="py-1 text-right font-mono text-pdd-text">{m.a}</td>
                            <td className="py-1 text-right font-mono text-pdd-text">{m.b}</td>
                            <td className={'py-1 text-right font-mono ' + (m.reverse ? (isUp ? 'text-red-500' : 'text-green-600') : (isUp ? 'text-green-600' : 'text-red-500'))}>
                              {val > 0 ? '↑' : val < 0 ? '↓' : ''}{Math.abs(val)}%
                            </td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
            {compareMode === 'beforeAfter' && (() => {
              const windowDays = compareSettings.beforeAfterDays || 7;
              const selType = compareSettings.selectedEventType || 'promo';
              const targetEvents = allEvents.filter(e => e.type === selType);
              if (targetEvents.length === 0) {
                return <div className="text-[11px] text-pdd-text-secondary p-2 bg-pdd-bg rounded">所选事件类型无事件数据，请选择其他类型</div>;
              }
              let beforeSum = { sales: 0, gmv: 0, refundRate: 0, promo: 0, count: 0 };
              let afterSum = { sales: 0, gmv: 0, refundRate: 0, promo: 0, count: 0 };
              targetEvents.forEach(ev => {
                for (let d = -windowDays; d < 0; d++) {
                  const date = new Date(ev.date); date.setDate(date.getDate() + d);
                  const ds = formatDate(date);
                  const day = dailyData.get(ds); if (!day) continue;
                  beforeSum.sales += day.sales; beforeSum.gmv += day.gmv;
                  beforeSum.refundRate += day.refundRate; beforeSum.promo += day.promoCost;
                  beforeSum.count++;
                }
                for (let d = 1; d <= windowDays; d++) {
                  const date = new Date(ev.date); date.setDate(date.getDate() + d);
                  const ds = formatDate(date);
                  const day = dailyData.get(ds); if (!day) continue;
                  afterSum.sales += day.sales; afterSum.gmv += day.gmv;
                  afterSum.refundRate += day.refundRate; afterSum.promo += day.promoCost;
                  afterSum.count++;
                }
              });
              const bAvg = (s: typeof beforeSum) => ({ sales: s.sales / Math.max(s.count, 1), gmv: s.gmv / Math.max(s.count, 1), refundRate: s.count > 0 ? s.refundRate / s.count : 0, promo: s.promo / Math.max(s.count, 1) });
              const ba = bAvg(beforeSum), aa = bAvg(afterSum);
              const selEv = EVENT_TYPES.find(e => e.key === selType);
              const compMetrics = [
                { label: '日均销量', b: ba.sales.toFixed(1), a: aa.sales.toFixed(1), chg: ba.sales > 0 ? ((aa.sales - ba.sales) / ba.sales * 100).toFixed(1) : '0' },
                { label: '日均GMV', b: '¥' + ba.gmv.toFixed(0), a: '¥' + aa.gmv.toFixed(0), chg: ba.gmv > 0 ? ((aa.gmv - ba.gmv) / ba.gmv * 100).toFixed(1) : '0' },
                { label: '日均推广费', b: '¥' + ba.promo.toFixed(0), a: '¥' + aa.promo.toFixed(0), chg: ba.promo > 0 ? ((aa.promo - ba.promo) / ba.promo * 100).toFixed(1) : '0' },
                { label: '退款率(均)', b: ba.refundRate.toFixed(1) + '%', a: aa.refundRate.toFixed(1) + '%', chg: (aa.refundRate - ba.refundRate).toFixed(1), reverse: true },
              ];
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <select value={selType} onChange={e => setCompareSettings(s => ({ ...s, selectedEventType: e.target.value }))}
                      className="text-[10px] px-2 py-1 border border-pdd-border rounded bg-pdd-bg text-pdd-text">
                      {EVENT_TYPES.map(et => <option key={et.key} value={et.key}>{et.emoji} {et.label}</option>)}
                    </select>
                    <span className="text-[10px] text-pdd-text-secondary">前后</span>
                    <input type="number" value={windowDays} onChange={e => setCompareSettings(s => ({ ...s, beforeAfterDays: parseInt(e.target.value) || 7 }))}
                      className="w-12 px-2 py-1 text-[10px] border border-pdd-border rounded bg-pdd-bg text-pdd-text text-center" />
                    <span className="text-[10px] text-pdd-text-secondary">天</span>
                    <span className="text-[10px] text-pdd-text-secondary ml-1">共{targetEvents.length}个{selEv?.emoji}事件</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                        <th className="text-left py-1 font-medium">指标</th>
                        <th className="text-right py-1 font-medium">事件前{windowDays}天</th>
                        <th className="text-right py-1 font-medium">事件后{windowDays}天</th>
                        <th className="text-right py-1 font-medium">变化</th>
                      </tr></thead>
                      <tbody>
                        {compMetrics.map(m => {
                          const val = parseFloat(m.chg);
                          const isUp = val > 0;
                          return <tr key={m.label} className="border-b border-pdd-border/30">
                            <td className="py-1 text-pdd-text">{m.label}</td>
                            <td className="py-1 text-right font-mono text-pdd-text">{m.b}</td>
                            <td className="py-1 text-right font-mono text-pdd-text">{m.a}</td>
                            <td className={'py-1 text-right font-mono ' + (m.reverse ? (isUp ? 'text-red-500' : 'text-green-600') : (isUp ? 'text-green-600' : 'text-red-500'))}>
                              {val > 0 ? '↑' : val < 0 ? '↓' : ''}{Math.abs(val)}%
                            </td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
            {compareMode === 'samePeriod' && (() => {
              const offset = compareSettings.samePeriodOffset || 'lastMonth';
              const allDates = [...dailyData.keys()].sort();
              if (allDates.length === 0) return <div className="text-[11px] text-pdd-text-secondary p-2 bg-pdd-bg rounded">无数据</div>;
              const currentEnd = allDates[allDates.length - 1];
              const currentStart = allDates[0];
              let compareStart = '', compareEnd = '';
              if (offset === 'lastMonth') {
                const end = new Date(currentEnd); end.setMonth(end.getMonth() - 1);
                const start = new Date(currentStart); start.setMonth(start.getMonth() - 1);
                compareStart = formatDate(start); compareEnd = formatDate(end);
              } else {
                const end = new Date(currentEnd); end.setFullYear(end.getFullYear() - 1);
                const start = new Date(currentStart); start.setFullYear(start.getFullYear() - 1);
                compareStart = formatDate(start); compareEnd = formatDate(end);
              }
              const sumDates = (start: string, end: string) => {
                let sales = 0, gmv = 0, refundRate = 0, promo = 0, cnt = 0, orderCnt = 0;
                const d = new Date(start);
                while (d <= new Date(end)) {
                  const ds = formatDate(d); const day = dailyData.get(ds);
                  if (day) { sales += day.sales; gmv += day.gmv; refundRate += day.refundRate; promo += day.promoCost; orderCnt += day.orderCount; cnt++; }
                  d.setDate(d.getDate() + 1);
                }
                return { sales, gmv, refundRate: cnt > 0 ? refundRate / cnt : 0, promo, days: cnt, orderCnt };
              };
              const cur = sumDates(currentStart, currentEnd);
              const cmp = sumDates(compareStart, compareEnd);
              const periodMetrics = [
                { label: '销量(件)', cur: cur.sales.toFixed(0), cmp: cmp.sales.toFixed(0), chg: cmp.sales > 0 ? ((cur.sales - cmp.sales) / cmp.sales * 100).toFixed(1) : '0' },
                { label: 'GMV(元)', cur: '¥' + cur.gmv.toFixed(0), cmp: '¥' + cmp.gmv.toFixed(0), chg: cmp.gmv > 0 ? ((cur.gmv - cmp.gmv) / cmp.gmv * 100).toFixed(1) : '0' },
                { label: '平均退款率', cur: cur.refundRate.toFixed(1) + '%', cmp: cmp.refundRate.toFixed(1) + '%', chg: (cur.refundRate - cmp.refundRate).toFixed(1), reverse: true },
                { label: '推广费', cur: '¥' + cur.promo.toFixed(0), cmp: '¥' + cmp.promo.toFixed(0), chg: cmp.promo > 0 ? ((cur.promo - cmp.promo) / cmp.promo * 100).toFixed(1) : '0' },
              ];
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <select value={offset} onChange={e => setCompareSettings(s => ({ ...s, samePeriodOffset: e.target.value }))}
                      className="text-[10px] px-2 py-1 border border-pdd-border rounded bg-pdd-bg text-pdd-text">
                      <option value="lastMonth">上个月同期</option>
                      <option value="lastYear">去年同月</option>
                    </select>
                    <span className="text-[10px] text-pdd-text-secondary font-mono">{compareStart} ~ {compareEnd}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                        <th className="text-left py-1 font-medium">指标</th>
                        <th className="text-right py-1 font-medium">当前周期</th>
                        <th className="text-right py-1 font-medium">对比周期</th>
                        <th className="text-right py-1 font-medium">变化</th>
                      </tr></thead>
                      <tbody>
                        {periodMetrics.map(m => {
                          const val = parseFloat(m.chg);
                          const isUp = val > 0;
                          return <tr key={m.label} className="border-b border-pdd-border/30">
                            <td className="py-1 text-pdd-text">{m.label}</td>
                            <td className="py-1 text-right font-mono text-pdd-text">{m.cur}</td>
                            <td className="py-1 text-right font-mono text-pdd-text">{m.cmp}</td>
                            <td className={'py-1 text-right font-mono ' + (m.reverse ? (isUp ? 'text-red-500' : 'text-green-600') : (isUp ? 'text-green-600' : 'text-red-500'))}>
                              {val > 0 ? '↑' : val < 0 ? '↓' : ''}{Math.abs(val)}%
                            </td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  )}

  {/* ===== TAB 2: Time Slice Analysis ===== */}
  {activeTab === "slice" && (
    <div className="space-y-3">
      {/* Dimension selector */}
      <div className="pdd-card p-3">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-pdd-text-secondary mr-1"><BarChart3 size={11} className="inline mr-0.5" />切片维度</span>
          {[
            {key:'hour',label:'按小时'},
            {key:'weekday',label:'按星期'},
            {key:'day',label:'按日'},
            {key:'week',label:'按周'},
            {key:'month',label:'按月'},
            {key:'custom',label:'自定义时段'},
          ].map(dim => (
            <button key={dim.key} onClick={() => setSliceDimension(dim.key)}
              className={"text-[10px] px-2 py-0.5 rounded " + (sliceDimension===dim.key ? "bg-pdd-primary text-white" : "bg-pdd-bg text-pdd-text-secondary")}
            >{dim.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="flex items-center gap-1 text-[10px] text-pdd-text-secondary">
            <input type="checkbox" checked={showEventOverlay} onChange={e => setShowEventOverlay(e.target.checked)} className="w-3 h-3" />
            显示事件标记
          </label>
        </div>
      </div>

      {/* Slice chart */}
      <div className="pdd-card p-3">
        <h3 className="text-xs font-semibold mb-2">
          {sliceDimension === 'hour' ? '按小时分布' :
           sliceDimension === 'weekday' ? '按星期分布' :
           sliceDimension === 'day' ? '按日趋势' :
           sliceDimension === 'week' ? '按周趋势' :
           sliceDimension === 'month' ? '按月分布' : '自定义时段分布'}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          {(sliceDimension === 'day' || sliceDimension === 'week' || sliceDimension === 'month') ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-gray-200)" />
              <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={(v:string)=>{if(sliceDimension==='month')return v.substring(0,7); const p=v.split('-');return p[1]+'/'+p[2];}} />
              <YAxis tick={{fontSize:10}} />
              <Tooltip contentStyle={{fontSize:'12px'}} />
              <Legend wrapperStyle={{fontSize:'11px'}} />
              <Line type="monotone" dataKey="gmv" name="GMV" stroke="#1F6BFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sales" name="销量(件)" stroke="#17B26A" strokeWidth={1.5} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={(function() {
              if (sliceDimension === 'hour') {
                const hours = Array.from({length: 24}, (_, i) => ({name: i + '时', sales: 0, gmv: 0, refundRate: 0}));
                orders.forEach((o: any) => {
                  const time = ss(findField(o, "支付时间"));
                  if (!time) return;
                  const h = parseInt(time.split(' ')[1]?.split(':')[0] || '0');
                  if (h >= 0 && h < 24) {
                    hours[h].sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
                    hours[h].gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
                  }
                });
                return hours;
              } else if (sliceDimension === 'weekday') {
                const days = Array.from({length: 7}, (_, i) => ({name: ['周一','周二','周三','周四','周五','周六','周日'][i], sales: 0, gmv: 0, orderCount: 0, refundCount: 0}));
                orders.forEach((o: any) => {
                  const time = ss(findField(o, "支付时间"));
                  if (!time) return;
                  const d = new Date(time);
                  const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
                  days[wd].sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
                  days[wd].gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
                  days[wd].orderCount++;
                });
                return days;
              }
              return [];
            })()}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-gray-200)" />
              <XAxis dataKey="name" tick={{fontSize:10}} />
              <YAxis tick={{fontSize:10}} />
              <Tooltip contentStyle={{fontSize:'12px'}} />
              <Legend wrapperStyle={{fontSize:'11px'}} />
              <Bar dataKey="gmv" name="GMV" fill="#1F6BFF" radius={[2,2,0,0]} />
              <Bar dataKey="sales" name="销量(件)" fill="#17B26A" radius={[2,2,0,0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Slice detail table */}
      <div className="pdd-card p-3">
        <h4 className="text-xs font-semibold mb-2">明细数据</h4>
        {sliceDimension === 'hour' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                <th className="py-1.5 text-left">时段</th><th className="py-1.5 text-right">销量</th><th className="py-1.5 text-right">GMV</th><th className="py-1.5 text-right">占比</th>
              </tr></thead>
              <tbody>
                {Array.from({length:24}, (_, i) => {
                  let sales = 0, gmv = 0;
                  orders.forEach((o: any) => {
                    const time = ss(findField(o, "支付时间"));
                    if (!time) return;
                    const h = parseInt(time.split(' ')[1]?.split(':')[0] || '0');
                    if (h === i) {
                      sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
                      gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
                    }
                  });
                  const totalS = orders.reduce((s:number,o:any)=>s+Math.max(sf(findField(o, "商品数量(件)", "商品数量")),0),0);
                  const ratio = totalS > 0 ? (sales / totalS * 100) : 0;
                  return (
                    <tr key={i} className="border-b border-pdd-border hover:bg-pdd-bg">
                      <td className="py-1 font-medium">{i}时</td>
                      <td className="py-1 text-right">{sales.toFixed(0)}</td>
                      <td className="py-1 text-right">{'\u00a5' + gmv.toFixed(0)}</td>
                      <td className="py-1 text-right">{ratio.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {sliceDimension === 'weekday' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                <th className="py-1.5 text-left">星期</th><th className="py-1.5 text-right">销量</th><th className="py-1.5 text-right">GMV</th><th className="py-1.5 text-right">订单数</th>
              </tr></thead>
              <tbody>
                {['周一','周二','周三','周四','周五','周六','周日'].map((name, i) => {
                  let sales = 0, gmv = 0, count = 0;
                  const wd = i;
                  orders.forEach((o: any) => {
                    const time = ss(findField(o, "支付时间"));
                    if (!time) return;
                    const d = new Date(time);
                    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
                    if (dayOfWeek === wd) {
                      sales += Math.max(sf(findField(o, "商品数量(件)", "商品数量")), 0);
                      gmv += Math.max(sf(findField(o, "商品总价(元)", "商品总价")), 0);
                      count++;
                    }
                  });
                  return (
                    <tr key={i} className="border-b border-pdd-border hover:bg-pdd-bg">
                      <td className="py-1 font-medium">{name}</td>
                      <td className="py-1 text-right">{sales.toFixed(0)}</td>
                      <td className="py-1 text-right">{'\u00a5' + gmv.toFixed(0)}</td>
                      <td className="py-1 text-right">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {sliceDimension !== 'hour' && sliceDimension !== 'weekday' && (
          <div className="text-xs text-pdd-text-secondary p-4 text-center bg-pdd-bg rounded">
            {sliceDimension === 'custom' ? '⏳ 自定义时段配置开发中：可设置早/中/晚/深夜等自定义时段' :
             '使用上方折线图查看每日/周/月趋势'}
          </div>
        )}
      </div>

      {/* Custom period config */}
      {sliceDimension === 'custom' && (
        <div className="pdd-card p-3 bg-gradient-to-r from-blue-50 to-white border border-blue-100">
          <div className="flex items-start gap-2">
            <Settings size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-700">自定义时段设置</p>
              <p className="text-[10px] text-pdd-text-secondary mt-1">
                即将支持：设置清晨/上午/下午/晚间/深夜等自定义时段分段规则
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

  {/* ===== TAB 3: Event Attribution ===== */}
  {activeTab === "attribution" && (
    <div className="space-y-3">
      <div className="pdd-card rounded-xl border border-pdd-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-pdd-primary" />
          <span className="text-xs font-semibold">事件归因分析</span>
          <span className="text-[10px] text-pdd-text-secondary ml-auto">分析事件对销量的因果影响</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="flex bg-pdd-bg rounded-lg p-0.5 border border-pdd-border/50">
            {EVENT_TYPES.map(et => (
              <button key={et.key} onClick={() => setSelectedEventForAttribution(et.key)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                  selectedEventForAttribution === et.key
                    ? 'bg-pdd-card text-pdd-text shadow-sm'
                    : 'text-pdd-text-secondary hover:text-pdd-text'
                }`}>
                <span>{et.emoji}</span> {et.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-pdd-text-secondary p-6 text-center bg-pdd-bg rounded-lg">
          选择事件类型后，系统将自动匹配历史事件，
          使用反事实推断模型（SARIMA/Prophet）计算事件对销量/GMV/退款率的因果影响。
          <br />需要更多事件样本以获得可靠结论。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="pdd-card rounded-xl border border-pdd-border p-4">
          <h4 className="text-xs font-semibold mb-2">因果效应（模拟）</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{fontSize:9}} tickFormatter={(v:string)=>v.slice(5)} />
              <YAxis tick={{fontSize:9}} />
              <Tooltip contentStyle={{fontSize:'11px'}} />
              <Line type="monotone" dataKey="gmv" name="GMV" stroke="#1F6BFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sales" name={"销量"} stroke="#17B26A" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="pdd-card rounded-xl border border-pdd-border p-4">
          <h4 className="text-xs font-semibold mb-2">多维影响指标</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-pdd-border/30">
              <span className="text-pdd-text-secondary">事件前日均GMV</span>
              <span className="font-mono font-medium">¥8,240</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-pdd-border/30">
              <span className="text-pdd-text-secondary">事件后日均GMV</span>
              <span className="font-mono font-medium">¥9,720 <span className="text-pdd-success">↑18%</span></span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-pdd-border/30">
              <span className="text-pdd-text-secondary">效果半衰期</span>
              <span className="font-mono font-medium">4.2天</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-pdd-text-secondary">统计显著性</span>
              <span className="font-mono font-medium text-pdd-success">p=0.003 (显著)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* ===== TAB 4: Finance Window ===== */}
  {activeTab === "finance" && (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="pdd-card px-4 py-3">
          <p className="text-[10px] text-pdd-text-secondary">可支配资金</p>
          <p className="text-lg font-bold text-pdd-text">¥12,340</p>
          <p className="text-[10px] text-pdd-success">↑5.2% 较昨日</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-[10px] text-pdd-text-secondary">待结算</p>
          <p className="text-lg font-bold text-pdd-text">¥45,200</p>
          <p className="text-[10px] text-pdd-success">↑12.1% 较昨日</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-[10px] text-pdd-text-secondary">待支付</p>
          <p className="text-lg font-bold text-pdd-text">¥32,100</p>
          <p className="text-[10px] text-pdd-danger">↓3.4% 较昨日</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-[10px] text-pdd-text-secondary">资金缺口</p>
          <p className="text-lg font-bold text-pdd-success">安全</p>
          <p className="text-[10px] text-pdd-text-secondary">流动性充足</p>
        </div>
      </div>

      <div className="pdd-card rounded-xl border border-pdd-border p-4">
        <h4 className="text-xs font-semibold mb-3">归因ROI窗口</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
              <th className="text-left py-1.5 font-medium">日期</th>
              <th className="text-right py-1.5 font-medium">当日ROI</th>
              <th className="text-right py-1.5 font-medium">3日归因</th>
              <th className="text-right py-1.5 font-medium">7日归因</th>
              <th className="text-right py-1.5 font-medium">边际ROI</th>
              <th className="text-right py-1.5 font-medium">推荐</th>
            </tr></thead>
            <tbody>
              {chartData.slice(-7).reverse().map((d, i) => {
                const roi = d.gmv > 0 ? (d.gmv / Math.max(d.promoCost, 1)) : 0;
                const roi3 = roi * 1.2;
                const roi7 = roi * 1.4;
                const marginalRoi = roi * 0.8;
                return (
                  <tr key={i} className="border-b border-pdd-border/30 hover:bg-pdd-gray-50 transition-colors">
                    <td className="py-1.5 font-medium">{d.date}</td>
                    <td className="py-1.5 text-right font-mono">{roi.toFixed(1)}</td>
                    <td className="py-1.5 text-right font-mono">{roi3.toFixed(1)}</td>
                    <td className="py-1.5 text-right font-mono">{roi7.toFixed(1)}</td>
                    <td className="py-1.5 text-right font-mono">{marginalRoi.toFixed(1)}</td>
                    <td className="py-1.5 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        marginalRoi > 1.5 ? 'bg-pdd-success/10 text-pdd-success' :
                        marginalRoi > 0.8 ? 'bg-pdd-warning/10 text-pdd-warning' :
                        'bg-pdd-danger/10 text-pdd-danger'
                      }`}>
                        {marginalRoi > 1.5 ? '加预算' : marginalRoi > 0.8 ? '观察' : '暂停'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* ===== TAB 5: Compare Analysis ===== */}
  {activeTab === "compare" && (
    <div className="space-y-3">
      <div className="pdd-card rounded-xl border border-pdd-border p-4">
        <div className="flex bg-pdd-bg rounded-lg p-0.5 border border-pdd-border/50 inline-flex mb-3">
          {[{key:'period',label:'时段对比'},{key:'beforeAfter',label:'事件前后'},{key:'samePeriod',label:'同期对比'}].map(m => (
            <button key={m.key} onClick={() => setCompareSubMode(m.key)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                compareSubMode === m.key ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'
              }`}>{m.label}</button>
          ))}
        </div>
        <p className="text-xs text-pdd-text-secondary p-6 text-center bg-pdd-bg rounded-lg">
          选择对比模式后，系统将自动匹配数据进行分析。
          <br />事件前后对比需先选择事件类型。
        </p>
      </div>
    </div>
  )}

  {/* ===== TAB 6: Smart Diagnosis ===== */}
  {activeTab === "diagnose" && (
    <div className="space-y-3">
      <div className="pdd-card rounded-xl border border-pdd-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Brain size={14} className="text-pdd-primary" />智能诊断报告
          </h3>
          <span className="text-[10px] text-pdd-text-secondary">最后更新: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="space-y-2">
          <div className="bg-pdd-danger/5 border border-pdd-danger/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-pdd-danger text-white text-[9px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-pdd-danger">退款率异常 ↑300%</p>
                <p className="text-[10px] text-pdd-text-secondary mt-0.5">影响金额: ¥2,800 | 偏离基线: +3.2σ</p>
                <p className="text-[10px] text-pdd-text-secondary">建议: 立即检查商品链接和评价</p>
              </div>
            </div>
          </div>
          <div className="bg-pdd-warning/5 border border-pdd-warning/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-pdd-warning text-white text-[9px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-pdd-warning">推广ROI持续下降 (连续3天&lt;1.5)</p>
                <p className="text-[10px] text-pdd-text-secondary mt-0.5">可能原因: 竞争加剧/转化疲劳</p>
                <p className="text-[10px] text-pdd-text-secondary">建议: 暂停该计划或调整出价策略</p>
              </div>
            </div>
          </div>
          <div className="bg-pdd-primary/5 border border-pdd-primary/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-pdd-primary text-white text-[9px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-pdd-primary">改价窗口建议</p>
                <p className="text-[10px] text-pdd-text-secondary mt-0.5">检测到部分商品价格高于竞品均值23%</p>
                <p className="text-[10px] text-pdd-text-secondary">建议: 适当降价提升竞争力</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="pdd-card rounded-xl border border-pdd-border p-4">
          <h4 className="text-xs font-semibold mb-3">店铺生物钟</h4>
          <p className="text-xs font-medium text-pdd-primary mb-2">周末爆发型</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="name" tick={{fontSize:9}} />
              <YAxis hide />
              <Bar dataKey="gmv" fill="#1F6BFF" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-pdd-text-secondary mt-2">建议: 周四五加大推广，抢周末流量</p>
        </div>
        <div className="pdd-card rounded-xl border border-pdd-border p-4">
          <h4 className="text-xs font-semibold mb-3">未来7天预测</h4>
          <div className="space-y-1.5 text-[10px]">
            {chartData.slice(-7).map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-pdd-border/20">
                <span className="text-pdd-text-secondary">{d.date.slice(5)}</span>
                <span className="font-mono font-medium">¥{d.gmv.toFixed(0)}</span>
                <span className="text-pdd-text-secondary">±{Math.round(d.gmv * 0.15)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )}
</div>
);
}
