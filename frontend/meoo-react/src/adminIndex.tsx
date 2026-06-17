import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminLayout from './components/AdminLayout';
import { AuthProvider, useAuth } from './App';
import { isFullMember } from './utils/permission';
import { getMe } from '../api/authApi';
import { clearTokens, hasTokens } from '../api/client';
import { useAutoReload } from './utils/useAutoReload';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30秒内不重新请求
      retry: 2,                // 失败重试2次
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy-loaded admin pages for code splitting
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminMembers = lazy(() => import('./pages/admin/AdminMembers'));
const AdminInvite = lazy(() => import('./pages/admin/AdminInvite'));
const AdminData = lazy(() => import('./pages/admin/AdminData'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminConfig = lazy(() => import('./pages/admin/AdminConfig'));
const AdminRecharge = lazy(() => import('./pages/admin/AdminRecharge'));
const AdminSubAccounts = lazy(() => import('./pages/admin/AdminSubAccounts'));
const AdminShadow = lazy(() => import('./pages/admin/AdminShadow'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminRevenue = lazy(() => import('./pages/admin/AdminRevenue'));
const AdminSystemInfo = lazy(() => import('./pages/admin/AdminSystemInfo'));
const AdminBehavior = lazy(() => import('./pages/admin/AdminBehavior'));
const AdminModuleRank = lazy(() => import('./pages/admin/AdminModuleRank'));
const AdminFunnel = lazy(() => import('./pages/admin/AdminFunnel'));
const AdminPayConversion = lazy(() => import('./pages/admin/AdminPayConversion'));
const AdminDataQuality = lazy(() => import('./pages/admin/AdminDataQuality'));
const AdminAIMonitor = lazy(() => import('./pages/admin/AdminAIMonitor'));
const AdminUploadMonitor = lazy(() => import('./pages/admin/AdminUploadMonitor'));
const AdminRisk = lazy(() => import('./pages/admin/AdminRisk'));
const AdminProtection = lazy(() => import('./pages/admin/AdminProtection'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));

// Loading component for Suspense fallback
function PageLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ background: 'var(--pdd-bg)' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--pdd-border)', borderTopColor: 'var(--pdd-primary)' }} />
      <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>加载中...</span>
    </div>
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [checking, setChecking] = React.useState(true);
  const [valid, setValid] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function validate() {
      // 先检查是否有 JWT token（内存中）
      if (!hasTokens()) {
        // 没有 token → 需要登录
        if (!cancelled) {
          setChecking(false);
          setValid(false);
        }
        return;
      }

      try {
        const result = await getMe();
        if (!cancelled) {
          if (result.user) {
            // 验证角色
            if (isFullMember(result.user) && (result.user.role === 'admin' || result.user.role === 'test')) {
              setUser(result.user);
              setValid(true);
            } else {
              // 角色不对 → 清除登录状态
              clearTokens();
              localStorage.removeItem('dianfx_user');
              setUser(null as any);
              setValid(false);
            }
          } else {
            // Token 无效 → 清除
            clearTokens();
            localStorage.removeItem('dianfx_user');
            setUser(null as any);
            setValid(false);
          }
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          clearTokens();
          localStorage.removeItem('dianfx_user');
          setUser(null as any);
          setChecking(false);
          setValid(false);
        }
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [setUser]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--pdd-bg)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 mx-auto mb-4" style={{ border: '2px solid var(--pdd-primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--pdd-text-secondary)' }}>验证管理员身份...</p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminApp() {
  useAutoReload('/admin/build-meta.json');
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route path="/" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
          <Route path="/shadow" element={<RequireAdmin><AdminLayout><AdminShadow /></AdminLayout></RequireAdmin>} />
          <Route path="/recharge" element={<RequireAdmin><AdminLayout><AdminRecharge /></AdminLayout></RequireAdmin>} />
          <Route path="/users" element={<RequireAdmin><AdminLayout><AdminUsers /></AdminLayout></RequireAdmin>} />
          <Route path="/sub-accounts" element={<RequireAdmin><AdminLayout><AdminSubAccounts /></AdminLayout></RequireAdmin>} />
          <Route path="/members" element={<RequireAdmin><AdminLayout><AdminMembers /></AdminLayout></RequireAdmin>} />
          <Route path="/invite" element={<RequireAdmin><AdminLayout><AdminInvite /></AdminLayout></RequireAdmin>} />
          <Route path="/data" element={<RequireAdmin><AdminLayout><AdminData /></AdminLayout></RequireAdmin>} />
          <Route path="/announcements" element={<RequireAdmin><AdminLayout><AdminAnnouncements /></AdminLayout></RequireAdmin>} />
          <Route path="/logs" element={<RequireAdmin><AdminLayout><AdminLogs /></AdminLayout></RequireAdmin>} />
          <Route path="/settings" element={<RequireAdmin><AdminLayout><AdminSettings /></AdminLayout></RequireAdmin>} />
          <Route path="/config" element={<RequireAdmin><AdminLayout><AdminConfig /></AdminLayout></RequireAdmin>} />
          <Route path="/revenue" element={<RequireAdmin><AdminLayout><AdminRevenue /></AdminLayout></RequireAdmin>} />
          <Route path="/system" element={<RequireAdmin><AdminLayout><AdminSystemInfo /></AdminLayout></RequireAdmin>} />
          <Route path="/users/:id" element={<RequireAdmin><AdminLayout><AdminUserDetail /></AdminLayout></RequireAdmin>} />
          <Route path="/analytics" element={<RequireAdmin><AdminLayout><AdminBehavior /></AdminLayout></RequireAdmin>} />
          <Route path="/analytics/modules" element={<RequireAdmin><AdminLayout><AdminModuleRank /></AdminLayout></RequireAdmin>} />
          <Route path="/analytics/funnel" element={<RequireAdmin><AdminLayout><AdminFunnel /></AdminLayout></RequireAdmin>} />
          <Route path="/analytics/pay-conversion" element={<RequireAdmin><AdminLayout><AdminPayConversion /></AdminLayout></RequireAdmin>} />
          <Route path="/data-quality" element={<RequireAdmin><AdminLayout><AdminDataQuality /></AdminLayout></RequireAdmin>} />
          <Route path="/monitoring/ai" element={<RequireAdmin><AdminLayout><AdminAIMonitor /></AdminLayout></RequireAdmin>} />
          <Route path="/monitoring/upload" element={<RequireAdmin><AdminLayout><AdminUploadMonitor /></AdminLayout></RequireAdmin>} />
          <Route path="/risk" element={<RequireAdmin><AdminLayout><AdminRisk /></AdminLayout></RequireAdmin>} />
          <Route path="/protection" element={<RequireAdmin><AdminLayout><AdminProtection /></AdminLayout></RequireAdmin>} />
          <Route path="/reports" element={<RequireAdmin><AdminLayout><AdminReports /></AdminLayout></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
    </QueryClientProvider>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<React.StrictMode><AdminApp /></React.StrictMode>);
