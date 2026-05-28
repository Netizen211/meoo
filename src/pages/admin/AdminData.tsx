import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, Store, HardDrive, TrendingUp } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

interface StoreData {
  storeId: string;
  storeName: string;
  userName: string;
  orders: number;
  promotionSummary: number;
  promotionProducts: number;
  starStoreSummary: number;
  liveStreamSummary: number;
  shippingInsurance: number;
  afterSaleRecords: number;
  financialRecords: number;
  totalRows: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  orders: '#3b82f6',
  promotionSummary: '#f59e0b',
  promotionProducts: '#8b5cf6',
  afterSaleRecords: '#ef4444',
  shippingInsurance: '#06b6d4',
  starStoreSummary: '#22c55e',
  liveStreamSummary: '#ec4899',
  financialRecords: '#14b8a6',
};

export default function AdminData() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDataStats().then(res => {
      if (res.success && res.data) setStores(res.data);
      setLoading(false);
    });
  }, []);

  const totalStats = useMemo(() => ({
    totalStores: stores.length,
    totalRows: stores.reduce((s, v) => s + v.totalRows, 0),
    totalOrders: stores.reduce((s, v) => s + v.orders, 0),
    totalAfterSales: stores.reduce((s, v) => s + v.afterSaleRecords, 0),
  }), [stores]);

  // 柱状图数据：每个店铺的 orders + afterSaleRecords
  const chartData = useMemo(() =>
    stores.map(s => ({ name: s.storeName.length > 8 ? s.storeName.slice(0, 8) + '...' : s.storeName, 订单: s.orders, 售后: s.afterSaleRecords, 推广: s.promotionSummary }))
  , [stores]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-pdd-text-secondary">加载中...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-pdd-text-primary">数据监控</h2>
        <p className="text-xs text-pdd-text-secondary mt-0.5">各店铺数据存储详情</p>
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '店铺总数', value: totalStats.totalStores, icon: Store, color: '#8b5cf6' },
          { label: '总记录行数', value: totalStats.totalRows.toLocaleString(), icon: Database, color: '#3b82f6' },
          { label: '订单记录', value: totalStats.totalOrders.toLocaleString(), icon: TrendingUp, color: '#22c55e' },
          { label: '售后记录', value: totalStats.totalAfterSales.toLocaleString(), icon: HardDrive, color: '#ef4444' },
        ].map(c => (
          <div key={c.label} className="bg-pdd-card rounded-xl border border-pdd-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-pdd-text-secondary">{c.label}</span>
              <c.icon size={18} style={{ color: c.color }} />
            </div>
            <div className="text-xl font-bold text-pdd-text-primary tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* 柱状图 */}
      {stores.length > 0 && (
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">店铺数据分布</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barSize={24} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} />
              <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3144', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="订单" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="售后" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="推广" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 店铺详情表 */}
      {stores.length > 0 ? (
        <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border bg-pdd-bg">
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">店铺</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">用户</th>
                  {['orders', 'promotionSummary', 'afterSaleRecords', 'shippingInsurance'].map(cat => (
                    <th key={cat} className="text-right py-3 px-3 font-medium text-pdd-text-secondary">
                      <span className="flex items-center justify-end gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                        {cat === 'orders' ? '订单' : cat === 'promotionSummary' ? '推广' : cat === 'afterSaleRecords' ? '售后' : '运费险'}
                      </span>
                    </th>
                  ))}
                  <th className="text-right py-3 px-4 font-medium text-pdd-text-secondary">总计</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s, i) => (
                  <motion.tr key={s.storeId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-pdd-border/30 hover:bg-pdd-bg/50">
                    <td className="py-3 px-4 text-pdd-text-primary font-medium">{s.storeName}</td>
                    <td className="py-3 px-4 text-pdd-text-secondary">{s.userName}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary">{s.orders.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary">{s.promotionSummary.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary">{s.afterSaleRecords.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary">{s.shippingInsurance.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-pdd-text-primary">{s.totalRows.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
          <Database size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无店铺数据</p>
        </div>
      )}
    </div>
  );
}
