import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Store, CreditCard, History, Monitor,
  FileText, Upload, Ban, CheckCircle, Key, Trash2,
  ShieldOff, Save, Clock, Globe, Smartphone,
  AlertTriangle, XCircle, MessageSquare,
} from 'lucide-react';
import { adminApi, UserFullDetail } from '../../../api/adminApi';

const TABS = [
  { key: 'profile', label: '用户档案', icon: User },
  { key: 'stores', label: '店铺数据', icon: Store },
  { key: 'recharge', label: '充值记录', icon: CreditCard },
  { key: 'membership', label: '会员变更', icon: History },
  { key: 'sessions', label: '活跃会话', icon: Monitor },
  { key: 'uploads', label: '上传记录', icon: Upload },
  { key: 'operations', label: '操作日志', icon: FileText },
  { key: 'danger', label: '危险操作', icon: AlertTriangle },
];

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<UserFullDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [actionMsg, setActionMsg] = useState('');
  const [userNote, setUserNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [resetPwModal, setResetPwModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    const data = await adminApi.getUserFullDetail(id);
    if (data) setDetail(data);
    const note = await adminApi.getUserNote(id);
    setUserNote(note);
    setLoading(false);
  };

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleToggleBan = async () => {
    if (!detail || !id) return;
    const ok = await adminApi.toggleBan(id, !detail.profile.isBanned, '管理员操作');
    if (ok) {
      showMsg(detail.profile.isBanned ? '用户已解封' : '用户已封禁');
      loadDetail();
    }
  };

  const handleResetPassword = async () => {
    if (!id || newPassword.length < 6) return;
    const res = await adminApi.resetUserPassword(id, newPassword);
    if (res.success) {
      showMsg('密码已重置，用户所有会话已强制下线');
      setResetPwModal(false);
      setNewPassword('');
      loadDetail();
    } else {
      showMsg(res.error || '操作失败');
    }
  };

  const handleSaveNote = async () => {
    if (!id) return;
    setNoteSaving(true);
    const res = await adminApi.updateUserNote(id, userNote);
    if (res.success) showMsg('备注已保存');
    setNoteSaving(false);
  };

  const handleForceLogout = async () => {
    if (!id) return;
    const res = await adminApi.revokeAllSessions(id);
    if (res.success) {
      showMsg(`已强制下线 ${(res as any).revoked} 个会话`);
      loadDetail();
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!id) return;
    await adminApi.revokeSession(id, sessionId);
    showMsg('会话已撤销');
    loadDetail();
  };

  const handleDeleteAccount = async () => {
    if (!id || !detail || deleteConfirm !== detail.profile.username) return;
    const res = await adminApi.deleteUserAccount(id);
    if (res.success) {
      showMsg('账号已完全删除');
      setTimeout(() => navigate('/users'), 1500);
    } else {
      showMsg(res.error || '删除失败');
    }
  };

  if (loading) return <div className="p-4 text-pdd-text-secondary">加载中...</div>;
  if (!detail) return <div className="p-4 text-red-400">用户不存在</div>;

  const p = detail.profile;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/users')} className="p-1.5 rounded-lg hover:bg-pdd-bg text-pdd-text-secondary">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-pdd-text-primary flex items-center gap-2">
            {p.username}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              p.role === 'admin' ? 'bg-red-500/10 text-red-400' :
              p.role === 'test' ? 'bg-purple-500/10 text-purple-400' :
              p.isSubAccount ? 'bg-blue-500/10 text-blue-400' :
              'bg-gray-500/10 text-gray-400'
            }`}>
              {p.isSubAccount ? '子账号' : p.role === 'admin' ? '管理员' : p.role === 'test' ? '测试' : '普通用户'}
            </span>
            {p.isBanned && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">已封禁</span>}
          </h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">ID: {p.id} | 注册: {new Date(p.createdAt).toLocaleString('zh-CN')}</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button onClick={handleForceLogout} className="px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1.5">
            <ShieldOff size={13} /> 强制下线
          </button>
          <button onClick={handleToggleBan}
            className={`px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 ${
              p.isBanned
                ? 'border-green-500/20 text-green-400 hover:bg-green-500/10'
                : 'border-red-500/20 text-red-400 hover:bg-red-500/10'
            }`}>
            {p.isBanned ? <CheckCircle size={13} /> : <Ban size={13} />}
            {p.isBanned ? '解封' : '封禁'}
          </button>
          <button onClick={() => setResetPwModal(true)} className="px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1.5">
            <Key size={13} /> 重置密码
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded border border-pdd-success/20">{actionMsg}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-pdd-border overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-amber-400 text-amber-400 font-medium'
                : 'border-transparent text-pdd-text-secondary hover:text-pdd-text'
            }`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-pdd-card rounded-xl p-4 border border-pdd-border">
              <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">基本信息</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-pdd-text-secondary">用户名</span><span className="text-pdd-text-primary font-medium">{p.username}</span></div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">用户ID</span><span className="text-pdd-text-primary font-mono text-[11px]">{p.id}</span></div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">角色</span><span className="text-pdd-text-primary">{p.role}</span></div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">会员等级</span>
                  <span className={`font-medium ${p.membershipLevel === 'enterprise' ? 'text-purple-400' : p.membershipLevel === 'pro' ? 'text-amber-400' : 'text-gray-400'}`}>
                    {p.membershipLevel === 'enterprise' ? '企业版' : p.membershipLevel === 'pro' ? '专业版' : '免费版'}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">到期时间</span>
                  <span className="text-pdd-text-primary">{p.membershipExpiresAt ? new Date(p.membershipExpiresAt).toLocaleString('zh-CN') : '长期'}</span>
                </div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">手机/邮箱</span><span className="text-pdd-text-primary">{p.phone || '未填写'}</span></div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">账号类型</span><span className="text-pdd-text-primary">{p.isSubAccount ? `子账号 (主账号: ${p.parentUserId})` : '主账号'}</span></div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">注册时间</span><span className="text-pdd-text-primary">{new Date(p.createdAt).toLocaleString('zh-CN')}</span></div>
                <div className="flex justify-between"><span className="text-pdd-text-secondary">状态</span>
                  <span className={p.isBanned ? 'text-red-400' : 'text-green-400'}>{p.isBanned ? '已封禁' : '正常'}
                    {p.bannedReason && <span className="text-pdd-text-secondary ml-1">({p.bannedReason})</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-pdd-card rounded-xl p-4 border border-pdd-border">
              <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">数据概览</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-pdd-bg rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-pdd-text-primary">{detail.stores.length}</div>
                  <div className="text-[10px] text-pdd-text-secondary mt-0.5">店铺数</div>
                </div>
                <div className="bg-pdd-bg rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-pdd-text-primary">{detail.rechargeRecords.length}</div>
                  <div className="text-[10px] text-pdd-text-secondary mt-0.5">充值次数</div>
                </div>
                <div className="bg-pdd-bg rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-pdd-text-primary">{detail.sessions.length}</div>
                  <div className="text-[10px] text-pdd-text-secondary mt-0.5">活跃会话</div>
                </div>
                <div className="bg-pdd-bg rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-pdd-text-primary">{detail.uploadRecords.length}</div>
                  <div className="text-[10px] text-pdd-text-secondary mt-0.5">上传次数</div>
                </div>
              </div>
            </div>

            {/* 管理员备注 */}
            <div className="bg-pdd-card rounded-xl p-4 border border-pdd-border md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-1.5">
                  <MessageSquare size={14} /> 管理员备注
                </h3>
                <button onClick={handleSaveNote} disabled={noteSaving}
                  className="px-3 py-1 text-xs rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 flex items-center gap-1 disabled:opacity-50">
                  <Save size={12} /> {noteSaving ? '保存中...' : '保存'}
                </button>
              </div>
              <textarea value={userNote} onChange={e => setUserNote(e.target.value)}
                placeholder="添加内部备注（仅管理员可见）..."
                rows={3}
                className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50 resize-none" />
            </div>
          </div>
        )}

        {activeTab === 'stores' && (
          <div>
            {detail.stores.length === 0 ? (
              <div className="text-center py-12 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
                <Store size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无店铺</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detail.stores.map(store => (
                  <motion.div key={store.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-pdd-card rounded-xl border border-pdd-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-pdd-text-primary">{store.name || '未命名店铺'}</h4>
                        <p className="text-[10px] text-pdd-text-secondary mt-0.5">ID: {store.id}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-pdd-text-secondary">
                        <span>{store.totalRows.toLocaleString()} 条数据</span>
                        {store.lastUpload && <span className="flex items-center gap-1"><Clock size={10} /> {new Date(store.lastUpload).toLocaleString('zh-CN')}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recharge' && (
          <div>
            {detail.rechargeRecords.length === 0 ? (
              <div className="text-center py-12 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
                <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无充值记录</p>
              </div>
            ) : (
              <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-pdd-bg">
                    <tr className="text-left text-pdd-text-secondary">
                      <th className="px-4 py-2.5 font-medium">ID</th>
                      <th className="px-4 py-2.5 font-medium">套餐</th>
                      <th className="px-4 py-2.5 font-medium">时长</th>
                      <th className="px-4 py-2.5 font-medium">金额</th>
                      <th className="px-4 py-2.5 font-medium">状态</th>
                      <th className="px-4 py-2.5 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rechargeRecords.map(r => (
                      <tr key={r.id} className="border-t border-pdd-border hover:bg-pdd-bg/50">
                        <td className="px-4 py-2.5 font-mono">{r.id}</td>
                        <td className="px-4 py-2.5">{r.plan === 'pro' ? '专业版' : '企业版'}</td>
                        <td className="px-4 py-2.5">{r.duration === 'monthly' ? '月付' : '年付'}</td>
                        <td className="px-4 py-2.5 text-pdd-text-primary font-medium">¥{r.amount}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            r.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                            r.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                            'bg-yellow-500/10 text-yellow-400'
                          }`}>
                            {r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已拒绝' : '待审核'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-pdd-text-secondary">{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'membership' && (
          <div>
            {detail.membershipHistory.length === 0 ? (
              <div className="text-center py-12 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
                <History size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无会员变更记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.membershipHistory.map(h => (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-pdd-card rounded-lg border border-pdd-border p-3 flex items-center gap-3">
                    <History size={16} className="text-pdd-text-secondary flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs">
                        <span className="text-pdd-text-primary font-medium">{h.fromLevel}</span>
                        <span className="text-pdd-text-secondary mx-2">→</span>
                        <span className="text-pdd-text-primary font-medium">{h.toLevel}</span>
                        {h.note && <span className="text-pdd-text-secondary ml-2">— {h.note}</span>}
                      </div>
                      <div className="text-[10px] text-pdd-text-secondary mt-0.5">
                        操作人: {h.operatedBy} | {new Date(h.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-pdd-text-secondary">共 {detail.sessions.length} 个活跃会话</span>
              {detail.sessions.length > 0 && (
                <button onClick={handleForceLogout}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 flex items-center gap-1.5">
                  <XCircle size={12} /> 强制全部下线
                </button>
              )}
            </div>
            {detail.sessions.length === 0 ? (
              <div className="text-center py-12 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
                <Monitor size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">无活跃会话</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detail.sessions.map(s => (
                  <motion.div key={s.sessionId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-pdd-card rounded-xl border border-pdd-border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {s.deviceInfo?.toLowerCase().includes('mobile') || s.userAgent?.toLowerCase().includes('mobile')
                            ? <Smartphone size={14} className="text-blue-400" />
                            : <Monitor size={14} className="text-blue-400" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${new Date(s.expiresAt) > new Date() ? 'bg-green-400' : 'bg-gray-400'}`} />
                            <span className="text-xs font-medium text-pdd-text-primary">
                              {s.ipAddress || '未知IP'}
                            </span>
                            <span className="text-[10px] text-pdd-text-secondary">
                              {s.deviceInfo || s.userAgent?.substring(0, 60) || '未知设备'}
                            </span>
                          </div>
                          <div className="text-[10px] text-pdd-text-secondary mt-1 space-x-3">
                            <span className="flex items-center gap-1 inline-flex"><Globe size={9} /> 登录: {new Date(s.createdAt).toLocaleString('zh-CN')}</span>
                            <span className="flex items-center gap-1 inline-flex"><Clock size={9} /> 最后活动: {new Date(s.lastActivityAt).toLocaleString('zh-CN')}</span>
                            <span>过期: {new Date(s.expiresAt).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleRevokeSession(s.sessionId)}
                        className="p-1.5 rounded-lg text-pdd-text-secondary hover:text-red-400 hover:bg-red-500/10 flex-shrink-0">
                        <XCircle size={15} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'uploads' && (
          <div>
            {detail.uploadRecords.length === 0 ? (
              <div className="text-center py-12 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
                <Upload size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无上传记录</p>
              </div>
            ) : (
              <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-pdd-bg">
                    <tr className="text-left text-pdd-text-secondary">
                      <th className="px-4 py-2.5 font-medium">店铺</th>
                      <th className="px-4 py-2.5 font-medium">分类</th>
                      <th className="px-4 py-2.5 font-medium">文件名</th>
                      <th className="px-4 py-2.5 font-medium">行数</th>
                      <th className="px-4 py-2.5 font-medium">上传时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.uploadRecords.map(r => (
                      <tr key={r.id} className="border-t border-pdd-border hover:bg-pdd-bg/50">
                        <td className="px-4 py-2.5 text-pdd-text-primary">{r.storeName || r.storeId}</td>
                        <td className="px-4 py-2.5">{r.category}</td>
                        <td className="px-4 py-2.5 text-pdd-text-secondary max-w-[200px] truncate">{r.fileName || '-'}</td>
                        <td className="px-4 py-2.5">{r.rowCount?.toLocaleString() || '-'}</td>
                        <td className="px-4 py-2.5 text-pdd-text-secondary">{new Date(r.uploadedAt).toLocaleString('zh-CN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'operations' && (
          <div>
            {detail.operationLogs.length === 0 ? (
              <div className="text-center py-12 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无操作日志</p>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.operationLogs.map((log: any, i: number) => (
                  <motion.div key={log.id || i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-pdd-card rounded-lg border border-pdd-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pdd-bg text-pdd-text-secondary font-medium">{log.action}</span>
                      <span className="text-xs text-pdd-text-primary">{log.details || log.target_type}</span>
                      <span className="text-[10px] text-pdd-text-secondary ml-auto">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="max-w-lg space-y-3">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} /> 危险操作区
              </h3>
              <p className="text-xs text-pdd-text-secondary mb-4">
                以下操作不可撤销，请谨慎执行。删除账号将清除用户所有数据（店铺、充值记录、会话、日志等）。
              </p>
              <button
                onClick={() => { setDeleteModal(true); setDeleteConfirm(''); }}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-2">
                <Trash2 size={14} /> 完全删除账号
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPwModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setResetPwModal(false)}>
          <div className="bg-pdd-card rounded-xl p-6 max-w-sm w-full shadow-xl border border-pdd-border" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-pdd-text-primary mb-3">重置用户密码</h3>
            <p className="text-xs text-pdd-text-secondary mb-3">为用户 <span className="text-pdd-text-primary font-medium">{p.username}</span> 设置新密码。重置后将强制下线所有会话。</p>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
              type="text" placeholder="输入新密码（至少6位）"
              className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setResetPwModal(false)} className="flex-1 py-2 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary">取消</button>
              <button onClick={handleResetPassword} disabled={newPassword.length < 6}
                className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium disabled:opacity-50 hover:bg-red-500/20">
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteModal(false)}>
          <div className="bg-pdd-card rounded-xl p-6 max-w-sm w-full shadow-xl border border-pdd-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-pdd-text-primary">确认删除账号</h3>
            </div>
            <p className="text-xs text-pdd-text-secondary mb-2">
              将永久删除用户 <span className="text-red-400 font-medium">{p.username}</span> 及其全部数据：
            </p>
            <ul className="text-xs text-pdd-text-secondary mb-4 space-y-1 list-disc list-inside">
              <li>{detail.stores.length} 个店铺及所有数据</li>
              <li>{detail.rechargeRecords.length} 条充值记录</li>
              <li>所有会话、日志、子账号</li>
            </ul>
            <p className="text-xs text-red-400 mb-3">请输入用户名 <span className="font-bold">{p.username}</span> 确认：</p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={p.username}
              className="w-full px-3 py-2 border border-red-500/20 rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-red-500/50 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(false)} className="flex-1 py-2 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary">取消</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirm !== p.username}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-50 hover:bg-red-600">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
