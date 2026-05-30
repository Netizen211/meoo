import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, User, Lock, Eye, EyeOff, Mail, CheckCircle, KeyRound, Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '../App';
import { serverRegister, sendEmailCode } from '../api/authApi';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { signup, setUser } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  // 发送邮箱验证码
  const handleSendCode = async () => {
    if (!email || sending || countdown > 0) return;
    // 简单校验邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setSending(true);
    const result = await sendEmailCode(email);
    setSending(false);
    if (result.success) {
      setCountdown(60);
    } else {
      setError(result.message);
    }
  };

  // 倒计时
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRegister = async () => {
    setError('');
    if (!agreed) { setError('请先阅读并同意服务条款和隐私政策'); return; }
    if (!inviteCode.trim()) { setError('请输入邀请码'); return; }
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (username.trim().length < 3) { setError('用户名至少3个字符'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }
    if (password.trim().length < 6) { setError('密码至少6个字符'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); return; }

    setLoading(true);

    // 优先尝试服务端注册
    try {
      const serverResult = await serverRegister(username.trim(), password.trim(), inviteCode.trim(), email.trim() || undefined, smsCode.trim() || undefined);
      if (serverResult.success) {
        if (serverResult.user) setUser(serverResult.user);
        setSuccess(true);
        setTimeout(() => navigate('/stores'), 1500);
        return;
      }
      if (serverResult.message && serverResult.message !== '注册失败') {
        setError(serverResult.message);
        setLoading(false);
        return;
      }
    } catch {
      // 服务端不可达，降级到本地注册
    }

    // 降级：本地 localStorage 注册
    const result = signup(username.trim(), password.trim(), email.trim(), inviteCode.trim());
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/stores'), 1500);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-pdd-bg">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pdd-success/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pdd-primary/8 blur-[100px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-[420px] p-8 rounded-2xl border border-pdd-border text-center relative z-10"
          style={{ background: 'rgba(26, 29, 46, 0.8)', backdropFilter: 'blur(20px)' }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pdd-success/10 mb-4 border border-pdd-success/20">
              <CheckCircle size={48} className="text-pdd-success" />
            </div>
          </motion.div>
          <h2 className="text-xl font-bold text-white mb-2">注册成功</h2>
          <p className="text-sm text-pdd-text-secondary">正在跳转到店铺管理...</p>
        </motion.div>
      </div>
    );
  }

  const inputClass = "group flex items-center border border-pdd-border rounded-xl px-4 py-3 focus-within:border-pdd-primary focus-within:shadow-lg focus-within:shadow-pdd-primary/10 transition-all bg-pdd-bg/50";
  const inputFieldClass = "w-full outline-none text-sm text-white bg-transparent placeholder-pdd-text-secondary";
  const iconClass = "text-pdd-text-secondary mr-3 group-focus-within:text-pdd-primary-light transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-pdd-bg">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pdd-primary/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pdd-primary-dark/8 blur-[100px]" />
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--pdd-primary) 1px, transparent 1px), linear-gradient(90deg, var(--pdd-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-[420px] p-8 rounded-2xl relative z-10 border border-pdd-border"
        style={{ background: 'rgba(26, 29, 46, 0.8)', backdropFilter: 'blur(20px)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark mb-4 shadow-xl shadow-pdd-primary/20">
            <UserPlus size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">注册账号</h1>
          <p className="text-sm text-pdd-text-secondary mt-1">创建您的店分析账号</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
          <div className={inputClass}>
            <KeyRound size={18} className="text-pdd-primary-light mr-3" />
            <input type="text" placeholder="请输入邀请码" value={inviteCode}
              onChange={e => { setInviteCode(e.target.value); setError(''); }}
              className={`${inputFieldClass} placeholder-pdd-primary-light/40`} />
          </div>

          <div className={inputClass}>
            <User size={18} className={iconClass} />
            <input type="text" placeholder="请输入用户名（至少3个字符）" value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              className={inputFieldClass} />
          </div>

          <div className={inputClass}>
            <Mail size={18} className={iconClass} />
            <input type="email" placeholder="请输入邮箱地址" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              className={inputFieldClass} />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending || countdown > 0 || !email}
              className="ml-2 flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-pdd-primary/20 text-pdd-primary-light hover:bg-pdd-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? '发送中...' : countdown > 0 ? `${countdown}秒` : '发送验证码'}
            </button>
          </div>

          {email && (
            <div className={inputClass}>
              <CheckCircle size={18} className={iconClass} />
              <input type="text" placeholder="请输入邮箱验证码" value={smsCode}
                onChange={e => { setSmsCode(e.target.value); setError(''); }}
                maxLength={6}
                className={inputFieldClass} />
            </div>
          )}

          <div className={inputClass}>
            <Lock size={18} className={iconClass} />
            <input type={showPwd ? 'text' : 'password'} placeholder="请输入密码（至少6个字符）" value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className={inputFieldClass} />
            <button onClick={() => setShowPwd(!showPwd)} className="ml-2 text-pdd-text-secondary hover:text-pdd-primary-light transition-colors">
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className={inputClass}>
            <Lock size={18} className={iconClass} />
            <input type={showConfirm ? 'text' : 'password'} placeholder="请再次输入密码" value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setError(''); }}
              className={inputFieldClass} />
            <button onClick={() => setShowConfirm(!showConfirm)} className="ml-2 text-pdd-text-secondary hover:text-pdd-primary-light transition-colors">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-pdd-danger text-sm text-center bg-pdd-danger/10 py-2 rounded-lg border border-pdd-danger/20">{error}</motion.p>}

          {/* 法律协议勾选 */}
          <div className="flex items-start gap-2">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-pdd-border accent-pdd-primary cursor-pointer" />
            <span className="text-xs text-pdd-text-secondary">
              我已阅读并同意
              <a href="/terms-of-service.html" target="_blank" className="text-pdd-primary hover:underline mx-0.5">《服务条款》</a>
              和
              <a href="/privacy-policy.html" target="_blank" className="text-pdd-primary hover:underline mx-0.5">《隐私政策》</a>
              ，承诺不上传含个人隐私信息的数据
            </span>
          </div>

          <motion.button
            whileHover={loading ? {} : { scale: 1.02, boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)' }}
            whileTap={loading ? {} : { scale: 0.98 }}
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pdd-primary-dark to-pdd-primary text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? '注册中...' : '注册'} {!loading && <ArrowRight size={16} />}
          </motion.button>

          <div className="flex items-center justify-center pt-2">
            <Link to="/login">
              <motion.span whileHover={{ color: 'var(--pdd-primary-light)' }} className="text-sm text-pdd-text-secondary cursor-pointer transition-colors">
                已有账号？返回登录
              </motion.span>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
