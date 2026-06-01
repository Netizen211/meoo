import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users as UsersIcon, Crown, Key, Activity,
  FileText, Settings, LogOut, Menu, ChevronRight, ChevronLeft,
  Sun, Moon, CreditCard, Eye, Wrench, Shield, Bell, Search,
  ChevronDown, User, LayoutDashboard, Clock, Sparkles,
  MessageSquare, AlertTriangle,
  DollarSign, Server,
} from 'lucide-react';
import { useAuth } from '../App';
import { adminApi } from '../../api/adminApi';

interface BadgeCounts {
  pendingRecharge: number;
  totalUsers: number;
  subAccounts: number;
}

interface Announcement {
  id: number;
  title: string;
  createdAt: string;
}

const ADMIN_NAV = [
  { path: '/', label: '系统概览', icon: BarChart3, badge: null as string | null },
  { path: '/shadow', label: '影子访问', icon: Eye, badge: null as string | null },
  { path: '/recharge', label: '充值审核', icon: CreditCard, badge: 'pendingRecharge' },
  { path: '/revenue', label: '营收分析', icon: DollarSign, badge: null },
  { path: '/users', label: '用户管理', icon: UsersIcon, badge: 'totalUsers' },
  { path: '/sub-accounts', label: '子账号管理', icon: Shield, badge: 'subAccounts' },
  { path: '/members', label: '会员管理', icon: Crown, badge: null },
  { path: '/invite', label: '邀请码', icon: Key, badge: null },
  { path: '/data', label: '数据监控', icon: Activity, badge: null },
  { path: '/announcements', label: '系统公告', icon: MessageSquare, badge: null },
  { path: '/logs', label: '操作日志', icon: FileText, badge: null },
  { path: '/system', label: '系统运维', icon: Server, badge: null },
  { path: '/settings', label: '系统设置', icon: Settings, badge: null },
  { path: '/config', label: '全局配置', icon: Wrench, badge: null },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/': '系统概览',
  '/shadow': '影子访问',
  '/recharge': '充值审核',
  '/revenue': '营收分析',
  '/users': '用户管理',
  '/sub-accounts': '子账号管理',
  '/members': '会员管理',
  '/invite': '邀请码管理',
  '/data': '数据监控',
  '/announcements': '系统公告',
  '/logs': '操作日志',
  '/system': '系统运维',
  '/settings': '系统设置',
  '/config': '全局配置',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('dianfx_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [badges, setBadges] = useState<BadgeCounts>({ pendingRecharge: 0, totalUsers: 0, subAccounts: 0 });
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);

  // Fetch badge counts
  const fetchBadges = useCallback(async () => {
    try {
      const [statsRes, subRes, rechargeRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getSubAccounts({ pageSize: 1 }),
        adminApi.getRechargeList('pending', 1, 1),
      ]);
      setBadges({
        pendingRecharge: (rechargeRes as any)?.total ?? 0,
        totalUsers: statsRes?.totalUsers ?? 0,
        subAccounts: (subRes as any)?.total ?? 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchBadges(); }, [fetchBadges]);

  // Theme
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
    <div id="admin-root" className="flex h-screen overflow-hidden bg-pdd-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
      )}

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        className={`fixed lg:relative z-50 flex-shrink-0 flex flex-col overflow-hidden border-r border-pdd-border h-full
          ${mobileOpen ? 'left-0' : '-left-full lg:left-0'}`}
        style={{ background: 'linear-gradient(180deg, var(--pdd-sidebar) 0%, var(--pdd-bg) 100%)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-3 border-b border-pdd-border flex-shrink-0">
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
            className="ml-auto p-1.5 text-pdd-text-secondary hover:text-pdd-text rounded-lg hover:bg-pdd-card transition-all hidden lg:block"
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
                  <div className="relative">
                    <item.icon size={18} className={`flex-shrink-0 ${isActive ? 'text-amber-400' : ''}`} />
                  </div>
                  {!collapsed && (
                    <>
                      <span className="text-sm whitespace-nowrap font-medium flex-1">{item.label}</span>
                      {getBadgeValue(item.badge) !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-amber-500 text-white'
                            : item.badge === 'pendingRecharge'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-pdd-border text-pdd-text-secondary'
                        }`}>
                          {getBadgeValue(item.badge)}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && getBadgeValue(item.badge) !== null && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {getBadgeValue(item.badge)! > 99 ? '99+' : getBadgeValue(item.badge)}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-pdd-border p-3 space-y-2 flex-shrink-0">
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-card transition-all">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span className="text-sm">{darkMode ? '亮色模式' : '暗色模式'}</span>}
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

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <LayoutDashboard size={12} className="text-pdd-text-secondary" />
            <span className="text-pdd-text-secondary">管理后台</span>
            {BREADCRUMB_MAP[location.pathname] && (
              <>
                <ChevronRight size={10} className="text-pdd-text-secondary" />
                <span className="text-pdd-text-primary font-medium">{BREADCRUMB_MAP[location.pathname]}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Global search */}
          <div className="hidden md:flex items-center relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
            <input
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              onKeyDown={handleGlobalSearch}
              placeholder="搜索用户..."
              className="w-48 pl-9 pr-3 py-1.5 text-xs bg-pdd-bg border border-pdd-border rounded-lg outline-none focus:border-pdd-primary/50 transition-colors text-pdd-text-primary"
            />
          </div>

          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
              className="relative p-2 rounded-lg text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-card transition-colors"
            >
              <Bell size={17} />
              {badges.pendingRecharge > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>

            {/* Notifications dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-pdd-card rounded-xl border border-pdd-border shadow-xl z-50 overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-pdd-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-pdd-text-primary">通知中心</h3>
                    <span className="text-[10px] text-pdd-text-secondary">共 {badges.pendingRecharge} 条待处理</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {badges.pendingRecharge > 0 ? (
                      <button
                        onClick={() => { navigate('/recharge'); setNotifOpen(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-pdd-bg transition-colors flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CreditCard size={14} className="text-amber-400" />
                        </div>
                        <div>
                          <p className="text-xs text-pdd-text-primary font-medium">充值审核待处理</p>
                          <p className="text-[10px] text-pdd-text-secondary mt-0.5">
                            有 {badges.pendingRecharge} 条充值申请等待审核
                          </p>
                          <p className="text-[10px] text-pdd-text-secondary mt-1">点击查看 &rarr;</p>
                        </div>
                      </button>
                    ) : (
                      <div className="px-4 py-8 text-center text-pdd-text-secondary text-xs">
                        <Bell size={24} className="mx-auto mb-2 opacity-30" />
                        暂无待处理通知
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-pdd-card transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">{(user?.username || 'A')[0].toUpperCase()}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-sm text-pdd-text-primary font-medium">{user?.username}</span>
                <ChevronDown size={12} className="text-pdd-text-secondary" />
              </div>
            </button>

            {/* Profile dropdown menu */}
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-pdd-card rounded-xl border border-pdd-border shadow-xl z-50 overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-pdd-border">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{(user?.username || 'A')[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-pdd-text-primary">{user?.username}</p>
                        <p className="text-[10px] text-pdd-text-secondary">
                          {user?.role === 'admin' ? '超级管理员' : '测试账号'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg transition-colors"
                    >
                      <Settings size={15} />
                      系统设置
                    </button>
                    <button
                      onClick={() => { navigate('/logs'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg transition-colors"
                    >
                      <Clock size={15} />
                      操作日志
                    </button>
                    <button
                      onClick={() => { toggleTheme(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg transition-colors"
                    >
                      {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                      {darkMode ? '切换亮色模式' : '切换暗色模式'}
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-pdd-border py-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={15} />
                      退出登录
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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

      {/* Click-away handlers */}
      {(profileOpen || notifOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setProfileOpen(false); setNotifOpen(false); }} />
      )}
    </div>
  );
}
