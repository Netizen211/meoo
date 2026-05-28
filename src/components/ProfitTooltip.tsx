import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import type { CostBreakdown, CostSource, TaxDetail, DeductionDetail } from './ProductLinkStats';

interface Props {
  netProfit: number;
  grossProfit: number;
  preTaxProfit: number;
  netProfitAfterTax: number;
  revenue: number;
  costBreakdown: CostBreakdown;
  costSource: CostSource;
  taxDetails: TaxDetail[];
  deductionDetails: DeductionDetail[];
  profitConfidence: 'high' | 'medium' | 'low';
  hasRealCost: boolean;
  onGoToCostManagement?: () => void;
}

const confidenceConfig = {
  high: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle, label: '高可信' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle, label: '中可信' },
  low: { color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, label: '低可信' },
};

function fmt(n: number) { return n.toFixed(2); }

export default function ProfitTooltip({
  netProfit, grossProfit, preTaxProfit, netProfitAfterTax, revenue,
  costBreakdown, costSource, taxDetails, deductionDetails,
  profitConfidence, hasRealCost, onGoToCostManagement
}: Props) {
  const [showPopup, setShowPopup] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conf = confidenceConfig[profitConfidence];
  const ConfIcon = conf.icon;

  // 计算弹窗位置：优先显示在触发元素上方，空间不足则下方
  const calcPosition = useCallback(() => {
    if (!triggerRef.current || !popupRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popupHeight = Math.min(popupRef.current.scrollHeight, window.innerHeight - 16);
    const popupWidth = Math.min(popupRef.current.scrollWidth, window.innerWidth - 16);
    const gap = 8;

    let top: number;
    // 优先上方
    if (triggerRect.top - popupHeight - gap > 0) {
      top = triggerRect.top - popupHeight - gap;
    } else if (triggerRect.bottom + popupHeight + gap < window.innerHeight) {
      // 上方不够，试试下方
      top = triggerRect.bottom + gap;
    } else {
      // 上下都不够，强制下方 + 滚动
      top = Math.max(8, window.innerHeight - popupHeight - 8);
    }

    // 水平居中，防止超出视口
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
    if (showPopup) {
      requestAnimationFrame(() => {
        requestAnimationFrame(calcPosition);
      });
    }
  }, [showPopup, calcPosition]);

  // 窗口 resize 或 scroll 时重新计算/隐藏
  useEffect(() => {
    if (!showPopup) return;
    const onUpdate = () => calcPosition();
    const onScroll = () => {
      // 滚动时隐藏（避免弹窗卡在错误位置）
      setShowPopup(false);
    };
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [showPopup, calcPosition]);

  const isMissingCost = !hasRealCost && costSource.productCost === 'missing';
  const displayProfit = hasRealCost ? netProfitAfterTax : grossProfit;
  const displayLabel = hasRealCost ? '税后净利润' : '毛利（未扣商品成本）';

  // 缺失成本时的触发样式
  const triggerClass = isMissingCost
    ? 'text-pdd-gray-400 font-mono text-xs cursor-help border-b border-dashed border-pdd-gray-300'
    : `font-mono text-xs cursor-help border-b border-dashed ${profitConfidence === 'high' ? 'border-green-300 text-green-600' : profitConfidence === 'medium' ? 'border-yellow-300 text-yellow-600' : 'border-red-300 text-red-500'}`;

  const triggerText = isMissingCost ? '--' : `¥${fmt(displayProfit)}`;

  // 弹窗内容
  const renderPopupContent = () => {
    if (isMissingCost) {
      return (
        <div className="w-72 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-red-500 font-bold text-sm">
              <AlertCircle size={16} />
              <span>利润待计算</span>
            </div>
            <button onClick={() => setShowPopup(false)} className="text-pdd-gray-400 hover:text-pdd-gray-600">
              <X size={14} />
            </button>
          </div>
          <p className="text-pdd-gray-600 text-xs mb-3 leading-relaxed">
            当前商品缺少成本数据，无法计算真实利润。请在成本管理页面填写商品成本后，系统将自动计算包含税费、扣费在内的完整利润。
          </p>
          {onGoToCostManagement && (
            <button
              onClick={() => { setShowPopup(false); onGoToCostManagement(); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-md transition-colors"
            >
              去填写成本 <ExternalLink size={12} />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="w-80">
        {/* Header */}
        <div className={`px-4 py-2.5 rounded-t-lg flex items-center justify-between ${conf.bg}`}>
          <span className={`font-bold text-sm ${conf.color}`}>{displayLabel}: ¥{fmt(displayProfit)}</span>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-[10px] font-medium ${conf.color}`}>
              <ConfIcon size={12} />{conf.label}
            </span>
            <button onClick={() => setShowPopup(false)} className="text-pdd-gray-400 hover:text-pdd-gray-600 ml-1">
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 收入 */}
          <div>
            <div className="text-[10px] text-pdd-gray-400 font-semibold uppercase tracking-wide mb-1.5">收入</div>
            <div className="flex justify-between text-pdd-gray-700 text-xs">
              <span>实收金额</span>
              <span className="font-mono font-medium">¥{fmt(revenue)}</span>
            </div>
            {costBreakdown.discount > 0 && (
              <div className="text-[10px] text-pdd-gray-400 mt-0.5">
                已含折扣: ¥{fmt(costBreakdown.discount)}（已从实收中扣除）
              </div>
            )}
          </div>

          {/* 直接成本 */}
          <div>
            <div className="text-[10px] text-pdd-gray-400 font-semibold uppercase tracking-wide mb-1.5">直接成本</div>
            <div className="space-y-1 text-xs text-pdd-gray-600">
              <div className="flex justify-between group relative">
                <span className="flex items-center gap-1">
                  商品成本
                  <span className={`text-[10px] px-1 rounded ${costSource.productCost === 'real' ? 'bg-green-100 text-green-600' : costSource.productCost === 'estimated' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-500'}`}>
                    {costSource.productCost === 'real' ? '真实' : costSource.productCost === 'estimated' ? '估算' : '缺失'}
                  </span>
                </span>
                <span className="font-mono">¥{fmt(costBreakdown.productCost)}</span>
              </div>
              <div className="text-[10px] text-pdd-gray-400 pl-2 border-l border-pdd-gray-200">
                {costSource.productCost === 'real'
                  ? '基于成本管理填写的裸货成本 × 销量计算'
                  : costSource.productCost === 'estimated'
                  ? '按实收金额比例估算，建议到成本管理填写真实成本'
                  : '未配置成本，请在成本管理页面填写'}
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  包装费
                  <span className="text-[10px] text-pdd-gray-400">(每单固定)</span>
                </span>
                <span className="font-mono">¥{fmt(costBreakdown.packagingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  快递费
                  <span className="text-[10px] text-pdd-gray-400">(每单固定)</span>
                </span>
                <span className="font-mono">¥{fmt(costBreakdown.shippingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  推广费
                  <span className="text-[10px] text-pdd-gray-400">(来自推广报表)</span>
                </span>
                <span className="font-mono">¥{fmt(costBreakdown.promoCost)}</span>
              </div>
              {costBreakdown.platformFee > 0 && (
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    平台扣点
                    <span className="text-[10px] text-pdd-gray-400">(含百亿补贴)</span>
                  </span>
                  <span className="font-mono">¥{fmt(costBreakdown.platformFee)}</span>
                </div>
              )}
              {(costBreakdown.insuranceFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>运费险</span>
                  <span className="font-mono">¥{fmt(costBreakdown.insuranceFee!)}</span>
                </div>
              )}
              {(costBreakdown.penaltyFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-red-500">罚款/扣款</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.penaltyFee!)}</span>
                </div>
              )}
              {(costBreakdown.marketingFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>营销费用(实际)</span>
                  <span className="font-mono">-¥{fmt(costBreakdown.marketingFee!)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 税费合计 */}
          {taxDetails.length > 0 && (
            <div>
              <div className="text-[10px] text-pdd-gray-400 font-semibold uppercase tracking-wide mb-1.5">税费合计</div>
              <div className="flex justify-between text-xs text-pdd-gray-600">
                <span>{taxDetails.map(t => t.name).join(' + ')}</span>
                <span className="font-mono">¥{fmt(costBreakdown.taxes)}</span>
              </div>
            </div>
          )}

          {/* 自定义扣费明细 */}
          {deductionDetails.length > 0 && (
            <div>
              <div className="text-[10px] text-pdd-gray-400 font-semibold uppercase tracking-wide mb-1.5">
                其他扣费明细
                <span className="text-[10px] text-pdd-gray-400 font-normal">({deductionDetails.length}项)</span>
              </div>
              {deductionDetails.map((d, i) => (
                <div key={i} className="flex justify-between text-[11px] text-pdd-gray-500 py-0.5">
                  <span className="truncate max-w-[150px]">&middot; {d.name}</span>
                  <span className="font-mono">¥{fmt(d.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-pdd-gray-600 border-t border-pdd-gray-100 pt-1 mt-0.5">
                <span className="font-medium">扣费合计</span>
                <span className="font-mono">¥{fmt(costBreakdown.customDeductions)}</span>
              </div>
            </div>
          )}

          {/* 展开明细按钮 */}
          {(taxDetails.length > 0 || deductionDetails.length > 0) && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors mt-1"
            >
              {expanded ? '收起明细' : '查看详细扣费明细'} {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* 展开的明细 */}
          {expanded && (
            <div className="border-t border-pdd-gray-100 pt-2 space-y-2">
              {taxDetails.length > 0 && (
                <div>
                  <div className="text-[10px] text-pdd-gray-400 font-medium mb-1">税费明细</div>
                  {taxDetails.map((t, i) => (
                    <div key={i} className="flex justify-between text-[11px] text-pdd-gray-500 py-0.5">
                      <span>{t.name} ({t.rate}% x ¥{fmt(t.base)})</span>
                      <span className="font-mono">¥{fmt(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              {deductionDetails.length > 0 && (
                <div>
                  <div className="text-[10px] text-pdd-gray-400 font-medium mb-1">自定义扣费明细</div>
                  {deductionDetails.map((d, i) => (
                    <div key={i} className="py-1.5 border-b border-pdd-gray-50 last:border-0">
                      <div className="flex justify-between text-[11px] text-pdd-gray-600">
                        <span className="font-medium">{d.name}</span>
                        <span className="font-mono">¥{fmt(d.amount)}</span>
                      </div>
                      <div className="text-[10px] text-pdd-gray-400 mt-0.5 pl-2 border-l border-pdd-gray-200 space-y-0.5">
                        <div>公式: {d.formula}</div>
                        {d.amount === 0 && (
                          <div className="text-orange-400">计算结果为0，可能条件未满足或数据为0</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 利润计算过程 */}
          <div className="border-t border-pdd-gray-100 pt-3 mt-2">
            <div className="text-[10px] text-pdd-gray-400 font-semibold uppercase tracking-wide mb-2">利润计算过程</div>
            <div className="space-y-1 text-[11px] text-pdd-gray-500">
              <div className="flex justify-between">
                <span>实收金额</span>
                <span className="font-mono text-green-600">+¥{fmt(revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>商品成本</span>
                <span className="font-mono text-red-500">-¥{fmt(costBreakdown.productCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>包装费</span>
                <span className="font-mono text-red-500">-¥{fmt(costBreakdown.packagingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>快递费</span>
                <span className="font-mono text-red-500">-¥{fmt(costBreakdown.shippingFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>推广费</span>
                <span className="font-mono text-red-500">-¥{fmt(costBreakdown.promoCost)}</span>
              </div>
              {costBreakdown.platformFee > 0 && (
                <div className="flex justify-between">
                  <span>平台扣点</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.platformFee)}</span>
                </div>
              )}
              {(costBreakdown.insuranceFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>运费险</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.insuranceFee!)}</span>
                </div>
              )}
              {(costBreakdown.penaltyFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>罚款/扣款</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.penaltyFee!)}</span>
                </div>
              )}
              {(costBreakdown.marketingFee ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>营销费用</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.marketingFee!)}</span>
                </div>
              )}
              {taxDetails.length > 0 && (
                <div className="flex justify-between">
                  <span>税费合计</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.taxes)}</span>
                </div>
              )}
              {deductionDetails.length > 0 && (
                <div className="flex justify-between">
                  <span>其他扣费</span>
                  <span className="font-mono text-red-500">-¥{fmt(costBreakdown.customDeductions)}</span>
                </div>
              )}
              <div className="border-t border-pdd-gray-200 pt-1 mt-1 flex justify-between font-medium">
                <span>最终利润</span>
                <span className={`font-mono ${netProfitAfterTax >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ¥{fmt(netProfitAfterTax)}
                </span>
              </div>
            </div>
          </div>

          {/* 数据来源 */}
          <div className="border-t border-pdd-gray-100 pt-2 text-[10px] text-pdd-gray-400">
            数据来源: 订单CSV + 推广XLSX{costSource.productCost === 'real' ? ' + 成本管理' : ''}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={triggerClass}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {triggerText}
      </span>

      {showPopup && createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] bg-pdd-card rounded-lg shadow-2xl border border-pdd-gray-200 text-xs animate-in fade-in duration-150"
          style={{ top: popupPos.top, left: popupPos.left, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {renderPopupContent()}
        </div>,
        document.body
      )}
    </>
  );
}
