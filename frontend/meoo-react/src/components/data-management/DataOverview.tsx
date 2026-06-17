import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Database, AlertTriangle, DollarSign, Wrench, Package, Info } from 'lucide-react';
import { sf, ss, findField } from '../../utils';

interface Props {
  orders: any[];
  financialRecords: any[];
  afterSaleRecords: any[];
  promotionProducts: any[];
}

export default function DataOverview({ orders, financialRecords, afterSaleRecords, promotionProducts }: Props) {
  const noData = !orders.length && !financialRecords.length && !afterSaleRecords.length;

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalFinancial = financialRecords.length;
    const totalAfterSale = afterSaleRecords.length;
    const totalPromotion = promotionProducts.length;
    const productIds = new Set(orders.map((o: any) => ss(findField(o, '商品id'))).filter(Boolean));
    const dates = orders.map((o: any) => ss(findField(o, '支付时间')).split(' ')[0]).filter(Boolean).sort();
    return {
      totalOrders, totalFinancial, totalAfterSale, totalPromotion,
      productCount: productIds.size,
      dateStart: dates[0] || null,
      dateEnd: dates[dates.length - 1] || null,
    };
  }, [orders, financialRecords, afterSaleRecords, promotionProducts]);

  const kpis = [
    { label: '总订单数', value: stats.totalOrders, sub: stats.productCount + '个商品', icon: Package, color: 'var(--pdd-primary)' },
    { label: '财务记录数', value: stats.totalFinancial, icon: DollarSign, color: 'var(--pdd-success)' },
    { label: '售后记录数', value: stats.totalAfterSale, icon: Wrench, color: 'var(--pdd-warning)' },
    { label: '推广记录数', value: stats.totalPromotion, icon: Database, color: 'var(--pdd-purple)' },
  ];

  const dataTypes = [
    { key: 'orders', label: '订单', emoji: '📋', count: stats.totalOrders, dateRange: stats.dateStart && stats.dateEnd ? stats.dateStart + ' ~ ' + stats.dateEnd : null },
    { key: 'financial', label: '财务', emoji: '💰', count: stats.totalFinancial, dateRange: null },
    { key: 'afterSale', label: '售后', emoji: '🔧', count: stats.totalAfterSale, dateRange: null },
    { key: 'promotion', label: '推广', emoji: '📢', count: stats.totalPromotion, dateRange: null },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="pdd-card px-3 py-3 flex items-center gap-2">
            <k.icon size={18} color={k.color} />
            <div>
              <span className="text-xs text-pdd-text-secondary">{k.label}</span>
              <span className="text-lg font-bold block">{noData ? '--' : k.value}</span>
              {k.sub && <span className="text-[10px] text-pdd-text-secondary">{k.sub}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="pdd-card p-3">
        <h3 className="text-xs font-semibold mb-2 flex items-center gap-1"><Database size={14} />各数据类型状态</h3>
        {noData ? (
          <div className="text-xs text-pdd-text-secondary text-center py-6">暂无数据，请先在“上传”Tab中导入数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                <th className="py-2 text-left">数据类型</th>
                <th className="py-2 text-right">记录数</th>
                <th className="py-2 text-left">日期范围</th>
                <th className="py-2 text-center">状态</th>
              </tr></thead>
              <tbody>
                {dataTypes.map(dt => (
                  <tr key={dt.key} className="border-b border-pdd-border hover:bg-pdd-bg">
                    <td className="py-2 font-medium"><span>{dt.emoji}</span> {dt.label}</td>
                    <td className="py-2 text-right font-mono">{dt.count}</td>
                    <td className="py-2 text-pdd-text-secondary">{dt.dateRange || (dt.count > 0 ? '日期信息不足' : '--')}</td>
                    <td className="py-2 text-center">
                      {dt.count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">✅ 正常</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-pdd-gray-100 text-pdd-text-secondary text-[10px]">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pdd-card p-3 bg-gradient-to-r from-blue-50 to-white border border-blue-100">
        <p className="text-xs text-pdd-text-secondary flex items-center gap-1">
          <Info size={12} className="text-pdd-primary" />
          ### 上传数据后，可到“数据质量检查”查看数据完整性，或到“同步状态”检查各数据源延迟
        </p>
      </div>
    </div>
  );
}
