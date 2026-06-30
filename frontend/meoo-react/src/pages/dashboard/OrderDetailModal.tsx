import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/* ─── Types ─── */
interface CostSection {
  title: string;
  rows: [string, React.ReactNode][];
}
interface Props {
  orderDetail: any;
  setOrderDetail: (d: any) => void;
  sections: CostSection[];
  profitData: {
    netProfit: number; profitRate: number; merchantReceived: number;
    totalCosts: number; confidenceLabel: string; confidenceColor: string;
  };
  customCosts: { name: string; amount: number }[];
  updateCustomCost: (idx: number, field: 'name' | 'amount', value: string | number) => void;
  addCustomCost: () => void;
}

/* ─── helpers ─── */
const fmt = (n: number) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** extract a field from object by trying multiple label variants */
const gf = (o: any, labels: string[]) => {
  for (const l of labels) {
    const v = o[l];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
};

/* ─── Timeline node ─── */
interface TimeNode { label: string; time: string; }

function extractTimeline(o: any): TimeNode[] {
  const raw: [string, string[]][] = [
    ['下单', ['下单时间', '下单日期']],
    ['付款', ['支付时间', '付款时间']],
    ['发货', ['发货时间', '发货日期']],
    ['签收', ['确认收货时间', '收货时间', '签收时间']],
    ['成交', ['订单成交时间', '成交时间']],
    ['退款', ['退款时间', '退款日期']],
    ['售后申请', ['售后申请时间', '售后时间']],
    ['售后完成', ['售后完成时间']],
  ];
  const nodes: TimeNode[] = [];
  for (const [label, keys] of raw) {
    const val = gf(o, keys);
    if (val) nodes.push({ label, time: val.replace('T', ' ').replace(/\.[0-9]+Z$/, '') });
  }
  return nodes.sort((a, b) => a.time.localeCompare(b.time));
}

/* ════════════════════════════════════════════
   OrderDetailModal — single-document layout
   ════════════════════════════════════════════ */
export default function OrderDetailModal({
  orderDetail, setOrderDetail, sections, profitData,
  customCosts, updateCustomCost, addCustomCost,
}: Props) {
  if (!orderDetail) return null;

  const o = orderDetail;
  const { netProfit, profitRate, merchantReceived, totalCosts } = profitData;
  const orderStatus = o.status || o['订单状态'] || '';
  const orderNo = o.orderNo || o['订单号'] || '-';
  const qty = o.qty || o['商品数量(件)'] || o['商品数量'] || o['数量'] || '-';
  const payTime = o.time || (o['支付时间'] || '');
  const isProfit = netProfit >= 0;

  /* ── timeline ── */
  const timeline = extractTimeline(o);

  return (
    <AnimatePresence>
      {orderDetail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3"
          onClick={() => setOrderDetail(null)}
        >
          <div className="absolute inset-0 bg-black/25" />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[480px] max-h-[92vh] flex flex-col bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header row ── */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-semibold text-gray-800 whitespace-nowrap">订单明细</span>
                <span className="text-[11px] text-gray-400 font-mono truncate">{orderNo}</span>
                {payTime && (
                  <>
                    <span className="text-gray-200 select-none">|</span>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">{String(payTime).split(' ')[0]}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={orderStatus} />
                <button onClick={() => setOrderDetail(null)}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── Top summary line ── */}
            <div className="shrink-0 px-4 py-2 flex items-center justify-between text-xs border-b border-gray-50">
              <span className="text-gray-400">净利润</span>
              <span className={'font-semibold tabular-nums ' + (isProfit ? 'text-gray-800' : 'text-red-500')}>
                {isProfit ? '+' : '-'}{fmt(Math.abs(netProfit))}
              </span>
              <span className={'tabular-nums ' + (isProfit ? 'text-gray-500' : 'text-red-400')}>
                {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
              </span>
              <span className="w-px h-3 bg-gray-200" />
              <span className="text-gray-400">{fmt(merchantReceived)}</span>
              <span className="text-gray-300">→</span>
              <span className="text-gray-400">{fmt(totalCosts)}</span>
            </div>

            {/* ── Four stat numbers ── */}
            <div className="shrink-0 grid grid-cols-4 border-b border-gray-100">
              {[
                ['实收', fmt(merchantReceived), ''],
                ['费用', fmt(totalCosts), ''],
                ['利润率', profitRate.toFixed(2) + '%', ''],
                ['数量', qty + '件', ''],
              ].map(([label, value], i) => (
                <div key={i} className={'px-2 py-2 text-center ' + (i < 3 ? 'border-r border-gray-50' : '')}>
                  <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
                  <div className="text-xs font-semibold text-gray-800 mt-0.5 tabular-nums">{value}</div>
                </div>
              ))}
            </div>

              {/* ── Timeline strip ── */}
            {timeline.length > 0 && (
              <div className="shrink-0 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
                <div className="flex items-center gap-0 overflow-x-auto">
                  {timeline.map((n, i) => {
                    const dotColor = n.label === '付款' || n.label === '签收' || n.label === '成交' ? 'bg-emerald-400'
                      : n.label === '发货' ? 'bg-blue-400'
                      : n.label === '退款' || n.label === '售后申请' || n.label === '售后完成' ? 'bg-orange-400'
                      : 'bg-gray-300';
                    return (
                      <React.Fragment key={i}>
                        {i > 0 && <div className="flex-1 min-w-[12px] h-px bg-gray-200 mx-1" />}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={'inline-block w-1.5 h-1.5 rounded-full ring-1 ring-white ' + dotColor} />
                          <div className="flex flex-col leading-tight">
                            <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">{n.label}</span>
                            <span className="text-[9px] text-gray-400 font-mono whitespace-nowrap tracking-tight">{n.time.length > 10 ? n.time.slice(5, 10) : n.time}</span>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Scrollable body: one continuous document ── */}
            <div className="overflow-y-auto flex-1 px-0 py-0">
              {sections.map((sec, si) => (
                <div key={si}>
                  {/* section header */}
                  <div className={'flex items-center px-4 ' + (si === 0 ? 'pt-3 pb-1' : 'pt-2.5 pb-1')}>
                    <span className="text-[10px] font-semibold text-gray-400 tracking-wide">{sec.title}</span>
                    <div className="flex-1 ml-3 h-px bg-gray-50" />
                  </div>
                  {/* rows */}
                  <div className="px-4 pb-1">
                    {sec.rows.map(([label, value], ri) => (
                      <div key={ri} className="flex items-start justify-between py-1 text-xs border-b border-gray-50 last:border-b-0">
                        <span className="text-gray-500 min-w-[90px]">{label}</span>
                        <span className="text-gray-800 text-right ml-2 leading-snug">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* ── Custom costs section ── */}
              <div>
                <div className="flex items-center px-4 pt-2.5 pb-1">
                  <span className="text-[10px] font-semibold text-gray-400 tracking-wide">自定义费用</span>
                  <div className="flex-1 ml-3 h-px bg-gray-50" />
                </div>
                <div className="px-4 pb-1">
                  {customCosts.length === 0 ? (
                    <div className="py-2 text-center text-[11px] text-gray-300">暂无自定义费用</div>
                  ) : customCosts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-gray-50 last:border-b-0">
                      <input
                        type="text" placeholder="费用名称" value={c.name}
                        onChange={e => updateCustomCost(i, 'name', e.target.value)}
                        className="flex-1 min-w-0 text-xs text-gray-700 bg-transparent outline-none placeholder:text-gray-300"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-gray-400">¥</span>
                        <input
                          type="number" placeholder="0.00" step="0.01"
                          value={c.amount || ''}
                          onChange={e => updateCustomCost(i, 'amount', e.target.value)}
                          className="w-20 text-xs text-gray-700 text-right bg-transparent outline-none placeholder:text-gray-300 tabular-nums"
                        />
                      </div>
                      <span className="w-16 text-right text-[11px] text-gray-400 tabular-nums">-{fmt(c.amount || 0)}</span>
                    </div>
                  ))}
                  <button
                    onClick={addCustomCost}
                    className="w-full py-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    + 添加费用项
                  </button>
                </div>
              </div>

              <div className="h-3" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Small status badge ─── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    '待发货': 'text-amber-600', '已发货': 'text-blue-600',
    '已签收': 'text-green-600', '已完成': 'text-green-600',
    '已取消': 'text-gray-400', '退款中': 'text-red-500',
    '已退款': 'text-red-500', '待付款': 'text-gray-400',
  };
  const dots: Record<string, string> = {
    '待发货': 'bg-amber-400', '已发货': 'bg-blue-500',
    '已签收': 'bg-green-500', '已完成': 'bg-green-500',
    '已取消': 'bg-gray-300', '退款中': 'bg-red-400',
    '已退款': 'bg-red-400', '待付款': 'bg-gray-300',
  };
  return (
    <span className={'inline-flex items-center gap-1 text-[11px] font-medium ' + (colors[status] || 'text-gray-400')}>
      <span className={'inline-block w-1.5 h-1.5 rounded-full ' + (dots[status] || 'bg-gray-300')} />
      {status}
    </span>
  );
}
