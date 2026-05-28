import { apiClient } from './client';

export interface RechargeApplyParams {
  plan: 'pro' | 'enterprise';
  duration: 'monthly' | 'yearly';
  amount: number;
  wechatNickname?: string;
  remark?: string;
}

export interface RechargeRecord {
  id: number;
  plan: string;
  duration: string;
  amount: number;
  wechatNickname: string;
  remark: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

export const rechargeApi = {
  // 提交充值申请
  async apply(params: RechargeApplyParams) {
    const res = await apiClient.post('/recharge/apply', params);
    return res;
  },

  // 获取我的充值记录
  async getMyRecords(): Promise<RechargeRecord[]> {
    const res = await apiClient.get<RechargeRecord[]>('/recharge/my');
    return res.success ? (res.data || []) : [];
  },
};
