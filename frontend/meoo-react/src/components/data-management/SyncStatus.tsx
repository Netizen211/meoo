import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Info, Database, ArrowRight } from "lucide-react";
import { sf, ss, findField } from "../../utils";

interface Props {
  orders: any[];
  financialRecords: any[];
  afterSaleRecords: any[];
  shippingInsurance: any[];
  promotionProducts: any[];
}

interface DataSource {
  key: string; label: string; emoji: string;
  records: any[]; status: "synced" | "partial" | "pending" | "empty";
  lastSync?: string; syncMethod?: string; count: number;
}

export default function SyncStatus({ orders, financialRecords, afterSaleRecords, shippingInsurance, promotionProducts }: Props) {
  const [showPending, setShowPending] = useState(false);

  const sources = useMemo((): DataSource[] => {
    const now = new Date().toLocaleString("zh-CN");
    return [
      { key: "orders", label: "订单数据", emoji: "📋", records: orders, status: orders.length > 0 ? "synced" : "empty", lastSync: orders.length > 0 ? now : undefined, syncMethod: orders.length > 0 ? "CSV导入" : undefined, count: orders.length },
      { key: "financial", label: "财务数据", emoji: "💰", records: financialRecords, status: financialRecords.length > 0 ? "synced" : "empty", lastSync: financialRecords.length > 0 ? now : undefined, syncMethod: financialRecords.length > 0 ? "CSV导入" : undefined, count: financialRecords.length },
      { key: "afterSale", label: "售后数据", emoji: "🔧", records: afterSaleRecords, status: afterSaleRecords.length > 0 ? "synced" : "empty", lastSync: afterSaleRecords.length > 0 ? now : undefined, syncMethod: afterSaleRecords.length > 0 ? "CSV导入" : undefined, count: afterSaleRecords.length },
      { key: "insurance", label: "运费险数据", emoji: "🛡️", records: shippingInsurance, status: shippingInsurance.length > 0 ? "synced" : "empty", lastSync: shippingInsurance.length > 0 ? now : undefined, syncMethod: shippingInsurance.length > 0 ? "CSV导入" : undefined, count: shippingInsurance.length },
      { key: "promotion", label: "推广数据", emoji: "📢", records: promotionProducts, status: promotionProducts.length > 0 ? "synced" : "empty", lastSync: promotionProducts.length > 0 ? now : undefined, syncMethod: promotionProducts.length > 0 ? "CSV导入" : undefined, count: promotionProducts.length },
    ];
  }, [orders, financialRecords, afterSaleRecords, shippingInsurance, promotionProducts]);

  const totalCount = orders.length + financialRecords.length + afterSaleRecords.length + shippingInsurance.length + promotionProducts.length;
  const syncedCount = sources.filter(s => s.status !== "empty").length;

  const statusLabel = (s: DataSource) => {
    switch (s.status) {
      case "synced": return <span className="text-green-700 bg-green-100 px-1.5 py-0.5 rounded text-[10px]">✅ 已同步</span>;
      case "partial": return <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">⚠️ 部分</span>;
      case "pending": return <span className="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">⏳ 待同步</span>;
      default: return <span className="text-pdd-gray-400 bg-pdd-gray-100 px-1.5 py-0.5 rounded text-[10px]">--</span>;
    }
  };

  if (totalCount === 0) {
    return (
      <div className="space-y-3">
        <div className="pdd-card p-8 text-center">
          <div className="text-4xl mb-2">🔄</div>
          <h3 className="text-base font-bold mb-1">暂无数据</h3>
          <p className="text-xs text-pdd-text-secondary">请先在"上传"Tab中导入数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="pdd-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold"><RefreshCw size={14} className="inline mr-1" />同步状态总览</h3>
          <span className="text-[10px] text-pdd-text-secondary">{syncedCount}/5 数据源已同步</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">📊 总计 {totalCount.toLocaleString()} 条记录</span>
          {syncedCount < 5 && <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">还有 {5 - syncedCount} 类数据未上传</span>}
        </div>
      </div>

      <div className="pdd-card p-3">
        <h4 className="text-xs font-semibold mb-2"><Database size={14} className="inline mr-1" />各数据源状态</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
              <th className="py-2 text-left">数据源</th>
              <th className="py-2 text-right">记录数</th>
              <th className="py-2 text-left">最近同步</th>
              <th className="py-2 text-left">同步方式</th>
              <th className="py-2 text-center">状态</th>
            </tr></thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.key} className="border-b border-pdd-border hover:bg-pdd-bg">
                  <td className="py-2 font-medium"><span>{s.emoji}</span> {s.label}</td>
                  <td className="py-2 text-right font-mono">{s.count.toLocaleString()}</td>
                  <td className="py-2 text-pdd-text-secondary">{s.lastSync || "--"}</td>
                  <td className="py-2 text-pdd-text-secondary">{s.syncMethod || "--"}</td>
                  <td className="py-2 text-center">{statusLabel(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {syncedCount < 5 && (
        <div className="pdd-card p-3 bg-gradient-to-r from-blue-50 to-white border border-blue-100">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-700">同步建议</p>
              <p className="text-xs text-pdd-text-secondary mt-1">
                建议上传完整的订单、财务、售后、推广数据，以便进行全面的利润分析和多维度交叉验证。
              </p>
              <button onClick={() => window.location.hash = "#/upload"}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                前往上传 <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="pdd-card p-3">
          <button onClick={() => setShowPending(!showPending)}
            className="flex items-center justify-between w-full text-left">
            <h4 className="text-xs font-semibold"><Clock size={14} className="inline mr-1" />最近订单</h4>
            <span className="text-[10px] text-pdd-text-secondary">{showPending ? "收起" : "展开"}</span>
          </button>
          {showPending && (
            <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
              {orders.slice(0, 50).map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-pdd-bg rounded">
                  <span className="font-mono">{ss(findField(o, "订单号")) || "--"}</span>
                  <span className="text-pdd-text-secondary">{ss(findField(o, "支付时间")) || ""}</span>
                  <span>¥{sf(findField(o, "商家实收金额(元)", "商家实收")).toFixed(2)}</span>
                </div>
              ))}
              {orders.length > 50 && <p className="text-xs text-pdd-text-secondary text-center mt-1">...还有 {orders.length - 50} 条</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
