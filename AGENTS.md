# 店分析 - 路由映射表

## 前台路由（需登录）

| Hash路径 | 页面组件 | 功能说明 |
|----------|---------|---------|
| `#/login` | LoginPage | 登录页（测试账号123456/123456） |
| `#/register` | RegisterPage | 注册页（邀请码+用户名+密码+手机号，注册后自动登录跳转） |
| `#/stores` | StoresPage | 店铺管理（添加/切换/删除店铺） |
| `#/upload` | UploadPage | 数据上传（CSV/XLSX文件解析） |
| `#/dashboard` | DashboardPage | 数据中心（GMV/订单/客单价等核心指标） |
| `#/product` | ProductPage | 商品分析（销量TOP10/品类分布/价格带） |
| `#/user` | UserPage | 用户分析（买家数/客单价/复购率/连带率） |
| `#/trend` | TrendPage | 时间趋势（24h/7天分布/发货时长/月趋势） |
| `#/region` | RegionPage | 地域分析（省份排名/偏远地区率） |
| `#/logistics` | LogisticsPage | 物流履约（平均发货时间/48h率/快递排名） |
| `#/cost` | CostPage | 优惠成本（折扣金额/商家实收/成本对比） |
| `#/after-sale` | AfterSalePage | 售后质量（售后率/退款率/售后状态分布） |
| `#/shipping-insurance` | InsurancePage | 运费险（保费成本/理赔率/趋势） |
| `#/promotion` | PromotionPage | 推广利润（付费锁定：推广成本/ROI） |
| `#/risk` | RiskPage | 风险预警（付费锁定：违规/异常订单） |
| `#/membership` | MembershipPage | 会员中心（免费/专业¥29/企业¥99） |
| `#/settings` | SettingsPage | 系统设置（缓存清理/存储统计/数据管理） |
| `#/product-links` | ProductLinksPage | 商品关联分析（基于商品ID自动关联订单与推广数据/全链路商品画像） |
| `#/cost-management` | CostManagementPage | 成本管理（缺码SKU/裸货成本/新品定价预设） |

## 后台路由（仅测试用户）

| Hash路径 | 页面组件 | 功能说明 |
|----------|---------|---------|
| `#/admin` | AdminHomePage | 后台概览（用户数/订单数/收入统计） |
| `#/admin/users` | AdminUsersPage | 用户管理（封禁/解封） |
| `#/admin/members` | AdminMembersPage | 会员等级调整 |
| `#/admin/invite` | AdminInvitePage | 邀请码管理（生成/删除/查看使用状态） |
| `#/admin/data` | AdminDataPage | 数据监控（图表） |
| `#/admin/ai` | AdminAiPage | AI配置（apiKey/模型/开关） |
| `#/admin/settings` | AdminSettingsPage | 系统设置 |

## 付费锁定说明

- **免费用户**：52个基础指标可查看，34个深度分析指标显示"付费解锁"
- **专业版¥29/月**：解锁深度分析指标
- **企业版¥99/月**：解锁全部功能+AI分析
- **测试账号(123456)**：自动获得企业版权限+后台管理入口

## 数据文件类型

| 文件关键词 | 数据类型 | 解析方式 |
|-----------|---------|---------|
| 订单 | 订单数据(CSV) | papaparse |
| 商品推广/推广 | 推广数据(XLSX) | xlsx(SheetJS) |
| 明星店铺 | 明星店铺数据(XLSX) | xlsx(SheetJS) |
| 直播 | 直播推广数据(XLSX) | xlsx(SheetJS) |
| 运费险 | 运费险数据(XLSX) | xlsx(SheetJS) |