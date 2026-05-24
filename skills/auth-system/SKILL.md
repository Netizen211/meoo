---
name: auth-system
description: 实现用户注册、登录和会话管理功能，使用 Supabase Auth
  进行安全的密码加密存储和认证。当用户提到注册、登录、用户认证、账号系统、密码管理、用户中心时必须使用此技能。
dependency:
  npm:
    - "@supabase/supabase-js@^2.39.0"
---

# 用户认证系统

## 任务目标
- 本 Skill 用于: 实现安全的用户注册、登录、登出和会话管理
- 能力: 用户名密码认证、会话持久化、用户资料管理、密码加密存储
- 触发: 用户提到注册、登录、认证、账号、密码、用户中心

## 前置准备
- 依赖: @supabase/supabase-js
- 云服务: 已启用 Meoo Cloud (Supabase)
- 客户端: 从 `src/supabase/client.ts` 导入 supabase 实例

## 操作步骤

### 1. 数据库初始化（必须首先执行）
- **必须先执行** [references/database-setup.md](references/database-setup.md) 中的 SQL 迁移
- 创建 `profiles` 表关联 `auth.users`
- 配置行级安全策略 (RLS)
- 设置自动创建 profile 的触发器（自动确认邮箱）
- **可选**: 创建默认管理员用户（admin/admin）用于测试

### 2. 实现认证组件
- 调用 `scripts/auth-utils.js` 获取认证工具函数
- 实现注册表单（用户名 + 密码）
- 实现登录表单（用户名 + 密码）
- 实现用户状态管理（Session + User）

### 3. 集成到应用
- 在应用入口设置 auth 状态监听
- 实现受保护路由（需要登录才能访问）
- 实现用户信息展示和登出功能

## 资源索引

### 脚本工具
- **[scripts/auth-utils.js](scripts/auth-utils.js)**
  - 用途: 提供注册、登录、登出、获取用户信息等核心认证函数
  - 触发时机: 当需要实现认证逻辑时，**必须调用此脚本**获取标准实现
  - 特性: 使用虚拟邮箱方案实现用户名认证

### 参考文档
- **[references/database-setup.md](references/database-setup.md)**
  - 内容: 数据库表结构、RLS 策略、触发器完整 SQL、默认用户创建
  - 使用时机: 在实现认证功能前，**必须先读取此文档**并执行 SQL 迁移
  - 关键作用: 确保数据库结构正确，profile 自动创建，RLS 策略安全，自动确认邮箱
  - **重要**: 包含可选的默认管理员用户创建 SQL（admin/admin）
- **[references/auth-patterns.md](references/auth-patterns.md)**
  - 内容: React 认证组件模式、状态管理、受保护路由实现
  - 使用时机: 在编写认证 UI 组件前，**必须先读取此文档**
  - 关键作用: 提供标准的认证组件实现模式，避免常见错误

## 注意事项
- **密码安全**: 密码由 Supabase Auth 自动加密存储，**严禁在前端硬编码或明文传输**
- **用户名认证**: 使用虚拟邮箱方案（`username@auth.local`），用户无感知
- **自动确认**: 新用户注册时自动确认邮箱，无需邮件验证即可登录
- **默认用户**: 数据库设置文档包含可选的 admin/admin 默认用户创建 SQL，方便测试
- **会话管理**: 必须存储完整的 session 对象，不仅是 user 对象
- **RLS 策略**: 所有用户相关表必须启用行级安全
- **初始化顺序**: 先设置 auth 状态监听，再检查现有会话
- **附件读取规则**: 实现认证功能前，**必须优先读取** references/ 中的数据库设置和认证模式文档
- **脚本调用规则**: 需要认证工具函数时，**立即调用** scripts/auth-utils.js，不要自行实现