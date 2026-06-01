import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MapPin, ChevronDown, ChevronUp, Truck, Globe, TrendingUp } from 'lucide-react';

interface RegionData {
  province: string;
  sales: number;
  orders: number;
  gmv: number;
  percentage: number;
}

interface ProductStat {
  productId: string;
  productName: string;
  sales: number;
  orders: number;
  gmv: number;
}

interface RegionDistributionCardProps {
  productStat: ProductStat;
  orders: any[];
}

// 偏远地区列表
const REMOTE_REGIONS = ['西藏', '新疆', '青海', '内蒙古', '甘肃', '宁夏', '海南'];

export default function RegionDistributionCard({ productStat, orders }: RegionDistributionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewType, setViewType] = useState<'sales' | 'orders' | 'gmv'>('sales');

  // 地域分布数据
  const regionData = useMemo(() => {
    const regionMap: Record<string, { sales: number; orders: number; gmv: number }> = {};
    
    orders.forEach(order => {
      const province = order['省份'] || order['省'] || order['收货地址']?.split('省')[0] || '未知';
      const cleanProvince = province.replace(/[省市自治区回族维吾尔壮族特别行政区]+/g, '');
      
      if (!regionMap[cleanProvince]) {
        regionMap[cleanProvince] = { sales: 0, orders: 0, gmv: 0 };
      }
      
      regionMap[cleanProvince].sales += parseFloat(order['商品数量(件)'] || order['商品数量'] || 1);
      regionMap[cleanProvince].orders += 1;
      regionMap[cleanProvince].gmv += parseFloat(order['用户实付金额(元)'] || order['商品总价(元)'] || 0);
    });

    const totalSales = Object.values(regionMap).reduce((sum, r) => sum + r.sales, 0);
    
    return Object.entries(regionMap)
      .map(([province, data]) => ({
        province,
        sales: data.sales,
        orders: data.orders,
        gmv: data.gmv,
        percentage: totalSales > 0 ? (data.sales / totalSales) * 100 : 0
      }))
      .sort((a, b) => b[viewType] - a[viewType]);
  }, [orders, viewType]);

  // TOP10省份
  const top10Regions = useMemo(() => regionData.slice(0, 10), [regionData]);

  // 偏远地区统计
  const remoteRegionStats = useMemo(() => {
    const remote = regionData.filter(r => REMOTE_REGIONS.some(rr => r.province.includes(rr)));
    const normal = regionData.filter(r => !REMOTE_REGIONS.some(rr => r.province.includes(rr)));
    
    const remoteSales = remote.reduce((sum, r) => sum + r.sales, 0);
    const totalSales = regionData.reduce((sum, r) => sum + r.sales, 0);
    const remoteRate = totalSales > 0 ? (remoteSales / totalSales) * 100 : 0;
    
    return {
      remoteCount: remote.length,
      normalCount: normal.length,
      remoteSales,
      remoteOrders: remote.reduce((sum, r) => sum + r.orders, 0),
      remoteGmv: remote.reduce((sum, r) => sum + r.gmv, 0),
      remoteRate
    };
  }, [regionData]);

  // 地域集中度
  const concentrationStats = useMemo(() => {
    if (regionData.length === 0) return { top3Rate: 0, top5Rate: 0 };
    const totalSales = regionData.reduce((sum, r) => sum + r.sales, 0);
    const top3Sales = regionData.slice(0, 3).reduce((sum, r) => sum + r.sales, 0);
    const top5Sales = regionData.slice(0, 5).reduce((sum, r) => sum + r.sales, 0);
    
    return {
      top3Rate: totalSales > 0 ? (top3Sales / totalSales) * 100 : 0,
      top5Rate: totalSales > 0 ? (top5Sales / totalSales) * 100 : 0
    };
  }, [regionData]);

  const hasData = regionData.length > 0;

  // 根据数值返回颜色
  const getBarColor = (value: number, maxValue: number) => {
    const ratio = value / maxValue;
    if (ratio > 0.7) return 'var(--pdd-danger)';
    if (ratio > 0.4) return 'var(--pdd-warning)';
    return 'var(--pdd-success)';
  };

  const maxValue = top10Regions.length > 0 ? top10Regions[0][viewType] : 0;

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
          <div className="w-8 h-8 rounded-lg bg-pdd-success/10 flex items-center justify-center">
            <MapPin size={16} className="text-pdd-success" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-pdd-text">地域分布</h3>
            <p className="text-xs text-pdd-text-secondary">销售地域、省份排名、偏远地区率</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span className="px-2 py-0.5 bg-pdd-success/10 text-pdd-success text-xs font-medium rounded-full">
              {regionData.length}个省份
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
              <div className="bg-pdd-success/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">覆盖省份</div>
                <div className="text-lg font-bold text-pdd-success">{regionData.length}</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">个省级行政区</div>
              </div>
              <div className="bg-pdd-warning/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">偏远地区率</div>
                <div className="text-lg font-bold text-orange-600">{remoteRegionStats.remoteRate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">{remoteRegionStats.remoteCount}个偏远省份</div>
              </div>
              <div className="bg-pdd-info/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">TOP3集中度</div>
                <div className="text-lg font-bold text-pdd-info">{concentrationStats.top3Rate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">销量占比</div>
              </div>
              <div className="bg-pdd-primary/10/50 rounded-lg p-3">
                <div className="text-xs text-pdd-text-secondary mb-1">TOP5集中度</div>
                <div className="text-lg font-bold text-pdd-primary-dark">{concentrationStats.top5Rate.toFixed(1)}%</div>
                <div className="text-xs text-pdd-text-secondary mt-0.5">销量占比</div>
              </div>
            </div>

            {/* 视图切换 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-pdd-border bg-pdd-bg/30">
              <div className="flex items-center gap-1">
                <Globe size={14} className="text-pdd-text-secondary mr-1" />
                <span className="text-xs text-pdd-text mr-2">排序指标:</span>
                {[
                  { key: 'sales', label: '销量' },
                  { key: 'orders', label: '订单' },
                  { key: 'gmv', label: 'GMV' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setViewType(item.key as any)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      viewType === item.key
                        ? 'bg-pdd-success/100 text-white'
                        : 'bg-pdd-card text-pdd-text hover:bg-pdd-bg border border-pdd-border'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 省份排名图表 */}
            <div className="p-4">
              <div className="text-xs font-medium text-pdd-text mb-3">省份排名 TOP10</div>
              {hasData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={top10Regions} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis 
                      dataKey="province" 
                      type="category" 
                      width={50} 
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => {
                        const data = props.payload;
                        return [
                          <div className="space-y-1">
                            <div>销量: {data.sales}件</div>
                            <div>订单: {data.orders}单</div>
                            <div>GMV: ¥{data.gmv.toFixed(0)}</div>
                            <div>占比: {data.percentage.toFixed(1)}%</div>
                          </div>,
                          data.province
                        ];
                      }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey={viewType} radius={[0, 4, 4, 0]}>
                      {top10Regions.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getBarColor(entry[viewType], maxValue)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex flex-col items-center justify-center text-pdd-text-secondary">
                  <MapPin size={32} className="opacity-30 mb-2" />
                  <span className="text-xs">暂无地域数据</span>
                </div>
              )}
            </div>

            {/* 地域统计表格 */}
            {hasData && (
              <div className="px-4 pb-4">
                <div className="text-xs font-medium text-pdd-text mb-3">地域销售明细</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-pdd-text-secondary border-b border-pdd-border bg-pdd-bg">
                        <th className="py-2 px-2 text-left">排名</th>
                        <th className="py-2 px-2 text-left">省份</th>
                        <th className="py-2 px-2 text-right">销量</th>
                        <th className="py-2 px-2 text-right">订单</th>
                        <th className="py-2 px-2 text-right">GMV</th>
                        <th className="py-2 px-2 text-right">占比</th>
                        <th className="py-2 px-2 text-center">类型</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pdd-gray-100">
                      {top10Regions.map((region, index) => {
                        const isRemote = REMOTE_REGIONS.some(r => region.province.includes(r));
                        return (
                          <tr key={region.province} className="hover:bg-pdd-bg">
                            <td className="py-2 px-2">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                                index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-pdd-bg text-pdd-text'
                              }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-medium text-pdd-text">{region.province}</td>
                            <td className="py-2 px-2 text-right font-mono">{region.sales}</td>
                            <td className="py-2 px-2 text-right font-mono">{region.orders}</td>
                            <td className="py-2 px-2 text-right font-mono text-pdd-success">¥{region.gmv.toFixed(0)}</td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-pdd-text">{region.percentage.toFixed(1)}%</span>
                                <div className="w-16 h-1.5 bg-pdd-bg rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-pdd-success/100 rounded-full"
                                    style={{ width: `${Math.min(100, region.percentage * 2)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {isRemote ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pdd-warning/10 text-orange-700 rounded text-xs">
                                  <Truck size={10} />
                                  偏远
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-pdd-success/10 text-green-700 rounded text-xs">普通</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 偏远地区统计 */}
            {remoteRegionStats.remoteCount > 0 && (
              <div className="px-4 pb-4">
                <div className="bg-pdd-warning/10 rounded-lg p-3 border border-orange-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck size={14} className="text-pdd-warning" />
                    <span className="text-xs font-medium text-orange-800">偏远地区统计</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-orange-600/70">偏远省份</div>
                      <div className="text-sm font-bold text-orange-700">{remoteRegionStats.remoteCount}个</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-orange-600/70">偏远销量</div>
                      <div className="text-sm font-bold text-orange-700">{remoteRegionStats.remoteSales}件</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-orange-600/70">偏远GMV</div>
                      <div className="text-sm font-bold text-orange-700">¥{remoteRegionStats.remoteGmv.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
