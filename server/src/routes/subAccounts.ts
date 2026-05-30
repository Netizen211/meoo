import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import bcrypt from 'bcrypt';

const router = Router();
router.use(requireAuth);

const PRESET_ROLES = {
  '管理员': { pages:{dashboard:1,product:1,promotion:1,finance:1,afterSale:1,insurance:1,region:1,trend:1,user:1,risk:1,cost:1,stores:1,upload:1,membership:1,settings:1}, funcs:{export:1,delete:1,editCost:1,manageStores:1,uploadData:1,viewAmount:1}, scope:'all' },
  '运营专员': { pages:{dashboard:1,product:1,promotion:1,afterSale:1,region:1,trend:1,user:1,cost:1,upload:1}, funcs:{export:1,editCost:1,uploadData:1,viewAmount:1}, scope:'all' },
  '客服专员': { pages:{dashboard:1,afterSale:1}, funcs:{export:1}, scope:'all' },
  '财务专员': { pages:{dashboard:1,finance:1,cost:1}, funcs:{export:1,viewAmount:1}, scope:'all' },
  '只读观察': { pages:{dashboard:1,product:1,promotion:1,afterSale:1,region:1,trend:1}, funcs:{viewAmount:1}, scope:'all' },
};

// 主账号检查
async function isMainAccount(userId: string): Promise<boolean> {
  const u = await db('users').where('id', userId).first();
  return u && !u.parent_user_id && !u.is_sub_account;
}

// GET 子账号列表
router.get('/', async (req: Request, res: Response) => {
  const subs = await db('users').where('parent_user_id', req.user!.userId).select('id','username','phone','sub_role_id','is_banned','created_at');
  const roles = await db('sub_roles').where('parent_user_id', req.user!.userId);
  res.json({ success: true, data: { accounts: subs, roles } });
});

// POST 创建子账号
router.post('/', async (req: Request, res: Response) => {
  if (!(await isMainAccount(req.user!.userId))) {
    res.status(403).json({ success: false, error: '仅主账号可创建子账号' }); return;
  }
  const { username, password, phone, roleName } = req.body;
  if (!username || !password) { res.status(400).json({ success: false, error: '缺少参数' }); return; }

  const role = roleName || '只读观察';
  const perms = (PRESET_ROLES as any)[role] || PRESET_ROLES['只读观察'];

  const hash = await bcrypt.hash(password, 10);
  const subId = `sub-${Date.now()}`;
  await db('users').insert({ id: subId, username, password_hash: hash, phone: phone || '', role: 'sub_account', membership_level: 'enterprise', parent_user_id: req.user!.userId, is_sub_account: 1 });

  // 存角色
  await db('sub_roles').insert({ parent_user_id: req.user!.userId, name: role, permissions: JSON.stringify(perms), is_preset: 1 });

  res.json({ success: true, data: { id: subId, username, phone, role } });
});

// DELETE 删除子账号
router.delete('/:id', async (req: Request, res: Response) => {
  const sub = await db('users').where({ id: req.params.id, parent_user_id: req.user!.userId }).first();
  if (!sub) { res.status(404).json({ success: false, error: '子账号不存在' }); return; }
  await db('users').where('id', req.params.id).del();
  await db('user_sessions').where('user_id', req.params.id).del();
  await db('user_operation_logs').where('user_id', req.params.id).del();
  res.json({ success: true });
});

// GET 操作日志
router.get('/logs', async (req: Request, res: Response) => {
  const { page = 1, pageSize = 20, subUserId } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);
  let q = db('user_operation_logs').where('parent_user_id', req.user!.userId);
  if (subUserId) q = q.where('user_id', subUserId as string);
  const total = await q.clone().count('* as cnt').first();
  const rows = await q.orderBy('created_at', 'desc').offset(offset).limit(Number(pageSize));
  res.json({ success: true, data: rows, total: (total as any)?.cnt || 0, page: Number(page), pageSize: Number(pageSize) });
});

// GET 登录会话
router.get('/sessions', async (req: Request, res: Response) => {
  const sessions = await db('user_sessions')
    .join('users', 'user_sessions.user_id', 'users.id')
    .where('users.parent_user_id', req.user!.userId)
    .where('user_sessions.is_active', 1)
    .select('user_sessions.*', 'users.username');
  res.json({ success: true, data: sessions });
});

// POST 强制下线
router.post('/sessions/:id/revoke', async (req: Request, res: Response) => {
  await db('user_sessions').where('id', req.params.id).update({ is_active: 0 });
  res.json({ success: true });
});

export default router;
