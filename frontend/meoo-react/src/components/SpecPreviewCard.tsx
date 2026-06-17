import React from 'react';
import type { SpecGroupItem } from '../utils/specGrouping';

export interface PreviewSkuItem {
  skuName: string;
  skuCode?: string;
  price: number;
  orders: number;
}

interface Props {
  label: string;
  items: (SpecGroupItem | PreviewSkuItem)[];
  /** 是否显示 */
  visible: boolean;
  /** 屏幕坐标 */
  x: number;
  y: number;
}

function isSpecGroupItem(item: any): item is SpecGroupItem {
  return 'prices' in item && Array.isArray(item.prices);
}

/**
 * 规格分组悬浮预览卡片
 * 鼠标悬停在规格组标签上时显示组内所有 SKU 明细
 * 兼容 SpecGroupItem（成本管理页）和 PreviewSkuItem（商品分析页）
 */
export default function SpecPreviewCard({ label, items, visible, x, y }: Props) {
  if (!visible || !items.length) return null;

  return (
    <div
      className="fixed z-[99999] pointer-events-none"
      style={{ left: Math.min(x, window.innerWidth - 320), top: Math.min(y, window.innerHeight - 300) }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[300px] max-h-[280px] overflow-hidden">
        {/* header */}
        <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">{label}</span>
          <span className="text-[10px] text-gray-400 bg-white/60 px-1.5 py-0.5 rounded">{items.length}个SKU</span>
        </div>
        {/* body */}
        <div className="divide-y divide-gray-50 max-h-[240px] overflow-y-auto">
          {items.map((item: any, i: number) => {
            const avgPrice = isSpecGroupItem(item)
              ? (item.prices.length ? item.prices.reduce((a: number, b: number) => a + b, 0) / item.prices.length : 0)
              : item.price || 0;
            const orderCount = isSpecGroupItem(item) ? item.orderCount : item.orders || 0;
            return (
              <div key={i} className="px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 text-[11px]">
                <span className="text-gray-300 font-mono w-4 shrink-0">{i + 1}.</span>
                <span className="text-gray-700 truncate flex-1 min-w-0" title={item.skuName}>
                  {item.skuName || '-'}
                </span>
                {item.skuCode && (
                  <span className="text-[9px] text-green-600 bg-green-50 px-1 rounded font-mono shrink-0">
                    {item.skuCode}
                  </span>
                )}
                <span className="text-gray-400 font-mono shrink-0">
                  ¥{avgPrice.toFixed(1)}
                </span>
                <span className="text-gray-400 shrink-0">
                  {orderCount}单
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
