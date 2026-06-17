import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';
import { checkTableExists } from './helpers';

const router = Router();

// ===== 运营中台新增 API (Analytics, Monitoring, Risk) =====

// ★ 用户行为事件列表
router.get("/analytics/events", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_events")) {
      res.json({ success: true, data: [], total: 0, message: "分析表尚未初始化" });
      return;
    }
    const { event_type, user_id, page = 1, pageSize = 20, startDate, endDate } = req.query;
    let query = (db("user_events") as any).select("*");
    let countQuery = (db("user_events") as any).count("* as total").first();
    if (event_type) { query = query.where("event_type", event_type); countQuery = countQuery.where("event_type", event_type); }
    if (user_id) { query = query.where("user_id", user_id); countQuery = countQuery.where("user_id", user_id); }
    if (startDate) { query = query.where("created_at", ">=", startDate); countQuery = countQuery.where("created_at", ">=", startDate); }
    if (endDate) { query = query.where("created_at", "<=", endDate); countQuery = countQuery.where("created_at", "<=", endDate); }
    const total = (await countQuery)?.total || 0;
    const offset = (Number(page) - 1) * Number(pageSize);
    const data = await query.orderBy("created_at", "desc").limit(Number(pageSize)).offset(offset);
    res.json({ success: true, data, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 事件统计
router.get("/analytics/event-stats", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_events")) {
      res.json({ success: true, data: [] });
      return;
    }
    const { startDate, endDate } = req.query;
    let condition = '';
    if (startDate) condition += ' AND created_at >= "' + startDate + '"';
    if (endDate) condition += ' AND created_at <= "' + endDate + '"';
    const result = await db.raw('SELECT event_type, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users FROM user_events WHERE 1=1' + condition + ' GROUP BY event_type ORDER BY count DESC');
    const data = (result as any)[0] || [];
    res.json({ success: true, data });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 模块点击排行
router.get("/analytics/module-rank", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("module_click_stats")) {
      res.json({ success: true, data: [] });
      return;
    }
    let moduleQuery = (db("module_click_stats") as any).select("*");
    if (req.query.startDate) moduleQuery = moduleQuery.where("stat_date", ">=", req.query.startDate);
    if (req.query.endDate) moduleQuery = moduleQuery.where("stat_date", "<=", req.query.endDate);
    const data = await moduleQuery.orderBy("click_count", "desc").limit(20);
    res.json({ success: true, data });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 用户路径漏斗
router.get("/analytics/funnel", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_funnel")) {
      res.json({ success: true, data: [] });
      return;
    }
    const { funnel_name, startDate, endDate } = req.query;
    let funnelQuery = (db("user_funnel") as any).select("*").orderBy("step_order", "asc");
    if (funnel_name) funnelQuery = funnelQuery.where("funnel_name", funnel_name);
    if (startDate) funnelQuery = funnelQuery.where("stat_date", ">=", startDate);
    if (endDate) funnelQuery = funnelQuery.where("stat_date", "<=", endDate);
    const data = await funnelQuery;
    res.json({ success: true, data });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 付费转化分析
router.get("/analytics/pay-conversion", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_daily_activity")) {
      res.json({ success: true, data: { summary: {}, trend: [] } });
      return;
    }
    let condition = '';
    if (req.query.startDate) condition += ' AND stat_date >= "' + req.query.startDate + '"';
    if (req.query.endDate) condition += ' AND stat_date <= "' + req.query.endDate + '"';
    const rawResult = await db.raw('SELECT stat_date, COUNT(DISTINCT user_id) as dau, SUM(paywall_views) as paywall_views, SUM(module_clicks) as module_clicks FROM user_daily_activity WHERE 1=1' + condition + ' GROUP BY stat_date ORDER BY stat_date DESC LIMIT 30');
    const trend = (rawResult as any)[0] || [];
    res.json({ success: true, data: { trend } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 日活跃用户
router.get("/analytics/daily-activity", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_daily_activity")) {
      res.json({ success: true, data: [] });
      return;
    }
    let cond2 = '';
    if (req.query.startDate) cond2 += ' AND stat_date >= "' + req.query.startDate + '"';
    if (req.query.endDate) cond2 += ' AND stat_date <= "' + req.query.endDate + '"';
    const raw2 = await db.raw('SELECT stat_date, SUM(is_active) as active_users, COUNT(DISTINCT user_id) as total_users, SUM(page_views) as total_page_views, SUM(module_clicks) as total_module_clicks, SUM(session_duration_sec) as total_duration FROM user_daily_activity WHERE 1=1' + cond2 + ' GROUP BY stat_date ORDER BY stat_date DESC LIMIT 30');
    const data = (raw2 as any)[0] || [];
    res.json({ success: true, data });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});


// ★ AI调用监控
router.get("/monitoring/ai", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("ai_call_logs")) {
      res.json({ success: true, data: { summary: {}, recent: [] } });
      return;
    }
    let cond3 = '';
    if (req.query.startDate) cond3 += ' AND created_at >= "' + req.query.startDate + '"';
    if (req.query.endDate) cond3 += ' AND created_at <= "' + req.query.endDate + '"';
    const pageNum = Number(req.query.page || 1);
    const ps = Number(req.query.pageSize || 20);
    const totalR = await db.raw('SELECT COUNT(*) as total FROM ai_call_logs WHERE 1=1' + cond3);
    const total = (totalR as any)[0]?.[0]?.total || 0;
    const offset = (pageNum - 1) * ps;
    const recentR = await db.raw('SELECT * FROM ai_call_logs WHERE 1=1' + cond3 + ' ORDER BY created_at DESC LIMIT ' + ps + ' OFFSET ' + offset);
    const recent = (recentR as any)[0] || [];
    const sumR = await db.raw('SELECT COUNT(*) as total_calls, SUM(success) as success_calls, AVG(response_time_ms) as avg_response_ms, SUM(tokens_input + tokens_output) as total_tokens, SUM(cost) as total_cost FROM ai_call_logs WHERE 1=1' + cond3);
    const summary = (sumR as any)[0]?.[0] || {};
    res.json({ success: true, data: { summary, recent, total, page: pageNum, pageSize: ps } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 数据质量中心
router.get("/data-quality", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("data_quality_checks")) {
      res.json({ success: true, data: { summary: {}, checks: [] } });
      return;
    }
    const { store_id, check_type, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    let query = db("data_quality_checks").select("*");
    let countQuery = db("data_quality_checks").count("* as total").first();
    if (store_id) { query = query.where("store_id", store_id); countQuery = countQuery.where("store_id", store_id); }
    if (check_type) { query = query.where("check_type", check_type); countQuery = countQuery.where("check_type", check_type); }
    if (startDate) { query = query.where("created_at", ">=", String(startDate)); countQuery = countQuery.where("created_at", ">=", String(startDate)); }
    if (endDate) { query = query.where("created_at", "<=", String(endDate) + " 23:59:59"); countQuery = countQuery.where("created_at", "<=", String(endDate) + " 23:59:59"); }
    const total = (await countQuery)?.total || 0;
    const offset = (Number(page) - 1) * Number(pageSize);
    const checks = await query.orderBy("created_at", "desc").limit(Number(pageSize)).offset(offset);
    let summaryQb = db("data_quality_checks");
    if (startDate) summaryQb = summaryQb.where("created_at", ">=", String(startDate));
    if (endDate) summaryQb = summaryQb.where("created_at", "<=", String(endDate) + " 23:59:59");
    const summary = await summaryQb.select("check_type", db.raw("COUNT(*) as total_checks"), db.raw("SUM(IF(check_status = 'failed', 1, 0)) as failed_checks"), db.raw("SUM(issue_count) as total_issues")).groupBy("check_type").orderBy("total_issues", "desc");
    res.json({ success: true, data: { summary, checks, total, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 风险事件列表
router.get("/risk-events", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("risk_events")) {
      res.json({ success: true, data: { summary: {}, events: [] } });
      return;
    }
    const { risk_type, risk_level, status, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    let query = db("risk_events").select("*");
    let countQuery = db("risk_events").count("* as total").first();
    if (risk_type) { query = query.where("risk_type", risk_type); countQuery = countQuery.where("risk_type", risk_type); }
    if (risk_level) { query = query.where("risk_level", risk_level); countQuery = countQuery.where("risk_level", risk_level); }
    if (status) { query = query.where("status", status); countQuery = countQuery.where("status", status); }
    if (startDate) { query = query.where("created_at", ">=", String(startDate)); countQuery = countQuery.where("created_at", ">=", String(startDate)); }
    if (endDate) { query = query.where("created_at", "<=", String(endDate) + " 23:59:59"); countQuery = countQuery.where("created_at", "<=", String(endDate) + " 23:59:59"); }
    const total = (await countQuery)?.total || 0;
    const offset = (Number(page) - 1) * Number(pageSize);
    const events = await query.orderBy("created_at", "desc").limit(Number(pageSize)).offset(offset);
    let summaryQuery = db("risk_events");
    if (startDate) summaryQuery = summaryQuery.where("created_at", ">=", String(startDate));
    if (endDate) summaryQuery = summaryQuery.where("created_at", "<=", String(endDate) + " 23:59:59");
    const summary = await summaryQuery.select(db.raw("COUNT(*) as total_events"), db.raw("SUM(IF(risk_level = 'critical', 1, 0)) as critical_count"), db.raw("SUM(IF(risk_level = 'high', 1, 0)) as high_count"), db.raw("SUM(IF(status = 'open', 1, 0)) as open_count")).first();
    res.json({ success: true, data: { summary, events, total, page: Number(page), pageSize: Number(pageSize) } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ★ 批量事件上报 (行为埋点入口)
router.post("/events/batch", requireAuth, async (req: Request, res: Response) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      res.status(400).json({ success: false, error: "缺少events数组" });
      return;
    }
    if (!await checkTableExists("user_events")) {
      res.json({ success: true, accepted: 0, message: "分析表尚未初始化" });
      return;
    }
    const enriched = events.map((e: any) => ({
      user_id: req.user!.userId,
      session_id: req.headers["x-session-id"] as string || "",
      event_type: e.event_type,
      event_category: e.event_category || "",
      event_label: e.event_label || "",
      event_value: e.event_value || "",
      page_url: e.page_url || "",
      store_id: e.store_id || "",
      duration_ms: e.duration_ms || 0,
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
    }));
    await db("user_events").insert(enriched);
    res.json({ success: true, accepted: enriched.length });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});


// ===== 运营总览聚合接口 =====
router.get('/operations/overview', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    const timeRange = (req.query.timeRange as string) || '7d';
    const now = new Date();
    let startDate = new Date(now.getTime() - 7 * 86400000);
    if (timeRange === '1d') startDate = new Date(now.getTime() - 86400000);
    else if (timeRange === '30d') startDate = new Date(now.getTime() - 30 * 86400000);
    else if (timeRange === '90d') startDate = new Date(now.getTime() - 90 * 86400000);
    const startStr = startDate.toISOString().slice(0, 10);

    const [totalUsers, newUsers, totalStores, newStores, uploads, storageBytes, revenue, payingUsers, pendingInfo, daExists, riskExists] = await Promise.all([
      db('users').count('* as total').first().then((r: any) => Number(r?.total || 0)),
      db('users').where('created_at', '>=', startStr).count('* as total').first().then((r: any) => Number(r?.total || 0)),
      db('stores').count('* as total').first().then((r: any) => Number(r?.total || 0)),
      db('stores').where('created_at', '>=', startStr).count('* as total').first().then((r: any) => Number(r?.total || 0)),
      db('upload_records').where('uploaded_at', '>=', startStr).count('* as total').first().then((r: any) => Number(r?.total || 0)),
      db('users').sum('storage_bytes as total').first().then((r: any) => Number(r?.total || 0)),
      db('recharge_orders').where('status', 'approved').where('created_at', '>=', startStr).sum('amount as total').first().then((r: any) => Number(r?.total || 0)),
      db('recharge_orders').where('status', 'approved').countDistinct('user_id as total').first().then((r: any) => Number(r?.total || 0)),
      Promise.all([
        db('recharge_orders').where('status', 'pending').count('* as total').first().then((r: any) => Number(r?.total || 0)),
        db('recharge_orders').where('status', 'pending').sum('amount as total').first().then((r: any) => Number(r?.total || 0)),
      ]),
      checkTableExists('user_daily_activity'),
      checkTableExists('risk_events'),
    ]);

    let dau = 0, wau = 0, mau = 0;
    const today = now.toISOString().slice(0, 10);
    if (daExists) {
      dau = Number((await db('user_daily_activity').where('stat_date', today).where('is_active', 1).countDistinct('user_id as total').first())?.total ?? 0);
      wau = Number((await db('user_daily_activity').where('stat_date', '>=', new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)).countDistinct('user_id as total').first())?.total ?? 0);
      mau = Number((await db('user_daily_activity').where('stat_date', '>=', new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)).countDistinct('user_id as total').first())?.total ?? 0);
    }

    let systemAnomalies = 0;
    if (riskExists) {
      systemAnomalies = Number((await db('risk_events').whereIn('status', ['open', 'active']).where('created_at', '>=', startStr).count('* as total').first())?.total || 0);
    }

    // Trend data: last 30 days
    const trendDays = 30;
    const trendStart = new Date(now.getTime() - trendDays * 86400000).toISOString().slice(0, 10);
    const [dailyUsers, dailyStores, dailyUploads, dailyRevenue] = await Promise.all([
      db('users').select(db.raw('DATE(created_at) as date'), db.raw('COUNT(*) as count')).where('created_at', '>=', trendStart).groupByRaw('DATE(created_at)').orderBy('date', 'asc'),
      db('stores').select(db.raw('DATE(created_at) as date'), db.raw('COUNT(*) as count')).where('created_at', '>=', trendStart).groupByRaw('DATE(created_at)').orderBy('date', 'asc'),
      db('upload_records').select(db.raw('DATE(uploaded_at) as date'), db.raw('COUNT(*) as count')).where('uploaded_at', '>=', trendStart).groupByRaw('DATE(uploaded_at)').orderBy('date', 'asc'),
      db('recharge_orders').select(db.raw('DATE(created_at) as date'), db.raw('SUM(amount) as total')).where('status', 'approved').where('created_at', '>=', trendStart).groupByRaw('DATE(created_at)').orderBy('date', 'asc'),
    ]);

    const uMap = new Map((dailyUsers as any[]).map((r: any) => [String(r.date), Number(r.count)]));
    const sMap = new Map((dailyStores as any[]).map((r: any) => [String(r.date), Number(r.count)]));
    const ulMap = new Map((dailyUploads as any[]).map((r: any) => [String(r.date), Number(r.count)]));
    const rMap = new Map((dailyRevenue as any[]).map((r: any) => [String(r.date), Number(r.total)]));
    const trendData = [];
    for (let i = trendDays; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      trendData.push({ date: d, newUsers: uMap.get(d) || 0, newStores: sMap.get(d) || 0, uploads: ulMap.get(d) || 0, revenue: rMap.get(d) || 0 });
    }

    res.json({ success: true, data: { dau, wau, mau, totalUsers, newUsers, totalStores, newStores, uploads, storageBytes, revenue, payingUsers, pendingRecharge: (pendingInfo as any)[0], pendingRechargeAmount: (pendingInfo as any)[1], systemAnomalies, trendData } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// ========== 用户分群管理 ==========
router.get('/users/segments', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists('user_segments')) {
      res.json({ success: true, data: [] });
      return;
    }
    const segments = await (db('user_segments') as any).select('*').orderBy('created_at', 'desc');
    res.json({ success: true, data: segments });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/users/segments', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists('user_segments')) {
      res.json({ success: false, error: '分群表尚未初始化' });
      return;
    }
    const { segment_name, segment_rules, is_active } = req.body;
    if (!segment_name) { res.json({ success: false, error: '分群名称必填' }); return; }
    await (db('user_segments') as any).insert({
      segment_name, segment_rules: JSON.stringify(segment_rules || {}),
      user_count: 0, is_active: is_active ?? 1,
      created_by: (req as any).user?.userId || 'system',
      created_at: db.fn.now(), updated_at: db.fn.now(),
    });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});



// ========== 用户行为时间线 ==========
router.get("/users/:id/timeline", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_events")) { res.json({ success: true, data: [] }); return; }
    const days = Number(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const events = await (db("user_events") as any).select("event_type", "event_label", "page_url", "duration_ms", "created_at").where("user_id", req.params.id).where("created_at", ">=", startDate).orderBy("created_at", "desc").limit(100);
    res.json({ success: true, data: events });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/users/:id/module-clicks", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("user_events")) { res.json({ success: true, data: [] }); return; }
    const events = await (db("user_events") as any).select(db.raw("event_label as module_name, COUNT(*) as click_count, COUNT(DISTINCT DATE(created_at)) as active_days, SUM(duration_ms) as total_duration")).where("user_id", req.params.id).where("event_type", "module_click").groupBy("event_label").orderByRaw("click_count DESC").limit(20);
    res.json({ success: true, data: events });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/users/:id/risk-events", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("risk_events")) { res.json({ success: true, data: [] }); return; }
    const events = await (db("risk_events") as any).select("*").where("user_id", req.params.id).orderBy("created_at", "desc").limit(20);
    res.json({ success: true, data: events });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});


// ========== Revenue: MRR Trend & Churn Rate ==========
router.get("/revenue/mrr-trend", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    const months = Number(req.query.months) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const orders = await (db("recharge_orders") as any).select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as revenue, COUNT(DISTINCT user_id) as paying_users")).where("status", "approved").where("created_at", ">=", startDate.toISOString().slice(0, 10)).groupByRaw("DATE_FORMAT(created_at, '%Y-%m')").orderBy("month", "asc");
    res.json({ success: true, data: orders });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/revenue/churn-rate", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
    const monthlyData = await (db("recharge_orders") as any).select(db.raw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(DISTINCT user_id) as active_users")).where("status", "approved").where("created_at", ">=", sixMonthsAgo).groupByRaw("DATE_FORMAT(created_at, '%Y-%m')").orderBy("month", "asc");
    const churnData = [];
    for (let i = 1; i < monthlyData.length; i++) {
      const prevMonth = (monthlyData[i - 1] as any).month;
      const currMonth = (monthlyData[i] as any).month;
      const prevUsers = await (db("recharge_orders") as any).select(db.raw("COUNT(DISTINCT user_id) as users")).where("status", "approved").whereRaw("DATE_FORMAT(created_at, '%Y-%m') = ?", [prevMonth]).first();
      const retainedUsers = await (db("recharge_orders") as any).select(db.raw("COUNT(DISTINCT user_id) as users")).where("status", "approved").whereRaw("DATE_FORMAT(created_at, '%Y-%m') = ?", [currMonth]).whereRaw("user_id IN (SELECT DISTINCT user_id FROM recharge_orders WHERE status = 'approved' AND DATE_FORMAT(created_at, '%Y-%m') = ?)", [prevMonth]).first();
      const total = Number((prevUsers as any)?.users || 0);
      const retained = Number((retainedUsers as any)?.users || 0);
      churnData.push({ month: currMonth, active_users: total, retained_users: retained, churn_rate: total > 0 ? parseFloat(((total - retained) / total * 100).toFixed(1)) : 0 });
    }
    res.json({ success: true, data: churnData });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});



// Upload monitoring
router.get("/monitoring/upload-stats", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    let cond = '';
    if (req.query.startDate) cond += ' AND uploaded_at >= "' + req.query.startDate + '"';
    if (req.query.endDate) cond += ' AND uploaded_at <= "' + req.query.endDate + '"';
    const totalR = await db.raw('SELECT COUNT(*) as total_uploads, COUNT(DISTINCT store_id) as active_stores, SUM(IF(status="success",1,0)) as success_count, SUM(IF(status="fail",1,0)) as fail_count, AVG(parse_duration_ms) as avg_parse_ms FROM upload_records WHERE 1=1' + cond);
    const stats = (totalR as any)[0]?.[0] || {};
    const trendR = await db.raw('SELECT DATE(uploaded_at) as date, COUNT(*) as total, SUM(IF(status="success",1,0)) as success, SUM(IF(status="fail",1,0)) as fail FROM upload_records WHERE 1=1' + cond + ' GROUP BY DATE(uploaded_at) ORDER BY date DESC LIMIT 30');
    const trend = (trendR as any)[0] || [];
    res.json({ success: true, data: { stats, trend } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/monitoring/upload-failures", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    let cond = " WHERE status='fail'";
    if (req.query.startDate) cond += ' AND uploaded_at >= "' + req.query.startDate + '"';
    if (req.query.endDate) cond += ' AND uploaded_at <= "' + req.query.endDate + '"';
    const page = Number(req.query.page) || 1;
    const ps = Number(req.query.pageSize) || 20;
    const totalR = await db.raw('SELECT COUNT(*) as total FROM upload_records' + cond);
    const total = (totalR as any)[0]?.[0]?.total || 0;
    const offset = (page - 1) * ps;
    const rowsR = await db.raw('SELECT * FROM upload_records' + cond + ' ORDER BY uploaded_at DESC LIMIT ' + ps + ' OFFSET ' + offset);
    const rows = (rowsR as any)[0] || [];
    res.json({ success: true, data: { uploads: rows, total, page, pageSize: ps } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// Risk audit
router.get("/risk/overview", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("risk_events")) { res.json({ success: true, data: {} }); return; }
    const summary = await (db("risk_events") as any).select(db.raw("COUNT(*) as total_events, SUM(IF(risk_level='critical',1,0)) as critical_count, SUM(IF(risk_level='high',1,0)) as high_count, SUM(IF(risk_level='medium',1,0)) as medium_count, SUM(IF(status='open',1,0)) as open_count, SUM(IF(status='resolved',1,0)) as resolved_count")).first();
    const typeDist = await (db("risk_events") as any).select("risk_type", db.raw("COUNT(*) as count"), db.raw("SUM(IF(status='open',1,0)) as open_count")).groupBy("risk_type").orderByRaw("count DESC");
    res.json({ success: true, data: { summary: summary || {}, typeDist: typeDist || [] } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.put("/risk/events/:id/resolve", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("risk_events")) { res.json({ success: false, error: "risk table not ready" }); return; }
    await (db("risk_events") as any).where("id", req.params.id).update({ status: "resolved", resolved_by: req.user!.userId, resolved_at: db.fn.now(), resolution_note: req.body.resolution_note || "" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.put("/risk/events/:id/mute", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("risk_events")) { res.json({ success: false, error: "risk table not ready" }); return; }
    await (db("risk_events") as any).where("id", req.params.id).update({ status: "muted" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

// System health
router.get("/health/api-stats", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    if (!await checkTableExists("api_health_stats")) { res.json({ success: true, data: { stats: [], summary: {} } }); return; }
    const topR = await (db("api_health_stats") as any).select("endpoint", "method", "avg_response_ms", "p95_response_ms", "error_rate", "total_calls").orderBy("total_calls", "desc").limit(20);
    const totalCalls = await (db("api_health_stats") as any).sum("total_calls as total").first();
    res.json({ success: true, data: { stats: topR || [], summary: { totalCalls: Number((totalCalls as any)?.total || 0) } } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/health/database-stats", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    const configMod = require('../config');
    const dbName = (configMod.config as any).db.database;
    const tableR = await db.raw("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ?", [dbName]);
    const totalTables = Number((tableR as any)[0]?.[0]?.cnt || 0);
    res.json({ success: true, data: { total_tables: totalTables, status: "connected", checked_at: new Date().toISOString() } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/health/storage-stats", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    const totalBytes = await db("users").sum("storage_bytes as total").first().then((r: any) => Number(r?.total || 0));
    const topUsers = await (db("users") as any).select("id", "username", "storage_bytes").orderBy("storage_bytes", "desc").limit(10);
    res.json({ success: true, data: { total_bytes: totalBytes, top_users: topUsers || [], total_users_with_data: topUsers?.length || 0 } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});


// Invite codes & channel analysis
router.get("/invite-codes/stats", requireAuth, requireRole("admin", "test"), async (req: Request, res: Response) => {
  try {
    const days = req.query.timeRange === "7d" ? 7 : req.query.timeRange === "90d" ? 90 : 30;
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const totalR = await db("invite_codes").count("* as total").first() as any;
    const usedR = await db("invite_codes").where("is_used", 1).count("* as total").first() as any;
    const totalCodes = Number(totalR?.total || 0);
    const usedCodes = Number(usedR?.total || 0);
    const inviteUsers = await db("users").whereNotNull("invite_code").where("created_at", ">=", start);
    const inviteUserIds = (inviteUsers as any[]).map((u: any) => u.id);
    let payingUserIds: string[] = [];
    let totalRevenue = 0;
    if (inviteUserIds.length > 0) {
      const payR = await (db("recharge_orders") as any).select("user_id").sum("amount as total_amount").whereIn("user_id", inviteUserIds).where("status", "approved").groupBy("user_id");
      payingUserIds = (payR || []).map((r: any) => r.user_id);
      totalRevenue = (payR || []).reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
    }
    const batchStats = await (db("invite_codes") as any).select("batch_id").count("* as invite_count").sum(db.raw("IF(is_used=1,1,0) as used_count")).groupBy("batch_id").orderByRaw("invite_count DESC").limit(10);
    const batchDetails = [];
    for (const b of (batchStats as any[]) || []) {
      const codes = await (db("invite_codes") as any).select("code").where("batch_id", b.batch_id || "").where("is_used", 1);
      const codeList = (codes || []).map((c: any) => c.code);
      let regUsers: any[] = [];
      let batchPaying = 0;
      let batchRevenue = 0;
      if (codeList.length > 0) {
        regUsers = await (db("users") as any).select("id").whereIn("invite_code", codeList).where("created_at", ">=", start);
        if (regUsers.length > 0) {
          const regIds = regUsers.map((u: any) => u.id);
          const payR = await (db("recharge_orders") as any).select("user_id").sum("amount as total_amount").whereIn("user_id", regIds).where("status", "approved").groupBy("user_id");
          batchPaying = (payR || []).length;
          batchRevenue = (payR || []).reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
        }
      }
      batchDetails.push({ channel: b.batch_id || "默认", invite_count: Number(b.invite_count || 0), used_count: Number(b.used_count || 0), registered_users: regUsers.length, paying_users: batchPaying, revenue: batchRevenue });
    }
    res.json({ success: true, data: { totalCodes, usedCodes, availableCodes: totalCodes - usedCodes, totalUsers: inviteUserIds.length, payingUsers: payingUserIds.length, totalRevenue, registrationRate: totalCodes > 0 ? parseFloat(((usedCodes / totalCodes) * 100).toFixed(1)) : 0, paymentRate: inviteUserIds.length > 0 ? parseFloat(((payingUserIds.length / inviteUserIds.length) * 100).toFixed(1)) : 0, batchDetails } });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

export default router;
