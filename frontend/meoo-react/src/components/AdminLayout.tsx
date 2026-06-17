import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users as UsersIcon, Crown, Activity,
  FileText, Settings, LogOut, Menu, ChevronRight, ChevronLeft,
  CreditCard, Eye, Wrench, Shield, Bell, Search,
  ChevronDown, BarChart3, TrendingUp, DollarSign,
  Upload, Monitor, Database, Key, AlertTriangle, Server,
  MessageSquare, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../App';
import { useAdminBadges } from '../hooks/useAdminData';
import { useDarkMode } from '../hooks/useDarkMode';

const ADMIN_NAV = [
  { section: '运营核心' },
  { path: '/', label: '运营总览', icon: LayoutDashboard, badge: null as string | null },
  { path: '/analytics', label: '用户行为分析', icon: BarChart3, badge: null },
  { path: '/analytics/modules', label: '模块点击排行', icon: TrendingUp, badge: null },
  { path: '/analytics/funnel', label: '用户路径分析', icon: Activity, badge: null },
  { path: '/analytics/pay-conversion', label: '付费转化分析', icon: DollarSign, badge: null },
  { section: '用户中心' },
  { path: '/users', label: '用户管理', icon: UsersIcon, badge: 'totalUsers' },
  { path: '/recharge', label: '充值审核', icon: CreditCard, badge: 'pendingRecharge' },
  { path: '/revenue', label: '会员与营收', icon: Crown, badge: null },
  { path: '/members', label: '会员管理', icon: Shield, badge: null },
  { section: '数据监控' },
  { path: '/data', label: '数据上传监控', icon: Upload, badge: null },
  { path: '/data-quality', label: '数据质量中心', icon: Database, badge: null },
  { path: '/monitoring/ai', label: 'AI调用监控', icon: Monitor, badge: null },
  { path: '/monitoring/upload', label: '上传监控', icon: Upload, badge: null },
  { section: '运营分析' },
  { path: '/invite', label: '邀请码与渠道', icon: Key, badge: null },
  { path: '/risk', label: '风险审计中心', icon: AlertTriangle, badge: null },
  { path: '/system', label: '系统健康中心', icon: Server, badge: null },
  { section: '系统管理' },
  { path: '/protection', label: '安全防护', icon: Shield, badge: null },
  { path: '/sub-accounts', label: '子账号管理', icon: Shield, badge: null },
  { path: '/announcements', label: '系统公告', icon: MessageSquare, badge: null },
  { path: '/logs', label: '操作日志', icon: FileText, badge: null },
  { path: '/settings', label: '系统设置', icon: Settings, badge: null },
  { path: '/config', label: '全局配置', icon: Wrench, badge: null },
  { path: '/reports', label: 'UI设计报告', icon: FileText, badge: null },
  { path: '/shadow', label: '影子访问', icon: Eye, badge: null },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/': '运营总览',
  '/analytics': '用户行为分析',
  '/analytics/modules': '模块点击排行',
  '/analytics/funnel': '用户路径分析',
  '/analytics/pay-conversion': '付费转化分析',
  '/users': '用户管理',
  '/recharge': '充值审核',
  '/revenue': '会员与营收',
  '/members': '会员管理',
  '/data': '数据上传监控',
  '/data-quality': '数据质量中心',
  '/monitoring/ai': 'AI调用监控',
  '/monitoring/upload': '上传监控',
  '/invite': '邀请码与渠道',
  '/risk': '风险审计中心',
  '/system': '系统健康中心',
  '/shadow': '影子访问',
  '/sub-accounts': '子账号管理',
  '/protection': '安全防护',
  '/announcements': '系统公告',
  '/logs': '操作日志',
  '/settings': '系统设置',
  '/config': '全局配置',
  '/reports': 'UI设计报告',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  // ★ 统一暗色模式：使用共享的 useDarkMode hook，与主站共用 dianfx_dark_mode key
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Badge counts (auto-refresh every 60s)
  const { data: badges = { pendingRecharge: 0, totalUsers: 0 } } = useAdminBadges();

  const handleGlobalSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate('/users?search=' + encodeURIComponent(globalSearch.trim()));
      setGlobalSearch('');
    }
  };

  const getBadgeValue = (badgeKey: string | null): number | null => {
    if (!badgeKey) return null;
    const val = (badges as any)[badgeKey];
    return val > 0 ? val : null;
  };

  return (
    <div id="admin-root" className="flex h-screen overflow-hidden" style={{ background: 'var(--pdd-bg)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/20 z-40 lg:hidden" />
      )}

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        className={`fixed lg:relative z-50 flex-shrink-0 flex flex-col overflow-hidden border-r h-full bg-pdd-card shadow-sm ${mobileOpen ? 'left-0' : '-left-full lg:left-0'}`}
        style={{ borderColor: 'var(--pdd-border)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b flex-shrink-0" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-pdd-primary flex items-center justify-center flex-shrink-0 shadow-sm">
              <LayoutDashboard size={16} className="text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--pdd-text)' }}>运营中台</span>
                <span className="text-[10px] font-medium" style={{ color: 'var(--pdd-primary)' }}>OPERATIONS CENTER</span>
              </div>
            )}
          </div>
          <button onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1.5 rounded-lg hover:bg-pdd-gray-100 transition-all hidden lg:block" style={{ color: 'var(--pdd-text-secondary)' }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {ADMIN_NAV.map((item, idx) => {
            if ('section' in item) {
              if (collapsed) return null;
              return (
                <div key={`s-${idx}`} className="px-2 pt-4 pb-1">
                  <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--pdd-gray-400)' }}>{item.section}</div>
                </div>
              );
            }
            return (
              <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                {({ isActive }) => (
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 relative ${isActive ? 'bg-pdd-gray-100 text-pdd-primary font-medium' : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-gray-50'}`}>
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-pdd-primary" />}
                    <div className="relative flex-shrink-0">
                      <item.icon size={18} className={isActive ? 'text-pdd-primary' : ''} />
                    </div>
                    {!collapsed && (
                      <>
                        <span className="text-sm whitespace-nowrap flex-1">{item.label}</span>
                        {getBadgeValue(item.badge) !== null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: 'var(--pdd-primary)' }}>
                            {getBadgeValue(item.badge)! > 99 ? '99+' : getBadgeValue(item.badge)}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && getBadgeValue(item.badge) !== null && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pdd-primary text-white text-[8px] flex items-center justify-center font-bold">
                        {getBadgeValue(item.badge)! > 99 ? '99+' : getBadgeValue(item.badge)}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom user info */}
        <div className="border-t p-3 flex-shrink-0" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-pdd-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">{(user?.username || 'A')[0].toUpperCase()}</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-medium truncate" style={{ color: 'var(--pdd-text)' }}>{user?.username}</span>
                <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>
                  {user?.role === 'admin' ? '超级管理员' : '测试账号'}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b flex items-center px-4 gap-3 flex-shrink-0 bg-pdd-card shadow-sm" style={{ borderColor: 'var(--pdd-border)' }}>
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2" style={{ color: 'var(--pdd-text-secondary)' }}>
            <Menu size={18} />
          </button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <LayoutDashboard size={12} style={{ color: 'var(--pdd-primary)' }} />
            <span style={{ color: 'var(--pdd-text-secondary)' }}>运营中台</span>
            {BREADCRUMB_MAP[location.pathname] && (
              <><ChevronRight size={10} style={{ color: 'var(--pdd-gray-400)' }} /><span className="font-medium" style={{ color: 'var(--pdd-text)' }}>{BREADCRUMB_MAP[location.pathname]}</span></>
            )}
          </div>

          <div className="flex-1" />

          {/* Global search */}
          <div className="hidden md:flex items-center relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pdd-gray-400)' }} />
            <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onKeyDown={handleGlobalSearch}
              placeholder="搜索用户..." className="w-48 pl-9 pr-3 py-1.5 text-xs bg-pdd-bg border rounded-lg outline-none transition-colors"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--pdd-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--pdd-border)'; }} />
          </div>

          {/* Notifications bell */}
          <div className="relative">
            <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              className="relative p-2 rounded-lg hover:bg-pdd-gray-100 transition-colors" style={{ color: 'var(--pdd-text-secondary)' }}>
              <Bell size={17} />
              {badges.pendingRecharge > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pdd-danger" />}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-pdd-card rounded-xl border shadow-lg z-50 overflow-hidden"
                  style={{ borderColor: 'var(--pdd-border)' }} onClick={e => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>通知中心</h3>
                    <span className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>共 {badges.pendingRecharge} 条待处理</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {badges.pendingRecharge > 0 ? (
                      <button onClick={() => { navigate('/recharge'); setNotifOpen(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-pdd-bg transition-colors flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-pdd-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CreditCard size={14} style={{ color: 'var(--pdd-primary)' }} />
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--pdd-text)' }}>充值审核待处理</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>有 {badges.pendingRecharge} 条充值申请等待审核</p>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--pdd-primary)' }}>点击查看</p>
                        </div>
                      </button>
                    ) : (
                      <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--pdd-gray-400)' }}>
                        <Bell size={24} className="mx-auto mb-2 opacity-30" /> 暂无待处理通知
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button onClick={toggleDark}
            className="relative p-2 rounded-lg hover:bg-pdd-gray-100 transition-colors"
            style={{ color: 'var(--pdd-text-secondary)' }}
            title={isDark ? '切换亮色模式' : '切换暗色模式'}>
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-pdd-gray-100 transition-colors">
              <div className="w-7 h-7 rounded-full bg-pdd-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">{(user?.username || 'A')[0].toUpperCase()}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-sm font-medium" style={{ color: 'var(--pdd-text)' }}>{user?.username}</span>
                <ChevronDown size={12} style={{ color: 'var(--pdd-text-secondary)' }} />
              </div>
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-pdd-card rounded-xl border shadow-lg z-50 overflow-hidden"
                  style={{ borderColor: 'var(--pdd-border)' }} onClick={e => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--pdd-border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-pdd-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{(user?.username || 'A')[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>{user?.username}</p>
                        <p className="text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>{user?.role === 'admin' ? '超级管理员' : '测试账号'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-pdd-gray-100 transition-colors" style={{ color: 'var(--pdd-text-secondary)' }}>
                      <Settings size={15} /> 系统设置
                    </button>
                    <button onClick={() => { navigate('/logs'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-pdd-gray-100 transition-colors" style={{ color: 'var(--pdd-text-secondary)' }}>
                      <FileText size={15} /> 操作日志
                    </button>
                  </div>
                  <div className="border-t py-1" style={{ borderColor: 'var(--pdd-border)' }}>
                    <button onClick={logout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors" style={{ color: 'var(--pdd-danger)' }}>
                      <LogOut size={15} /> 退出登录
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: 'var(--pdd-bg)' }}>
          <div className="admin-container">
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Click-away handlers */}
      {(profileOpen || notifOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setProfileOpen(false); setNotifOpen(false); }} />
      )}
    </div>
  );
}
