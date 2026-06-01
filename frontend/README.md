# meoo 前端架构报告

## 两个前端共存

| 版本 | 地址 | 技术 | 大小 |
|------|------|------|------|
| meoo (v1) | https://melody.wang/ | React + TypeScript + Webpack | 489KB bundle + 28 chunks |
| SSDES (v2) | https://melody.wang/ssdes/ | 原生 HTML/JS/CSS | 15KB 单文件 |

## meoo v1 (React)

### 技术栈
- React 18 + TypeScript
- React Router (HashRouter)
- Recharts (图表)
- Framer Motion (动画)
- Tailwind CSS
- Webpack 5 (代码分割)
- PapaParse + XLSX (文件解析)

### 页面清单
| 页面 | 路由 | 功能 |
|------|------|------|
| LoginPage | /login | 登录 |
| RegisterPage | /register | 注册 |
| StoresPage | /stores | 店铺管理中心 |
| DashboardPage | /dashboard | 数据中心(KPI面板+趋势图+状态+省份) |
| ProductPage | /product | 商品分析(排行+排序+关联) |
| ProductLinksPage | /product-links | 商品关联分析 |
| ProductDeepAnalysis | 弹窗 | 单品深度(SKU矩阵+退款分析+排名+异常) |
| PromotionPage | /promotion | 推广分析 |
| AfterSalePage | /after-sale | 售后分析 |
| TrendPage | /trend | 趋势分析 |
| RegionPage | /region | 地区分布 |
| FinancePage | /finance | 财务数据 |
| CostManagementPage | /cost-management | 成本管理 |
| CostPage | /cost | 费用分析 |
| InsurancePage | /shipping-insurance | 运费险 |
| LogisticsPage | /logistics | 物流分析 |
| RiskPage | /risk | 风险分析 |
| UploadPage | /upload | 数据上传(CSV/XLSX) |
| SettingsPage | /settings | 设置+数据管理 |
| MembershipPage | /membership | 会员 |
| SubAccountsPage | /sub-accounts | 子账号 |
| UserPage | /user | 用户中心 |

### 数据流


### 架构规范
- 前端只发请求等数据，服务端做全部计算
- 不碰 localStorage (JWT/UI偏好除外)
- 不做 reduce/forEach 统计计算
- 路由 ≤6行，只校验参数+调service

## SSDES v2 (原生)

### 设计理念
- 零依赖：单个HTML文件，无打包，无框架
- 直接fetch API：每个页面自己调API拿数据
- 15KB总大小，秒加载
- 参考聚水潭/淘宝生意参谋设计

### 模块
| Tab | API | 展示 |
|-----|-----|------|
| Overview | dashboard | 8个KPI卡片+利润瀑布+费用结构+状态+省份 |
| Products | products/stats | 商品利润排行表+单品深度弹窗 |
| Promotion | promotion | 推广ROI+渠道花费+渠道GMV |
| AfterSale | aftersale | 售后统计+退款原因标签 |
| Trends | trends | 每日GMV/收入/退款趋势表 |
| Regions | regions | 省份订单/GMV/买家分布 |
| Financial | financial | 财务收入/支出汇总 |
| Logistics | logistics | 发货时效分布 |

## API 接口调用对照

| 前端模块 | 需要的数据 | API |
|---------|-----------|-----|
| KPI面板 | GMV/收入/利润/订单/客单价/退款率/ROI | /analytics/dashboard |
| 利润瀑布 | 折扣/推广/平台费/运费险/罚款/退款→净利 | /analytics/dashboard |
| 费用占比 | 各费用占比% | /analytics/dashboard |
| 商品排行 | 每商品GMV/销量/净利/ROI/退款率 | /analytics/products/stats |
| 单品深度 | SKU矩阵/漏斗/排名/异常/分类 | /analytics/product/deep/:id |
| 推广分析 | 花费/GMV/ROI/CTR/CVR/渠道分解 | /analytics/promotion |
| 售后分析 | 售后数/退款额/原因分布 | /analytics/aftersale |
| 每日趋势 | 按日GMV/订单/退款 | /analytics/trends |
| 地区分布 | 省份/订单/GMV/买家 | /analytics/regions |
| 财务汇总 | 收入/支出/流水 | /analytics/financial |
| 物流分析 | 时效分布/发货率 | /analytics/logistics |
| 环比数据 | 本期vs上期变化% | /analytics/compare |
| 推广趋势 | 推广按日花费/GMV | /analytics/promo-trends |
| 成本汇总 | 商品成本/包装/快递/运费险 | /analytics/costs |
