import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Plus, Trash2, ShoppingBag, TrendingUp, DollarSign, ShoppingCart, BarChart3, RefreshCw, Eye, FileText, Users, Package, AlertCircle, CheckCircle, Clock, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { useStore, useData } from '../App';
import { importSampleData } from '../utils/dataImporter';
import { forceSyncFromServer } from '../utils/forceSync';
import { apiClient } from '../../api/client';

export default function StoresPage() {
  const { stores, currentStore, addStore, renameStore, switchStore, deleteStore } = useStore();
  const { uploadRecords, dataFilter, setDataFilter } = useData();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [showAllStores, setShowAllStores] = useState(false);
  // ★ 云盘使用量
  const [cloudInfo, setCloudInfo] = useState({usageMB:0,limitMB:30,storeCount:0});
  useEffect(() => {
    apiClient.get('/admin/storage/usage').then(r => {
      if (r.success && r.data) setCloudInfo(r.data);
    }).catch(()=>{});
  }, []);

  // ★ StoresPage 自己直接拉取数据，不依赖 DataProvider
  const [myDashboard, setMyDashboard] = useState<any>(null);
  useEffect(() => {
    const storeId = stores.find(s => s.id !== '__all__')?.id;
    if (!storeId) return;
    apiClient.get<any>(`/analytics/dashboard?storeId=${storeId}`).then(res => {
      if (res.success && res.data) setMyDashboard(res.data);
    }).catch(() => {});
  }, [stores]);

  const dashKpi = myDashboard?.kpi;
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
    navigate('/dashboard');
  };

  // ★ 统计来源：本地直接拉取的数据
  const totalStats = useMemo(() => ({
    totalOrders: dashKpi?.orders || 0,
    totalGMV: dashKpi?.gmv || 0,
    totalPromoCost: dashKpi?.promoCost || 0,
    totalUploads: uploadRecords.length,
    totalProducts: dashKpi?.products || dashKpi?.productCount || 0,
    totalUsers: dashKpi?.buyers || 0,
  }), [dashKpi, uploadRecords]);

  const recentUploads = useMemo(() => uploadRecords.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 5), [uploadRecords]);

  const statCards = [
    { label: '总订单', value: totalStats.totalOrders.toLocaleString(), sub: '累计订单量', icon: ShoppingCart },
    { label: '总GMV', value: `¥${totalStats.totalGMV.toLocaleString()}`, sub: '商品总价', icon: DollarSign },
    { label: '推广花费', value: `¥${totalStats.totalPromoCost.toLocaleString()}`, sub: '累计推广成本', icon: TrendingUp },
    { label: '商品数', value: String(totalStats.totalProducts), sub: '在售商品', icon: Package },
    { label: '买家数', value: String(totalStats.totalUsers), sub: '累计买家', icon: Users },
    { label: '上传次数', value: String(totalStats.totalUploads), sub: '数据上传', icon: BarChart3 },
  ];

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-pdd-text">
              <div className="p-2.5 rounded-xl bg-pdd-primary shadow-lg shadow-pdd-primary/20">
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

        {/* 私人云盘 */}
        <div className="flex items-center gap-4 p-4 bg-pdd-card rounded-lg border border-pdd-border mb-4">
          <span className="text-2xl">☁️</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-pdd-text">私人云盘</span>
              <span className="text-xs text-pdd-text-secondary">{cloudInfo.usageMB.toFixed(1)}MB / {cloudInfo.limitMB >= 1024 ? (cloudInfo.limitMB/1024).toFixed(1)+'GB' : cloudInfo.limitMB+'MB'}</span>
            </div>
            <div className="w-full h-2 bg-pdd-bg rounded-full overflow-hidden">
              <div className="h-full bg-pdd-primary rounded-full transition-all" style={{width:Math.min(100,cloudInfo.limitMB>0?cloudInfo.usageMB/cloudInfo.limitMB*100:0)+'%'}} />
            </div>
            <p className="text-[10px] text-pdd-text-secondary mt-1">{cloudInfo.storeCount}个店铺 · 共{cloudInfo.usageMB.toFixed(1)}MB已用</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {statCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-pdd-card rounded-lg border border-pdd-border p-4 hover:shadow-[0_2px_8px_rgba(16,24,40,0.06)] transition-all group relative overflow-hidden">
              <div className="flex items-center gap-1.5 mb-2">
                <card.icon size={16} className="text-pdd-text-secondary" />
                <span className="text-[11px] font-medium text-pdd-text-secondary/80">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-pdd-text">{card.value}</p>
              <p className="text-xs text-pdd-text-secondary/60 mt-1">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Store List */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
              <Store size={13} className="text-pdd-text-secondary" />
              我的店铺 ({stores.length})
            </h3>
            {stores.length > 0 && (
              <button onClick={async () => {
                if (!confirm('数据恢复将从服务器拉取最新数据覆盖本地，确认继续？')) return;
                setImporting(true); setImportMsg('正在从服务器同步...');
                const r = await forceSyncFromServer();
                setImporting(false);
                if (r.success) setImportMsg(`已恢复 ${r.storesRecovered}/${r.storesFound} 个店铺，即将刷新...`);
                else setImportMsg(r.error || '同步失败');
                if (r.success) setTimeout(() => window.location.reload(), 1000);
              }}
                disabled={importing}
                className="px-3 py-1.5 text-xs border border-pdd-border rounded-lg text-pdd-text-secondary hover:text-pdd-primary hover:border-pdd-primary/40 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={14} className={importing ? 'animate-spin' : ''} /> 数据恢复
              </button>
            )}
            </div>

            {stores.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-pdd-card rounded-lg border border-pdd-border text-center py-16">
                <ShoppingBag size={64} className="mx-auto mb-4 text-pdd-border" />
                <p className="text-lg text-pdd-text-secondary mb-2">还没有添加店铺</p>
                <p className="text-sm text-pdd-text-secondary mb-4">在右侧添加您的第一个店铺开始使用</p>
                <div className="flex items-center justify-center gap-3">
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
                    className="px-6 py-3 bg-gradient-to-r from-pdd-primary to-blue-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-pdd-primary/20"
                  >
                    <Store size={18} className="inline mr-2" />
                    {importing ? '正在导入...' : '一键导入演示数据'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('数据恢复将从服务器拉取最新数据，确认继续？')) return;
                      setImporting(true); setImportMsg('正在连接服务器...');
                      const r = await forceSyncFromServer();
                      setImporting(false);
                      if (r.success) {
                        if (r.storesRecovered > 0) {
                          setImportMsg(`已恢复 ${r.storesRecovered} 个店铺数据，即将刷新...`);
                          setTimeout(() => window.location.reload(), 1000);
                        } else {
                          setImportMsg('服务器无数据，请先导入演示数据或上传文件');
                        }
                      } else {
                        setImportMsg(r.error || '同步失败，请检查网络');
                      }
                    }}
                    disabled={importing}
                    className="px-6 py-3 border border-pdd-border text-pdd-text-secondary rounded-xl font-medium hover:border-pdd-primary/40 hover:text-pdd-primary transition-all"
                  >
                    <RefreshCw size={18} className={`inline mr-2 ${importing ? 'animate-spin' : ''}`} />
                    数据恢复
                  </button>
                </div>
                {importMsg && <p className={`text-sm mt-2 ${importMsg.includes('成功')||importMsg.includes('恢复') ? 'text-pdd-success' : 'text-pdd-text-secondary'}`}>{importMsg}</p>}
                <p className="text-xs text-pdd-text-secondary mt-2">若已注册但数据丢失，先点"数据恢复"从云端拉取，不行再点"导入演示数据"</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {stores.map((s, i) => {
                    const isCurrent = currentStore?.id === s.id;
                    const stats = isCurrent ? totalStats : { totalOrders: 0, totalGMV: 0, totalPromoCost: 0, totalUploads: uploadRecords.filter(r => r.storeId === s.id).length, totalProducts: 0, totalUsers: 0 };
                    return (
                      <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ delay: i * 0.05 }}
                        className={`bg-pdd-card rounded-lg border border-pdd-border p-4 cursor-pointer group hover:border-pdd-border transition-all ${isCurrent ? 'border-pdd-primary/40 bg-pdd-primary/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pdd-primary to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-pdd-primary/20">
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
                                      { label: '订单数', value: (stats.totalOrders || 0).toLocaleString() },
                                      { label: 'GMV', value: '¥' + (stats.totalGMV || 0).toLocaleString() },
                                      { label: '推广费', value: '¥' + (stats.totalPromoCost || 0).toLocaleString() },
                                      { label: '上传次数', value: String(stats.totalUploads || 0) },
                                    ].map(item => (
                                      <div key={item.label} className="bg-pdd-bg rounded-lg p-2.5 border border-pdd-border">
                                        <p className="text-xs text-pdd-text-secondary">{item.label}</p>
                                        <p className="text-lg font-bold text-pdd-text">{item.value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1.5 text-pdd-text-secondary"><Package size={14} /><span>{stats.totalProducts || 0} 商品</span></div>
                                    <div className="flex items-center gap-1.5 text-pdd-text-secondary"><Users size={14} /><span>{stats.totalUsers || 0} 买家</span></div>
                                    <div className="flex items-center gap-1.5 text-pdd-text-secondary"><FileText size={14} /><span>{stats.totalUploads || 0} 次上传</span></div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex flex-col gap-2">
                            <button onClick={() => handleSelect(s.id)}
                              className="px-4 py-2 bg-gradient-to-r from-pdd-primary to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-pdd-primary/25 transition-all flex items-center gap-2 text-sm font-medium">
                              <RefreshCw size={14} /> 选择并上传
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDataFilter(s.id); switchStore(s.id); navigate('/dashboard'); }}
                              className="px-4 py-2 bg-pdd-success/10 text-pdd-success border border-pdd-success/30 rounded-xl hover:bg-pdd-success/30 transition-all flex items-center gap-2 text-sm">
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
              <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                <Plus size={13} className="text-pdd-text-secondary" /> 添加店铺
              </h3>
              <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
                <label className="text-sm text-pdd-text-secondary mb-2 block">店铺名称</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入拼多多店铺名称"
                  className="w-full border border-pdd-border rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-pdd-primary transition-colors bg-pdd-bg text-pdd-text placeholder-pdd-text-secondary"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <button onClick={handleAdd} disabled={!name.trim()}
                  className="w-full bg-gradient-to-r from-pdd-primary to-blue-600 hover:shadow-lg hover:shadow-pdd-primary/25 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> 添加店铺
                </button>
              </div>
            </div>

            {/* Recent Uploads */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                <Clock size={13} className="text-pdd-text-secondary" /> 最近上传
              </h3>
              <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
                {recentUploads.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText size={32} className="mx-auto mb-2 text-pdd-border" />
                    <p className="text-sm text-pdd-text-secondary">暂无上传记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentUploads.map((record) => (
                      <div key={record.id} className="flex items-center gap-3 p-2 bg-pdd-bg rounded-lg border border-pdd-border">
                        <div className="w-8 h-8 rounded-lg bg-pdd-primary/10 flex items-center justify-center">
                          <FileText size={16} className="text-pdd-primary" />
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
              <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-3">
                <AlertCircle size={13} className="text-pdd-text-secondary" /> 使用提示
              </h3>
              <div className="bg-pdd-card rounded-lg border border-pdd-border p-4 space-y-3">
                {['选择一个店铺后上传数据，数据会自动同步到该店铺', '支持订单、推广、运费险等多种数据类型', '删除上传记录会同时清除该文件导入的数据'].map((tip, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-pdd-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-pdd-primary/20">
                      <span className="text-xs font-bold text-pdd-primary">{i + 1}</span>
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
