import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users as UsersIcon, Crown, Key, Activity,
  FileText, Settings, LogOut, Menu, ChevronRight, ChevronLeft,
  Sun, Moon, CreditCard, Eye, Wrench
} from 'lucide-react';
import { useAuth } from '../App';

const ADMIN_NAV = [
  { path: '/', label: '系统概览', icon: BarChart3 },
  { path: '/shadow', label: '影子访问', icon: Eye },
  { path: '/recharge', label: '充值审核', icon: CreditCard },
  { path: '/users', label: '用户管理', icon: UsersIcon },
  { path: '/members', label: '会员管理', icon: Crown },
  { path: '/invite', label: '邀请码', icon: Key },
  { path: '/data', label: '数据监控', icon: Activity },
  { path: '/logs', label: '操作日志', icon: FileText },
  { path: '/settings', label: '系统设置', icon: Settings },
  { path: '/config', label: '全局配置', icon: Wrench },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('dianfx_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.remove('light');
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      html.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('dianfx_dark_mode', String(next));
  };

  return (
    <div id="admin-root" className="flex h-screen overflow-hidden bg-pdd-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
      )}

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        className={`fixed lg:relative z-50 flex-shrink-0 flex flex-col overflow-hidden border-r border-pdd-border h-full
          ${mobileOpen ? 'left-0' : '-left-full lg:left-0'}`}
        style={{ background: 'linear-gradient(180deg, var(--pdd-sidebar) 0%, var(--pdd-bg) 100%)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-3 border-b border-pdd-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
              <Activity size={16} className="text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-pdd-text font-semibold text-sm whitespace-nowrap">后台管理</span>
                <span className="text-amber-400 text-[10px] font-medium">ADMIN PANEL</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1.5 text-pdd-text-secondary hover:text-pdd-text rounded-lg hover:bg-pdd-card transition-all"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-1.5">
            {!collapsed && <div className="text-[10px] text-amber-400 uppercase tracking-widest mb-1 font-semibold px-1">管理菜单</div>}
          </div>
          {ADMIN_NAV.map(item => (
            <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
              {({ isActive }) => (
                <div className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200 mb-0.5 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-card'
                }`}>
                  <item.icon size={18} className={`flex-shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
                  {!collapsed && <span className="text-sm whitespace-nowrap font-medium">{item.label}</span>}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-pdd-border p-3 space-y-2">
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-card transition-all">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span className="text-sm">{darkMode ? '亮色模式' : '暗色模式'}</span>}
          </button>
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 transition-all">
            <LogOut size={16} />
            {!collapsed && <span className="text-sm">退出登录</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-pdd-border flex items-center px-4 gap-3 flex-shrink-0" style={{ background: 'rgba(26, 29, 46, 0.8)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-pdd-text-secondary">
            <Menu size={18} />
          </button>
          <span className="text-sm text-pdd-text-secondary">欢迎，<span className="text-pdd-text font-medium">{user?.username}</span></span>
          <div className="flex-1" />
          <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            {user?.role === 'admin' ? '管理员' : '测试账号'}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-pdd-bg">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
