# 代码冗余数据清理计划

> **目标:** 轻度清理 — 只删除明显冗余数据、未使用的状态变量、重复计算逻辑
> **原则:** 不拆分文件、不重构架构、不改变功能，只删冗余

## 项目现状

- src 目录总磁盘空间: **672 KB**
- src 目录总代码量: **10,717 行**

### 目录空间分布

| 目录 | 空间 | 占比 |
|------|------|------|
| src/pages/ | 456 KB | 67.9% |
| src/components/ | 160 KB | 23.8% |
| src/App.tsx | 24 KB | 3.6% |
| src/hooks/ | 8 KB | 1.2% |
| src/utils/ | 8 KB | 1.2% |
| src/styles/ | 8 KB | 1.2% |

### 各文件详细空间占用

**页面文件 (src/pages/) — 共 456 KB:**

| 文件 | 空间 | 行数 |
|------|------|------|
| DashboardPage.tsx | 43 KB | 688 |
| CostManagementPage.tsx | 33 KB | 671 |
| ProductPage.tsx | 30 KB | 482 |
| PromotionPage.tsx | 30 KB | 492 |
| ProductLinksPage.tsx | 25 KB | 358 |
| LogisticsPage.tsx | 24 KB | 312 |
| RegionPage.tsx | 24 KB | 288 |
| StoresPage.tsx | 23 KB | 450 |
| UploadPage.tsx | 23 KB | 402 |
| AfterSalePage.tsx | 23 KB | 230 |
| SettingsPage.tsx | 22 KB | 447 |
| UserPage.tsx | 21 KB | 357 |
| TrendPage.tsx | 20 KB | 330 |
| AdminPages.tsx | 17 KB | 326 |
| CostPage.tsx | 17 KB | 276 |
| RiskPage.tsx | 16 KB | 271 |
| MembershipPage.tsx | 5.4 KB | 136 |
| RegisterPage.tsx | 7.2 KB | 152 |
| InsurancePage.tsx | 9 KB | 156 |
| LoginPage.tsx | 5.1 KB | 117 |

**组件文件 (src/components/) — 共 160 KB:**

| 文件 | 空间 | 行数 |
|------|------|------|
| MainLayout.tsx | 23 KB | 411 |
| TimeFilter.tsx | 21 KB | 434 |
| FilterBar.tsx | 15 KB | 309 |
| DataGrid.tsx | 11 KB | 238 |
| FilterPanel.tsx | 11 KB | 284 |
| ProductLinkStats.tsx | 7.9 KB | 181 |
| ProductLinkChart.tsx | 7.6 KB | 157 |
| ExportButton.tsx | 7.4 KB | 195 |
| MetricCard.tsx | 6.6 KB | 195 |
| SearchBox.tsx | 6.3 KB | 160 |
| DataTable.tsx | 8.7 KB | 214 |
| KpiCard.tsx | 4.9 KB | 131 |
| ChartContainer.tsx | 3.0 KB | 84 |
| AdminLayout.tsx | 3.1 KB | 68 |

**其他文件:**

| 文件 | 空间 | 行数 |
|------|------|------|
| App.tsx | 22 KB | 523 |
| useTheme.ts | 2.0 KB | 76 |
| utils/index.ts | 1.5 KB | 44 |
| styles/index.css | 1.6 KB | 65 |

---

## 清理清单

### 1. DashboardPage.tsx (688行) — 可清理约 80 行

**冗余状态变量:**
- `draggedPanel` / `panelOrder` / `handleDragStart` / `handleDragOver` / `handleDragEnd` — 拖拽排序功能，与原生 HTML draggable 重复实现，且拖拽体验不佳，可删除约 30 行
- `colWidths` / `startResize` — 列宽拖拽调整功能，实际使用中很少用到，可删除约 15 行
- `pinnedCols` / `togglePin` — 列钉住功能，与 hiddenCols 功能重叠，可删除约 15 行
- `isRefreshing` / `handleRefresh` / `lastRefresh` — 刷新按钮只是 setTimeout 1秒后更新时间戳，无实际刷新逻辑，可删除约 10 行
- `exportJSON` — JSON 导出功能与 exportCSV 功能重叠，大部分用户只需要 CSV，可删除约 10 行

**重复计算:**
- `promoKpi` 中的 `inquiryCost/favoriteCost/followCost/avgInquiryCost/avgFavoriteCost/avgFollowCost` — 询单/收藏/关注相关指标在 Dashboard 中展示意义不大（这些是推广页面的核心指标），可删除约 15 行计算 + 3 个 KPI 卡片

### 2. PromotionPage.tsx (492行) — 可清理约 60 行

**冗余计算:**
- `productKpiData` — 与 `totalKpiData` 大量重复计算（totalCost/promoOrders/promoGMV/roi/ctr/cvr/cpc/cpa），商品推广 tab 的 KPI 几乎与合计 tab 完全一样，只是数据源不同。可合并为通用函数，删除约 40 行重复计算
- `profitData` 中的 `rawCost` 计算 — `Object.values(currentDisplayData.productCosts || {})` 这个字段在 StoreDataItem 中不存在，永远返回 0，可删除

### 3. ProductPage.tsx (482行) — 可清理约 40 行

**冗余功能:**
- `productTags` / `tagInput` / `taggingProduct` / `addTag` / `removeTag` — 商品标签功能，标签数据不持久化（只存 useState），刷新即丢失，实际无意义，可删除约 20 行
- `compareProducts` / `showCompare` / `compareData` / `toggleCompare` — 商品对比功能，最多选5个商品做简单表格对比，信息量低，可删除约 15 行
- `inventory` / `inventoryStatus` — 库存数据是 `Math.max(0, Math.round(d.sales * 1.5))` 纯估算，不是真实库存，展示误导性大，可删除约 5 行

### 4. UserPage.tsx (357行) — 可清理约 30 行

**冗余功能:**
- `userTags` / `showTagModal` / `newTag` / `addTag` — 用户标签管理，与 ProductPage 的标签问题一样，不持久化，可删除约 15 行
- `valuePrediction` — 用户价值预测数据使用 `Math.random()` 生成，完全无意义，可删除约 10 行
- `payData` — 支付方式分布，大部分订单支付方式字段为空，数据质量差，可删除约 5 行

### 5. TrendPage.tsx (330行) — 可清理约 20 行

**冗余功能:**
- `showPrediction` / `predictionData` — 预测数据只是 `avgGmv * (1 + i * 0.02)` 简单线性增长，无实际预测价值，可删除约 10 行
- `METRIC_LINKS` — 指标联动选择逻辑，选择一个指标自动关联其他指标，实际使用中用户手动选择更直观，可删除约 5 行
- `holidayImpact` / `HOLIDAYS` — 节假日影响分析，硬编码了2026年节假日日期，数据不准确，可删除约 5 行

### 6. App.tsx (523行) — 可清理约 15 行

**冗余数据:**
- `legacyData` 迁移逻辑 (284-310行) — 从旧版 `dianfx_parsed_data` 迁移数据的代码，现在已无用户使用旧版，可删除约 25 行
- `_totalCount` 保存逻辑 (359-366行) — 保存数据时记录原始总数，但从未在任何页面读取使用，可删除约 8 行

### 7. CostManagementPage.tsx (671行) — 可清理约 20 行

**冗余功能:**
- `pricingPresets` / `pricingForm` / `suggestedPrice` / `handleSavePricing` — 新品定价预设功能，保存的预设数据只有 name/code/rawCost/suggestedPrice，信息过于简单，实际定价需要更多参数，可删除约 15 行
- `expandedPrices` / `togglePriceExpand` / `getPriceDistribution` — 价格分布展开功能，大部分 SKU 只有1-2个价格，展开后信息量极低，可删除约 5 行

### 8. 其他文件 — 可清理约 10 行

- RegionPage: `penetration` 计算逻辑有误（`d.buyers / new Set(...).size` 中 buyers 是 number 不是 Set），可修正或删除
- RiskPage: `riskScore` 计算中 `asRate * 1.5 + rfRate * 2 + ovRate * 1.2` 权重硬编码，无实际参考价值，但作为简单评分尚可保留

---

## 预估清理效果

| 文件 | 当前行数 | 预估删除 | 清理后 |
|------|---------|---------|--------|
| DashboardPage | 688 | ~80 | ~608 |
| PromotionPage | 492 | ~60 | ~432 |
| ProductPage | 482 | ~40 | ~442 |
| UserPage | 357 | ~30 | ~327 |
| TrendPage | 330 | ~20 | ~310 |
| App.tsx | 523 | ~33 | ~490 |
| CostManagementPage | 671 | ~20 | ~651 |
| 其他 | ~6834 | ~10 | ~6824 |
| **总计** | **10717** | **~293** | **~10424** |

清理约 **293 行**（2.7%），总代码量从 10,717 降至约 10,424。

---

## 执行步骤

1. DashboardPage.tsx — 删除拖拽排序、列宽调整、列钉住、刷新按钮、JSON导出、询单/收藏/关注KPI
2. PromotionPage.tsx — 删除 productKpiData 重复计算，合并为通用函数；删除 profitData.rawCost
3. ProductPage.tsx — 删除商品标签、商品对比、库存估算
4. UserPage.tsx — 删除用户标签、价值预测(Math.random)、支付方式分布
5. TrendPage.tsx — 删除预测数据、指标联动、节假日影响
6. App.tsx — 删除旧版数据迁移逻辑、_totalCount保存
7. CostManagementPage.tsx — 删除定价预设、价格分布展开
8. RegionPage.tsx — 修正或删除 penetration 计算错误
9. 运行 pnpm run dev 验证编译无误