import React from 'react';
import { Package, DollarSign, ShoppingCart, Download, Clock, Shield } from 'lucide-react';
import { ProductStat } from '../ProductLinkStats';

interface Product360AnalysisProps {
  product: ProductStat | null;
  compareProducts?: ProductStat[];
  onExport?: () => void;
  onClose?: () => void;
  orders?: any[];
  costConfig?: { productCosts: Record<string, number>; defaultCostRatio: number; packagingFeePerOrder: number; shippingFeePerOrder: number; };
  gmvTrend?: number;
  refundRateTrend?: number;
}

// ─── 主组件 ───
export default function Product360Analysis({
  product,
  onExport,
  onClose,
  orders = [],
}: Product360AnalysisProps) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'detail'>('overview');

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-pdd-text-secondary">
        <Package size={48} className="mb-4 opacity-30" />
        <p className="text-sm">选择商品查看360度分析</p>
      </div>
    );
  }

  // 导出CSV
  const handleExport = () => {
    const data = {
      商品名称: product.productName, 商品ID: product.productId, 商家编码: product.productCode,
      GMV: product.gmv, 实收金额: product.revenue, 订单数: product.orders, 销量: product.sales,
      客单价: product.avgOrderValue, 退款金额: product.refund, 退款率: product.refundRate,
      售后率: product.afterSaleRate, 推广花费: product.promoCost, 推广成交: product.promoTransaction,
      ROI: product.roi, CTR: product.cvr,
      毛利润: product.grossProfit, 净利润: product.netProfitAfterTax,
      利润率: product.profitRate, 总成本: product.totalCost,
    };
    const csv = [Object.keys(data).join(','), Object.values(data).join(',')].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `商品360分析_${product.productName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onExport?.();
  };

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-pdd-bg rounded-lg p-1">
            <button onClick={() => setActiveTab('overview')}
              className={'px-3 py-1.5 rounded-md text-xs font-medium transition-all ' + (activeTab === 'overview' ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text')}>
              概览
            </button>
            <button onClick={() => setActiveTab('detail')}
              className={'px-3 py-1.5 rounded-md text-xs font-medium transition-all ' + (activeTab === 'detail' ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text')}>
              明细
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pdd-bg text-pdd-text hover:bg-pdd-bg transition-colors text-xs font-medium">
              <Download size={14} />
              导出
            </button>
            {onClose && (
              <button onClick={onClose}
                className="p-2 rounded-lg hover:bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text transition-colors">
                <Package size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 概览模式 ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* KPI 核心指标 */}
          <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
            <h4 className="text-sm font-semibold text-pdd-text mb-3">核心指标</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-pdd-bg rounded-lg p-3">
                <div className="text-[10px] font-medium text-pdd-text-secondary uppercase tracking-wide">GMV</div>
                <div className="text-lg font-bold text-pdd-text mt-1">¥{product.gmv.toFixed(0)}</div>
                <div className="text-[10px] text-pdd-text-secondary mt-0.5">{product.orders}笔订单</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <div className="text-[10px] font-medium text-pdd-text-secondary uppercase tracking-wide">实收金额</div>
                <div className="text-lg font-bold text-pdd-success mt-1">¥{product.revenue.toFixed(0)}</div>
                <div className="text-[10px] text-pdd-text-secondary mt-0.5">客单价 ¥{product.avgOrderValue.toFixed(0)}</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <div className="text-[10px] font-medium text-pdd-text-secondary uppercase tracking-wide">净利润</div>
                <div className={'text-lg font-bold mt-1 ' + ((product.netProfitAfterTax || product.netProfit) >= 0 ? 'text-pdd-success' : 'text-pdd-danger')}>
                  ¥{(product.netProfitAfterTax || product.netProfit).toFixed(0)}
                </div>
                <div className="text-[10px] text-pdd-text-secondary mt-0.5">利润率 {product.profitRate.toFixed(1)}%</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <div className="text-[10px] font-medium text-pdd-text-secondary uppercase tracking-wide">ROI</div>
                <div className={'text-lg font-bold mt-1 ' + (product.roi >= 1 ? 'text-pdd-success' : 'text-pdd-danger')}>
                  {product.roi.toFixed(2)}x
                </div>
                <div className="text-[10px] text-pdd-text-secondary mt-0.5">花费 ¥{product.promoCost.toFixed(0)}</div>
              </div>
            </div>
          </div>

          {/* 运营指标三列 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-3.5">
              <h4 className="text-xs font-semibold text-pdd-primary flex items-center gap-1.5 mb-3">
                <ShoppingCart size={13} /> 销售数据
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">订单数</span>
                  <span className="text-sm font-semibold font-mono text-pdd-text">{product.orders}<span className="text-[10px] text-pdd-text-secondary ml-0.5">笔</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">销量</span>
                  <span className="text-sm font-semibold font-mono text-pdd-text">{product.sales}<span className="text-[10px] text-pdd-text-secondary ml-0.5">件</span></span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">客单价</span>
                  <span className="text-sm font-semibold font-mono text-pdd-text">¥{product.avgOrderValue.toFixed(0)}</span>
                </div>
              </div>
            </div>

            <div className="bg-pdd-card rounded-xl border border-pdd-border p-3.5">
              <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3" style={{color: 'var(--pdd-success)'}}>
                <DollarSign size={13} /> 成本利润
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">总成本</span>
                  <span className="text-sm font-bold font-mono text-pdd-danger">¥{(product.totalCost || 0).toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">毛利润</span>
                  <span className={'text-sm font-bold font-mono ' + ((product.grossProfit || 0) >= 0 ? 'text-pdd-success' : 'text-pdd-danger')}>¥{(product.grossProfit || 0).toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">净利润</span>
                  <span className={'text-sm font-bold font-mono ' + (product.netProfit >= 0 ? 'text-pdd-success' : 'text-pdd-danger')}>¥{(product.netProfitAfterTax || product.netProfit).toFixed(0)}</span>
                </div>
              </div>
            </div>

            <div className="bg-pdd-card rounded-xl border border-pdd-border p-3.5">
              <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3" style={{color: 'var(--pdd-warning)'}}>
                <Shield size={13} /> 售后质量
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">退款率</span>
                  <span className={'text-sm font-bold font-mono ' + (product.refundRate > 10 ? 'text-pdd-danger' : 'text-pdd-text')}>{product.refundRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">售后率</span>
                  <span className={'text-sm font-bold font-mono ' + (product.afterSaleRate > 5 ? 'text-pdd-danger' : 'text-pdd-text')}>{product.afterSaleRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-pdd-text-secondary">售后订单</span>
                  <span className="text-sm font-bold font-mono text-pdd-text">{product.afterSaleCount}单</span>
                </div>
              </div>
            </div>
          </div>

          {/* 成本构成 */}
          <div className="bg-pdd-card rounded-xl border border-pdd-border p-3.5">
            <h4 className="text-xs font-semibold text-pdd-text flex items-center gap-1.5 mb-3">
              <DollarSign size={13} style={{color: 'var(--pdd-primary)'}} />
              成本构成
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-pdd-bg rounded-lg p-2.5">
                <div className="text-pdd-text-secondary">商品成本</div>
                <div className="text-sm font-bold text-pdd-text mt-0.5">¥{(product.totalCost || 0).toFixed(0)}</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-2.5">
                <div className="text-pdd-text-secondary">推广花费</div>
                <div className="text-sm font-bold text-pdd-text mt-0.5">¥{product.promoCost.toFixed(0)}</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-2.5">
                <div className="text-pdd-text-secondary">退款金额</div>
                <div className="text-sm font-bold text-pdd-text mt-0.5">¥{product.refund.toFixed(0)}</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-2.5">
                <div className="text-pdd-text-secondary">平台费用</div>
                <div className="text-sm font-bold text-pdd-text mt-0.5">¥{((product.totalCost || 0) - product.grossProfit).toFixed(0)}</div>
              </div>
            </div>
          </div>

          {/* 推广数据 */}
          {product.hasPromoData && (
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-3.5">
              <h4 className="text-xs font-semibold text-pdd-text mb-3">推广效果</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-pdd-text-secondary">花费</div>
                  <div className="text-sm font-bold text-pdd-text">¥{product.promoCost.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-pdd-text-secondary">成交</div>
                  <div className="text-sm font-bold text-pdd-success">¥{product.promoTransaction.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-pdd-text-secondary">ROI</div>
                  <div className={'text-sm font-bold ' + (product.roi >= 1 ? 'text-pdd-success' : 'text-pdd-danger')}>{product.roi.toFixed(2)}x</div>
                </div>
                <div>
                  <div className="text-[10px] text-pdd-text-secondary">CTR</div>
                  <div className="text-sm font-bold text-pdd-primary">{product.ctr.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 明细模式 ─── */}
      {activeTab === 'detail' && (
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-3.5">
          <h4 className="text-xs font-semibold text-pdd-text mb-3">订单明细 ({orders.length}笔)</h4>
          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-pdd-text-secondary border-b border-pdd-border">
                    <th className="text-left py-2 font-medium">订单号</th>
                    <th className="text-right py-2 font-medium">金额</th>
                    <th className="text-right py-2 font-medium">状态</th>
                    <th className="text-right py-2 font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 50).map((o: any, i: number) => (
                    <tr key={o.orderId || i} className="border-b border-pdd-border/50 hover:bg-pdd-bg/50">
                      <td className="py-2 text-left font-mono">{o.orderId || '--'}</td>
                      <td className="py-2 text-right font-mono">¥{(o.amount || 0).toFixed(0)}</td>
                      <td className="py-2 text-right">
                        <span className={'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ' + (o.status === '正常' ? 'bg-pdd-success/10 text-pdd-success' : 'bg-pdd-warning/10 text-pdd-warning')}>{o.status || '--'}</span>
                      </td>
                      <td className="py-2 text-right text-pdd-text-secondary">{o.orderTime || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length > 50 && (
                <div className="text-center text-[10px] text-pdd-text-secondary mt-2">仅显示前50条订单</div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-pdd-text-secondary text-xs">暂无订单数据</div>
          )}
        </div>
      )}

      {/* 底部状态 */}
      <div className="flex items-center justify-between text-[10px] text-pdd-text-secondary px-1">
        <div className="flex items-center gap-1">
          <Clock size={11} />
          <span>数据截止: {product.lastOrderDate || '--'}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-0.5">
            <span className={'w-1.5 h-1.5 rounded-full ' + (product.hasOrderData ? 'bg-pdd-success' : 'bg-pdd-border')} />
            订单: {product.hasOrderData ? '已同步' : '未同步'}
          </span>
          <span className="flex items-center gap-0.5">
            <span className={'w-1.5 h-1.5 rounded-full ' + (product.hasPromoData ? 'bg-pdd-success' : 'bg-pdd-border')} />
            推广: {product.hasPromoData ? '已同步' : '未同步'}
          </span>
        </div>
      </div>
    </div>
  );
}
