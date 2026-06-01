import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, User, Lock, Eye, EyeOff, Phone, CheckCircle, KeyRound, Activity, ArrowRight } from 'lucide-react';
import { useAuth } from '../App';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleRegister = () => {
    setError('');
    if (!inviteCode.trim()) { setError('请输入邀请码'); return; }
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (username.trim().length < 3) { setError('用户名至少3个字符'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }
    if (password.trim().length < 6) { setError('密码至少6个字符'); return; }
    if (password !== confirmPwd) { setError('两次密码不一致'); return; }
    const result = signup(username.trim(), password.trim(), phone.trim(), inviteCode.trim());
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/stores'), 1500);
    } else {
      setError(result.message);
    }
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
            <Phone size={18} className={iconClass} />
            <input type="tel" placeholder="请输入手机号（可选）" value={phone}
              onChange={e => { setPhone(e.target.value); setError(''); }}
              className={inputFieldClass} />
          </div>

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

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRegister}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pdd-primary-dark to-pdd-primary text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            注册 <ArrowRight size={16} />
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
