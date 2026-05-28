import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown, X, Clock, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { useAuth } from '../App';
import { isFullMember, getMembershipLabel } from '../utils/permission';
import { rechargeApi, RechargeRecord } from '../api/rechargeApi';

const PRICES = {
  pro: { monthly: 29, yearly: 299 },
  enterprise: { monthly: 99, yearly: 999 },
};

const PLANS = [
  {
    key: 'free',
    name: '免费版',
    price: '¥0',
    period: '/永久',
    color: 'var(--pdd-text-secondary)',
    features: [
      { text: '52个基础指标', included: true },
      { text: '单期数据上传', included: true },
      { text: '浏览器本地计算', included: true },
      { text: '基础分析页面', included: true },
      { text: '单店铺', included: true },
      { text: '推广ROI分析', included: false },
      { text: '多期数据对比', included: false },
      { text: '数据导出', included: false },
      { text: '风险预警', included: false },
      { text: 'AI 分析', included: false },
    ],
  },
  {
    key: 'pro',
    name: '全功能会员',
    price: '¥29',
    period: '/月 ¥299/年',
    color: 'var(--pdd-danger)',
    features: [
      { text: '全部86个指标', included: true },
      { text: '推广ROI分析', included: true },
      { text: '多期数据对比', included: true },
      { text: '数据导出(Excel)', included: true },
      { text: '风险预警', included: true },
      { text: '3店铺', included: true },
      { text: 'AI 分析（有限次数）', included: true },
      { text: '自定义看板', included: false },
      { text: '无限店铺', included: false },
    ],
  },
  {
    key: 'enterprise',
    name: '企业版',
    price: '¥99',
    period: '/月 ¥999/年',
    color: 'var(--pdd-warning)',
    features: [
      { text: '全部全功能会员功能', included: true },
      { text: '无限店铺', included: true },
      { text: '自定义看板', included: true },
      { text: 'API接口', included: true },
      { text: '优先客服支持', included: true },
      { text: 'AI 分析（无限次）', included: true },
      { text: '数据安全保障', included: true },
      { text: '专属顾问', included: true },
    ],
  },
];

export default function MembershipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentLevel = user?.membershipLevel || 'free';
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
  const [selectedDuration, setSelectedDuration] = useState<'monthly' | 'yearly'>('monthly');
  const [wechatNickname, setWechatNickname] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fullMember = isFullMember(user);

  useEffect(() => {
    rechargeApi.getMyRecords().then(setRecords).catch(() => {});
    setRecordsLoading(false);
  }, []);

  const handleOpenModal = (plan: 'pro' | 'enterprise') => {
    setSelectedPlan(plan);
    setSelectedDuration('monthly');
    setWechatNickname('');
    setRemark('');
    setMessage(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!wechatNickname.trim()) {
      setMessage({ type: 'error', text: '请输入您的微信昵称，方便管理员核对转账' });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      const amount = PRICES[selectedPlan][selectedDuration];
      const res = await rechargeApi.apply({
        plan: selectedPlan,
        duration: selectedDuration,
        amount,
        wechatNickname: wechatNickname.trim(),
        remark: remark.trim(),
      });

      if (res.success) {
        setMessage({ type: 'success', text: '充值申请已提交！请完成微信转账后等待管理员确认，通常24小时内处理。' });
        const updated = await rechargeApi.getMyRecords();
        setRecords(updated);
      } else {
        setMessage({ type: 'error', text: res.error || '提交失败，请稍后再试' });
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误，请检查连接后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  const amount = PRICES[selectedPlan][selectedDuration];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2">
        会员中心
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[var(--pdd-text-secondary)] mb-2">
        选择适合您的套餐，解锁更多数据分析能力
      </motion.p>

      {/* 当前会员状态提示 */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="pdd-card p-4 mb-6 flex items-center gap-3"
      >
        <Crown size={20} color={fullMember ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)'} />
        <div className="flex-1">
          <span className="text-sm font-medium">当前等级：{getMembershipLabel(currentLevel)}</span>
          {user?.membershipExpiresAt && (
            <span className="text-xs text-[var(--pdd-text-secondary)] ml-2">
              （到期时间：{new Date(user.membershipExpiresAt).toLocaleDateString('zh-CN')}）
            </span>
          )}
        </div>
        {!fullMember && (
          <span className="text-xs text-[var(--pdd-warning)]">免费版仅可查看基础指标，高级功能需升级</span>
        )}
      </motion.div>

      {/* 套餐卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan, i) => {
          const isCurrent = currentLevel === plan.key;
          const isPro = plan.key === 'pro';
          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`pdd-card relative overflow-hidden ${isCurrent && plan.key !== 'free' ? 'border-2 border-[var(--pdd-danger)]' : ''}`}
            >
              {isCurrent && plan.key !== 'free' && (
                <div className="absolute top-0 right-0 bg-[var(--pdd-danger)] text-white text-xs px-3 py-1 rounded-bl-lg font-medium">当前方案</div>
              )}
              {isPro && !isCurrent && (
                <div className="absolute top-0 left-0 bg-[var(--pdd-warning)] text-white text-xs px-3 py-1 rounded-br-lg font-medium">推荐</div>
              )}

              <div className="text-center mb-4 pt-4">
                <h3 className="text-lg font-bold" style={{ color: plan.color }}>{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold" style={{ color: plan.color }}>{plan.price}</span>
                  <span className="text-sm text-[var(--pdd-text-secondary)]">{plan.period}</span>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <div key={f.text} className="flex items-center gap-2 text-sm">
                    {f.included ? (
                      <Check size={14} className="text-pdd-success flex-shrink-0" />
                    ) : (
                      <X size={14} className="text-pdd-text-muted flex-shrink-0" />
                    )}
                    <span className={f.included ? '' : 'text-pdd-text-muted'}>{f.text}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button className="w-full py-2.5 rounded-lg bg-[var(--pdd-border)] text-[var(--pdd-text-secondary)] text-sm font-medium cursor-default">
                  当前方案
                </button>
              ) : plan.key === 'free' ? (
                <button className="w-full py-2.5 rounded-lg bg-[var(--pdd-border)] text-[var(--pdd-text-secondary)] text-sm font-medium cursor-default">
                  默认方案
                </button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenModal(plan.key as 'pro' | 'enterprise')}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
                  style={{ backgroundColor: plan.color }}
                >
                  升级
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 充值记录 */}
      {records.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pdd-card mt-6 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock size={14} />
            充值记录
          </h3>
          <div className="space-y-2">
            {records.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-[var(--pdd-border)] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{r.plan === 'pro' ? '全功能会员' : '企业版'} / {r.duration === 'monthly' ? '月付' : '年付'}</span>
                  <span className="text-sm font-medium">¥{r.amount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'approved' ? 'bg-green-100 text-green-700' :
                    r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已拒绝' : '待审核'}
                  </span>
                  <span className="text-xs text-[var(--pdd-text-secondary)]">{new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 充值弹窗 */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--pdd-card)] rounded-xl p-6 max-w-md w-full shadow-xl border border-[var(--pdd-border)]"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-1">
                升级{selectedPlan === 'pro' ? '全功能会员' : '企业版'}
              </h3>
              <p className="text-sm text-[var(--pdd-text-secondary)] mb-4">
                当前采用人工充值模式，转账后提交申请，管理员确认后自动开通
              </p>

              {/* 时长选择 */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">选择时长</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDuration('monthly')}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      selectedDuration === 'monthly'
                        ? 'border-[var(--pdd-primary)] bg-[var(--pdd-primary)]/10 text-[var(--pdd-primary)]'
                        : 'border-[var(--pdd-border)] text-[var(--pdd-text-secondary)]'
                    }`}
                  >
                    月付 ¥{PRICES[selectedPlan].monthly}/月
                  </button>
                  <button
                    onClick={() => setSelectedDuration('yearly')}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      selectedDuration === 'yearly'
                        ? 'border-[var(--pdd-primary)] bg-[var(--pdd-primary)]/10 text-[var(--pdd-primary)]'
                        : 'border-[var(--pdd-border)] text-[var(--pdd-text-secondary)]'
                    }`}
                  >
                    年付 ¥{PRICES[selectedPlan].yearly}/年
                  </button>
                </div>
              </div>

              {/* 金额展示 */}
              <div className="bg-[var(--pdd-bg)] rounded-lg p-4 mb-4 text-center">
                <div className="text-xs text-[var(--pdd-text-secondary)] mb-1">应付金额</div>
                <div className="text-2xl font-bold text-[var(--pdd-danger)]">¥{amount}</div>
              </div>

              {/* 微信转账说明 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-800">
                    <p className="font-medium mb-1">充值步骤：</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>微信扫描下方收款码转账 ¥{amount}</li>
                      <li>在下方填写您的微信昵称</li>
                      <li>提交申请后等待管理员确认</li>
                      <li>确认后会员自动开通</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* 微信收款码占位 */}
              <div className="bg-[var(--pdd-bg)] rounded-lg p-4 mb-4 text-center border-2 border-dashed border-[var(--pdd-border)]">
                <div className="w-40 h-40 mx-auto bg-white rounded-lg flex items-center justify-center mb-2">
                  <div className="text-center">
                    <div className="text-4xl mb-1">💬</div>
                    <div className="text-xs text-[var(--pdd-text-secondary)]">微信收款码</div>
                    <div className="text-[10px] text-[var(--pdd-text-secondary)] mt-1">
                      （请联系管理员获取）
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--pdd-text-secondary)]">
                  请使用微信扫描收款码完成转账
                </p>
              </div>

              {/* 微信昵称 */}
              <div className="mb-3">
                <label className="text-sm font-medium mb-1 block">
                  微信昵称 <span className="text-[var(--pdd-danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={wechatNickname}
                  onChange={e => setWechatNickname(e.target.value)}
                  placeholder="填写您转账的微信昵称"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--pdd-border)] bg-[var(--pdd-bg)] text-sm focus:border-[var(--pdd-primary)] outline-none"
                />
              </div>

              {/* 备注 */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">备注（选填）</label>
                <textarea
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  placeholder="如有特殊需求可在此说明"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--pdd-border)] bg-[var(--pdd-bg)] text-sm focus:border-[var(--pdd-primary)] outline-none resize-none"
                />
              </div>

              {/* 消息提示 */}
              {message && (
                <div className={`p-3 rounded-lg mb-4 text-sm ${
                  message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}

              {/* 按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--pdd-border)] text-sm text-[var(--pdd-text-secondary)] hover:bg-[var(--pdd-bg)] transition-colors"
                >
                  取消
                </button>
                {message?.type === 'success' ? (
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 rounded-lg bg-[var(--pdd-primary)] text-white text-sm font-medium"
                  >
                    完成
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--pdd-primary)' }}
                  >
                    {submitting ? '提交中...' : `确认提交 ¥${amount}`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
