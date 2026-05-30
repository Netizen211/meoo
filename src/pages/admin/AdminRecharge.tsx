import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, RefreshCw, AlertCircle, ChevronLeft, ChevronRight,
  Download, Filter, Eye, CheckSquare, Shield, CreditCard, Clock,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';

interface RechargeItem {
  id: number;
  userId: string;
  username: string;
  plan: string;
  duration: string;
  amount: number;
  wechatNickname: string;
  remark: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

type TabKey = 'pending' | 'approved' | 'rejected';
const PAGE_SIZE = 20;

const PLAN_LABELS: Record<string, string> = { pro: '全功能会员', enterprise: '企业版' };
const DURATION_LABELS: Record<string, string> = { monthly: '30天', yearly: '365天' };
const DURATION_DAYS: Record<string, number> = { monthly: 30, yearly: 365 };

const TABS: { key: TabKey; label: string; color: string }[] = [
  { key: 'pending', label: '待审核', color: 'border-amber-500 text-amber-500' },
  { key: 'approved', label: '已通过', color: 'border-green-500 text-green-500' },
  { key: 'rejected', label: '已拒绝', color: 'border-red-500 text-red-500' },
];

export default function AdminRecharge() {
  const [items, setItems] = useState<RechargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionMsg, setActionMsg] = useState('');

  // Review modal
  const [reviewModal, setReviewModal] = useState<{
    item: RechargeItem;
    action: 'approve' | 'reject';
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState(false);

  // Batch review
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState<{
    action: 'approve' | 'reject';
    note: string;
  } | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Detail modal
  const [detailItem, setDetailItem] = useState<RechargeItem | null>(null);

  // Exporting
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getRechargeList(tab, page, PAGE_SIZE);
    if (res.success) {
      setItems(res.data || []);
      setTotal((res as any).total ?? 0);
      setSelectedIds(new Set());
    }
    setLoading(false);
  }, [tab, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async () => {
    if (!reviewModal) return;
    setProcessing(true);
    const res = await adminApi.reviewRecharge(
      reviewModal.item.id,
      reviewModal.action,
      reviewNote || undefined
    );
    setProcessing(false);
    if (res.success) {
      setActionMsg(reviewModal.action === 'approve' ? '审核通过' : '已拒绝');
      setReviewModal(null);
      setReviewNote('');
      loadData();
    } else {
      setActionMsg('操作失败');
    }
    setTimeout(() => setActionMsg(''), 2000);
  };

  const openReviewModal = (item: RechargeItem, action: 'approve' | 'reject') => {
    setReviewModal({ item, action });
    setReviewNote('');
  };

  // Selection
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  // Batch review
  const handleBatchReview = async () => {
    if (!batchConfirm) return;
    setBatchProcessing(true);
    const ids = Array.from(selectedIds);
    const res = await adminApi.batchReviewRecharge(
      ids,
      batchConfirm.action,
      batchConfirm.note || undefined
    );
    setBatchProcessing(false);
    if (res.success) {
      setActionMsg(
        batchConfirm.action === 'approve'
          ? `已通过 ${ids.length} 条申请`
          : `已拒绝 ${ids.length} 条申请`
      );
      setSelectedIds(new Set());
      setBatchConfirm(null);
      loadData();
    } else {
      setActionMsg('批量操作失败');
    }
    setTimeout(() => setActionMsg(''), 2000);
  };

  // Export
  const handleExport = async () => {
    setExporting(true);
    const res = await adminApi.exportRechargeRecords(tab, 'csv');
    if (res.success && res.data) {
      // Download the generated file
      const blob = new Blob([typeof res.data === 'string' ? res.data : JSON.stringify(res.data)], {
        type: 'text/csv;charset=utf-8',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `充值记录_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setActionMsg('导出成功');
    } else {
      setActionMsg('导出失败');
    }
    setExporting(false);
    setTimeout(() => setActionMsg(''), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
            已通过
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">
            已拒绝
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
            待审核
          </span>
        );
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingItems = items.filter(i => i.status === 'pending');
  const canBatch = tab === 'pending' && selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">充值审核</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">
            共 {total} 条记录
            {selectedIds.size > 0 && `，已选择 ${selectedIds.size} 条`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pdd-border text-xs text-pdd-text-secondary hover:text-pdd-primary hover:border-pdd-primary/50 transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            {exporting ? '导出中...' : '导出'}
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pdd-border text-xs text-pdd-text-secondary hover:text-pdd-primary hover:border-pdd-primary/50 transition-colors"
          >
            <RefreshCw size={13} />
            刷新
          </button>
        </div>
      </div>

      {/* Action message */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded border border-pdd-success/20"
          >
            {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-pdd-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              tab === t.key
                ? `${t.color} border-current`
                : 'border-transparent text-pdd-text-secondary hover:text-pdd-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}

        {/* Batch actions */}
        {canBatch && (
          <div className="ml-auto flex items-center gap-2 pb-1">
            <button
              onClick={() => setBatchConfirm({ action: 'approve', note: '' })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <Check size={13} />
              批量通过 ({selectedIds.size})
            </button>
            <button
              onClick={() => setBatchConfirm({ action: 'reject', note: '' })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1"
            >
              <X size={13} />
              批量拒绝 ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 text-pdd-text-secondary">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-pdd-text-secondary">
              <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无充值记录</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border bg-pdd-bg/50">
                  {tab === 'pending' && (
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === pendingItems.length && pendingItems.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-pdd-border"
                      />
                    </th>
                  )}
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">申请人</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">套餐</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">金额</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">微信昵称</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">申请时间</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isPending = item.status === 'pending';
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-pdd-border/30 hover:bg-pdd-bg/30 transition-colors ${
                        isSelected ? 'bg-pdd-info/5' : ''
                      }`}
                    >
                      {tab === 'pending' && (
                        <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-pdd-border"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 text-pdd-text-secondary tabular-nums">
                        #{item.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-pdd-text-primary">{item.username}</div>
                        <div className="text-xs text-pdd-text-secondary">{item.userId}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-pdd-text-primary font-medium text-xs">
                          {PLAN_LABELS[item.plan] || item.plan}
                        </div>
                        <span className="text-[10px] text-pdd-text-secondary">
                          {DURATION_LABELS[item.duration] || item.duration}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-pdd-text-primary tabular-nums">
                        ¥{item.amount}
                      </td>
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs">
                        {item.wechatNickname || '-'}
                      </td>
                      <td className="py-3 px-4 text-pdd-text-secondary text-xs">
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDetailItem(item)}
                            className="p-1.5 rounded text-pdd-text-secondary hover:text-pdd-info hover:bg-pdd-info/10 transition-colors"
                            title="查看详情"
                          >
                            <Eye size={15} />
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={() => openReviewModal(item, 'approve')}
                                className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                                title="通过"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                onClick={() => openReviewModal(item, 'reject')}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                                title="拒绝"
                              >
                                <X size={15} />
                              </button>
                            </>
                          )}
                          {!isPending && item.reviewedAt && (
                            <span className="text-xs text-pdd-text-secondary">
                              {new Date(item.reviewedAt).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-pdd-text-secondary">
          <span>共 {total} 条记录</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-pdd-border disabled:opacity-30 hover:bg-pdd-bg transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs text-pdd-text-primary tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-pdd-border disabled:opacity-30 hover:bg-pdd-bg transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {detailItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDetailItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Eye size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-pdd-text-primary">申请详情 #{detailItem.id}</h3>
                    <p className="text-xs text-pdd-text-secondary mt-0.5">
                      {new Date(detailItem.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailItem(null)}
                  className="p-1.5 rounded-lg hover:bg-pdd-bg transition-colors text-pdd-text-secondary"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">申请人</span>
                  <span className="text-pdd-text-primary font-medium">{detailItem.username}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">用户ID</span>
                  <span className="text-pdd-text-primary text-xs">{detailItem.userId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">套餐</span>
                  <span className="text-pdd-text-primary font-medium">
                    {PLAN_LABELS[detailItem.plan] || detailItem.plan} ({DURATION_LABELS[detailItem.duration] || detailItem.duration})
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">金额</span>
                  <span className="text-pdd-text-primary font-medium">¥{detailItem.amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">微信昵称</span>
                  <span className="text-pdd-text-primary">{detailItem.wechatNickname || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">备注</span>
                  <span className="text-pdd-text-primary text-xs max-w-[200px] truncate">
                    {detailItem.remark || '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-pdd-text-secondary">状态</span>
                  <span>{getStatusBadge(detailItem.status)}</span>
                </div>
                {detailItem.reviewedBy && (
                  <div className="flex justify-between text-sm">
                    <span className="text-pdd-text-secondary">审核人</span>
                    <span className="text-pdd-text-primary">{detailItem.reviewedBy}</span>
                  </div>
                )}
                {detailItem.reviewedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-pdd-text-secondary">审核时间</span>
                    <span className="text-pdd-text-primary text-xs">
                      {new Date(detailItem.reviewedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
                {detailItem.reviewNote && (
                  <div className="flex justify-between text-sm">
                    <span className="text-pdd-text-secondary">审核备注</span>
                    <span className="text-pdd-text-primary text-xs max-w-[200px] text-right">
                      {detailItem.reviewNote}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setDetailItem(null)}
                className="w-full py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
              >
                关闭
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Confirmation Modal */}
      <AnimatePresence>
        {reviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setReviewModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  reviewModal.action === 'approve' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {reviewModal.action === 'approve' ? (
                    <Check size={20} className="text-green-600" />
                  ) : (
                    <X size={20} className="text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text-primary">
                    {reviewModal.action === 'approve' ? '确认通过充值申请' : '确认拒绝充值申请'}
                  </h3>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">
                    申请人：{reviewModal.item.username} | #{reviewModal.item.id}
                  </p>
                </div>
              </div>

              {/* Application summary */}
              <div className="bg-pdd-bg rounded-lg p-3 mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">套餐</span>
                  <span className="text-pdd-text-primary font-medium">
                    {PLAN_LABELS[reviewModal.item.plan] || reviewModal.item.plan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">时长</span>
                  <span className="text-pdd-text-primary font-medium">
                    {DURATION_LABELS[reviewModal.item.duration] || reviewModal.item.duration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">金额</span>
                  <span className="text-pdd-text-primary font-medium">¥{reviewModal.item.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">微信昵称</span>
                  <span className="text-pdd-text-primary">{reviewModal.item.wechatNickname || '-'}</span>
                </div>
                {reviewModal.item.remark && (
                  <div className="flex justify-between">
                    <span className="text-pdd-text-secondary">备注</span>
                    <span className="text-pdd-text-primary text-xs max-w-[180px] truncate">
                      {reviewModal.item.remark}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-pdd-text-secondary">申请时间</span>
                  <span className="text-pdd-text-primary text-xs">
                    {new Date(reviewModal.item.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>

              {/* Impact preview for approval */}
              {reviewModal.action === 'approve' && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700 space-y-1">
                    <p className="font-medium">审核通过后：</p>
                    <ul className="list-disc pl-3 space-y-0.5">
                      <li>
                        用户将获得 <strong>{PLAN_LABELS[reviewModal.item.plan] || reviewModal.item.plan}</strong> 权限
                      </li>
                      <li>
                        会员有效期延长 <strong>{DURATION_DAYS[reviewModal.item.duration] || '?'} 天</strong>
                      </li>
                      <li>
                        请确保已收到用户的微信转账 <strong>¥{reviewModal.item.amount}</strong>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {reviewModal.action === 'reject' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    拒绝后用户需重新提交申请。请确认拒绝原因并通知用户。
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  {reviewModal.action === 'approve' ? '审核备注（选填）' : '拒绝原因'}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder={
                    reviewModal.action === 'approve'
                      ? '可填写审核备注...'
                      : '请填写拒绝原因（如：未收到转账、信息不符等）...'
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setReviewModal(null)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleReview}
                  disabled={processing}
                  className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
                    reviewModal.action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? '处理中...' : reviewModal.action === 'approve' ? '确认通过' : '确认拒绝'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Review Confirm Modal */}
      <AnimatePresence>
        {batchConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setBatchConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  batchConfirm.action === 'approve' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {batchConfirm.action === 'approve' ? (
                    <Check size={20} className="text-green-600" />
                  ) : (
                    <X size={20} className="text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text-primary">
                    {batchConfirm.action === 'approve'
                      ? `批量通过 ${selectedIds.size} 条申请`
                      : `批量拒绝 ${selectedIds.size} 条申请`}
                  </h3>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">
                    {batchConfirm.action === 'approve'
                      ? '通过后将为这些用户开通对应会员'
                      : '拒绝后这些用户需重新提交申请'}
                  </p>
                </div>
              </div>

              {batchConfirm.action === 'approve' && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    请确保已收到所有用户的微信转账后再批量通过。
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  统一备注（选填）
                </label>
                <textarea
                  value={batchConfirm.note}
                  onChange={e => setBatchConfirm({ ...batchConfirm, note: e.target.value })}
                  placeholder="将作为所有审核的备注..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setBatchConfirm(null)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchReview}
                  disabled={batchProcessing}
                  className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
                    batchConfirm.action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {batchProcessing ? '处理中...' : '确认'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
