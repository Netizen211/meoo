import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, X, FileText, Check, Clock } from "lucide-react";

interface Props {
  stores: any[];
  uploadRecords: any[];
  onCleanup: (storeId: string, types: string[]) => void;
  onReset: () => void;
}

const DATA_TYPES = [
  { key: "orders", label: "订单数据", emoji: "📋", color: "text-blue-600" },
  { key: "financialRecords", label: "财务数据", emoji: "💰", color: "text-green-600" },
  { key: "afterSaleRecords", label: "售后数据", emoji: "🔧", color: "text-orange-600" },
  { key: "promotionProducts", label: "推广数据", emoji: "📢", color: "text-purple-600" },
  { key: "shippingInsurance", label: "运费险数据", emoji: "🛡️", color: "text-cyan-600" },
];

export default function DataCleanup({ stores, uploadRecords, onCleanup, onReset }: Props) {
  const [activeStore, setActiveStore] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [cleanedHistory, setCleanedHistory] = useState<Array<{storeId: string; types: string[]; time: string}>>([]);

  const toggleType = (key: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCleanup = () => {
    if (!activeStore || selectedTypes.size === 0) return;
    onCleanup(activeStore, [...selectedTypes]);
    setCleanedHistory(prev => [{ storeId: activeStore, types: [...selectedTypes], time: new Date().toLocaleString("zh-CN") }, ...prev]);
    setSuccessMsg("已清理 " + [...selectedTypes].map(t => DATA_TYPES.find(d => d.key === t)?.label || t).join(", "));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    setSelectedTypes(new Set());
  };

  const storeName = stores.find(s => s.id === activeStore)?.name || "";

  return (
    <div className="space-y-3">
      <div className="pdd-card p-3">
        <h3 className="text-xs font-semibold mb-2"><Trash2 size={14} className="inline mr-1" />按店铺清理数据</h3>
        {stores.length === 0 ? (
          <p className="text-xs text-pdd-text-secondary py-2">暂无店铺</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 mb-2">
              {stores.map(s => (
                <button key={s.id} onClick={() => { setActiveStore(s.id); setSelectedTypes(new Set()); }}
                  className={"px-2 py-1 text-xs rounded " + (activeStore===s.id ? "bg-pdd-primary text-white" : "bg-pdd-bg text-pdd-text-secondary hover:bg-pdd-border/50")}>
                  {s.name}</button>
              ))}
            </div>
            {activeStore && (
              <div className="bg-pdd-bg rounded p-3">
                <p className="text-xs font-medium mb-2">当前店铺: {storeName}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DATA_TYPES.map(dt => (
                    <button key={dt.key} onClick={() => toggleType(dt.key)}
                      className={"flex items-center gap-1 px-2 py-1 text-xs rounded border " + (selectedTypes.has(dt.key) ? "bg-pdd-primary/10 border-pdd-primary text-pdd-primary" : "bg-pdd-card border-pdd-border text-pdd-text-secondary")}>
                      <span>{dt.emoji}</span> {dt.label}
                      {selectedTypes.has(dt.key) && <X size={12} />}
                    </button>
                  ))}
                </div>
                <button onClick={handleCleanup} disabled={selectedTypes.size===0}
                  className={"px-3 py-1 text-xs rounded text-white " + (selectedTypes.size===0 ? "bg-pdd-gray-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600")}>
                  执行清理 ({selectedTypes.size}项)</button>
              </div>
            )}
          </>
        )}
      </div>

      {cleanedHistory.length > 0 && (
        <div className="pdd-card p-3">
          <h4 className="text-xs font-semibold mb-2"><Clock size={14} className="inline mr-1" />清理记录</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {cleanedHistory.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-pdd-bg rounded">
                <span>{h.time}</span>
                <span className="text-pdd-text-secondary">{h.types.map(t => DATA_TYPES.find(d => d.key === t)?.label || t).join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadRecords.length > 0 && (
        <div className="pdd-card p-3">
          <h4 className="text-xs font-semibold mb-2"><FileText size={14} className="inline mr-1" />上传记录</h4>
          <p className="text-xs text-pdd-text-secondary mb-2">共 {uploadRecords.length} 条上传记录</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {uploadRecords.slice(0, 20).map((rec: any) => (
              <div key={rec.id} className="flex items-center justify-between text-xs px-2 py-1 bg-pdd-bg rounded">
                <span className="truncate">{rec.fileName}</span>
                <span className="text-pdd-text-secondary">{new Date(rec.uploadedAt).toLocaleString("zh-CN")}</span>
              </div>
            ))}
            {uploadRecords.length > 20 && <p className="text-xs text-pdd-text-secondary text-center mt-1">...还有 {uploadRecords.length - 20} 条</p>}
          </div>
        </div>
      )}

      <div className="pdd-card p-3 border border-red-200 bg-red-50/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-red-500" />
          <h4 className="text-xs font-semibold text-red-700">危险区域 — 重置全部数据</h4>
        </div>
        <p className="text-xs text-pdd-text-secondary mb-3">此操作将清空当前账号下所有店铺的全部数据，不可恢复。</p>
        {!showResetConfirm ? (
          <button onClick={() => setShowResetConfirm(true)}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">重置全部数据</button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-600 font-medium">请输入 "确认重置" 以继续：</p>
            <input type="text" value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)}
              placeholder="输入 确认重置"
              className="w-full px-2 py-1 text-xs border border-red-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500" />
            <div className="flex gap-2">
              <button onClick={() => { if (resetConfirmText==="确认重置") { onReset(); setShowResetConfirm(false); setResetConfirmText(""); setSuccessMsg("全部数据已重置"); setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000); } }}
                disabled={resetConfirmText!=="确认重置"}
                className={"px-3 py-1 text-xs rounded text-white " + (resetConfirmText==="确认重置" ? "bg-red-600 hover:bg-red-700" : "bg-pdd-gray-300 cursor-not-allowed")}>确认重置</button>
              <button onClick={() => { setShowResetConfirm(false); setResetConfirmText(""); }}
                className="px-3 py-1 text-xs bg-pdd-card border border-pdd-border rounded text-pdd-text-secondary">取消</button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 px-4 py-2 bg-green-600 text-white text-xs rounded-lg shadow-lg flex items-center gap-2 z-50">
            <Check size={14} /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
