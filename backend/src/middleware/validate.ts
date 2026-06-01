/**
 * Zod 请求校验中间件
 *
 * 用法：
 *   router.post('/sync', validate(syncSchema), handler);
 *
 * 原理：先校验 body/query/params，不通过直接返回 400 + 详细错误
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

interface Validator {
  schema: z.ZodType<any>;
  target?: ValidationTarget;
}

/**
 * 校验请求 body（默认）
 */
export function validate(schema: z.ZodType<any>, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
      const parsed = schema.parse(data);
      // 替换为校验后的数据（带默认值、类型转换）
      if (target === 'body') req.body = parsed;
      else if (target === 'query') (req as any).validatedQuery = parsed;
      else (req as any).validatedParams = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((e: any) => ({
          field: (e.path || []).join('.'),
          message: e.message,
        }));
        res.status(400).json({
          success: false,
          error: '请求参数校验失败',
          details,
        });
        return;
      }
      next(err);
    }
  };
}

// ─── 共享校验规则 ──────────────────────────────────

export const storeIdSchema = z.string().min(1).max(64);
export const configKeySchema = z.string().min(1).max(128);
export const categorySchema = z.enum([
  'orders', 'promotionSummary', 'promotionProducts',
  'starStoreSummary', 'liveStreamSummary', 'shippingInsurance',
  'afterSaleRecords', 'financialRecords',
]);

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128), // 不限制最小长度（不影响已有用户）
});

export const registerSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
  email: z.string().email().optional(),
  inviteCode: z.string().min(1).max(36),
  smsCode: z.string().length(6).optional(),
});

export const syncSchema = z.object({
  storeId: storeIdSchema,
  storeName: z.string().max(128).optional().default('未命名店铺'),
  clientUpdatedAt: z.string().optional(),
  data: z.record(z.string(), z.any()).optional().default({}),
  configs: z.record(z.string(), z.any()).optional().default({}),
  uploadRecords: z.array(z.any()).optional().default([]),
});

export const configSyncSchema = z.object({
  storeId: storeIdSchema,
  configKey: configKeySchema,
  payloadJson: z.string(),
});

export const pullSchema = z.object({
  storeId: storeIdSchema,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const sendCodeSchema = z.object({
  email: z.string().email(),
});

export const storeCreateSchema = z.object({
  name: z.string().min(1).max(128),
});

export const storeUpdateSchema = z.object({
  name: z.string().min(1).max(128),
});

export default validate;
