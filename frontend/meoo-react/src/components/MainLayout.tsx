import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Store, Truck, TrendingUp, ShieldCheck,
  Landmark, Calculator, AlertTriangle, Settings, LogOut,
  ChevronDown, ChevronRight, Bell, Download, RefreshCw, Maximize2, Menu, X,
  Plus, Activity, Layers, Upload, Calendar, Moon, Sun, 
} from 'lucide-react';
import { useAuth, useStore, useData } from '../App';
import SyncStatusBar from './SyncStatusBar';
import { useDarkMode } from '../hooks/useDarkMode';

interface NavItem { path: string; label: string; icon: React.ComponentType<any>; badge?: string; }
const NAV_ITEMS: NavItem[] = [
  { path: '/stores', label: '店铺管理', icon: Store },
  { path: '/dashboard', label: '数据中心', icon: LayoutDashboard },
  { path: '/product', label: '商品分析', icon: Package },
  { path: '/promotion', label: '推广数据', icon: TrendingUp, badge: 'PRO' },
  { path: '/after-sale', label: '售后质量', icon: ShieldCheck },
  { path: '/logistics', label: '物流履约', icon: Truck },
  { path: '/reconciliation', label: '对账中心', icon: Landmark },
  { path: '/cost-management', label: '成本管理', icon: Calculator },
  { path: '/risk', label: '风险预警', icon: AlertTriangle, badge: 'PRO' },
  { path: '/time-window', label: '时间窗口', icon: Calendar },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { stores, switchStore, addStore, renameStore } = useStore();
  const { dataFilter, setDataFilter, syncStatus } = useData() as any;
  const location = useLocation();
  const navigate = useNavigate();

  const [storeDropdown, setStoreDropdown] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingStoreName, setEditingStoreName] = useState('');
  const storeBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useDarkMode();

  const openStoreDropdown = useCallback(() => {
    if (storeBtnRef.current) {
      const rect = storeBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setStoreDropdown(true);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector('[data-notif-panel]');
      if (el && !el.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [notifOpen]);

  useEffect(() => {
    if (!storeDropdown) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector('[data-store-dropdown]');
      if (el && !el.contains(e.target as Node) && e.target !== storeBtnRef.current) {
        setStoreDropdown(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [storeDropdown]);

  const notifications = [
    { id: 1, title: '售后率异常', desc: '今日售后率超过30%', time: '5分钟前', type: 'warning' as const, path: '/after-sale' },
    { id: 2, title: '发货超时', desc: '12单超过48小时未发货', time: '15分钟前', type: 'danger' as const, path: '/logistics' },
    { id: 3, title: '数据更新完成', desc: '昨日数据已同步', time: '1小时前', type: 'success' as const },
    { id: 4, title: '退款率上升', desc: '较昨日上升5.2%', time: '2小时前', type: 'warning' as const, path: '/after-sale' },
  ];

  const quickActions = [
    { icon: Upload, label: '上传', onClick: () => navigate('/upload') },
    { icon: Download, label: '导出', onClick: () => {} },
    { icon: RefreshCw, label: '刷新', onClick: () => window.location.reload() },
    { icon: Maximize2, label: '全屏', onClick: () => { try { document.documentElement.requestFullscreen(); } catch (e) {} } },
  ];

  const pageTitle = NAV_ITEMS.find(n => n.path === location.pathname)?.label || '页面';

  return (
    <div id="app-root" className="flex h-screen overflow-hidden bg-pdd-bg">
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
        )}
      </AnimatePresence>

      {/* Sidebar - flattened 9 items, no categories/favorites/tabs */}
      <aside className={
        'fixed lg:relative z-50 flex-shrink-0 w-[224px] flex flex-col bg-pdd-card border-r border-pdd-border overflow-hidden ' +
        (mobileMenuOpen ? '' : 'hidden lg:flex')
      }>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-pdd-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark flex items-center justify-center text-white shadow-md shadow-pdd-primary/20">
              <Activity size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-pdd-text font-bold text-sm tracking-wide">店分析</span>
              <span className="text-[10px] text-pdd-primary font-medium tracking-wider">PRO ANALYTICS</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-thin">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'}>
              {({ isActive: active }) => (
                <div className={
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 relative ' +
                  (active ? 'bg-pdd-bg text-pdd-primary font-medium' : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg/50')
                }>
                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-pdd-primary rounded-r-full" />}
                  <item.icon size={18} className={'shrink-0 ' + (active ? 'text-pdd-primary' : '')} />
                  <span className="text-sm flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 bg-pdd-primary/10 text-pdd-primary text-[10px] rounded-md font-medium">{item.badge}</span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Settings at bottom */}
        <div className="border-t border-pdd-border pt-2 pb-3 px-3">
          <NavLink to="/settings">
            {({ isActive: active }) => (
              <div className={
                'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ' +
                (active ? 'bg-pdd-bg text-pdd-primary font-medium' : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg/50')
              }>
                <Settings size={18} className={'shrink-0 ' + (active ? 'text-pdd-primary' : '')} />
                <span className="text-sm flex-1">设置中心</span>
              </div>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-pdd-border flex items-center px-4 lg:px-6 gap-2 flex-shrink-0 bg-pdd-card">
          <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-pdd-text-secondary hover:text-pdd-text -ml-1">
            <Menu size={20} />
          </button>

          {/* Simple breadcrumb */}
          <nav className="hidden md:flex items-center gap-1 text-sm min-w-0">
            <span className="text-pdd-text-secondary shrink-0">店分析</span>
            <ChevronRight size={14} className="text-pdd-border shrink-0" />
            <span className="font-medium text-pdd-text truncate">{pageTitle}</span>
          </nav>

          <div className="flex-1 min-w-[8px]" />

          {/* Upload button */}
          <button onClick={() => navigate('/upload')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-pdd-primary text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm shadow-pdd-primary/20">
            <Upload size={14} />
            <span>上传</span>
          </button>

          {/* Quick actions */}
          <div className="hidden md:flex items-center gap-0.5">
            {quickActions.map(action => (
              <button key={action.label} onClick={action.onClick}
                className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all" title={action.label}>
                <action.icon size={16} />
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all" title={isDark ? '切换到亮色模式' : '切换到暗色模式'}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pdd-danger rounded-full" />
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-80 bg-pdd-card border border-pdd-border rounded-xl shadow-xl z-50 overflow-hidden" data-notif-panel>
                  <div className="px-4 py-3 border-b border-pdd-border flex items-center justify-between">
                    <span className="font-medium text-sm text-pdd-text">通知中心</span>
                    <span className="text-xs text-pdd-danger">{notifications.filter(n => n.type !== 'success').length}条异常</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} onClick={() => { n.path && navigate(n.path); setNotifOpen(false); }}
                        className="px-4 py-3 hover:bg-pdd-bg cursor-pointer border-b border-pdd-border last:border-0 transition-colors">
                        <div className="flex items-start gap-2">
                          <div className={'w-2 h-2 rounded-full mt-1.5 ' + (n.type === 'danger' ? 'bg-pdd-danger' : n.type === 'warning' ? 'bg-pdd-warning' : 'bg-pdd-success')} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-pdd-text">{n.title}</p>
                            <p className="text-xs text-pdd-text-secondary mt-0.5">{n.desc}</p>
                            <p className="text-[10px] text-pdd-text-secondary mt-1">{n.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Store selector */}
          <div className="relative">
            <button ref={storeBtnRef} onClick={openStoreDropdown}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-pdd-border text-sm hover:border-pdd-primary transition-colors bg-pdd-bg">
              <Store size={14} className="text-pdd-primary shrink-0" />
              <span className="max-w-[100px] truncate hidden sm:inline text-pdd-text">
                {dataFilter === '__all__' ? '全部店铺' : (stores.find(s => s.id === dataFilter)?.name || '选择店铺')}
              </span>
              <ChevronDown size={14} className="text-pdd-text-secondary shrink-0" />
            </button>
            {createPortal(
              <AnimatePresence>
                {storeDropdown && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="fixed w-48 bg-pdd-card border border-pdd-border rounded-xl shadow-xl z-[99999] overflow-hidden"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                    data-store-dropdown>
                    <button onClick={() => { setDataFilter('__all__'); setStoreDropdown(false); }}
                      className={'w-full text-left px-4 py-2.5 text-sm hover:bg-pdd-bg transition-colors flex items-center gap-2 ' + (dataFilter === '__all__' ? 'text-pdd-primary font-medium bg-pdd-bg' : 'text-pdd-text-secondary')}>
                      <Layers size={14} /> 全部店铺
                    </button>
                    {stores.filter(s => s.id !== '__all__').map(s => (
                      editingStoreId === s.id ? (
                        <div key={s.id} className="flex items-center gap-1 px-3 py-1.5">
                          <input value={editingStoreName} onChange={e => setEditingStoreName(e.target.value)}
                            className="flex-1 text-sm px-2 py-1 border border-pdd-primary rounded bg-pdd-bg text-pdd-text focus:outline-none" autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameStore(s.id, editingStoreName.trim() || s.name); setEditingStoreId(null); }
                              if (e.key === 'Escape') setEditingStoreId(null);
                            }} />
                        </div>
                      ) : (
                        <button key={s.id} onClick={() => { switchStore(s.id); setDataFilter(s.id); setStoreDropdown(false); }}
                          className={'w-full text-left px-4 py-2.5 text-sm hover:bg-pdd-bg transition-colors flex items-center gap-2 ' + (s.id === dataFilter ? 'text-pdd-primary font-medium bg-pdd-bg' : 'text-pdd-text-secondary')}>
                          <Store size={14} /> <span className="flex-1 truncate">{s.name}</span>
                        </button>
                      )
                    ))}
                    <button onClick={async () => { const s = await addStore('店铺' + (stores.length + 1)); setDataFilter(s.id); setStoreDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-pdd-primary border-t border-pdd-border hover:bg-pdd-bg transition-colors flex items-center gap-2">
                      <Plus size={14} /> 添加店铺
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>

          {/* User info */}
          <div className="flex items-center gap-2 pl-2 border-l border-pdd-border">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-pdd-text">{user?.username}</span>
              {user?.membershipLevel !== 'free' && (
                <span className="text-[10px] text-pdd-primary">{user?.membershipLevel === 'enterprise' ? '企业版' : '专业版'}</span>
              )}
            </div>
            <button onClick={logout} className="p-2 text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 rounded-lg transition-all" title="退出登录">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Main content area - no padding, let pages handle it */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="admin-container">
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}>
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <SyncStatusBar status={syncStatus || 'idle'} />
    </div>
  );
}
