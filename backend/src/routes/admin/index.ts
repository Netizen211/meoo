import { Router } from 'express';

// ===== 领域模块路由（从按功能拆分的文件导入） =====
import dashboardRouter from './dashboard';
import usersRouter from './users';
import revenueRouter from './revenue';
import logsRouter from './logs';
import configRouter from './config';
import subAccountsRouter from './sub-accounts';
import announcementsRouter from './announcements';
import storesRouter from './stores';
import systemRouter from './system';
import operationsRouter from './operations';

// ===== 每个模块内部都有 requireAuth + requireRole 中间件 =====
const router = Router();

router.use(dashboardRouter);
router.use(usersRouter);
router.use(revenueRouter);
router.use(logsRouter);
router.use(configRouter);
router.use(subAccountsRouter);
router.use(announcementsRouter);
router.use(storesRouter);
router.use(systemRouter);
router.use(operationsRouter);

export default router;
