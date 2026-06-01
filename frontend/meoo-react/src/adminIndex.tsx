import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/index.css';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMembers from './pages/admin/AdminMembers';
import AdminInvite from './pages/admin/AdminInvite';
import AdminData from './pages/admin/AdminData';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import AdminConfig from './pages/admin/AdminConfig';
import AdminRecharge from './pages/admin/AdminRecharge';
import AdminSubAccounts from './pages/admin/AdminSubAccounts';
import AdminShadow from './pages/admin/AdminShadow';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminSystemInfo from './pages/admin/AdminSystemInfo';
import { AuthProvider, useAuth } from './App';
import { isFullMember } from './utils/permission';
import { getMe } from '../api/authApi';
import { clearTokens, hasTokens } from '../api/client';

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0b14' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm" style={{ color: '#6b6b80' }}>验证管理员身份...</p>
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
  return (
    <AuthProvider>
      <HashRouter>
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
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<React.StrictMode><AdminApp /></React.StrictMode>);
