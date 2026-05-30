/**
 * 全功能演示数据生成器 - 覆盖所有分析模块的每一个字段
 * 生成5个文件: 订单CSV, 商品推广XLSX, 售后XLSX, 运费险XLSX, 货款明细CSV
 */
const XLSX = require('xlsx');
const { writeFileSync, mkdirSync } = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'public', 'assets');
mkdirSync(outDir, { recursive: true });

// ===== 基础数据 =====
const provinces = ['浙江省','江苏省','广东省','山东省','河南省','湖北省','湖南省','四川省','福建省','安徽省','河北省','辽宁省','陕西省','江西省','重庆市','上海市','北京市','天津市','广西','云南省'];
const cities = { '浙江省':'杭州','江苏省':'南京','广东省':'广州','山东省':'青岛','河南省':'郑州','湖北省':'武汉','湖南省':'长沙','四川省':'成都','福建省':'厦门','安徽省':'合肥','河北省':'石家庄','辽宁省':'沈阳','陕西省':'西安','江西省':'南昌','重庆市':'重庆','上海市':'上海','北京市':'北京','天津市':'天津','广西':'南宁','云南省':'昆明' };
const districts = ['朝阳区','海淀区','西城区','东城区','浦东新区','天河区','福田区','南山区','武侯区','锦江区'];
const streets = ['中山路','人民路','解放路','建设路','长安街','南京路'];

const products = [
  { pid: 'PD00001', name: '夏季冰丝凉席三件套', cat1:'家居生活', cat2:'床上用品', cat3:'凉席', cat4:'冰丝凉席', skus: [
    { skuId:'SKU001', spec:'1.5m床-灰色', cost:28, price:89 }, { skuId:'SKU002', spec:'1.8m床-灰色', cost:33, price:109 }, { skuId:'SKU003', spec:'1.5m床-蓝色', cost:28, price:89 }
  ]},
  { pid: 'PD00002', name: '无线蓝牙耳机Pro版', cat1:'数码电器', cat2:'影音设备', cat3:'耳机', cat4:'无线耳机', skus: [
    { skuId:'SKU004', spec:'黑色标准版', cost:45, price:129 }, { skuId:'SKU005', spec:'白色降噪版', cost:65, price:189 }
  ]},
  { pid: 'PD00003', name: '儿童益智积木拼装玩具', cat1:'母婴玩具', cat2:'益智玩具', cat3:'积木', cat4:'大颗粒积木', skus: [
    { skuId:'SKU006', spec:'大颗粒100粒', cost:18, price:59 }, { skuId:'SKU007', spec:'大颗粒200粒', cost:30, price:99 }
  ]},
  { pid: 'PD00004', name: '不锈钢保温杯大容量', cat1:'家居生活', cat2:'餐饮用具', cat3:'保温杯', cat4:'不锈钢保温杯', skus: [
    { skuId:'SKU008', spec:'500ml-黑色', cost:15, price:45 }, { skuId:'SKU009', spec:'800ml-银色', cost:20, price:65 }
  ]},
  { pid: 'PD00005', name: '男士运动休闲鞋透气款', cat1:'运动户外', cat2:'运动鞋服', cat3:'运动鞋', cat4:'跑步鞋', skus: [
    { skuId:'SKU010', spec:'39码-黑色', cost:42, price:119 }, { skuId:'SKU011', spec:'40码-黑色', cost:42, price:119 }, { skuId:'SKU012', spec:'41码-白色', cost:42, price:119 }
  ]},
  { pid: 'PD00006', name: '女士防晒衣轻薄透气', cat1:'服饰内衣', cat2:'女装', cat3:'外套', cat4:'防晒衣', skus: [
    { skuId:'SKU013', spec:'M码-浅蓝', cost:22, price:69 }, { skuId:'SKU014', spec:'L码-粉色', cost:22, price:69 }
  ]},
  { pid: 'PD00007', name: '有机红枣夹核桃500g', cat1:'食品生鲜', cat2:'坚果零食', cat3:'红枣', cat4:'夹心红枣', skus: [
    { skuId:'SKU015', spec:'500g袋装', cost:12, price:39 }, { skuId:'SKU016', spec:'1000g礼盒', cost:22, price:69 }
  ]},
  { pid: 'PD00008', name: '桌面手机支架可折叠', cat1:'数码电器', cat2:'手机配件', cat3:'支架', cat4:'桌面支架', skus: [
    { skuId:'SKU017', spec:'基础款-黑色', cost:5, price:19.9 }, { skuId:'SKU018', spec:'升级款-银色', cost:8, price:29.9 }
  ]},
];
const refundReasons = ['不喜欢/效果不好','质量问题','发错货/漏发','七天无理由退货','商品与描述不符','物流太慢','收到商品破损','卖家发错尺码'];
const couriers = ['中通快递','圆通速递','韵达快递','顺丰速运','申通快递','极兔速递','邮政快递'];
const payMethods = ['微信支付','支付宝','花呗分期','多多支付'];
const orderSources = ['APP-Android','APP-iOS','小程序','网页','H5'];
const shopNames = ['旗舰店','专营店','专卖店'][Math.floor(Math.random()*3)];

function rnd(min,max) { return Math.floor(Math.random()*(max-min+1))+min; }
function rndf(min,max,d=2) { return (Math.random()*(max-min)+min).toFixed(d); }
function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function fmt(d) { return d.toISOString().split('T')[0]; }
function randDate(start,end) { return new Date(start.getTime()+Math.random()*(end.getTime()-start.getTime())); }
function pad(n,w=2) { return String(n).padStart(w,'0'); }
function rndPhone() { return '1' + String(rnd(3,9)) + String(rnd(100000000,999999999)).slice(0,9); }

// ===== 1. 订单数据 CSV =====
console.log('Generating orders...');
const orderStatuses = ['已发货','已完成','已签收','已付款','待发货','已退款','已取消'];
let orders = [];
let oid = 2705000000;
const startDate = new Date('2026-04-01');
const endDate = new Date('2026-05-28');

for (let i = 0; i < 520; i++) {
  const prod = pick(products);
  const sku = pick(prod.skus);
  const date = randDate(startDate, endDate);
  const qty = [1,1,1,1,2,2,3,5][rnd(0,7)];
  const unitPrice = sku.price;
  const totalPrice = +(unitPrice * qty).toFixed(2);
  const discPct = Math.random() * 0.25;
  const shopDisc = +(totalPrice * discPct * 0.4).toFixed(2);
  const platDisc = +(totalPrice * discPct * 0.35).toFixed(2);
  const duoduoDisc = +(totalPrice * discPct * 0.25).toFixed(2);
  const couponDisc = Math.random() < 0.3 ? +(totalPrice * 0.05).toFixed(2) : 0;
  const userPaid = +(totalPrice - shopDisc - platDisc - duoduoDisc - couponDisc).toFixed(2);
  const techFee = +(userPaid * (Math.random()<0.1 ? 0.01 : 0.006)).toFixed(2);
  const postage = userPaid >= 30 || Math.random() < 0.9 ? 0 : rnd(5,15);
  const merchantReceived = +(userPaid - techFee - postage).toFixed(2);
  const province = pick(provinces);
  const city = cities[province] || province;
  const district = pick(districts);
  const street = pick(streets);
  const status = pick(orderStatuses);
  const isCancelled = status === '已取消';
  const isRefund = (status === '已退款' || (!isCancelled && Math.random() < 0.07));
  const refundAmt = isRefund ? +(merchantReceived * (0.3 + Math.random() * 0.7)).toFixed(2) : 0;
  const refundReason = isRefund ? pick(refundReasons) : '';
  const asStatus = isCancelled ? '' : isRefund ? pick(['退款成功','退款成功','退款成功','退货退款']) : (Math.random() < 0.05 ? pick(['换货','补发']) : '');
  const payDate = date;
  const shipDate = isCancelled ? null : new Date(payDate.getTime() + rnd(1,72)*3600000);
  const confirmDate = shipDate ? new Date(shipDate.getTime() + rnd(1,7)*86400000) : null;
  const promiseDate = new Date(payDate.getTime() + 48*3600000);
  const courier = pick(couriers);
  const trackingNo = 'YT' + String(rnd(10000000000, 99999999999));
  const isPreSale = Math.random() < 0.1;
  const isLiveOrder = Math.random() < 0.08;
  const isStorePickup = Math.random() < 0.02;
  const isLottery = Math.random() < 0.01;
  const isSF = Math.random() < 0.03;
  const isSubsidy = Math.random() < 0.12;
  const isInstall = prod.cat1 === '家居生活' && Math.random() < 0.15;
  const isDeliverIn = prod.cat1 === '家居生活' && Math.random() < 0.05;

  const order = {
    '订单号': String(oid + i),
    '订单状态': status,
    '支付时间': fmt(payDate) + ' ' + pad(rnd(0,23)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
    '发货时间': shipDate ? fmt(shipDate) + ' ' + pad(rnd(0,23)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)) : '',
    '确认收货时间': confirmDate ? fmt(confirmDate) : '',
    '订单成交时间': fmt(payDate) + ' ' + pad(rnd(0,23)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
    '承诺发货时间': fmt(promiseDate),
    '商品名称': prod.name,
    '商品ID': prod.pid,
    '商家编码-商品维度': prod.pid.replace('PD','SP'),
    '商家编码-规格维度': sku.skuId,
    '商品规格': sku.spec,
    '规格id': sku.skuId,
    '规格名称': sku.spec,
    '样式ID': 'ST' + sku.skuId.slice(3),
    '商品一级类目': prod.cat1,
    '商品二级类目': prod.cat2,
    '商品三级类目': prod.cat3,
    '商品四级类目': prod.cat4,
    '商品数量(件)': qty,
    '商品单价(元)': unitPrice.toFixed(2),
    '商品总价(元)': totalPrice.toFixed(2),
    '用户实付金额(元)': userPaid.toFixed(2),
    '商家实收金额(元)': merchantReceived.toFixed(2),
    '邮费(元)': postage.toFixed(2),
    '店铺优惠折扣(元)': shopDisc.toFixed(2),
    '平台优惠折扣(元)': platDisc.toFixed(2),
    '多多支付立减金额(元)': duoduoDisc.toFixed(2),
    '拼多多优惠券(元)': couponDisc.toFixed(2),
    '平台技术服务费(元)': techFee.toFixed(2),
    '上门安装费(元)': isInstall ? rndf(30,80) : '0.00',
    '送货入户费(元)': isDeliverIn ? rndf(20,50) : '0.00',
    '送货入户并安装费(元)': isInstall&&isDeliverIn ? rndf(50,120) : '0.00',
    '退款金额(元)': refundAmt.toFixed(2),
    '退款原因': refundReason,
    '退款类型': isRefund ? pick(['仅退款','退货退款']) : '',
    '售后状态': asStatus,
    '省': province,
    '市': city,
    '订单来源': pick(orderSources),
    '是否直播间成交': isLiveOrder ? '是' : '否',
    '是否直播间引导成交': Math.random()<0.03 ? '是' : '否',
    '是否门店自提': isStorePickup ? '是' : '否',
    '门店名称': isStorePickup ? pick(['万达广场店','万象城店','大悦城店','王府井店']) : '',
    '支付方式': pick(payMethods),
    '是否分期': payMethods.includes('花呗') && Math.random()<0.5 ? '是' : '否',
    '分期期数': Math.random()<0.15 ? pick(['3','6','12']) : '',
    '手续费承担方': Math.random()<0.1 ? pick(['商家','买家']) : '',
    '是否预售': isPreSale ? '是' : '否',
    '是否顺丰加价': isSF ? '是' : '否',
    '是否抽奖或0元试用': isLottery ? '是' : '否',
    '是否社区团购': Math.random()<0.02 ? '是' : '否',
    '是否无痕发货': Math.random()<0.05 ? '是' : '否',
    '是否节能补贴': isSubsidy ? '是' : '否',
    '快递公司': courier,
    '快递单号': trackingNo,
    '配送状态': isCancelled ? '' : pick(['运输中','运输中','运输中','已签收','派送中']),
    '集运类型': Math.random()<0.05 ? pick(['集运','转运']) : '',
  };
  orders.push(order);
}
orders.sort((a,b) => a['支付时间'].localeCompare(b['支付时间']));

// CSV output
const orderHeaders = Object.keys(orders[0]);
const csvLines = [orderHeaders.join(',')];
orders.forEach(o => {
  csvLines.push(orderHeaders.map(h => {
    const v = String(o[h]||'');
    return v.includes(',') || v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v;
  }).join(','));
});
writeFileSync(path.join(outDir, '演示数据_订单.csv'), '﻿' + csvLines.join('\n'), 'utf8');
console.log('  Orders:', orders.length, 'rows,', orderHeaders.length, 'columns');

// ===== 2. 商品推广 XLSX =====
console.log('Generating promotion...');
const promDates = [];
for (let d = new Date('2026-04-01'); d <= new Date('2026-05-28'); d.setDate(d.getDate()+1)) promDates.push(fmt(d));
let promData = [];
products.forEach(prod => {
  promDates.forEach(date => {
    const imp = rnd(500, 8000);
    const ctrVal = 0.02 + Math.random() * 0.1;
    const click = Math.floor(imp * ctrVal);
    const cvrVal = 0.02 + Math.random() * 0.07;
    const orders_gen = Math.floor(click * cvrVal);
    const cpc = 0.2 + Math.random() * 1.5;
    const cost = +(click * cpc).toFixed(2);
    const aov = 30 + Math.random() * 120;
    const gmv = +(orders_gen * aov).toFixed(2);
    promData.push({
      '日期': date,
      '商品ID': prod.pid,
      '商品名称': prod.name,
      '推广名称': prod.name + '-多多搜索',
      '总花费(元)': cost.toFixed(2),
      '成交花费(元)': cost.toFixed(2),
      '花费(元)': cost.toFixed(2),
      '成交笔数': orders_gen,
      '成交订单数': orders_gen,
      '交易额(元)': gmv.toFixed(2),
      '成交金额(元)': gmv.toFixed(2),
      '曝光量': imp,
      '点击量': click,
      '点击率': (ctrVal*100).toFixed(2)+'%',
      '转化率': (cvrVal*100).toFixed(2)+'%',
      '平均点击花费(元)': cpc.toFixed(2),
      '千次曝光花费': (cost/imp*1000).toFixed(2),
      '投入产出比': cost>0 ? (gmv/cost).toFixed(2) : '0',
      '询单量': Math.floor(click * (0.01+Math.random()*0.05)),
      '询单花费(元)': (cost*0.1).toFixed(2),
      '收藏量': Math.floor(click * (0.01+Math.random()*0.03)),
      '收藏花费(元)': (cost*0.05).toFixed(2),
      '关注量': Math.floor(click * (0.005+Math.random()*0.02)),
      '关注花费(元)': (cost*0.03).toFixed(2),
      '店铺关注量': Math.floor(click * (0.002+Math.random()*0.01)),
      '商品收藏量': Math.floor(click * (0.005+Math.random()*0.02)),
    });
  });
});
const promWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(promWb, XLSX.utils.json_to_sheet(promData), '商品推广');
XLSX.writeFile(promWb, path.join(outDir, '演示数据_商品推广.xlsx'));
console.log('  Promotion:', promData.length, 'rows');

// ===== 3. 售后数据 XLSX =====
console.log('Generating after-sale...');
let afterSales = [];
let asId = 9000000;
const refundOrds = orders.filter(o => o['退款金额(元)'] > '0' && parseFloat(o['退款金额(元)']) > 0);
refundOrds.forEach(o => {
  const applyDate = new Date(o['支付时间']);
  const agreeDate = new Date(applyDate.getTime() + rnd(1,72)*3600000);
  afterSales.push({
    '售后编号': 'AS'+(asId++),
    '订单编号': o['订单号'],
    '商品ID': o['商品ID'],
    '商品名称': o['商品名称'],
    '商品规格': o['商品规格'],
    'sku信息': o['商家编码-规格维度'],
    'SKU信息': o['商家编码-规格维度'],
    '退款金额(元)': o['退款金额(元)'],
    '退款金额': o['退款金额(元)'],
    '买家退款金额': o['退款金额(元)'],
    '售后状态': o['售后状态'],
    '退款类型': o['退款类型'],
    '售后类型': o['退款类型'],
    '退款原因': o['退款原因'],
    '售后原因': o['退款原因'],
    '订单状态': o['订单状态'],
    '申请时间': fmt(applyDate),
    '售后申请时间': fmt(applyDate),
    '同意退款时间': fmt(agreeDate),
    '同意退货时间': fmt(agreeDate),
    '同意退款人': pick(['客服小王','客服小李','客服张某']),
    '处理人': pick(['售后组A','售后组B']),
    '退货运单号': o['退款类型']==='退货退款' ? 'SF'+rnd(1000000000,9999999999) : '',
    '退货物流状态': o['退款类型']==='退货退款' ? pick(['运输中','已签收','已验收']) : '',
    '退货物流状态对应时间': o['退款类型']==='退货退款' ? fmt(new Date(agreeDate.getTime()+rnd(1,5)*86400000)) : '',
    '快递公司': o['快递公司'],
    '物流公司': o['快递公司'],
    '快递拦截状态': Math.random()<0.1 ? '已拦截' : '未拦截',
    '收费状态': pick(['已收费','已收费','已收费','待收费']),
    '收费编号': 'CF'+rnd(100000,999999),
    '理赔状态': Math.random()<0.08 ? '已理赔' : '未理赔',
    '运费补偿状态': Math.random()<0.05 ? '已补偿' : '-',
    '备注': Math.random()<0.3 ? pick(['已联系买家','同意退款','核实中','物流异常']) : '',
    '处理时长(小时)': rnd(1,168),
  });
});
const asWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(asWb, XLSX.utils.json_to_sheet(afterSales), '售后数据');
XLSX.writeFile(asWb, path.join(outDir, '演示数据_售后.xlsx'));
console.log('  After-sale:', afterSales.length, 'rows');

// ===== 4. 运费险 XLSX =====
console.log('Generating insurance...');
let insurances = [];
const insOrderIds = new Set();
orders.filter(() => Math.random() < 0.65).forEach(o => {
  if (insOrderIds.has(o['订单号'])) return;
  insOrderIds.add(o['订单号']);
  insurances.push({
    '订单编号': o['订单号'],
    '订单号': o['订单号'],
    '服务费用（元）': rndf(0.5,3),
    '服务费用(元)': rndf(0.5,3),
    '服务费用': rndf(0.5,3),
    '保费（元）': rndf(1,5),
    '保费(元)': rndf(1,5),
    '保费': rndf(1,5),
    '收费状态': Math.random()<0.9 ? '已收费' : '待收费',
    '理赔状态': Math.random()<0.08 ? '已理赔' : '未理赔',
    '运费补偿状态': Math.random()<0.05 ? '已补偿' : '-',
    '补偿状态': Math.random()<0.05 ? '已补偿' : '-',
    '收费编号': 'SF'+rnd(100000,999999),
    '运费补偿生效时间': Math.random()<0.05 ? fmt(new Date(o['支付时间'])) : '',
  });
});
const insWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(insWb, XLSX.utils.json_to_sheet(insurances), '运费险');
XLSX.writeFile(insWb, path.join(outDir, '演示数据_运费险.xlsx'));
console.log('  Insurance:', insurances.length, 'rows');

// ===== 5. 货款明细 CSV (财务记录) =====
console.log('Generating financial records...');
let financials = [];
let finDate = new Date('2026-04-01');
while (finDate <= new Date('2026-05-28')) {
  // Daily settlement income
  const dayOrders = orders.filter(o => o['支付时间'].startsWith(fmt(finDate)));
  const sampledOrders = dayOrders.slice(0, Math.min(dayOrders.length, 15));
  sampledOrders.forEach(o => {
    const finTime = new Date(finDate.getTime() + rnd(8,20)*3600000);
    // 收入
    financials.push({
      '商户订单号': o['订单号'],
      '业务描述': '订单结算收入',
      '收入金额（+元）': o['商家实收金额(元)'],
      '收入金额(元)': o['商家实收金额(元)'],
      '收入金额': o['商家实收金额(元)'],
      '支出金额（-元）': '0.00',
      '支出金额(元)': '0.00',
      '支出金额': '0.00',
      '发生时间': fmt(finTime) + ' ' + pad(rnd(0,23)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
      '账务类型': '订单结算',
      '发生金额': o['商家实收金额(元)'],
      '金额(元)': o['商家实收金额(元)'],
      '金额': o['商家实收金额(元)'],
    });
    // 平台技术服务费 (贷方)
    financials.push({
      '商户订单号': o['订单号'],
      '业务描述': '平台技术服务费',
      '收入金额（+元）': '0.00',
      '收入金额(元)': '0.00',
      '收入金额': '0.00',
      '支出金额（-元）': o['平台技术服务费(元)'],
      '支出金额(元)': o['平台技术服务费(元)'],
      '支出金额': o['平台技术服务费(元)'],
      '发生时间': fmt(new Date(finDate.getTime()+86400000)) + ' ' + pad(rnd(0,23)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
      '账务类型': '费用扣除',
      '发生金额': '-' + o['平台技术服务费(元)'],
      '金额(元)': o['平台技术服务费(元)'],
      '金额': o['平台技术服务费(元)'],
    });
  });
  // 罚款/扣款 (004开头)
  if (Math.random() < 0.3) {
    const penaltyAmt = rndf(3,50);
    financials.push({
      '商户订单号': pick(sampledOrders.length ? sampledOrders : [{订单号:'2705000000'}]).订单号 || '2705000000',
      '业务描述': '004延迟发货罚款',
      '收入金额（+元）': '0.00', '收入金额(元)': '0.00', '收入金额': '0.00',
      '支出金额（-元）': penaltyAmt, '支出金额(元)': penaltyAmt, '支出金额': penaltyAmt,
      '发生时间': fmt(finDate) + ' ' + pad(rnd(8,20)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
      '账务类型': '罚款扣款',
      '发生金额': '-'+penaltyAmt, '金额(元)': penaltyAmt, '金额': penaltyAmt,
    });
  }
  // 百亿补贴技术服务费 (0030002/0030003)
  if (Math.random() < 0.2) {
    const subAmt = rndf(5,30);
    financials.push({
      '商户订单号': pick(sampledOrders.length ? sampledOrders : [{订单号:'2705000000'}]).订单号 || '2705000000',
      '业务描述': Math.random()<0.5 ? '0030002百亿补贴技术服务费' : '0030003百亿补贴扣点',
      '收入金额（+元）': '0.00', '收入金额(元)': '0.00', '收入金额': '0.00',
      '支出金额（-元）': subAmt, '支出金额(元)': subAmt, '支出金额': subAmt,
      '发生时间': fmt(finDate) + ' ' + pad(rnd(8,20)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
      '账务类型': '技术服务费',
      '发生金额': '-'+subAmt, '金额(元)': subAmt, '金额': subAmt,
    });
  }
  // 营销费用 (006开头)
  if (Math.random() < 0.15) {
    const mktAmt = rndf(10,100);
    financials.push({
      '商户订单号': pick(sampledOrders.length ? sampledOrders : [{订单号:'2705000000'}]).订单号 || '2705000000',
      '业务描述': '006推广营销费',
      '收入金额（+元）': '0.00', '收入金额(元)': '0.00', '收入金额': '0.00',
      '支出金额（-元）': mktAmt, '支出金额(元)': mktAmt, '支出金额': mktAmt,
      '发生时间': fmt(finDate) + ' ' + pad(rnd(8,20)) + ':' + pad(rnd(0,59)) + ':' + pad(rnd(0,59)),
      '账务类型': '营销费用',
      '发生金额': '-'+mktAmt, '金额(元)': mktAmt, '金额': mktAmt,
    });
  }
  finDate.setDate(finDate.getDate() + 1);
}

const finHeaders = Object.keys(financials[0]);
const finCsv = [finHeaders.join(',')];
financials.forEach(f => {
  finCsv.push(finHeaders.map(h => {
    const v = String(f[h]||'');
    return v.includes(',') ? '"'+v.replace(/"/g,'""')+'"' : v;
  }).join(','));
});
writeFileSync(path.join(outDir, '演示数据_货款明细.csv'), '﻿' + finCsv.join('\n'), 'utf8');
console.log('  Financial:', financials.length, 'rows');

// ===== 打包 =====
console.log('=== ALL DONE ===');
console.log('Output:', outDir);
console.log('  Orders CSV:', orders.length, 'rows,', orderHeaders.length, 'cols');
console.log('  Promotion XLSX:', promData.length, 'rows');
console.log('  After-sale XLSX:', afterSales.length, 'rows');
console.log('  Insurance XLSX:', insurances.length, 'rows');
console.log('  Financial CSV:', financials.length, 'rows');
