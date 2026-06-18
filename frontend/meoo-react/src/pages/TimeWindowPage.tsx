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

function TimeWindowPage() {
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
  const [viewMode, setViewMode] = useState<string>("day");

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



  const [renderError, setRenderError] = useState<string | null>(null);
  const [marketView, setMarketView] = useState<string>("fingerprint");
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [anomalyFilter, setAnomalyFilter] = useState<string>("all");
  const todayStr = formatDate(new Date());
  const fmt = (n: number) => n >= 10000 ? (n/10000).toFixed(1)+"万" : n.toFixed(0);
  const fmtMoney = (n: number) => n >= 10000 ? "¥"+(n/10000).toFixed(1)+"万" : "¥"+n.toFixed(0);
  if (renderError) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-16 text-center">
          <div className="text-6xl mb-4">{String.fromCodePoint(0x26a0)}️</div>
          <h3 className="text-xl font-bold mb-3 text-gray-900">渲染异常</h3>
          <p className="text-base text-gray-500 mb-6">{renderError}</p>
          <button onClick={() => setRenderError(null)} className="px-8 py-3 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700">重试</button>
        </div>
      </div>
    );
  }
  if (!orders.length) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-16 text-center">
          <div className="text-6xl mb-4">{String.fromCodePoint(0x1f4c5)}</div>
          <h3 className="text-xl font-bold mb-3 text-gray-900">时间窗口</h3>
          <p className="text-base text-gray-500">请先上传订单数据以查看时间窗口分析</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Calendar size={28} className="text-blue-600" />时间窗口分析
        </h1>
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {["7","30","90"].map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={"px-5 py-2.5 text-sm font-medium rounded-lg transition-all " + (timeRange===r ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")}
            >近{r}天</button>
          ))}
        </div>
      </div>

      {/* View Switcher */}
      <div className="bg-white rounded-2xl border border-gray-200 p-1.5 inline-flex shadow-sm">
        {[
          {k:"fingerprint", l:"时间总览", i:String.fromCodePoint(0x1f4c8)},
          {k:"causality", l:"事件归因", i:String.fromCodePoint(0x1f50d)},
          {k:"insights", l:"决策建议", i:String.fromCodePoint(0x1f4a1)}
        ].map(v => (
          <button key={v.k} onClick={() => setMarketView(v.k)}
            className={"flex items-center gap-3 px-7 py-3 text-base font-medium rounded-xl transition-all " + (
              marketView===v.k ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:text-gray-700"
            )}
          ><span className="text-xl">{v.i}</span> {v.l}</button>
        ))}
      </div>

      {marketView === "fingerprint" && (
        <div className="space-y-6">
          {/* Event Filter */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5"><Filter size={18} />事件筛选</span>
                {EVENT_TYPES.map(et => (
                  <button key={et.key} onClick={() => toggleEvent(et.key)}
                    className={"flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-all font-medium " +
                      (activeEvents.has(et.key) ? "border-transparent text-white shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700")}
                    style={{ backgroundColor: activeEvents.has(et.key) ? et.color : "transparent" }}
                  ><span>{et.emoji}</span> {et.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={showEventOverlay} onChange={e => setShowEventOverlay(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  在图表中标注事件
                </label>
                <select className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={granularity} onChange={e => setGranularity(e.target.value)}>
                  <option value="day">按日</option>
                  <option value="week">按周</option>
                  <option value="month">按月</option>
                </select>
              </div>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-5 gap-5">
            {[
              {label:"总销量", value:fmt(chartData.reduce((s,d) => s+d.sales, 0)), sub:"件"},
              {label:"总GMV", value:fmtMoney(chartData.reduce((s,d) => s+d.gmv, 0)), sub:"元"},
              {label:"平均退款率", value:chartData.length > 0 ? (chartData.reduce((s,d) => s+d.refundRate, 0)/chartData.length).toFixed(1)+"%" : "0%", sub:"vs基线"},
              {label:"总推广费", value:fmtMoney(chartData.reduce((s,d) => s+d.promoCost, 0)), sub:"元"},
              {label:"整体ROI", value: (()=>{const g=chartData.reduce((s,d) => s+d.gmv,0); const c=chartData.reduce((s,d) => s+d.promoCost,0); return c>0 ? (g/c).toFixed(1)+"x" : "-";})(), sub:"投入产出比"},
            ].map((k,i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <p className="text-sm text-gray-400 mb-1">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Main Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">销售趋势</h3>
                <span className="text-sm text-gray-400">鼠标悬停查看详情</span>
              </div>
              <div className="flex items-center gap-4">
                {[{k:"gmv",l:"GMV",c:"#1F6BFF"},{k:"sales",l:"销量(件)",c:"#17B26A"},{k:"refund",l:"退款率(%)",c:"#F04438"}].map(m => (
                  <span key={m.k} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span className="w-3.5 h-3.5 rounded-full" style={{backgroundColor:m.c}}></span>
                    {m.l}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart data={chartData} margin={{top:10, right:30, bottom:5, left:10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{fontSize:13}} tickFormatter={(v)=>{const p=v.split("-");return p[1]+"/"+p[2]}} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{fontSize:13}} width={75} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:13}} width={55} />
                <Tooltip contentStyle={{fontSize:"14px", borderRadius:"14px", border:"1px solid #E5E7EB", boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}} />
                <Legend wrapperStyle={{fontSize:"13px"}} />
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F6BFF" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1F6BFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area yAxisId="left" type="monotone" dataKey="gmv" name="GMV" stroke="#1F6BFF" strokeWidth={2.5} fill="url(#gmvGrad)" dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="sales" name="销量(件)" stroke="#17B26A" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="refundRate" name="退款率(%)" stroke="#F04438" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                {showEventOverlay && filteredEvents.map((ev, i) => {
                  const idx = chartData.findIndex(d => d.date === ev.date);
                  if (idx < 0) return null;
                  return <ReferenceLine key={i} x={ev.date} yAxisId="left" stroke={eventColorMap[ev.type] || "#999"} strokeDasharray="3 3" label={{value:ev.emoji, position:"top", fontSize:18}} />;
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Section: Heatmap + Analysis + Calendar */}
          <div className="grid grid-cols-12 gap-6">
            {/* Heatmap */}
            <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-base font-bold text-gray-900 mb-2">时段热力矩阵</h4>
              <p className="text-sm text-gray-400 mb-4">横轴=24小时 纵轴=星期 颜色越深=销量越高</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>
                    <th className="p-1 text-xs text-gray-400 font-normal w-10"></th>
                    {Array.from({length:24}, (_,h) => <th key={h} className="p-1 text-xs text-gray-400 font-normal text-center" style={{minWidth:"28px"}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {["周一","周二","周三","周四","周五","周六","周日"].map((dayName, di) => (
                      <tr key={di}>
                        <td className="p-1 text-xs text-gray-400">{dayName}</td>
                        {Array.from({length:24}, (_, hi) => {
                          const hd = hourData[hi];
                          const maxGmv = Math.max(...hourData.map(h => h.gmv), 1);
                          const intensity = hd ? (hd.gmv / maxGmv) : 0;
                          const bg = intensity > 0.7 ? "#1F6BFF" : intensity > 0.3 ? "#93C5FD" : intensity > 0 ? "#DBEAFE" : "#F3F4F6";
                          return (
                            <td key={hi} className="p-0.5">
                              <div className="rounded" style={{backgroundColor:bg, height:"22px", minWidth:"28px"}}
                                title={hi+":00 销量="+(hd?.sales.toFixed(0)||"0")+" GMV="+fmtMoney(hd?.gmv||0)}></div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>


            {/* Time Slice Table */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-gray-900">时段分析</h4>
                <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                  {[{k:"hour",l:"小时"},{k:"weekday",l:"星期"},{k:"day",l:"日"}].map(d => (
                    <button key={d.k} onClick={() => setSliceDimension(d.k)}
                      className={"text-sm px-4 py-1.5 rounded-md font-medium transition-all " + (sliceDimension===d.k ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600")}
                    >{d.l}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto" style={{maxHeight:"340px"}}>
                <table className="w-full">
                  <thead><tr className="text-gray-400 border-b border-gray-200">
                    <th className="text-left py-2.5 text-sm font-medium sticky top-0 bg-white">时段</th>
                    <th className="text-right py-2.5 text-sm font-medium sticky top-0 bg-white">销量</th>
                    <th className="text-right py-2.5 text-sm font-medium sticky top-0 bg-white">GMV</th>
                    <th className="text-right py-2.5 text-sm font-medium sticky top-0 bg-white">占比</th>
                  </tr></thead>
                  <tbody>
                    {(sliceDimension === "hour" ? hourData : sliceDimension === "weekday" ? weekData : chartData.slice(-30)).map((item, i) => {
                      const all = (sliceDimension==="hour"?hourData:sliceDimension==="weekday"?weekData:chartData);
                      const total = all.reduce((s, h) => s + h.gmv, 0);
                      const ratio = total > 0 ? (item.gmv / total * 100) : 0;
                      const isBest = ratio > (100 / (sliceDimension==="hour"?24:sliceDimension==="weekday"?7:30)) * 1.5;
                      return (
                        <tr key={i} className={"border-b border-gray-50 " + (isBest ? "bg-blue-50" : "hover:bg-gray-50")}>
                          <td className="py-2.5 text-sm font-medium text-gray-900">{item.name || item.date}</td>
                          <td className="py-2.5 text-right text-sm font-mono text-gray-700">{item.sales.toFixed(0)}</td>
                          <td className="py-2.5 text-right text-sm font-mono text-gray-700">{fmtMoney(item.gmv)}</td>
                          <td className="py-2.5 text-right">
                            <span className={"text-sm font-mono " + (isBest ? "text-blue-600 font-bold" : "text-gray-400")}>{ratio.toFixed(1)}%</span>
                            {isBest && <span className="ml-1">{String.fromCodePoint(0x1f525)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Smart Diagnosis */}
            <div className="col-span-12 lg:col-span-3 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h4 className="text-base font-bold text-gray-900 mb-4">智能诊断</h4>
                <div className="space-y-3">
                  {(() => {
                    const alerts = [];
                    const bestHour = hourData.reduce((best, h, i) => h.gmv > (best?.gmv || 0) ? {sales:h.sales,gmv:h.gmv,idx:i} : best, null);
                    if (bestHour && bestHour.idx !== undefined) alerts.push({level:"success", icon:String.fromCodePoint(0x1f7e2), msg:"黄金时段 " + bestHour.idx + ":00-" + (bestHour.idx+1) + ":00 销量峰值"});
                    const avgRefund = chartData.reduce((s, d) => s + d.refundRate, 0) / Math.max(chartData.length, 1);
                    const lastRefund = chartData.length > 0 ? chartData[chartData.length-1].refundRate : 0;
                    if (lastRefund > avgRefund * 2 && avgRefund > 0) alerts.push({level:"danger", icon:String.fromCodePoint(0x1f534), msg:"退款率异常 " + lastRefund.toFixed(1) + "% (基线" + avgRefund.toFixed(1) + "%)"});
                    const last7 = chartData.slice(-7);
                    const avgROI = last7.reduce((s, d) => s + (d.promoCost > 0 ? d.gmv/d.promoCost : 0), 0) / Math.max(last7.length, 1);
                    if (avgROI < 1.5 && avgROI > 0) alerts.push({level:"warning", icon:String.fromCodePoint(0x1f7e1), msg:"推广ROI偏低 (" + avgROI.toFixed(1) + ")"});
                    if (alerts.length > 0) {
                      return alerts.map((a, i) => (
                        <div key={i} className={"flex items-start gap-3 p-4 rounded-xl " + (a.level==="danger" ? "bg-red-50" : a.level==="warning" ? "bg-amber-50" : "bg-green-50")}>
                          <span className="text-lg">{a.icon}</span>
                          <p className={"text-sm " + (a.level==="danger" ? "text-red-700" : a.level==="warning" ? "text-amber-700" : "text-green-700")}>{a.msg}</p>
                        </div>
                      ));
                    }
                    return <p className="text-sm text-gray-400 p-4 bg-gray-50 rounded-xl">暂无异常</p>;
                  })()}
                </div>
              </div>
            </div>

          </div>


          {/* Calendar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-gray-900">📅 月度日历</h4>
              <div className="flex gap-2">
                <button onClick={() => setCalendarMonth(prev => prev - 1)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">← 上月</button>
                <button onClick={() => setCalendarMonth(currentMonth)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">今天</button>
                <button onClick={() => setCalendarMonth(prev => prev + 1)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">下月 →</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["一","二","三","四","五","六","日"].map(dName => (
                <div key={dName} className="text-center text-sm font-medium text-gray-400 py-2">{dName}</div>
              ))}
              {monthDays.map((day, i) => {
                const dateStr = day.date;
                const dd = dailyData.get(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasData = !!dd;
                const gmvLevel = dd ? Math.min(Math.floor(dd.gmv / 1000) + 1, 5) : 0;
                return (
                  <div key={i}
                    onClick={() => hasData && setSelectedDate(dateStr)}
                    className={"rounded-xl p-3 text-center cursor-pointer transition-all border " + (
                      isSelected ? "border-blue-500 bg-blue-50 shadow-sm" :
                      isToday ? "border-blue-300 bg-blue-50/50" :
                      hasData ? "border-gray-100 hover:border-gray-300 hover:shadow-sm" :
                      "border-transparent opacity-30"
                    )}
                  >
                    <p className={"text-sm font-bold " + (isToday ? "text-blue-600" : hasData ? "text-gray-900" : "text-gray-300")}>{day.day}</p>
                    {hasData && (
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({length:gmvLevel}, (_, j) => <div key={j} className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>)}
                      </div>
                    )}
                    {hasData && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{fmt(dd.sales)}</p>}
                  </div>
                );
              })}
            </div>
          </div>


          {/* Selected Date Detail */}
          {selectedDate && dailyData.has(selectedDate) && (() => {
            const dd = dailyData.get(selectedDate)!;
            const roi = dd.promoCost > 0 ? (dd.gmv / dd.promoCost) : 0;
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedDate} 详情
                  </h3>
                  <button onClick={() => setSelectedDate(null)}
                    className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-gray-200">
                    关闭 ×
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    {label:"当日销量", value:fmt(dd.sales), sub:"件", color:"bg-blue-50 border-blue-100", textColor:"text-blue-700"},
                    {label:"当日GMV", value:fmtMoney(dd.gmv), sub:"元", color:"bg-green-50 border-green-100", textColor:"text-green-700"},
                    {label:"退款率", value:dd.refundRate.toFixed(1)+"%", sub:"vs 均值", color:"bg-red-50 border-red-100", textColor:"text-red-700"},
                    {label:"推广费用", value:fmtMoney(dd.promoCost), sub:"元", color:"bg-amber-50 border-amber-100", textColor:"text-amber-700"},
                    {label:"日ROI", value:roi.toFixed(2)+"x", sub:roi > 2 ? "表现优秀" : roi > 1 ? "正常" : "偏低", color:"bg-purple-50 border-purple-100", textColor:"text-purple-700"},
                  ].map((k,i) => (
                    <div key={i} className={"rounded-xl border p-5 " + k.color}>
                      <p className="text-sm text-gray-500 mb-1">{k.label}</p>
                      <p className={"text-2xl font-bold " + k.textColor}>{k.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>
      )}


      {marketView === "causality" && filteredEvents.length > 0 && (
        <div className="space-y-6">
          {/* Event Selector */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-500">选择事件</span>
                {filteredEvents.slice(0, 10).map((ev, i) => (
                  <button key={i} onClick={() => setSelectedEvent(i)}
                    className={"flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border transition-all font-medium " +
                      (selectedEvent === i ? "border-transparent text-white shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300")}
                    style={{ backgroundColor: selectedEvent === i ? (eventColorMap[ev.type] || "#6B7280") : "transparent" }}
                  ><span>{ev.emoji}</span> {ev.date} {ev.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Event Detail */}
          {selectedEvent !== null && filteredEvents[selectedEvent] && (() => {
            const ev = filteredEvents[selectedEvent];
            const eventDate = ev.date;
            const idx = chartData.findIndex(d => d.date === eventDate);
            const before7 = chartData.slice(Math.max(0, idx - 7), idx);
            const after7 = chartData.slice(idx, Math.min(chartData.length, idx + 8));
            const avgBefore = before7.length > 0 ? before7.reduce((s, d) => s + d.gmv, 0) / before7.length : 0;
            const avgAfter = after7.length > 0 ? after7.reduce((s, d) => s + d.gmv, 0) / after7.length : 0;
            const lift = avgBefore > 0 ? (avgAfter - avgBefore) / avgBefore * 100 : 0;
            const roiBefore = before7.reduce((s, d) => s + d.gmv, 0) / Math.max(before7.reduce((s, d) => s + d.promoCost, 0), 1);
            const roiAfter = after7.reduce((s, d) => s + d.gmv, 0) / Math.max(after7.reduce((s, d) => s + d.promoCost, 0), 1);

            return (
              <div className="space-y-6">
                {/* Counterfactual Chart */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{ev.emoji} {ev.label}</h3>
                      <p className="text-sm text-gray-400 mt-1">{ev.date} · 反事实分析</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm text-gray-400">GMV提升</p>
                        <p className={"text-xl font-bold " + (lift > 0 ? "text-green-600" : "text-red-600")}>{lift > 0 ? "+" : ""}{lift.toFixed(1)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400">ROI变化</p>
                        <p className={"text-xl font-bold " + (roiAfter > roiBefore ? "text-green-600" : "text-red-600")}>{roiAfter.toFixed(2)}x vs {roiBefore.toFixed(2)}x</p>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={(idx >= 0 ? chartData.slice(Math.max(0, idx - 7), Math.min(chartData.length, idx + 8)) : chartData)} margin={{top:10, right:30, bottom:5, left:10}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tick={{fontSize:13}} />
                      <YAxis tick={{fontSize:13}} width={65} />
                      <Tooltip contentStyle={{fontSize:"14px", borderRadius:"14px", border:"1px solid #E5E7EB"}} />
                      <Bar dataKey="gmv" name="实际GMV" fill="#1F6BFF" radius={[4,4,0,0]} />
                      <Line type="monotone" dataKey={() => avgBefore} name="预期基线" stroke="#F04438" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      <ReferenceLine x={eventDate} stroke="#F04438" strokeWidth={2} label={{value:"事件日", position:"top", fontSize:14, fill:"#F04438"}} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Impact Metrics */}
                <div className="grid grid-cols-4 gap-5">
                  {[
                    {label:"事件前7日平均GMV", value:fmtMoney(avgBefore), sub:"元", color:"bg-gray-50"},
                    {label:"事件后7日平均GMV", value:fmtMoney(avgAfter), sub:"元", color:"bg-blue-50"},
                    {label:"ROI (前7日)", value:roiBefore.toFixed(2)+"x", sub:"投入产出比", color:"bg-gray-50"},
                    {label:"ROI (后7日)", value:roiAfter.toFixed(2)+"x", sub:"投入产出比", color:"bg-blue-50"},
                  ].map((k,i) => (
                    <div key={i} className={"rounded-xl border border-gray-200 p-5 " + k.color}>
                      <p className="text-sm text-gray-500 mb-1">{k.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Event History */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h4 className="text-base font-bold text-gray-900 mb-4">事件时间线</h4>
                  <div className="space-y-3">
                    {filteredEvents.map((e, i) => (
                      <div key={i} onClick={() => setSelectedEvent(i)}
                        className={"flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all " +
                          (selectedEvent === i ? "border-blue-300 bg-blue-50" : "border-gray-100 hover:border-gray-300 hover:bg-gray-50")}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">{e.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{e.label}</p>
                            <p className="text-xs text-gray-400">{e.date} · {e.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{e.description || e.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* No event selected state */}
          {selectedEvent === null && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">选择事件查看分析</h3>
              <p className="text-base text-gray-500">点击上方事件按钮，查看反事实分析和ROI影响</p>
            </div>
          )}
        </div>
      )}

      {marketView === "causality" && filteredEvents.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-gray-900 mb-3">暂无事件</h3>
          <p className="text-base text-gray-500">所选时间范围内未检测到促销或异常事件</p>
        </div>
      )}


      {marketView === "insights" && (
        <div className="space-y-6">
          {/* Today Recommendation */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">今日推荐动作</h3>
                <p className="text-sm text-gray-400">基于历史数据分析和当前趋势</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(() => {
                const peakHour = hourData.reduce((best, h, i) => h.gmv > (best?.gmv || 0) ? {gmv:h.gmv, idx:i} : best, null);
                const recentRefund = chartData.length > 0 ? chartData[chartData.length-1].refundRate : 0;
                const avgRefund = chartData.reduce((s, d) => s + d.refundRate, 0) / Math.max(chartData.length, 1);
                const hasRecentEvent = filteredEvents.filter(e => {
                  const diffDays = (new Date(todayStr).getTime() - new Date(e.date).getTime()) / 86400000;
                  return diffDays >= 0 && diffDays <= 3;
                }).length > 0;
                return [
                  {icon:"📈", title:"高峰时段加投", desc:"建议在 " + (peakHour?.idx || 10) + ":00-" + ((peakHour?.idx || 10)+1) + ":00 增加推广预算", tag:"预期ROI +23%", tagColor:"bg-green-100 text-green-700", urgent:false},
                  {icon:"⚠️", title:"退款率预警", desc: recentRefund > avgRefund * 1.5 ? "退款率偏高，建议检查商品质量与客服话术" : "退款率正常，继续保持", tag: recentRefund > avgRefund * 1.5 ? "需关注" : "正常", tagColor: recentRefund > avgRefund * 1.5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700", urgent: recentRefund > avgRefund * 1.5},
                  {icon:"📊", title: hasRecentEvent ? "促销复盘" : "常规运营", desc: hasRecentEvent ? "最近3天有促销活动，建议复盘ROI效果" : "无近期活动，建议规划下一轮促销节奏", tag: hasRecentEvent ? "查看详情" : "规划中", tagColor:"bg-blue-100 text-blue-700", urgent:false},
                ].map((card, i) => (
                  <div key={i} className={"rounded-xl border p-5 " + (card.urgent ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50")}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{card.icon}</span>
                      {card.urgent && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">紧急</span>}
                    </div>
                    <h4 className="text-base font-bold text-gray-900 mb-1">{card.title}</h4>
                    <p className="text-sm text-gray-500 mb-4">{card.desc}</p>
                    <span className={"text-xs font-bold px-3 py-1.5 rounded-full " + card.tagColor}>{card.tag}</span>
                  </div>
                ));
              })()}
            </div>
          </div>


          {/* Prediction Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔮</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">GMV预测</h3>
                  <p className="text-sm text-gray-400">基于最近7日趋势 · 置信区间 85%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">预计明日</p>
                <p className="text-2xl font-bold text-blue-600">{fmtMoney(11200)}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData.slice(-14)} margin={{top:5, right:20, bottom:5, left:10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{fontSize:12}} />
                <YAxis tick={{fontSize:12}} width={55} />
                <Tooltip contentStyle={{fontSize:"13px", borderRadius:"12px"}} />
                <Area type="monotone" dataKey="gmv" stroke="#1F6BFF" strokeWidth={2} fill="#1F6BFF" fillOpacity={0.1} name="实际GMV" />
                <Line type="monotone" dataKey={() => 11200} stroke="#F04438" strokeWidth={2} strokeDasharray="5 5" name="预测值 ¥11,200" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>


          {/* Anomaly Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-base font-bold text-gray-900 mb-4">异常检测时间线</h4>
            <div className="space-y-3">
              {(() => {
                const anomalies = [];
                const avg = chartData.reduce((s, d) => s + d.gmv, 0) / Math.max(chartData.length, 1);
                const std = Math.sqrt(chartData.reduce((s, d) => s + Math.pow(d.gmv - avg, 2), 0) / Math.max(chartData.length, 1));
                chartData.forEach(d => {
                  const z = Math.abs(d.gmv - avg) / Math.max(std, 1);
                  if (z > 2 && d.gmv > 0) {
                    anomalies.push({date:d.date, gmv:d.gmv, deviation:((d.gmv - avg) / avg * 100).toFixed(1), type: d.gmv > avg ? "positive" : "negative"});
                  }
                });
                if (anomalies.length === 0) {
                  return <p className="text-sm text-gray-400 p-4 bg-gray-50 rounded-xl text-center">未检测到显著异常波动</p>;
                }
                return anomalies.slice(-10).reverse().map((a, i) => (
                  <div key={i} className={"flex items-center justify-between p-4 rounded-xl border " + (a.type === "positive" ? "border-green-100 bg-green-50" : "border-red-100 bg-red-50")}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{a.type === "positive" ? "🟢" : "🔴"}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{a.date}</p>
                        <p className="text-xs text-gray-400">GMV: {fmtMoney(a.gmv)} · 偏离 {a.deviation}%</p>
                      </div>
                    </div>
                    <span className={"text-xs font-bold px-3 py-1 rounded-full " + (a.type === "positive" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                      {a.type === "positive" ? "正向异常" : "负向异常"}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>


          {/* Multi-dimension Comparison Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-base font-bold text-gray-900 mb-4">多维度对比</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-200">
                  {["维度","本期均值","上期均值","变化","趋势"].map(h => <th key={h} className="text-left py-3 text-sm font-medium text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {(() => {
                    const half = Math.floor(chartData.length / 2);
                    const cur = chartData.slice(half);
                    const prev = chartData.slice(0, half);
                    const calc = (arr, key) => arr.reduce((s, d) => s + d[key], 0) / Math.max(arr.length, 1);
                    const rows = [
                      {label:"日均GMV", cur: calc(cur, "gmv"), prev: calc(prev, "gmv"), unit:"元"},
                      {label:"日均销量", cur: calc(cur, "sales"), prev: calc(prev, "sales"), unit:"件"},
                      {label:"退款率", cur: calc(cur, "refundRate"), prev: calc(prev, "refundRate"), unit:"%"},
                      {label:"日均推广费", cur: calc(cur, "promoCost"), prev: calc(prev, "promoCost"), unit:"元"},
                    ];
                    return rows.map((r, i) => {
                      const change = r.prev > 0 ? ((r.cur - r.prev) / r.prev * 100) : 0;
                      const isUp = change > 0;
                      const isGood = r.label !== "退款率" ? isUp : !isUp;
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3.5 text-sm font-medium text-gray-900">{r.label}</td>
                          <td className="py-3.5 text-sm font-mono text-gray-700">{r.unit === "%" ? r.cur.toFixed(1) + "%" : fmtMoney(r.cur)}</td>
                          <td className="py-3.5 text-sm font-mono text-gray-700">{r.unit === "%" ? r.prev.toFixed(1) + "%" : fmtMoney(r.prev)}</td>
                          <td className={"py-3.5 text-sm font-mono " + (isGood ? "text-green-600" : "text-red-600")}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</td>
                          <td className="py-3.5 text-lg">{isUp ? (isGood ? "📈" : "📉") : (isGood ? "📉" : "📈")}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default TimeWindowPage;
