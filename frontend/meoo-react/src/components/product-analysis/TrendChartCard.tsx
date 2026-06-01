import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar } from 'recharts';
import { TrendingUp, Calendar, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface DailySalesPoint {
  date: string;
  sales: number;
  gmv: number;
  orders: number;
}

interface ProductStat {
  productId: string;
  productName: string;
  dailySales: DailySalesPoint[];
  sales: number;
  gmv: number;
  orders: number;
  avgOrderValue: number;
}

interface TrendChartCardProps {
  productStat: ProductStat;
  orders: any[];
}

type TimeDimension = '7' | '30' | '90';
type TrendType = 'sales' | 'price' | 'inventory';

export default function TrendChartCard({ productStat, orders }: TrendChartCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [timeDimension, setTimeDimension] = useState<TimeDimension>('30');
  const [trendType, setTrendType] = useState<TrendType>('sales');

  // 根据时间维度过滤数据
  const filteredData = useMemo(() => {
    if (!productStat.dailySales || productStat.dailySales.length === 0) return [];
    
    const days = parseInt(timeDimension);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return productStat.dailySales
      .filter(item => new Date(item.date) >= cutoffDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [productStat.dailySales, timeDimension]);

  // 计算价格变动趋势（从订单数据中提取）
  const priceTrendData = useMemo(() => {
    const priceMap: Record<string, number[]> = {};
    orders.forEach(order => {
      const date = String(order['支付时间'] || '').split(' ')[0];
      const price = parseFloat(order['用户实付金额(元)'] || order['商品总价(元)'] || 0);
      if (date && price > 0) {
        if (!priceMap[date]) priceMap[date] = [];
        priceMap[date].push(price);
      }
    });
    
    return Object.entries(priceMap)
      .map(([date, prices]) => ({
        date,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  // 库存周转趋势（模拟数据，基于销量计算）
  const inventoryTrendData = useMemo(() => {
    if (!filteredData.length) return [];
    
    let inventory = productStat.sales * 1.5; // 假设初始库存为销量的1.5倍
    return filteredData.map((item, index) => {
      inventory = Math.max(0, inventory - item.sales);
      const turnoverDays = item.sales > 0 ? Math.round(inventory / (item.sales || 1)) : 0;
      return {
        date: item.date,
        inventory: Math.round(inventory),
        turnoverDays: Math.min(turnoverDays, 99),
        sales: item.sales
      };
    });
  }, [filteredData, productStat.sales]);

  // 趋势数据选择
  const chartData = useMemo(() => {
    switch (trendType) {
      case 'price':
        return priceTrendData;
      case 'inventory':
        return inventoryTrendData;
      case 'sales':
      default:
        return filteredData;
    }
  }, [trendType, priceTrendData, inventoryTrendData, filteredData]);

  // 统计指标
  const stats = useMemo(() => {
    if (!filteredData.length) return null;
    const sales = filteredData.reduce((sum, item) => sum + item.sales, 0);
    const gmv = filteredData.reduce((sum, item) => sum + item.gmv, 0);
    const orders = filteredData.reduce((sum, item) => sum + item.orders, 0);
    const avgDailySales = filteredData.length > 0 ? sales / filteredData.length : 0;
    
    // 计算环比
    const mid = Math.floor(filteredData.length / 2);
    const firstHalf = filteredData.slice(0, mid).reduce((sum, item) => sum + item.sales, 0);
    const secondHalf = filteredData.slice(mid).reduce((sum, item) => sum + item.sales, 0);
    const mom = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    
    return { sales, gmv, orders, avgDailySales, mom };
  }, [filteredData]);

  const hasData = chartData.length > 0;

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
          <div className="w-8 h-8 rounded-lg bg-pdd-info/10 flex items-center justify-center">
            <TrendingUp size={16} className="text-pdd-info" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-pdd-text">时间趋势</h3>
            <p className="text-xs text-pdd-text-secondary">销售、价格、库存趋势分析</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              stats.mom >= 0 ? 'bg-pdd-success/10 text-pdd-success' : 'bg-pdd-danger/10 text-pdd-danger'
            }`}>
              环比 {stats.mom >= 0 ? '+' : ''}{stats.mom.toFixed(1)}%
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
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-pdd-border bg-pdd-bg/30">
              {/* 时间维度切换 */}
              <div className="flex items-center gap-1">
                <Calendar size={14} className="text-pdd-text-secondary mr-1" />
                {[
                  { key: '7', label: '近7天' },
                  { key: '30', label: '近30天' },
                  { key: '90', label: '近90天' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setTimeDimension(item.key as TimeDimension)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      timeDimension === item.key
                        ? 'bg-pdd-info/100 text-white'
                        : 'bg-pdd-card text-pdd-text hover:bg-pdd-bg border border-pdd-border'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 趋势类型切换 */}
              <div className="flex items-center gap-1">
                <BarChart3 size={14} className="text-pdd-text-secondary mr-1" />
                {[
                  { key: 'sales', label: '销量' },
                  { key: 'price', label: '价格' },
                  { key: 'inventory', label: '库存' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setTrendType(item.key as TrendType)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      trendType === item.key
                        ? 'bg-pdd-info/100 text-white'
                        : 'bg-pdd-card text-pdd-text hover:bg-pdd-bg border border-pdd-border'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 核心指标 */}
            {stats && (
              <div className="grid grid-cols-4 gap-3 p-4 border-b border-pdd-border">
                <div className="bg-pdd-info/10/50 rounded-lg p-3">
                  <div className="text-xs text-pdd-text-secondary mb-1">总销量</div>
                  <div className="text-lg font-bold text-pdd-info">{stats.sales.toFixed(0)}</div>
                  <div className="text-xs text-pdd-text-secondary mt-0.5">{timeDimension}天累计</div>
                </div>
                <div className="bg-pdd-success/10/50 rounded-lg p-3">
                  <div className="text-xs text-pdd-text-secondary mb-1">总GMV</div>
                  <div className="text-lg font-bold text-pdd-success">¥{stats.gmv.toFixed(0)}</div>
                  <div className="text-xs text-pdd-text-secondary mt-0.5">{timeDimension}天累计</div>
                </div>
                <div className="bg-pdd-primary/10/50 rounded-lg p-3">
                  <div className="text-xs text-pdd-text-secondary mb-1">日均销量</div>
                  <div className="text-lg font-bold text-pdd-primary-dark">{stats.avgDailySales.toFixed(1)}</div>
                  <div className="text-xs text-pdd-text-secondary mt-0.5">件/天</div>
                </div>
                <div className="bg-pdd-warning/10/50 rounded-lg p-3">
                  <div className="text-xs text-pdd-text-secondary mb-1">总订单</div>
                  <div className="text-lg font-bold text-orange-600">{stats.orders.toFixed(0)}</div>
                  <div className="text-xs text-pdd-text-secondary mt-0.5">{timeDimension}天累计</div>
                </div>
              </div>
            )}

            {/* 图表区 */}
            <div className="p-4">
              <div className="text-xs font-medium text-pdd-text mb-3">
                {trendType === 'sales' && '销量趋势'}
                {trendType === 'price' && '价格变动趋势'}
                {trendType === 'inventory' && '库存周转趋势'}
              </div>
              
              {hasData ? (
                <ResponsiveContainer width="100%" height={240}>
                  {trendType === 'sales' ? (
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--pdd-primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--pdd-primary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--pdd-success)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--pdd-success)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }} 
                        tickFormatter={(value) => value.slice(5)} // 显示 MM-DD
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        labelStyle={{ fontSize: '12px', color: '#666' }}
                      />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="sales"
                        stroke="var(--pdd-primary)"
                        fillOpacity={1}
                        fill="url(#colorSales)"
                        strokeWidth={2}
                        name="销量"
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="gmv"
                        stroke="var(--pdd-success)"
                        fillOpacity={1}
                        fill="url(#colorGmv)"
                        strokeWidth={2}
                        name="GMV"
                      />
                    </AreaChart>
                  ) : trendType === 'price' ? (
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: number) => [`¥${value.toFixed(2)}`, '']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="avgPrice" fill="var(--pdd-warning)" name="平均价格" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="maxPrice" stroke="var(--pdd-primary-light)" strokeWidth={2} name="最高价" dot={false} />
                      <Line type="monotone" dataKey="minPrice" stroke="var(--pdd-success)" strokeWidth={2} name="最低价" dot={false} />
                    </ComposedChart>
                  ) : (
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.slice(5)}
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar yAxisId="left" dataKey="inventory" fill="var(--pdd-primary)" name="库存量" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="turnoverDays" stroke="var(--pdd-warning)" strokeWidth={2} name="周转天数" />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex flex-col items-center justify-center text-pdd-text-secondary">
                  <TrendingUp size={32} className="opacity-30 mb-2" />
                  <span className="text-xs">暂无趋势数据</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
