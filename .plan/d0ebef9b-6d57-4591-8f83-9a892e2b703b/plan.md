# 金额筛选功能增强计划

## 目标
在核心分析页面（Dashboard、成本、售后、商品）的现有筛选区域中，增加丰富的金额类筛选条件，让用户可以按多种金额维度筛选订单数据。

## 用户选择的筛选维度

### 核心筛选（用户明确选择）
1. **买家实付金额** - 字段：`用户实付金额(元)`，匹配用户实付的金额
2. **实收金额(剔除退款)** - 字段：`商家实收金额(元)` + 售后状态过滤，仅非退款订单的商家实收
3. **买家退款金额** - 仅退款订单的`用户实付金额(元)`
4. **优惠总额** - `店铺优惠折扣(元)` + `平台优惠折扣(元)` + `多多支付立减金额(元)` 合计

### 补充筛选（自动补充的相关金额维度）
5. **邮费金额** - 字段：`邮费(元)`
6. **商品总价** - 字段：`商品总价(元)`
7. **商家实收金额(含退款)** - 字段：`商家实收金额(元)`，不剔除退款订单
8. **商品数量** - 字段：`商品数量(件)`
9. **店铺优惠折扣** - 字段：`店铺优惠折扣(元)`
10. **平台优惠折扣** - 字段：`平台优惠折扣(元)`
11. **多多支付立减** - 字段：`多多支付立减金额(元)`
12. **商品成本** - `商品总价(元)` × 0.6（估算）
13. **利润金额** - `商家实收金额(元)` - 商品成本 - `邮费(元)`
14. **客单价** - `用户实付金额(元)` / 订单数（按单计算）
15. **实收率** - `商家实收金额(元)` / `商品总价(元)`（百分比筛选）
16. **优惠率** - 优惠总额 / `商品总价(元)`（百分比筛选）

## 应用范围
- DashboardPage（数据中心） - 嵌入现有KPI选择器下方筛选区
- CostPage（优惠成本） - 嵌入TimeFilter下方
- AfterSalePage（售后质量） - 嵌入TimeFilter下方
- ProductPage（商品分析） - 嵌入TimeFilter下方

## UI位置
嵌入现有筛选区域，在DashboardPage现有的KPI选择器下方筛选区扩展。其他页面在TimeFilter下方增加筛选面板。

## 实施步骤

### Step 1: 创建通用金额筛选组件
- 文件：`src/components/AmountFilterPanel.tsx`
- 折叠面板设计，默认收起
- 按功能分组显示筛选项
- 每个筛选项：标签 + min/max输入框
- 活跃筛选显示为tag，可单独清除
- 一键清除全部按钮
- 活跃筛选数量badge
- framer-motion动画过渡

### Step 2: DashboardPage增强
- 扩展现有 amountFilters state，增加更多字段
- 在现有筛选UI区域增加新筛选项
- 优化筛选区域UI：分组显示（基础金额、优惠相关、成本利润）
- 在 filteredOrders 逻辑中增加对应的过滤条件
- 保留现有的8个筛选 + 新增补充筛选

### Step 3: CostPage增加金额筛选
- 引入 AmountFilterPanel 组件
- 配置筛选维度：商品总价、优惠总额、邮费、实收率、优惠率、商家实收
- 在 filteredOrders 计算中应用筛选

### Step 4: AfterSalePage增加金额筛选
- 引入 AmountFilterPanel 组件
- 配置筛选维度：买家实付金额、买家退款金额、商家实收金额
- 在订单明细筛选中增加金额维度

### Step 5: ProductPage增加金额筛选
- 引入 AmountFilterPanel 组件
- 配置筛选维度：实收金额、利润金额、客单价、优惠率
- 在商品数据计算中应用筛选

## 修改文件清单

1. **新建** `src/components/AmountFilterPanel.tsx` - 通用金额筛选组件(~200行)
2. **修改** `src/pages/DashboardPage.tsx` - 扩展筛选state和UI，增加筛选字段和逻辑
3. **修改** `src/pages/CostPage.tsx` - 引入AmountFilterPanel，增加金额筛选
4. **修改** `src/pages/AfterSalePage.tsx` - 引入AmountFilterPanel，增加金额筛选
5. **修改** `src/pages/ProductPage.tsx` - 引入AmountFilterPanel，增加金额筛选

## AmountFilterPanel组件设计

```tsx
interface FilterField {
  key: string;
  label: string;
  field: string;        // 数据字段名
  type: 'range' | 'percent_range';  // range=金额范围, percent_range=百分比范围
  compute?: (order: any) => number;  // 自定义计算函数
  filterLogic?: 'exclude_refund' | 'only_refund' | 'normal';  // 筛选逻辑
  group: 'basic' | 'discount' | 'cost' | 'quantity';  // 分组
  hint?: string;  // 提示文字
}

interface AmountFilterPanelProps {
  fields: FilterField[];
  filters: Record<string, { min: string; max: string }>;
  onFiltersChange: (filters: Record<string, { min: string; max: string }>) => void;
  activeCount?: number;
}
```

分组显示：
- 基础金额：买家实付、商家实收(含退款)、实收(剔除退款)、退款金额、商品总价、邮费
- 优惠相关：优惠总额、店铺优惠、平台优惠、多多立减、优惠率
- 成本利润：商品成本、利润金额、实收率
- 数量：商品数量、客单价