import { safeNum, safeStr } from "./index";

export interface OrderMetrics {
  orderCount: number;
  gmv: number;
  revenue: number;
  paid: number;
  salesQty: number;
  postage: number;
  discount: number;
  buyerCount: number;
  productCount: number;
  shippedCount: number;
  shippedRate: number;
}

export function computeOrderMetrics(orders: any[]): OrderMetrics {
  var uniqueOrderNos = new Set<string>();
  var buyerSet = new Set<string>();
  var productIds = new Set<string>();
  var gmv=0, revenue=0, paid=0, salesQty=0, postage=0, discount=0, shippedCount=0;
  orders.forEach(function(o){
    var orderNo = safeStr(o["订单号"]);
    if(orderNo) uniqueOrderNos.add(orderNo);
    buyerSet.add(orderNo.slice(-4));
    var pid = safeStr(o["商品ID"] || o["商品id"]);
    if(pid && pid !== "-") productIds.add(pid);
    gmv += safeNum(o["商品总价(元)"]);
    revenue += safeNum(o["商家实收金额(元)"]);
    paid += safeNum(o["用户实付金额(元)"]);
    salesQty += safeNum(o["商品数量(件)"]) || 1;
    postage += safeNum(o["邮费(元)"]);
    discount += safeNum(o["店铺优惠折扣(元)"]) + safeNum(o["平台优惠折扣(元)"]) + safeNum(o["多多支付立减金额(元)"]) + safeNum(o["拼多多优惠券(元)"]);
    if(safeStr(o["快递单号"])) shippedCount++;
  });
  var orderCount = uniqueOrderNos.size || orders.length;
  return {
    orderCount: orderCount, gmv: gmv, revenue: revenue, paid: paid,
    salesQty: salesQty, postage: postage, discount: discount,
    buyerCount: buyerSet.size || 1,
    productCount: productIds.size,
    shippedCount: shippedCount,
    shippedRate: orderCount > 0 ? (shippedCount / orderCount) * 100 : 0,
  };
}
