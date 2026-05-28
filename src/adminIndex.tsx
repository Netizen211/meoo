import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/index.css';
import LoginPage from './pages/LoginPage';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMembers from './pages/admin/AdminMembers';
import AdminInvite from './pages/admin/AdminInvite';
import AdminData from './pages/admin/AdminData';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import AdminRecharge from './pages/admin/AdminRecharge';
import { AuthProvider, useAuth } from './App';
import { isFullMember } from './utils/permission';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isFullMember(user) || (user?.role !== 'admin' && user?.role !== 'test'))
    return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminApp() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
          <Route path="/users" element={<RequireAdmin><AdminLayout><AdminUsers /></AdminLayout></RequireAdmin>} />
          <Route path="/members" element={<RequireAdmin><AdminLayout><AdminMembers /></AdminLayout></RequireAdmin>} />
          <Route path="/invite" element={<RequireAdmin><AdminLayout><AdminInvite /></AdminLayout></RequireAdmin>} />
          <Route path="/data" element={<RequireAdmin><AdminLayout><AdminData /></AdminLayout></RequireAdmin>} />
          <Route path="/logs" element={<RequireAdmin><AdminLayout><AdminLogs /></AdminLayout></RequireAdmin>} />
          <Route path="/settings" element={<RequireAdmin><AdminLayout><AdminSettings /></AdminLayout></RequireAdmin>} />
          <Route path="/recharge" element={<RequireAdmin><AdminLayout><AdminRecharge /></AdminLayout></RequireAdmin>} />
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
