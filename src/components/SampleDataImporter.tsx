import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Upload, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { importSampleData, hasSampleData } from '../utils/dataImporter';

interface ImportResult {
  file: string;
  type: string;
  rowCount: number;
}

export default function SampleDataImporter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [imported, setImported] = useState(hasSampleData());
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    try {
      const { results: importResults } = await importSampleData();
      setResults(importResults);
      setImported(true);
      // 刷新页面以加载新数据
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  if (imported) return null;

  return (
    <>
      {/* 浮动按钮 */}
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

      {/* 弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => !isImporting && setIsOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-pdd-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* 头部 */}
                <div className="bg-gradient-to-r from-pdd-primary to-pdd-primary-light p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database size={28} />
                      <h2 className="text-xl font-bold">加载示例数据</h2>
                    </div>
                    {!isImporting && (
                      <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                        <X size={24} />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-white/90 text-sm">
                    一键导入丰富的示例数据，体验完整的数据分析功能
                  </p>
                </div>

                {/* 内容 */}
                <div className="p-6">
                  {results.length === 0 && !error && (
                    <>
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
                      </div>

                      <button
                        onClick={handleImport}
                        disabled={isImporting}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-pdd-primary text-white rounded-xl font-medium hover:bg-pdd-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>正在导入数据...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={20} />
                            <span>立即导入示例数据</span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {results.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-pdd-success">
                        <CheckCircle size={24} />
                        <span className="font-medium">导入成功！</span>
                      </div>
                      <div className="bg-pdd-bg rounded-lg p-4 max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="text-pdd-text-secondary">
                            <tr>
                              <th className="text-left pb-2">文件</th>
                              <th className="text-left pb-2">类型</th>
                              <th className="text-right pb-2">条数</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-pdd-border">
                            {results.map((r, i) => (
                              <tr key={i}>
                                <td className="py-1 text-pdd-text truncate max-w-[120px]">{r.file}</td>
                                <td className="py-1 text-pdd-text-secondary">{r.type}</td>
                                <td className="py-1 text-right text-pdd-text">{r.rowCount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-sm text-pdd-text-secondary text-center">页面即将刷新...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 text-pdd-danger">
                      <AlertCircle size={24} />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
