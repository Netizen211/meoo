import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp, ShieldAlert, FileText } from 'lucide-react';

interface AfterSaleItem {
  status: string;
  reason?: string;
  count: number;
  amount: number;
  date?: string;
}

interface ProductStat {
  productId: string;
  productName: string;
  afterSaleCount: number;
  afterSaleRate: number;
  refund: number;
  refundRate: number;
  afterSaleBreakdown: Record<string, number>;
  orders: number;
  revenue: number;
}

interface AfterSaleCardProps {
  productStat: ProductStat;
  orders: any[];
}

import { chartColorArray } from '../../utils/colorMap';

const COLORS = chartColorArray;

export default function AfterSaleCard({ productStat, orders }: AfterSaleCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reason' | 'detail'>('overview');

  // 售后状态分布数据
  const statusData = useMemo(() => {
    if (!productStat.afterSaleBreakdown) return [];
    return Object.entries(productStat.afterSaleBreakdown).map(([name, value]) => ({
      name,
      value,
      percentage: productStat.afterSaleCount > 0 ? (value / productStat.afterSaleCount) * 100 : 0
    }));
  }, [productStat.afterSaleBreakdown, productStat.afterSaleCount]);

  // 售后原因分析数据（从订单数据中提取）
  const reasonData = useMemo(() => {
    const reasonMap: Record<string, number> = {};
    orders.forEach(order => {
      const status = order['售后状态'] || order['售后状态'] || '';
      if (status && status !== '无售后或售后取消' && status !== '无') {
        const reason = order['售后原因'] || order['退款原因'] || '其他原因';
        reasonMap[reason] = (reasonMap[reason] || 0) + 1;
      }
    });
    return Object.entries(reasonMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [orders]);

  // 售后明细数据
  const detailData = useMemo(() => {
    return orders
      .filter(order => {
        const status = order['售后状态'] || '';
        return status && status !== '无售后或售后取消' && status !== '无';
      })
      .map(order => ({
        orderNo: order['订单号'] || '-',
        status: order['售后状态'] || '-',
        reason: order['售后原因'] || order['退款原因'] || '-',
        amount: parseFloat(order['退款金额'] || order['退款金额(元)'] || 0),
        date: order['申请时间'] || order['支付时间'] || '-'
      }))
      .slice(0, 10);
  }, [orders]);

  const hasAfterSaleData = productStat.afterSaleCount > 0;

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
          <div className="w-8 h-8 rounded-lg bg-pdd-danger/10 flex items-center justify-center">
            <ShieldAlert size={16} className="text-pdd-danger" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-pdd-text">售后数据</h3>
            <p className="text-xs text-pdd-text-secondary">售后率、退款率、状态分布</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAfterSaleData && (
            <span className="px-2 py-0.5 bg-pdd-danger/10 text-pdd-danger text-xs font-medium rounded-full">
              {productStat.afterSaleCount}笔售后
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
              <div className="bg-pdd-danger/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">售后率</div>
                <div className="text-lg font-bold text-pdd-danger">{productStat.afterSaleRate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">{productStat.afterSaleCount}笔 / {productStat.orders}单</div>
              </div>
              <div className="bg-pdd-warning/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">退款率</div>
                <div className="text-lg font-bold text-orange-600">{productStat.refundRate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">¥{productStat.refund.toFixed(0)}</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">售后金额占比</div>
                <div className="text-lg font-bold text-pdd-text">
                  {productStat.revenue > 0 ? ((productStat.refund / productStat.revenue) * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">占实收比例</div>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">平均退款金额</div>
                <div className="text-lg font-bold text-pdd-text">
                  {productStat.afterSaleCount > 0 ? `¥${(productStat.refund / productStat.afterSaleCount).toFixed(0)}` : '-'}
                </div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">每笔售后</div>
              </div>
            </div>

            {/* Tab切换 */}
            <div className="flex items-center gap-1 px-4 pt-3 border-b border-pdd-border">
              {[
                { key: 'overview', label: '状态分布', icon: AlertTriangle },
                { key: 'reason', label: '原因分析', icon: RotateCcw },
                { key: 'detail', label: '售后明细', icon: FileText }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? 'text-pdd-danger bg-pdd-danger/10 border-b-2 border-red-500'
                      : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg'
                  }`}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 图表内容 */}
            <div className="p-4">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 gap-4">
                  {/* 售后状态饼图 */}
                  <div>
                    <div className="text-xs font-medium text-pdd-text mb-2">售后状态分布</div>
                    {statusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                            labelLine={false}
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${value}笔`, name]}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[180px] flex items-center justify-center text-pdd-text-secondary text-xs">
                        暂无售后数据
                      </div>
                    )}
                  </div>

                  {/* 状态统计列表 */}
                  <div>
                    <div className="text-xs font-medium text-pdd-text mb-2">状态统计</div>
                    <div className="space-y-2">
                      {statusData.length > 0 ? (
                        statusData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between p-2 bg-pdd-bg rounded-lg">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-xs text-pdd-text">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-medium text-pdd-text">{item.value}笔</span>
                              <span className="text-xs text-pdd-text-secondary">{item.percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-pdd-text-secondary text-xs py-8">暂无数据</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reason' && (
                <div>
                  <div className="text-xs font-medium text-pdd-text mb-3">售后原因TOP排行</div>
                  {reasonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={reasonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: number) => [`${value}笔`, '数量']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill="var(--pdd-primary-light)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-pdd-text-secondary text-xs">
                      暂无售后原因数据
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'detail' && (
                <div>
                  <div className="text-xs font-medium text-pdd-text mb-3">最近售后记录</div>
                  {detailData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-pdd-text-secondary border-b border-pdd-border">
                            <th className="py-2 px-2 text-left">订单号</th>
                            <th className="py-2 px-2 text-left">状态</th>
                            <th className="py-2 px-2 text-left">原因</th>
                            <th className="py-2 px-2 text-right">金额</th>
                            <th className="py-2 px-2 text-left">日期</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pdd-gray-100">
                          {detailData.map((item, index) => (
                            <tr key={index} className="hover:bg-pdd-bg">
                              <td className="py-2 px-2 font-mono text-pdd-text">{item.orderNo.slice(-8)}</td>
                              <td className="py-2 px-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  item.status.includes('退款') ? 'bg-pdd-danger/10 text-red-700' :
                                  item.status.includes('退货') ? 'bg-pdd-warning/10 text-orange-700' :
                                  'bg-pdd-bg text-pdd-text'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-pdd-text">{item.reason}</td>
                              <td className="py-2 px-2 text-right font-mono text-pdd-danger">¥{item.amount.toFixed(2)}</td>
                              <td className="py-2 px-2 text-pdd-text-secondary">{item.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-[150px] flex items-center justify-center text-pdd-text-secondary text-xs">
                      暂无售后明细数据
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
