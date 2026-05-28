import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, CheckSquare, Square, Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '../App';
import { serverLogin } from '../api/authApi';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem('dianfx_remember_username');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');

    // 优先尝试服务端登录
    try {
      const serverResult = await serverLogin(username, password);
      if (serverResult.success) {
        if (serverResult.user) {
          setUser(serverResult.user);
          // 同步写入 localStorage，确保页面跳转前用户状态已持久化
          localStorage.setItem('dianfx_user', JSON.stringify(serverResult.user));
        }
        if (rememberMe) localStorage.setItem('dianfx_remember_username', username);
        else localStorage.removeItem('dianfx_remember_username');
        window.location.href = '/#/stores';
        return;
      }
      // 服务端返回错误（非网络错误），直接显示
      if (serverResult.message && serverResult.message !== '登录失败') {
        setError(serverResult.message);
        setLoading(false);
        return;
      }
    } catch {
      // 服务端不可达，降级到本地登录
    }

    // 降级：本地 localStorage 登录
    if (login(username, password)) {
      if (rememberMe) localStorage.setItem('dianfx_remember_username', username);
      else localStorage.removeItem('dianfx_remember_username');
      navigate('/stores');
    } else {
      setError('登录失败，请检查用户名和密码');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-pdd-bg">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-pdd-primary/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pdd-primary-dark/8 blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-pdd-info/5 blur-[80px]" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--pdd-primary) 1px, transparent 1px), linear-gradient(90deg, var(--pdd-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-[420px] p-8 rounded-2xl relative z-10 border border-pdd-border"
        style={{ background: 'rgba(26, 29, 46, 0.8)', backdropFilter: 'blur(20px)' }}
      >
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
          <div className="group flex items-center border border-pdd-border rounded-xl px-4 py-3 focus-within:border-pdd-primary focus-within:shadow-lg focus-within:shadow-pdd-primary/10 transition-all bg-pdd-bg/50">
            <User size={18} className="text-pdd-text-secondary mr-3 group-focus-within:text-pdd-primary-light transition-colors" />
            <input
              type="text" placeholder="请输入用户名" value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              className="w-full outline-none text-sm text-white bg-transparent placeholder-pdd-text-secondary"
            />
          </div>
          <div className="group flex items-center border border-pdd-border rounded-xl px-4 py-3 focus-within:border-pdd-primary focus-within:shadow-lg focus-within:shadow-pdd-primary/10 transition-all bg-pdd-bg/50">
            <Lock size={18} className="text-pdd-text-secondary mr-3 group-focus-within:text-pdd-primary-light transition-colors" />
            <input
              type={showPwd ? 'text' : 'password'} placeholder="请输入密码" value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="w-full outline-none text-sm text-white bg-transparent placeholder-pdd-text-secondary"
            />
            <button onClick={() => setShowPwd(!showPwd)} className="ml-2 text-pdd-text-secondary hover:text-pdd-primary-light transition-colors">
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2 text-sm text-pdd-text-secondary hover:text-pdd-text transition-colors"
            >
              {rememberMe ? (
                <CheckSquare size={16} className="text-pdd-primary-light" />
              ) : (
                <Square size={16} />
              )}
              <span>记住用户名</span>
            </button>
          </div>

          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-pdd-danger text-sm text-center bg-pdd-danger/10 py-2 rounded-lg border border-pdd-danger/20">{error}</motion.p>}

          <motion.button
            whileHover={loading ? {} : { scale: 1.02, boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)' }}
            whileTap={loading ? {} : { scale: 0.98 }}
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pdd-primary-dark to-pdd-primary text-white font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? '登录中...' : '登录'} {!loading && <ArrowRight size={16} />}
          </motion.button>

          <div className="flex items-center justify-center pt-2">
            <Link to="/register">
              <motion.span whileHover={{ color: 'var(--pdd-primary-light)' }} className="text-sm text-pdd-text-secondary cursor-pointer transition-colors">
                还没有账号？立即注册
              </motion.span>
            </Link>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-xs text-pdd-text-secondary">
        店分析 Pro Analytics &copy; 2024
      </div>
    </div>
  );
}
