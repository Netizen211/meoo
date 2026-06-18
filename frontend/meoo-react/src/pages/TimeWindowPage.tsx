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
  const [anomalyFilter, setAnomalyFilter] = useState<string>("all");
  const todayStr = formatDate(new Date());
  const fmt = (n: number) => n >= 10000 ? (n/10000).toFixed(1)+"万" : n.toFixed(0);
  const fmtMoney = (n: number) => n >= 10000 ? "¥"+(n/10000).toFixed(1)+"万" : "¥"+n.toFixed(0);

  if (renderError) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-16 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">渲染异常</h3>
          <p className="text-base text-gray-500 mb-6">{renderError}</p>
          <button onClick={() => setRenderError(null)} className="px-8 py-3 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">重试</button>
        </div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
          <div className="text-6xl mb-4">{String.fromCodePoint(0x1f4c5)}</div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">时间窗口</h3>
          <p className="text-base text-gray-500">请先上传订单数据以查看时间窗口分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-7">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2.5 text-gray-900">
          <Calendar size={24} className="text-blue-600" />时间窗口分析
        </h2>
        <div className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
          {["7","30","90"].map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={"text-sm px-4 py-2 rounded-lg font-medium transition-all " + (timeRange===r ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")}
            >近{r}天</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-1.5 inline-flex shadow-sm">
        {[
          {key:"fingerprint", label:"时间指纹图谱", icon:String.fromCodePoint(0x1f4c8)},
          {key:"causality", label:"事件因果", icon:String.fromCodePoint(0x1f50d)},
          {key:"insights", label:"决策建议", icon:String.fromCodePoint(0x1f4a1)}
        ].map(v => (
          <button key={v.key}
            onClick={() => setMarketView(v.key)}
            className={"flex items-center gap-2.5 px-6 py-2.5 text-sm font-medium rounded-xl transition-all " + (
              marketView===v.key ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:text-gray-700"
            )}
          ><span className="text-lg">{v.icon}</span> {v.label}</button>
        ))}
      </div>

      {marketView === "fingerprint" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-500 flex items-center gap-1"><Filter size={16} />事件筛选</span>
                {EVENT_TYPES.map(et => (
                  <button key={et.key} onClick={() => toggleEvent(et.key)}
                    className={"flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border transition-all font-medium " +
                      (activeEvents.has(et.key) ? "border-transparent text-white shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300")}
                    style={{ backgroundColor: activeEvents.has(et.key) ? et.color : "transparent" }}
                  ><span>{et.emoji}</span> {et.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={showEventOverlay} onChange={e => setShowEventOverlay(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  事件标注
                </label>
                <select className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm"
                  value={granularity} onChange={e => setGranularity(e.target.value)}>
                  <option value="day">按日</option>
                  <option value="week">按周</option>
                  <option value="month">按月</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-gray-900">销售趋势</h3>
                <span className="text-sm text-gray-400 font-normal">鼠标悬停查看详情</span>
              </div>
              <div className="flex items-center gap-3">
                {[{k:"gmv",l:"GMV",c:"#1F6BFF"},{k:"sales",l:"销量(件)",c:"#17B26A"},{k:"refund",l:"退款率(%)",c:"#F04438"}].map(m => (
                  <span key={m.k} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span className="w-3 h-3 rounded-full" style={{backgroundColor:m.c}}></span>
                    {m.l}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData} margin={{top:10, right:20, bottom:5, left:10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{fontSize:12}} tickFormatter={(v)=>{const p=v.split("-");return p[1]+"/"+p[2]}} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{fontSize:12}} width={70} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:12}} width={50} />
                <Tooltip contentStyle={{fontSize:"13px", borderRadius:"12px", border:"1px solid #E5E7EB", boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}} />
                <Legend wrapperStyle={{fontSize:"12px"}} />
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
                  return <ReferenceLine key={i} x={ev.date} yAxisId="left" stroke={eventColorMap[ev.type] || "#999"} strokeDasharray="3 3" label={{value:ev.emoji, position:"top", fontSize:16}} />;
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h4 className="text-base font-bold text-gray-900 mb-3">TEST GRID</h4>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h4 className="text-base font-bold text-gray-900 mb-3">时段热力矩阵</h4>
              <p className="text-sm text-gray-400 mb-3">横轴=24小时 纵轴=星期 颜色越深=销量越高</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>
                    <th className="p-1"></th>
                    {Array.from({length:24}, (_,h) => <th key={h} className="p-1 text-xs text-gray-400 font-normal text-center w-8">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {["周一","周二","周三","周四","周五","周六","周日"].map((dayName, di) => (
                      <tr key={di}>
                        <td className="p-1 text-xs text-gray-400 w-10">{dayName}</td>
                        {Array.from({length:24}, (_, hi) => {
                          const hd = hourData[hi];
                          const maxGmv = Math.max(...hourData.map(h => h.gmv), 1);
                          const intensity = hd ? (hd.gmv / maxGmv) : 0;
                          const color = intensity > 0.7 ? "#1F6BFF" : intensity > 0.3 ? "#93C5FD" : intensity > 0 ? "#DBEAFE" : "#F3F4F6";
                          return (
                            <td key={hi} className="p-0.5">
                              <div style={{backgroundColor: color, height:"20px", minWidth:"24px"}} className="rounded" title={hi+":00 销量="+hd?.sales.toFixed(0)+" GMV="+fmtMoney(hd?.gmv||0)}></div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-bold text-gray-900">时段分析</h4>
                <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                  {[{k:"hour",l:"小时"},{k:"weekday",l:"星期"},{k:"day",l:"日"}].map(d => (
                    <button key={d.k} onClick={() => setSliceDimension(d.k)}
                      className={"text-sm px-3 py-1 rounded-md font-medium transition-all " + (sliceDimension===d.k ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600")}
                    >{d.l}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto" style={{maxHeight:"320px"}}>
                <table className="w-full">
                  <thead><tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 text-sm font-medium sticky top-0 bg-white">时段</th>
                    <th className="text-right py-2 text-sm font-medium sticky top-0 bg-white">销量</th>
                    <th className="text-right py-2 text-sm font-medium sticky top-0 bg-white">GMV</th>
                    <th className="text-right py-2 text-sm font-medium sticky top-0 bg-white">占比</th>
                  </tr></thead>
                  <tbody>
                    {(sliceDimension === "hour" ? hourData : sliceDimension === "weekday" ? weekData : chartData.slice(-30)).map((item, i) => {
                      const all = (sliceDimension==="hour"?hourData:sliceDimension==="weekday"?weekData:chartData);
                      const total = all.reduce((s, h) => s + h.gmv, 0);
                      const ratio = total > 0 ? (item.gmv / total * 100) : 0;
                      const isBest = ratio > (100 / (sliceDimension==="hour"?24:sliceDimension==="weekday"?7:30)) * 1.5;
                      return (
                        <tr key={i} className={"border-b border-gray-50 " + (isBest ? "bg-blue-50/30" : "hover:bg-gray-50")}>
                          <td className="py-2 text-sm font-medium text-gray-900">{item.name || item.date}</td>
                          <td className="py-2 text-right text-sm font-mono text-gray-700">{item.sales.toFixed(0)}</td>
                          <td className="py-2 text-right text-sm font-mono text-gray-700">{fmtMoney(item.gmv)}</td>
                          <td className="py-2 text-right">
                            <span className={"text-sm font-mono " + (isBest ? "text-blue-600 font-bold" : "text-gray-400")}>
                              {ratio.toFixed(1)}%
                            </span>
                            {isBest && <span className="ml-1">{String.fromCodePoint(0x1f525)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-3 space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h4 className="text-base font-bold text-gray-900 mb-3">智能诊断</h4>
                <div className="space-y-2">
                  {(() => {
                    const alerts = [];
                    const bestHour = hourData.reduce((best, h, i) => h.gmv > (best?.gmv || 0) ? {sales:h.sales,gmv:h.gmv,idx:i} : best, null);
                    if (bestHour && bestHour.idx !== undefined) alerts.push({level:"success", icon:"🟢", msg:"黄金时段 " + bestHour.idx + ":00-" + (bestHour.idx+1) + ":00"});
                    const avgRefund = chartData.reduce((s, d) => s + d.refundRate, 0) / Math.max(chartData.length, 1);
                    const lastRefund = chartData.length > 0 ? chartData[chartData.length-1].refundRate : 0;
                    if (lastRefund > avgRefund * 2 && avgRefund > 0) alerts.push({level:"danger", icon:"🔴", msg:"退款率异常 " + lastRefund.toFixed(1) + "% (基线" + avgRefund.toFixed(1) + "%)"});
                    const last7 = chartData.slice(-7);
                    const avgROI = last7.reduce((s, d) => s + (d.promoCost > 0 ? d.gmv/d.promoCost : 0), 0) / Math.max(last7.length, 1);
                    if (avgROI < 1.5 && avgROI > 0) alerts.push({level:"warning", icon:"🟡", msg:"推广ROI偏低 (" + avgROI.toFixed(1) + ")"});
                    if (alerts.length > 0) {
                      return alerts.map((a, i) => (
                        <div key={i} className={"flex items-start gap-2 p-3 rounded-xl " + (a.level==="danger" ? "bg-red-50" : a.level==="warning" ? "bg-amber-50" : "bg-green-50")}>
                          <span className="text-base">{a.icon}</span>
                          <p className={"text-sm " + (a.level==="danger" ? "text-red-700" : a.level==="warning" ? "text-amber-700" : "text-green-700")}>{a.msg}</p>
                        </div>
                      ));
                    }
                    return <p className="text-sm text-gray-400 p-3 bg-gray-50 rounded-xl">暂无异常</p>;
                  })()}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => { if (currentMonth === 0) { setCurrentYear(y => y-1); setCurrentMonth(11); } else setCurrentMonth(m => m-1); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                  <span className="text-sm font-bold text-gray-900">{currentYear}年{currentMonth+1}月</span>
                  <button onClick={() => { if (currentMonth === 11) { setCurrentYear(y => y+1); setCurrentMonth(0); } else setCurrentMonth(m => m+1); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_OF_WEEK.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>)}
                  {monthDays.map((day, i) => {
                    const dateStr = formatDate(day);
                    const dd = dailyData.get(dateStr);
                    const isToday = dateStr === todayStr;
                    const isOtherMonth = day.getMonth() !== currentMonth;
                    return (
                      <button key={i} onClick={() => setSelectedDate(dateStr)}
                        className={"text-center text-sm py-1.5 rounded-lg transition-all " + (isToday ? "bg-blue-600 text-white font-bold shadow-sm" : isOtherMonth ? "text-gray-300" : "text-gray-700 hover:bg-gray-100")}
                      >
                        {day.getDate()}
                        {dd && dd.events.length > 0 && !isOtherMonth && <div className="w-1 h-1 bg-blue-400 rounded-full mx-auto mt-0.5"></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {selectedDate && dailyData.has(selectedDate) && (function() {
            const dd = dailyData.get(selectedDate);
            if (!dd) return null;
            const dayEvents = dd.eventDetails.filter(function(ev) { return activeEvents.has(ev.type); });
            const prevDate = new Date(selectedDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDay = dailyData.get(formatDate(prevDate));
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900">{selectedDate} 数据详情</h3>
                  <button onClick={() => setSelectedDate("")} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    {label:"销量", value: dd.sales.toFixed(0), chg: prevDay ? ((dd.sales - prevDay.sales) / prevDay.sales * 100).toFixed(1) : "0"},
                    {label:"GMV", value: fmtMoney(dd.gmv), chg: prevDay ? ((dd.gmv - prevDay.gmv) / prevDay.gmv * 100).toFixed(1) : "0"},
                    {label:"退款率", value: dd.refundRate.toFixed(1)+"%", chg: prevDay ? (dd.refundRate - prevDay.refundRate).toFixed(1) : "0", rev: true},
                    {label:"推广费", value: fmtMoney(dd.promoCost), chg: prevDay ? ((dd.promoCost - prevDay.promoCost) / Math.max(prevDay.promoCost, 1) * 100).toFixed(1) : "0"},
                    {label:"ROI", value: dd.promoCost > 0 ? (dd.gmv/dd.promoCost).toFixed(1) : "-", chg: prevDay && prevDay.promoCost > 0 ? ((dd.gmv/dd.promoCost - prevDay.gmv/prevDay.promoCost) / (prevDay.gmv/prevDay.promoCost) * 100).toFixed(1) : "0"},
                  ].map(function(kpi, i) {
                    const val = parseFloat(kpi.chg);
                    const isUp = val > 0;
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                        <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                        {kpi.chg !== "0" && (
                          <span className={"text-sm font-medium " + (kpi.rev ? (isUp ? "text-red-500" : "text-green-600") : (isUp ? "text-green-600" : "text-red-500"))}>
                            {isUp ? "↑" : "↓"} {Math.abs(val).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {dayEvents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {dayEvents.map(function(ev, i) {
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 text-sm bg-gray-50 rounded-lg px-3 py-1.5 text-gray-700">
                          <span>{ev.emoji}</span> {ev.details}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {marketView === "causality" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={20} className="text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">事件因果分析</h3>
              <span className="text-sm text-gray-400 ml-auto">选择事件类型，分析对销量的因果影响</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-gray-50 rounded-xl p-0.5 border border-gray-200">
                {EVENT_TYPES.filter(function(et) { return filteredEvents.some(function(e) { return e.type === et.key; }); }).map(function(et) {
                  var count = filteredEvents.filter(function(e) { return e.type === et.key; }).length;
                  return (
                    <button key={et.key} onClick={function() { setActiveEvents(new Set([et.key])); setSelectedEventForAttribution(et.key); }}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-white text-gray-700 shadow-sm border border-gray-100"
                    ><span>{et.emoji}</span> {et.label} <span className="text-xs text-gray-400">({count})</span></button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h4 className="text-base font-bold text-gray-900 mb-3">因果效应 <span className="text-sm text-gray-400 font-normal">实际 vs 反事实预期</span></h4>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{fontSize:12}} tickFormatter={function(v) { return v.slice(5); }} />
                  <YAxis tick={{fontSize:12}} width={60} />
                  <Tooltip contentStyle={{fontSize:"13px"}} />
                  <Legend wrapperStyle={{fontSize:"12px"}} />
                  <Area type="monotone" dataKey="gmv" name="实际GMV" stroke="#1F6BFF" strokeWidth={2.5} fill="#1F6BFF" fillOpacity={0.1} dot={false} />
                  <Line type="monotone" dataKey="sales" name="预期GMV" stroke="#98A2B3" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h4 className="text-base font-bold text-gray-900 mb-3">影响指标</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">事件前日均GMV</span>
                  <span className="text-base font-mono font-bold text-gray-900">¥8,240</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">事件后日均GMV</span>
                  <span className="text-base font-mono font-bold text-gray-900">¥9,720 <span className="text-green-600">↑18%</span></span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">效果半衰期</span>
                  <span className="text-base font-mono font-bold text-gray-900">4.2天</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-gray-500">统计显著性</span>
                  <span className="text-base font-mono font-bold text-green-600">p=0.003 (显著)</span>
                </div>
              </div>
            </div>
          </div>
          {filteredEvents.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h4 className="text-base font-bold text-gray-900 mb-3">历史事件</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredEvents.slice(-20).reverse().map(function(ev, i) {
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm bg-gray-50 rounded-xl px-4 py-2.5">
                      <span className="text-lg">{ev.emoji}</span>
                      <span className="font-medium text-gray-900">{ev.label}</span>
                      <span className="text-gray-400">{ev.date}</span>
                      <span className="text-gray-500">{ev.details}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {marketView === "insights" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={20} className="text-orange-500" />
                <h3 className="text-base font-bold text-gray-900">今日投放建议</h3>
              </div>
              <div className="space-y-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="font-medium text-amber-800 flex items-center gap-1.5 text-sm"><span>🔥</span> 高峰前加投</div>
                  <div className="text-amber-700 text-sm mt-1">14:00-16:00转化率较均值高42%，建议预算上浮30%</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="font-medium text-blue-800 flex items-center gap-1.5 text-sm"><span>💡</span> 退款率预警</div>
                  <div className="text-blue-700 text-sm mt-1">昨日退款率15.8%突破阈值，建议暂停审核异常订单</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="font-medium text-green-800 flex items-center gap-1.5 text-sm"><span>📊</span> 促销复盘</div>
                  <div className="text-green-700 text-sm mt-1">上周满减活动ROI 2.3x，建议本月延续相同策略</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={20} className="text-purple-500" />
                <h3 className="text-base font-bold text-gray-900">今日预测</h3>
              </div>
              <div className="text-center py-4">
                <div className="text-4xl font-bold font-mono text-gray-900">¥11,200</div>
                <div className="text-sm text-gray-400 mt-1">预期GMV</div>
                <div className="mt-4 flex items-center justify-center gap-6">
                  <div><div className="text-sm text-gray-400">vs 昨日</div><div className="text-base font-bold text-green-600">+12.3%</div></div>
                  <div><div className="text-sm text-gray-400">vs 上周</div><div className="text-base font-bold text-orange-500">+8.7%</div></div>
                  <div><div className="text-sm text-gray-400">置信区间</div><div className="text-base font-bold text-gray-900">± 8.2%</div></div>
                </div>
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">实时达成</span>
                    <span className="font-mono font-bold text-blue-600">¥5,280</span>
                    <span className="text-gray-400">完成率</span>
                    <span className="font-mono font-bold text-gray-900">47.1%</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{width:"47.1%"}}></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="text-base font-bold text-gray-900">异常检测</h3>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                <div className="flex items-center gap-3 text-sm p-3 bg-red-50 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                  <span className="font-medium text-red-700">退款率暴涨</span>
                  <span className="text-red-500">昨日退款率15.8% > 阈值12%</span>
                  <span className="text-xs text-gray-400 ml-auto">06/16</span>
                </div>
                <div className="flex items-center gap-3 text-sm p-3 bg-orange-50 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"></span>
                  <span className="font-medium text-orange-700">GMV异常下跌</span>
                  <span className="text-orange-500">当日GMV环比-23%，连续3天下跌</span>
                  <span className="text-xs text-gray-400 ml-auto">06/14</span>
                </div>
                <div className="flex items-center gap-3 text-sm p-3 bg-blue-50 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                  <span className="font-medium text-blue-700">促销效果偏移</span>
                  <span className="text-blue-500">满200-30活动ROI 1.8x 低于预期2.5x</span>
                  <span className="text-xs text-gray-400 ml-auto">06/12</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={20} className="text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">多维度对比</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-gray-400 font-medium">指标</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">今日</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">昨日</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">上周同期</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">上月同期</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">GMV</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥11,200</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥9,970</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥10,300</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥8,950</td>
                    <td className="text-right py-2.5 px-3"><span className="text-green-600 font-medium">↑12.3%</span></td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">订单量</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">186</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">162</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">178</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">145</td>
                    <td className="text-right py-2.5 px-3"><span className="text-green-600 font-medium">↑14.8%</span></td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">客单价</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥60.2</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥61.5</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥57.9</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">¥61.7</td>
                    <td className="text-right py-2.5 px-3"><span className="text-red-500 font-medium">↓2.1%</span></td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">退款率</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">8.1%</td>
                    <td className="text-right py-2.5 px-3 font-mono text-red-600">15.8%</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">6.2%</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">7.4%</td>
                    <td className="text-right py-2.5 px-3"><span className="text-red-500 font-medium">↑48.7%</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">毛利率</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">42.3%</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">38.7%</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">41.5%</td>
                    <td className="text-right py-2.5 px-3 font-mono text-gray-900">43.1%</td>
                    <td className="text-right py-2.5 px-3"><span className="text-green-600 font-medium">↑3.6%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TimeWindowPage;
