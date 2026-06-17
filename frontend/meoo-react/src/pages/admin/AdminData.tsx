import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  Database, Store, HardDrive, Upload, AlertTriangle,
  Search, ChevronDown, ChevronUp, Clock, Package,
  Activity, ShieldAlert, TrendingUp, RefreshCw,
} from 'lucide-react';
import { useDataStats } from '../../hooks/useAdminData';

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
  lastUploadAt: string | null;
  storageBytes: number;
}

type SortKey = 'storeName' | 'userName' | 'orders' | 'afterSaleRecords' | 'totalRows' | 'storageBytes' | 'lastUploadAt';

const CATEGORY_CONFIG: Array<{ key: string; label: string; color: string }> = [
  { key: 'orders', label: '订单', color: 'var(--pdd-info)' },
  { key: 'promotionSummary', label: '推广概览', color: 'var(--pdd-warning)' },
  { key: 'promotionProducts', label: '推广商品', color: 'var(--pdd-purple)' },
  { key: 'afterSaleRecords', label: '售后', color: 'var(--pdd-danger)' },
  { key: 'shippingInsurance', label: '运费险', color: 'var(--pdd-cyan)' },
  { key: 'starStoreSummary', label: '星标', color: 'var(--pdd-success)' },
  { key: 'liveStreamSummary', label: '直播', color: 'var(--pdd-pink)' },
  { key: 'financialRecords', label: '财务', color: 'var(--pdd-cyan)' },
];

function isAnomaly(s: StoreData): string[] {
  const reasons: string[] = [];
  const now = Date.now();
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  if (!s.lastUploadAt || new Date(s.lastUploadAt).getTime() < threeDaysAgo) {
    reasons.push('3天未更新');
  }
  if (s.totalRows === 0) {
    reasons.push('无数据');
  }
  if (s.storageBytes > 50 * 1024 * 1024) {
    reasons.push('存储偏大');
  }
  return reasons;
}

export default function AdminData() {
  const { data: stores, isLoading, refetch } = useDataStats();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalRows');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [showAnomalyOnly, setShowAnomalyOnly] = useState(false);
  const pageSize = 10;
  const sd = (stores || []) as StoreData[];

  const filteredStores = useMemo(() => {
    let result = sd;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s: StoreData) =>
        s.storeName.toLowerCase().includes(q) ||
        s.userName.toLowerCase().includes(q)
      );
    }
    if (showAnomalyOnly) {
      result = result.filter((s: StoreData) => isAnomaly(s).length > 0);
    }
    return result;
  }, [sd, search, showAnomalyOnly]);

  const sortedStores = useMemo(() => {
    return [...filteredStores].sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];
      if (sortKey === 'lastUploadAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (sortKey === 'storeName' || sortKey === 'userName') {
        va = String(va ?? '').toLowerCase();
        vb = String(vb ?? '').toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va ?? 0) - (vb ?? 0) : (vb ?? 0) - (va ?? 0);
    });
  }, [filteredStores, sortKey, sortDir]);

  const pagedStores = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedStores.slice(start, start + pageSize);
  }, [sortedStores, page]);

  const totalPages = Math.max(1, Math.ceil(sortedStores.length / pageSize));

  const overview = useMemo(() => {
    const totalStores = sd.length;
    const totalRows = sd.reduce((s: number, v: StoreData) => s + v.totalRows, 0);
    const totalStorage = sd.reduce((s, v) => s + v.storageBytes, 0);
    const todayCount = sd.filter(s => {
      if (!s.lastUploadAt) return false;
      const d = new Date(s.lastUploadAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { totalStores, totalRows, totalStorage, todayCount };
  }, [sd]);

  const categoryPieData = useMemo(() => {
    return CATEGORY_CONFIG
      .map(c => ({
        name: c.label,
        value: sd.reduce((s, v) => s + ((v as any)[c.key] ?? 0), 0),
        color: c.color,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sd]);

  const top10Data = useMemo(() =>
    [...sd]
      .sort((a, b) => b.totalRows - a.totalRows)
      .slice(0, 10)
      .map(s => ({
        name: s.storeName.length > 6 ? s.storeName.slice(0, 6) + '...' : s.storeName,
        订单: s.orders,
        售后: s.afterSaleRecords,
        推广: s.promotionSummary,
      }))
  , [sd]);

  const anomalyCount = sd.filter(s => isAnomaly(s).length > 0).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const formatStorage = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 10 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: string | null): string => {
    if (!d) return '从未上传';
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="text-[10px] ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw size={24} className="animate-spin text-pdd-text-secondary" />
        <span className="text-sm text-pdd-text-secondary">加载店铺数据...</span>
      </div>
    );
  }

  const SortHeader = ({ label, sortKey: sk }: { label: string; sortKey: SortKey }) => (
    <th className="text-right py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort(sk)}>
      <span className="flex items-center justify-end gap-0.5 font-medium text-pdd-text-secondary text-xs">
        {label} {sortIndicator(sk)}
      </span>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">数据监控</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">各店铺数据存储详情与异常监控</p>
        </div>
        <div className="flex items-center gap-2">
          {anomalyCount > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
              <AlertTriangle size={12} /> {anomalyCount} 个异常
            </span>
          )}
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-pdd-card text-pdd-text-secondary hover:text-pdd-text transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '店铺总数', value: overview.totalStores, icon: Store, color: 'var(--pdd-purple)', bg: 'bg-violet-500/10' },
          { label: '总记录行数', value: overview.totalRows.toLocaleString(), icon: Database, color: 'var(--pdd-info)', bg: 'bg-blue-500/10' },
          { label: '总存储空间', value: formatStorage(overview.totalStorage), icon: HardDrive, color: 'var(--pdd-success)', bg: 'bg-green-500/10' },
          { label: '今日上传', value: overview.todayCount, icon: Upload, color: 'var(--pdd-warning)', bg: 'bg-amber-500/10' },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-pdd-card rounded-xl border border-pdd-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-pdd-text-secondary">{c.label}</span>
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                <c.icon size={16} style={{ color: c.color }} />
              </div>
            </div>
            <div className="text-xl font-bold text-pdd-text-primary tabular-nums">{c.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">店铺数据 TOP10</h3>
          {top10Data.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={top10Data} barSize={22} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} />
                <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="订单" fill="var(--pdd-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="推广" fill="var(--pdd-warning)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="售后" fill="var(--pdd-danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无店铺数据</div>
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">数据类别分布</h3>
          {categoryPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryPieData} cx="50%" cy="45%" innerRadius={45} outerRadius={85} dataKey="value" strokeWidth={0}>
                  {categoryPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => [`${value.toLocaleString()} 行`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无数据</div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="搜索店铺名称或用户名..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-pdd-card border border-pdd-border rounded-lg text-pdd-text placeholder-pdd-text-secondary focus:outline-none focus:border-pdd-info"
          />
        </div>
        <button
          onClick={() => { setShowAnomalyOnly(!showAnomalyOnly); setPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${
            showAnomalyOnly
              ? 'bg-red-500/10 text-red-400 border-red-500/20'
              : 'bg-pdd-card border-pdd-border text-pdd-text-secondary hover:text-pdd-text'
          }`}
        >
          <AlertTriangle size={13} />
          仅看异常 ({anomalyCount})
        </button>
        <span className="text-xs text-pdd-text-secondary tabular-nums">
          共 {filteredStores.length} 个店铺
        </span>
      </div>

      <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
        {pagedStores.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pdd-border bg-pdd-bg">
                    <th className="text-left py-3 px-2 w-8" />
                    <th className="text-left py-3 px-3 cursor-pointer select-none" onClick={() => toggleSort('storeName')}>
                      <span className="flex items-center gap-0.5 font-medium text-pdd-text-secondary text-xs">
                        店铺 {sortIndicator('storeName')}
                      </span>
                    </th>
                    <th className="text-left py-3 px-3 hidden sm:table-cell cursor-pointer select-none" onClick={() => toggleSort('userName')}>
                      <span className="flex items-center gap-0.5 font-medium text-pdd-text-secondary text-xs">
                        用户 {sortIndicator('userName')}
                      </span>
                    </th>
                    <SortHeader label="订单" sortKey="orders" />
                    <SortHeader label="售后" sortKey="afterSaleRecords" />
                    <SortHeader label="总行数" sortKey="totalRows" />
                    <SortHeader label="存储" sortKey="storageBytes" />
                    <SortHeader label="最后上传" sortKey="lastUploadAt" />
                    <th className="text-center py-3 px-3 font-medium text-pdd-text-secondary text-xs">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStores.map((s, i) => {
                    const anomalies = isAnomaly(s);
                    const isExpanded = expandedId === s.storeId;
                    return (
                      <React.Fragment key={s.storeId}>
                        <motion.tr
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                          className={`border-b border-pdd-border/30 transition-colors ${
                            anomalies.length > 0 ? 'bg-red-500/[0.02]' : 'hover:bg-pdd-bg/50'
                          } cursor-pointer`}
                          onClick={() => setExpandedId(isExpanded ? null : s.storeId)}
                        >
                          <td className="py-3 px-2 text-center">
                            {isExpanded
                              ? <ChevronUp size={14} className="text-pdd-text-secondary" />
                              : <ChevronDown size={14} className="text-pdd-text-secondary" />}
                          </td>
                          <td className="py-3 px-3 text-pdd-text-primary font-medium text-xs">{s.storeName}</td>
                          <td className="py-3 px-3 text-pdd-text-secondary text-xs hidden sm:table-cell">{s.userName}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary text-xs">{s.orders.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary text-xs">{s.afterSaleRecords.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-pdd-text-primary font-medium text-xs">{s.totalRows.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-pdd-text-secondary text-xs">{formatStorage(s.storageBytes)}</td>
                          <td className="py-3 px-3 text-right text-pdd-text-secondary text-xs whitespace-nowrap">{formatDate(s.lastUploadAt)}</td>
                          <td className="py-3 px-3 text-center">
                            {anomalies.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                                <AlertTriangle size={10} /> {anomalies[0]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
                                <span className="w-1 h-1 rounded-full bg-green-400" /> 正常
                              </span>
                            )}
                          </td>
                        </motion.tr>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              key={`${s.storeId}-detail`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <td colSpan={9} className="p-0">
                                <div className="px-4 py-4 bg-pdd-bg/50 border-b border-pdd-border/30">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {CATEGORY_CONFIG.map(c => (
                                      <div key={c.key} className="flex items-center gap-2 p-2.5 rounded-lg bg-pdd-card/60 border border-pdd-border/30">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-pdd-text-secondary">{c.label}</p>
                                          <p className="text-xs font-bold text-pdd-text-primary tabular-nums">
                                            {(s as any)[c.key]?.toLocaleString() ?? '0'}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-pdd-border/50 text-[10px] text-pdd-text-secondary">
                                    <span className="flex items-center gap-1"><HardDrive size={10} /> 存储: {formatStorage(s.storageBytes)}</span>
                                    <span className="flex items-center gap-1"><Clock size={10} /> 最后上传: {s.lastUploadAt ? new Date(s.lastUploadAt).toLocaleString('zh-CN') : '从未'}</span>
                                    <span className="flex items-center gap-1"><Database size={10} /> 总行数: {s.totalRows.toLocaleString()}</span>
                                    <span className="flex items-center gap-1"><Package size={10} /> 订单数: {s.orders.toLocaleString()}</span>
                                  </div>
                                  {anomalies.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/5 rounded-lg px-2 py-1.5 border border-red-500/10">
                                      <ShieldAlert size={10} />
                                      {anomalies.join(' / ')}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-pdd-border">
                <span className="text-xs text-pdd-text-secondary">
                  第 {page}/{totalPages} 页，共 {sortedStores.length} 条
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="w-7 h-7 text-xs rounded-md text-pdd-text-secondary hover:bg-pdd-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    &#8249;
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 text-xs rounded-md transition-colors tabular-nums ${
                          p === page
                            ? 'bg-pdd-primary/20 text-pdd-primary font-medium'
                            : 'text-pdd-text-secondary hover:bg-pdd-bg'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="w-7 h-7 text-xs rounded-md text-pdd-text-secondary hover:bg-pdd-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    &#8250;
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-pdd-text-secondary">
            <Database size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无匹配的店铺数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
