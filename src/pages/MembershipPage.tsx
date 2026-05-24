import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Crown, X, Star, Zap, Infinity } from 'lucide-react';
import { useAuth } from '../App';

const PLANS = [
  {
    key: 'free',
    name: '免费版',
    price: '¥0',
    period: '/永久',
    color: 'pdd-text-secondary',
    features: [
      { text: '52个基础指标', included: true },
      { text: '单期数据上传', included: true },
      { text: '浏览器本地计算', included: true },
      { text: '7天数据保留', included: true },
      { text: '单店铺', included: true },
      { text: '推广ROI分析', included: false },
      { text: '多期数据对比', included: false },
      { text: '数据导出', included: false },
      { text: '风险预警', included: false },
    ],
  },
  {
    key: 'pro',
    name: '专业版',
    price: '¥29',
    period: '/月 ¥299/年',
    color: 'var(--pdd-danger)',
    features: [
      { text: '全部86个指标', included: true },
      { text: '推广ROI分析', included: true },
      { text: '多期数据对比', included: true },
      { text: '1年数据存储', included: true },
      { text: '数据导出(Excel/PDF)', included: true },
      { text: '风险预警', included: true },
      { text: '3店铺', included: true },
      { text: '自定义看板', included: false },
      { text: 'API接口', included: false },
    ],
  },
  {
    key: 'enterprise',
    name: '企业版',
    price: '¥99',
    period: '/月 ¥999/年',
    color: 'var(--pdd-warning)',
    features: [
      { text: '全部专业版功能', included: true },
      { text: '无限数据存储', included: true },
      { text: '自定义看板', included: true },
      { text: '无限店铺', included: true },
      { text: 'API接口', included: true },
      { text: '优先客服支持', included: true },
      { text: '多店铺管理', included: true },
      { text: '专属顾问', included: true },
      { text: '数据安全保障', included: true },
    ],
  },
];

export default function MembershipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentLevel = user?.membershipLevel || 'free';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-2">
        会员中心
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[var(--pdd-text-secondary)] mb-6">
        选择适合您的套餐，解锁更多数据分析能力
      </motion.p>

      <div className="grid grid-cols-3 gap-6">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.key}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className={`pdd-card relative overflow-hidden ${currentLevel === plan.key ? 'border-2 border-[pdd-danger]' : ''}`}
          >
            {currentLevel === plan.key && (
              <div className="absolute top-0 right-0 bg-[var(--pdd-danger)] text-white text-xs px-3 py-1 rounded-bl-lg font-medium">当前方案</div>
            )}
            {plan.key === 'pro' && (
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
                  {f.included ? <Check size={14} className="text-pdd-success" /> : <X size={14} className="text-pdd-text-muted" />}
                  <span className={f.included ? '' : 'text-pdd-text-muted'}>{f.text}</span>
                </div>
              ))}
            </div>

            {currentLevel === plan.key ? (
              <button className="w-full py-2.5 rounded-lg bg-[var(--pdd-border)] text-[var(--pdd-text-secondary)] text-sm font-medium cursor-default">
                当前方案
              </button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
                style={{ backgroundColor: plan.color }}
              >
                {plan.key === 'free' ? '当前方案' : '升级'}
              </motion.button>
            )}
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pdd-card mt-6 text-center">
        <Crown size={24} color="var(--pdd-danger)" className="mx-auto mb-2" />
        <p className="text-sm text-[var(--pdd-text-secondary)]">
          升级会员后可解锁推广ROI、风险预警、多期对比等34个深度分析指标
        </p>
      </motion.div>
    </div>
  );
}