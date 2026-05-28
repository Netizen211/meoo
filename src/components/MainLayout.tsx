import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Users, Clock, MapPin, Truck,
  DollarSign, ShieldCheck, Shield, TrendingUp, AlertTriangle,
  Crown, Calculator, Settings, LogOut, Store, ChevronDown, ChevronRight,
  Search, Bell, Download, RefreshCw, Maximize2, Menu, X, Home,
  ChevronLeft, Zap, Star, GripVertical, Plus,
  Moon, Sun, Link as LinkIcon, Activity, Layers, Pencil, Check, Landmark,
  ShieldAlert
} from 'lucide-react';
import { useAuth, useStore, useData } from '../App';
import SampleDataImporter from './SampleDataImporter';

const NAV_ITEMS = [
  { path: '/dashboard', label: '数据中心', icon: LayoutDashboard, category: 'overview' },
  { path: '/product', label: '商品分析', icon: Package, category: 'analysis' },
  { path: '/user', label: '用户分析', icon: Users, category: 'analysis' },
  { path: '/trend', label: '时间趋势', icon: Clock, category: 'analysis' },
  { path: '/region', label: '地域分析', icon: MapPin, category: 'analysis' },
  { path: '/logistics', label: '物流履约', icon: Truck, category: 'operations' },
  { path: '/cost', label: '优惠成本', icon: DollarSign, category: 'finance' },
  { path: '/after-sale', label: '售后质量', icon: ShieldCheck, category: 'operations' },
  { path: '/shipping-insurance', label: '运费险', icon: Shield, category: 'finance' },
  { path: '/promotion', label: '推广数据', icon: TrendingUp, category: 'marketing', paid: true },
  { path: '/risk', label: '风险预警', icon: AlertTriangle, category: 'operations', paid: true },
  { path: '/cost-management', label: '成本管理', icon: Calculator, category: 'finance' },
  { path: '/finance', label: '财务管理', icon: Landmark, category: 'finance' },
  { path: '/membership', label: '会员中心', icon: Crown, category: 'system' },
  { path: '/settings', label: '数据清理', icon: Settings, category: 'system' },
];

const CATEGORY_LABELS: Record<string, string> = {
  overview: '概览',
  analysis: '数据分析',
  operations: '运营管理',
  finance: '财务成本',
  marketing: '营销推广',
  system: '系统',
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { stores, currentStore, switchStore, addStore, renameStore } = useStore();
  const { dataFilter, setDataFilter } = useData();
  const [storeDropdown, setStoreDropdown] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingStoreName, setEditingStoreName] = useState('');
  const storeBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const openStoreDropdown = useCallback(() => {
    if (storeBtnRef.current) {
      const rect = storeBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setStoreDropdown(true);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('dianfx_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  // Apply theme to DOM on mount and when darkMode changes
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

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('dianfx_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentVisits, setRecentVisits] = useState<string[]>(() => {
    const saved = localStorage.getItem('dianfx_recent');
    return saved ? JSON.parse(saved) : [];
  });
  const [tabs, setTabs] = useState<{ path: string; label: string }[]>([{ path: '/dashboard', label: '数据中心' }]);
  const [activeTab, setActiveTab] = useState('/dashboard');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    setActiveTab(path);
    if (!tabs.find(t => t.path === path)) {
      const item = NAV_ITEMS.find(n => n.path === path);
      if (item) setTabs(prev => [...prev.slice(-4), { path, label: item.label }]);
    }
    setRecentVisits(prev => {
      const updated = [path, ...prev.filter(p => p !== path)].slice(0, 8);
      localStorage.setItem('dianfx_recent', JSON.stringify(updated));
      return updated;
    });
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('dianfx_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector('[data-notif-panel]');
      if (el && !el.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [notifOpen]);

  // 店铺下拉点击外部关闭（Portal 渲染在 body）
  useEffect(() => {
    if (!storeDropdown) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector('[data-store-dropdown]');
      if (el && !el.contains(e.target as Node) && e.target !== storeBtnRef.current) {
        setStoreDropdown(false);
      }
    };
    // 延迟绑定避免打开按钮的 click 事件立即关闭
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [storeDropdown]);

  const toggleFavorite = (path: string) => {
    setFavorites(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const filtered = prev.filter(t => t.path !== path);
      if (activeTab === path && filtered.length > 0) {
        navigate(filtered[filtered.length - 1].path);
      }
      return filtered;
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const filteredNav = useMemo(() => {
    if (!searchOpen || !searchQuery.trim()) return NAV_ITEMS;
    return NAV_ITEMS.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchOpen, searchQuery]);

  const currentNav = NAV_ITEMS.find(n => n.path === location.pathname);
  const breadcrumbs = useMemo(() => {
    const items = [{ label: '首页', path: '/dashboard' }];
    if (currentNav) {
      if (currentNav.category !== 'overview') {
        items.push({ label: CATEGORY_LABELS[currentNav.category] || '页面', path: '#' });
      }
      items.push({ label: currentNav.label, path: currentNav.path });
    }
    return items;
  }, [currentNav]);

  const groupedNav = useMemo(() => {
    const groups: Record<string, typeof NAV_ITEMS> = {};
    NAV_ITEMS.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, []);

  const notifications = [
    { id: 1, title: '售后率异常', desc: '今日售后率超过30%', time: '5分钟前', type: 'warning', path: '/after-sale' },
    { id: 2, title: '发货超时', desc: '12单超过48小时未发货', time: '15分钟前', type: 'danger', path: '/logistics' },
    { id: 3, title: '数据更新完成', desc: '昨日数据已同步', time: '1小时前', type: 'success' },
    { id: 4, title: '退款率上升', desc: '较昨日上升5.2%', time: '2小时前', type: 'warning', path: '/after-sale' },
  ];

  const quickActions = [
    { icon: Download, label: '导出', onClick: () => { import('../utils').then(u => { const page = NAV_ITEMS.find(n => n.path === location.pathname); if (page) u.exportCSV(['指标', '值'], [['页面', page.label]], `店分析_${page.label}`); }); } },
    { icon: RefreshCw, label: '刷新', onClick: () => window.location.reload() },
    { icon: Maximize2, label: '全屏', onClick: () => { try { document.documentElement.requestFullscreen(); } catch (e) { } } },
  ];

  return (
    <div id="app-root" className="flex h-screen overflow-hidden bg-pdd-bg">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside animate={{ width: sidebarCollapsed ? 68 : 240 }}
        className={`fixed lg:relative z-50 flex-shrink-0 flex flex-col overflow-hidden border-r border-pdd-border ${mobileMenuOpen ? '' : 'lg:translate-x-0 -translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, var(--pdd-sidebar) 0%, var(--pdd-bg) 100%)' }}>
        
        {/* Logo area */}
        <div className="h-16 flex items-center px-4 border-b border-pdd-border">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-pdd-primary/20">
              <Activity size={18} />
            </div>
            {!sidebarCollapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
                <span className="text-pdd-text font-semibold text-sm whitespace-nowrap tracking-wide">店分析</span>
                <span className="text-pdd-primary text-[10px] whitespace-nowrap font-medium">PRO ANALYTICS</span>
              </motion.div>
            )}
          </div>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="ml-auto text-pdd-text-secondary hover:text-pdd-text p-1.5 rounded-lg hover:bg-pdd-card transition-all">
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Favorites */}
        {!sidebarCollapsed && favorites.length > 0 && (
          <div className="px-3 py-3 border-b border-pdd-border">
            <div className="text-[10px] text-pdd-text-secondary uppercase tracking-widest mb-2 font-semibold">收藏夹</div>
            {favorites.map(path => {
              const item = NAV_ITEMS.find(n => n.path === path);
              if (!item) return null;
              return (
                <div key={path} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-pdd-card cursor-pointer group">
                  <NavLink to={path} className="flex items-center gap-2 flex-1 text-pdd-text-secondary hover:text-pdd-text text-xs">
                    <item.icon size={14} />
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                  <button onClick={() => toggleFavorite(path)} className="text-amber-400 opacity-0 group-hover:opacity-100"><Star size={12} fill="#fbbf24" /></button>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {Object.entries(groupedNav).map(([category, items]) => (
            <div key={category} className="mb-3">
              {!sidebarCollapsed && <div className="px-4 py-1.5 text-[10px] text-pdd-text-secondary uppercase tracking-widest font-semibold">{CATEGORY_LABELS[category]}</div>}
              {items.map(item => (
                <div key={item.path} className="group relative">
                  <NavLink to={item.path}>
                    {({ isActive }) => (
                      <motion.div whileHover={{ x: 2 }}
                        className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-pdd-primary/20 to-pdd-primary-dark/10 text-pdd-text border border-pdd-primary/20'
                            : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-card'
                        }`}>
                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-pdd-primary rounded-r-full" />}
                        <item.icon size={18} className={`flex-shrink-0 ${isActive ? 'text-pdd-primary-light' : ''}`} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="text-sm whitespace-nowrap flex-1 font-medium">{item.label}</span>
                            {item.paid && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded-md border border-amber-500/20 font-medium">PRO</span>}
                            <button onClick={e => { e.preventDefault(); toggleFavorite(item.path); }}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity ${favorites.includes(item.path) ? 'text-amber-400' : 'text-pdd-text-secondary hover:text-amber-400'}`}>
                              <Star size={14} fill={favorites.includes(item.path) ? '#fbbf24' : 'none'} />
                            </button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </NavLink>
                </div>
              ))}
            </div>
          ))}
        </nav>


        {/* Upload button */}
        <NavLink to="/upload">
          <div className="mx-3 mb-3 py-2.5 rounded-xl bg-gradient-to-r from-pdd-primary to-pdd-primary-dark text-white text-center text-sm font-medium hover:shadow-lg hover:shadow-pdd-primary/25 transition-all flex items-center justify-center gap-2">
            <Zap size={16} />
            {!sidebarCollapsed && <span>上传数据</span>}
          </div>
        </NavLink>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-pdd-border flex items-center px-4 gap-3 flex-shrink-0" style={{ background: 'rgba(var(--pdd-bg-rgb, 15, 17, 23), 0.8)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 text-pdd-text-secondary hover:text-pdd-text">
            <Menu size={20} />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Home size={14} className="text-pdd-text-secondary" />
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={14} className="text-pdd-border" />
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-pdd-text">{crumb.label}</span>
                ) : (
                  <button onClick={() => navigate(crumb.path)} className="text-pdd-text-secondary hover:text-pdd-primary transition-colors">{crumb.label}</button>
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Quick actions */}
          <div className="hidden md:flex items-center gap-1">
            {quickActions.map(action => (
              <motion.button key={action.label} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={action.onClick}
                className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all" title={action.label}>
                <action.icon size={16} />
              </motion.button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <AnimatePresence>
              {searchOpen ? (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center">
                  <input type="text" placeholder="搜索页面、指标..." autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onBlur={() => { setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full px-3 py-1.5 text-sm bg-pdd-card border border-pdd-border rounded-lg focus:border-pdd-primary focus:outline-none text-pdd-text placeholder-pdd-text-secondary" />
                  <button onClick={() => setSearchOpen(false)} className="ml-1 p-1 text-pdd-text-secondary"><X size={14} /></button>
                </motion.div>
              ) : (
                <motion.button whileHover={{ scale: 1.05 }} onClick={() => setSearchOpen(true)}
                  className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all">
                  <Search size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <div className="relative">
            <motion.button whileHover={{ scale: 1.05 }} onClick={() => setNotifOpen(!notifOpen)}
              className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pdd-danger rounded-full shadow-lg shadow-pdd-danger/50" />
            </motion.button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-80 bg-pdd-card border border-pdd-border rounded-xl shadow-2xl z-50 overflow-hidden" data-notif-panel>
                  <div className="px-4 py-3 border-b border-pdd-border flex items-center justify-between">
                    <span className="font-medium text-sm text-pdd-text">通知中心</span>
                    <span className="text-xs text-pdd-danger">{notifications.filter(n => n.type !== 'success').length}条异常</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} onClick={() => n.path && navigate(n.path)}
                        className="px-4 py-3 hover:bg-pdd-bg cursor-pointer border-b border-pdd-border last:border-0 transition-colors">
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${n.type === 'danger' ? 'bg-pdd-danger shadow-lg shadow-pdd-danger/50' : n.type === 'warning' ? 'bg-pdd-warning' : 'bg-pdd-success'}`} />
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-pdd-border text-sm hover:border-pdd-primary transition-colors bg-pdd-card">
              <Store size={14} className="text-pdd-primary-light" />
              <span className="max-w-[100px] truncate hidden sm:inline text-pdd-text">
                {dataFilter === '__all__' ? '全部店铺' : (stores.find(s => s.id === dataFilter)?.name || '选择店铺')}
              </span>
              <ChevronDown size={14} className="text-pdd-text-secondary" />
            </button>
            {createPortal(
              <AnimatePresence>
                {storeDropdown && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="fixed w-48 bg-pdd-card border border-pdd-border rounded-xl shadow-2xl z-[99999] overflow-hidden"
                    style={{ top: dropdownPos.top, right: dropdownPos.right }}
                    data-store-dropdown>
                    {stores.length > 0 && (
                      <button onClick={() => { setDataFilter('__all__'); setStoreDropdown(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pdd-bg transition-colors flex items-center gap-2 ${dataFilter === '__all__' ? 'text-pdd-primary-light font-medium bg-pdd-primary/10' : 'text-pdd-text-secondary'}`}>
                        <Layers size={14} /> 全部店铺
                      </button>
                    )}
                    {stores.map(s => (
                      editingStoreId === s.id ? (
                        <div key={s.id} className="flex items-center gap-1 px-3 py-1.5">
                          <input
                            value={editingStoreName}
                            onChange={e => setEditingStoreName(e.target.value)}
                            className="flex-1 text-sm px-2 py-1 border border-pdd-primary rounded bg-pdd-bg text-pdd-text focus:outline-none"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') { renameStore(s.id, editingStoreName.trim() || s.name); setEditingStoreId(null); }
                              if (e.key === 'Escape') setEditingStoreId(null);
                            }}
                          />
                          <button onClick={() => { renameStore(s.id, editingStoreName.trim() || s.name); setEditingStoreId(null); }} className="p-1 text-pdd-success hover:bg-pdd-success/10 rounded"><Check size={14} /></button>
                          <button onClick={() => setEditingStoreId(null)} className="p-1 text-pdd-text-secondary hover:bg-pdd-bg rounded"><X size={14} /></button>
                        </div>
                      ) : (
                        <button key={s.id} onClick={() => { switchStore(s.id); setDataFilter(s.id); setStoreDropdown(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-pdd-bg transition-colors flex items-center gap-2 group ${s.id === dataFilter ? 'text-pdd-primary-light font-medium bg-pdd-primary/10' : 'text-pdd-text-secondary'}`}>
                          <Store size={14} /> <span className="flex-1 truncate">{s.name}</span>
                          <span
                            onClick={(e) => { e.stopPropagation(); setEditingStoreId(s.id); setEditingStoreName(s.name); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-pdd-text-secondary hover:text-pdd-primary rounded transition-all"
                            title="重命名"
                          ><Pencil size={12} /></span>
                        </button>
                      )
                    ))}
                    <button onClick={() => { const s = addStore(`店铺${stores.length + 1}`); setDataFilter(s.id); setStoreDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-pdd-primary-light border-t border-pdd-border hover:bg-pdd-bg transition-colors flex items-center gap-2">
                      <Plus size={14} /> 添加店铺
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>

          {/* Theme toggle */}
          <button onClick={() => { const next = !darkMode; setDarkMode(next); localStorage.setItem('dianfx_dark_mode', String(next)); }} className="p-2 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-all">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User info */}
          <div className="flex items-center gap-2 pl-3 border-l border-pdd-border">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-pdd-text">{user?.username}</span>
              {user?.membershipLevel !== 'free' && <span className="text-[10px] text-pdd-primary-light">{user?.membershipLevel === 'enterprise' ? '企业版' : '专业版'}</span>}
            </div>
            <button onClick={logout} className="p-2 text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 rounded-lg transition-all">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-pdd-border bg-pdd-bg">
            {tabs.map(tab => (
              <div key={tab.path} onClick={() => navigate(tab.path)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                  activeTab === tab.path
                    ? 'bg-pdd-primary/20 text-pdd-primary-light border border-pdd-primary/20'
                    : 'bg-pdd-card text-pdd-text-secondary hover:text-pdd-text border border-transparent'
                }`}>
                <span>{tab.label}</span>
                {tabs.length > 1 && (
                  <button onClick={e => closeTab(tab.path, e)} className="hover:bg-white/10 rounded p-0.5">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
