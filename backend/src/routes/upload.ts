/**
 * 服务端批量上传路由 (Upload Routes)
 *
 * 大厂方案：前端上传 → 服务端解析 → 直接入库 → SSE 实时推送进度
 *
 * 端点：
 *   POST   /api/v1/upload/batch     — 批量上传文件（multipart, 最多500个文件）
 *   GET    /api/v1/upload/progress/:taskId  — 查询某个任务进度
 *   GET    /api/v1/upload/tasks      — 查询当前用户所有任务
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { sse } from '../services/sseService';
import { createBatchTask, processBatchTask, getTask, getAllTasks } from '../services/batchParserService';
import logger from '../services/loggerService';

const router = Router();

// ===== 临时存储目录 =====
const UPLOAD_DIR = path.resolve(process.cwd(), 'temp_uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ===== Multer 配置：大文件批量上传 =====
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      // 保持原始文件名，加 UUID 前缀防止冲突
      const safeName = `${uuidv4().slice(0, 8)}_${file.originalname}`;
      cb(null, safeName);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 500,                    // 最多 500 个文件
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.csv', '.xlsx', '.xls', '.tsv', '.txt'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}，仅支持 CSV/XLSX/XLS/TSV/TXT`));
    }
  },
});

// ===== POST /batch — 批量上传 =====
router.post('/batch', requireAuth, (req: Request, res: Response) => {
  upload.array('files', 500)(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ success: false, error: '单个文件不能超过 100MB' });
          return;
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          res.status(413).json({ success: false, error: '一次性最多上传 500 个文件' });
          return;
        }
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: '没有上传文件' });
      return;
    }

    const userId = (req as any).user?.userId || 'anonymous';
    const storeId = req.body.storeId || (req as any).user?.storeId || 'default';
    const storeName = req.body.storeName || storeId;

    // 创建任务
    const task = createBatchTask(userId, storeId, storeName);

    // 返回 taskId 给前端
    res.json({
      success: true,
      data: {
        taskId: task.taskId,
        fileCount: files.length,
        message: '文件已上传，后台开始解析...',
      },
    });

    // 异步执行解析（不阻塞响应）
    const fileInfos = files.map(f => ({
      originalName: f.originalname,
      path: f.path,
    }));

    // 在后台执行，不 await
    processBatchTask(task, fileInfos).catch((processErr: any) => {
      logger.error('Batch processing error', { error: processErr.message, extra: { taskId: task.taskId } as any });
    });
  });
});

// ===== GET /progress/:taskId — 查询任务进度 =====
router.get('/progress/:taskId', requireAuth, (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = getTask(taskId);

  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在或已过期' });
    return;
  }

  // 验证归属
  const userId = (req as any).user?.userId || 'anonymous';
  if (task.userId !== userId) {
    res.status(403).json({ success: false, error: '无权查看此任务' });
    return;
  }

  res.json({
    success: true,
    data: {
      taskId: task.taskId,
      status: task.status,
      progress: task.progress,
      files: task.files.map(f => ({
        originalName: f.originalName,
        category: f.category,
        rowCount: f.rowCount,
        error: f.error,
      })),
      error: task.error,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    },
  });
});

// ===== GET /tasks — 查询当前用户所有任务 =====
router.get('/tasks', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).user?.userId || 'anonymous';
  const tasks = getAllTasks(userId);

  res.json({
    success: true,
    data: tasks.map(t => ({
      taskId: t.taskId,
      status: t.status,
      progress: t.progress,
      fileCount: t.files.length,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    })),
  });
});

// ===== 错误处理中间件（multer 错误捕获） =====
router.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err instanceof multer.MulterError) {
    res.status(413).json({ success: false, error: `上传错误: ${err.message}` });
    return;
  }
  logger.error('Upload route error', { error: err.message });
  res.status(500).json({ success: false, error: '上传服务内部错误' });
});

export default router;
