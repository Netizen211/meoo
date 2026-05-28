import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Eye, RefreshCw, AlertCircle } from 'lucide-react';
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

export default function AdminRecharge() {
  const [items, setItems] = useState<RechargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reviewModal, setReviewModal] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await adminApi.getRechargeList(filter === 'all' ? undefined : filter, page, pageSize);
    if (res.success) {
      setItems(res.data || []);
      setTotal((res as any).total || 0);
    }
    setLoading(false);
  }, [filter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async () => {
    if (!reviewModal) return;
    setProcessing(true);
    const res = await adminApi.reviewRecharge(reviewModal.id, reviewModal.action, reviewNote);
    setProcessing(false);
    if (res.success) {
      setReviewModal(null);
      setReviewNote('');
      loadData();
    }
  };

  const openReviewModal = (id: number, action: 'approve' | 'reject') => {
    setReviewModal({ id, action });
    setReviewNote('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">已通过</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">已拒绝</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">待审核</span>;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">充值审核</h2>
        <button
          onClick={loadData}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-pdd-border text-xs text-pdd-text-secondary hover:text-pdd-primary hover:border-pdd-primary transition-colors"
        >
          <RefreshCw size={12} />
          刷新
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-pdd-primary text-white'
                : 'bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text'
            }`}
          >
            {f === 'all' ? '全部' : f === 'pending' ? '待审核' : f === 'approved' ? '已通过' : '已拒绝'}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-12 text-pdd-text-secondary">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-pdd-text-secondary">暂无充值申请</div>
      ) : (
        <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border bg-pdd-bg">
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">用户</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">套餐</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">金额</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">微信昵称</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">备注</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">时间</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-pdd-border last:border-0 hover:bg-pdd-bg/50">
                    <td className="py-3 px-4 text-pdd-text-secondary">#{item.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{item.username}</div>
                      <div className="text-xs text-pdd-text-secondary">{item.userId}</div>
                    </td>
                    <td className="py-3 px-4">
                      {item.plan === 'pro' ? '全功能会员' : '企业版'}
                      <span className="text-xs text-pdd-text-secondary ml-1">
                        ({item.duration === 'monthly' ? '月付' : '年付'})
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">¥{item.amount}</td>
                    <td className="py-3 px-4">{item.wechatNickname || '-'}</td>
                    <td className="py-3 px-4 text-xs text-pdd-text-secondary max-w-[120px] truncate">
                      {item.remark || '-'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                    <td className="py-3 px-4 text-xs text-pdd-text-secondary">
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4">
                      {item.status === 'pending' ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => openReviewModal(item.id, 'approve')}
                            className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                            title="通过"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => openReviewModal(item.id, 'reject')}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="拒绝"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-pdd-text-secondary">
                          {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString('zh-CN') : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-pdd-border text-xs disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-xs text-pdd-text-secondary">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-pdd-border text-xs disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}

      {/* 审核确认弹窗 */}
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
                  <h3 className="text-sm font-bold">
                    {reviewModal.action === 'approve' ? '确认通过充值申请' : '确认拒绝充值申请'}
                  </h3>
                  <p className="text-xs text-pdd-text-secondary">
                    {reviewModal.action === 'approve'
                      ? '通过后将自动为用户开通会员'
                      : '拒绝后用户需重新提交申请'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">
                  {reviewModal.action === 'approve' ? '备注（选填）' : '拒绝原因'}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder={reviewModal.action === 'approve' ? '可填写审核备注...' : '请填写拒绝原因...'}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm focus:border-pdd-primary outline-none resize-none"
                />
              </div>

              {reviewModal.action === 'approve' && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    确认后，系统将自动设置会员等级和到期时间。
                    请确保已收到用户的微信转账。
                  </p>
                </div>
              )}

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
                    reviewModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? '处理中...' : reviewModal.action === 'approve' ? '确认通过' : '确认拒绝'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
