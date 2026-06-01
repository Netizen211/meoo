# 数据库设置

## 概览
创建用户资料表、RLS 策略和自动创建触发器，确保认证系统正常工作。

## 核心表结构

### profiles 表
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### RLS 策略
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的资料
CREATE POLICY "用户可以查看自己的资料" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 用户可以更新自己的资料
CREATE POLICY "用户可以更新自己的资料" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户可以插入自己的资料（用于触发器）
CREATE POLICY "用户可以插入自己的资料" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### 自动创建 Profile 触发器（含自动确认邮箱）
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  -- 自动确认用户邮箱
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = new.id;
  
  -- 创建用户资料
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 创建默认管理员用户（可选）
```sql
-- 创建 admin 用户，密码为 admin
-- 注意：此操作需要超级用户权限，在生产环境请修改默认密码
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@auth.local',
  crypt('admin', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"admin"}'::jsonb,
  false
) ON CONFLICT (email) DO NOTHING;
```

## 执行步骤
1. 使用 CloudApplyMigration 工具执行上述 SQL
2. 验证 profiles 表创建成功
3. 测试触发器：注册新用户后检查 profiles 表是否自动创建记录
4. 如需默认用户，执行管理员用户创建 SQL

## 注意事项
- **禁止修改 auth schema**: 所有操作在 public schema 中进行
- **SECURITY DEFINER**: 触发器函数必须使用 security definer，search_path 需包含 public, auth
- **RLS 必须启用**: 所有用户相关表都必须启用行级安全
- **级联删除**: profiles 表使用 ON DELETE CASCADE 确保数据一致性
- **自动确认**: 触发器会自动设置 email_confirmed_at，用户注册后即可立即登录
- **默认用户**: 可选创建 admin/admin 默认用户用于测试，生产环境请修改密码
