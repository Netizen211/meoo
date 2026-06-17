import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { CostBreakdown, CostSource } from './ProductLinkStats';

interface CostTooltipProps {
  totalCost: number;
  revenue: number;
  costBreakdown: CostBreakdown;
  costSource: CostSource;
  children?: React.ReactNode;
  onGoToCostManagement?: () => void;
}

function fmt(n: number) { return n.toFixed(2); }

function SourceBadge({ type }: { type: string }) {
  if (type === 'real') return <span className='text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium leading-none'>真实</span>;
  if (type === 'estimated') return <span className='text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-medium leading-none'>估算</span>;
  return <span className='text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium leading-none'>缺失</span>;
}
export default function CostTooltip({
  totalCost,
  revenue,
  costBreakdown,
  costSource,
  children,
  onGoToCostManagement,
}: CostTooltipProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calcPosition = useCallback(() => {
    if (!triggerRef.current || !popupRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popupHeight = Math.min(popupRef.current.scrollHeight, window.innerHeight - 16);
    const popupWidth = Math.min(popupRef.current.scrollWidth, window.innerWidth - 16);
    const gap = 8;
    let top;
    if (triggerRect.top - popupHeight - gap > 0) {
      top = triggerRect.top - popupHeight - gap;
    } else if (triggerRect.bottom + popupHeight + gap < window.innerHeight) {
      top = triggerRect.bottom + gap;
    } else { top = Math.max(8, window.innerHeight - popupHeight - 8); }
    let left = triggerRect.left + triggerRect.width / 2 - popupWidth / 2;
    if (left < 8) left = 8;
    if (left + popupWidth > window.innerWidth - 8) {
      left = window.innerWidth - 8 - popupWidth;
    }
    setPopupPos({ top, left });
  }, []);

  const handleMouseEnter = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    setShowPopup(true);
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setShowPopup(false), 200);
  };

  useEffect(() => {
    if (showPopup) { requestAnimationFrame(() => { requestAnimationFrame(calcPosition); }); }
  }, [showPopup, calcPosition]);

  useEffect(() => {
    if (!showPopup) return;
    const onUpdate = () => calcPosition();
    const onScroll = () => setShowPopup(false);
    window.addEventListener("resize", onUpdate);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [showPopup, calcPosition]);
  const costRatio = revenue > 0 ? (totalCost / revenue * 100) : 0;
  const isMissing = !costSource.productCost || costSource.productCost === "missing";

  const directItems = [
    { label: "商品成本", value: costBreakdown.productCost, source: costSource.productCost,
      note: costSource.productCost === "real" ? "基于成本管理填写的裸货成本 × 销量" : costSource.productCost === "estimated" ? "按实收金额比例估算" : "未配置商品成本" },
    { label: "包装费", value: costBreakdown.packagingFee, note: "每单固定包装费用" },
    { label: "快递费", value: costBreakdown.shippingFee, note: "每单固定快递费用" },
    { label: "推广费", value: costBreakdown.promoCost, note: "来自推广报表的全店分摊" },
  ];
  if (costBreakdown.platformFee > 0) {
    directItems.push({ label: "平台扣点", value: costBreakdown.platformFee, note: "含百亿补贴等平台扣费" }); }
  if ((costBreakdown.insuranceFee ?? 0) > 0) {
    directItems.push({ label: "运费险", value: costBreakdown.insuranceFee ?? 0, note: "每单运费险费用" }); }
  if ((costBreakdown.penaltyFee ?? 0) > 0) {
    directItems.push({ label: "罚款/扣款", value: costBreakdown.penaltyFee ?? 0, note: "平台罚款及扣款" }); }
  if ((costBreakdown.marketingFee ?? 0) > 0) {
    directItems.push({ label: "营销费用(实际)", value: costBreakdown.marketingFee ?? 0, note: "来自财务对账" }); }

  const hasTaxes = costBreakdown.taxes > 0;
  const hasDeductions = costBreakdown.customDeductions > 0;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex items-center gap-1 cursor-help border-b border-dashed border-pdd-gray-300 hover:border-pdd-primary transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children || (
          <span
            className={"font-mono text-xs " + (isMissing ? "text-pdd-gray-400" : totalCost >= 0 ? "text-pdd-danger" : "text-pdd-success")}
          >
            {isMissing ? "--" : "¥" + fmt(totalCost)}
          </span>
        )}
        <HelpCircle size={11} className="text-pdd-gray-300 shrink-0" />
      </span>
      {showPopup && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] bg-pdd-card rounded-xl border border-pdd-gray-200 shadow-xl text-xs overflow-hidden"
          style={{ top: popupPos.top, left: popupPos.left, maxHeight: "calc(100vh - 16px)", overflowY: "auto", maxWidth: "340px", minWidth: "280px" }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div className="bg-pdd-bg px-4 py-2.5 border-b border-pdd-border">
            <div className="flex items-center justify-between">
              <span className="font-bold text-pdd-text text-sm">成本构成</span>
              <button onClick={() => setShowPopup(false)} className="text-pdd-gray-400 hover:text-pdd-gray-600 p-0.5 rounded hover:bg-pdd-gray-100 transition-colors">
                <X size={13} />
              </button>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono text-pdd-danger">{"¥" + fmt(totalCost)}</span>
              <span className="text-[11px] text-pdd-text-secondary">
                占实收 <span className="font-mono font-medium">{costRatio.toFixed(1) + "%"}</span>
              </span>
            </div>
          </div>

          {/* Cost items */}
          <div className="p-3 space-y-2">
            {directItems.map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-pdd-text-secondary truncate">{item.label}</span>
                    {item.source && <SourceBadge type={item.source} />}
                  </div>
                  <span className="font-mono text-pdd-text font-medium shrink-0 ml-2">{"¥" + fmt(item.value)}</span>
                </div>
                {item.note && (
                  <div className="text-[10px] text-pdd-gray-400 pl-1.5 border-l-2 border-pdd-gray-200 ml-0.5 mt-0.5 leading-relaxed">{item.note}</div>
                )}
              </div>
            ))}

            {costBreakdown.discount > 0 && (
              <div className="border-t border-pdd-border/50 pt-1.5 mt-1.5">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">店铺优惠</span>
                  <span className="font-mono text-pdd-text">{"-" + "¥" + fmt(costBreakdown.discount)}</span>
                </div>
                <div className="text-[10px] text-pdd-gray-400 pl-1.5 border-l-2 border-pdd-gray-200 ml-0.5">已从实收中扣除</div>
              </div>
            )}
            {(hasTaxes || hasDeductions) && (
              <div className="border-t border-pdd-border/50 pt-1.5 mt-1.5">
                {hasTaxes && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-pdd-text-secondary">
                      税费合计
                      <span className={"ml-1 text-[10px] px-1 rounded " + (costSource.taxes === "configured" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700")}>
                        {costSource.taxes === "configured" ? "已配置" : "默认"}
                      </span>
                    </span>
                    <span className="font-mono text-pdd-text">{"¥" + fmt(costBreakdown.taxes)}</span>
                  </div>
                )}
                {hasDeductions && (
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-pdd-text-secondary">
                      其他扣费
                      <span className={"ml-1 text-[10px] px-1 rounded " + (costSource.customDeductions === "configured" ? "bg-green-50 text-green-700" : "bg-pdd-gray-100 text-pdd-gray-500")}>
                        {costSource.customDeductions === "configured" ? "已配置" : "无"}
                      </span>
                    </span>
                    <span className="font-mono text-pdd-text">{"¥" + fmt(costBreakdown.customDeductions)}</span>
                  </div>
                )}
              </div>
            )}

            {(hasTaxes || hasDeductions) && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-pdd-primary hover:text-blue-700 hover:bg-pdd-bg rounded-md transition-colors mt-1"
              >
                {expanded ? "收起明细" : "查看完整扣费明细"} {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            )}
            {expanded && (
              <div className="border-t border-pdd-border/50 pt-2 space-y-2 text-[11px]">
                {hasTaxes && (
                  <div>
                    <div className="font-medium text-pdd-text-secondary text-[10px] uppercase tracking-wide mb-1">税费明细</div>
                    <div className="text-pdd-gray-500 pl-2 border-l border-pdd-gray-200 space-y-0.5">
                      <div className="flex justify-between">
                        <span>增值税+附加税</span>
                        <span className="font-mono">{"¥" + fmt(costBreakdown.taxes)}</span>
                      </div>
                      <div className="text-[10px] text-pdd-gray-400">基于实收金额 × 税率计算</div>
                    </div>
                  </div>
                )}
                {hasDeductions && (
                  <div>
                    <div className="font-medium text-pdd-text-secondary text-[10px] uppercase tracking-wide mb-1">自定义扣费</div>
                    <div className="text-pdd-gray-500 pl-2 border-l border-pdd-gray-200">
                      <div className="flex justify-between">
                        <span>自定义扣费合计</span>
                        <span className="font-mono">{"¥" + fmt(costBreakdown.customDeductions)}</span>
                      </div>
                      <div className="text-[10px] text-pdd-gray-400">在设置中心配置的自定义扣费项目</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-pdd-border pt-2 mt-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-pdd-text text-xs">总成本</span>
                <span className="font-mono text-sm text-pdd-danger">{"¥" + fmt(totalCost)}</span>
              </div>
              <div className="text-[10px] text-pdd-text-secondary mt-0.5">
                成本占实收 <span className="font-mono">{costRatio.toFixed(1) + "%"}</span>
                {isMissing && <span className="text-red-400 ml-1">（含缺失项）</span>}
              </div>
            </div>
            {onGoToCostManagement && (
              <button
                onClick={() => { setShowPopup(false); onGoToCostManagement(); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 bg-pdd-primary/5 hover:bg-pdd-primary/10 text-pdd-primary text-xs font-medium rounded-lg transition-colors"
              >
                去成本管理配置 <ExternalLink size={12} />
              </button>
            )}
            <div className="text-[9px] text-pdd-gray-400 pt-1">
              数据来源: 订单CSV{costSource.productCost === "real" ? " + 成本管理" : ""}{costSource.taxes === "configured" ? " + 税务配置" : ""}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}