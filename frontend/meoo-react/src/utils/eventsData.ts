/**
 * 中国电商活动日历数据
 * 包含固定公历活动 + 农历节日（预计算 2025-2028）
 * 支持活动自动匹配、对比分析、标签分类
 */

// ---- 类型定义 ----

export interface ShoppingEvent {
  id: string;
  name: string;
  category: 'fixed' | 'lunar';
  dateStart: string;        // YYYY-MM-DD
  dateEnd: string;
  warmupStart?: string;     // 预热期开始
  tags: string[];
  description: string;
  year: number;             // 活动所属年份
}

export interface EventTag {
  label: string;
  color: string;
  bg: string;
}

// ---- 标签体系 ----

export const EVENT_TAGS: Record<string, EventTag> = {
  '旺季':   { label: '旺季', color: '#cf1322', bg: '#fff2f0' },
  '淡季':   { label: '淡季', color: '#8c8c8c', bg: '#fafafa' },
  '平季':   { label: '平季', color: '#595959', bg: '#f5f5f5' },
  '次旺季': { label: '次旺季', color: '#d46b08', bg: '#fff7e6' },
  '换季期': { label: '换季期', color: '#08979c', bg: '#e6fffb' },
  '平台S级': { label: '平台S级', color: '#a8071a', bg: '#fff1f0' },
  '平台A级': { label: '平台A级', color: '#ad4e00', bg: '#fff7e6' },
  '大促':   { label: '大促', color: '#c41d7f', bg: '#fff0f6' },
  '促销活动': { label: '促销活动', color: '#d4380d', bg: '#fff2e8' },
  '传统节日': { label: '传统节日', color: '#531dab', bg: '#f9f0ff' },
  '节日营销': { label: '节日营销', color: '#eb2f96', bg: '#fff0f6' },
  '换季清仓': { label: '换季清仓', color: '#006d75', bg: '#e6fffb' },
  '年末':   { label: '年末', color: '#1d39c4', bg: '#f0f5ff' },
  '年初':   { label: '年初', color: '#237804', bg: '#f6ffed' },
  '核心':   { label: '核心', color: '#fff', bg: '#ff4d4f' },
  '预热期': { label: '预热期', color: '#fa8c16', bg: '#fff7e6' },
};

// ---- 农历节日预计算数据 (2025-2028) ----

// 春节 = 正月初一（Lunar New Year's Day）
// 年货节预热 = 春节前约14天
const SPRING_FESTIVAL: Record<number, { date: string; warmup: string }> = {
  2025: { date: '2025-01-29', warmup: '2025-01-15' },
  2026: { date: '2026-02-17', warmup: '2026-02-03' },
  2027: { date: '2027-02-06', warmup: '2027-01-23' },
  2028: { date: '2028-01-26', warmup: '2028-01-12' },
};

// 七夕 = 七月初七
const QIXI: Record<number, { date: string; warmup: string }> = {
  2025: { date: '2025-08-29', warmup: '2025-08-26' },
  2026: { date: '2026-08-19', warmup: '2026-08-16' },
  2027: { date: '2027-08-08', warmup: '2027-08-05' },
  2028: { date: '2028-08-26', warmup: '2028-08-23' },
};

// 中秋 = 八月十五
const MID_AUTUMN: Record<number, { date: string; warmup: string }> = {
  2025: { date: '2025-10-06', warmup: '2025-09-29' },
  2026: { date: '2026-09-25', warmup: '2026-09-18' },
  2027: { date: '2027-09-15', warmup: '2027-09-08' },
  2028: { date: '2028-10-03', warmup: '2028-09-26' },
};

// ---- 固定公历活动定义（不含年份，运行时展开） ----

interface FixedEventDef {
  name: string;
  monthStart: number;
  dayStart: number;
  monthEnd: number;
  dayEnd: number;
  warmupDays?: number;
  tags: string[];
  description: string;
}

const FIXED_EVENT_DEFS: FixedEventDef[] = [
  {
    name: '元旦开门红',
    monthStart: 1, dayStart: 1, monthEnd: 1, dayEnd: 3,
    tags: ['节日营销', '年初', '次旺季'],
    description: '新年伊始，平台推出开年优惠活动'
  },
  {
    name: '情人节',
    monthStart: 2, dayStart: 12, monthEnd: 2, dayEnd: 14,
    tags: ['节日营销', '平季'],
    description: '情人节礼品、美妆、饰品等品类促销'
  },
  {
    name: '三八女神节',
    monthStart: 3, dayStart: 5, monthEnd: 3, dayEnd: 8,
    tags: ['节日营销', '次旺季'],
    description: '女性消费主力节日，美妆/服饰/家居为主'
  },
  {
    name: '春夏新风尚',
    monthStart: 3, dayStart: 20, monthEnd: 3, dayEnd: 27,
    tags: ['换季清仓', '平季'],
    description: '春夏新品上市，换季清仓促销'
  },
  {
    name: '618年中大促',
    monthStart: 6, dayStart: 1, monthEnd: 6, dayEnd: 18,
    warmupDays: 6,
    tags: ['大促', '平台S级', '旺季'],
    description: '全品类年中最大促销活动之一，预售+爆发+返场三阶段'
  },
  {
    name: '818购物节',
    monthStart: 8, dayStart: 15, monthEnd: 8, dayEnd: 18,
    tags: ['促销活动', '平季'],
    description: '818手机数码节，以3C数码为主的全品类促销'
  },
  {
    name: '99大促',
    monthStart: 9, dayStart: 1, monthEnd: 9, dayEnd: 9,
    tags: ['促销活动', '次旺季'],
    description: '金秋开学季+换季焕新，全品类促销'
  },
  {
    name: '国庆黄金周',
    monthStart: 9, dayStart: 29, monthEnd: 10, dayEnd: 7,
    tags: ['节日营销', '旺季'],
    description: '国庆长假+金秋出游季，线下联动线上大促'
  },
  {
    name: '双十一全球狂欢节',
    monthStart: 10, dayStart: 20, monthEnd: 11, dayEnd: 11,
    warmupDays: 3,
    tags: ['大促', '平台S级', '旺季', '核心'],
    description: '全球最大购物节，预售+爆发双阶段，全品类全年最低价'
  },
  {
    name: '双十二年终盛典',
    monthStart: 12, dayStart: 1, monthEnd: 12, dayEnd: 12,
    tags: ['大促', '平台A级', '旺季'],
    description: '年终收官大促，双十一返场+清仓特卖'
  },
  {
    name: '圣诞元旦双节',
    monthStart: 12, dayStart: 20, monthEnd: 12, dayEnd: 31,
    tags: ['节日营销', '旺季', '年末'],
    description: '圣诞+元旦双节联动，礼品/家居/年货预热'
  },
];

// ---- 展开函数 ----

/** 将固定活动按年份展开为具体的 ShoppingEvent */
function expandFixedEvents(year: number): ShoppingEvent[] {
  return FIXED_EVENT_DEFS.map((def, idx) => {
    const startY = def.monthEnd < def.monthStart ? year + 1 : year;
    const dateStart = `${year}-${String(def.monthStart).padStart(2, '0')}-${String(def.dayStart).padStart(2, '0')}`;
    const dateEnd = `${startY}-${String(def.monthEnd).padStart(2, '0')}-${String(def.dayEnd).padStart(2, '0')}`;
    let warmupStart: string | undefined;
    if (def.warmupDays) {
      const d = new Date(dateStart);
      d.setDate(d.getDate() - def.warmupDays);
      warmupStart = d.toISOString().slice(0, 10);
    }
    return {
      id: `fixed-${year}-${idx}`,
      name: def.name,
      category: 'fixed' as const,
      dateStart,
      dateEnd,
      warmupStart,
      tags: def.tags,
      description: def.description,
      year,
    };
  });
}

/** 展开农历活动为具体的 ShoppingEvent */
function expandLunarEvents(): ShoppingEvent[] {
  const events: ShoppingEvent[] = [];
  const years = [2025, 2026, 2027, 2028];

  years.forEach(year => {
    const sf = SPRING_FESTIVAL[year];
    if (sf) {
      // 年货节（春节前14天到除夕）
      const springEve = new Date(sf.date);
      springEve.setDate(springEve.getDate() - 1);
      events.push({
        id: `lunar-spring-${year}`,
        name: `${year}年货节`,
        category: 'lunar',
        dateStart: sf.warmup,
        dateEnd: springEve.toISOString().slice(0, 10),
        warmupStart: undefined,
        tags: ['大促', '传统节日', '旺季', '核心'],
        description: '春节前年货采购高峰，食品/服饰/家居/礼品等品类爆发',
        year,
      });

      // 春节假期（正月初一到初七）
      const springEnd = new Date(sf.date);
      springEnd.setDate(springEnd.getDate() + 6);
      events.push({
        id: `lunar-springfest-${year}`,
        name: `${year}春节`,
        category: 'lunar',
        dateStart: sf.date,
        dateEnd: springEnd.toISOString().slice(0, 10),
        tags: ['传统节日', '旺季', '核心'],
        description: '春节假期，快递停运前最后一波发货高峰',
        year,
      });
    }

    const qx = QIXI[year];
    if (qx) {
      events.push({
        id: `lunar-qixi-${year}`,
        name: `${year}七夕`,
        category: 'lunar',
        dateStart: qx.warmup,
        dateEnd: qx.date,
        tags: ['传统节日', '平季'],
        description: '中国情人节，礼品/鲜花/珠宝/美妆品类促销',
        year,
      });
    }

    const ma = MID_AUTUMN[year];
    if (ma) {
      events.push({
        id: `lunar-midautumn-${year}`,
        name: `${year}中秋`,
        category: 'lunar',
        dateStart: ma.warmup,
        dateEnd: ma.date,
        tags: ['传统节日', '次旺季'],
        description: '中秋礼品季，食品/礼盒/大闸蟹等品类热销',
        year,
      });
    }
  });

  return events;
}

// ---- 导出函数 ----

/** 获取某年的所有活动 */
export function getAllEventsForYear(year: number): ShoppingEvent[] {
  const fixed = expandFixedEvents(year);
  const lunar = expandLunarEvents().filter(e => e.year === year);
  return [...fixed, ...lunar].sort((a, b) => a.dateStart.localeCompare(b.dateStart));
}

/** 找出与日期范围有重叠的活动 */
export function getEventsInRange(fromDate: string, toDate: string): ShoppingEvent[] {
  if (!fromDate || !toDate) return [];

  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return [];

  // 覆盖的年份范围
  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();

  const allEvents: ShoppingEvent[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    allEvents.push(...getAllEventsForYear(y));
  }

  return allEvents.filter(e => {
    const eStart = new Date(e.dateStart);
    const eEnd = new Date(e.dateEnd);
    // 日期重叠判定
    return eStart <= to && eEnd >= from;
  });
}

/** 获取数据覆盖的完整日期范围 */
export function getDataDateRange(orders: any[]): { from: string; to: string } | null {
  if (!orders.length) return null;
  let minDate = '';
  let maxDate = '';
  orders.forEach(o => {
    const raw = String((o as any)['支付时间'] || '').split(' ')[0];
    if (!raw || raw.length < 10) return;
    if (!minDate || raw < minDate) minDate = raw;
    if (!maxDate || raw > maxDate) maxDate = raw;
  });
  if (!minDate || !maxDate) return null;
  return { from: minDate, to: maxDate };
}

/** 按ID查找活动 */
export function getEventById(id: string): ShoppingEvent | undefined {
  // 尝试从所有年份查找
  for (let y = 2025; y <= 2028; y++) {
    const events = getAllEventsForYear(y);
    const found = events.find(e => e.id === id);
    if (found) return found;
  }
  return undefined;
}

/** 获取活动标签的样式 */
export function getTagStyle(tag: string): EventTag {
  return EVENT_TAGS[tag] || { label: tag, color: '#666', bg: '#f0f0f0' };
}

/** 筛选活动期间的趋势数据行 */
export function filterDataByEvent(data: Record<string, any>[], event: ShoppingEvent): Record<string, any>[] {
  const eStart = event.dateStart;
  const eEnd = event.dateEnd;
  return data.filter(d => {
    const fullDate = d._fullDate || d.date;
    if (!fullDate) return false;
    // 处理 granularity label（如 "05-25"）→ 需要 _fullDate
    const dateStr = d._fullDate || '';
    return dateStr >= eStart && dateStr <= eEnd;
  });
}

/** 计算活动期间的核心KPI汇总 */
export function computeEventKpi(orders: any[], event: ShoppingEvent): Record<string, number> | null {
  if (!orders.length) return null;
  const eStart = event.dateStart;
  const eEnd = event.dateEnd;

  let gmv = 0, cnt = 0, paid = 0;
  const filtered = orders.filter(o => {
    const d = String((o as any)['支付时间'] || '').split(' ')[0];
    return d >= eStart && d <= eEnd;
  });

  if (!filtered.length) return null;

  filtered.forEach(o => {
    const price = parseFloat((o as any)['商品总价(元)'] || (o as any)['商品总价'] || '0');
    const pay = parseFloat((o as any)['用户实付金额(元)'] || (o as any)['用户实付金额'] || (o as any)['用户实付'] || '0');
    gmv += isNaN(price) ? 0 : price;
    paid += isNaN(pay) ? 0 : pay;
    cnt += 1;
  });

  return {
    gmv, orderCount: cnt, avgPrice: cnt > 0 ? paid / cnt : 0,
    paid, totalOrders: filtered.length
  };
}
