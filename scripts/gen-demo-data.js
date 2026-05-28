const XLSX = require('xlsx');
const { writeFileSync } = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'public', 'assets');
require('fs').mkdirSync(outDir, { recursive: true });

// ===== 订单数据 CSV =====
const provinces = ['浙江省','江苏省','广东省','山东省','河南省','湖北省','湖南省','四川省','福建省','安徽省','河北省','辽宁省','陕西省','江西省','重庆市','上海市','北京市','天津市','广西','云南省'];
const cities = { '浙江省':'杭州','江苏省':'南京','广东省':'广州','山东省':'青岛','河南省':'郑州','湖北省':'武汉','湖南省':'长沙','四川省':'成都','福建省':'厦门','安徽省':'合肥' };
const products = [
  { pid: 'PD00001', name: '夏季冰丝凉席三件套', category: '家居生活', skus: [
    { sku: 'SKU001', spec: '1.5m床-灰色', cost: 28 },
    { sku: 'SKU002', spec: '1.8m床-灰色', cost: 33 },
    { sku: 'SKU003', spec: '1.5m床-蓝色', cost: 28 },
  ]},
  { pid: 'PD00002', name: '无线蓝牙耳机Pro版', category: '数码电器', skus: [
    { sku: 'SKU004', spec: '黑色标准版', cost: 45 },
    { sku: 'SKU005', spec: '白色降噪版', cost: 65 },
  ]},
  { pid: 'PD00003', name: '儿童益智积木拼装玩具', category: '母婴玩具', skus: [
    { sku: 'SKU006', spec: '大颗粒100粒', cost: 18 },
    { sku: 'SKU007', spec: '大颗粒200粒', cost: 30 },
  ]},
  { pid: 'PD00004', name: '不锈钢保温杯大容量', category: '家居生活', skus: [
    { sku: 'SKU008', spec: '500ml-黑色', cost: 15 },
    { sku: 'SKU009', spec: '800ml-银色', cost: 20 },
  ]},
  { pid: 'PD00005', name: '男士运动休闲鞋透气款', category: '运动户外', skus: [
    { sku: 'SKU010', spec: '39码-黑色', cost: 42 },
    { sku: 'SKU011', spec: '40码-黑色', cost: 42 },
    { sku: 'SKU012', spec: '41码-白色', cost: 42 },
  ]},
  { pid: 'PD00006', name: '女士防晒衣轻薄透气', category: '服饰内衣', skus: [
    { sku: 'SKU013', spec: 'M码-浅蓝', cost: 22 },
    { sku: 'SKU014', spec: 'L码-粉色', cost: 22 },
  ]},
  { pid: 'PD00007', name: '有机红枣夹核桃500g', category: '食品生鲜', skus: [
    { sku: 'SKU015', spec: '500g袋装', cost: 12 },
    { sku: 'SKU016', spec: '1000g礼盒', cost: 22 },
  ]},
  { pid: 'PD00008', name: '桌面手机支架可折叠', category: '数码电器', skus: [
    { sku: 'SKU017', spec: '基础款-黑色', cost: 5 },
    { sku: 'SKU018', spec: '升级款-银色', cost: 8 },
  ]},
];
const orderStatuses = ['已发货','已完成','已签收','已付款','待发货','已退款'];
const refundReasons = ['不喜欢/效果不好','质量问题','发错货/漏发','七天无理由退货','商品与描述不符','物流太慢','收到商品破损'];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function fmt(d) { return d.toISOString().split('T')[0]; }

let orders = [];
let orderNo = 2605000000;

// Generate ~450 orders spanning 2026-04-01 to 2026-05-28
for (let i = 0; i < 450; i++) {
  const prod = products[Math.floor(Math.random() * products.length)];
  const sku = prod.skus[Math.floor(Math.random() * prod.skus.length)];
  const date = randomDate(new Date('2026-04-01'), new Date('2026-05-28'));
  const qty = Math.ceil(Math.random() * 5);
  const unitPrice = Math.round((sku.cost * (1.5 + Math.random() * 2.5)) * 100) / 100;
  const totalPrice = Math.round(unitPrice * qty * 100) / 100;
  const discount = Math.round(Math.random() * totalPrice * 0.3 * 100) / 100;
  const merchantReceived = Math.round((totalPrice - discount) * 100) / 100;
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  const city = cities[province] || province;
  const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
  const isRefund = status === '已退款' || Math.random() < 0.08;
  const refundAmt = isRefund ? Math.round(merchantReceived * (0.3 + Math.random() * 0.7) * 100) / 100 : 0;
  const refundReason = isRefund ? refundReasons[Math.floor(Math.random() * refundReasons.length)] : '';

  orders.push({
    '订单号': String(orderNo + i),
    '支付时间': fmt(date) + ' ' + String(Math.floor(Math.random()*24)).padStart(2,'0') + ':' + String(Math.floor(Math.random()*60)).padStart(2,'0') + ':' + String(Math.floor(Math.random()*60)).padStart(2,'0'),
    '商品ID': prod.pid,
    '商品名称': prod.name,
    '商家编码-SKU维度': sku.sku,
    '商家编码-商品维度': prod.pid.replace('PD','SP'),
    '商品规格': sku.spec,
    '商品数量(件)': qty,
    '商品单价(元)': unitPrice.toFixed(2),
    '商品总价(元)': totalPrice.toFixed(2),
    '订单金额(元)': totalPrice.toFixed(2),
    '优惠金额(元)': discount.toFixed(2),
    '商家实收金额(元)': merchantReceived.toFixed(2),
    '订单状态': status,
    '省份': province,
    '城市': city,
    '收货人姓名': '用户' + String(Math.ceil(Math.random()*999)),
    '收货人手机': '138' + String(Math.floor(10000000+Math.random()*90000000)),
    '收货地址': city + '区测试路' + String(Math.ceil(Math.random()*300)) + '号',
    '退款金额(元)': refundAmt > 0 ? refundAmt.toFixed(2) : '0',
    '退款原因': refundReason,
    '退款状态': isRefund ? '退款成功' : '',
    '支付方式': ['微信支付','支付宝','花呗分期'][Math.floor(Math.random()*3)],
    '快递公司': ['中通快递','圆通速递','韵达快递','顺丰速运','申通快递','极兔速递'][Math.floor(Math.random()*6)],
    '快递单号': 'YT' + String(Math.floor(10000000000+Math.random()*90000000000)),
    '是否预售': Math.random() < 0.1 ? '是' : '否',
    '运费(元)': '0',
    '商品类目': prod.category,
    '百亿补贴': Math.random() < 0.15 ? '是' : '否',
  });
}

// Sort by date
orders.sort((a,b) => a['支付时间'].localeCompare(b['支付时间']));

// Write CSV
const headers = Object.keys(orders[0]);
const csvLines = [headers.join(',')];
orders.forEach(o => {
  csvLines.push(headers.map(h => {
    const v = String(o[h]||'');
    return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g,'""') + '"' : v;
  }).join(','));
});
writeFileSync(path.join(outDir, '演示数据_订单.csv'), '﻿' + csvLines.join('\n'), 'utf8');
console.log('Orders:', orders.length, 'rows');

// ===== 商品推广 XLSX =====
const promWb = XLSX.utils.book_new();
const promDates = [];
for (let d = new Date('2026-04-01'); d <= new Date('2026-05-28'); d.setDate(d.getDate() + 1)) {
  promDates.push(fmt(d));
}

let promProducts = [];
products.forEach(prod => {
  promDates.forEach(date => {
    const imp = Math.floor(500 + Math.random() * 5000);
    const click = Math.floor(imp * (0.02 + Math.random() * 0.08));
    const cost = Math.round(click * (0.3 + Math.random() * 1.2) * 100) / 100;
    const orders_gen = Math.floor(click * (0.02 + Math.random() * 0.06));
    const gmv = Math.round(orders_gen * (30 + Math.random() * 100) * 100) / 100;
    promProducts.push({
      '日期': date,
      '商品ID': prod.pid,
      '商品名称': prod.name,
      '推广名称': prod.name + '-多多搜索',
      '曝光量': imp,
      '点击量': click,
      '点击率': (click/imp*100).toFixed(2) + '%',
      '花费(元)': cost.toFixed(2),
      '成交花费(元)': (cost*0.8).toFixed(2),
      '成交订单数': orders_gen,
      '交易额(元)': gmv.toFixed(2),
      '成交金额(元)': gmv.toFixed(2),
      '投入产出比': gmv > 0 ? (gmv/cost).toFixed(2) : '0',
      '千次曝光花费': (cost/imp*1000).toFixed(2),
      '成交笔数': orders_gen,
    });
  });
});

const promSheet = XLSX.utils.json_to_sheet(promProducts);
XLSX.utils.book_append_sheet(promWb, promSheet, '商品推广');
XLSX.writeFile(promWb, path.join(outDir, '演示数据_商品推广.xlsx'));
console.log('Promotion products:', promProducts.length, 'rows');

// ===== 售后数据 XLSX =====
const asWb = XLSX.utils.book_new();
let afterSales = [];
let asId = 8000000;
const refundOrders = orders.filter(o => parseFloat(o['退款金额(元)']) > 0);
refundOrders.forEach(o => {
  afterSales.push({
    '售后编号': 'AS' + (asId++),
    '订单编号': o['订单号'],
    '商品ID': o['商品ID'],
    '商品名称': o['商品名称'],
    '商品规格': o['商品规格'],
    '售后状态': ['退款成功','退款成功','退款成功','退货退款','已驳回'][Math.floor(Math.random()*5)],
    '退款金额(元)': o['退款金额(元)'],
    '退款原因': o['退款原因'],
    '售后类型': ['仅退款','退货退款'][Math.floor(Math.random()*2)],
    '申请时间': o['支付时间'],
    '售后完成时间': fmt(new Date(new Date(o['支付时间']).getTime() + 86400000 * (1+Math.random()*5))),
    '退款时间': fmt(new Date(new Date(o['支付时间']).getTime() + 86400000 * (1+Math.random()*3))),
    '快递状态': '已签收',
    '商家责任': Math.random() < 0.3 ? '是' : '否',
  });
});
for (let i = 0; i < Math.floor(orders.length * 0.05); i++) {
  const o = orders[Math.floor(Math.random() * orders.length)];
  afterSales.push({
    '售后编号': 'AS' + (asId++),
    '订单编号': o['订单号'],
    '商品ID': o['商品ID'],
    '商品名称': o['商品名称'],
    '商品规格': o['商品规格'],
    '售后状态': ['换货','补发'][Math.floor(Math.random()*2)],
    '退款金额(元)': '0',
    '退款原因': '',
    '售后类型': ['换货','补发'][Math.floor(Math.random()*2)],
    '申请时间': fmt(randomDate(new Date('2026-05-01'), new Date('2026-05-28'))),
    '售后完成时间': '',
    '退款时间': '',
    '快递状态': '运输中',
    '商家责任': '否',
  });
}

const asSheet = XLSX.utils.json_to_sheet(afterSales);
XLSX.utils.book_append_sheet(asWb, asSheet, '售后数据');
XLSX.writeFile(asWb, path.join(outDir, '演示数据_售后.xlsx'));
console.log('After-sale:', afterSales.length, 'rows');

// ===== 运费险 XLSX =====
const insWb = XLSX.utils.book_new();
let insurances = [];
orders.filter(() => Math.random() < 0.6).forEach(o => {
  insurances.push({
    '订单编号': o['订单号'],
    '保费(元)': (Math.random() * 3).toFixed(2),
    '服务费用(元)': (Math.random() * 2).toFixed(2),
    '理赔状态': Math.random() < 0.1 ? '已理赔' : '未理赔',
    '收费编号': 'SF' + String(Math.floor(100000+Math.random()*900000)),
    '收费状态': Math.random() < 0.9 ? '已收费' : '待收费',
    '运费补偿状态': Math.random() < 0.05 ? '已补偿' : '-',
  });
});
const insSheet = XLSX.utils.json_to_sheet(insurances);
XLSX.utils.book_append_sheet(insWb, insSheet, '运费险');
XLSX.writeFile(insWb, path.join(outDir, '演示数据_运费险.xlsx'));
console.log('Insurance:', insurances.length, 'rows');

// ===== 打包 ZIP =====
console.log('=== ALL DONE ===');
console.log('Files generated in:', outDir);
