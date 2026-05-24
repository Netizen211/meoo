# 登录持久化修复计划

## 问题分析
当前AuthProvider虽然用localStorage存了`dianfx_user`，但存在以下问题导致刷新后登录状态不稳定：

1. **login/signup时用`Date.now()`生成id** → 每次登录id不同，刷新后恢复的user对象id与dianfx_users里的不匹配
2. **dianfx_users没有存id字段** → 注册用户记录只有username/password/phone/createdAt，缺少id
3. **login函数对普通用户的校验依赖dianfs_users** → 刷新后dianfx_user恢复成功，但若dianfx_users数据丢失则无法重新登录

## 修复方案

### 修改文件：`src/App.tsx`（AuthProvider部分）

1. **signup时存入id字段**：注册时生成固定id，存入dianfx_users
2. **login时使用dianfx_users里的id**：普通用户登录成功后，使用dianfx_users里已存的id而非重新生成
3. **确保dianfx_user恢复后状态完整**：刷新时从localStorage恢复的user对象包含正确的id/username/role/membershipLevel，与注册时一致

### 具体改动（App.tsx AuthProvider部分）

**signup函数**：
- 生成固定id：`user-${Date.now()}`，存入dianfx_users的id字段
- setUser时使用同一个id

**login函数**：
- 普通用户登录成功后，使用dianfx_users里已存的`found.id`而非重新生成`Date.now()`

**效果**：
- 刷新页面时，`dianfx_user`从localStorage恢复 → user对象完整（id/username/role/membershipLevel）
- RequireAuth检查user !== null → 直接通过，不需要重新登录
- 不依赖dianfx_users做任何校验，纯粹靠dianfx_user的持久化