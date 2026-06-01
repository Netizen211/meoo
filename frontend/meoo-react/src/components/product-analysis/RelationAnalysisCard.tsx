import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Link2, Users, Repeat, ChevronDown, ChevronUp, ShoppingBag, Star } from 'lucide-react';

interface RelatedProduct {
  productId: string;
  productName: string;
  coOccurrenceCount: number;
}

interface ProductStat {
  productId: string;
  productName: string;
  relatedProducts: RelatedProduct[];
  orders: number;
  sales: number;
  gmv: number;
}

interface RelationAnalysisCardProps {
  productStat: ProductStat;
  orders: any[];
}

const COLORS = ['var(--pdd-danger)', 'var(--pdd-danger-light)', 'var(--pdd-warning)', 'var(--pdd-success)', 'var(--pdd-primary)', 'var(--pdd-purple)', 'var(--pdd-cyan)', 'var(--pdd-pink)'];

export default function RelationAnalysisCard({ productStat, orders }: RelationAnalysisCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'related' | 'repurchase' | 'customer'>('related');

  // 关联商品数据
  const relatedProductsData = useMemo(() => {
    if (!productStat.relatedProducts || productStat.relatedProducts.length === 0) return [];
    return productStat.relatedProducts.slice(0, 8).map(item => ({
      ...item,
      relationScore: Math.min(100, Math.round((item.coOccurrenceCount / Math.max(productStat.orders, 1)) * 100))
    }));
  }, [productStat.relatedProducts, productStat.orders]);

  // 连带销售分析
  const bundleAnalysis = useMemo(() => {
    const buyerOrders: Record<string, any[]> = {};
    orders.forEach(order => {
      const orderNo = String(order['订单号'] || ''); // 完整订单号
      if (!buyerOrders[orderNo]) buyerOrders[orderNo] = [];
      buyerOrders[orderNo].push(order);
    });

    let bundleOrders = 0;
    let singleOrders = 0;
    let totalBundleItems = 0;

    Object.values(buyerOrders).forEach(orderList => {
      if (orderList.length > 1) {
        bundleOrders++;
        totalBundleItems += orderList.length;
      } else {
        singleOrders++;
      }
    });

    const bundleRate = (bundleOrders + singleOrders) > 0 
      ? (bundleOrders / (bundleOrders + singleOrders)) * 100 
      : 0;
    const avgBundleSize = bundleOrders > 0 ? totalBundleItems / bundleOrders : 0;

    return { bundleOrders, singleOrders, bundleRate, avgBundleSize, totalBundleItems };
  }, [orders]);

  // 复购率统计
  const repurchaseStats = useMemo(() => {
    const buyerOrders: Record<string, number> = {};
    orders.forEach(order => {
      const orderNo = String(order['订单号'] || ''); // 完整订单号
      buyerOrders[orderNo] = (buyerOrders[orderNo] || 0) + 1;
    });

    const repeatBuyers = Object.values(buyerOrders).filter(count => count > 1).length;
    const singleBuyers = Object.values(buyerOrders).filter(count => count === 1).length;
    const totalBuyers = repeatBuyers + singleBuyers;
    
    const repurchaseRate = totalBuyers > 0 ? (repeatBuyers / totalBuyers) * 100 : 0;
    const avgOrdersPerBuyer = totalBuyers > 0 
      ? Object.values(buyerOrders).reduce((a, b) => a + b, 0) / totalBuyers 
      : 0;

    return { repeatBuyers, singleBuyers, repurchaseRate, avgOrdersPerBuyer, totalBuyers };
  }, [orders]);

  // 新老客占比
  const customerTypeData = useMemo(() => {
    return [
      { name: '新客', value: repurchaseStats.singleBuyers, percentage: repurchaseStats.totalBuyers > 0 ? (repurchaseStats.singleBuyers / repurchaseStats.totalBuyers) * 100 : 0 },
      { name: '老客', value: repurchaseStats.repeatBuyers, percentage: repurchaseStats.totalBuyers > 0 ? (repurchaseStats.repeatBuyers / repurchaseStats.totalBuyers) * 100 : 0 }
    ];
  }, [repurchaseStats]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden"
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-pdd-border cursor-pointer hover:bg-pdd-bg/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pdd-primary/10 flex items-center justify-center">
            <Link2 size={16} className="text-pdd-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-pdd-text">关联分析</h3>
            <p className="text-xs text-pdd-text-secondary">连带销售、复购率、新老客分析</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {relatedProductsData.length > 0 && (
            <span className="px-2 py-0.5 bg-pdd-primary/10 text-pdd-primary-dark text-xs font-medium rounded-full">
              {relatedProductsData.length}个关联商品
            </span>
          )}
          {isExpanded ? <ChevronUp size={18} className="text-pdd-text-secondary" /> : <ChevronDown size={18} className="text-pdd-text-secondary" />}
        </div>
      </div>

      {/* 内容区 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* 核心指标 */}
            <div className="grid grid-cols-4 gap-3 p-4 border-b border-pdd-border">
              <div className="bg-pdd-primary/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">连带率</div>
                <div className="text-lg font-bold text-pdd-primary-dark">{bundleAnalysis.bundleRate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">{bundleAnalysis.bundleOrders}笔连带</div>
              </div>
              <div className="bg-pdd-info/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">复购率</div>
                <div className="text-lg font-bold text-pdd-info">{repurchaseStats.repurchaseRate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">{repurchaseStats.repeatBuyers}人复购</div>
              </div>
              <div className="bg-pdd-success/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">平均连带件数</div>
                <div className="text-lg font-bold text-pdd-success">{bundleAnalysis.avgBundleSize.toFixed(1)}</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">件/单</div>
              </div>
              <div className="bg-pdd-warning/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">人均订单数</div>
                <div className="text-lg font-bold text-orange-600">{repurchaseStats.avgOrdersPerBuyer.toFixed(1)}</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">单/人</div>
              </div>
            </div>

            {/* Tab切换 */}
            <div className="flex items-center gap-1 px-4 pt-3 border-b border-pdd-border">
              {[
                { key: 'related', label: '关联商品', icon: ShoppingBag },
                { key: 'repurchase', label: '连带分析', icon: Repeat },
                { key: 'customer', label: '客户构成', icon: Users }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? 'text-pdd-primary-dark bg-pdd-primary/10 border-b-2 border-purple-500'
                      : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg'
                  }`}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 内容区 */}
            <div className="p-4">
              {activeTab === 'related' && (
                <div>
                  <div className="text-xs font-medium text-pdd-text mb-3">关联商品TOP排行</div>
                  {relatedProductsData.length > 0 ? (
                    <div className="space-y-2">
                      {relatedProductsData.map((item, index) => (
                        <div key={item.productId} className="flex items-center justify-between p-3 bg-pdd-bg rounded-lg hover:bg-pdd-bg transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-pdd-primary/10 flex items-center justify-center text-xs font-bold text-pdd-primary-dark">
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-pdd-text truncate max-w-[150px]">{item.productName}</div>
                              <div className="text-xs text-pdd-text-secondary">ID: {item.productId.slice(-8)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xs text-pdd-text-secondary">共同购买</div>
                              <div className="text-sm font-bold text-pdd-primary-dark">{item.coOccurrenceCount}次</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-pdd-text-secondary">关联度</div>
                              <div className="flex items-center gap-1">
                                <Star size={10} className="text-pdd-warning fill-yellow-500" />
                                <span className="text-sm font-bold text-pdd-text">{item.relationScore}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[150px] flex items-center justify-center text-pdd-text-secondary text-xs">
                      暂无关联商品数据
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'repurchase' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-pdd-text mb-3">连带销售统计</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-pdd-primary/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={14} className="text-pdd-primary" />
                          <span className="text-xs text-pdd-text">连带订单</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-primary-dark">{bundleAnalysis.bundleOrders}单</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pdd-bg rounded-lg">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={14} className="text-pdd-text-secondary" />
                          <span className="text-xs text-pdd-text">单件订单</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-text">{bundleAnalysis.singleOrders}单</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pdd-info/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Link2 size={14} className="text-pdd-info" />
                          <span className="text-xs text-pdd-text">连带商品总数</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-info">{bundleAnalysis.totalBundleItems}件</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-pdd-text mb-3">连带率趋势</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={[
                        { name: '连带订单', value: bundleAnalysis.bundleOrders },
                        { name: '单件订单', value: bundleAnalysis.singleOrders }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: number) => [`${value}单`, '']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill="var(--pdd-purple)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab === 'customer' && (
                <div className="grid grid-cols-2 gap-4">
                  {/* 新老客饼图 */}
                  <div>
                    <div className="text-xs font-medium text-pdd-text mb-3">新老客占比</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={customerTypeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                          labelLine={false}
                        >
                          <Cell fill="var(--pdd-primary)" />
                          <Cell fill="var(--pdd-success)" />
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value}人`, name]}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[var(--pdd-primary)]" />
                        <span className="text-xs text-pdd-text">新客 {repurchaseStats.singleBuyers}人</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[var(--pdd-success)]" />
                        <span className="text-xs text-pdd-text">老客 {repurchaseStats.repeatBuyers}人</span>
                      </div>
                    </div>
                  </div>

                  {/* 客户统计 */}
                  <div>
                    <div className="text-xs font-medium text-pdd-text mb-3">客户统计</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-pdd-info/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-pdd-info" />
                          <span className="text-xs text-pdd-text">总客户数</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-info">{repurchaseStats.totalBuyers}人</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pdd-success/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Repeat size={14} className="text-pdd-success" />
                          <span className="text-xs text-pdd-text">复购客户</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-success">{repurchaseStats.repeatBuyers}人</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pdd-bg rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-pdd-text-secondary" />
                          <span className="text-xs text-pdd-text">新客</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-text">{repurchaseStats.singleBuyers}人</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-pdd-primary/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Star size={14} className="text-pdd-primary" />
                          <span className="text-xs text-pdd-text">客户忠诚度</span>
                        </div>
                        <span className="text-sm font-bold text-pdd-primary-dark">
                          {repurchaseStats.repurchaseRate > 30 ? '高' : repurchaseStats.repurchaseRate > 10 ? '中' : '低'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
