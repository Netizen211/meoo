# 利润数据可信度增强方案（含税务+自定义扣费）

## 核心目标
构建完整、透明、可验证的利润计算体系，让运营完全信任利润数据。

---

## 一、数据模型扩展

### 1.1 税务配置模型
```typescript
interface TaxConfig {
  id: string;
  name: string;              // 如"增值税"、"企业所得税"
  taxType: 'vat' | 'income' | 'surcharge' | 'custom';
  rate: number;              // 税率百分比
  base: 'revenue' | 'profit' | 'vat' | 'gmv' | 'orders';  // 计税基数
  enabled: boolean;
  description?: string;      // 备注说明
}
```

### 1.2 自定义扣费项模型
```typescript
interface CustomDeduction {
  id: string;
  name: string;              // 自定义名称，如"客服提成"、"仓储费"
  
  // 计算公式（用户自定义）
  formula: string;           // 表达式字符串，如 "orders * 2" 或 "profit * 0.1"
  formulaType: 'expression' | 'fixed' | 'percentage' | 'tiered';
  
  // 公式变量说明（用于UI提示）
  variables: {
    [key: string]: string;   // 如 { orders: "订单数", profit: "净利润", revenue: "实收" }
  };
  
  // 作用范围
  scope: 'global' | 'product' | 'category';
  scopeTarget?: string;      // 当scope为product/category时的目标ID
  
  // 时间范围（可选）
  effectiveFrom?: string;    // ISO日期
  effectiveTo?: string;
  
  // 条件触发（可选）
  condition?: string;        // 如 "orders > 100" 或 "profit > 0"
  
  enabled: boolean;
  sortOrder: number;         // 扣费顺序（影响利润计算先后）
}
```

### 1.3 ProductStat 新增字段
```typescript
interface ProductStat {
  // ... 现有字段
  
  // 成本明细
  costBreakdown: {
    productCost: number;       // 商品成本
    packagingFee: number;      // 包装费
    shippingFee: number;       // 快递费
    promoCost: number;         // 推广费
    discount: number;          // 折扣
    platformFee: number;       // 平台佣金
    taxes: number;             // 税费合计
    customDeductions: number;  // 自定义扣费合计
  };
  
  // 税费明细
  taxBreakdown: {
    [taxName: string]: { amount: number; rate: number; base: number };
  };
  
  // 自定义扣费明细
  deductionBreakdown: {
    [deductionName: string]: { amount: number; formula: string };
  };
  
  // 数据来源标识
  costSource: {
    productCost: 'real' | 'estimated' | 'missing';
    taxes: 'configured' | 'default';
    customDeductions: 'configured' | 'none';
  };
  
  // 利润可信度
  profitConfidence: 'high' | 'medium' | 'low';
  
  // 毛利（无商品成本时）
  grossProfit: number;
  
  // 税前利润
  preTaxProfit: number;
  
  // 税后净利润
  netProfitAfterTax: number;
}
```

---

## 二、利润计算公式

### 2.1 完整计算链
```
GMV（商品总价）
- 折扣 = 实收金额
- 商品成本（来自成本管理）
- 包装费
- 快递费
- 推广费（来自推广报表）
- 平台佣金
= 税前利润

税前利润
- 增值税（按实收 × 税率）
- 附加税（按增值税 × 税率）
- 企业所得税（按税前利润 × 税率）
- 自定义扣费项1
- 自定义扣费项2
- ...
= 税后净利润
```

### 2.2 自定义扣费公式引擎
支持的变量：
- `gmv` - 商品总价
- `revenue` - 商家实收
- `orders` - 订单数
- `sales` - 销量
- `profit` - 当前阶段利润（扣除前面项后的值）
- `promoCost` - 推广费
- `discount` - 折扣

示例公式：
- `orders * 2` → 每单¥2包装费
- `revenue * 0.03` → 3%平台佣金
- `profit > 0 ? profit * 0.1 : 0` → 盈利时提10%分红
- `orders > 100 ? 500 : 0` → 超100单扣管理费
- `max(0, (revenue - 1000) * 0.05)` → 超¥1000部分扣5%

### 2.3 可信度评级
- **高可信（绿色✓）**：商品成本已填 + 税务已配置 + 有订单+推广数据
- **中可信（黄色⚠）**：使用估算成本 OR 税务未完整配置
- **低可信（红色!）**：成本缺失且无全局比例

---

## 三、UI展示方案

### 3.1 利润数字展示
| 可信度 | 样式 | 示例 |
|--------|------|------|
| 高 | 绿色 + ✓ | ¥128.50 ✓ |
| 中 | 黄色 + ⚠ | ¥128.50 ⚠ |
| 低 | 灰色 + ! | -- ! |

### 3.2 Tooltip结构（合并显示）
```
┌──────────────────────────────────────┐
│ 税后净利润: ¥128.50  [高可信 ✓]     │
├──────────────────────────────────────┤
│ 📊 收入                               │
│   实收金额          ¥500.00           │
├──────────────────────────────────────┤
│ 📦 直接成本                            │
│   商品成本          ¥250.00 (SKU级)   │
│   包装费            ¥5.00             │
│   快递费            ¥8.00             │
│   推广费            ¥80.00 (报表)     │
│   折扣              ¥28.50            │
│   小计              ¥371.50           │
├──────────────────────────────────────┤
│ 🏛️ 税费合计         ¥35.20            │
│   (增值税+附加税+所得税)              │
├──────────────────────────────────────┤
│ 💰 其他扣费合计     ¥14.80            │
│   (客服提成+仓储费+...)               │
├──────────────────────────────────────┤
│ ✅ 税后净利润       ¥128.50           │
├──────────────────────────────────────┤
│ 📁 数据来源: 订单CSV + 推广XLSX       │
│ ⏱️ 成本更新: 2026-05-20 14:30        │
│ 🔗 [查看详细扣费明细]                  │
└──────────────────────────────────────┘
```

### 3.3 点击"查看详细扣费明细"展开
逐项列出每个税费和自定义扣费的：名称、金额、计算公式、计算基数

---

## 四、成本管理页面改造

### 4.1 新增Tab：税务配置
- 预设常用税种模板（小规模/一般纳税人）
- 支持添加自定义税种
- 实时预览税费计算结果

### 4.2 新增Tab：自定义扣费项
- 可视化公式编辑器（带变量提示）
- 拖拽排序调整扣费顺序
- 条件表达式编辑器
- 作用范围选择器（全局/指定商品/指定品类）
- 有效期设置

### 4.3 批量导入成本
- Excel/CSV上传
- 自动匹配商品ID/SKU/商家编码
- 导入预览+错误校验

### 4.4 成本历史记录
- 时间线展示每次修改
- 操作人、修改前后值、修改原因
- 支持回滚到历史版本

### 4.5 异常预警
- 成本偏离均值±30%标红
- 利润率异常（负利润/超高利润）提醒
- 未填写成本的商品列表

---

## 五、实施步骤

### Step 1: 扩展数据模型
- 修改 ProductLinkStats.tsx 中的 ProductStat 接口
- 新增 TaxConfig、CustomDeduction 接口
- 在 App.tsx 中添加税务和扣费项的状态管理

### Step 2: 实现公式引擎
- 创建 utils/formulaEngine.ts
- 安全解析和执行用户自定义公式
- 支持变量注入和条件表达式

### Step 3: 重构利润计算
- 修改 useProductStats hook
- 接入 productCosts、taxConfigs、customDeductions
- 实现多维度成本匹配 + 税费计算 + 自定义扣费
- 计算可信度评级

### Step 4: 创建利润Tooltip组件
- 新建 components/ProfitTooltip.tsx
- 分组折叠展示（默认合并，点击展开明细）
- 可信度颜色/图标

### Step 5: 更新商品分析页面
- ProductPage.tsx 集成 ProfitTooltip
- 替换利润列展示
- 添加可信度筛选器

### Step 6: 重构成本管理页面
- 新增"税务配置"Tab
- 新增"自定义扣费"Tab
- 添加批量导入功能
- 添加成本历史面板
- 添加异常预警

### Step 7: 验证与测试
- 编译检查
- 公式引擎单元测试
- 端到端功能测试
