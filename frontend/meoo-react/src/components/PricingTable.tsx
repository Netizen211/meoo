import React, { useState } from "react";
import { motion } from "framer-motion";
import { Save, Search, Plus, Trash2 } from "lucide-react";

interface PricingRow {
  id: string;
  name: string;
  code: string;
  supplierCode: string;
  color: string;
  size: string;
  rawCost: number;
  otherDeductions: number;
  shipping: number;
  insuranceFee: number;
  packagingFee: number;
  laborFee: number;
  platformRate: number;
  brandDeductionRate: number;
  vatRate: number;
  incomeTaxRate: number;
  returnRate: number;
  competitorPrice: number;
  preliminaryPrice: number;
  standardPrice: number;
  minPrice: number;
  targetProfitRate: number;
  bindId: string;
  actualPrice: number;
}

interface PresetItem extends PricingRow {
  suggestedPrice?: number;
  profit?: number;
  roi?: number;
  createdAt?: string;
}

interface PricingTableProps {
  pricingPresets: PresetItem[];
  addPricingPreset: (item: PresetItem) => void;
  removePricingPreset: (id: string) => void;
}

interface CalcResult {
  uc: number;
  price: number;
  pf: number;
  bf: number;
  profit: number;
  roi: number;
  risk: string;
}

const F = (v: number | undefined | null, d?: number): string => (v || 0).toFixed(d || 2);
const rid = (): string => Math.random().toString(36).slice(2, 9);
function riskColor(r: string): string {
  return r === "可上架" ? "text-green-400" : r === "利润偏低" ? "text-amber-400" : "text-red-400";
}

export default function PricingTable({ pricingPresets, addPricingPreset, removePricingPreset }: PricingTableProps) {
  const makeRow = (): PricingRow => ({
    id: rid(), name: "", code: "", supplierCode: "", color: "", size: "",
    rawCost: 0, otherDeductions: 0, shipping: 0, insuranceFee: 0, packagingFee: 0, laborFee: 0,
    platformRate: 0, brandDeductionRate: 0, vatRate: 0, incomeTaxRate: 0, returnRate: 0,
    competitorPrice: 0, preliminaryPrice: 0, standardPrice: 0, minPrice: 0, targetProfitRate: 30,
    bindId: "", actualPrice: 0,
  });
  const [rows, setRows] = useState<PricingRow[]>([makeRow()]);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  function calc(r: PricingRow): CalcResult {
    const uc = r.rawCost + r.otherDeductions + r.shipping + r.insuranceFee + r.packagingFee + r.laborFee;
    const pr = r.platformRate / 100, br = r.brandDeductionRate / 100, tr = r.targetProfitRate / 100;
    const dr = pr + br + tr, denom = 1 - dr;
    const price = r.rawCost > 0 && denom > 0 ? uc / denom : 0;
    const pf = price * pr, bf = price * br;
    const profit = price - uc - pf - bf;
    const roi = uc > 0 ? profit / uc : 0;
    const risk = dr >= 1 ? "费率超100%" : profit <= 0 ? "亏损" : roi < 0.3 ? "ROI风险" : r.minPrice > 0 && price < r.minPrice ? "低于控价" : tr < 0.2 ? "利润偏低" : "可上架";
    return { uc, price, pf, bf, profit, roi, risk };
  }

  const up = (i: number, k: keyof PricingRow, v: string | number) => {
    setRows(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v as any }; return n; });
  };

  const saveAll = () => {
    const vd = rows.filter(r => r.code.trim());
    if (!vd.length) return;
    vd.forEach(r => {
      const c = calc(r);
      addPricingPreset({ ...r, suggestedPrice: c.price, profit: c.profit, roi: c.roi, createdAt: new Date().toISOString() });
    });
    setMsg("已保存 " + vd.length + " 个方案");
    setTimeout(() => setMsg(""), 2000);
  };

  const ftd = pricingPresets.filter((p: PresetItem) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q);
  });

  const inp = (i: number, k: keyof PricingRow, w: string, ph?: string, type?: string) => (
    <input type={type || "text"} className={w + " bg-transparent outline-none border-b border-transparent focus:border-pdd-primary text-[11px]" + (type === "number" ? " text-right" : "")}
      value={(rows[i] || {})[k] != null ? String((rows[i] || {})[k]) : ""}
      onChange={e => up(i, k, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
      placeholder={ph || ""} />
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>新品预算方案</span>
        <button onClick={() => setRows(prev => [...prev, makeRow()])}
          className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs hover:bg-blue-50"
          style={{ borderColor: 'var(--pdd-primary)', color: 'var(--pdd-primary)' }}>
          <Plus size={14} /> 新增
        </button>
        <button onClick={saveAll}
          className="flex items-center gap-1 px-6 py-1.5 text-white rounded-lg text-xs hover:opacity-90"
          style={{ background: 'var(--pdd-primary)' }}>
          <Save size={14} /> 保存全部
        </button>
        {msg && <span className="text-xs" style={{ color: 'var(--pdd-success)' }}>{msg}</span>}
      </div>
      <div className="bg-pdd-card rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--pdd-border)' }}>
        <table className="w-full text-[11px] border-collapse"><thead>
          <tr style={{ borderBottom: '2px solid var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
            <th className="text-left py-1 px-1.5" colSpan={5}>产品属性</th>
            <th className="text-center py-1 px-1.5" colSpan={6}>成本参数</th>
            <th className="text-center py-1 px-1.5" colSpan={4}>扣费%</th>
            <th className="text-center py-1 px-1.5" colSpan={4}>定价</th>
            <th className="text-center py-1 px-1.5" colSpan={3} style={{ color: 'var(--pdd-primary)' }}>结果</th>
            <th className="text-center py-1 px-1.5" colSpan={2}>绑定</th><th></th>
          </tr>
          <tr className="border-b" style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
            <th className="text-left py-1 px-1.5">名称</th><th className="text-left py-1 px-1.5">编码</th>
            <th className="text-left py-1 px-1.5">款号</th><th className="text-left py-1 px-1.5">颜色</th><th className="text-left py-1 px-1.5">尺码</th>
            <th className="text-right py-1 px-1.5">成本</th><th className="text-right py-1 px-1.5">扣款</th><th className="text-right py-1 px-1.5">运费</th>
            <th className="text-right py-1 px-1.5">保险</th><th className="text-right py-1 px-1.5">包装</th><th className="text-right py-1 px-1.5">人工</th>
            <th className="text-right py-1 px-1.5">费率</th><th className="text-right py-1 px-1.5">扣点</th><th className="text-right py-1 px-1.5">退货</th><th className="text-right py-1 px-1.5">目标</th>
            <th className="text-right py-1 px-1.5">竞品</th><th className="text-right py-1 px-1.5">初步</th><th className="text-right py-1 px-1.5">控价</th><th className="text-right py-1 px-1.5">最低</th>
            <th className="text-right py-1 px-1.5" style={{ color: 'var(--pdd-primary)' }}>售价</th><th className="text-right py-1 px-1.5 text-green-400">利润</th><th className="text-right py-1 px-1.5">ROI%</th>
            <th className="text-center py-1 px-1.5">绑定ID</th><th className="text-right py-1 px-1.5">实际价</th><th></th>
          </tr></thead><tbody>
          {rows.map((r, i) => {
            const c = calc(r); const rc = riskColor(c.risk);
            const pc = c.profit > 0 ? "#10B981" : "#EF4444";
            return (<tr key={r.id || i} className="border-b hover:bg-gray-50/30" style={{ borderColor: 'var(--pdd-border)' }}>
              <td className="py-1 px-1.5">{inp(i, "name", "w-16")}</td>
              <td className="py-1 px-1.5">{inp(i, "code", "w-14", "必填")}</td>
              <td className="py-1 px-1.5">{inp(i, "supplierCode", "w-12")}</td>
              <td className="py-1 px-1.5">{inp(i, "color", "w-14")}</td>
              <td className="py-1 px-1.5">{inp(i, "size", "w-10")}</td>
              <td className="py-1 px-1.5">{inp(i, "rawCost", "w-14", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "otherDeductions", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "shipping", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "insuranceFee", "w-10", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "packagingFee", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "laborFee", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "platformRate", "w-11", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "brandDeductionRate", "w-11", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "returnRate", "w-11", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "targetProfitRate", "w-11", "30", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "competitorPrice", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "preliminaryPrice", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "standardPrice", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5">{inp(i, "minPrice", "w-12", "0", "number")}</td>
              <td className="py-1 px-1.5 text-right font-semibold" style={{ color: 'var(--pdd-primary)' }}>{F(c.price)}</td>
              <td className="py-1 px-1.5 text-right" style={{color: pc}}>{F(c.profit)}</td>
              <td className="py-1 px-1.5 text-right">{(c.roi*100).toFixed(0)}%</td>
              <td className={"py-1 px-1.5 text-center text-[10px] font-medium whitespace-nowrap " + rc}>{c.risk}</td>
              <td className="py-1 px-1.5">{inp(i, "bindId", "w-20", "商品ID")}</td>
              <td className="py-1 px-1.5">{inp(i, "actualPrice", "w-14", "0", "number")}</td>
              <td className="py-1 px-1.5 text-center"><button onClick={() => setRows(prev => prev.filter((_,j) => j !== i))} className="hover:text-red-500" style={{ color: 'var(--pdd-text-secondary)' }}><Trash2 size={12}/></button></td>
            </tr>);
          })}
        </tbody></table></div>
      {pricingPresets.length > 0 && (
        <div className="bg-pdd-card rounded-xl border p-3" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Search size={14} style={{ color: 'var(--pdd-text-secondary)' }} />
            <input type="text" placeholder="搜索..." className="flex-1 text-xs outline-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)}/>
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>({ftd.length})</span>
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-[11px]"><thead><tr className="border-b" style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
              <th className="text-left py-1 px-2">名称/编码</th><th className="text-right py-1 px-2">成本</th><th className="text-right py-1 px-2">售价</th><th className="text-right py-1 px-2">利润</th><th className="text-right py-1 px-2">ROI</th><th className="text-center py-1 px-2"></th>
            </tr></thead><tbody>
            {ftd.map((p, i) => (
              <tr key={i} className="border-b hover:bg-gray-50/30" style={{ borderColor: 'var(--pdd-border)' }}>
                <td className="py-1 px-2"><span className="font-medium" style={{ color: 'var(--pdd-text)' }}>{p.name || p.code}</span></td>
                <td className="py-1 px-2 text-right" style={{ color: 'var(--pdd-text-secondary)' }}>{F(p.rawCost || 0)}</td>
                <td className="py-1 px-2 text-right" style={{ color: 'var(--pdd-primary)' }}>{F(p.suggestedPrice || 0)}</td>
                <td className="py-1 px-2 text-right" style={{color: (p.profit||0) > 0 ? "#10B981" : "#EF4444"}}>{F(p.profit || 0)}</td>
                <td className="py-1 px-2 text-right" style={{ color: 'var(--pdd-text-secondary)' }}>{p.roi ? ((p.roi * 100).toFixed(0) + "%") : "-"}</td>
                <td className="py-1 px-2 text-center"><button onClick={() => removePricingPreset(p.createdAt || p.id || "")} className="hover:underline text-[10px]" style={{ color: 'var(--pdd-danger)' }}>删除</button></td>
              </tr>))}
            </tbody></table></div></div>)}
    </motion.div>
  );
}