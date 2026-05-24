# 售后数据集成 + 全功能售后中心实施计划

## 目标
1. 新增独立售后数据上传解析（售后数据.xlsx）
2. 重构 AfterSalePage 为全功能售后中心
3. 将售后数据关联到所有相关页面（商品分析、仪表盘、趋势、风险预警等）
4. 用新上传的数据替换旧数据进行测试

---

## Step 1: App.tsx 数据层扩展

**文件**: `src/App.tsx`

### 1.1 StoreDataItem 接口新增字段（~第189行）
```typescript
interface StoreDataItem {
  orders: any[];
  promotionSummary: any[];
  promotionProducts: any[];
  starStoreSummary: any[];
  liveStreamSummary: any[];
  shippingInsurance: any[];
  afterSaleRecords: any[];  // 新增
  availableFields: { csv: Set<string>; promotion: Set<string>; insurance: Set<string>; afterSale: Set<string> };  // 新增afterSale
}
```

### 1.2 EMPTY_STORE_DATA 初始化（~第269行）
添加 `afterSaleRecords: []` 和 `availableFields.afterSale: new Set()`

### 1.3 数据存储/读取逻辑
- storeDataMap 序列化/反序列化时包含 afterSaleRecords
- deleteUploadRecord 中添加售后数据类型删除处理（~第486行）

---

## Step 2: UploadPage.tsx 售后数据上传解析

**文件**: `src/pages/UploadPage.tsx`

### 2.1 FILE_TYPE_RULES 新增规则
```typescript
{ keywords: ['售后', '退款', '退货'], label: '售后数据', icon: '🔄' }
```

### 2.2 detectFileTypeByContent 新增检测
```typescript
if (fieldSet.has('售后编号') && fieldSet.has('订单编号') && fieldSet.has('售后状态')) return '售后数据';
```

### 2.3 REQUIRED_FIELDS 新增
```typescript
'售后数据': ['售后编号', '订单编号', '售后状态', '退款金额']
```

### 2.4 processXlsxFile 新增售后分支
在 sheetType 判断中添加 `售后数据` 分支：
- 按 `售后编号` 去重
- 存入 `existing.afterSaleRecords`
- 更新 `availableFields.afterSale`

### 2.5 数据一致性检测扩展
checkDataConsistency 函数支持售后数据与订单数据的交叉验证（通过订单编号匹配）

---

## Step 3: AfterSalePage.tsx 全功能售后中心重构

**文件**: `src/pages/AfterSalePage.tsx`（完全重写）

### 3.1 数据源切换
- 优先使用 `currentDisplayData.afterSaleRecords`（独立售后数据）
- 降级使用 `orders` 中的售后状态字段（兼容旧数据）

### 3.2 KPI卡片区（5个核心指标）
| 指标 | 计算方式 |
|------|---------|
| 售后订单数 | afterSaleRecords.length |
| 售后率 | 售后数 / 总订单数 × 100 |
| 退款总金额 | sum(退款金额) |
| 平均处理时长 | avg(同意退款时间 - 申请时间)，单位小时 |
| 退货退款率 | 退款类型="退货退款"的数量 / 售后总数 × 100 |

### 3.3 售后趋势图（Recharts LineChart）
- X轴：日期（按天聚合）
- Y轴：售后申请数量
- 多线：退款成功 / 待处理 / 处理中

### 3.4 退款原因分布（Recharts PieChart + 词云标签）
- 统计退款原因字段词频
- 饼图展示TOP8原因占比
- 下方标签云展示所有原因及频次

### 3.5 高售后商品预警表格
- 通过商品ID关联订单数据，计算每个商品的售后率
- 筛选售后率 > 10% 的商品
- 列：商品名称、商品ID、订单数、售后数、售后率、退款金额
- 按售后率降序排列

### 3.6 售后明细列表（可搜索/筛选）
- 搜索框：支持订单号、商品ID、SKU信息模糊搜索
- 筛选器：售后状态、退款类型、时间范围
- 表格列：售后编号、订单编号、商品ID、SKU信息、退款金额、售后状态、退款原因、申请时间、处理时长
- 分页：每页20条

---

## Step 4: ProductLinkStats.tsx 关联独立售后数据

**文件**: `src/components/ProductLinkStats.tsx`

### 4.1 useProductStats Hook 扩展
在订单处理循环之后，添加售后数据关联：
```typescript
const afterSaleRecords = currentDisplayData?.afterSaleRecords || [];
afterSaleRecords.forEach((r: any) => {
  const pid = String(r['商品ID'] || '').trim();
  if (!pid || !stats[pid]) return;
  const s = stats[pid];
  // 仅当独立售后数据存在时覆盖订单中的售后统计
  s.afterSaleCount += 1;
  s.refund += sf(r['退款金额']);
  const status = String(r['售后状态'] || '未知');
  s.afterSaleBreakdown[status] = (s.afterSaleBreakdown[status] || 0) + 1;
});
```

### 4.2 重新计算售后率
在 derived metrics 循环中，如果 hasAfterSaleData 为 true，使用独立售后数据计算的 afterSaleCount

---

## Step 5: 其他页面适配新售后数据源

### 5.1 DashboardPage.tsx
- 售后率/退款率KPI改用 afterSaleRecords 计算
- 保留降级逻辑（无独立售后数据时从orders提取）

### 5.2 TrendPage.tsx
- 售后趋势数据改用 afterSaleRecords 按申请时间聚合

### 5.3 RiskPage.tsx
- 高售后率商品预警改用 afterSaleRecords + 商品ID关联

### 5.4 ProductPage.tsx / ProductLinksPage.tsx
- 已通过 ProductLinkStats 自动获取，无需额外修改

---

## Step 6: 编译验证 + 数据测试

1. `pnpm run dev` 确认编译通过
2. 清空旧数据，重新上传新数据文件：
   - 订单.csv → 订单数据
   - 商品推广_分天数据.xlsx → 商品推广数据
   - 售后数据.xlsx → 售后数据
   - 运费险.xlsx → 运费险数据
3. 验证售后中心页面数据展示正确
4. 验证商品分析页面的售后指标已关联

---

## 文件修改清单

| 文件 | 操作 | 改动量 |
|------|------|--------|
| src/App.tsx | Edit | 小（接口+初始化+删除逻辑） |
| src/pages/UploadPage.tsx | Edit | 中（新增类型+解析+检测） |
| src/pages/AfterSalePage.tsx | Write | 大（完全重写为全功能售后中心） |
| src/components/ProductLinkStats.tsx | Edit | 中（关联售后数据） |
| src/pages/DashboardPage.tsx | Edit | 小（数据源切换） |
| src/pages/TrendPage.tsx | Edit | 小（数据源切换） |
| src/pages/RiskPage.tsx | Edit | 小（数据源切换） |
