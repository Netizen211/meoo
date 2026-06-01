import { describe, it, expect } from "vitest";
import { computeDashboardKPI, computeAllProductStats, computePromotionStats, computeAfterSaleStats } from "./analyticsService";

const mockOrders = [
  { "商品ID": "P001", "商品名称": "A", "商品总价(元)": "100", "商家实收金额(元)": "90", "退款金额(元)": "0", "商品数量(件)": "2", "订单号": "O1", "支付时间": "2026-05-01", "订单状态": "已发货", "发货时间": "2026-05-02", "省": "广东" },
  { "商品ID": "P001", "商品名称": "A", "商品总价(元)": "200", "商家实收金额(元)": "180", "退款金额(元)": "50", "商品数量(件)": "3", "订单号": "O2", "支付时间": "2026-05-02", "订单状态": "已退款", "省": "北京" },
  { "商品ID": "P002", "商品名称": "B", "商品总价(元)": "150", "商家实收金额(元)": "135", "退款金额(元)": "0", "商品数量(件)": "1", "订单号": "O3", "支付时间": "2026-05-03", "订单状态": "已签收", "省": "上海" },
];
const mockPromo = [{ "商品ID": "P001", "成交花费(元)": "30", "点击量": "100", "曝光量": "1000", "成交笔数": "2", "交易额(元)": "300" }];
const mockAfterSale = [{ "商品ID": "P001", "退款原因": "质量问题", "退款金额(元)": "50", "售后编号": "AS001" }];

describe("computeDashboardKPI", () => {
  it("GMV", () => { const r = computeDashboardKPI({ orders: mockOrders }); expect(r.kpi.gmv).toBe(450); });
  it("revenue", () => { const r = computeDashboardKPI({ orders: mockOrders }); expect(r.kpi.revenue).toBe(405); });
  it("orders", () => { const r = computeDashboardKPI({ orders: mockOrders }); expect(r.kpi.orders).toBe(3); });
  it("refundRate", () => { const r = computeDashboardKPI({ orders: mockOrders }); expect(r.kpi.refundRate).toBeCloseTo(33.33, 0); });
  it("empty", () => { const r = computeDashboardKPI({}); expect(r.kpi.gmv).toBe(0); expect(r.kpi.orders).toBe(0); });
  it("missingFields", () => { const r = computeDashboardKPI({ orders: [{ "商品ID": "P001" }] }); expect(r.kpi.gmv).toBe(0); });
  it("avgOrder", () => { const r = computeDashboardKPI({ orders: mockOrders }); expect(r.kpi.avgOrder).toBeCloseTo(135,0); });
  it("provinces", () => { const r = computeDashboardKPI({ orders: mockOrders }); expect(r.provinces.length).toBeGreaterThan(0); });
});

describe("computeAllProductStats", () => {
  it("per product", () => { const s = computeAllProductStats(mockOrders,[],[],[],[],{},{}); expect(Object.keys(s).length).toBe(2); });
  it("GMV", () => { const s = computeAllProductStats(mockOrders,[],[],[],[],{},{}); expect(s["P001"].gmv).toBe(300); });
  it("sales", () => { const s = computeAllProductStats(mockOrders,[],[],[],[],{},{}); expect(s["P001"].sales).toBe(5); });
  it("refund", () => { const s = computeAllProductStats(mockOrders,[],[],[],[],{},{}); expect(s["P001"].refundCount).toBe(1); });
  it("promo", () => { const s = computeAllProductStats(mockOrders,mockPromo,[],[],[],{},{}); expect(s["P001"].promoCost).toBe(30); });
  it("ROI", () => { const s = computeAllProductStats(mockOrders,mockPromo,[],[],[],{},{}); expect(s["P001"].roi).toBe(10); });
  it("daily", () => { const s = computeAllProductStats(mockOrders,[],[],[],[],{},{}); expect(s["P001"].dailySales.length).toBe(2); });
  it("empty", () => { const s = computeAllProductStats([],[],[],[],[],{},{}); expect(Object.keys(s).length).toBe(0); });
  it("skipEmptyId", () => { const s = computeAllProductStats([{ "商品ID": "" }],[],[],[],[],{},{}); expect(Object.keys(s).length).toBe(0); });
  it("parseSymbols", () => { const s = computeAllProductStats([{ "商品ID": "P001", "商品总价(元)": "100.50", "商家实收金额(元)": "90", "商品数量(件)": "1" }],[],[],[],[],{},{}); expect(s["P001"].gmv).toBe(100.5); });
});

describe("computePromotionStats", () => {
  it("cost", () => { const r = computePromotionStats({ promotionProducts: mockPromo }); expect(r.summary.cost).toBe(30); });
  it("ROI", () => { const r = computePromotionStats({ promotionProducts: mockPromo }); expect(r.summary.roi).toBe(10); });
  it("empty", () => { const r = computePromotionStats({}); expect(r.summary.cost).toBe(0); });
});

describe("computeAfterSaleStats", () => {
  it("count", () => { const r = computeAfterSaleStats({ afterSaleRecords: mockAfterSale }); expect(r.total).toBe(1); });
  it("reasons", () => { const r = computeAfterSaleStats({ afterSaleRecords: mockAfterSale }); expect(r.reasons[0].name).toBe("质量问题"); });
  it("empty", () => { const r = computeAfterSaleStats({}); expect(r.total).toBe(0); });
});