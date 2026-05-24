# 店分析平台 - 全面排查修复计划

## Context
用户要求对"店分析"拼多多商家数据分析平台进行全面排查并修复所有问题。经过完整代码审查，发现以下三类问题需要修复：数据计算Bug、代码结构超标、暗色模式硬编码颜色。

---

## 一、数据计算Bug修复

### 1.1 AmountFilterPanel.tsx - productCost运算符优先级错误
- **文件**: `src/components/AmountFilterPanel.tsx:39`
- **问题**: `parseFloat(...) || 0 * 0.6` 中 `*` 优先级高于 `||`，导致当parseFloat返回有效值时不会乘以0.6
- **修复**: 改为 `(parseFloat(...) || 0) * 0.6`

### 1.2 DashboardPage.tsx - discount计算reduce缺少初始值
- **文件**: `src/pages/DashboardPage.tsx:105`
- **问题**: `filteredOrders.reduce((s, o) => sf(...) + sf(...) + sf(...), 0)` 的回调函数没有累加 `s`，每次只返回当前行的优惠总和而非累计值
- **修复**: 改为 `filteredOrders.reduce((s, o) => s + sf(...) + sf(...) + sf(...), 0)`

### 1.3 CostPage.tsx - compareKpi中discount计算同样缺少累加
- **文件**: `src/pages/CostPage.tsx:70`
- **问题**: 与1.2相同的reduce缺少累加器`s`的问题
- **修复**: 加上`s +`前缀

### 1.4 DashboardPage.tsx - 统一使用safeFloat
- **文件**: `src/pages/DashboardPage.tsx:11`
- **问题**: 自定义了`sf`函数，与其他页面使用的`TimeFilter.safeFloat`重复
- **修复**: 删除`sf`函数定义，从`../components/TimeFilter`导入`safeFloat`，全文替换`sf(`为`safeFloat(`

---

## 二、DashboardPage.tsx 拆分（696行 → ~200行）

将DashboardPage拆分为以下独立组件文件：

### 2.1 新建 `src/components/dashboard/KpiPanel.tsx` (~120行)
- 提取KPI卡片网格、指标选择器、金额筛选面板
- Props: `kpiCards`, `allKpiCards`, `visibleKpis`, `setVisibleKpis`, `showKpiSelector`, `setShowKpiSelector`, `amountFilters`, `setAmountFilters`, `noData`, `filteredOrders`, `setDetailModal`

### 2.2 新建 `src/components/dashboard/PromoPanel.tsx` (~80行)
- 提取推广分析图表和TOP5商品列表
- Props: `promoTrendData`, `topPromoProducts`, `rangeLabel`

### 2.3 新建 `src/components/dashboard/TrendPanel.tsx` (~50行)
- 提取收入趋势ComposedChart
- Props: `revenueTrend`, `noData`, `rangeLabel`

### 2.4 新建 `src/components/dashboard/StatusPanel.tsx` (~50行)
- 提取订单状态分布PieChart
- Props: `statusDist`, `noData`

### 2.5 新建 `src/components/dashboard/OrderTablePanel.tsx` (~120行)
- 提取订单明细表格、列显隐、排序、分页
- Props: `tableData`, `columns`, `hiddenCols`, `pinnedCols`, `colWidths`, `sortField`, `sortDesc`, `currentPage`, `totalPages`, 各种handler

### 2.6 新建 `src/components/dashboard/DetailModal.tsx` (~60行)
- 提取详情弹窗
- Props: `detailModal`, `setDetailModal`

### 2.7 重写 `src/pages/DashboardPage.tsx` (~200行)
- 保留所有useMemo数据计算逻辑
- 保留面板拖拽排序逻辑
- 导入上述6个子组件进行组装
- 保留工具栏（搜索、筛选、时间范围、导出等）

---

## 三、PromotionPage.tsx 拆分（493行 → ~150行）

### 3.1 新建 `src/components/promotion/TotalTab.tsx` (~120行)
- 提取合计Tab的KPI卡片、渠道分布图、利润计算
- Props: `totalKpiData`, `channelData`, `profitData`, `rangeLabel`

### 3.2 新建 `src/components/promotion/ProductTab.tsx` (~100行)
- 提取商品推广Tab的KPI、趋势图、TOP10表格
- Props: `productKpiData`, `trendData`, `topProducts`, `rangeLabel`

### 3.3 新建 `src/components/promotion/StarTab.tsx` (~50行)
- 提取明星店铺Tab
- Props: `starKpiData`

### 3.4 新建 `src/components/promotion/LiveTab.tsx` (~50行)
- 提取直播推广Tab
- Props: `liveKpiData`

### 3.5 重写 `src/pages/PromotionPage.tsx` (~150行)
- 保留数据计算useMemo
- 保留Tab切换逻辑
- 导入4个子Tab组件

---

## 四、暗色模式硬编码颜色修复

### 4.1 DashboardPage及其子组件
- `bg-white` → `bg-[var(--pdd-card)]`
- `text-[#333]` / `text-[#64748b]` → `text-[var(--pdd-text)]` / `text-[var(--pdd-text-secondary)]`
- `border-[#e2e8f0]` → `border-[var(--pdd-border)]`
- `bg-[#f8fafc]` → `bg-[var(--pdd-bg)]`
- `bg-[#f1f5f9]` → `bg-[var(--pdd-bg)]`
- `hover:bg-[#f1f5f9]` → `hover:bg-[var(--pdd-bg)]`

### 4.2 MainLayout.tsx
- 侧边栏已使用硬编码深色，保持不变（侧边栏始终深色）
- 顶栏和主内容区中的硬编码颜色替换为CSS变量

### 4.3 AmountFilterPanel.tsx
- `bg-white` → `bg-[var(--pdd-card)]`
- 输入框背景已使用`bg-white`，改为`bg-[var(--pdd-card)]`

### 4.4 其他页面（CostPage/AfterSalePage/ProductPage/RiskPage/PromotionPage）
- 这些页面大部分已使用CSS变量，仅需检查并替换遗漏的硬编码颜色
- 重点关注：`bg-white`、`text-[#333]`、`border-[#e2e8f0]`、`bg-[#f8fafc]`、`hover:bg-[#fff2e8]`

---

## 五、执行顺序

1. **先修数据计算Bug**（1.1-1.4）— 影响数据准确性，优先级最高
2. **拆分DashboardPage**（2.1-2.7）— 创建新组件文件，重写主页面
3. **拆分PromotionPage**（3.1-3.5）— 同上
4. **修复暗色模式**（4.1-4.4）— 在所有文件中替换硬编码颜色
5. **运行 `pnpm run dev` 验证编译通过**
6. **更新 AGENTS.md 路由映射表**（如有新增组件路径）

---

## 六、验证方式

1. `pnpm run dev` 编译无错误
2. 访问各页面确认功能正常：
   - Dashboard: KPI卡片显示、金额筛选、图表渲染、表格分页
   - Product: 商品列表、拖拽排序、对比功能
   - Cost/AfterSale: 时间筛选、金额筛选、图表
   - Promotion: Tab切换、各渠道数据
   - Risk: 风险评分、异常订单
3. 切换暗色模式确认所有页面颜色正常
4. 上传测试数据验证计算结果准确
