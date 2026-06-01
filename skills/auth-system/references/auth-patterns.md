# 认证组件模式

## 概览
React 认证组件的标准实现模式，包括状态管理、表单处理和路由保护。

## 核心状态管理

### AuthProvider 模式
```jsx
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../supabase/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 设置 auth 状态监听
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 检查现有会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

## 注册组件模式

### 基本结构
```jsx
import { useState } from 'react';
import { registerUser } from './auth-utils';

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await registerUser(username, password);

    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <form onSubmit={handleRegister}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? '注册中...' : '注册'}
      </button>
    </form>
  );
}
```

## 登录组件模式

### 基本结构
```jsx
import { useState } from 'react';
import { loginUser } from './auth-utils';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await loginUser(username, password);

    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
```

## 受保护路由模式

### RouteGuard 组件
```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

function RouteGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
```

## 关键注意事项
- **禁止硬编码密码**: 所有密码通过 Supabase Auth 处理，前端不存储或硬编码
- **完整 session 存储**: 同时维护 user 和 session 状态
- **异步回调处理**: onAuthStateChange 回调中只做同步状态更新
- **错误处理**: 所有认证操作必须处理错误并反馈给用户
- **加载状态**: 所有异步操作显示加载状态，防止重复提交
- **导入路径**: supabase 客户端使用相对路径 `../supabase/client` 导入
