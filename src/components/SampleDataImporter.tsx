import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Upload, CheckCircle, AlertCircle, X, Loader2, BarChart3, MapPin, TrendingUp, Shield, FileText, DollarSign } from 'lucide-react';
import { importSampleData, hasSampleData } from '../utils/dataImporter';

interface ImportResult {
  file: string;
  type: string;
  rowCount: number;
}

const COVERED_MODULES = [
  { icon: BarChart3, label: '核心看板', desc: 'GMV / 实收 / 退款 / 售后率' },
  { icon: Database, label: '商品分析', desc: '8个商品 × 18个SKU，含成本利润' },
  { icon: TrendingUp, label: '推广分析', desc: 'ROI / CTR / CVR / 关键词' },
  { icon: Shield, label: '售后分析', desc: '退款原因 / 处理时效 / 物流追踪' },
  { icon: MapPin, label: '地域分析', desc: '20个省份，含偏远和物流时效' },
  { icon: FileText, label: '财务分析', desc: '货款明细 / 百亿补贴 / 扣款分类' },
  { icon: DollarSign, label: '成本管理', desc: '预填18个SKU成本，可直接看利润' },
];

export default function SampleDataImporter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [imported, setImported] = useState(hasSampleData());
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    try {
      const { results: importResults } = await importSampleData();
      setResults(importResults);
      setImported(true);
      setShowGuide(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const handleStartExplore = () => {
    window.location.reload();
  };

  if (imported && !showGuide) return null;

  return (
    <>
      {/* 浮动按钮 */}
      {!imported && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-pdd-primary to-pdd-primary-light text-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          <Database size={20} />
          <span className="font-medium">加载示例数据</span>
        </motion.button>
      )}

      {/* 弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => !isImporting && !showGuide && setIsOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-pdd-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* 头部 */}
                <div className="bg-gradient-to-r from-pdd-primary to-pdd-primary-light p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database size={28} />
                      <h2 className="text-xl font-bold">
                        {showGuide ? '演示数据已就绪' : '加载演示数据'}
                      </h2>
                    </div>
                    {!isImporting && !showGuide && (
                      <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                        <X size={24} />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-white/90 text-sm">
                    {showGuide
                      ? '数据已自动同步到云端，换个设备登录也能看到'
                      : '自动生成覆盖全部分析功能的演示数据，与真实上传走同一链路'}
                  </p>
                </div>

                {/* 导入中 */}
                {isImporting && (
                  <div className="p-12 flex flex-col items-center gap-4">
                    <Loader2 size={40} className="animate-spin text-pdd-primary" />
                    <span className="text-pdd-text">正在生成演示数据...</span>
                    <span className="text-xs text-pdd-text-secondary">订单 + 推广 + 售后 + 运费险 + 货款明细 + 成本配置</span>
                  </div>
                )}

                {/* 错误 */}
                {error && (
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-pdd-danger">
                      <AlertCircle size={24} />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* 导入前 - 数据预览 */}
                {!showGuide && !isImporting && !error && (
                  <div className="p-6">
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3 text-pdd-text">
                        <CheckCircle size={20} className="text-pdd-success" />
                        <span>订单数据（520 笔，64 个字段）</span>
                      </div>
                      <div className="flex items-center gap-3 text-pdd-text">
                        <CheckCircle size={20} className="text-pdd-success" />
                        <span>商品推广数据（464 条）</span>
                      </div>
                      <div className="flex items-center gap-3 text-pdd-text">
                        <CheckCircle size={20} className="text-pdd-success" />
                        <span>售后数据（118 条）</span>
                      </div>
                      <div className="flex items-center gap-3 text-pdd-text">
                        <CheckCircle size={20} className="text-pdd-success" />
                        <span>运费险数据（338 条）</span>
                      </div>
                      <div className="flex items-center gap-3 text-pdd-text">
                        <CheckCircle size={20} className="text-pdd-success" />
                        <span>货款明细（1,063 条）</span>
                      </div>
                      <div className="flex items-center gap-3 text-pdd-text">
                        <CheckCircle size={20} className="text-pdd-success" />
                        <span>SKU 成本配置（18 个 SKU 已填好）</span>
                      </div>
                    </div>

                    <button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-pdd-primary text-white rounded-xl font-medium hover:bg-pdd-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Upload size={20} />
                      <span>立即导入演示数据</span>
                    </button>
                  </div>
                )}

                {/* 导入成功 - 数据指南 */}
                {showGuide && (
                  <div className="p-6">
                    {/* 数据概要 */}
                    <div className="bg-pdd-bg rounded-lg p-3 mb-4">
                      <div className="grid grid-cols-5 gap-2 text-center">
                        {results.filter(r => r.type === '订单数据').map(r => (
                          <div key="orders"><div className="text-lg font-bold text-pdd-primary">{r.rowCount}</div><div className="text-[10px] text-pdd-text-secondary">订单</div></div>
                        ))}
                        {results.filter(r => r.type === '商品推广数据').map(r => (
                          <div key="promo"><div className="text-lg font-bold text-pdd-warning">{r.rowCount}</div><div className="text-[10px] text-pdd-text-secondary">推广</div></div>
                        ))}
                        {results.filter(r => r.type === '售后数据').map(r => (
                          <div key="as"><div className="text-lg font-bold text-pdd-danger">{r.rowCount}</div><div className="text-[10px] text-pdd-text-secondary">售后</div></div>
                        ))}
                        <div><div className="text-lg font-bold text-pdd-info">338</div><div className="text-[10px] text-pdd-text-secondary">运费险</div></div>
                        <div><div className="text-lg font-bold text-pdd-success">1063</div><div className="text-[10px] text-pdd-text-secondary">货款</div></div>
                      </div>
                    </div>

                    {/* 覆盖模块 */}
                    <h3 className="text-sm font-semibold text-pdd-text mb-3">覆盖分析模块</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {COVERED_MODULES.map(m => (
                        <div key={m.label} className="flex items-center gap-2 p-2 bg-pdd-bg rounded-lg">
                          <m.icon size={14} className="text-pdd-primary flex-shrink-0" />
                          <div>
                            <div className="text-xs font-medium text-pdd-text">{m.label}</div>
                            <div className="text-[10px] text-pdd-text-secondary">{m.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 提示 */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-amber-800">
                        <strong>提示：</strong>如需清除演示数据换上自己的数据，请到
                        <strong>「设置 → 清除演示数据」</strong>一键清除。
                        数据已同步到云端，换设备登录也会自动同步。
                      </p>
                    </div>

                    <button
                      onClick={handleStartExplore}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-pdd-success text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                    >
                      <CheckCircle size={20} />
                      <span>开始体验</span>
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
