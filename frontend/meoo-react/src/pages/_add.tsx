
// ── 维度列配置（单品 / 总额）──────────────────
const PER_UNIT_COLS = [
  { key: 'cost', label: '成本', width: '60px' },
  { key: 'price', label: '售价', width: '58px' },
  { key: 'profit', label: '单品利润', width: '68px' },
  { key: 'marginRate', label: '毛利率', width: '56px' },
  { key: 'promoPerUnit', label: '单品推广', width: '68px' },
  { key: 'refundRate', label: '退款率', width: '56px' },
  { key: 'sales', label: '销量', width: '50px' },
  { key: 'orders', label: '订单', width: '50px' },
];
const TOTAL_COLS = [
  { key: 'totalCost', label: '总成本', width: '62px' },
  { key: 'gmv', label: 'GMV', width: '62px' },
  { key: 'profit', label: '总利润', width: '62px' },
  { key: 'profitRate', label: '利润率', width: '56px' },
  { key: 'roi', label: 'ROI', width: '48px' },
  { key: 'refundRate', label: '退款率', width: '56px' },
  { key: 'sales', label: '销量', width: '50px' },
  { key: 'orders', label: '订单', width: '50px' },
  { key: 'avgPrice', label: '客单价', width: '56px' },
];

// ★ 读目标值
function getTarget(productId: string, key: string): number {
  try {
    const v = localStorage.getItem('dianfx_' + key + '_' + productId);
    return v ? parseFloat(v) : 0;
  } catch { return 0; }
}

// ★ 获取单元格数据（实际值、目标值、参考值、格式）
function getCellData(colKey: string, p: any): { val: number; tgtNum: number; refNum: number; fmt: string; clr?: string; refFmt: string } {
  const uc = p.unitCost || 0;
  const ap = p.avgPrice || 0;
  const sa = p.sales || 0;
  const pc = p.promoCost || 0;
  const tgtPrice = getTarget(p.id, 'targetPrice');
  const tgtProfit = getTarget(p.id, 'targetProfit');
  const tgtProfitRate = getTarget(p.id, 'targetProfitRate');
  const tgtRoi = getTarget(p.id, 'targetRoi');
  const pp = ap > 0 && uc > 0 ? ap - uc : 0;
  const mr = ap > 0 && uc > 0 ? (ap - uc) / ap * 100 : 0;
  const tgtPP = tgtPrice > 0 && uc > 0 ? tgtPrice - uc : 0;
  const fmtMoney = (v: number) => v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' : (v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1));
  const fmtPct = (v: number) => v.toFixed(1) + '%';
  const fmtInt = (v: number) => v.toFixed(0);

  switch (colKey) {
    case 'cost':
      return { val: uc, tgtNum: 0, refNum: uc, fmt: uc > 0 ? fmtMoney(uc) : '--', refFmt: uc > 0 ? fmtMoney(uc) : '--' };
    case 'price':
      return { val: ap, tgtNum: tgtPrice, refNum: ap, fmt: ap > 0 ? fmtMoney(ap) : '--', refFmt: ap > 0 ? fmtMoney(ap) : '--' };
    case 'profit':
      return { val: pp, tgtNum: tgtPP, refNum: pp, fmt: pp !== 0 ? (pp > 0 ? '¥' : '-¥') + Math.abs(pp).toFixed(2) : '¥0.00', refFmt: pp !== 0 ? (pp > 0 ? '¥' : '-¥') + Math.abs(pp).toFixed(2) : '¥0.00', clr: pp > 0 ? '#38A169' : pp < 0 ? '#E53E3E' : '#718096' };
    case 'marginRate':
      return { val: mr, tgtNum: 0, refNum: mr, fmt: mr > 0 ? fmtPct(mr) : '--', refFmt: mr > 0 ? fmtPct(mr) : '--' };
    case 'promoPerUnit': {
      const pu = sa > 0 ? pc / sa : 0;
      return { val: pu, tgtNum: 0, refNum: pu, fmt: pu > 0 ? fmtMoney(pu) : '--', refFmt: pu > 0 ? fmtMoney(pu) : '--' };
    }
    case 'refundRate':
      return { val: p.refundRate || 0, tgtNum: 0, refNum: p.refundRate || 0, fmt: fmtPct(p.refundRate || 0), refFmt: fmtPct(p.refundRate || 0) };
    case 'sales':
      return { val: sa, tgtNum: 0, refNum: sa, fmt: fmtInt(sa), refFmt: fmtInt(sa) };
    case 'orders':
      return { val: p.orders || 0, tgtNum: 0, refNum: p.orders || 0, fmt: fmtInt(p.orders || 0), refFmt: fmtInt(p.orders || 0) };
    case 'totalCost':
      return { val: uc * sa, tgtNum: 0, refNum: uc * sa, fmt: uc > 0 ? fmtMoney(uc * sa) : '--', refFmt: uc > 0 ? fmtMoney(uc * sa) : '--' };
    case 'gmv':
      return { val: p.gmv || 0, tgtNum: tgtPrice > 0 ? tgtPrice * sa : 0, refNum: p.gmv || 0, fmt: (p.gmv || 0) >= 10000 ? '¥' + ((p.gmv || 0) / 10000).toFixed(1) + '万' : '¥' + (p.gmv || 0).toFixed(0), refFmt: (p.gmv || 0) >= 10000 ? '¥' + ((p.gmv || 0) / 10000).toFixed(1) + '万' : '¥' + (p.gmv || 0).toFixed(0) };
    case 'profit':
      return { val: p.profit || 0, tgtNum: tgtProfit, refNum: p.profit || 0, fmt: (p.profit || 0) >= 0 ? '¥' + (p.profit || 0).toFixed(0) : '-¥' + Math.abs(p.profit || 0).toFixed(0), refFmt: (p.profit || 0) >= 0 ? '¥' + (p.profit || 0).toFixed(0) : '-¥' + Math.abs(p.profit || 0).toFixed(0), clr: (p.profit || 0) >= 0 ? '#38A169' : '#E53E3E' };
    case 'profitRate':
      return { val: p.profitRate || 0, tgtNum: tgtProfitRate, refNum: p.profitRate || 0, fmt: fmtPct(p.profitRate || 0), refFmt: fmtPct(p.profitRate || 0) };
    case 'roi':
      return { val: p.roi || 0, tgtNum: tgtRoi, refNum: p.roi || 0, fmt: (p.roi || 0) > 0 ? (p.roi || 0).toFixed(1) : '-', refFmt: (p.roi || 0) > 0 ? (p.roi || 0).toFixed(1) : '-' };
    case 'avgPrice':
      return { val: ap, tgtNum: tgtPrice, refNum: ap, fmt: ap > 0 ? fmtMoney(ap) : '--', refFmt: ap > 0 ? fmtMoney(ap) : '--' };
    default:
      return { val: 0, tgtNum: 0, refNum: 0, fmt: '--', refFmt: '--' };
  }
}

