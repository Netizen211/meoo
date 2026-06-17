/**
 * AuthPage — 登录/注册 统一页面
 * 设计规范：21-蓝白企业级UI设计系统.md §5.1
 * 对应计划：05-登录与注册.md
 *
 * 蓝白企业级左右分栏布局：
 *   左栏 60% — 品牌价值展示 + 浮动数据卡片（#F6FAFF 浅蓝背景）
 *   右栏 40% — 白色卡片 + Tab 切换登录/注册（#1F6BFF 蓝色主色）
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, User, Lock, Eye, EyeOff, CheckSquare, Square,
  ArrowRight, Mail, KeyRound, CheckCircle, TrendingUp,
  Database, Store,
} from 'lucide-react';
import { useAuth } from '../App';
import { serverLogin, serverRegister, sendEmailCode } from '../../api/authApi';

type AuthTab = 'login' | 'register';

const CAROUSEL_ITEMS = [
  { icon: Database, text: '今日已处理 2,847 单' },
  { icon: TrendingUp, text: '追踪利润 ¥12.5 万' },
  { icon: Store, text: '覆盖 3 家店铺' },
];

const FEATURES = [
  { title: '精准利润计算', desc: '自动聚合订单/推广/售后数据，成本费用一目了然' },
  { title: '全链路可追溯', desc: '每笔利润追溯到订单明细，路径可查、可追溯' },
  { title: '数据安全可靠', desc: '香港服务器 + Cloudflare 加密，数据安全有保障' },
];

// ──── 登录表单 ────
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('dianfx_remember_username'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('dianfx_remember_username');
    if (saved) setUsername(saved);
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await serverLogin(username, password);
      if (result.success && result.user) {
        setUser(result.user);
        if (rememberMe) localStorage.setItem('dianfx_remember_username', username);
        else localStorage.removeItem('dianfx_remember_username');
        onSuccess();
        return;
      }
      setError(result.message || '登录失败');
    } catch { setError('网络连接失败，请检查后重试'); }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLogin(); };

  const inputDark =
    'flex items-center border border-[hsla(0,0%,100%,0.08)] ' +
    'rounded-lg px-4 h-12 focus-within:border-pdd-primary ' +
    'focus-within:shadow-[0_0_0_3px_rgba(31,107,255,0.1)] transition-all bg-pdd-gray-50';

  return (
    <div className="space-y-4">
      <div className={`${inputDark} group`}>
        <User size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0 group-focus-within:text-pdd-primary transition-colors" />
        <input type="text" placeholder="请输入用户名" value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          className="w-full outline-none text-sm text-pdd-text bg-transparent placeholder-pdd-gray-400" />
      </div>
      <div className={`${inputDark} group`}>
        <Lock size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0 group-focus-within:text-pdd-primary transition-colors" />
        <input type={showPwd ? 'text' : 'password'} placeholder="请输入密码" value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          className="w-full outline-none text-sm text-pdd-text bg-transparent placeholder-pdd-gray-400" />
        <button onClick={() => setShowPwd(!showPwd)} className="ml-2 text-pdd-gray-400 hover:text-pdd-text-secondary flex-shrink-0 transition-colors">
          {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => setRememberMe(!rememberMe)}
          className="flex items-center gap-2 text-sm text-pdd-text-secondary hover:text-pdd-text-secondary transition-colors">
          {rememberMe
            ? <CheckSquare size={16} className="text-pdd-primary" />
            : <Square size={16} className="text-pdd-gray-400" />}
          <span>记住用户名</span>
        </button>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-sm text-pdd-primary bg-pdd-danger/10 py-2 px-3 rounded-lg border border-pdd-danger/20">{error}</motion.p>
        )}
      </AnimatePresence>
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full h-12 rounded-lg bg-pdd-primary text-white font-semibold text-[15px] tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-pdd-primary-dark shadow-sm"
      >
        {loading ? '登录中...' : '登录'} {!loading && <ArrowRight size={16} />}
      </button>
    </div>
  );
}

// ──── 注册表单 ────
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [success, setSuccess] = useState(false);
  const { setUser } = useAuth();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email || sending || countdown > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('请输入有效的邮箱地址'); return; }
    setSending(true);
    const result = await sendEmailCode(email);
    setSending(false);
    if (result.success) setCountdown(60);
    else setError(result.message);
  };

  const handleRegister = async () => {
    setError('');
    if (!agreed) { setError('请先阅读并同意服务条款和隐私政策'); return; }
    if (!inviteCode.trim()) { setError('请输入邀请码'); return; }
    if (!username.trim() || username.trim().length < 3) { setError('用户名至少3个字符'); return; }
    if (!password.trim() || password.trim().length < 6) { setError('密码至少6个字符'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); return; }

    setLoading(true);
    try {
      const result = await serverRegister(username.trim(), password.trim(), inviteCode.trim(), email.trim() || undefined, smsCode.trim() || undefined);
      if (result.success) {
        if (result.user) setUser(result.user);
        setSuccess(true);
        setTimeout(() => onSuccess(), 1500);
        return;
      }
      setError(result.message || '注册失败');
    } catch { setError('网络连接失败，请检查后重试'); }
    setLoading(false);
  };

  if (success) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pdd-success/10 mb-4 border border-pdd-success/20">
            <CheckCircle size={48} className="text-pdd-success" />
          </div>
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-2">注册成功</h2>
        <p className="text-sm text-pdd-text-secondary">正在跳转到店铺管理...</p>
      </motion.div>
    );
  }

  const inputDark =
    'flex items-center border border-[hsla(0,0%,100%,0.08)] ' +
    'rounded-lg px-4 h-12 focus-within:border-pdd-primary ' +
    'focus-within:shadow-[0_0_0_3px_rgba(31,107,255,0.1)] transition-all bg-pdd-gray-50';
  const fieldCls = 'w-full outline-none text-sm text-pdd-text bg-transparent placeholder-pdd-gray-400';

  const calcStrength = (pwd: string): { level: 'none' | 'weak' | 'medium' | 'strong'; score: number } => {
    if (!pwd) return { level: 'none', score: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 20;
    if (pwd.length >= 12) score += 20;
    if (/[0-9]/.test(pwd)) score += 20;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 20;
    if (score < 40) return { level: 'weak', score };
    if (score < 80) return { level: 'medium', score };
    return { level: 'strong', score };
  };

  const strength = calcStrength(password);
  const pwdMatch: boolean | null = confirmPwd ? password === confirmPwd : null;

  return (
    <div className="space-y-4">
      <div className={`${inputDark} group`}>
        <KeyRound size={18} className="text-pdd-primary mr-3 flex-shrink-0" />
        <input type="text" placeholder="请输入邀请码" value={inviteCode}
          onChange={e => { setInviteCode(e.target.value); setError(''); }}
          className={`${fieldCls} placeholder-pdd-gray-400`} />
      </div>
      <div className={`${inputDark} group`}>
        <User size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0 group-focus-within:text-pdd-primary transition-colors" />
        <input type="text" placeholder="请输入用户名（至少3个字符）" value={username}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          className={fieldCls} />
        {username && (
          <span className={`ml-2 text-xs flex-shrink-0 ${username.length >= 3 ? 'text-pdd-success' : 'text-pdd-primary'}`}>
            {username.length >= 3 ? '✓' : '✗'}
          </span>
        )}
      </div>
      <div className={`${inputDark} group`}>
        <Lock size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0 group-focus-within:text-pdd-primary transition-colors" />
        <input type={showPwd ? 'text' : 'password'} placeholder="设置密码（至少6个字符）" value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          className={fieldCls} />
        <button onClick={() => setShowPwd(!showPwd)} className="ml-2 text-pdd-gray-400 hover:text-pdd-text-secondary flex-shrink-0 transition-colors">
          {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {password && (
        <div className="space-y-1">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: strength.level === 'weak' ? '30%' : strength.level === 'medium' ? '65%' : '100%',
                backgroundColor: strength.level === 'weak' ? 'var(--pdd-danger)' : strength.level === 'medium' ? 'var(--pdd-warning)' : 'var(--pdd-success)',
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="h-full rounded-full"
            />
          </div>
          <p className="text-xs" style={{
            color: strength.level === 'weak' ? 'var(--pdd-danger)' : strength.level === 'medium' ? 'var(--pdd-warning)' : 'var(--pdd-success)'
          }}>
            强度：{strength.level === 'weak' ? '弱' : strength.level === 'medium' ? '中等' : '强'}
          </p>
        </div>
      )}
      <div className={`${inputDark} group`}>
        <Lock size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0 group-focus-within:text-pdd-primary transition-colors" />
        <input type={showConfirm ? 'text' : 'password'} placeholder="请再次输入密码" value={confirmPwd}
          onChange={e => { setConfirmPwd(e.target.value); setError(''); }}
          className={fieldCls} />
        <button onClick={() => setShowConfirm(!showConfirm)} className="ml-2 text-pdd-gray-400 hover:text-pdd-text-secondary flex-shrink-0 transition-colors">
          {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {pwdMatch !== null && (
        <p className={`text-xs ${pwdMatch ? 'text-pdd-success' : 'text-pdd-primary'}`}>
          {pwdMatch ? '✓ 密码一致' : '✗ 密码不一致'}
        </p>
      )}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-xs text-pdd-gray-400">选填信息</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>
      <div className={`${inputDark} group`}>
        <Mail size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0 group-focus-within:text-pdd-primary transition-colors" />
        <input type="email" placeholder="请输入邮箱地址" value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          className={fieldCls} />
        <button onClick={handleSendCode} disabled={sending || countdown > 0 || !email}
          className="ml-2 flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium bg-pdd-primary/10 text-pdd-primary hover:bg-pdd-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {sending ? '发送中...' : countdown > 0 ? `${countdown}秒` : '发送验证码'}
        </button>
      </div>
      <AnimatePresence>
        {email && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`${inputDark} group`}>
            <CheckCircle size={18} className="text-pdd-gray-400 mr-3 flex-shrink-0" />
            <input type="text" placeholder="请输入6位验证码" value={smsCode}
              onChange={e => { setSmsCode(e.target.value); setError(''); }} maxLength={6}
              className={fieldCls} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-sm text-pdd-primary bg-pdd-danger/10 py-2 px-3 rounded-lg border border-pdd-danger/20">{error}</motion.p>
        )}
      </AnimatePresence>
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-pdd-primary cursor-pointer border-white/20" />
        <span className="text-xs text-pdd-text-secondary">
          我已阅读并同意
          <a href="/?v=3#/terms" target="_blank" className="text-pdd-primary hover:underline mx-0.5">《服务条款》</a>
          和
          <a href="/?v=3#/privacy" target="_blank" className="text-pdd-primary hover:underline mx-0.5">《隐私政策》</a>
        </span>
      </div>
      <button
        onClick={handleRegister}
        disabled={loading || !agreed}
        className="w-full h-12 rounded-lg bg-pdd-primary text-white font-semibold text-[15px] tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-pdd-primary-dark shadow-sm"
      >
        {loading ? '注册中...' : '注册'} {!loading && <ArrowRight size={16} />}
      </button>
    </div>
  );
}

// ──── 数据轮播 ────
function DataCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % CAROUSEL_ITEMS.length), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-pdd-gray-50 border border-pdd-border rounded-xl px-5 py-4">
      <AnimatePresence mode="wait">
        <motion.div key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3">
          {React.createElement(CAROUSEL_ITEMS[index].icon, { size: 20, className: 'text-pdd-success flex-shrink-0' })}
          <span className="text-sm font-semibold text-pdd-text">{CAROUSEL_ITEMS[index].text}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ──── 主页面 ────
export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>(() => {
    return window.location.hash.includes('register') ? 'register' : 'login';
  });

  const handleSuccess = () => navigate('/stores');

  return (
    <div className="min-h-screen flex bg-pdd-bg overflow-hidden">
      {/* 左栏 — 品牌价值展示 (60%) */}
      <div className="hidden lg:flex lg:w-[60%] flex-col justify-center px-16 lg:px-20 xl:px-28 relative">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#1F6BFF 1px, transparent 1px), linear-gradient(90deg, #1F6BFF 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 mb-12"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark flex items-center justify-center shadow-md shadow-pdd-primary/20">
              <Activity size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-[28px] font-extrabold text-pdd-text tracking-[1px]">店分析</h1>
              <p className="text-sm text-pdd-text-secondary font-medium">拼多多商家智能数据分析平台</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12"
          >
            <p className="text-[32px] font-bold text-pdd-text leading-[1.3]">每一单赚多少钱，</p>
            <p className="text-[32px] font-bold mb-3">
              <span className="bg-gradient-to-r from-pdd-primary to-pdd-primary-light bg-clip-text text-transparent">一清二楚</span>
            </p>
            <p className="text-base text-pdd-text-secondary leading-relaxed max-w-sm">
              路径可查、可追溯——让每一笔利润都有据可查，让人百分百信任。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            <DataCarousel />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-pdd-primary text-sm font-semibold mt-0.5 flex-shrink-0">✓</span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-[13px] text-pdd-text-secondary">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 text-center"
          >
            <p className="text-[13px] text-pdd-gray-400">— 已有 <span className="font-semibold text-pdd-text-secondary">1,284</span> 位商家在使用 —</p>
          </motion.div>
        </div>
      </div>

      {/* 右栏 — 表单 (40%) */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-6 lg:p-10 relative">

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] rounded-2xl relative z-10 border border-pdd-border p-8 lg:p-10"
          
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pdd-primary to-pdd-primary-dark flex items-center justify-center shadow-sm">
              <Activity size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-wide">店分析</span>
          </div>

          <div className="flex mb-8 bg-pdd-gray-50 rounded-lg p-1">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                tab === 'login'
                  ? 'bg-pdd-primary/10 text-pdd-primary shadow-sm'
                  : 'text-pdd-text-secondary hover:text-pdd-text-secondary'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                tab === 'register'
                  ? 'bg-pdd-primary/10 text-pdd-primary shadow-sm'
                  : 'text-pdd-text-secondary hover:text-pdd-text-secondary'
              }`}
            >
              注册
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, x: tab === 'login' ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'login' ? 8 : -8 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'login' ? <LoginForm onSuccess={handleSuccess} /> : <RegisterForm onSuccess={handleSuccess} />}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 text-center">
            <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
              className="text-sm text-pdd-text-secondary hover:text-pdd-primary transition-colors">
              {tab === 'login' ? '还没有账号？立即注册 →' : '已有账号？返回登录 →'}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-pdd-gray-400">
            <a href="/?v=3#/terms" target="_blank" className="hover:text-pdd-primary transition-colors">服务条款</a>
            <span>|</span>
            <a href="/?v=3#/privacy" target="_blank" className="hover:text-pdd-primary transition-colors">隐私政策</a>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-pdd-gray-400">
        店分析 Pro Analytics &copy; 2026
      </div>
    </div>
  );
}