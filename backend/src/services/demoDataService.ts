/**
 * 演示数据服务 — 新用户注册时自动在服务器创建演示店铺和数据
 * 数据链路：MySQL ← sync API ← localStorage ← IndexedDB → useData()
 */
import { db } from '../db';

const DEMO_STORE_NAME = '演示店铺（可删除）';

// 8 个商品 × 18 个 SKU
const DEMO_PRODUCTS = [
  { pid: 'PD00001', name: '夏季冰丝凉席三件套', cat1:'家居生活', cat2:'床上用品', cat3:'凉席', cat4:'冰丝凉席', skus: [
    { sku:'SKU001', spec:'1.5m床-灰色', cost:28, price:89 },{ sku:'SKU002', spec:'1.8m床-灰色', cost:33, price:109 },{ sku:'SKU003', spec:'1.5m床-蓝色', cost:28, price:89 }
  ]},
  { pid: 'PD00002', name: '无线蓝牙耳机Pro版', cat1:'数码电器', cat2:'影音设备', cat3:'耳机', cat4:'无线耳机', skus: [
    { sku:'SKU004', spec:'黑色标准版', cost:45, price:129 },{ sku:'SKU005', spec:'白色降噪版', cost:65, price:189 }
  ]},
  { pid: 'PD00003', name: '儿童益智积木拼装玩具', cat1:'母婴玩具', cat2:'益智玩具', cat3:'积木', cat4:'大颗粒积木', skus: [
    { sku:'SKU006', spec:'大颗粒100粒', cost:18, price:59 },{ sku:'SKU007', spec:'大颗粒200粒', cost:30, price:99 }
  ]},
  { pid: 'PD00004', name: '不锈钢保温杯大容量', cat1:'家居生活', cat2:'餐饮用具', cat3:'保温杯', cat4:'不锈钢保温杯', skus: [
    { sku:'SKU008', spec:'500ml-黑色', cost:15, price:45 },{ sku:'SKU009', spec:'800ml-银色', cost:20, price:65 }
  ]},
  { pid: 'PD00005', name: '男士运动休闲鞋透气款', cat1:'运动户外', cat2:'运动鞋服', cat3:'运动鞋', cat4:'跑步鞋', skus: [
    { sku:'SKU010', spec:'39码-黑色', cost:42, price:119 },{ sku:'SKU011', spec:'40码-黑色', cost:42, price:119 },{ sku:'SKU012', spec:'41码-白色', cost:42, price:119 }
  ]},
  { pid: 'PD00006', name: '女士防晒衣轻薄透气', cat1:'服饰内衣', cat2:'女装', cat3:'外套', cat4:'防晒衣', skus: [
    { sku:'SKU013', spec:'M码-浅蓝', cost:22, price:69 },{ sku:'SKU014', spec:'L码-粉色', cost:22, price:69 }
  ]},
  { pid: 'PD00007', name: '有机红枣夹核桃500g', cat1:'食品生鲜', cat2:'坚果零食', cat3:'红枣', cat4:'夹心红枣', skus: [
    { sku:'SKU015', spec:'500g袋装', cost:12, price:39 },{ sku:'SKU016', spec:'1000g礼盒', cost:22, price:69 }
  ]},
  { pid: 'PD00008', name: '桌面手机支架可折叠', cat1:'数码电器', cat2:'手机配件', cat3:'支架', cat4:'桌面支架', skus: [
    { sku:'SKU017', spec:'基础款-黑色', cost:5, price:19.9 },{ sku:'SKU018', spec:'升级款-银色', cost:8, price:29.9 }
  ]},
];

const PROVINCES = ['浙江省','江苏省','广东省','山东省','河南省','湖北省','湖南省','四川省','福建省','安徽省','河北省','辽宁省','陕西省','江西省','重庆市','上海市','北京市','天津市','广西','云南省'];
const CITIES: Record<string,string> = {'浙江省':'杭州','江苏省':'南京','广东省':'广州','山东省':'青岛','河南省':'郑州','湖北省':'武汉','湖南省':'长沙','四川省':'成都','福建省':'厦门','安徽省':'合肥'};
const COURIERS = ['中通快递','圆通速递','韵达快递','顺丰速运','申通快递','极兔速递'];
const REFUND_REASONS = ['不喜欢/效果不好','质量问题','发错货/漏发','七天无理由退货','商品与描述不符','物流太慢','收到商品破损'];
const ORDER_STATUSES = ['已发货','已完成','已签收','已付款','待发货'];
const PAY_METHODS = ['微信支付','支付宝','花呗分期','多多支付'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min:number,max:number): number { return Math.floor(Math.random()*(max-min+1))+min; }
function rndf(min:number,max:number): string { return (Math.random()*(max-min)+min).toFixed(2); }
function fmt(d:Date): string { return d.toISOString().split('T')[0]; }
function pad(n:number): string { return String(n).padStart(2,'0'); }
function randDate(s:Date,e:Date): Date { return new Date(s.getTime()+Math.random()*(e.getTime()-s.getTime())); }

function generateOrders(storeId: string): any[] {
  const orders: any[] = [];
  const start = new Date('2026-04-01'), end = new Date('2026-05-28');
  let oid = 2705000000;
  for (let i = 0; i < 400; i++) {
    const prod = pick(DEMO_PRODUCTS), sku = pick(prod.skus);
    const date = randDate(start, end);
    const qty = pick([1,1,1,1,2,2,3,5]);
    const unitPrice = sku.price;
    const totalPrice = +(unitPrice * qty).toFixed(2);
    const discPct = Math.random() * 0.25;
    const shopDisc = +(totalPrice * discPct * 0.4).toFixed(2);
    const platDisc = +(totalPrice * discPct * 0.35).toFixed(2);
    const ddDisc = +(totalPrice * discPct * 0.25).toFixed(2);
    const coupon = Math.random()<0.3 ? +(totalPrice*0.05).toFixed(2) : 0;
    const userPaid = +(totalPrice - shopDisc - platDisc - ddDisc - coupon).toFixed(2);
    const techFee = +(userPaid * (Math.random()<0.1?0.01:0.006)).toFixed(2);
    const postage = userPaid>=30||Math.random()<0.9 ? 0 : rnd(5,15);
    const merchant = +(userPaid - techFee - postage).toFixed(2);
    const province = pick(PROVINCES);
    const city = CITIES[province] || province;
    const district = pick(['朝阳区','海淀区','浦东新区','天河区','福田区','武侯区']);
    const isRefund = Math.random() < 0.07;
    const refundAmt = isRefund ? +(merchant*(0.3+Math.random()*0.7)).toFixed(2) : 0;
    const payDate = date;
    const shipDate = new Date(payDate.getTime()+rnd(2,72)*3600000);
    const confirmDate = new Date(shipDate.getTime()+rnd(1,7)*86400000);
    const courier = pick(COURIERS);
    const isLive = Math.random()<0.08;
    const isSubsidy = Math.random()<0.12;
    const isInstall = prod.cat1==='家居生活'&&Math.random()<0.15;

    orders.push({
      '订单号': String(oid+i), '订单状态': pick(ORDER_STATUSES),
      '支付时间': fmt(payDate)+' '+pad(rnd(0,23))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
      '发货时间': fmt(shipDate)+' '+pad(rnd(0,23))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
      '确认收货时间': fmt(confirmDate),
      '订单成交时间': fmt(payDate)+' '+pad(rnd(0,23))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
      '承诺发货时间': fmt(new Date(payDate.getTime()+48*3600000)),
      '商品名称': prod.name, '商品ID': prod.pid,
      '商家编码-商品维度': prod.pid.replace('PD','SP'), '商家编码-规格维度': sku.sku,
      '商品规格': sku.spec, '规格id': sku.sku, '规格名称': sku.spec,
      '样式ID': 'ST'+sku.sku.slice(3),
      '商品一级类目': prod.cat1, '商品二级类目': prod.cat2, '商品三级类目': prod.cat3, '商品四级类目': prod.cat4,
      '商品数量(件)': qty, '商品单价(元)': unitPrice.toFixed(2),
      '商品总价(元)': totalPrice.toFixed(2), '用户实付金额(元)': userPaid.toFixed(2),
      '商家实收金额(元)': merchant.toFixed(2), '邮费(元)': postage.toFixed(2),
      '店铺优惠折扣(元)': shopDisc.toFixed(2), '平台优惠折扣(元)': platDisc.toFixed(2),
      '多多支付立减金额(元)': ddDisc.toFixed(2), '拼多多优惠券(元)': coupon.toFixed(2),
      '平台技术服务费(元)': techFee.toFixed(2),
      '上门安装费(元)': isInstall?rndf(30,80):'0.00',
      '送货入户费(元)': (prod.cat1==='家居生活'&&Math.random()<0.05)?rndf(20,50):'0.00',
      '送货入户并安装费(元)': (isInstall&&Math.random()<0.05)?rndf(50,120):'0.00',
      '退款金额(元)': refundAmt.toFixed(2),
      '退款原因': isRefund?pick(REFUND_REASONS):'',
      '退款类型': isRefund?pick(['仅退款','退货退款']):'',
      '售后状态': isRefund?pick(['退款成功','退款成功','退款成功','退货退款']):'',
      '省': province, '市': city,
      '订单来源': pick(['APP-Android','APP-iOS','小程序','网页']),
      '是否直播间成交': isLive?'是':'否', '是否直播间引导成交': Math.random()<0.03?'是':'否',
      '是否门店自提': Math.random()<0.02?'是':'否', '门店名称': Math.random()<0.02?pick(['万达广场店','万象城店']):'',
      '支付方式': pick(PAY_METHODS), '是否分期': Math.random()<0.1?'是':'否',
      '分期期数': Math.random()<0.1?pick(['3','6','12']):'',
      '手续费承担方': Math.random()<0.05?pick(['商家','买家']):'',
      '是否预售': Math.random()<0.1?'是':'否', '是否顺丰加价': Math.random()<0.03?'是':'否',
      '是否抽奖或0元试用': Math.random()<0.01?'是':'否',
      '是否社区团购': Math.random()<0.02?'是':'否', '是否无痕发货': Math.random()<0.05?'是':'否',
      '是否节能补贴': isSubsidy?'是':'否',
      '快递公司': courier, '快递单号': 'YT'+rnd(10000000000,99999999999),
      '配送状态': pick(['运输中','运输中','运输中','已签收','派送中']),
      '集运类型': Math.random()<0.05?pick(['集运','转运']):'',
    });
  }
  return orders;
}

function generateAfterSales(orders: any[]): any[] {
  const records: any[] = [];
  let asId = 9000000;
  const refundOrds = orders.filter(o => parseFloat(o['退款金额(元)']||'0') > 0);
  refundOrds.forEach(o => {
    const applyDate = new Date(o['支付时间']);
    const agreeDate = new Date(applyDate.getTime()+rnd(1,72)*3600000);
    records.push({
      '售后编号': 'AS'+(asId++), '订单编号': o['订单号'],
      '商品ID': o['商品ID'], '商品名称': o['商品名称'], '商品规格': o['商品规格'],
      'sku信息': o['商家编码-规格维度'], 'SKU信息': o['商家编码-规格维度'],
      '退款金额(元)': o['退款金额(元)'], '退款金额': o['退款金额(元)'],
      '售后状态': o['售后状态'], '退款类型': o['退款类型'], '售后类型': o['退款类型'],
      '退款原因': o['退款原因'], '售后原因': o['退款原因'],
      '申请时间': fmt(applyDate), '售后申请时间': fmt(applyDate),
      '同意退款时间': fmt(agreeDate), '同意退货时间': fmt(agreeDate),
      '同意退款人': pick(['客服小王','客服小李']), '处理人': pick(['售后组A','售后组B']),
      '退货运单号': o['退款类型']==='退货退款'?'SF'+rnd(1000000000,9999999999):'',
      '退货物流状态': o['退款类型']==='退货退款'?pick(['运输中','已签收']):'',
      '退货物流状态对应时间': o['退款类型']==='退货退款'?fmt(new Date(agreeDate.getTime()+rnd(1,5)*86400000)):'',
      '快递公司': o['快递公司'], '物流公司': o['快递公司'],
      '快递拦截状态': Math.random()<0.1?'已拦截':'未拦截',
      '收费状态': pick(['已收费','已收费','已收费','待收费']),
      '收费编号': 'CF'+rnd(100000,999999),
      '理赔状态': Math.random()<0.08?'已理赔':'未理赔',
      '运费补偿状态': Math.random()<0.05?'已补偿':'-',
      '备注': Math.random()<0.3?pick(['已联系买家','同意退款']):'',
      '处理时长(小时)': rnd(1,168),
    });
  });
  return records;
}

function generatePromotion(storeId: string): any[] {
  const data: any[] = [];
  const dates: string[] = [];
  for (let d = new Date('2026-04-01'); d <= new Date('2026-05-28'); d.setDate(d.getDate()+1)) dates.push(fmt(d));
  DEMO_PRODUCTS.forEach(prod => {
    dates.forEach(date => {
      const imp = rnd(500,8000);
      const ctr = 0.02+Math.random()*0.1;
      const click = Math.floor(imp*ctr);
      const cvr = 0.02+Math.random()*0.07;
      const orders_gen = Math.floor(click*cvr);
      const cpc = 0.2+Math.random()*1.5;
      const cost = +(click*cpc).toFixed(2);
      const gmv = +(orders_gen*(30+Math.random()*120)).toFixed(2);
      data.push({
        '日期': date, '商品ID': prod.pid, '商品名称': prod.name,
        '推广名称': prod.name+'-多多搜索',
        '总花费(元)': cost.toFixed(2), '成交花费(元)': cost.toFixed(2), '花费(元)': cost.toFixed(2),
        '成交笔数': orders_gen, '成交订单数': orders_gen,
        '交易额(元)': gmv.toFixed(2), '成交金额(元)': gmv.toFixed(2),
        '曝光量': imp, '点击量': click,
        '点击率': (ctr*100).toFixed(2)+'%', '转化率': (cvr*100).toFixed(2)+'%',
        '平均点击花费(元)': cpc.toFixed(2), '千次曝光花费': (cost/imp*1000).toFixed(2),
        '投入产出比': cost>0?(gmv/cost).toFixed(2):'0',
        '询单量': Math.floor(click*(0.01+Math.random()*0.05)),
        '询单花费(元)': (cost*0.1).toFixed(2),
        '收藏量': Math.floor(click*(0.01+Math.random()*0.03)),
        '收藏花费(元)': (cost*0.05).toFixed(2),
        '关注量': Math.floor(click*(0.005+Math.random()*0.02)),
        '关注花费(元)': (cost*0.03).toFixed(2),
        '店铺关注量': Math.floor(click*(0.002+Math.random()*0.01)),
        '商品收藏量': Math.floor(click*(0.005+Math.random()*0.02)),
      });
    });
  });
  return data;
}

function generateInsurance(orders: any[]): any[] {
  const data: any[] = [];
  const seen = new Set<string>();
  orders.filter(() => Math.random()<0.65).forEach(o => {
    if (seen.has(o['订单号'])) return;
    seen.add(o['订单号']);
    data.push({
      '订单编号': o['订单号'], '订单号': o['订单号'],
      '服务费用（元）': rndf(0.5,3), '服务费用(元)': rndf(0.5,3), '服务费用': rndf(0.5,3),
      '保费（元）': rndf(1,5), '保费(元)': rndf(1,5), '保费': rndf(1,5),
      '收费状态': Math.random()<0.9?'已收费':'待收费',
      '理赔状态': Math.random()<0.08?'已理赔':'未理赔',
      '运费补偿状态': Math.random()<0.05?'已补偿':'-',
      '补偿状态': Math.random()<0.05?'已补偿':'-',
      '收费编号': 'SF'+rnd(100000,999999),
      '运费补偿生效时间': Math.random()<0.05?o['支付时间']:'',
    });
  });
  return data;
}

function generateFinancial(order: any): any[] {
  const records: any[] = [];
  const date = new Date(order['支付时间']);
  const finTime = new Date(date.getTime()+rnd(8,20)*3600000);
  const nextDay = new Date(date.getTime()+86400000);
  // 收入
  records.push({
    '商户订单号': order['订单号'], '业务描述': '订单结算收入',
    '收入金额（+元）': order['商家实收金额(元)'], '收入金额(元)': order['商家实收金额(元)'], '收入金额': order['商家实收金额(元)'],
    '支出金额（-元）': '0.00', '支出金额(元)': '0.00', '支出金额': '0.00',
    '发生时间': fmt(finTime)+' '+pad(rnd(0,23))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
    '账务类型': '订单结算', '发生金额': order['商家实收金额(元)'], '金额(元)': order['商家实收金额(元)'], '金额': order['商家实收金额(元)'],
  });
  // 平台技术服务费
  records.push({
    '商户订单号': order['订单号'], '业务描述': '平台技术服务费',
    '收入金额（+元）': '0.00', '收入金额(元)': '0.00', '收入金额': '0.00',
    '支出金额（-元）': order['平台技术服务费(元)'], '支出金额(元)': order['平台技术服务费(元)'], '支出金额': order['平台技术服务费(元)'],
    '发生时间': fmt(nextDay)+' '+pad(rnd(0,23))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
    '账务类型': '费用扣除', '发生金额': '-'+order['平台技术服务费(元)'], '金额(元)': order['平台技术服务费(元)'], '金额': order['平台技术服务费(元)'],
  });
  return records;
}

/**
 * 为新用户创建演示店铺和数据
 * 返回 storeId，失败返回 null
 */
export async function createDemoDataForUser(userId: string): Promise<string | null> {
  try {
    const storeId = `demo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    // 创建店铺
    await db('stores').insert({
      id: storeId,
      user_id: userId,
      name: DEMO_STORE_NAME,
    });

    // 生成各类数据
    const orders = generateOrders(storeId);
    const promotion = generatePromotion(storeId);
    const afterSales = generateAfterSales(orders);
    const insurance = generateInsurance(orders);
    const financial: any[] = [];
    orders.slice(0, 200).forEach(o => { financial.push(...generateFinancial(o)); });

    // 按日添加罚款/百亿补贴记录
    for (let d = new Date('2026-04-01'); d <= new Date('2026-05-28'); d.setDate(d.getDate()+1)) {
      if (Math.random() < 0.25) {
        financial.push({
          '商户订单号': pick(orders)['订单号'], '业务描述': '004延迟发货罚款',
          '收入金额（+元）': '0.00', '收入金额(元)': '0.00', '收入金额': '0.00',
          '支出金额（-元）': rndf(3,50), '支出金额(元)': rndf(3,50), '支出金额': rndf(3,50),
          '发生时间': fmt(d)+' '+pad(rnd(8,20))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
          '账务类型': '罚款扣款', '发生金额': '-'+rndf(3,50), '金额(元)': rndf(3,50), '金额': rndf(3,50),
        });
      }
      if (Math.random() < 0.15) {
        financial.push({
          '商户订单号': pick(orders)['订单号'], '业务描述': Math.random()<0.5?'0030002百亿补贴技术服务费':'0030003百亿补贴扣点',
          '收入金额（+元）': '0.00', '收入金额(元)': '0.00', '收入金额': '0.00',
          '支出金额（-元）': rndf(5,30), '支出金额(元)': rndf(5,30), '支出金额': rndf(5,30),
          '发生时间': fmt(d)+' '+pad(rnd(8,20))+':'+pad(rnd(0,59))+':'+pad(rnd(0,59)),
          '账务类型': '技术服务费', '发生金额': '-'+rndf(5,30), '金额(元)': rndf(5,30), '金额': rndf(5,30),
        });
      }
    }

    // 保存到 MySQL store_data 表
    const saveCategory = async (cat: string, data: any[]) => {
      await db('store_data').insert({
        store_id: storeId, category: cat,
        payload_json: JSON.stringify(data),
        row_count: data.length,
      }).onConflict(['store_id', 'category'] as any).merge({
        payload_json: JSON.stringify(data),
        row_count: data.length,
        updated_at: db.fn.now(),
      }).catch(() => {});
    };

    // 按日汇总推广数据（PromotionPage 使用）
    const summaryMap: Record<string, any> = {};
    promotion.forEach((p: any) => {
      const date = p['日期'];
      if (!summaryMap[date]) summaryMap[date] = { '日期': date, '总花费(元)': 0, '交易额(元)': 0, '成交笔数': 0, '曝光量': 0, '点击量': 0 };
      summaryMap[date]['总花费(元)'] = +((summaryMap[date]['总花费(元)'] || 0) + parseFloat(p['总花费(元)'])).toFixed(2);
      summaryMap[date]['交易额(元)'] = +((summaryMap[date]['交易额(元)'] || 0) + parseFloat(p['交易额(元)'])).toFixed(2);
      summaryMap[date]['成交笔数'] += parseInt(p['成交笔数']) || 0;
      summaryMap[date]['曝光量'] += parseInt(p['曝光量']) || 0;
      summaryMap[date]['点击量'] += parseInt(p['点击量']) || 0;
    });
    const promotionSummary = Object.values(summaryMap);

    await saveCategory('orders', orders);
    await saveCategory('promotionSummary', promotionSummary);
    await saveCategory('promotionProducts', promotion);
    await saveCategory('afterSaleRecords', afterSales);
    await saveCategory('shippingInsurance', insurance);
    await saveCategory('financialRecords', financial);

    // SKU 成本配置
    const costConfig: Record<string, number> = {};
    DEMO_PRODUCTS.forEach(p => p.skus.forEach(s => {
      costConfig[`${p.pid}_${s.sku}`] = s.cost;
    }));
    // 费用配置（每个费用独立 config_key，与客户端 App.tsx loadPerStoreNumber 一致）
    const feeConfigs: Record<string, string> = {
      [`dianfx_packaging_fee_${storeId}`]: JSON.stringify(1.5),       // 包装费(元/单)
      [`dianfx_shipping_fee_${storeId}`]: JSON.stringify(3.0),        // 快递费(元/单)
      [`dianfx_platform_commission_${storeId}`]: JSON.stringify(0.6),  // 平台佣金(%)
      [`dianfx_insurance_fee_${storeId}`]: JSON.stringify(1.0),       // 运费险(元/单)
      [`dianfx_labor_fee_${storeId}`]: JSON.stringify(2.0),           // 人工费(元/单)
      [`dianfx_default_cost_ratio_${storeId}`]: JSON.stringify(30),   // 默认成本比例(%)
      [`dianfx_promotion_fee_${storeId}`]: JSON.stringify(0),         // 推广费(元/单)
    };
    for (const [key, json] of Object.entries(feeConfigs)) {
      await db('store_configs').insert({
        store_id: storeId,
        config_key: key,
        payload_json: json,
      }).onConflict(['store_id', 'config_key'] as any).merge({
        payload_json: json,
        updated_at: db.fn.now(),
      }).catch(() => {});
    }

    // SKU 成本导入（与 CostManagementPage 格式一致）
    await db('store_configs').insert({
      store_id: storeId,
      config_key: `dianfx_product_costs_${storeId}`,
      payload_json: JSON.stringify(costConfig),
    }).onConflict(['store_id', 'config_key'] as any).merge({
      payload_json: JSON.stringify(costConfig),
      updated_at: db.fn.now(),
    }).catch(() => {});

    // 可用字段
    const allFields = Object.keys(orders[0] || {});
    await db('store_available_fields').insert({
      store_id: storeId, field_source: 'csv',
      fields_json: JSON.stringify(allFields),
    }).onConflict(['store_id', 'field_source'] as any).merge({
      fields_json: JSON.stringify(allFields),
    }).catch(() => {});

    return storeId;
  } catch (err) {
    console.error('[demoData] Failed to create demo data:', err);
    return null;
  }
}

/**
 * 删除用户的演示数据
 */
export async function deleteDemoDataForUser(userId: string): Promise<void> {
  try {
    const demoStores = await db('stores').where({ user_id: userId }).where('name', 'like', '%演示%');
    for (const store of demoStores) {
      await db('store_data').where('store_id', store.id).del();
      await db('store_configs').where('store_id', store.id).del();
      await db('store_available_fields').where('store_id', store.id).del();
      await db('stores').where('id', store.id).del();
    }
  } catch (err) {
    console.error('[demoData] Failed to delete demo data:', err);
  }
}
