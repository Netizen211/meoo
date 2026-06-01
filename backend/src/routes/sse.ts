import { Router, Request, Response } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { sse } from "../services/sseService";
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '../middleware/auth';

const router = Router();

// GET /api/v1/sse — 建立 SSE 连接（支持 Header 认证 + Query param 认证）
router.get("/", (req: Request, res: Response) => {
  // 优先从 Authorization header 认证，其次从 query token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.substring(7), config.jwt.secret) as JwtPayload;
      (req as any).user = payload;
    } catch {
      res.status(401).json({ success: false, error: '认证令牌无效' });
      return;
    }
  } else if (req.query.token) {
    try {
      const payload = jwt.verify(req.query.token as string, config.jwt.secret) as JwtPayload;
      (req as any).user = payload;
    } catch {
      res.status(401).json({ success: false, error: '认证令牌无效' });
      return;
    }
  } else {
    res.status(401).json({ success: false, error: '未提供认证令牌' });
    return;
  }

  sse.connect(req, res);
});

// GET /api/v1/sse/stats — 查看连接统计（管理用）
router.get("/stats", requireAuth, (_req: Request, res: Response) => {
  res.json({ success: true, data: sse.stats() });
});

export default router;