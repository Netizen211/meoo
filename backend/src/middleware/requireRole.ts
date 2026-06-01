import { Request, Response, NextFunction } from 'express';

// RBAC 角色检查中间件工厂
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未认证' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    next();
  };
}

// 要求付费会员（pro 或 enterprise）
export function requirePaid(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: '未认证' });
    return;
  }
  if (req.user.membershipLevel === 'free') {
    res.status(403).json({ success: false, error: '该功能需要付费会员', code: 'UPGRADE_REQUIRED' });
    return;
  }
  next();
}
