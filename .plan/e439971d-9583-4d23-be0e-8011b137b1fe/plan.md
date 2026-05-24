# src/ 目录磁盘空间详细报告

## 总览

| 指标 | 数值 |
|------|------|
| **总磁盘空间** | 672 KB |
| **总代码行数** | 10,717 行 |
| **文件数量** | 39 个文件 |

---

## 目录分布

| 目录 | 空间 | 占比 | 行数 | 文件数 |
|------|------|------|------|--------|
| `src/pages/` | 456 KB | 67.9% | 6,834 | 20 |
| `src/components/` | 160 KB | 23.8% | 2,871 | 14 |
| `src/App.tsx` | 22 KB | 3.3% | 523 | 1 |
| `src/hooks/` | 2.0 KB | 0.3% | 76 | 1 |
| `src/utils/` | 1.5 KB | 0.2% | 44 | 1 |
| `src/styles/` | 1.6 KB | 0.2% | 65 | 1 |
| `src/index.tsx` | 267 B | 0.04% | 8 | 1 |

---

## Pages 文件详情（按空间排序）

| 文件 | 空间 | 行数 | 占pages% |
|------|------|------|----------|
| DashboardPage.tsx | 43 KB | 688 | 9.4% |
| CostManagementPage.tsx | 33 KB | 671 | 7.2% |
| ProductPage.tsx | 30 KB | 482 | 6.6% |
| PromotionPage.tsx | 30 KB | 492 | 6.6% |
| ProductLinksPage.tsx | 25 KB | 358 | 5.5% |
| LogisticsPage.tsx | 24 KB | 312 | 5.3% |
| RegionPage.tsx | 24 KB | 288 | 5.3% |
| StoresPage.tsx | 23 KB | 450 | 5.0% |
| UploadPage.tsx | 23 KB | 402 | 5.0% |
| AfterSalePage.tsx | 23 KB | 230 | 5.0% |
| SettingsPage.tsx | 22 KB | 447 | 4.8% |
| UserPage.tsx | 21 KB | 357 | 4.6% |
| TrendPage.tsx | 20 KB | 330 | 4.4% |
| AdminPages.tsx | 17 KB | 326 | 3.7% |
| CostPage.tsx | 17 KB | 276 | 3.7% |
| RiskPage.tsx | 16 KB | 271 | 3.5% |
| InsurancePage.tsx | 9.0 KB | 155 | 2.0% |
| RegisterPage.tsx | 7.2 KB | 152 | 1.6% |
| MembershipPage.tsx | 5.4 KB | 136 | 1.2% |
| LoginPage.tsx | 5.1 KB | 117 | 1.1% |

---

## Components 文件详情（按空间排序）

| 文件 | 空间 | 行数 | 占components% |
|------|------|------|---------------|
| MainLayout.tsx | 23 KB | 411 | 14.4% |
| TimeFilter.tsx | 21 KB | 434 | 13.1% |
| FilterBar.tsx | 15 KB | 309 | 9.4% |
| DataGrid.tsx | 11 KB | 238 | 6.9% |
| FilterPanel.tsx | 11 KB | 284 | 6.9% |
| DataTable.tsx | 8.7 KB | 214 | 5.4% |
| ProductLinkStats.tsx | 7.9 KB | 181 | 4.9% |
| ProductLinkChart.tsx | 7.6 KB | 157 | 4.8% |
| ExportButton.tsx | 7.4 KB | 195 | 4.6% |
| MetricCard.tsx | 6.6 KB | 195 | 4.1% |
| SearchBox.tsx | 6.3 KB | 160 | 3.9% |
| KpiCard.tsx | 4.9 KB | 131 | 3.1% |
| ChartContainer.tsx | 3.0 KB | 84 | 1.9% |
| AdminLayout.tsx | 3.1 KB | 68 | 1.9% |

---

## 其他文件

| 文件 | 空间 | 行数 |
|------|------|------|
| App.tsx | 22 KB | 523 |
| useTheme.ts | 2.0 KB | 76 |
| index.css | 1.6 KB | 65 |
| index.ts (utils) | 1.5 KB | 44 |
| index.tsx | 267 B | 8 |

---

## 空间-行数比率分析

平均每行代码占用空间约 **0.063 KB (63字节)**，这与 TypeScript/JSX 源码的典型密度一致。

### 空间效率异常文件（行数少但空间大）

| 文件 | 空间 | 行数 | KB/行 | 说明 |
|------|------|------|-------|------|
| AfterSalePage.tsx | 23 KB | 230 | 0.100 | 行较宽/含长字符串 |
| StoresPage.tsx | 23 KB | 450 | 0.051 | 正常 |
| DashboardPage.tsx | 43 KB | 688 | 0.063 | 正常 |

### 空间效率最佳文件（行数多但空间小）

| 文件 | 空间 | 行数 | KB/行 | 说明 |
|------|------|------|-------|------|
| StoresPage.tsx | 23 KB | 450 | 0.051 | 代码较紧凑 |
| SettingsPage.tsx | 22 KB | 447 | 0.049 | 代码较紧凑 |

---

## TOP 5 空间占用大户

1. **DashboardPage.tsx** — 43 KB (6.4% of src/)
2. **CostManagementPage.tsx** — 33 KB (4.9%)
3. **ProductPage.tsx** — 30 KB (4.5%)
4. **PromotionPage.tsx** — 30 KB (4.5%)
5. **MainLayout.tsx** — 23 KB (3.4%)

这5个文件合计 **159 KB**，占 src/ 总空间的 **23.7%**。

---

## 轻度清理建议（仅删明显冗余）

基于之前的分析，约 293 行冗余代码可清理，预计节省约 **18 KB**：

| 文件 | 可删行数 | 预计节省空间 | 冗余内容 |
|------|----------|-------------|---------|
| DashboardPage.tsx | ~80行 | ~5 KB | 拖拽排序、列宽调整、列固定、刷新按钮、JSON导出、询盘/收藏/关注KPI |
| PromotionPage.tsx | ~60行 | ~3.8 KB | productKpiData重复计算、rawCost恒为0 |
| ProductPage.tsx | ~40行 | ~2.5 KB | 商品标签(未持久化)、商品对比(低价值)、库存估算(假数据) |
| UserPage.tsx | ~30行 | ~1.9 KB | 用户标签(未持久化)、Math.random价值预测、支付方式分布(数据质量差) |
| TrendPage.tsx | ~20行 | ~1.3 KB | 简单线性预测、指标链接、硬编码节假日 |
| App.tsx | ~33行 | ~2.1 KB | 遗留数据迁移逻辑、_totalCount保存逻辑 |
| CostManagementPage.tsx | ~20行 | ~1.3 KB | 过简定价预设、低价值价格分布展开 |
| 其他零散 | ~10行 | ~0.6 KB | 各处小冗余 |

**清理后预估**: 672 KB → ~654 KB，10,717行 → ~10,424行