# 全站时间过滤修复 + ROI修复 + 盈利看板 + 售后页面增强

## 问题总结

### A. 时间过滤不一致（4个页面未接入）
| 页面 | 现状 | 需修复 |
|------|------|--------|
| AfterSalePage | 有TimeFilter但未实际过滤数据 + 第1行语法错误(`hiimport`) | 过滤orders和afterSaleRecords |
| RiskPage | 无TimeFilter、无timeRange | 添加完整时间过滤 |
| ProductLinksPage | 无TimeFilter、无timeRange | 添加时间过滤，传入useProductStats |
| CostManagementPage | 无TimeFilter、无timeRange | 添加时间过滤，订单相关tab按时间筛选 |

另外 ProductPage 的 `useProductStats` hook 内部没有时间过滤，导致商品统计数据是全量的。

### B. ROI数值不对
- **根因**：`ProductLinkStats.tsx:330-331` 只取第一条非零ROI，同一商品多条推广计划的ROI被忽略
- **修复**：改为 `总交易额 / 总成交花费` 计算商品级综合ROI

### C. 商品分析盈利看板
- 右侧固定面板，与360°分析面板Tab切换
- 展示盈利评分、预警标签、成本结构、售后原因、运营建议

### D. 售后页面全面增强
售后数据文件(售后数据.xlsx)包含24个字段，当前页面只用了其中一部分。需新增：
- **处理时效分析**：申请→同意退款平均时长、超时预警、处理人效率排名
- **退货物流追踪**：退货运单号状态统计、退货物流时效、快递拦截成功率
- **SKU级售后拆解**：按sku信息维度统计售后率、退款金额，定位具体规格问题
- **详情列表扩展**：增加sku信息、备注、订单标记、同意退款人、退货物流状态等字段

---

## 实施步骤

### Step 1: 修复 AfterSalePage 语法错误 + 接入时间过滤 + 全面增强
**文件**: `src/pages/AfterSalePage.tsx`

#### 1a. 基础修复
1. 修复第1行 `hiimport` → `import`
2. 导入 `filterPromoByTimeRange`
3. 添加 `filteredOrders` 和 `filteredAfterSaleRecords`：
   ```typescript
   const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange), [orders, allDates, timeRange]);
   const filteredAfterSaleRecords = useMemo(() => filterPromoByTimeRange(afterSaleRecords, allDates, timeRange, '申请时间'), [afterSaleRecords, allDates, timeRange]);
   ```
4. 将所有KPI计算、趋势图、详情列表中的数据源替换为过滤后的数据

#### 1b. 新增处理时效分析面板
利用售后数据中的 `申请时间`、`同意退款时间`、`同意退货时间`、`超时时间`、`同意退款人` 字段：
- **平均处理时长**：从申请到同意退款的平均小时数
- **超时预警**：超过24h未处理的售后单数量和占比
- **处理人效率排名**：按 `同意退款人` 分组统计平均处理时长和处理数量（柱状图）
- **处理时长分布**：0-2h / 2-6h / 6-24h / 24h+ 四档占比（饼图）

#### 1c. 新增退货物流追踪面板
利用 `退货运单号`、`退货物流状态`、`退货物流状态对应时间`、`快递拦截状态` 字段：
- **退货物流状态分布**：已揽收/运输中/已签收/异常 等状态占比（饼图）
- **快递拦截成功率**：有拦截记录的售后单中，拦截成功的占比
- **退货物流时效**：从同意退货到物流签收的平均天数

#### 1d. 新增SKU级售后拆解面板
利用 `sku信息` 字段（格式如"二件A组【...】,M【60-80斤】..."）：
- **SKU售后率TOP10**：按sku信息分组，计算每个SKU的售后次数和退款金额（表格）
- **SKU退款金额排名**：按退款总额降序排列（横向柱状图）
- 帮助运营定位具体哪个规格/款式问题最多

#### 1e. 详情列表字段扩展
当前列表列：售后编号、订单编号、退款金额、售后状态、退款类型、退款原因、申请时间
新增列：
- `sku信息` - 商品规格详情
- `订单状态` - 原始订单状态（未发货/已发货等）
- `同意退款人` - 处理人
- `退货物流状态` - 退货包裹状态
- `备注` - 售后备注信息
- `订单标记` - 特殊标记（如测试单等）

#### 1f. 页面布局调整
将页面分为Tab页签组织内容，避免信息过载：
- **概览** Tab：KPI卡片 + 趋势图 + 退款原因饼图（现有内容）
- **处理时效** Tab：处理时长分析 + 处理人排名 + 超时预警
- **退货物流** Tab：物流状态分布 + 拦截成功率 + 物流时效
- **SKU拆解** Tab：SKU售后率TOP10 + 退款金额排名
- **高风险商品** Tab：现有高风险商品预警表
- **明细列表** Tab：扩展字段后的完整详情列表（支持搜索/筛选/分页/导出）

### Step 2: RiskPage 接入时间过滤
**文件**: `src/pages/RiskPage.tsx`

1. 添加 TimeFilter 组件导入和 state（timeRange, granularity, compareEnabled）
2. 添加 `allDates`、`filteredOrders`、`filteredAfterSaleRecords`
3. 将 `productRisk` 等所有 useMemo 中的数据源替换为过滤后的数据
4. 在页面顶部渲染 `<TimeFilter />`

### Step 3: ProductLinksPage 接入时间过滤
**文件**: `src/pages/ProductLinksPage.tsx`

1. 添加 TimeFilter 组件导入和 state
2. 添加 `allDates`、`filteredOrders`
3. 修改 `useProductStats` 调用：传入过滤后的 currentDisplayData（构造一个包含 filteredOrders 的临时对象）
4. 在页面顶部渲染 `<TimeFilter />`

### Step 4: CostManagementPage 接入时间过滤
**文件**: `src/pages/CostManagementPage.tsx`

1. 添加 TimeFilter 组件导入和 state
2. 添加 `allDates`、`filteredOrders`
3. 在"缺编码SKU"和"裸货成本填充"tab中，用 filteredOrders 替代 orders 来生成SKU列表
4. 税务配置、自定义扣费等纯配置tab不需要时间过滤
5. 在页面顶部渲染 `<TimeFilter />`

### Step 5: ProductPage useProductStats 接入时间过滤
**文件**: `src/pages/ProductPage.tsx`

当前 ProductPage 已有 `filteredOrders`，但 `useProductStats(currentDisplayData)` 使用的是全量数据。
修改方式：构造一个 filteredDisplayData 对象传入 hook：
```typescript
const filteredDisplayData = useMemo(() => ({
  ...currentDisplayData,
  orders: filteredOrders,
  afterSaleRecords: filterPromoByTimeRange(currentDisplayData?.afterSaleRecords || [], allDates, timeRange, '申请时间'),
  promotionProducts: filterPromoByTimeRange(currentDisplayData?.promotionProducts || [], allDates, timeRange),
  promotionSummary: filterPromoByTimeRange(currentDisplayData?.promotionSummary || [], allDates, timeRange),
}), [currentDisplayData, filteredOrders, allDates, timeRange]);

const productStats = useProductStats(filteredDisplayData);
```

### Step 6: 修复ROI计算逻辑
**文件**: `src/components/ProductLinkStats.tsx`

1. 移除 `promoProducts.forEach` 中的 `_promoRoiFromData` 赋值（第330-331行）
2. 移除 `promoSummary.forEach` 中的 `_promoRoiFromData` 赋值（第367-368行）
3. 修改最终ROI计算（第503-515行）：
   ```typescript
   if (s.promoCost > 0 && s.promoTransaction > 0) {
     s.roi = s.promoTransaction / s.promoCost;
   } else if (s.promoCost > 0) {
     s.roi = s.revenue / s.promoCost;
   } else {
     s.roi = 0;
   }
   ```
4. 清理 `ProductStat` 接口中的 `_promoRoiFromData` 字段

### Step 7: 增强售后数据维度
**文件**: `src/components/ProductLinkStats.tsx`

1. `ProductStat` 接口新增：
   - `afterSaleReasons: Record<string, number>`
   - `afterSaleTrend: {date: string, count: number}[]`
2. 在售后数据处理循环中提取 `r['售后原因']` 和 `r['申请时间']`
3. 初始化时设置默认值

### Step 8: 新建盈利诊断面板组件
**新文件**: `src/pages/product/ProfitDiagnosisPanel.tsx`

Props: `{ product: ProductStat | null }`

面板内容：
1. **盈利评分**（0-100）：利润率权重30% + 退款率权重25% + 推广占比权重20% + 售后率权重15% + 周转天数权重10%
2. **预警标签区**：
   - 退款率 > 15% → 红色"高退款风险"
   - 利润率 < 0 → 红色"亏损商品"
   - 推广占比 > 30% → 橙色"推广依赖过高"
   - 客单价 < 成本价 → 橙色"售价过低"
   - 周转天数 > 30 → 黄色"库存积压"
   - 售后率 > 10% → 黄色"售后异常"
3. **成本结构**：水平条形图展示 productCost/promoCost/shippingFee/packagingFee/taxes 占比
4. **售后原因TOP3**：列表展示
5. **运营建议**：根据预警自动生成1-3条文字建议

### Step 9: 集成盈利面板到ProductPage
**文件**: `src/pages/ProductPage.tsx`

1. 新增 state: `rightPanelTab: 'analysis' | 'profit'`
2. 在 `renderOverviewPanel` 右侧面板头部添加Tab切换按钮
3. `rightPanelTab === 'analysis'` 时显示现有360°分析内容
4. `rightPanelTab === 'profit'` 时显示 `<ProfitDiagnosisPanel product={...} />`
5. 未选中商品时两个Tab都显示占位提示

### Step 10: 编译验证
运行 `pnpm run dev` 确认无编译错误。

---

## 影响范围
| 文件 | 改动类型 |
|------|---------|
| `src/pages/AfterSalePage.tsx` | 修复语法错误 + 接入时间过滤 |
| `src/pages/RiskPage.tsx` | 新增TimeFilter + 时间过滤 |
| `src/pages/ProductLinksPage.tsx` | 新增TimeFilter + 时间过滤 |
| `src/pages/CostManagementPage.tsx` | 新增TimeFilter + 时间过滤 |
| `src/pages/ProductPage.tsx` | 传入filtered数据给hook + 集成盈利面板Tab |
| `src/components/ProductLinkStats.tsx` | ROI修复 + 售后字段扩展 |
| `src/pages/product/ProfitDiagnosisPanel.tsx` | 新建盈利诊断面板 |
