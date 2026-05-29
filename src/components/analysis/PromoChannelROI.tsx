/**
 * 推广渠道ROI对比 — P0-4
 */
import React, { useMemo } from 'react';
import { Target } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ChannelData {
  channel: string;
  cost: number;
  gmv: number;
  orders: number;
  roi: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  '商品推广': '#3b82f6', '明星店铺': '#f59e0b', '直播推广': '#ec4899', '其他': '#6b7280',
  '搜索推广': '#3b82f6', '场景推广': '#8b5cf6', '全站推广': '#06b6d4', '多多进宝': '#22c55e',
};

interface Props {
  promoProducts: any[];
  promotionSummary: any[];
  starStoreSummary: any[];
  liveStreamSummary: any[];
}

export default function PromoChannelROI({ promoProducts, promotionSummary, starStoreSummary, liveStreamSummary }: Props) {
  const channels = useMemo(() => {
    const result: ChannelData[] = [];

    const sum = (arr: any[], costF: string, gmvF: string, ordF: string, impF: string, clkF: string) => ({
      cost: arr.reduce((s, r) => s + (parseFloat(r[costF]) || 0), 0),
      gmv: arr.reduce((s, r) => s + (parseFloat(r[gmvF]) || 0), 0),
      orders: arr.reduce((s, r) => s + (parseInt(r[ordF]) || 0), 0),
      impressions: arr.reduce((s, r) => s + (parseInt(r[impF]) || 0), 0),
      clicks: arr.reduce((s, r) => s + (parseInt(r[clkF]) || 0), 0),
    });

    const make = (channel: string, s: ReturnType<typeof sum>) => ({
      channel, ...s,
      roi: s.cost > 0 ? s.gmv / s.cost : 0,
      ctr: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0,
    });

    if (promoProducts.length) result.push(make('商品推广', sum(promoProducts, '总花费(元)', '交易额(元)', '成交笔数', '曝光量', '点击量')));
    if (starStoreSummary.length) result.push(make('明星店铺', sum(starStoreSummary, '花费(元)', '交易额(元)', '成交笔数', '曝光量', '点击量')));
    if (liveStreamSummary.length) result.push(make('直播推广', sum(liveStreamSummary, '花费(元)', '交易额(元)', '成交笔数', '曝光量', '点击量')));

    return result.filter(c => c.cost > 0).sort((a, b) => b.roi - a.roi);
  }, [promoProducts, promotionSummary, starStoreSummary, liveStreamSummary]);

  if (!channels.length) return null;

  const pieCost = channels.map(c => ({ name: c.channel, value: Math.round(c.cost) }));
  const pieGMV = channels.map(c => ({ name: c.channel, value: Math.round(c.gmv) }));

  return (
    <div className="pdd-card rounded-xl border border-pdd-border p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5">
        <Target size={13} color="#7c3aed" />推广渠道对比
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* 花费占比 */}
        <div>
          <div className="text-[10px] text-pdd-text-secondary text-center mb-1">花费占比</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={pieCost} cx="50%" cy="50%" outerRadius={40} dataKey="value">
                {pieCost.map((_, i) => <Cell key={i} fill={Object.values(CHANNEL_COLORS)[i % 6]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => '¥' + v.toFixed(0)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* 成交占比 */}
        <div>
          <div className="text-[10px] text-pdd-text-secondary text-center mb-1">成交占比</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={pieGMV} cx="50%" cy="50%" outerRadius={40} dataKey="value">
                {pieGMV.map((_, i) => <Cell key={i} fill={Object.values(CHANNEL_COLORS)[i % 6]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => '¥' + v.toFixed(0)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* 渠道明细表 */}
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-pdd-border text-pdd-text-secondary">
            <th className="text-left py-1">渠道</th>
            <th className="text-right py-1">花费</th>
            <th className="text-right py-1">GMV</th>
            <th className="text-right py-1">ROI</th>
            <th className="text-right py-1">CTR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pdd-border/30">
          {channels.map(c => (
            <tr key={c.channel}>
              <td className="py-1 text-pdd-text font-medium">{c.channel}</td>
              <td className="py-1 text-right font-mono">¥{c.cost.toFixed(0)}</td>
              <td className="py-1 text-right font-mono">¥{c.gmv.toFixed(0)}</td>
              <td className={`py-1 text-right font-mono font-bold ${c.roi >= 2 ? 'text-green-600' : c.roi >= 1 ? 'text-yellow-600' : 'text-red-500'}`}>{c.roi.toFixed(2)}</td>
              <td className="py-1 text-right font-mono">{c.ctr.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
