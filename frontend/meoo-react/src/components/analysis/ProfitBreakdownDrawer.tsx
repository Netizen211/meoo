/**
 * 利润核算明细抽屉 — 展示利润推导过程 + 数据来源路径
 * 上半部分：逐步推导（实收 - 各项成本 = 利润）
 * 下半部分：每个数字的数据来源路径
 */
import React from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Package, Truck, Target, Shield, AlertTriangle, FileText, Database } from 'lucide-react';

interface CostItem {
  label: string;       // 费用名
  amount: number;      // 金额（正数表示扣减）
  source: string;      // 数据来源
  sourcePath: string;  // 数据路径（CSV字段/计算逻辑）
  icon: React.ReactNode;
  color: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gmv: number;          // 商品总价
  revenue: number;       // 实收金额
  productCost: number;   // 裸货成本
  packagingFee: number;  // 包装费
  shippingFee: number;   // 快递费
  promoCost: number;     // 推广费
  platformFee: number;   // 平台佣金
  insuranceFee: number;  // 运费险
  penaltyFee: number;    // 罚款
  otherFees: { label: string; amount: number; source: string }[]; // 自定义扣费
  orderCount: number;
  itemCount: number;
  storeName?: string;
}

function fmt(n: number): string {
  const v = isNaN(n) ? 0 : n;
  return '¥' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function ProfitBreakdownDrawer({
  isOpen, onClose, gmv, revenue, productCost, packagingFee, shippingFee,
  promoCost, platformFee, insuranceFee, penaltyFee, otherFees, orderCount, itemCount
}: Props) {
  if (!isOpen) return null;

  const costItems: CostItem[] = [
    { label: '商品裸货成本', amount: productCost, source: 'SKU成本配置', sourcePath: `成本管理页 → 按SKU编码匹配 → dianfx_product_costs_<storeId>`, icon: <Package size={14} />, color: '#e02e24' },
    { label: '包装费', amount: packagingFee, source: '费用配置', sourcePath: `成本管理页 → 包装费(元/单) × ${orderCount}单 = ${fmt(packagingFee)}`, icon: <Package size={14} />, color: '#f97316' },
    { label: '快递费', amount: shippingFee, source: '费用配置', sourcePath: `成本管理页 → 快递费(元/单) × ${orderCount}单 = ${fmt(shippingFee)}`, icon: <Truck size={14} />, color: '#f97316' },
    { label: '推广费', amount: promoCost, source: '推广数据', sourcePath: `商品推广XLSX → 按商品ID匹配 → 总花费(元)求和`, icon: <Target size={14} />, color: '#7c3aed' },
    { label: '平台佣金(已含实收)', amount: platformFee, source: '货款明细/公式(仅供参考)', sourcePath: `货款明细CSV → 平台技术服务费（已含在商家实收中，仅供参考）`, icon: <Database size={14} />, color: '#0891b2' },
    { label: '运费险', amount: insuranceFee, source: '运费险数据/配置', sourcePath: `运费险XLSX → 按订单号匹配服务费用 或 保费(元/单)`, icon: <Shield size={14} />, color: '#0891b2' },
    { label: '罚款/扣款', amount: penaltyFee, source: '货款明细', sourcePath: `货款明细CSV → 004/006开头扣款 → 按商户订单号匹配`, icon: <AlertTriangle size={14} />, color: '#e02e24' },
    ...otherFees.map(f => ({ label: f.label, amount: f.amount, source: '自定义扣费', sourcePath: f.source, icon: <FileText size={14} />, color: '#6b7280' })),
  ].filter(c => c.amount > 0 || c.label.includes('成本'));

  // 总成本不含平台佣金（已含在商家实收中）
  const totalCosts = costItems.filter(c => c.amount > 0 && !c.label.includes('平台佣金')).reduce((s, c) => s + c.amount, 0);
  const netProfit = revenue - totalCosts;
  const profitRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const discount = gmv - revenue;

  return (
    <div className="fixed inset-0 z-[10000] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative ml-auto w-[520px] h-full bg-pdd-card border-l border-pdd-border shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-pdd-card border-b border-pdd-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-sm font-bold text-pdd-text">利润核算明细</h2>
            <p className="text-[10px] text-pdd-text-secondary mt-0.5">逐步推导 + 数据来源追溯</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-pdd-bg text-pdd-text-secondary">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* === 上半部分：利润瀑布可视化 === */}
          <div className="bg-pdd-bg rounded-xl p-4">
            <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
              <DollarSign size={14} color="#16a34a" />利润流向
            </h3>

            {/* 瀑布条 — 直观展示实收→各项扣减→净利润 */}
            <div className="space-y-1">
              {/* GMV bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-pdd-text-secondary w-14 text-right shrink-0">GMV</span>
                <div className="flex-1 h-7 bg-blue-500 rounded flex items-center justify-end px-2" style={{width: '100%'}}>
                  <span className="text-[10px] text-white font-mono font-bold">{fmt(gmv)}</span>
                </div>
              </div>
              {/* 实收 bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-green-600 w-14 text-right shrink-0 font-bold">实收</span>
                <div className="flex-1 h-7 bg-green-500 rounded flex items-center justify-end px-2" style={{width: `${Math.max(15, (revenue/gmv)*100)}%`}}>
                  <span className="text-[10px] text-white font-mono font-bold">{fmt(revenue)}</span>
                </div>
                {discount > 0 && <span className="text-[10px] text-red-400 font-mono shrink-0">折让{fmt(discount)}</span>}
              </div>

              {/* 扣减项 bars — 每项缩进，宽度按占比 */}
              {costItems.map((item, i) => {
                const pct = revenue > 0 ? Math.max(5, (item.amount / revenue) * 100) : 5;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-pdd-text-secondary w-14 text-right shrink-0 truncate" title={item.label}>
                      {item.label.length > 4 ? item.label.slice(0,4) : item.label}
                    </span>
                    <div className="flex-1 h-5 rounded flex items-center justify-between px-2" style={{width: `${Math.min(70, pct)}%`, backgroundColor: item.color + '20', borderLeft: `3px solid ${item.color}`}}>
                      <span className="text-[10px] text-pdd-text-secondary">{item.label.length > 6 ? item.label.slice(0,6)+'..' : item.label}</span>
                      <span className="text-[10px] text-red-500 font-mono font-medium">-{fmt(item.amount)}</span>
                    </div>
                  </div>
                );
              })}

              {/* 净利润 bar — 醒目 */}
              <div className="flex items-center gap-2 pt-1 border-t border-pdd-border">
                <span className={`text-[10px] w-14 text-right shrink-0 font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>净利润</span>
                <div className={`flex-1 h-8 rounded flex items-center justify-between px-3 ${netProfit >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${Math.max(10, Math.abs(netProfit)/Math.max(revenue,1)*100)}%`}}>
                  <span className="text-[11px] text-white font-bold">{netProfit >= 0 ? '盈利' : '亏损'}</span>
                  <span className="text-[11px] text-white font-mono font-bold">{fmt(netProfit)}</span>
                </div>
                <span className={`text-[10px] font-bold shrink-0 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{isNaN(profitRate) ? '--' : profitRate.toFixed(1) + '%'}</span>
              </div>
            </div>
          </div>

          {/* === 下半部分：数据来源路径 === */}
          <div>
            <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
              <Database size={14} color="#3b82f6" />数据来源追溯
            </h3>

            <div className="space-y-2">
              {/* 基础数据 */}
              <SourceRow label="实收金额" value={fmt(revenue)} path="订单CSV → 商家实收金额(元)字段 → 筛选当前商品 → 求和" />
              <SourceRow label="订单数/件数" value={`${orderCount}单 / ${itemCount}件`} path="订单CSV → 按商品ID筛选 → 计数" />

              {/* 成本数据 */}
              {costItems.map((item, i) => (
                <SourceRow key={i} label={item.label} value={fmt(item.amount)} path={item.sourcePath} />
              ))}

              {/* 最终利润 */}
              <SourceRow label="净利润" value={fmt(netProfit)}
                path={`实收(${fmt(revenue)}) - 总成本(${fmt(totalCosts)}) = ${fmt(netProfit)}`}
                highlight />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ label, value, path, highlight }: { label: string; value: string; path: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-pdd-bg'}`}>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-medium ${highlight ? 'text-blue-700' : 'text-pdd-text'}`}>{label}</span>
        <span className={`text-xs font-mono font-bold ${highlight ? 'text-blue-700' : 'text-pdd-text'}`}>{value}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-pdd-text-secondary">
        <FileText size={10} />
        <span className="font-mono">{path}</span>
      </div>
    </div>
  );
}
