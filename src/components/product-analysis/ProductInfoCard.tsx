import React from 'react';
import { motion } from 'framer-motion';
import { Package, Tag, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductAnalysisProps } from './types';

export default function ProductInfoCard({ productStat, isExpanded = true, onToggle }: ProductAnalysisProps) {
  const { productId, productName, productCode, gmv, orders } = productStat;
  
  // 计算价格带
  const avgPrice = orders > 0 ? gmv / orders : 0;
  const priceBand = avgPrice < 50 ? '0-50元' : avgPrice < 100 ? '50-100元' : avgPrice < 200 ? '100-200元' : '200元以上';
  
  return (
    <motion.div 
      className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* 头部 */}
      <div 
        className="px-4 py-3 border-b border-pdd-border flex items-center justify-between cursor-pointer hover:bg-pdd-bg transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pdd-primary/10 flex items-center justify-center">
            <Package size={16} className="text-pdd-primary" />
          </div>
          <h3 className="text-sm font-semibold text-pdd-text">商品基础信息</h3>
        </div>
        <div className="text-pdd-text-secondary">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      
      {/* 内容 */}
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 商品ID */}
            <div className="space-y-1">
              <div className="text-xs text-pdd-text-secondary flex items-center gap-1">
                <Tag size={12} />
                商品ID
              </div>
              <div className="text-sm font-mono text-pdd-text truncate" title={productId}>
                {productId || '-'}
              </div>
            </div>
            
            {/* 商品名称 */}
            <div className="space-y-1 col-span-2">
              <div className="text-xs text-pdd-text-secondary">商品名称</div>
              <div className="text-sm font-medium text-pdd-text truncate" title={productName}>
                {productName || '未命名商品'}
              </div>
            </div>
            
            {/* 商家编码 */}
            <div className="space-y-1">
              <div className="text-xs text-pdd-text-secondary flex items-center gap-1">
                <Layers size={12} />
                商家编码
              </div>
              <div className="text-sm font-mono text-pdd-text truncate" title={productCode}>
                {productCode || '-'}
              </div>
            </div>
            
            {/* 价格带 */}
            <div className="space-y-1">
              <div className="text-xs text-pdd-text-secondary">价格带</div>
              <div className="text-sm font-medium text-pdd-text">
                {priceBand}
              </div>
              <div className="text-xs text-pdd-text-secondary">
                均价 ¥{avgPrice.toFixed(2)}
              </div>
            </div>
            
            {/* 类目层级 - 模拟数据 */}
            <div className="space-y-1 col-span-2">
              <div className="text-xs text-pdd-text-secondary">类目层级</div>
              <div className="flex items-center gap-1 text-xs">
                <span className="px-2 py-0.5 bg-pdd-bg rounded text-pdd-text">3C数码</span>
                <span className="text-pdd-text-secondary">/</span>
                <span className="px-2 py-0.5 bg-pdd-bg rounded text-pdd-text">手机配件</span>
                <span className="text-pdd-text-secondary">/</span>
                <span className="px-2 py-0.5 bg-pdd-primary/10 rounded text-pdd-primary-dark">手机电池</span>
              </div>
            </div>
            
            {/* 数据质量评分 */}
            <div className="space-y-1">
              <div className="text-xs text-pdd-text-secondary">数据质量</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-pdd-bg rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      productStat.hasOrderData && productStat.hasPromoData 
                        ? 'bg-pdd-success/100' 
                        : productStat.hasOrderData 
                          ? 'bg-pdd-warning/100' 
                          : 'bg-pdd-danger/100'
                    }`}
                    style={{ width: `${productStat.hasOrderData ? 80 : 40}%` }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {productStat.hasOrderData && productStat.hasPromoData ? '优' : productStat.hasOrderData ? '良' : '差'}
                </span>
              </div>
            </div>
            
            {/* 数据更新时间 */}
            <div className="space-y-1">
              <div className="text-xs text-pdd-text-secondary">数据更新</div>
              <div className="text-xs text-pdd-text">
                {productStat.lastOrderDate || '暂无数据'}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
