/**
 * 调试管理路由 — IP白名单 + 调试配置
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { loadDebugConfig, saveDebugConfig, DebugConfig, listReports, getReport, updateReportStatus } from '../../services/debugService';

const router = Router();
router.use(requireAuth, requireRole('admin', 'test'));

// GET /api/admin/debug-config — 获取调试配置
router.get('/debug-config', async (_req: Request, res: Response) => {
  try {
    const config = loadDebugConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取调试配置失败' });
  }
});

// PUT /api/admin/debug-config — 更新调试配置
router.put('/debug-config', async (req: Request, res: Response) => {
  try {
    const updates: Partial<DebugConfig> = req.body;
    const current = loadDebugConfig();
    const updated: DebugConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (saveDebugConfig(updated)) {
      res.json({ success: true, data: updated });
    } else {
      res.status(500).json({ success: false, error: '保存调试配置失败' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: '更新调试配置失败' });
  }
});

// GET /api/admin/debug/reports — 获取 Bug 报告列表
router.get('/debug/reports', async (_req: Request, res: Response) => {
  try {
    const reports = listReports();
    res.json({ success: true, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取报告列表失败' });
  }
});

// GET /api/admin/debug/reports/:id — 获取单个报告详情
router.get('/debug/reports/:id', async (req: Request, res: Response) => {
  try {
    const report = getReport(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取报告详情失败' });
  }
});

// PUT /api/admin/debug/reports/:id/status — 更新报告状态
router.put('/debug/reports/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved', 'wontfix'].includes(status)) {
      res.status(400).json({ success: false, error: '无效的状态值' });
      return;
    }
    if (updateReportStatus(req.params.id, status)) {
      res.json({ success: true, message: '状态已更新' });
    } else {
      res.status(404).json({ success: false, error: '报告不存在' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: '更新状态失败' });
  }
});

export default router;
