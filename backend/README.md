# meoo 后端架构报告

## 技术栈
- Node.js + Express + TypeScript
- MySQL 5.7 (Unix socket 直连)
- Knex.js 查询构建器 + 连接池
- JWT 双Token认证 (access 15min + refresh 7d)
- PM2 Cluster ×2 进程管理
- Nginx 反向代理 + Cloudflare CDN

## 项目结构


## 数据库表
| 表名 | 用途 | 关键字段 |
|------|------|---------|
| users | 用户 | id, username, password_hash, role, membership_level |
| stores | 店铺 | id, user_id, name |
| store_data | 店铺原始数据 | store_id, category, payload_json(JSON), row_count |
| store_configs | 店铺配置 | store_id, config_key, payload_json(JSON) |
| upload_records | 上传记录 | id, user_id, store_id, file_name, row_count |
| refresh_tokens | 刷新令牌 | token_hash, user_id, expires_at, revoked_at |
| invite_codes | 邀请码 | code, is_used, used_by |
| admin_logs | 操作日志 | admin_id, action, target_type, details |
| audit_logs | 审计日志 | user_id, action, prev_hash, current_hash(哈希链) |
| user_sessions | 会话管理 | user_id, device_id, ip_address |

## API 端点完整清单

### 认证 (8个)
| 方法 | 路径 | 说明 | 校验 |
|------|------|------|------|
| POST | /auth/login | 登录 | Zod loginSchema |
| POST | /auth/register | 注册 | Zod registerSchema + 限流 |
| POST | /auth/refresh | 刷新Token | Zod refreshSchema |
| POST | /auth/logout | 退出 | requireAuth |
| GET  | /auth/me | 当前用户 | requireAuth |
| POST | /auth/send-code | 发送邮箱验证码 | Zod + 限流 |
| GET  | /health | 健康检查 | 无 |

### 分析 (15个)
| 方法 | 路径 | 说明 | 返回数据 |
|------|------|------|---------|
| GET | /analytics/dashboard | 经营KPI | gmv,revenue,profit,orders,refundRate,avgOrder,promoROI,ctr,cvr,buyers,productCount,status,provinces |
| GET | /analytics/dashboard-full | 全量KPI | 上述+costs(costBreakdown)+compare(环比)+promoByDate(推广日趋势) |
| GET | /analytics/products/stats | 商品利润表 | 每商品:gmv,sales,netProfit,roi,refundRate,dailySales,promoCost,ctr,cvr |
| GET | /analytics/products | 商品列表 | 简化商品列表 |
| GET | /analytics/product/deep/:id | 单品深度 | skuMatrix,refundAnalysis,productClassification,rankings,anomalies,storeBenchmark,funnel,profitWaterfall,hourlyData,trendData |
| GET | /analytics/promotion | 推广分析 | summary(cost,gmv,roi,orders,ctr,cvr)+breakdown(channel) |
| GET | /analytics/aftersale | 售后分析 | total,refundAmount,asRate,reasons |
| GET | /analytics/trends | 每日趋势 | [{date,gmv,revenue,orders,refund,refundCount}] |
| GET | /analytics/regions | 地区分布 | [{province,orders,gmv,buyers}] |
| GET | /analytics/financial | 财务汇总 | totalIncome,totalExpense,orderRevenue,incomeCount,expenseCount |
| GET | /analytics/logistics | 物流分析 | distribution(<24h/24-48h/>72h),shippedOrders,avgHours |
| GET | /analytics/compare | 环比数据 | current,previous,changes(orders%,gmv%,revenue%) |
| GET | /analytics/promo-trends | 推广日趋势 | [{date,cost,gmv,orders,impressions,clicks}] |
| GET | /analytics/costs | 成本汇总 | productCost,packagingFee,shippingFee,insuranceFee,totalCost |

### 数据同步 (6个)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /data/sync | 智能合并同步(去重追加) |
| POST | /data/pull | 拉取店铺全量数据 |
| POST | /data/config | 单条配置即时同步 |
| DELETE | /data/store/:id | 删除店铺全部数据 |
| DELETE | /data/store/:id/category/:cat | 按分类删除 |
| POST | /data/clear-all | 清除用户所有数据(事务保护) |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /stores | 店铺列表 |
| POST | /stores | 创建店铺 |
| DELETE | /stores/:id | 删除店铺 |
| GET | /sse | SSE实时推送连接 |
| GET | /sse/stats | SSE连接统计 |

## 安全架构
- Zod 请求校验: 8个schema覆盖全部输入
- JWT 双Token: access 15min + refresh 7d
- 租户隔离: Knex查询自动注入 user_id
- 密码策略: 8位+字母+数字/符号+弱密码黑名单
- 限流: 全局200/min, 登录5/min, 注册3/min, 验证码2/min
- 断路器: 连续5次失败熔断30秒
- 事务保护: 多表写操作包裹 BEGIN→COMMIT
- XSS防护: 输入校验 + HTML转义
- 隐私合规: 禁止上传含个人信息的字段

## 性能策略
- Gzip压缩: Express compression + Nginx
- 内存缓存: 30s原始数据 + 60s计算结果 TTL
- PM2集群: IPC广播缓存失效
- MySQL Unix socket: 零TCP开销
- 连接池: min2 max10 + 30s保活
- 增量同步: 只发送非空分类数据
- 代码分割: 前端28个chunk按需加载

## 测试覆盖
- 单元测试: 24个 (analyticsService 全部KPI计算)
- 集成测试: 20个 (全API端点)
- 测试命令: cd server && pnpm test

## 部署信息
| 项 | 值 |
|-----|-----|
| 服务器 | 47.82.120.115 (香港) |
| 域名 | melody.wang |
| PM2 | meoo-server ×2 cluster |
| 端口 | 3007 (内部) → Nginx :443 |
| MySQL | Unix socket |
| 备份 | cron每日2:00, 保留30天 |