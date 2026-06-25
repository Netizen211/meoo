import React, { useMemo, useState } from "react";
import { TrendingUp, DollarSign, Download, BarChart3 } from "lucide-react";
import { useData } from "../App";
import TimeFilter, { useTimeFilter, safeFloat, filterByTimeRange, getAllDateGroups, filterPromoByTimeRange } from "../components/TimeFilter";
import { UnifiedFilterBar } from "../components/FilterToolbar";
import { findField, safeField } from "../utils/fieldAccess";
import { PROMO_FIELDS } from "../utils/promotionFields";
import { Tooltip as ReTooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

function sfVal(r: any, fs: readonly string[]): number {
  for (const f of fs) { const v = findField(r, f); if (v != null && v !== "") return safeFloat(v); }
  return 0;
}

function sfInt(r: any, fs: readonly string[]): number {
  for (const f of fs) { const v = findField(r, f); if (v != null && v !== "") { const n = parseInt(String(v)); if (!isNaN(n)) return n; } }
  return 0;
}

const YEN = String.fromCharCode(165);
const fmtW = (v: number) => v >= 10000 ? (v / 10000).toFixed(2) + "万" : v.toFixed(2);
const fmtPct = (v: number) => v.toFixed(2) + "%";
const fmtRoi = (v: number) => v.toFixed(2);

export default function PromotionPage() {
  const { currentDisplayData } = useData();
  const tf = useTimeFilter("7", "day");
  const { timeRange, compareEnabled, useNaturalDate, setUseNaturalDate, customStart, customEnd, quickRange } = tf;

  const [sc, setSc] = useState("cost");
  const [sa, setSa] = useState(false);
  const [tm, setTm] = useState("cost");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PS = 10;

  const hp = (currentDisplayData?.promotionSummary?.length ?? 0) > 0 || (currentDisplayData?.promotionProducts?.length ?? 0) > 0;
  const hs = (currentDisplayData?.starStoreSummary?.length ?? 0) > 0;
  const hl = (currentDisplayData?.liveStreamSummary?.length ?? 0) > 0;
  const ha = hp || hs || hl;

  const ord = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => { const st = String(findField(o, '订单状态') || '').trim(); return !['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(st); });
  }, [currentDisplayData]);

  const ad = useMemo(() => {
    const dg = getAllDateGroups(ord);
    if (dg.length > 0) return dg;
    const m: Record<string, any[]> = {};
    const xt = (r: any[], f = "日期") => { r.forEach((x: any) => { const d = String(findField(x, f) || "").trim().replace(/\//g, "-"); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) (m[d] = m[d] || []).push(x); }); };
    xt(currentDisplayData?.promotionSummary || []);
    xt(currentDisplayData?.promotionProducts || []);
    xt(currentDisplayData?.starStoreSummary || []);
    xt(currentDisplayData?.liveStreamSummary || []);
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ord, currentDisplayData]);

  const fPrm = useMemo(() => filterPromoByTimeRange(currentDisplayData?.promotionSummary || [], ad, timeRange, undefined, customStart, customEnd, quickRange), [currentDisplayData, ad, timeRange, customStart, customEnd, quickRange]);
  const fStr = useMemo(() => filterPromoByTimeRange(currentDisplayData?.starStoreSummary || [], ad, timeRange, undefined, customStart, customEnd, quickRange), [currentDisplayData, ad, timeRange, customStart, customEnd, quickRange]);
  const fLiv = useMemo(() => filterPromoByTimeRange(currentDisplayData?.liveStreamSummary || [], ad, timeRange, undefined, customStart, customEnd, quickRange), [currentDisplayData, ad, timeRange, customStart, customEnd, quickRange]);
  const fPrd = useMemo(() => filterPromoByTimeRange(currentDisplayData?.promotionProducts || [], ad, timeRange, undefined, customStart, customEnd, quickRange), [currentDisplayData, ad, timeRange, customStart, customEnd, quickRange]);

  const eSum = useMemo(() => {
    if (currentDisplayData?.promotionSummary?.length) return currentDisplayData.promotionSummary;
    const p = currentDisplayData?.promotionProducts;
    if (!p?.length) return [];
    const m: Record<string, any> = {};
    p.forEach((x: any) => {
      const d = safeField(x, ...PROMO_FIELDS.date).replace(/\//g, "-");
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!m[d]) m[d] = { "日期": d, "花费(元)": 0, "成交笔数": 0, "交易额(元)": 0, "曝光量": 0, "点击量": 0 };
      m[d]["花费(元)"] += sfVal(x, PROMO_FIELDS.cost);
      m[d]["成交笔数"] += sfInt(x, PROMO_FIELDS.orders);
      m[d]["交易额(元)"] += sfVal(x, PROMO_FIELDS.gmv);
      m[d]["曝光量"] += sfInt(x, PROMO_FIELDS.impressions);
      m[d]["点击量"] += sfInt(x, PROMO_FIELDS.clicks);
    });
    return Object.values(m).sort((a: any, b: any) => a["日期"].localeCompare(b["日期"]));
  }, [currentDisplayData]);

  const fESum = useMemo(() => currentDisplayData?.promotionSummary?.length ? fPrm : filterPromoByTimeRange(eSum, ad, timeRange, undefined, customStart, customEnd, quickRange), [currentDisplayData, eSum, fPrm, ad, timeRange, customStart, customEnd, quickRange]);

  const lab = timeRange === "7" ? "近7天" : timeRange === "30" ? "近30天" : timeRange === "90" ? "近90天" : "全部";

  const calc = (r: any[]) => {
    let c = 0, o = 0, g = 0, im = 0, cl = 0;
    r.forEach((x: any) => {
      c += sfVal(x, PROMO_FIELDS.cost);
      o += sfInt(x, PROMO_FIELDS.orders);
      g += sfVal(x, PROMO_FIELDS.gmv);
      im += sfInt(x, PROMO_FIELDS.impressions);
      cl += sfInt(x, PROMO_FIELDS.clicks);
    });
    return { cost: c, ord: o, gmv: g, impr: im, clicks: cl, roi: c > 0 ? g / c : 0, ctr: im > 0 ? (cl / im) * 100 : 0, cvr: cl > 0 ? (o / cl) * 100 : 0, cpc: cl > 0 ? c / cl : 0, cpa: o > 0 ? c / o : 0 };
  };

  const tk = useMemo(() => {
    if (!ha) return null;
    const p = hp ? calc(fESum) : { cost: 0, ord: 0, gmv: 0, impr: 0, clicks: 0, roi: 0, ctr: 0, cvr: 0, cpc: 0, cpa: 0 };
    const s = hs ? calc(fStr) : { cost: 0, ord: 0, gmv: 0, impr: 0, clicks: 0, roi: 0, ctr: 0, cvr: 0, cpc: 0, cpa: 0 };
    const l = hl ? calc(fLiv) : { cost: 0, ord: 0, gmv: 0, impr: 0, clicks: 0, roi: 0, ctr: 0, cvr: 0, cpc: 0, cpa: 0 };
    const tc = p.cost + s.cost + l.cost;
    const tg = p.gmv + s.gmv + l.gmv;
    const to = p.ord + s.ord + l.ord;
    const ti = p.impr + s.impr + l.impr;
    const tcl = p.clicks + s.clicks + l.clicks;
    return { tc, tg, to, ti, tcl, roi: tc > 0 ? tg / tc : 0, ctr: ti > 0 ? (tcl / ti) * 100 : 0, cvr: tcl > 0 ? (to / tcl) * 100 : 0, cpc: tcl > 0 ? tc / tcl : 0, cpa: to > 0 ? tc / to : 0, p, s, l };
  }, [fESum, fStr, fLiv, hp, hs, hl, ha]);

  const td = useMemo(() => {
    if (!hp) return [];
    const m: Record<string, any> = {};
    fESum.forEach((r: any) => {
      const d = safeField(r, ...PROMO_FIELDS.date).replace(/\//g, "-");
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!m[d]) m[d] = { cost: 0, gmv: 0, ord: 0, impr: 0, clicks: 0 };
      m[d].cost += sfVal(r, PROMO_FIELDS.cost);
      m[d].gmv += sfVal(r, PROMO_FIELDS.gmv);
      m[d].ord += sfInt(r, PROMO_FIELDS.orders);
      m[d].impr += sfInt(r, PROMO_FIELDS.impressions);
      m[d].clicks += sfInt(r, PROMO_FIELDS.clicks);
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ date: d.slice(5), cost: Math.round(v.cost), gmv: Math.round(v.gmv), ord: v.ord, impr: v.impr, clicks: v.clicks, roi: v.cost > 0 ? Math.round((v.gmv / v.cost) * 100) / 100 : 0 }));
  }, [fESum, hp]);

  const chDat = useMemo(() => {
    const a: any[] = [];
    if (hp && tk) a.push({ n: "商品推广", k: "p", cost: tk.p.cost, gmv: tk.p.gmv, roi: tk.p.roi, ord: tk.p.ord });
    if (hs && tk) a.push({ n: "明星店铺", k: "s", cost: tk.s.cost, gmv: tk.s.gmv, roi: tk.s.roi, ord: tk.s.ord });
    if (hl && tk) a.push({ n: "直播推广", k: "l", cost: tk.l.cost, gmv: tk.l.gmv, roi: tk.l.roi, ord: tk.l.ord });
    return a;
  }, [hp, hs, hl, tk]);

  const pim = useMemo(() => {
    const m: Record<string, string> = {};
    ord.forEach((o: any) => { const pid = safeField(o, "商品id", "商品ID").replace(/	$/, ""); const nm = safeField(o, "商品", "商品名称"); if (pid && !m[pid]) m[pid] = nm.slice(0, 25); });
    (currentDisplayData?.promotionProducts || []).forEach((r: any) => { const pid = safeField(r, "商品ID", "商品id"); const nm = safeField(r, ...PROMO_FIELDS.productName); if (pid && !m[pid]) m[pid] = nm.slice(0, 25); });
    return m;
  }, [ord, currentDisplayData]);

  const tops = useMemo(() => {
    if (!fPrd.length) return [];
    const pm: Record<string, any> = {};
    fPrd.forEach((r: any) => {
      const pid = safeField(r, "商品ID", "商品id");
      if (!pid) return;
      if (!pm[pid]) pm[pid] = { pid, name: (safeField(r, ...PROMO_FIELDS.productName) || pim[pid] || pid).slice(0, 25), cost: 0, gmv: 0, ord: 0, impr: 0, clicks: 0, sc: new Set() };
      const p = pm[pid];
      p.cost += sfVal(r, PROMO_FIELDS.cost);
      p.gmv += sfVal(r, PROMO_FIELDS.gmv);
      p.ord += sfInt(r, PROMO_FIELDS.orders);
      p.impr += sfInt(r, PROMO_FIELDS.impressions);
      p.clicks += sfInt(r, PROMO_FIELDS.clicks);
      const sc = safeField(r, ...PROMO_FIELDS.scene) || ""; if (sc) p.sc.add(sc);
    });
    const arr = Object.values(pm).map((p: any) => ({
      ...p, roi: p.cost > 0 ? p.gmv / p.cost : 0, ctr: p.impr > 0 ? (p.clicks / p.impr) * 100 : 0, cvr: p.clicks > 0 ? (p.ord / p.clicks) * 100 : 0,
      scs: [...p.sc].join("/"), cpa: p.ord > 0 ? p.cost / p.ord : 0
    }));
    return arr.sort((a, b) => b.cost - a.cost);
  }, [fPrd, pim]);

  const scn = useMemo(() => {
    if (!fPrd.length) return [];
    const m: Record<string, any> = {};
    fPrd.forEach((r: any) => {
      const s = safeField(r, ...PROMO_FIELDS.scene) || "其他";
      if (!m[s]) m[s] = { sc: s, cost: 0, gmv: 0, ord: 0, impr: 0, clicks: 0 };
      m[s].cost += sfVal(r, PROMO_FIELDS.cost);
      m[s].gmv += sfVal(r, PROMO_FIELDS.gmv);
      m[s].ord += sfInt(r, PROMO_FIELDS.orders);
      m[s].impr += sfInt(r, PROMO_FIELDS.impressions);
      m[s].clicks += sfInt(r, PROMO_FIELDS.clicks);
    });
    return Object.values(m).map((x: any) => ({ ...x, roi: x.cost > 0 ? x.gmv / x.cost : 0 })).sort((a, b) => b.cost - a.cost);
  }, [fPrd]);

  // ★ 分小时推广聚合（用于时段热力图）
  const hourlyAgg = useMemo(() => {
    const hourly = currentDisplayData?.promotionHourly || [];
    if (!hourly.length) return null;
    const slotMap: Record<string, { cost: number; gmv: number; orders: number; clicks: number; impressions: number }> = {};
    hourly.forEach((h: any) => {
      const slot = String(h['时段'] || h['小时'] || '');
      if (!slot) return;
      if (!slotMap[slot]) slotMap[slot] = { cost: 0, gmv: 0, orders: 0, clicks: 0, impressions: 0 };
      slotMap[slot].cost += sfVal(h, PROMO_FIELDS.cost);
      slotMap[slot].gmv += sfVal(h, PROMO_FIELDS.gmv);
      slotMap[slot].orders += sfInt(h, PROMO_FIELDS.orders);
      slotMap[slot].clicks += sfInt(h, PROMO_FIELDS.clicks);
      slotMap[slot].impressions += sfInt(h, PROMO_FIELDS.impressions);
    });
    return Object.entries(slotMap)
      .map(([slot, v]) => ({ slot, ...v, roi: v.cost > 0 ? v.gmv / v.cost : 0 }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }, [currentDisplayData?.promotionHourly]);

  const expCSV = () => {
    if (!tops.length) return;
    const h = ["商品名称", "花费", "GMV", "ROI", "订单", "曝光", "点击", "CTR", "CVR", "CPA", "场景"];
    const rows = tops.map((p: any) => [p.name, p.cost.toFixed(2), p.gmv.toFixed(2), p.roi.toFixed(2), p.ord.toString(), p.impr.toString(), p.clicks.toString(), p.ctr.toFixed(2) + "%", p.cvr.toFixed(2) + "%", p.cpa.toFixed(2), p.scs]);
    const NL = String.fromCharCode(10);
    const csv = "﻿" + [h.join(","), ...rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(","))].join(NL);
    const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "promo_" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
  };

  const sorter = (list: any[], col: string, asc: boolean) => [...list].sort((a, b) => { const av = a[col] ?? 0; const bv = b[col] ?? 0; return asc ? (av > bv ? 1 : -1) : (av > bv ? -1 : 1); });
  const sTops = useMemo(() => { const f = search ? tops.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()) || p.pid.toLowerCase().includes(search.toLowerCase())) : tops; return { list: sorter(f, sc, sa), total: f.length }; }, [tops, sc, sa, search]);
  const pTops = useMemo(() => sTops.list.slice(0, page * PS), [sTops.list, page]);
  const tp = Math.max(1, Math.ceil(sTops.total / PS));

  const tog = (c: string) => { if (sc === c) setSa(!sa); else { setSc(c); setSa(false); } };
  const sIcon = (c: string) => sc === c ? (sa ? " ↑" : " ↓") : "";
  const rc = (v: number) => v >= 2 ? "text-pdd-success" : v >= 1 ? "text-pdd-warning" : "text-pdd-danger";

  if (!ha) {
    return (
      <div className="p-4 lg:p-6">
        <UnifiedFilterBar
          timeFilter={tf}
          search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: '搜索商品...' }}
          onExportCSV={tops.length > 0 ? expCSV : undefined}
        />
        <div className="bg-pdd-card border border-pdd-border rounded-lg p-12 text-center text-sm text-pdd-text-secondary space-y-3 mt-4">
          <TrendingUp size={36} className="mx-auto text-gray-200" />
          <p>暂无推广数据</p>
          <p className="text-[11px] text-gray-300">请上传商品推广、明星店铺或直播推广数据文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">

      <UnifiedFilterBar
        timeFilter={tf}
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: '搜索商品...' }}
        onExportCSV={tops.length > 0 ? expCSV : undefined}
      />

      {/* 数据概览卡片 */}
      {tk && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 推广花费 */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">推广花费</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{YEN}{tk.tc.toFixed(2)}</p>
            <p className="text-[10px] text-pdd-text-secondary">CPA {YEN}{tk.cpa.toFixed(2)}</p>
          </div>
          {/* 曝光量 */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">曝光量</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{fmtW(tk.ti)}</p>
          </div>
          {/* 点击量 */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">点击量</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{fmtW(tk.tcl)}</p>
            <p className="text-[10px] text-pdd-text-secondary">CTR {fmtPct(tk.ctr)}</p>
          </div>
          {/* 成交订单 */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">成交订单</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{tk.to}</p>
            <p className="text-[10px] text-pdd-text-secondary">CVR {fmtPct(tk.cvr)}</p>
          </div>
          {/* 成交金额 */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">成交金额</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{YEN}{fmtW(tk.tg)}</p>
          </div>
          {/* 综合ROI */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">综合ROI</p>
            <p className={"text-xl font-semibold text-pdd-text tracking-tight tabular-nums " + rc(tk.roi)}>{fmtRoi(tk.roi)}</p>
          </div>
          {/* CPC */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">CPC</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{YEN}{tk.cpc.toFixed(2)}</p>
          </div>
          {/* 点击率 */}
          <div className="bg-pdd-card border border-pdd-border rounded-lg px-4 py-3">
            <p className="text-[11px] font-medium text-pdd-text-secondary/80">点击率(CTR)</p>
            <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{fmtPct(tk.ctr)}</p>
          </div>
        </div>
      )}

      {/* 渠道分布 */}
      {chDat.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {chDat.map(ch => (
            <div key={ch.k}
              className="bg-pdd-card border border-pdd-border rounded-lg p-4 flex items-center justify-between hover:border-pdd-primary/30 transition-colors cursor-default">
              <div>
                <p className="text-xs text-pdd-text-secondary">{ch.n}</p>
                <p className="text-xl font-semibold text-pdd-text tracking-tight tabular-nums">{YEN}{ch.cost.toFixed(2)}</p>
                <p className="text-[11px] font-medium text-pdd-text-secondary/80">GMV {YEN}{ch.gmv.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-pdd-text-secondary">ROI</p>
                <p className={"text-lg font-bold tabular-nums " + rc(ch.roi)}>{ch.roi.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 趋势图 */}
      <div className="bg-pdd-card border border-pdd-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-pdd-text-secondary" />日趋势
          </h4>
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden text-[10px]">
            {["cost","gmv","roi","ord"].map(m => (
              <button key={m} onClick={() => setTm(m)}
                className={"px-2.5 py-1 transition-colors font-medium " + (tm === m ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-600")}>
                {m === "cost" ? "花费" : m === "gmv" ? "GMV" : m === "roi" ? "ROI" : "订单"}
              </button>
            ))}
          </div>
        </div>
        {td.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={td}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-gray-200)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--pdd-text-secondary)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--pdd-text-secondary)" }} axisLine={false} tickLine={false} />
              <ReTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--pdd-border)" }} />
              <Area type="monotone" dataKey={tm} stroke="var(--pdd-primary)" fill="var(--pdd-primary)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-xs text-pdd-text-secondary">暂无趋势数据</div>
        )}
      </div>

      {/* ★ 分小时推广分布 */}
      {hourlyAgg && hourlyAgg.length > 0 && (
        <div className="bg-pdd-card border border-pdd-border rounded-lg p-4">
          <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <BarChart3 size={13} className="text-pdd-text-secondary" />分小时推广分布
            <span className="text-[10px] font-normal text-gray-400 ml-1">（{hourlyAgg.length} 个时段）</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {hourlyAgg.map(h => {
              const maxCost = Math.max(...hourlyAgg.map(x => x.cost), 1);
              const barPct = (h.cost / maxCost) * 100;
              return (
                <div key={h.slot} className="bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-500 mb-1.5">{h.slot}</div>
                  <div className="h-10 flex items-end mb-1.5">
                    <div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm transition-all"
                      style={{ height: barPct + '%', minHeight: barPct > 0 ? '4px' : '0' }} />
                  </div>
                  <div className="text-[10px] font-bold text-gray-700 tabular-nums">{YEN}{h.cost.toFixed(2)}</div>
                  <div className="text-[9px] text-gray-400">ROI <span className={rc(h.roi)}>{h.roi.toFixed(2)}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 场景分析 */}
      {scn.length > 0 && (
        <div className="bg-pdd-card border border-pdd-border rounded-lg p-4">
          <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <DollarSign size={13} className="text-pdd-text-secondary" />推广场景分析
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scn.map(s => {
              const maxCost = Math.max(...scn.map(x => x.cost), 1);
              const barPct = (s.cost / maxCost) * 100;
              return (
                <div key={s.sc} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">{s.sc}</span>
                    <span className="text-[11px] font-bold text-gray-800 tabular-nums">{YEN}{s.cost.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full mb-2.5 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{width: barPct + "%"}} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-medium text-pdd-text-secondary/80">
                    <span>GMV <span className="font-medium text-gray-600">{YEN}{s.gmv.toFixed(2)}</span></span>
                    <span>ROI <span className={"font-medium " + rc(s.roi)}>{s.roi.toFixed(2)}</span></span>
                    <span>订单 <span className="font-medium text-gray-600">{s.ord}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 商品推广明细 */}
      {sTops.list.length > 0 && (
        <div className="bg-pdd-card border border-pdd-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <DollarSign size={13} className="text-pdd-text-secondary" />商品推广明细
            </span>
            <div className="flex items-center gap-2">
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="搜索商品..." className="w-32 px-2 py-1 text-[10px] border border-gray-200 rounded-md outline-none focus:border-blue-300" />
              <span className="text-[11px] font-medium text-pdd-text-secondary/80">{sTops.total}个商品</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-pdd-gray-50">
                <tr className="border-b border-gray-100 text-gray-400">
                  <th className="text-left py-2.5 px-3 font-medium">商品名称</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("cost")}>花费{sIcon("cost")}</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("gmv")}>GMV{sIcon("gmv")}</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("roi")}>ROI{sIcon("roi")}</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("ord")}>订单{sIcon("ord")}</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("ctr")}>CTR{sIcon("ctr")}</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("cvr")}>CVR{sIcon("cvr")}</th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer select-none" onClick={() => tog("cpa")}>CPA{sIcon("cpa")}</th>
                  <th className="text-right py-2.5 px-3 font-medium">场景</th>
                </tr>
              </thead>
              <tbody>
                {pTops.map((p, i) => (
                  <tr key={p.pid || i} className="border-b border-gray-50 hover:bg-pdd-gray-50 transition-colors">
                    <td className="py-2.5 px-3 max-w-[140px] truncate text-gray-700 font-medium" title={p.name}>{p.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-pdd-text font-medium">{YEN}{p.cost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-pdd-text">{YEN}{p.gmv.toFixed(2)}</td>
                    <td className={"py-2.5 px-3 text-right font-mono font-medium " + rc(p.roi)}>{p.roi.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-800">{p.ord}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{p.ctr ? p.ctr.toFixed(2) + "%" : "-"}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{p.cvr ? p.cvr.toFixed(2) + "%" : "-"}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{YEN}{p.cpa.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400 max-w-[80px] truncate" title={p.scs}>{p.scs || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tp > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-pdd-text-secondary/80">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                  className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">上一页</button>
                <span className="px-2">{page}/{tp}</span>
                <button onClick={() => setPage(Math.min(tp, page + 1))} disabled={page >= tp}
                  className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50">下一页</button>
              </div>
              <span className="text-[11px] font-medium text-pdd-text-secondary/80">显示 {Math.min(page * PS, sTops.list.length)}/{sTops.total}个</span>
            </div>
          )}
        </div>
      )}

      {/* 数据来源说明 */}
      {tk && (
        <div className="text-[9px] text-gray-400 italic">
          数据来源：推广报表 SUM（花费/交易额/曝光量/点击量）
        </div>
      )}
    </div>
  );
}
