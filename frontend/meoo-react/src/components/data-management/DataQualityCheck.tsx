import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, X, Shield } from "lucide-react";
import { sf, ss, findField } from "../../utils";

interface Props {
  orders: any[];
  financialRecords: any[];
  afterSaleRecords: any[];
  promotionProducts: any[];
  filter: string;
  onFilterChange: (f: string) => void;
}

interface QualityCheck {
  id: string; category: string; name: string;
  severity: "error" | "warning" | "info";
  passed: boolean; detail: string;
  suggestion: string; impact: string;
  count?: number; total?: number;
}

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  fieldCompleteness: { label: "字段完整性", emoji: "📋" },
  format: { label: "数据格式", emoji: "📐" },
  range: { label: "值域校验", emoji: "🎯" },
  crossTable: { label: "跨表关联", emoji: "🔗" },
  logic: { label: "逻辑校验", emoji: "🧠" },
  freshness: { label: "数据时效", emoji: "⏰" },
  duplicate: { label: "重复检测", emoji: "🔄" },
};

const SEV_STYLE: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  error:   { emoji: "🔴", label: "错误", color: "#EF4444", bg: "#FEF2F2" },
  warning: { emoji: "🟡", label: "警告", color: "#D97706", bg: "#FFFBEB" },
  info:    { emoji: "🔵", label: "提示", color: "#3B82F6", bg: "#EFF6FF" },
};

export default function DataQualityCheck({ orders, financialRecords, afterSaleRecords, promotionProducts, filter, onFilterChange }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<QualityCheck | null>(null);

  const checks = useMemo((): QualityCheck[] => {
    const r: QualityCheck[] = [];
    const t = orders.length, ft = financialRecords.length, at = afterSaleRecords.length;

    // 1. 字段完整性
    const m1 = orders.filter((o: any) => !ss(findField(o, "订单号"))).length;
    r.push({ id: "m1", category: "fieldCompleteness", name: "订单号缺失", severity: "error", passed: m1 === 0, detail: "订单号为空 " + m1 + " 条" + (t > 0 ? " (" + (m1/t*100).toFixed(1) + "%)" : ""), suggestion: "重新上传完整订单数据", impact: "影响所有基于订单的分析", count: m1, total: t });
    const m2 = orders.filter((o: any) => !ss(findField(o, "商品id"))).length;
    r.push({ id: "m2", category: "fieldCompleteness", name: "商品ID缺失", severity: "error", passed: m2 === 0, detail: "商品ID为空 " + m2 + " 条" + (t > 0 ? " (" + (m2/t*100).toFixed(1) + "%)" : ""), suggestion: "重新上传包含商品ID的订单", impact: "无法关联商品分析", count: m2, total: t });
    const m3 = orders.filter((o: any) => !ss(findField(o, "支付时间"))).length;
    r.push({ id: "m3", category: "fieldCompleteness", name: "支付时间缺失", severity: "warning", passed: m3 / Math.max(t, 1) <= 0.05, detail: "支付时间为空 " + m3 + " 条" + (t > 0 ? " (" + (m3/t*100).toFixed(1) + "%)" : ""), suggestion: "补充支付时间，否则时间筛选不准", impact: "时间筛选精度受影响", count: m3, total: t });
    const m4 = orders.filter((o: any) => !ss(findField(o, "商家编码", "商品编码"))).length;
    r.push({ id: "m4", category: "fieldCompleteness", name: "商家编码未填写", severity: "info", passed: m4 / Math.max(t, 1) <= 0.5, detail: "商家编码未填 " + m4 + " 条" + (t > 0 ? " (" + (m4/t*100).toFixed(1) + "%)" : ""), suggestion: "非必填，但填写后可精确匹配成本", impact: "不影响核心分析", count: m4, total: t });
    const m5 = financialRecords.filter((rec: any) => !ss(findField(rec, "业务描述", "费用类型"))).length;
    r.push({ id: "m5", category: "fieldCompleteness", name: "财务描述缺失", severity: "error", passed: m5 === 0, detail: "业务描述为空 " + m5 + " 条" + (ft > 0 ? " (" + (m5/ft*100).toFixed(1) + "%)" : ""), suggestion: "重新上传财务明细", impact: "无法识别费用类型", count: m5, total: ft });
    const m6 = afterSaleRecords.filter((rec: any) => !ss(findField(rec, "售后编号", "售后单号"))).length;
    r.push({ id: "m6", category: "fieldCompleteness", name: "售后编号缺失", severity: "warning", passed: m6 === 0, detail: "售后编号为空 " + m6 + " 条" + (at > 0 ? " (" + (m6/at*100).toFixed(1) + "%)" : ""), suggestion: "重新上传售后数据", impact: "无法唯一标识售后记录", count: m6, total: at });

    // 2. 数据格式
    const f1 = orders.filter((o: any) => { const d = ss(findField(o, "支付时间")); return d && !/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(d); }).length;
    r.push({ id: "f1", category: "format", name: "日期格式异常", severity: "warning", passed: f1 <= 5, detail: f1 + " 条日期非标准格式", suggestion: "检查CSV日期列格式", impact: "时间筛选可能不准", count: f1, total: t });
    const f2 = orders.filter((o: any) => { const v = String(findField(o, "商品总价(元)", "商品总价") || ""); return v && isNaN(Number(v.replace(/[^\d.\-]/g, ""))); }).length;
    r.push({ id: "f2", category: "format", name: "金额字段含非数字", severity: "error", passed: f2 === 0, detail: f2 + " 条金额含非数字", suggestion: "清除货币符号后重传", impact: "金额无法解析", count: f2, total: t });
    const f3 = orders.filter((o: any) => { const id = ss(findField(o, "订单号")); return id && (id.length < 8 || id.length > 30); }).length;
    r.push({ id: "f3", category: "format", name: "订单号格式异常", severity: "warning", passed: f3 === 0, detail: f3 + " 条订单号长度异常", suggestion: "可能导入了非订单数据", impact: "可能影响关联", count: f3, total: t });

    // 3. 值域校验
    const v1 = orders.filter((o: any) => sf(findField(o, "商家实收金额(元)", "商家实收")) < 0).length;
    r.push({ id: "v1", category: "range", name: "金额为负", severity: "error", passed: v1 === 0, detail: v1 + " 条商家实收为负", suggestion: "检查数据是否正确", impact: "利润计算异常", count: v1, total: t });
    const v2 = orders.filter((o: any) => sf(findField(o, "商品总价(元)", "商品总价")) > 10000).length;
    r.push({ id: "v2", category: "range", name: "金额异常大", severity: "warning", passed: v2 === 0, detail: v2 + " 条商品总价>1万", suggestion: "确认大额订单或数据错误", impact: "可能影响GMV", count: v2, total: t });
    const v3 = orders.filter((o: any) => sf(findField(o, "商品数量(件)", "商品数量")) <= 0).length;
    r.push({ id: "v3", category: "range", name: "商品数量<=0", severity: "error", passed: v3 === 0, detail: v3 + " 条数量<=0", suggestion: "订单至少1件商品", impact: "数量统计异常", count: v3, total: t });

    // 4. 跨表关联
    const oIds = new Set(orders.map((o: any) => ss(findField(o, "订单号"))).filter(Boolean));
    const fIds = new Set(financialRecords.map((rec: any) => ss(findField(rec, "商户订单号", "订单号", "订单编号"))).filter(Boolean));
    const matched = [...oIds].filter((id: string) => fIds.has(id)).length;
    const rate = oIds.size > 0 ? matched / oIds.size * 100 : 100;
    r.push({ id: "c1", category: "crossTable", name: "订单->财务匹配率低", severity: "warning", passed: rate >= 80 || oIds.size === 0, detail: "匹配 " + matched + "/" + oIds.size + " (" + rate.toFixed(0) + "%)", suggestion: "上传最近财务表", impact: "财务分析覆盖不全", count: matched, total: oIds.size });
    const asIds = new Set(afterSaleRecords.map((rec: any) => ss(findField(rec, "订单编号", "订单号"))).filter(Boolean));
    const unmatched = [...asIds].filter((id: string) => !oIds.has(id)).length;
    const asRate = asIds.size > 0 ? unmatched / asIds.size * 100 : 0;
    r.push({ id: "c2", category: "crossTable", name: "订单->售后不匹配", severity: "error", passed: asIds.size === 0 || asRate <= 5, detail: unmatched + " 条售后找不到订单" + (asIds.size > 0 ? " (" + asRate.toFixed(1) + "%)" : ""), suggestion: "售后数据可能不属于当前订单", impact: "售后分析不完整", count: unmatched, total: asIds.size });

    // 5. 逻辑校验
    const l1 = orders.filter((o: any) => { const pt = ss(findField(o, "支付时间")); const st = ss(findField(o, "发货时间")); return pt && st && new Date(st).getTime() < new Date(pt).getTime(); }).length;
    r.push({ id: "l1", category: "logic", name: "发货时间<支付时间", severity: "error", passed: l1 === 0, detail: l1 + " 单发货早于支付", suggestion: "检查时间列是否正确", impact: "物流统计不准确", count: l1, total: t });
    const l2 = afterSaleRecords.filter((rec: any) => { const amt = sf(findField(rec, "退款金额(元)", "金额")); const oid = ss(findField(rec, "订单编号", "订单号")); if (!amt || !oid) return false; const ord = orders.find((o: any) => ss(findField(o, "订单号")) === oid); return ord && amt > sf(findField(ord, "商品总价(元)", "商品总价")); }).length;
    r.push({ id: "l2", category: "logic", name: "退款金额>订单金额", severity: "warning", passed: l2 === 0, detail: l2 + " 单退款超原单金额", suggestion: "一单多次售后导致累计退款超额", impact: "退款统计异常", count: l2, total: at });

    // 6. 数据时效
    const latestTs = orders.length > 0 ? Math.max(...orders.map((o: any) => new Date(ss(findField(o, "支付时间"))).getTime()).filter((d: number) => !isNaN(d))) : 0;
    const daysOld = latestTs > 0 ? (Date.now() - latestTs) / 86400000 : 0;
    r.push({ id: "s1", category: "freshness", name: "数据过于陈旧", severity: "info", passed: daysOld <= 30 || latestTs === 0, detail: daysOld > 0 ? "最新订单为 " + daysOld.toFixed(0) + " 天前" : "无订单数据", suggestion: "建议上传最新数据", impact: "分析可能滞后", count: Math.round(daysOld), total: 30 });

    // 7. 重复检测
    const orderIds = orders.map((o: any) => ss(findField(o, "订单号"))).filter(Boolean);
    const dupCount = orderIds.length - new Set(orderIds).size;
    r.push({ id: "d1", category: "duplicate", name: "存在重复订单", severity: "warning", passed: dupCount === 0, detail: "检测到 " + dupCount + " 个重复订单号(已自动去重)", suggestion: "导出时注意筛选减少重复", impact: "已自动处理", count: dupCount, total: orderIds.length });

    return r;
  }, [orders, financialRecords, afterSaleRecords, promotionProducts]);

  const filtered = useMemo(() => {
    if (filter === "all") return checks;
    return checks.filter(c => c.severity === filter && !c.passed);
  }, [checks, filter]);

  const passedCount = checks.filter(c => c.passed).length;
  const failedCount = checks.length - passedCount;

  if (!orders.length && !financialRecords.length && !afterSaleRecords.length) {
    return (
      <div className="pdd-card p-8 text-center">
        <div className="text-4xl mb-2">📋</div>
        <h3 className="text-base font-bold mb-1">暂无数据</h3>
        <p className="text-xs text-pdd-text-secondary">请先在"上传"Tab中导入数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="pdd-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold"><Shield size={14} className="inline mr-1" />数据质量检查结果</h3>
          <span className="text-[10px] text-pdd-text-secondary">{checks.length}项检查</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✅ 通过 {passedCount}/{checks.length}</span>
          {failedCount > 0 && <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">异常 {failedCount}</span>}
        </div>
        <div className="flex items-center gap-1">
          {[{key:"all",label:"全部"},{key:"error",label:"错误"},{key:"warning",label:"警告"},{key:"info",label:"提示"}].map(f => (
            <button key={f.key} onClick={()=>onFilterChange(f.key)}
              className={"text-[10px] px-2 py-0.5 rounded " + (filter===f.key ? "bg-pdd-primary text-white" : "bg-pdd-bg text-pdd-text-secondary")}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {["error","warning","info"].map(sev => {
        const items = filtered.filter(c => c.severity === sev && !c.passed);
        if (!items.length) return null;
        const sm = SEV_STYLE[sev];
        return (
          <div key={sev} className="pdd-card p-3">
            <button onClick={() => setExpandedCategory(expandedCategory===sev ? null : sev)}
              className="flex items-center justify-between w-full text-left">
              <h4 className="text-xs font-semibold"><span>{sm.emoji}</span> {sm.label}({items.length}项)</h4>
              {expandedCategory===sev ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedCategory===sev && <div className="space-y-1 mt-2">
              {items.map(item => (
                <div key={item.id} className="flex items-start justify-between px-2 py-2 rounded bg-pdd-bg text-xs">
                  <div className="flex-1 min-w-0 mr-2">
                    <span className="font-medium">{sm.emoji} {item.name}</span>
                    <p className="text-pdd-text-secondary mt-0.5">{item.detail}</p>
                    <p className="text-pdd-text-secondary mt-0.5">💡 {item.suggestion}</p>
                  </div>
                  <button onClick={() => setDetailItem(detailItem?.id===item.id ? null : item)}
                    className="shrink-0 text-pdd-primary text-[10px]">详情</button>
                </div>
              ))}
            </div>}
          </div>
        );
      })}

      {failedCount===0 && (
        <div className="pdd-card p-8 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h3 className="text-base font-bold mb-1">数据质量良好</h3>
          <p className="text-xs text-pdd-text-secondary">全部 {checks.length} 项检查通过</p>
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDetailItem(null)}>
          <div className="bg-pdd-card rounded-xl shadow-xl w-full max-w-md mx-4 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">{SEV_STYLE[detailItem.severity].emoji} {detailItem.name}</h3>
              <button onClick={() => setDetailItem(null)}><X size={16} /></button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded bg-pdd-bg"><p className="text-pdd-text-secondary">检测结果</p><p className="font-medium">{detailItem.detail}</p></div>
              <div className="p-2 rounded bg-pdd-bg"><p className="text-pdd-text-secondary">影响范围</p><p>{detailItem.impact}</p></div>
              <div className="p-2 rounded bg-pdd-bg"><p className="text-pdd-text-secondary">处理建议</p><p>{detailItem.suggestion}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
