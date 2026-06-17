import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Eye, EyeOff, Activity, ArrowRight, ShieldAlert, Clock } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from '../components/ui/toast';
import { useAuth } from '../App';
import { serverLogin } from '../../api/authApi';

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // --- ⭐ 权益1: 登录失败保护 + 临时锁定 ---
  useEffect(() => {
    const savedUsername = localStorage.getItem('dianfx_remember_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }

    // Check lockout state
    const lockedUntil = localStorage.getItem('dianfx_login_locked_until');
    if (lockedUntil) {
      const remaining = parseInt(lockedUntil, 10) - Date.now();
      if (remaining > 0) {
        setLocked(true);
        setLockCountdown(Math.ceil(remaining / 1000));
      } else {
        localStorage.removeItem('dianfx_login_locked_until');
        localStorage.removeItem('dianfx_login_attempts');
      }
    }

    // Load last login info
    const last = localStorage.getItem('dianfx_last_login');
    if (last) setLastLogin(last);
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!locked || lockCountdown <= 0) return;
    const timer = setInterval(() => {
      setLockCountdown(prev => {
        if (prev <= 1) {
          setLocked(false);
          localStorage.removeItem('dianfx_login_locked_until');
          localStorage.removeItem('dianfx_login_attempts');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [locked, lockCountdown]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}分${s}秒`;
  };

  // --- ⭐ 权益2: 记住密码 + 上次登录信息 ---
  const recordLastLogin = () => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    localStorage.setItem('dianfx_last_login', formatted);
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      toast.error('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const serverResult = await serverLogin(username, password);
      if (serverResult.success) {
        if (serverResult.user) setUser(serverResult.user);
        if (rememberMe) localStorage.setItem('dianfx_remember_username', username);
        else localStorage.removeItem('dianfx_remember_username');
        // Clear failed attempts on success
        localStorage.removeItem('dianfx_login_attempts');
        localStorage.removeItem('dianfx_login_locked_until');
        // Record last login
        recordLastLogin();
        toast.success('登录成功，欢迎回来！');
        navigate('/stores');
        return;
      }

      // --- 失败计数 ---
      const attempts = parseInt(localStorage.getItem('dianfx_login_attempts') || '0', 10) + 1;
      localStorage.setItem('dianfx_login_attempts', String(attempts));
      const remaining = LOCKOUT_ATTEMPTS - attempts;

      if (remaining <= 0) {
        // Lock the account
        const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem('dianfx_login_locked_until', String(lockUntil));
        setLocked(true);
        setLockCountdown(LOCKOUT_DURATION_MS / 1000);
        const msg = `登录失败次数过多，账号已锁定 ${formatCountdown(LOCKOUT_DURATION_MS / 1000)}`;
        setError(msg);
        toast.error(msg);
      } else {
        const msg = `${serverResult.message || '登录失败，请检查用户名和密码'}（还剩 ${remaining} 次尝试机会）`;
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = '网络连接失败，请检查后重试';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !locked) handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-pdd-bg">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pdd-primary/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pdd-primary-dark/8 blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-pdd-info/5 blur-[80px]" />
        {/* 浮动光效 */}
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[15%] left-[10%] w-[300px] h-[300px] rounded-full bg-pdd-primary/5 blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, -30, 40, 0], y: [0, 30, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[20%] right-[10%] w-[350px] h-[350px] rounded-full bg-purple-500/5 blur-[120px]"
        />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--pdd-primary) 1px, transparent 1px), linear-gradient(90deg, var(--pdd-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Locked overlay */}
      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-20 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

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
              className="text-center mb-8"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark mb-4 shadow-xl shadow-pdd-primary/20">
                <Activity size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-wide">店分析</h1>
              <p className="text-sm text-pdd-text-secondary mt-1">拼多多商家智能数据分析平台</p>
            </motion.div>

            {/* Form */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="space-y-4" onKeyDown={handleKeyDown}>

              {/* Username */}
              <div className="group flex items-center border border-pdd-border rounded-xl px-4 py-2 focus-within:border-pdd-primary focus-within:shadow-lg focus-within:shadow-pdd-primary/10 transition-all bg-pdd-bg/50">
                <User size={18} className="text-pdd-text-secondary mr-3 group-focus-within:text-pdd-primary-light transition-colors shrink-0" />
                <Input
                  type="text" placeholder="请输入用户名" value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  disabled={locked}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
              </div>

              {/* Password */}
              <div className="group flex items-center border border-pdd-border rounded-xl px-4 py-2 focus-within:border-pdd-primary focus-within:shadow-lg focus-within:shadow-pdd-primary/10 transition-all bg-pdd-bg/50">
                <Lock size={18} className="text-pdd-text-secondary mr-3 group-focus-within:text-pdd-primary-light transition-colors shrink-0" />
                <Input
                  type={showPwd ? 'text' : 'password'} placeholder="请输入密码" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  disabled={locked}
                  className="border-0 bg-transparent text-white placeholder:text-pdd-text-secondary focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 px-0"
                />
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  disabled={locked}
                  className="ml-2 text-pdd-text-secondary hover:text-pdd-primary-light transition-colors shrink-0"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={locked}
                  className="border-pdd-text-secondary data-[state=checked]:bg-pdd-primary data-[state=checked]:border-pdd-primary"
                />
                <Label htmlFor="remember-me" className="text-sm text-pdd-text-secondary cursor-pointer">
                  记住用户名
                </Label>
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-pdd-danger text-sm bg-pdd-danger/10 py-2 px-3 rounded-lg border border-pdd-danger/20"
                  >
                    <ShieldAlert size={14} className="shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lock countdown */}
              <AnimatePresence>
                {locked && lockCountdown > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2 text-pdd-warning text-sm bg-pdd-warning/10 py-2 px-3 rounded-lg border border-pdd-warning/20"
                  >
                    <Clock size={14} />
                    <span>账号已锁定，剩余 {formatCountdown(lockCountdown)}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login button */}
              <Button
                onClick={handleLogin}
                disabled={loading || locked}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-pdd-primary-dark via-pdd-primary to-purple-500 text-white font-medium text-sm hover:from-pdd-primary hover:via-purple-500 hover:to-pink-500 disabled:opacity-60 shadow-lg shadow-pdd-primary/30 hover:shadow-purple-500/20 transition-all duration-500 relative overflow-hidden"
              >
                {!loading && !locked && (
                  <span className="absolute inset-0 bg-white/10 translate-y-full hover:translate-y-0 transition-transform duration-500" />
                )}
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    登录
                    <ArrowRight size={16} />
                  </span>
                )}
              </Button>

              {/* Last login info */}
              {lastLogin && !locked && (
                <p className="text-center text-[11px] text-pdd-text-secondary/60">
                  上次登录：{lastLogin}
                </p>
              )}

              {/* Footer links */}
              <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-pdd-text-secondary">
                <a href="/?v=3#/terms" target="_blank" rel="noopener noreferrer" className="hover:text-pdd-primary transition-colors">服务条款</a>
                <span className="opacity-30">|</span>
                <a href="/?v=3#/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-pdd-primary transition-colors">隐私政策</a>
              </div>
              <div className="flex items-center justify-center pt-1">
                <Link to="/register">
                  <span className="text-sm text-pdd-text-secondary hover:text-pdd-primary-light cursor-pointer transition-colors">
                    还没有账号？立即注册
                  </span>
                </Link>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-xs">
        <span className="text-pdd-text-secondary">店分析 Pro Analytics &copy; 2026</span>
        <span className="mx-2 text-pdd-border">|</span>
        <span className="text-pdd-primary/60">v3.2 · UI升级版</span>
      </div>
    </div>
  );
}
