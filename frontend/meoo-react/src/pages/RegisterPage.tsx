import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, User, Lock, Eye, EyeOff, Mail, CheckCircle, KeyRound, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from '../components/ui/toast';
import { useAuth } from '../App';
import { serverRegister, sendEmailCode } from '../../api/authApi';

const DRAFT_KEY = 'dianfx_register_draft';

// --- ⭐ 权益1: 密码强度检测 ---
function getPasswordStrength(pwd: string): { score: number; label: string; color: string; width: string } {
  if (!pwd) return { score: 0, label: '', color: '', width: '0%' };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
  if (/\d/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

  if (score <= 1) return { score, label: '弱', color: 'bg-pdd-danger', width: '25%' };
  if (score === 2) return { score, label: '中', color: 'bg-pdd-warning', width: '50%' };
  if (score <= 3) return { score, label: '强', color: 'bg-pdd-primary', width: '75%' };
  return { score, label: '很强', color: 'bg-pdd-success', width: '100%' };
}

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
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPwd === '' || password === confirmPwd;

  // --- ⭐ 权益2: 表单草稿持久化 ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        setInviteCode(draft.inviteCode || '');
        setUsername(draft.username || '');
        setEmail(draft.email || '');
        setAgreed(draft.agreed || false);
      }
    } catch { /* ignore */ }
  }, []);

  const saveDraft = (field: string, value: string | boolean) => {
    try {
      const current = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      current[field] = value;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(current));
    } catch { /* ignore */ }
  };

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  const updateField = (setter: React.Dispatch<React.SetStateAction<string>>, field: string, value: string) => {
    setter(value);
    saveDraft(field, value);
    setError('');
  };

  // 发送邮箱验证码
  const handleSendCode = async () => {
    if (!email || sending || countdown > 0) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      toast.error('请输入有效的邮箱地址');
      return;
    }
    setSending(true);
    try {
      const result = await sendEmailCode(email);
      if (result.success) {
        setCountdown(60);
        toast.success('验证码已发送到邮箱');
      } else {
        setError(result.message || '发送失败');
        toast.error(result.message || '发送失败');
      }
    } catch {
      setError('网络连接失败');
      toast.error('网络连接失败');
    }
    setSending(false);
  };

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRegister = async () => {
    setError('');
    if (!agreed) { setError('请先阅读并同意服务条款和隐私政策'); toast.error('请先同意服务条款和隐私政策'); return; }
    if (!inviteCode.trim()) { setError('请输入邀请码'); toast.error('请输入邀请码'); return; }
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (username.trim().length < 3) { setError('用户名至少3个字符'); toast.error('用户名至少3个字符'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }
    if (password.trim().length < 6) { setError('密码至少6个字符'); toast.error('密码至少6个字符'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); toast.error('两次密码不一致'); return; }

    setLoading(true);

    try {
      const serverResult = await serverRegister(
        username.trim(), password.trim(), inviteCode.trim(),
        email.trim() || undefined, smsCode.trim() || undefined
      );
      if (serverResult.success) {
        if (serverResult.user) setUser(serverResult.user);
        clearDraft(); // Clear draft on success
        setSuccess(true);
        toast.success('注册成功！欢迎加入店分析');
        setTimeout(() => navigate('/stores'), 1500);
        return;
      }
      setError(serverResult.message || '注册失败');
      toast.error(serverResult.message || '注册失败');
    } catch {
      setError('网络连接失败，请检查后重试');
      toast.error('网络连接失败，请检查后重试');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleRegister();
  };

  // ---------- 注册成功界面 ----------
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-pdd-bg">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pdd-success/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pdd-primary/8 blur-[100px]" />
        </div>
        <Card className="w-[420px] border border-pdd-border rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(26, 29, 46, 0.8)', backdropFilter: 'blur(20px)' }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="p-8 text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pdd-success/10 mb-4 border border-pdd-success/20">
              <CheckCircle size={48} className="text-pdd-success" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">注册成功</h2>
            <p className="text-sm text-pdd-text-secondary">正在跳转到店铺管理...</p>
          </motion.div>
        </Card>
      </div>
    );
  }

  const inputWrapperClass = "flex items-center border border-pdd-border rounded-xl px-4 py-1 focus-within:border-pdd-primary focus-within:shadow-lg focus-within:shadow-pdd-primary/10 transition-all bg-pdd-bg/50";

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
        className="w-[420px] relative z-10 group"
      >
        {/* 动态渐变边框 */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-pdd-primary via-purple-500 to-pink-500 opacity-50 group-hover:opacity-80 blur-[2px] transition-all duration-700" />
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-pdd-primary via-purple-500 to-pink-500 opacity-20 animate-pulse blur-[4px]" />
        <Card className="relative border-0 rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(15, 18, 35, 0.92)', backdropFilter: 'blur(24px)' }}
        >
          <CardContent className="p-8">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark mb-4 shadow-xl shadow-pdd-primary/20">
                <UserPlus size={28} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-wide">注册账号</h1>
              <p className="text-sm text-pdd-text-secondary mt-1">创建您的店分析账号</p>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="space-y-3.5" onKeyDown={handleKeyDown}>

              {/* 邀请码 */}
              <div className={inputWrapperClass}>
                <KeyRound size={18} className="text-pdd-primary-light mr-3 shrink-0" />
                <Input
                  type="text" placeholder="请输入邀请码" value={inviteCode}
                  onChange={e => updateField(setInviteCode, 'inviteCode', e.target.value)}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-primary-light/40 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
              </div>

              {/* 用户名 */}
              <div className={inputWrapperClass}>
                <User size={18} className="text-pdd-text-secondary mr-3 shrink-0" />
                <Input
                  type="text" placeholder="请输入用户名（至少3个字符）" value={username}
                  onChange={e => updateField(setUsername, 'username', e.target.value)}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
              </div>

              {/* 邮箱 + 发送验证码 */}
              <div className={inputWrapperClass}>
                <Mail size={18} className="text-pdd-text-secondary mr-3 shrink-0" />
                <Input
                  type="email" placeholder="请输入邮箱地址" value={email}
                  onChange={e => updateField(setEmail, 'email', e.target.value)}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending || countdown > 0 || !email}
                  className="ml-2 shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-pdd-primary/20 text-pdd-primary-light hover:bg-pdd-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {sending ? '发送中...' : countdown > 0 ? `${countdown}秒` : '发送验证码'}
                </button>
              </div>

              {/* 邮箱验证码（有邮箱才显示） */}
              <AnimatePresence>
                {email && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={inputWrapperClass}
                  >
                    <CheckCircle size={18} className="text-pdd-text-secondary mr-3 shrink-0" />
                    <Input
                      type="text" placeholder="请输入邮箱验证码" value={smsCode}
                      onChange={e => { setSmsCode(e.target.value.slice(0, 6)); setError(''); }}
                      maxLength={6}
                      className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 密码 */}
              <div className={inputWrapperClass}>
                <Lock size={18} className="text-pdd-text-secondary mr-3 shrink-0" />
                <Input
                  type={showPwd ? 'text' : 'password'} placeholder="请输入密码（至少6个字符）" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); saveDraft('password', '***'); }}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
                <button onClick={() => setShowPwd(!showPwd)} className="ml-2 shrink-0 text-pdd-text-secondary hover:text-pdd-primary-light transition-colors" tabIndex={-1}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* 密码强度指示器 */}
              <AnimatePresence>
                {password.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-1"
                  >
                    <div className="flex-1 h-1.5 rounded-full bg-pdd-bg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: passwordStrength.width }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${passwordStrength.color} transition-colors`}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score <= 1 ? 'text-pdd-danger' :
                      passwordStrength.score === 2 ? 'text-pdd-warning' :
                      passwordStrength.score <= 3 ? 'text-pdd-primary' :
                      'text-pdd-success'
                    }`}>
                      {passwordStrength.label && (
                        <span className="flex items-center gap-1">
                          <Shield size={12} />
                          {passwordStrength.label}
                        </span>
                      )}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 确认密码 */}
              <div className={inputWrapperClass}>
                <Lock size={18} className={`mr-3 shrink-0 ${passwordsMatch ? 'text-pdd-text-secondary' : 'text-pdd-danger'}`} />
                <Input
                  type={showConfirm ? 'text' : 'password'} placeholder="请再次输入密码" value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); setError(''); }}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
                <button onClick={() => setShowConfirm(!showConfirm)} className="ml-2 shrink-0 text-pdd-text-secondary hover:text-pdd-primary-light transition-colors" tabIndex={-1}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* 确认密码不匹配提示 */}
              <AnimatePresence>
                {confirmPwd.length > 0 && !passwordsMatch && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-pdd-danger text-xs px-1"
                  >
                    <AlertCircle size={12} />
                    <span>两次密码不一致</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 错误消息 */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-pdd-danger text-sm bg-pdd-danger/10 py-2 px-3 rounded-lg border border-pdd-danger/20"
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 法律协议勾选 */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="agree-terms"
                  checked={agreed}
                  onCheckedChange={(checked) => {
                    setAgreed(checked === true);
                    saveDraft('agreed', checked === true);
                  }}
                  className="mt-0.5 border-pdd-text-secondary data-[state=checked]:bg-pdd-primary data-[state=checked]:border-pdd-primary"
                />
                <Label htmlFor="agree-terms" className="text-xs text-pdd-text-secondary leading-relaxed cursor-pointer">
                  我已阅读并同意
                  <a href="/?v=3#/terms" target="_blank" rel="noopener noreferrer" className="text-pdd-primary hover:underline mx-0.5">《服务条款》</a>
                  和
                  <a href="/?v=3#/privacy" target="_blank" rel="noopener noreferrer" className="text-pdd-primary hover:underline mx-0.5">《隐私政策》</a>
                  ，承诺不上传含个人隐私信息的数据
                </Label>
              </div>

              {/* 注册按钮 */}
              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-pdd-primary-dark to-pdd-primary text-white font-medium text-sm hover:from-pdd-primary hover:to-pdd-primary-light disabled:opacity-60 shadow-lg shadow-pdd-primary/20"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    注册中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    注册
                    <ArrowRight size={16} />
                  </span>
                )}
              </Button>

              {/* 返回登录 */}
              <div className="flex items-center justify-center pt-1">
                <Link to="/login">
                  <span className="text-sm text-pdd-text-secondary hover:text-pdd-primary-light cursor-pointer transition-colors">
                    已有账号？返回登录
                  </span>
                </Link>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
