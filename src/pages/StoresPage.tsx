import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Plus, Trash2, ShoppingBag, TrendingUp, DollarSign, ShoppingCart, BarChart3, RefreshCw, Eye, FileText, Users, Package, AlertCircle, CheckCircle, Clock, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { useStore, useData } from '../App';
import { safeFloat } from '../components/TimeFilter';
import { findField } from '../utils';
import { importSampleData, hasSampleData } from '../utils/dataImporter';

export default function StoresPage() {
  const { stores, currentStore, addStore, renameStore, switchStore, deleteStore } = useStore();
  const { uploadRecords, dataFilter, setDataFilter, getStoreData } = useData();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [showAllStores, setShowAllStores] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [editingName, setEditingName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    addStore(name.trim());
    setName('');
  };

  const handleSelect = (id: string) => {
    switchStore(id);
    setDataFilter(id);
    navigate('/upload');
  };

  const storeStats = useMemo(() => {
    const stats: Record<string, any> = {};
    stores.forEach(s => {
      const storeUploads = uploadRecords.filter(r => r.storeId === s.id);
      const storeData = getStoreData(s.id);
      if (!storeData) {
        stats[s.id] = { orders: 0, gmv: 0, promoCost: 0, uploadCount: storeUploads.length, avgOrderValue: 0, productCount: 0, userCount: 0, refundRate: 0, lastUploadTime: storeUploads.length > 0 ? storeUploads[storeUploads.length - 1].uploadedAt : '', dataTypes: [] };
        return;
      }
      const orders = storeData.orders || [];
      const promotionSummary = storeData.promotionSummary || [];
      const shippingInsurance = storeData.shippingInsurance || [];
      const starStoreSummary = storeData.starStoreSummary || [];
      const liveStreamSummary = storeData.liveStreamSummary || [];
      const gmv = orders.reduce((sum: number, o: any) => sum + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
      const promoCost = promotionSummary.reduce((sum: number, r: any) => sum + safeFloat(findField(r, '总花费(元)', '花费(元)')), 0)
        + starStoreSummary.reduce((sum: number, r: any) => sum + safeFloat(findField(r, '花费(元)', '总花费(元)')), 0)
        + liveStreamSummary.reduce((sum: number, r: any) => sum + safeFloat(findField(r, '总花费(元)', '花费(元)')), 0);
      const refundOrders = orders.filter((o: any) => {
        const st = String(findField(o, '售后状态') || '').trim();
        return st.includes('退款');
      }).length;
      const dataTypes: string[] = [];
      if (orders.length > 0) dataTypes.push('订单');
      if (promotionSummary.length > 0) dataTypes.push('推广');
      if (starStoreSummary.length > 0) dataTypes.push('明星店铺');
      if (liveStreamSummary.length > 0) dataTypes.push('直播');
      if (shippingInsurance.length > 0) dataTypes.push('运费险');
      stats[s.id] = {
        orders: orders.length, gmv, promoCost, uploadCount: storeUploads.length,
        avgOrderValue: orders.length > 0 ? gmv / orders.length : 0,
        productCount: new Set(orders.map((o: any) => String(findField(o, '商品id', '商品ID') || '').trim()).filter(Boolean)).size,
        userCount: new Set(orders.map((o: any) => String(findField(o, '用户购买手机号') || '').trim()).filter(Boolean)).size,
        refundRate: orders.length > 0 ? (refundOrders / orders.length) * 100 : 0,
        lastUploadTime: storeUploads.length > 0 ? storeUploads[storeUploads.length - 1].uploadedAt : '', dataTypes
      };
    });
    return stats;
  }, [stores, uploadRecords, getStoreData]);

  const totalStats = useMemo(() => {
    let totalOrders = 0, totalGMV = 0, totalPromoCost = 0, totalUploads = 0, totalProducts = 0, totalUsers = 0;
    Object.values(storeStats).forEach(s => { totalOrders += s.orders; totalGMV += s.gmv; totalPromoCost += s.promoCost; totalUploads += s.uploadCount; totalProducts += s.productCount; totalUsers += s.userCount; });
    return { totalOrders, totalGMV, totalPromoCost, totalUploads, totalProducts, totalUsers };
  }, [storeStats]);

  const recentUploads = useMemo(() => uploadRecords.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 5), [uploadRecords]);

  const statCards = [
    { label: '总订单', value: totalStats.totalOrders.toLocaleString(), sub: '累计订单量', icon: ShoppingCart, color: 'var(--pdd-info)', bg: 'rgba(59,130,246,0.1)' },
    { label: '总GMV', value: `¥${totalStats.totalGMV.toLocaleString()}`, sub: '商品总价', icon: DollarSign, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { label: '推广花费', value: `¥${totalStats.totalPromoCost.toLocaleString()}`, sub: '累计推广成本', icon: TrendingUp, color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    { label: '商品数', value: String(totalStats.totalProducts), sub: '在售商品', icon: Package, color: 'var(--pdd-success)', bg: 'rgba(34,197,94,0.1)' },
    { label: '买家数', value: String(totalStats.totalUsers), sub: '累计买家', icon: Users, color: 'var(--pdd-warning)', bg: 'rgba(245,158,11,0.1)' },
    { label: '上传次数', value: String(totalStats.totalUploads), sub: '数据上传', icon: BarChart3, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-pdd-text">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark shadow-lg shadow-pdd-primary/20">
                <Store size={24} className="text-white" />
              </div>
              店铺管理中心
            </h1>
            <p className="text-sm text-pdd-text-secondary mt-1 ml-1">管理您的所有店铺数据，快速切换和同步</p>
          </div>
          <button onClick={() => setShowAllStores(!showAllStores)}
            className="flex items-center gap-2 px-4 py-2 bg-pdd-card border border-pdd-border rounded-xl hover:border-pdd-primary/30 text-pdd-text-secondary hover:text-pdd-text transition-all">
            <Eye size={18} />
            {showAllStores ? '收起详情' : '查看全部店铺'}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {statCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="pdd-card p-4 hover:border-pdd-border transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: card.bg }}>
                  <card.icon size={18} style={{ color: card.color }} />
                </div>
                <span className="text-xs text-pdd-text-secondary">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-pdd-text">{card.value}</p>
              <p className="text-xs text-pdd-text-secondary mt-1">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Store List */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-pdd-text">
              <Store size={20} className="text-pdd-primary-light" />
              我的店铺 ({stores.length})
            </h2>
            </div>

            {stores.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card text-center py-16">
                <ShoppingBag size={64} className="mx-auto mb-4 text-pdd-border" />
                <p className="text-lg text-pdd-text-secondary mb-2">还没有添加店铺</p>
                <p className="text-sm text-pdd-text-secondary mb-4">在右侧添加您的第一个店铺开始使用</p>
                <button
                  onClick={async () => {
                    setImporting(true); setImportMsg('');
                    try {
                      await importSampleData();
                      setImportMsg('导入成功，页面即将刷新...');
                      setTimeout(() => window.location.reload(), 800);
                    } catch { setImportMsg('导入失败，请重试'); }
                    setImporting(false);
                  }}
                  disabled={importing}
                  className="px-6 py-3 bg-gradient-to-r from-pdd-primary to-pdd-primary-light text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-pdd-primary/20"
                >
                  <RefreshCw size={18} className={`inline mr-2 ${importing ? 'animate-spin' : ''}`} />
                  {importing ? '正在导入...' : '一键导入演示数据'}
                </button>
                {importMsg && <p className="text-sm text-pdd-success mt-2">{importMsg}</p>}
                <p className="text-xs text-pdd-text-secondary mt-2">包含520笔订单 + 推广 + 售后 + 成本配置</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {stores.map((s, i) => {
                    const stats = storeStats[s.id] || { orders: 0, gmv: 0, promoCost: 0, uploadCount: 0, avgOrderValue: 0, productCount: 0, userCount: 0, refundRate: 0, dataTypes: [], lastUploadTime: '' };
                    const isCurrent = currentStore?.id === s.id;
                    return (
                      <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ delay: i * 0.05 }}
                        className={`pdd-card p-4 cursor-pointer group hover:border-pdd-border transition-all ${isCurrent ? 'border-pdd-primary/40 bg-pdd-primary/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark flex items-center justify-center text-white font-bold shadow-lg shadow-pdd-primary/20">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  {editingId === s.id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        value={editingName}
                                        onChange={e => setEditingName(e.target.value)}
                                        className="text-lg font-bold w-40 px-2 py-0.5 border border-pdd-primary rounded-lg bg-pdd-bg text-pdd-text focus:outline-none focus:ring-2 focus:ring-pdd-primary/20"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') { renameStore(s.id, editingName.trim() || s.name); setEditingId(null); }
                                          if (e.key === 'Escape') setEditingId(null);
                                        }}
                                      />
                                      <button onClick={() => { renameStore(s.id, editingName.trim() || s.name); setEditingId(null); }} className="p-1 text-pdd-success hover:bg-pdd-success/10 rounded"><Check size={16} /></button>
                                      <button onClick={() => setEditingId(null)} className="p-1 text-pdd-text-secondary hover:bg-pdd-bg rounded"><X size={16} /></button>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="font-bold text-lg text-pdd-text">{s.name}</p>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditingId(s.id); setEditingName(s.name); }}
                                        className="p-1 text-pdd-text-secondary hover:text-pdd-primary hover:bg-pdd-primary/10 rounded transition-colors"
                                        title="重命名店铺"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                    </>
                                  )}
                                  {isCurrent && <span className="text-xs bg-pdd-primary text-white px-2 py-0.5 rounded-full shadow-lg shadow-pdd-primary/20">当前店铺</span>}
                                </div>
                                <p className="text-xs text-pdd-text-secondary">创建于 {new Date(s.createdAt).toLocaleDateString('zh-CN')}</p>
                              </div>
                            </div>

                            <AnimatePresence>
                              {showAllStores && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
                                  <div className="grid grid-cols-4 gap-4 mb-3">
                                    {[
                                      { label: '订单数', value: stats.orders.toLocaleString(), color: 'var(--pdd-info)' },
                                      { label: 'GMV', value: `¥${stats.gmv.toLocaleString()}`, color: '#6366f1' },
                                      { label: '客单价', value: `¥${stats.avgOrderValue.toFixed(0)}`, color: '#a855f7' },
                                      { label: '退款率', value: `${stats.refundRate.toFixed(1)}%`, color: 'var(--pdd-warning)' },
                                    ].map(item => (
                                      <div key={item.label} className="bg-pdd-bg rounded-lg p-2.5 border border-pdd-border">
                                        <p className="text-xs text-pdd-text-secondary">{item.label}</p>
                                        <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1.5 text-pdd-text-secondary"><Package size={14} /><span>{stats.productCount} 商品</span></div>
                                    <div className="flex items-center gap-1.5 text-pdd-text-secondary"><Users size={14} /><span>{stats.userCount} 买家</span></div>
                                    <div className="flex items-center gap-1.5 text-pdd-text-secondary"><FileText size={14} /><span>{stats.uploadCount} 次上传</span></div>
                                    {stats.dataTypes.length > 0 && (
                                      <div className="flex items-center gap-1.5"><CheckCircle size={14} className="text-pdd-success" /><span className="text-pdd-success">{stats.dataTypes.join(' · ')}</span></div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex flex-col gap-2">
                            <button onClick={() => handleSelect(s.id)}
                              className="px-4 py-2 bg-gradient-to-r from-pdd-primary-dark to-pdd-primary text-white rounded-xl hover:shadow-lg hover:shadow-pdd-primary/25 transition-all flex items-center gap-2 text-sm font-medium">
                              <RefreshCw size={14} /> 选择并上传
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDataFilter(s.id); switchStore(s.id); navigate('/dashboard'); }}
                              className="px-4 py-2 bg-pdd-success/20 text-pdd-success border border-pdd-success/20 rounded-xl hover:bg-pdd-success/30 transition-all flex items-center gap-2 text-sm">
                              <BarChart3 size={14} /> 查看数据
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm(`确定删除店铺「${s.name}」吗？`)) deleteStore(s.id); }}
                              className="px-4 py-2 border border-pdd-border text-pdd-text-secondary rounded-xl hover:border-pdd-danger/30 hover:text-pdd-danger transition-all flex items-center gap-2 text-sm">
                              <Trash2 size={14} /> 删除店铺
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-6">
            {/* Add Store */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-pdd-text">
                <Plus size={20} className="text-pdd-primary-light" /> 添加店铺
              </h2>
              <div className="pdd-card p-4">
                <label className="text-sm text-pdd-text-secondary mb-2 block">店铺名称</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入拼多多店铺名称"
                  className="w-full border border-pdd-border rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-pdd-primary transition-colors bg-pdd-bg text-pdd-text placeholder-pdd-text-secondary"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <button onClick={handleAdd} disabled={!name.trim()}
                  className="w-full bg-gradient-to-r from-pdd-primary-dark to-pdd-primary hover:shadow-lg hover:shadow-pdd-primary/25 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> 添加店铺
                </button>
              </div>
            </div>

            {/* Recent Uploads */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-pdd-text">
                <Clock size={20} className="text-pdd-primary-light" /> 最近上传
              </h2>
              <div className="pdd-card p-4">
                {recentUploads.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText size={32} className="mx-auto mb-2 text-pdd-border" />
                    <p className="text-sm text-pdd-text-secondary">暂无上传记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentUploads.map((record) => (
                      <div key={record.id} className="flex items-center gap-3 p-2 bg-pdd-bg rounded-lg border border-pdd-border">
                        <div className="w-8 h-8 rounded-lg bg-pdd-info/10 flex items-center justify-center">
                          <FileText size={16} className="text-pdd-info" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-pdd-text">{record.fileName}</p>
                          <p className="text-xs text-pdd-text-secondary">{record.storeName} · {new Date(record.uploadedAt).toLocaleDateString('zh-CN')}</p>
                        </div>
                        <ChevronRight size={16} className="text-pdd-text-secondary" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tips */}
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-pdd-text">
                <AlertCircle size={20} className="text-pdd-primary-light" /> 使用提示
              </h2>
              <div className="pdd-card p-4 space-y-3">
                {['选择一个店铺后上传数据，数据会自动同步到该店铺', '支持订单、推广、运费险等多种数据类型', '删除上传记录会同时清除该文件导入的数据'].map((tip, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-pdd-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-pdd-primary/20">
                      <span className="text-xs font-bold text-pdd-primary-light">{i + 1}</span>
                    </div>
                    <p className="text-sm text-pdd-text-secondary">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
