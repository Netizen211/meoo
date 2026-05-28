/**
 * 生成成本管理模板 — SKU成本导入模板 + 自定义扣费模板
 */
const XLSX = require('xlsx');
const { writeFileSync, mkdirSync } = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'public', 'assets');
mkdirSync(outDir, { recursive: true });

// ===== 1. SKU成本模板 CSV =====
// 格式与 CostManagementPage exportSkuTemplate 完全一致
// 列: 商品ID, SKU_ID, 商品名称, 规格, 商家编码, 当前成本(元/件), 订单数, 件数
const skuCosts = [
  ['PD00001','SKU001','夏季冰丝凉席三件套','1.5m床-灰色','SP00001',28,45,90],
  ['PD00001','SKU002','夏季冰丝凉席三件套','1.8m床-灰色','SP00001',33,38,72],
  ['PD00001','SKU003','夏季冰丝凉席三件套','1.5m床-蓝色','SP00001',28,40,78],
  ['PD00002','SKU004','无线蓝牙耳机Pro版','黑色标准版','SP00002',45,55,70],
  ['PD00002','SKU005','无线蓝牙耳机Pro版','白色降噪版','SP00002',65,48,55],
  ['PD00003','SKU006','儿童益智积木拼装玩具','大颗粒100粒','SP00003',18,35,50],
  ['PD00003','SKU007','儿童益智积木拼装玩具','大颗粒200粒','SP00003',30,30,42],
  ['PD00004','SKU008','不锈钢保温杯大容量','500ml-黑色','SP00004',15,42,55],
  ['PD00004','SKU009','不锈钢保温杯大容量','800ml-银色','SP00004',20,38,48],
  ['PD00005','SKU010','男士运动休闲鞋透气款','39码-黑色','SP00005',42,28,45],
  ['PD00005','SKU011','男士运动休闲鞋透气款','40码-黑色','SP00005',42,25,38],
  ['PD00005','SKU012','男士运动休闲鞋透气款','41码-白色','SP00005',42,30,42],
  ['PD00006','SKU013','女士防晒衣轻薄透气','M码-浅蓝','SP00006',22,32,48],
  ['PD00006','SKU014','女士防晒衣轻薄透气','L码-粉色','SP00006',22,28,40],
  ['PD00007','SKU015','有机红枣夹核桃500g','500g袋装','SP00007',12,35,52],
  ['PD00007','SKU016','有机红枣夹核桃500g','1000g礼盒','SP00007',22,25,35],
  ['PD00008','SKU017','桌面手机支架可折叠','基础款-黑色','SP00008',5,30,55],
  ['PD00008','SKU018','桌面手机支架可折叠','升级款-银色','SP00008',8,25,42],
];

const csvHeader = '商品ID,SKU_ID,商品名称,规格,商家编码,当前成本(元/件),订单数,件数';
const csvLines = [csvHeader];
skuCosts.forEach(row => {
  csvLines.push(row.map((v,i) => {
    if (i >= 2 && i <= 3) return '"' + String(v).replace(/"/g,'""') + '"';
    return String(v);
  }).join(','));
});
writeFileSync(path.join(outDir, 'SKU成本导入模板.csv'), '﻿' + csvLines.join('\n'), 'utf8');
console.log('SKU cost template:', skuCosts.length, 'SKUs');

// ===== 2. 自定义扣费模板 XLSX =====
// 2a. 使用说明 sheet
const instructions = [
  ['自定义扣费公式模板 — 使用说明'],
  [''],
  ['【变量列表】可在公式中使用以下变量（区分大小写）：'],
  ['gmv: 商品总价', 'revenue: 商家实收金额', 'orders: 订单数', 'sales: 销量(件数)'],
  ['productCost: 商品成本', 'packagingFee: 包装费', 'shippingFee: 快递费', 'promoCost: 推广费'],
  ['discount: 折扣金额', 'platformFee: 平台服务费', 'taxes: 税费', 'refund: 退款金额'],
  ['refundRate: 退款率(%)', 'afterSaleCount: 售后订单数', 'afterSaleRate: 售后率(%)'],
  ['grossProfit: 毛利', 'netProfit: 净利润', 'profit: 当前阶段利润'],
  ['promoOrders: 推广订单数', 'promoTransaction: 推广成交额', 'promoClicks: 点击量', 'promoImpressions: 曝光量'],
  ['ctr: 点击率(%)', 'cvr: 转化率(%)', 'roi: 推广ROI'],
  ['avgOrderValue: 客单价', 'activeDays: 活跃天数', 'avgDailySales: 日均销量'],
  [''],
  ['【支持的运算符】+ - * / ( ) 以及以下数学函数：'],
  ['min(a,b): 取最小值', 'max(a,b): 取最大值', 'round(x): 四舍五入', 'floor(x): 向下取整', 'ceil(x): 向上取整'],
  ['if(c,a,b): 条件判断，c为真返回a，否则返回b'],
  [''],
  ['【扣费公式示例】'],
  ['包装费(按订单) → packagingFee * orders * 1.2  (实际包装费比估计高20%)'],
  ['仓储管理费 → sales * 0.8  (每件货仓储费0.8元)'],
  ['退货损耗 → refund * 0.15  (退货商品15%损耗不可二次销售)'],
  ['大促加班费 → if(orders > 500, (orders - 500) * 0.5, 0)  (超500单每单加0.5元)'],
  ['阶梯提成 → if(profit > 50000, profit * 0.05, if(profit > 20000, profit * 0.03, 0))  (利润分阶梯提成)'],
  ['售后处理费 → afterSaleCount * 3  (每笔售后退款处理成本3元)'],
  ['低效推广罚金 → if(roi < 1.5, promoCost * 0.1, 0)  (ROI低于1.5罚推广费10%)'],
  ['高退款罚金 → if(refundRate > 15, gmv * 0.02, 0)  (退款率超15%罚GMV的2%)'],
  ['快递耗材 → orders * 0.3  (每单快递袋+胶带0.3元)'],
  ['拍照美工摊销 → gmv * 0.01  (GMV的1%摊销)'],
];

const instWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(instWb, XLSX.utils.aoa_to_sheet(instructions), '使用说明');

// 2b. 扣费模板 sheet (可直接导入的格式)
const deductionHeaders = ['扣费名称', '公式', '适用范围', '适用目标', '生效日期', '失效日期', '条件表达式', '启用'];
const deductionExamples = [
  ['包装耗材费', 'packagingFee * orders * 1.2', 'global', '', '2026-04-01', '', '', 'true'],
  ['仓储管理费', 'sales * 0.8', 'global', '', '2026-04-01', '', '', 'true'],
  ['退货损耗金', 'refund * 0.15', 'global', '', '2026-04-01', '', 'refundRate > 10', 'true'],
  ['大促加班费', 'if(orders > 500, (orders-500)*0.5, 0)', 'global', '', '', '', 'orders > 500', 'false'],
  ['季节性仓储附加', 'sales * 1.5', 'product', 'PD00001,PD00006', '2026-06-01', '2026-09-30', '', 'false'],
  ['低ROI渠道惩罚', 'if(roi < 1.5, promoCost * 0.1, 0)', 'global', '', '', '', 'roi < 1.5', 'false'],
  ['拍照美工费', 'gmv * 0.01', 'global', '', '', '', '', 'true'],
  ['售后客服成本', 'afterSaleCount * 3', 'global', '', '', '', '', 'true'],
];
const deductionSheet = [deductionHeaders, ...deductionExamples];
XLSX.utils.book_append_sheet(instWb, XLSX.utils.aoa_to_sheet(deductionSheet), '扣费模板');
XLSX.writeFile(instWb, path.join(outDir, '自定义扣费模板.xlsx'));
console.log('Deduction template:', deductionExamples.length, 'examples');

// ===== 3. 完整成本配置包说明 =====
const readmeSheet = [
  ['成本配置完整指南'],
  [''],
  ['本包包含以下文件：'],
  ['1. SKU成本导入模板.csv — 导入到"成本管理 > 商品成本"页面'],
  ['   格式: 商品ID,SKU_ID,商品名称,规格,商家编码,当前成本(元/件),订单数,件数'],
  ['   修改"当前成本"列的值后，点击"批量导入"上传'],
  ['   '],
  ['2. 自定义扣费模板.xlsx — 参考使用说明和扣费模板示例'],
  ['   "使用说明" sheet: 变量列表、运算符、公式示例'],
  ['   "扣费模板" sheet: 可直接参考的扣费项配置'],
  ['   '],
  ['3. 在"成本管理 > 自定义扣费"中手动添加上面的扣费公式'],
  ['   每个扣费项可设置：名称、公式、适用范围(global/product/category)、生效日期、条件'],
  ['   '],
  ['4. 在"成本管理 > 税务配置"中设置税率：'],
  ['   增值税: base=revenue, rate=1%~13%'],
  ['   所得税: base=profit, rate=5%~25%'],
  ['   '],
  ['成本计算完整链路:'],
  ['裸货成本(productCost) + 包装费 + 快递费 + 推广费 + 平台佣金 + 运费险 + 罚款 + 营销费 + 自定义扣费 + 税费 = 总成本'],
  ['商家实收(revenue) - 总成本 = 净利润(netProfit)'],
];
XLSX.utils.book_append_sheet(instWb, XLSX.utils.aoa_to_sheet(readmeSheet), '配置指南');
XLSX.writeFile(instWb, path.join(outDir, '自定义扣费模板.xlsx'));
// re-write with all 3 sheets
const finalWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(finalWb, XLSX.utils.aoa_to_sheet(instructions), '使用说明');
XLSX.utils.book_append_sheet(finalWb, XLSX.utils.aoa_to_sheet(deductionSheet), '扣费模板');
XLSX.utils.book_append_sheet(finalWb, XLSX.utils.aoa_to_sheet(readmeSheet), '配置指南');
XLSX.writeFile(finalWb, path.join(outDir, '自定义扣费模板.xlsx'));

console.log('=== ALL DONE ===');
console.log('Files:', outDir);
