/**
 * 报告路由 — 提供HTML报告静态访问
 * 用于在Admin后台查看UI分析报告等
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import path from 'path';
import fs from 'fs';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

// 报告文件目录
const REPORTS_DIR = path.resolve(__dirname, '../../reports');

// GET /api/admin/reports — 报告列表
router.get('/', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      res.json({ success: true, data: [] });
      return;
    }
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return {
          id: f.replace('.html', ''),
          name: f,
          title: getReportTitle(f),
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      });
    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取报告列表失败' });
  }
});

// GET /api/admin/reports/:id — 查看具体报告（返回HTML内容）
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // 安全校验：防止路径穿越
    const safeId = path.basename(id.replace(/\.\./g, ''));
    const filePath = path.join(REPORTS_DIR, safeId.endsWith('.html') ? safeId : safeId + '.html');

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ success: false, error: '读取报告失败' });
  }
});

/**
 * 根据文件名推断报告标题
 */
function getReportTitle(filename: string): string {
  const map: Record<string, string> = {
    'ui-feasibility-report.html': 'UI可配置化可行性分析报告',
  };
  return map[filename] || filename.replace('.html', '');
}

export default router;
