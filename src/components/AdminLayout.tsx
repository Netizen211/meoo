import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, Crown, Database, Bot, Settings, LogOut, ChevronRight, Key, Activity } from 'lucide-react';
import { useAuth } from '../App';

const ADMIN_NAV = [
  { path: '/admin', label: '平台概览', icon: LayoutDashboard },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/members', label: '会员管理', icon: Crown },
  { path: '/admin/invite', label: '邀请码管理', icon: Key },
  { path: '/admin/data', label: '数据监控', icon: Database },
  { path: '/admin/ai', label: 'AI配置', icon: Bot },
  { path: '/admin/settings', label: '系统设置', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-pdd-bg">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-pdd-border" style={{ background: 'linear-gradient(180deg, var(--pdd-gray-900) 0%, var(--pdd-gray-800) 100%)' }}>
        <div className="h-16 flex items-center px-4 border-b border-pdd-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-pdd-primary/20">
            <Activity size={18} />
          </div>
          <span className="text-pdd-text font-semibold ml-3 tracking-wide">管理后台</span>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
          {ADMIN_NAV.map(item => (
            <NavLink key={item.path} to={item.path}>
              {({ isActive }) => (
                <div className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-r from-pdd-primary/20 to-pdd-primary-dark/10 text-pdd-text border border-pdd-primary/20'
                    : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-card'
                }`}>
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-pdd-primary rounded-r-full" />}
                  <item.icon size={18} className={isActive ? 'text-pdd-primary-light' : ''} />
                  <span className="font-medium">{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/dashboard">
          <div className="mx-3 mb-3 py-2.5 rounded-xl text-center text-sm transition-all border border-pdd-border text-pdd-text-secondary hover:text-pdd-text hover:border-pdd-primary/30 hover:bg-pdd-card">
            返回前台
          </div>
        </NavLink>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center px-6 flex-shrink-0 border-b border-pdd-border" style={{ background: 'rgba(var(--pdd-bg-rgb, 15, 17, 23), 0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-pdd-text-secondary">管理员</span>
            <span className="text-sm text-pdd-text font-medium">{user?.username}</span>
          </div>
          <div className="flex-1" />
          <button onClick={logout} className="p-2 text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 rounded-lg transition-all">
            <LogOut size={16} />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
