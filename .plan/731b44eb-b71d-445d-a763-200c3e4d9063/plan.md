# 商品分析页面专业版重构计划

## 目标
将商品分析页面从基础数据展示升级为专业运营决策看板，支持全链路复盘、库存补货、定价促销、选品汰换四大场景。

## 数据边界
- 仅使用现有订单CSV + 推广XLSX数据
- 不展示竞品对标、用户评价等无数据源模块
- 所有指标必须可从原始字段计算得出

## 核心改动

### 1. 列表页增强（ProductPage.tsx）
- **KPI卡片扩展**：增加动销率、平均周转天数、推广占比、退款率4个指标
- **表格列优化**：新增"日均销量"、"推广ROI"、"折扣率"、"库存状态"列
- **默认排序**：改为按GMV降序
- **智能预警标签**：自动标记"高退款"、"零动销"、"低库存"、"高推广依赖"商品
- **快捷操作**：每行增加"查看详情"按钮，点击打开详情抽屉

### 2. 商品详情抽屉（新组件 ProductDetailDrawer.tsx）
点击列表商品后右侧滑出详情面板，包含：
- **基础信息区**：商品名、编码、所属类目（如有）、上架时间
- **核心指标卡**：GMV、实收、利润、利润率、ROI、退款率、售后率
- **销售趋势图**：近7/30天日销量+GMV双轴折线图（复用TimeFilter时间范围）
- **价格分布直方图**：该商品所有订单的实付金额分桶统计
- **售后原因拆解**：按售后状态字段分组统计饼图
- **关联购买分析**：基于订单号最后4位（用户标识）找出同用户购买的其他商品TOP5
- **推广效果区**：曝光→点击→成交漏斗图 + CTR/CVR/推广花费/推广ROI
- **利润 waterfall 图**：GMV → 折扣 → 推广费 → 成本 → 净利润的瀑布分解

### 3. 数据处理层增强（ProductLinkStats.tsx）
- 扩展 `ProductStat` 接口，新增：dailySales数组、priceDistribution数组、afterSaleBreakdown对象、relatedProducts数组
- 在 `useProductStats` 中预计算上述衍生数据
- 新增 `useProductDetail(productId)` hook，返回单个商品的完整分析数据

### 4. Tab结构调整
保留现有5个Tab，但重新命名和组织：
- 总览 → **商品概览**（原overview，增强KPI和预警）
- 生命周期 → **动销分析**（原lifecycle，聚焦周转和库存）
- SKU分析 → **SKU矩阵**（原sku，增加价格带分布）
- 价格弹性 → **定价洞察**（原price，增加折扣效果分析）
- 商品关联 → **全链路追踪**（原fulllink，整合推广+订单+利润）

### 5. UI/UX规范
- 所有卡片统一 border border-[#e8e8e8] + hover:border-[var(--pdd-border)]
- 表格表头 bg-[var(--pdd-bg)] + sticky top-0
- 图表容器最小高度240px，带标题栏和图例
- 详情抽屉宽度480px，支持滚动，关闭按钮固定右上角
- 颜色语义化：绿色=盈利/健康，红色=亏损/预警，黄色=关注，灰色=无数据

## 实施步骤

### Step 1: 扩展数据模型
- 修改 `src/components/ProductLinkStats.tsx`
- 扩展 ProductStat 接口
- 在 useProductStats 中计算 dailySales、priceDistribution、afterSaleBreakdown、relatedProducts
- 新增 useProductDetail hook

### Step 2: 创建商品详情抽屉组件
- 新建 `src/pages/product/ProductDetailDrawer.tsx`
- 实现基础信息区 + 核心指标卡
- 实现销售趋势图（Recharts LineChart）
- 实现价格分布直方图（Recharts BarChart）
- 实现售后原因饼图（Recharts PieChart）
- 实现关联购买列表
- 实现推广漏斗图（自定义SVG或BarChart）
- 实现利润瀑布图（Recharts BarChart with stacked bars）

### Step 3: 重构列表页
- 修改 `src/pages/ProductPage.tsx`
- 更新KPI卡片（8→12个）
- 更新表格列定义
- 添加智能预警标签逻辑
- 集成 ProductDetailDrawer（state控制打开/关闭）
- 调整默认排序为GMV降序

### Step 4: 优化Tab内容
- 重命名Tab标签
- 增强"动销分析"：增加周转天数计算、库存预警阈值
- 增强"定价洞察"：增加折扣率与销量相关性分析
- 确保"全链路追踪"Tab内容与详情抽屉数据一致

### Step 5: 验证与测试
- pnpm run typecheck 确认无新增类型错误
- pnpm run dev 启动开发服务器
- 手动验证：列表页加载、详情抽屉打开/关闭、各图表渲染、筛选联动
- 检查无 `/` Tailwind类残留

## 关键文件清单
- `src/components/ProductLinkStats.tsx` - 数据模型扩展
- `src/pages/product/ProductDetailDrawer.tsx` - 新组件
- `src/pages/ProductPage.tsx` - 列表页重构
- `src/pages/product/ProductFullLinkTab.tsx` - Tab内容微调

## 风险点
- 关联购买分析依赖订单号最后4位作为用户标识，数据量小时可能不准确
- 价格分布直方图需要合理分桶，避免桶数过多或过少
- 详情抽屉在移动端可能需要适配（当前仅考虑桌面端）
