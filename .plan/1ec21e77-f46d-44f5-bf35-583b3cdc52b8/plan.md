# 推广数据展示优化与增强计划

## 一、需求分析

### 当前状态
- ✅ 已修复文件类型检测问题，推广数据可正常上传
- ✅ 已在数据中心添加推广花费、推广GMV、推广ROI三个指标
- ⚠️ 指标展示样式需要优化
- ⚠️ 缺少更多推广相关分析内容

### 可添加的推广分析内容

#### 1. 数据中心页面增强
**推广趋势图表**
- 推广花费与GMV趋势对比图（折线图）
- 推广ROI变化趋势（柱状图+折线图组合）
- 推广渠道占比饼图

**推广效率分析**
- 点击率（CTR）趋势
- 转化率（CVR）趋势
- 平均点击成本（CPC）
- 平均获客成本（CPA）

**推广商品TOP榜**
- 花费TOP10商品
- ROI TOP10商品
- 转化率TOP10商品

#### 2. 推广利润页面增强
**推广渠道对比**
- 商品推广 vs 明星店铺 vs 直播推广
- 各渠道花费、GMV、ROI对比表
- 渠道效率雷达图

**推广时段分析**
- 按小时分布的推广效果
- 按星期分布的推广效果
- 最佳推广时段推荐

**推广成本结构**
- 推广花费占商家实收比例
- 推广成本与净利润关系
- 推广效率评分

#### 3. 指标卡片样式优化
**视觉层次**
- 推广相关指标使用统一的红色系配色
- 添加图标和趋势箭头
- 支持点击查看详情

**交互增强**
- 悬停显示详细数据
- 点击跳转到推广利润页面
- 支持数据对比（环比/同比）

## 二、实施计划

### 阶段一：数据中心推广分析增强

#### 1.1 添加推广趋势图表
**文件**：`src/pages/DashboardPage.tsx`

**新增内容**：
- 推广花费与GMV趋势图（ComposedChart）
- 推广ROI趋势图（LineChart）
- 推广渠道占比饼图（PieChart）

**数据计算**：
```typescript
const promoTrendData = useMemo(() => {
  if (!parsedData?.promotionSummary?.length) return [];
  const byDate: Record<string, { cost: number; gmv: number; roi: number }> = {};
  parsedData.promotionSummary.forEach((r: any) => {
    const d = String(r['日期'] || '').trim();
    if (!d) return;
    if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0, roi: 0 };
    byDate[d].cost += sf(r['总花费(元)'] || r['花费(元)']);
    byDate[d].gmv += sf(r['交易额(元)'] || r['成交金额(元)']);
  });
  return Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([d, v]) => ({
      date: d.slice(5),
      cost: Math.round(v.cost),
      gmv: Math.round(v.gmv),
      roi: v.cost > 0 ? (v.gmv / v.cost).toFixed(2) : 0
    }));
}, [parsedData]);
```

#### 1.2 添加推广效率指标
**新增KPI卡片**：
- 点击率（CTR）
- 转化率（CVR）
- 平均点击成本（CPC）
- 平均获客成本（CPA）

**数据来源**：
- 从 `promotionSummary` 中提取 `曝光量`、`点击量`、`成交笔数`
- 计算公式：
  - CTR = 点击量 / 曝光量 × 100%
  - CVR = 成交笔数 / 点击量 × 100%
  - CPC = 总花费 / 点击量
  - CPA = 总花费 / 成交笔数

#### 1.3 添加推广商品TOP榜
**新增面板**：
- 花费TOP10商品表格
- ROI TOP10商品表格
- 支持点击查看商品详情

**数据来源**：`parsedData.promotionProducts`

### 阶段二：推广利润页面增强

#### 2.1 推广渠道对比增强
**新增内容**：
- 渠道效率雷达图
- 渠道花费趋势对比
- 渠道ROI排名

#### 2.2 推广时段分析
**新增内容**：
- 按小时分布的热力图
- 按星期分布的柱状图
- 最佳推广时段推荐卡片

#### 2.3 推广成本结构分析
**新增内容**：
- 推广占比趋势图
- 成本结构饼图
- 利润计算器

### 阶段三：样式与交互优化

#### 3.1 指标卡片样式优化
**优化内容**：
- 推广指标使用红色系边框
- 添加趋势箭头图标
- 支持悬停显示详情

#### 3.2 图表样式统一
**优化内容**：
- 统一图表配色方案
- 添加图表标题和图例
- 优化图表交互提示

#### 3.3 响应式布局
**优化内容**：
- 移动端适配
- 图表自适应大小
- 卡片网格布局优化

## 三、技术实现要点

### 3.1 数据处理
- 使用 `useMemo` 优化数据计算性能
- 添加数据验证，防止空值错误
- 支持多渠道数据合并计算

### 3.2 图表组件
- 使用 `recharts` 库
- 支持响应式容器
- 添加自定义 Tooltip

### 3.3 样式规范
- 使用 Tailwind CSS
- 遵循项目设计规范
- 支持暗色模式（如需要）

## 四、预期效果

### 数据中心页面
- 推广数据一目了然
- 趋势变化清晰可见
- 支持多维度分析

### 推广利润页面
- 渠道对比直观
- 时段分析精准
- 成本结构清晰

### 用户体验
- 数据展示专业美观
- 交互流畅自然
- 信息层次分明

## 问题诊断

### 根本原因分析

经过深入分析，我发现了问题的根本原因：

**文件 Sheet 命名规则变化导致匹配失败**

用户上传的文件 `商品推广_分天数据_20260217至20260517.xlsx` 包含两个 Sheet：
1. `汇总数据_分天数据_20260217至20260517`（汇总数据）
2. `商品_分天数据_20260217至20260517`（商品明细数据）

**问题代码位置**：`src/pages/UploadPage.tsx` 第 128-132 行

```typescript
if (detectedType === '商品推广数据') {
  const summarySheet = wb.SheetNames.find(s => s.includes('汇总')) || wb.SheetNames[0];
  const productSheet = wb.SheetNames.find(s => s.includes('商品')) || wb.SheetNames[1] || wb.SheetNames[0];
  existing.promotionSummary = sheets[summarySheet] || [];
  existing.promotionProducts = sheets[productSheet] || [];
  // ...
}
```

**问题分析**：
1. `summarySheet` 匹配逻辑：`s.includes('汇总')` ✅ 能匹配到 `汇总数据_分天数据...`
2. `productSheet` 匹配逻辑：`s.includes('商品')` ✅ 能匹配到 `商品_分天数据...`
3. **但是**：`sheets[summarySheet]` 和 `sheets[productSheet]` 获取的是 Sheet 名称，而 `sheets` 对象的 key 是 Sheet 名称，所以这部分逻辑是正确的

**真正的问题**：
- 数据确实被正确解析并存储到 `parsedData` 中
- 但 `PromotionPage.tsx` 第 18 行检查 `parsedData?.promotionSummary?.length > 0` 时，可能因为数据持久化问题导致数据丢失

### 数据流分析

1. **上传流程**：`UploadPage.tsx` → 解析文件 → `setParsedData()` → 存储到 `parsedData`
2. **持久化流程**：`App.tsx` 第 242-256 行 → `localStorage.setItem('dianfx_parsed_data', ...)`
3. **读取流程**：`App.tsx` 第 202-220 行 → 从 `localStorage` 读取并恢复 `parsedData`

**潜在问题**：
- `Set` 对象在序列化/反序列化过程中可能丢失
- 数据量大时可能超出 `localStorage` 限制（5MB）

## 修复方案

### 方案一：优化数据检测逻辑（推荐）

**修改文件**：`src/pages/UploadPage.tsx`

**修改内容**：
1. 在解析完成后，添加数据验证日志
2. 确保 `promotionSummary` 和 `promotionProducts` 不为空
3. 添加错误处理，防止数据丢失

### 方案二：增强数据持久化

**修改文件**：`src/App.tsx`

**修改内容**：
1. 优化 `Set` 对象的序列化/反序列化逻辑
2. 添加数据压缩，防止超出 `localStorage` 限制
3. 添加数据完整性检查

### 方案三：添加调试信息

**修改文件**：`src/pages/PromotionPage.tsx`

**修改内容**：
1. 在空数据提示中显示当前 `parsedData` 的状态
2. 帮助用户了解数据是否正确上传

## 具体修改步骤

### 步骤 1：修改 UploadPage.tsx
- 在第 127-133 行添加数据验证
- 确保 `promotionSummary` 和 `promotionProducts` 正确赋值
- 添加 console.log 用于调试

### 步骤 2：修改 PromotionPage.tsx
- 在第 135-142 行优化空数据检查
- 添加更详细的提示信息

### 步骤 3：测试验证
- 上传测试文件
- 检查控制台日志
- 验证推广利润页面是否显示数据

## 预期结果
- 用户上传商品推广数据后，数据能正确解析并持久化
- 推广利润页面能正确显示 KPI 指标、趋势图表等分析内容
- 数据在页面刷新后依然可用

## 实施计划

### 第一步：修改 UploadPage.tsx
**位置**：第 127-133 行

**修改内容**：
```typescript
if (detectedType === '商品推广数据') {
  // 优先匹配包含"汇总"的Sheet，如果没有则使用第一个Sheet
  const summarySheet = wb.SheetNames.find(s => s.includes('汇总')) || wb.SheetNames[0];
  // 优先匹配包含"商品"的Sheet，如果没有则使用第二个Sheet或第一个Sheet
  const productSheet = wb.SheetNames.find(s => s.includes('商品')) || wb.SheetNames[1] || wb.SheetNames[0];

  const summaryData = sheets[summarySheet] || [];
  const productData = sheets[productSheet] || [];

  // 添加数据验证
  console.log('商品推广数据解析:', {
    summarySheet,
    productSheet,
    summaryCount: summaryData.length,
    productCount: productData.length
  });

  existing.promotionSummary = summaryData;
  existing.promotionProducts = productData;
  existing.availableFields.promotion = new Set(Object.keys(summaryData[0] || {}));
}
```

### 第二步：修改 PromotionPage.tsx
**位置**：第 135-142 行

**修改内容**：
```typescript
if (!hasAnyPromo) {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Megaphone size={18} color="#e02e24" />推广利润
      </h2>
      <div className="pdd-card text-center py-12 text-[var(--pdd-text-secondary)]">
        <p>请上传推广数据文件（商品推广/明星店铺/直播推广）</p>
        {parsedData && (
          <p className="text-xs mt-2 text-[var(--pdd-text-secondary)]">
            当前数据状态：订单 {parsedData.orders?.length || 0} 条
          </p>
        )}
      </div>
    </div>
  );
}
```

### 第三步：测试验证
1. 启动开发服务器
2. 上传测试文件 `商品推广_分天数据_20260217至20260517.xlsx`
3. 检查控制台日志，确认数据解析成功
4. 访问推广利润页面，验证数据是否正确显示