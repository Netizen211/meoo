/**
 * 数值格式化工具
 * 原则：不四舍五入，有小数点的保留2位
 */

/** 截断到指定位数（不四舍五入） */
export function trunc(v: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.trunc(v * factor) / factor;
}

/** 金额格式：¥ + 2位小数（截断） */
export function fmtMoney(v: number): string {
  return '¥' + trunc(v, 2).toFixed(2);
}

/** 百分比格式：2位小数 + %（截断） */
export function fmtPct(v: number): string {
  return trunc(v, 2).toFixed(2) + '%';
}

/** 数值格式：2位小数（截断），用于非金额非百分比的值 */
export function fmtNum(v: number): string {
  return trunc(v, 2).toFixed(2);
}

/** 整数格式：截断取整，用于计数类展示 */
export function fmtInt(v: number): string {
  return Math.trunc(v).toString();
}

/** 简洁金额（万级缩写），截断到2位小数 */
export function fmtShort(v: number): string {
  if (v >= 10000) return '¥' + trunc(v / 10000, 2).toFixed(2) + '万';
  return fmtMoney(v);
}

/** 简洁数值（万级缩写，无¥前缀），截断到2位小数 */
export function fmtShortNum(v: number): string {
  if (v >= 10000) return trunc(v / 10000, 2).toFixed(2) + '万';
  return trunc(v, 2).toFixed(2);
}

/** 百分比1位小数（截断），用于表格紧凑场景 */
export function fmtPct1(v: number): string {
  return trunc(v, 1).toFixed(1) + '%';
}

/** 金额1位小数（截断），用于表格紧凑场景 */
export function fmtMoney1(v: number): string {
  return '¥' + trunc(v, 1).toFixed(1);
}
