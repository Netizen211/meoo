# 主题系统重构计划

## 问题诊断

### 当前配色割裂问题
1. **命名混乱**：`--pdd-red` 实际是紫色 (#6366f1)，命名与实际颜色不符
2. **深浅模式切换不协调**：
   - 亮色模式下侧边栏是浅灰色，但内容区卡片使用深色文字
   - 暗色模式下侧边栏变深，但部分组件仍硬编码浅色
3. **硬编码颜色泛滥**：组件中大量使用 `#1a1d2e`、`#94a3b8` 等硬编码值
4. **Tailwind 配置与 CSS 变量不同步**：tailwind.config.js 只定义了暗色主题颜色

### 截图反映的具体问题
- 亮色模式：侧边栏 `#f1f5f9` 与内容区白色卡片不协调
- 暗色模式：侧边栏 `#131520` 与顶部栏 `#1a1d2e` 有色差
- 主色调不统一：同时存在 indigo、purple、red 等多种强调色

---

## 重构方案

### 阶段一：建立独立主题系统（高优先级）

#### 1.1 创建主题配置文件
**文件**: `src/themes/theme-config.ts`
- 定义完整的主题令牌（tokens）
- 支持 Light/Dark 两套配色
- 主色调统一为拼多多红色系

#### 1.2 重构 CSS 变量系统
**文件**: `src/styles/theme.css`（新建，替换 index.css 中的变量）

```
Light Theme (拼多多风格):
- 背景: #f5f5f5 (neutral-100)
- 卡片: #ffffff
- 侧边栏: #ffffff (纯白卡片式)
- 边框: #e5e5e5 (neutral-200)
- 主文字: #1f2937 (gray-800)
- 次文字: #6b7280 (gray-500)
- 主色: #e02e24 (拼多多红)
- 主色浅: #ef4444 (red-500)
- 主色深: #c41e14 (深红)

Dark Theme:
- 背景: #0a0a0a (neutral-950)
- 卡片: #171717 (neutral-900)
- 侧边栏: #0a0a0a (neutral-950)
- 边框: #262626 (neutral-800)
- 主文字: #f5f5f5 (neutral-100)
- 次文字: #a3a3a3 (neutral-400)
- 主色: #ef4444 (red-500)
- 主色浅: #f87171 (red-400)
- 主色深: #dc2626 (red-600)
```

#### 1.3 更新 Tailwind 配置
**文件**: `tailwind.config.js`
- 同步 CSS 变量到 Tailwind colors
- 移除硬编码的 pdd 颜色对象
- 使用 CSS 变量引用

### 阶段二：组件颜色统一（中优先级）

#### 2.1 修复 MainLayout.tsx
- 侧边栏背景使用 `var(--pdd-sidebar)`
- 移除硬编码的 `bg-gradient-to-br from-indigo-500 to-purple-600`，统一为拼多多红色系
- Tab 栏颜色统一

#### 2.2 修复 KpiCard.tsx
- 移除硬编码颜色 `#1a1d2e`、`#94a3b8`、`#64748b`
- 使用 CSS 变量

#### 2.3 全局搜索替换
- 搜索所有 `#1a1d2e`、`#131520`、`#0f1117`、`#2a2d3e`
- 替换为对应的 CSS 变量

### 阶段三：主题切换优化（中优先级）

#### 3.1 优化 useTheme.ts
- 添加主题切换过渡动画
- 确保所有组件正确响应主题变化

#### 3.2 添加主题持久化
- localStorage 保存用户主题偏好
- 支持系统主题自动适配

### 阶段四：扩展性设计（低优先级）

#### 4.1 主题扩展接口
```typescript
// src/themes/types.ts
export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    background: string;
    card: string;
    sidebar: string;
    text: string;
    textSecondary: string;
    border: string;
  };
}
```

#### 4.2 支持多主题切换
- 预留接口支持未来添加新主题（如高对比度、护眼模式等）

---

## 文件修改清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `src/themes/theme-config.ts` | 新建 | 主题配置中心 |
| `src/themes/types.ts` | 新建 | 主题类型定义 |
| `src/styles/theme.css` | 新建 | 主题变量定义 |
| `src/styles/index.css` | 修改 | 整合 theme.css |
| `tailwind.config.js` | 修改 | 同步主题变量 |
| `src/hooks/useTheme.ts` | 修改 | 优化主题切换逻辑 |
| `src/components/MainLayout.tsx` | 修改 | 修复硬编码颜色 |
| `src/components/KpiCard.tsx` | 修改 | 修复硬编码颜色 |
| `src/components/MetricCard.tsx` | 修改 | 检查并修复 |
| `src/components/FilterBar.tsx` | 修改 | 检查并修复 |

---

## 验收标准

1. 亮色/暗色模式切换时，所有组件颜色协调一致
2. 无硬编码颜色值（除特殊情况外）
3. 主题系统独立，新增主题只需修改配置文件
4. 切换主题时无闪烁
5. 所有文字在两种模式下都有良好对比度

---

## 风险评估

- **低风险**：CSS 变量重构，不影响业务逻辑
- **中风险**：颜色替换可能遗漏，需要全面测试
- **建议**：分阶段实施，每阶段完成后验证
