import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, Shield, Key, AlertTriangle, Wifi } from 'lucide-react';
import { useAuth } from '../App';
import { serverLogin } from '../../api/authApi';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Check lockout from localStorage
  useEffect(() => {
    const locked = localStorage.getItem('admin_locked_until');
    const storedAttempts = localStorage.getItem('admin_login_attempts');
    if (locked && Date.now() < parseInt(locked)) {
      setLockedUntil(parseInt(locked));
    }
    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts));
    }
  }, []);

  // Countdown timer
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (lockedUntil <= 0) return;
    const iv = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(0);
        localStorage.removeItem('admin_locked_until');
        localStorage.removeItem('admin_login_attempts');
        setAttempts(0);
        clearInterval(iv);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  const handleLogin = async () => {
    if (lockedUntil > 0) return;
    if (!username.trim() || !password.trim()) {
      setError('请输入管理员账号和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await serverLogin(username, password);
      if (result.success && result.user) {
        // Verify admin role
        if (result.user.role !== 'admin' && result.user.role !== 'test') {
          setError('此账号无权访问后台管理');
          setLoading(false);
          return;
        }

        // Clear lockout on success
        localStorage.removeItem('admin_locked_until');
        localStorage.removeItem('admin_login_attempts');

        setUser(result.user);
        localStorage.setItem('dianfx_user', JSON.stringify(result.user));
        navigate('/');
        return;
      }

      // Failed login
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('admin_login_attempts', String(newAttempts));

      if (newAttempts >= 5) {
        const lockMinutes = Math.min(Math.pow(2, newAttempts - 5), 60); // Exponential backoff: 1,2,4,8,16,32,60 min
        const lockUntil = Date.now() + lockMinutes * 60 * 1000;
        setLockedUntil(lockUntil);
        localStorage.setItem('admin_locked_until', String(lockUntil));
        setError(`登录尝试次数过多，账户已锁定 ${lockMinutes} 分钟`);
      } else {
        setError(result.message || '账号或密码错误');
      }
    } catch {
      setError('服务连接失败，请检查网络');
    }
    setLoading(false);
  };

  const isLocked = lockedUntil > 0;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--pdd-bg)' }}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full bg-pdd-primary/5 blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pdd-primary/4 blur-[120px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-pdd-primary/3 blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(31,107,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(31,107,255,0.3) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-[440px] p-10 rounded-2xl relative z-10 shadow-xl"
        style={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)' }}
      >
        {/* Header strip */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-pdd-primary" />

        {/* Logo icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
            style={{ background: 'var(--pdd-gray-100)', border: '1px solid var(--pdd-border)' }}>
            <Shield size={36} style={{ color: 'var(--pdd-primary)' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--pdd-text)' }}>运营中台</h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--pdd-text-secondary)' }}>
            企业级运营管理控制台
          </p>
        </motion.div>

        {/* Session info bar */}
        <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-lg text-xs"
          style={{ background: 'var(--pdd-gray-100)', border: '1px solid var(--pdd-border)' }}>
          <Wifi size={12} style={{ color: 'var(--pdd-primary)' }} />
          <span style={{ color: 'var(--pdd-text-secondary)' }}>安全连接 · 所有操作将被记录</span>
        </div>

        {/* Form */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="space-y-4">
          {/* Username */}
          <div className="flex items-center rounded-lg px-4 py-3 transition-all duration-200"
            style={{ background: 'var(--pdd-gray-50)', border: '1px solid var(--pdd-border)' }}>
            <User size={18} className="mr-3 flex-shrink-0" style={{ color: 'var(--pdd-gray-400)' }} />
            <input
              type="text"
              placeholder="管理员账号"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              disabled={isLocked}
              autoFocus
              className="w-full outline-none text-sm bg-transparent"
              style={{ color: 'var(--pdd-text)' }}
            />
          </div>

          {/* Password */}
          <div className="flex items-center rounded-lg px-4 py-3 transition-all duration-200"
            style={{ background: 'var(--pdd-gray-50)', border: '1px solid var(--pdd-border)' }}>
            <Key size={18} className="mr-3 flex-shrink-0" style={{ color: 'var(--pdd-gray-400)' }} />
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder="管理员密码"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              disabled={isLocked}
              className="w-full outline-none text-sm bg-transparent"
              style={{ color: 'var(--pdd-text)' }}
            />
            <button
              onClick={() => setShowPwd(!showPwd)}
              className="ml-2 p-1 rounded hover:bg-pdd-gray-100 transition-colors"
              style={{ color: 'var(--pdd-gray-400)' }}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--pdd-danger)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--pdd-danger)' }}
            >
              <AlertTriangle size={14} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Lockout countdown */}
          {isLocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-3 rounded-lg text-sm"
              style={{ background: 'var(--pdd-danger)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--pdd-danger)' }}
            >
              <Lock size={14} className="inline mr-1.5" />
              已锁定 · {Math.floor(countdown / 60)}分{countdown % 60}秒后可重试
            </motion.div>
          )}

          {/* Attempts warning */}
          {!isLocked && attempts >= 3 && (
            <div className="text-xs text-center" style={{ color: 'var(--pdd-warning)' }}>
              <AlertTriangle size={10} className="inline mr-1" />
              已失败 {attempts} 次，5次后将锁定账户
            </div>
          )}

          {/* Login button */}
          <motion.button
            whileHover={loading || isLocked ? {} : { scale: 1.02 }}
            whileTap={loading || isLocked ? {} : { scale: 0.98 }}
            onClick={handleLogin}
            disabled={loading || isLocked}
            className="w-full py-3.5 rounded-lg text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isLocked ? 'var(--pdd-gray-400)' : 'var(--pdd-primary)',
              boxShadow: isLocked ? 'none' : '0 4px 16px rgba(31,107,255,0.25)',
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                验证中...
              </span>
            ) : isLocked ? (
              <><Lock size={15} /> 账户已锁定</>
            ) : (
              <><Shield size={15} /> 管理员登录</>
            )}
          </motion.button>

          {/* Footer hint */}
          <p className="text-center text-xs pt-2" style={{ color: 'var(--pdd-gray-400)' }}>
            仅限授权管理员访问 · 登录操作将被审计记录
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
