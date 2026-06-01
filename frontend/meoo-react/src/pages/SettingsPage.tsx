import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, ChevronRight, Database, Shield, FileText, TrendingUp, DollarSign, Upload, Store, Check, Layers, Activity, Filter, X, Clock, ChevronDown } from 'lucide-react';
import { useAuth, useData, useStore } from '../App';
import { useNavigate } from 'react-router-dom';
import { readLogs, clearLogs, type OperationLog } from '../utils/operationLog';
import { clearSampleData } from '../utils/dataImporter';
import { apiClient } from '../../api/client';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACTION_COLORS: Record<string, string> = {
  '上传数据': 'var(--pdd-info)',
  '删除上传记录': 'var(--pdd-danger)',
  '清除订单数据': 'var(--pdd-warning)',
  '清除推广数据': 'var(--pdd-warning)',
  '清除成本配置': 'var(--pdd-warning)',
  '清除上传记录': 'var(--pdd-warning)',
  '清空全部数据': 'var(--pdd-danger)',
  '清除店铺列表': 'var(--pdd-danger)',
  '修改成本配置': 'var(--pdd-success)',
  '修改费用设置': 'var(--pdd-success)',
  '修改税费/扣费': 'var(--pdd-success)',
  '修改异常订单': 'var(--pdd-primary)',
  '添加店铺': 'var(--pdd-primary)',
  '删除店铺': 'var(--pdd-danger)',
};

type StoreInfo = { id: string; name: string };

export default function SettingsPage() {
  const { logout } = useAuth();
  const { stores, deleteStore } = useStore();
  const navigate = useNavigate();
  const {
    clearAllData,
    clearOrderData,
    clearPromotionData,
    clearFinancialData,
    clearCostData,
    clearUploadRecords,
    clearStoreList,
    clearStoreData,
    allUploadRecords,
    currentDisplayData,
    getStoreData,
  } = useData();

  // 范围模式
  const [scopeMode, setScopeMode] = useState<'current' | 'all'>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const selectedStore = useMemo(() => stores.find(s => s.id === selectedStoreId) ?? null, [stores, selectedStoreId]);

  // 店铺下拉
  const [storeDropdown, setStoreDropdown] = useState(false);
  const storeBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const openStoreDropdown = useCallback(() => {
    if (storeBtnRef.current) {
      const rect = storeBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setStoreDropdown(true);
  }, []);

  // 确认弹窗
  const [confirmModal, setConfirmModal] = useState<string | null>(null);
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);

  const handleDeleteStore = async (storeId: string) => {
    // ★ 等待服务器确认删除成功
    await deleteStore(storeId);
    // 兜底：清除 DataProvider 中该店铺缓存
    clearStoreData(storeId);
    setDeleteStoreId(null);
  };

  // 切换范围时重置清除状态
  const handleScopeChange = (mode: 'current' | 'all') => {
    setScopeMode(mode);
    setClearedIds(new Set());
  };

  // 服务端数据统计（数据存储在服务器，浏览器不存数据）
  const storageInfo = { totalSize: 0, dataCount: 0 };

  // 按范围计算数据量
  const storeData = useMemo(() => {
    if (scopeMode !== 'current' || !selectedStoreId) return null;
    return getStoreData(selectedStoreId);
  }, [scopeMode, selectedStoreId, getStoreData]);

  const orderCount = scopeMode === 'all'
    ? currentDisplayData?.orders?.length ?? 0
    : (storeData?.orders?.length ?? 0);

  const promoCount = scopeMode === 'all'
    ? (currentDisplayData?.promotionProducts?.length ?? 0) + (currentDisplayData?.promotionSummary?.length ?? 0) + (currentDisplayData?.starStoreSummary?.length ?? 0) + (currentDisplayData?.liveStreamSummary?.length ?? 0)
    : (storeData?.promotionProducts?.length ?? 0) + (storeData?.promotionSummary?.length ?? 0) + (storeData?.starStoreSummary?.length ?? 0) + (storeData?.liveStreamSummary?.length ?? 0);

  const financialCount = scopeMode === 'all'
    ? (currentDisplayData?.financialRecords?.length ?? 0)
    : (storeData?.financialRecords?.length ?? 0);

  const uploadCount = scopeMode === 'all'
    ? allUploadRecords.length
    : allUploadRecords.filter(r => r.storeId === selectedStoreId).length;

  const scopeLabel = scopeMode === 'all' ? '所有店铺' : (selectedStore?.name ?? '选择店铺');
  const scopeSuffix = scopeMode === 'all' ? '' : `店铺"${selectedStore?.name ?? ''}"的`;

  // 清除选项
  const clearOptions = useMemo(() => {
    const disabled = scopeMode === 'current' && !selectedStoreId;
    return [
      {
        id: 'orders',
        label: '订单数据',
        description: disabled ? '请先选择店铺' : `清除${scopeSuffix}订单记录（${orderCount}条）`,
        icon: FileText,
        color: '#1890ff',
        bgColor: '#e6f7ff',
        action: () => scopeMode === 'current' ? clearOrderData(selectedStoreId) : clearOrderData(),
        disabled,
        warning: '清除后商品分析、用户分析等页面将无数据显示',
      },
      {
        id: 'promotion',
        label: '推广数据',
        description: disabled ? '请先选择店铺' : `清除${scopeSuffix}商品推广、明星店铺、直播推广数据（${promoCount}条）`,
        icon: TrendingUp,
        color: '#722ed1',
        bgColor: '#f9f0ff',
        action: () => scopeMode === 'current' ? clearPromotionData(selectedStoreId) : clearPromotionData(),
        disabled,
        warning: '清除后推广ROI、推广成本等指标将无法计算',
      },
      {
        id: 'financial',
        label: '财务报表',
        description: disabled ? '请先选择店铺' : `清除${scopeSuffix}货款明细记录（${financialCount}条）`,
        icon: FileText,
        color: '#13c2c2',
        bgColor: '#e6fffb',
        action: () => scopeMode === 'current' ? clearFinancialData(selectedStoreId) : clearFinancialData(),
        disabled,
        warning: '清除后财务管理页面将无数据显示，需重新上传货款明细',
      },
      {
        id: 'cost',
        label: '成本配置',
        description: disabled ? '请先选择店铺' : `清除${scopeSuffix}商品成本、税费配置、包装费、运费等`,
        icon: DollarSign,
        color: 'var(--pdd-warning)',
        bgColor: '#fffbe6',
        action: () => scopeMode === 'current' ? clearCostData(selectedStoreId) : clearCostData(),
        disabled,
        warning: '清除后利润计算将使用默认值，需重新配置',
      },
      {
        id: 'uploads',
        label: '上传记录',
        description: disabled ? '请先选择店铺' : `清除${scopeSuffix}文件上传历史记录（${uploadCount}条）`,
        icon: Upload,
        color: 'var(--pdd-success)',
        bgColor: '#f6ffed',
        action: () => scopeMode === 'current' ? clearUploadRecords(selectedStoreId) : clearUploadRecords(),
        disabled,
        warning: '仅清除记录，不影响已解析的数据',
      },
      {
        id: 'stores',
        label: '店铺列表',
        description: '清除店铺列表和当前选中店铺（保留数据）',
        icon: Store,
        color: '#eb2f96',
        bgColor: '#fff0f6',
        action: clearStoreList,
        disabled: scopeMode === 'current',
        warning: '清除后需重新添加店铺，但数据仍保留',
        onlyAllStores: true,
      },
      {
        id: 'demo',
        label: '清除演示数据',
        description: '一键清除演示店铺及其全部数据（含云端同步数据）',
        icon: Database,
        color: 'var(--pdd-danger)',
        bgColor: '#fff1f0',
        action: async () => {
          await clearSampleData();
          window.location.reload();
        },
        disabled: false,
        warning: '将删除演示店铺及全部数据（订单/推广/售后/成本等），不可恢复。云端数据同步删除。',
      },
    ];
  }, [scopeMode, selectedStoreId, scopeSuffix, orderCount, promoCount, financialCount, uploadCount, selectedStoreId, clearOrderData, clearPromotionData, clearFinancialData, clearCostData, clearUploadRecords, clearStoreList]);

  const handleClear = (option: typeof clearOptions[number]) => {
    option.action();
    setClearedIds(prev => new Set(prev).add(option.id));
    setConfirmModal(null);
  };

  const handleClearAll = async () => {
    // ★ 先调服务端清除所有数据，再清本地状态
    await clearAllData();
    // 额外确保：调用服务端 clear-all 兜底
    try { await apiClient.post('/data/clear-all'); } catch {}
    logout();
    navigate('/login');
  };

  // ---- 操作日志 ----
  const [logFilterStore, setLogFilterStore] = useState<string>('');
  const [logFilterAction, setLogFilterAction] = useState<string>('');
  const [logVersion, setLogVersion] = useState(0);

  const allLogs = useMemo(() => readLogs(), [logVersion, clearedIds]);
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      if (logFilterStore && log.storeId !== logFilterStore) return false;
      if (logFilterAction && log.action !== logFilterAction) return false;
      return true;
    });
  }, [allLogs, logFilterStore, logFilterAction]);

  const actionTypes = useMemo(() => {
    const types = new Set(allLogs.map(l => l.action));
    return Array.from(types).sort();
  }, [allLogs]);

  const storeOptions: StoreInfo[] = useMemo(() => {
    const seen = new Set<string>();
    const result: StoreInfo[] = [];
    allLogs.forEach(l => {
      if (l.storeId && l.storeId !== '全部' && !seen.has(l.storeId)) {
        seen.add(l.storeId);
        result.push({ id: l.storeId, name: l.storeName });
      }
    });
    return result;
  }, [allLogs]);

  const handleClearLogs = () => {
    clearLogs();
    setLogVersion(prev => prev + 1);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2 text-pdd-text">
            数据管理
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-pdd-text-secondary">
            精细化管理您的本地缓存数据
          </motion.p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:text-pdd-primary hover:border-pdd-primary transition-colors"
        >
          <ChevronRight size={16} className="rotate-180" />
          返回首页
        </motion.button>
      </div>

      {/* 存储概览 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pdd-card p-5 mb-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-pdd-primary/10 flex items-center justify-center">
            <Database size={20} className="text-pdd-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-pdd-text">本地存储占用</h3>
            <p className="text-xs text-pdd-text-secondary">您的数据存储在浏览器本地</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-pdd-bg rounded-lg p-4">
            <div className="text-xs text-pdd-text-secondary mb-1">总占用空间</div>
            <div className="text-xl font-bold text-pdd-text">{formatSize(storageInfo.totalSize)}</div>
          </div>
          <div className="bg-pdd-bg rounded-lg p-4">
            <div className="text-xs text-pdd-text-secondary mb-1">数据项数量</div>
            <div className="text-xl font-bold text-pdd-text">{storageInfo.dataCount} 项</div>
          </div>
        </div>
      </motion.div>

      {/* 范围切换 + 店铺选择 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-4"
      >
        <div className="flex items-center gap-3 mb-3">
          {/* 范围切换器 */}
          <div className="flex items-center p-1 bg-pdd-bg rounded-lg">
            <button
              onClick={() => handleScopeChange('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${scopeMode === 'all' ? 'bg-pdd-card text-pdd-primary shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'}`}
            >
              <Layers size={14} className="inline mr-1.5" />
              所有店铺
            </button>
            <button
              onClick={() => handleScopeChange('current')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${scopeMode === 'current' ? 'bg-pdd-card text-pdd-primary shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'}`}
            >
              <Store size={14} className="inline mr-1.5" />
              当前店铺
            </button>
          </div>

          {/* 店铺选择器（当前店铺模式下显示） */}
          {scopeMode === 'current' && (
            <div className="relative">
              <button
                ref={storeBtnRef}
                onClick={openStoreDropdown}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-pdd-border text-sm text-pdd-text bg-pdd-card hover:border-pdd-primary/30 transition-colors"
              >
                <Store size={14} className="text-pdd-primary" />
                <span className={selectedStore ? 'text-pdd-text' : 'text-pdd-text-secondary'}>
                  {selectedStore?.name ?? '选择店铺'}
                </span>
                <ChevronDown size={14} className="text-pdd-text-secondary" />
              </button>

              {/* Portal 下拉 */}
              {storeDropdown && createPortal(
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="fixed w-52 bg-pdd-card rounded-lg shadow-xl border border-pdd-border z-[99999] overflow-hidden"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                  >
                    <div className="max-h-64 overflow-y-auto py-1">
                      {stores.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStoreId(s.id); setStoreDropdown(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pdd-bg transition-colors flex items-center gap-2 ${s.id === selectedStoreId ? 'text-pdd-primary font-medium bg-pdd-primary/5' : 'text-pdd-text'}`}
                        >
                          <Store size={14} />
                          {s.name}
                          {s.id === selectedStoreId && <Check size={14} className="ml-auto text-pdd-primary" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>,
                document.body
              )}
            </div>
          )}

          {/* 点击外部关闭下拉 */}
          {storeDropdown && (
            <div className="fixed inset-0 z-[99998]" onClick={() => setStoreDropdown(false)} />
          )}
        </div>
      </motion.div>

      {/* 分类清除选项 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-4"
      >
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-pdd-text">
          <Shield size={14} className="text-pdd-primary" />
          选择性清除
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clearOptions.map((option, idx) => {
            const isCleared = clearedIds.has(option.id);
            const isDisabled = option.disabled;
            return (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.05 }}
                className={`pdd-card p-4 border transition-all ${
                  isCleared ? 'border-pdd-success bg-pdd-success/10' :
                  isDisabled ? 'border-pdd-border opacity-50' :
                  'border-pdd-border hover:border-pdd-primary/30'
                } ${option.onlyAllStores && scopeMode === 'current' ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: option.bgColor }}
                  >
                    <option.icon size={18} color={option.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold">{option.label}</h4>
                      {isCleared && <Check size={14} className="text-pdd-success" />}
                    </div>
                    <p className="text-xs text-[var(--pdd-text-secondary)] mb-2">
                      {option.description}
                      {option.onlyAllStores && scopeMode === 'current' && (
                        <span className="text-pdd-warning ml-1">（仅"所有店铺"模式可用）</span>
                      )}
                    </p>
                    {option.warning && (
                      <p className="text-[10px] text-pdd-warning mb-2">{option.warning}</p>
                    )}
                    <motion.button
                      whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                      whileTap={{ scale: isDisabled ? 1 : 0.98 }}
                      onClick={() => !isDisabled && setConfirmModal(option.id)}
                      disabled={isDisabled || isCleared}
                      className={`w-full py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                        isCleared
                          ? 'bg-pdd-success/20 text-pdd-success cursor-default'
                          : isDisabled
                          ? 'bg-pdd-bg text-pdd-text-secondary/50 cursor-not-allowed'
                          : 'bg-pdd-bg text-pdd-text-secondary hover:bg-pdd-primary/10 hover:text-pdd-primary'
                      }`}
                    >
                      {isCleared ? (
                        <>已清除</>
                      ) : (
                        <>
                          <Trash2 size={12} />
                          清除此项
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* 删除店铺 */}
      {stores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="pdd-card p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-pdd-danger/10 flex items-center justify-center">
              <Trash2 size={20} className="text-pdd-danger" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-pdd-text">删除店铺</h3>
              <p className="text-xs text-pdd-text-secondary">永久删除店铺及其全部数据，不可恢复</p>
            </div>
          </div>
          <div className="space-y-2">
            {stores.filter(s => s.id !== '__all__').map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-pdd-bg border border-pdd-border">
                <div className="flex items-center gap-2 min-w-0">
                  <Store size={14} className="text-pdd-text-secondary shrink-0" />
                  <span className="text-sm text-pdd-text truncate">{s.name}</span>
                  <span className="text-[10px] text-pdd-text-secondary font-mono hidden sm:inline">{s.id}</span>
                </div>
                <button
                  onClick={() => setDeleteStoreId(s.id)}
                  className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-pdd-danger/30 text-pdd-danger hover:bg-pdd-danger/10 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 全部清除 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="pdd-card p-5 border-2 border-pdd-danger/50 mb-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-pdd-danger/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-pdd-danger" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-pdd-danger">清空所有个人数据</h3>
            <p className="text-xs text-pdd-text-secondary">删除所有本地缓存，包括店铺数据、上传记录、配置等</p>
          </div>
        </div>

        <div className="bg-pdd-warning/10 border border-pdd-warning/30 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <Shield size={14} className="text-pdd-warning mt-0.5 flex-shrink-0" />
            <div className="text-xs text-pdd-text-secondary">
              <p className="font-medium mb-1">清理后将删除以下数据：</p>
              <ul className="list-disc list-inside space-y-0.5 text-pdd-text-secondary/80">
                <li>所有店铺及订单数据</li>
                <li>推广数据（商品推广/明星店铺/直播）</li>
                <li>财务报表（货款明细）</li>
                <li>上传记录和文件解析结果</li>
                <li>成本配置和定价预设</li>
                <li>登录状态（需重新登录）</li>
              </ul>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setConfirmModal('all')}
          className="w-full py-3 rounded-lg text-sm font-bold bg-pdd-danger text-white hover:bg-pdd-danger/90 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={16} />
          清空所有个人数据
        </motion.button>
      </motion.div>

      {/* 操作日志 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="pdd-card p-5 mb-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pdd-primary/10 flex items-center justify-center">
              <Activity size={20} className="text-pdd-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-pdd-text">操作日志</h3>
              <p className="text-xs text-pdd-text-secondary">最近 {filteredLogs.length} 条操作记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allLogs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:text-pdd-danger hover:border-pdd-danger/30 transition-colors flex items-center gap-1"
              >
                <Trash2 size={12} />
                清空日志
              </button>
            )}
          </div>
        </div>

        {/* 日志筛选 */}
        {allLogs.length > 0 && (
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-pdd-border">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-pdd-text-secondary" />
              <select
                value={logFilterStore}
                onChange={e => setLogFilterStore(e.target.value)}
                className="text-xs border border-pdd-border rounded-md px-2 py-1.5 bg-pdd-bg text-pdd-text focus:outline-none focus:border-pdd-primary"
              >
                <option value="">全部店铺</option>
                {storeOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <select
              value={logFilterAction}
              onChange={e => setLogFilterAction(e.target.value)}
              className="text-xs border border-pdd-border rounded-md px-2 py-1.5 bg-pdd-bg text-pdd-text focus:outline-none focus:border-pdd-primary"
            >
              <option value="">全部操作</option>
              {actionTypes.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {(logFilterStore || logFilterAction) && (
              <button
                onClick={() => { setLogFilterStore(''); setLogFilterAction(''); }}
                className="text-xs text-pdd-primary hover:underline"
              >
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* 日志列表 */}
        {allLogs.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="mx-auto mb-2 text-pdd-border" />
            <p className="text-sm text-pdd-text-secondary">暂无操作日志</p>
            <p className="text-xs text-pdd-text-secondary mt-1">进行操作后会自动记录</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <Filter size={32} className="mx-auto mb-2 text-pdd-border" />
            <p className="text-sm text-pdd-text-secondary">没有匹配的操作日志</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-pdd-bg border border-pdd-border hover:border-pdd-primary/20 transition-colors"
                style={{ borderLeftColor: ACTION_COLORS[log.action] ?? 'var(--pdd-border)', borderLeftWidth: '3px' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${ACTION_COLORS[log.action] ?? 'var(--pdd-border)'}20`, color: ACTION_COLORS[log.action] ?? 'var(--pdd-text)' }}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs text-pdd-text-secondary">{log.storeName || log.storeId}</span>
                  </div>
                  <p className="text-xs text-pdd-text-secondary truncate">{log.details}</p>
                </div>
                <span className="text-[10px] text-pdd-text-secondary whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* 确认弹窗 */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              {confirmModal === 'all' ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-pdd-danger/10 flex items-center justify-center">
                      <AlertTriangle size={20} className="text-pdd-danger" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-pdd-text">确认清空所有数据</h3>
                      <p className="text-xs text-pdd-text-secondary">
                        将清空所有个人缓存数据，操作后需重新登录
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-pdd-text-secondary mb-4 p-3 bg-pdd-bg rounded-lg">
                    此操作不可撤销，请确保已备份重要数据。清理后您将自动退出登录。
                  </p>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setConfirmModal(null)}
                      className="flex-1 py-2.5 rounded-lg text-sm border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                    >
                      取消
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClearAll}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-pdd-danger text-white hover:bg-pdd-danger/90 transition-colors"
                    >
                      确认清空
                    </motion.button>
                  </div>
                </>
              ) : (
                (() => {
                  const option = clearOptions.find(o => o.id === confirmModal);
                  if (!option) return null;
                  return (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: option.bgColor }}>
                          <option.icon size={20} style={{ color: option.color }} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-pdd-text">确认清除{option.label}</h3>
                          <p className="text-xs text-pdd-text-secondary">{option.description}</p>
                        </div>
                      </div>
                      {option.warning && (
                        <div className="mb-4 p-3 bg-pdd-warning/10 border border-pdd-warning/30 rounded-lg">
                          <p className="text-xs text-pdd-warning flex items-start gap-2">
                            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                            {option.warning}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setConfirmModal(null)}
                          className="flex-1 py-2.5 rounded-lg text-sm border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                        >
                          取消
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleClear(option)}
                          className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors"
                          style={{ backgroundColor: option.color }}
                        >
                          确认清除
                        </motion.button>
                      </div>
                    </>
                  );
                })()
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除店铺确认弹窗 */}
      <AnimatePresence>
        {deleteStoreId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteStoreId(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-pdd-danger/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-pdd-danger" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text">确认删除店铺</h3>
                  <p className="text-xs text-pdd-text-secondary">
                    将永久删除「{stores.find(s => s.id === deleteStoreId)?.name || deleteStoreId}」及其全部数据
                  </p>
                </div>
              </div>
              <p className="text-xs text-pdd-text-secondary mb-4 p-3 bg-pdd-bg rounded-lg">
                此操作不可撤销。将删除该店铺的所有订单数据、推广数据、成本配置、上传记录。云端同步数据也将一并删除。
              </p>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteStoreId(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDeleteStore(deleteStoreId)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-pdd-danger text-white hover:bg-pdd-danger/90 transition-colors"
                >
                  确认删除
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
