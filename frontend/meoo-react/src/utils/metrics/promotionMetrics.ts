import { safeNum, safeStr } from "./index";

export interface PromotionMetrics {
  promoCost: number;
  promoTransaction: number;
  promoOrders: number;
  promoImpressions: number;
  promoClicks: number;
  promoROI: number;
  starCost: number;
  starGmv: number;
  liveCost: number;
  liveGmv: number;
  totalPromoCost: number;
  totalPromoGmv: number;
  inquiryCost: number;
  favoriteCost: number;
  followCost: number;
  inquiryCount: number;
  favoriteCount: number;
  followCount: number;
}

/**
 * 推广指标
 * ★ 数据来源：promotionProducts, starStoreSummary, liveStreamSummary
 */
export function computePromotionMetrics(
  promoRecords: any[],
  starRecords?: any[],
  liveRecords?: any[],
  promoDetailRecords?: any[],
): PromotionMetrics {
  var promoCost=0, promoTransaction=0, promoOrders=0, promoImpressions=0, promoClicks=0;
  var inquiryCost=0, favoriteCost=0, followCost=0, inquiryCount=0, favoriteCount=0, followCount=0;
  promoRecords.forEach(function(r){
    promoCost += safeNum(r["成交花费(元)"] || r["总花费(元)"] || r["花费(元)"]);
    promoTransaction += safeNum(r["交易额(元)"] || r["成交金额(元)"]);
    promoOrders += safeNum(r["成交笔数"]);
    promoImpressions += safeNum(r["曝光量"]);
    promoClicks += safeNum(r["点击量"]);
  });
  // 询单/收藏/关注 优先从明细表读
  var source = promoDetailRecords && promoDetailRecords.length > 0 ? promoDetailRecords : promoRecords;
  source.forEach(function(r){
    inquiryCost += safeNum(r["询单花费(元)"]);
    favoriteCost += safeNum(r["收藏花费(元)"]);
    followCost += safeNum(r["关注花费(元)"]);
    inquiryCount += safeNum(r["询单量"]);
    favoriteCount += safeNum(r["收藏量"]);
    followCount += safeNum(r["关注量"]);
  });
  var starCost=0, starGmv=0;
  (starRecords||[]).forEach(function(r){
    starCost += safeNum(r["花费(元)"] || r["总花费(元)"]);
    starGmv += safeNum(r["交易额(元)"] || r["成交金额(元)"]);
  });
  var liveCost=0, liveGmv=0;
  (liveRecords||[]).forEach(function(r){
    liveCost += safeNum(r["总花费(元)"] || r["花费(元)"]);
    liveGmv += safeNum(r["交易额(元)"] || r["成交金额(元)"]);
  });
  var totalPromoCost = promoCost + starCost + liveCost;
  var totalPromoGmv = promoTransaction + starGmv + liveGmv;
  return {
    promoCost, promoTransaction, promoOrders, promoImpressions, promoClicks,
    promoROI: totalPromoCost > 0 ? totalPromoGmv / totalPromoCost : 0,
    starCost, starGmv, liveCost, liveGmv,
    totalPromoCost, totalPromoGmv,
    inquiryCost, favoriteCost, followCost,
    inquiryCount, favoriteCount, followCount,
  };
}
