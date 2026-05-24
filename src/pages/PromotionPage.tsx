import React, { useMemo, useState } from 'react';
import { Megaphone, BarChart3, Package, Star, Video } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, filterPromoByTimeRange } from '../components/TimeFilter';
import PromotionTotalTab from './promotion/PromotionTotalTab';
import PromotionProductTab from './promotion/PromotionProductTab';
import PromotionStarTab from './promotion/PromotionStarTab';
import PromotionLiveTab from './promotion/PromotionLiveTab';

export default function PromotionPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const [activeTab, setActiveTab] = useState<'total' | 'product' | 'star' | 'live'>('total');
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled };

  const hasPromo = currentDisplayData?.promotionSummary?.length > 0;
  const hasStar = currentDisplayData?.starStoreSummary?.length > 0;
  const hasLive = currentDisplayData?.liveStreamSummary?.length > 0;
  const hasAnyPromo = hasPromo || hasStar || hasLive;

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange), [orders, allDates, timeRange]);
  const filteredPromoSummary = useMemo(() => filterPromoByTimeRange(currentDisplayData?.promotionSummary || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);
  const filteredStarSummary = useMemo(() => filterPromoByTimeRange(currentDisplayData?.starStoreSummary || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);
  const filteredLiveSummary = useMemo(() => filterPromoByTimeRange(currentDisplayData?.liveStreamSummary || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);

  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  const totalKpiData = useMemo(() => {
    if (!hasAnyPromo) return null;
    let totalCost = 0, promoOrders = 0, promoGMV = 0;
    let totalImpressions = 0, totalClicks = 0;
    let inquiryCost = 0, inquiryCount = 0, favoriteCost = 0, favoriteCount = 0, followCost = 0, followCount = 0;
    if (hasPromo) {
      filteredPromoSummary.forEach((r: any) => {
        totalCost += safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费'] || r['成交花费(元)']);
        promoOrders += parseInt(r['成交笔数'] || r['订单数'] || r['推广订单数'] || '0') || 0;
        promoGMV += safeFloat(r['交易额(元)'] || r['成交金额(元)'] || r['推广GMV'] || r['总成交金额']);
        totalImpressions += parseInt(r['曝光量'] || '0') || 0;
        totalClicks += parseInt(r['点击量'] || '0') || 0;
        inquiryCost += safeFloat(r['询单花费(元)']);
        inquiryCount += parseInt(r['询单量'] || '0') || 0;
        favoriteCost += safeFloat(r['收藏花费(元)']);
        favoriteCount += parseInt(r['收藏量'] || '0') || 0;
        followCost += safeFloat(r['关注花费(元)']);
        followCount += parseInt(r['关注量'] || '0') || 0;
      });
    }
    if (hasStar) {
      filteredStarSummary.forEach((r: any) => {
        totalCost += safeFloat(r['花费(元)']);
        promoGMV += safeFloat(r['交易额(元)']);
        promoOrders += parseInt(r['成交笔数'] || '0') || 0;
        totalImpressions += parseInt(r['曝光量'] || '0') || 0;
        totalClicks += parseInt(r['点击量'] || '0') || 0;
      });
    }
    if (hasLive) {
      filteredLiveSummary.forEach((r: any) => {
        totalCost += safeFloat(r['总花费(元)'] || r['花费(元)']);
        promoGMV += safeFloat(r['交易额(元)']);
        promoOrders += parseInt(r['成交笔数'] || '0') || 0;
        totalImpressions += parseInt(r['曝光量'] || '0') || 0;
      });
    }
    const roi = totalCost > 0 ? promoGMV / totalCost : 0;
    const avgOrder = promoOrders > 0 ? promoGMV / promoOrders : 0;
    const merchantIncome = filteredOrders.reduce((s: number, o: any) => s + safeFloat(o['商家实收金额(元)']), 0);
    const promoRatio = merchantIncome > 0 ? (totalCost / merchantIncome) * 100 : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cvr = totalClicks > 0 ? (promoOrders / totalClicks) * 100 : 0;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const cpa = promoOrders > 0 ? totalCost / promoOrders : 0;
    const avgInquiryCost = inquiryCount > 0 ? inquiryCost / inquiryCount : 0;
    const avgFavoriteCost = favoriteCount > 0 ? favoriteCost / favoriteCount : 0;
    const avgFollowCost = followCount > 0 ? followCost / followCount : 0;
    return {
      totalCost, promoOrders, promoGMV, roi, avgOrder, promoRatio,
      totalImpressions, totalClicks, ctr, cvr, cpc, cpa,
      inquiryCost, inquiryCount, favoriteCost, favoriteCount, followCost, followCount,
      avgInquiryCost, avgFavoriteCost, avgFollowCost
    };
  }, [filteredPromoSummary, filteredStarSummary, filteredLiveSummary, hasPromo, hasStar, hasLive, filteredOrders]);

  const productKpiData = useMemo(() => {
    if (!hasPromo) return null;
    let totalCost = 0, promoOrders = 0, promoGMV = 0;
    let totalImpressions = 0, totalClicks = 0;
    let inquiryCost = 0, inquiryCount = 0, favoriteCost = 0, favoriteCount = 0, followCost = 0, followCount = 0;
    filteredPromoSummary.forEach((r: any) => {
      totalCost += safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费'] || r['成交花费(元)']);
      promoOrders += parseInt(r['成交笔数'] || r['订单数'] || r['推广订单数'] || '0') || 0;
      promoGMV += safeFloat(r['交易额(元)'] || r['成交金额(元)'] || r['推广GMV'] || r['总成交金额']);
      totalImpressions += parseInt(r['曝光量'] || '0') || 0;
      totalClicks += parseInt(r['点击量'] || '0') || 0;
      inquiryCost += safeFloat(r['询单花费(元)']);
      inquiryCount += parseInt(r['询单量'] || '0') || 0;
      favoriteCost += safeFloat(r['收藏花费(元)']);
      favoriteCount += parseInt(r['收藏量'] || '0') || 0;
      followCost += safeFloat(r['关注花费(元)']);
      followCount += parseInt(r['关注量'] || '0') || 0;
    });
    const roi = totalCost > 0 ? promoGMV / totalCost : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cvr = totalClicks > 0 ? (promoOrders / totalClicks) * 100 : 0;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const cpa = promoOrders > 0 ? totalCost / promoOrders : 0;
    return { totalCost, promoOrders, promoGMV, roi, totalImpressions, totalClicks, ctr, cvr, cpc, cpa, inquiryCount, favoriteCount, followCount };
  }, [filteredPromoSummary, hasPromo]);

  const starKpiData = useMemo(() => {
    if (!hasStar) return null;
    let totalCost = 0, promoOrders = 0, promoGMV = 0;
    let totalImpressions = 0, totalClicks = 0, followCount = 0, favoriteCount = 0;
    filteredStarSummary.forEach((r: any) => {
      totalCost += safeFloat(r['花费(元)']);
      promoGMV += safeFloat(r['交易额(元)']);
      promoOrders += parseInt(r['成交笔数'] || '0') || 0;
      totalImpressions += parseInt(r['曝光量'] || '0') || 0;
      totalClicks += parseInt(r['点击量'] || '0') || 0;
      followCount += parseInt(r['店铺关注量'] || '0') || 0;
      favoriteCount += parseInt(r['商品收藏量'] || '0') || 0;
    });
    const roi = totalCost > 0 ? promoGMV / totalCost : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    return { totalCost, promoOrders, promoGMV, roi, totalImpressions, totalClicks, ctr, cpc, followCount, favoriteCount };
  }, [filteredStarSummary, hasStar]);

  const liveKpiData = useMemo(() => {
    if (!hasLive) return null;
    let totalCost = 0, promoOrders = 0, promoGMV = 0;
    let totalImpressions = 0, followCount = 0, favoriteCount = 0, commentCount = 0, deepViewCount = 0;
    filteredLiveSummary.forEach((r: any) => {
      totalCost += safeFloat(r['总花费(元)'] || r['花费(元)']);
      promoGMV += safeFloat(r['交易额(元)']);
      promoOrders += parseInt(r['成交笔数'] || '0') || 0;
      totalImpressions += parseInt(r['曝光量'] || '0') || 0;
      followCount += parseInt(r['关注量'] || '0') || 0;
      favoriteCount += parseInt(r['商品收藏量'] || '0') || 0;
      commentCount += parseInt(r['直播评论量'] || '0') || 0;
      deepViewCount += parseInt(r['深度观看'] || '0') || 0;
    });
    const roi = totalCost > 0 ? promoGMV / totalCost : 0;
    return { totalCost, promoOrders, promoGMV, roi, totalImpressions, followCount, favoriteCount, commentCount, deepViewCount };
  }, [filteredLiveSummary, hasLive]);

  const trendData = useMemo(() => {
    if (!hasPromo) return [];
    const byDate: Record<string, { cost: number; gmv: number }> = {};
    filteredPromoSummary.forEach((r: any) => {
      const d = String(r['日期'] || r['date'] || '').trim();
      if (!d) return;
      if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0 };
      byDate[d].cost += safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费']);
      byDate[d].gmv += safeFloat(r['交易额(元)'] || r['成交金额(元)'] || r['推广GMV']);
    });
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
    const rangeDays = parseInt(timeRange);
    const sliced = sorted.slice(-rangeDays);
    return sliced.map(([d, v]) => ({
      date: d.slice(5), cost: Math.round(v.cost), roi: v.cost > 0 ? Math.round((v.gmv / v.cost) * 100) / 100 : 0
    }));
  }, [filteredPromoSummary, hasPromo, timeRange]);

  const channelData = useMemo(() => {
    const channels: { name: string; cost: number; gmv: number; roi: number }[] = [];
    if (hasPromo) {
      const cost = filteredPromoSummary.reduce((s: number, r: any) => s + safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费']), 0);
      const gmv = filteredPromoSummary.reduce((s: number, r: any) => s + safeFloat(r['交易额(元)'] || r['成交金额(元)'] || r['推广GMV']), 0);
      channels.push({ name: '商品推广', cost, gmv, roi: cost > 0 ? gmv / cost : 0 });
    }
    if (hasStar) {
      const cost = filteredStarSummary.reduce((s: number, r: any) => s + safeFloat(r['花费(元)']), 0);
      const gmv = filteredStarSummary.reduce((s: number, r: any) => s + safeFloat(r['交易额(元)']), 0);
      channels.push({ name: '明星店铺', cost, gmv, roi: cost > 0 ? gmv / cost : 0 });
    }
    if (hasLive) {
      const cost = filteredLiveSummary.reduce((s: number, r: any) => s + safeFloat(r['总花费(元)'] || r['花费(元)']), 0);
      const gmv = filteredLiveSummary.reduce((s: number, r: any) => s + safeFloat(r['交易额(元)']), 0);
      channels.push({ name: '直播推广', cost, gmv, roi: cost > 0 ? gmv / cost : 0 });
    }
    return channels;
  }, [filteredPromoSummary, filteredStarSummary, filteredLiveSummary, hasPromo, hasStar, hasLive]);

  const filteredPromoProducts = useMemo(() => filterPromoByTimeRange(currentDisplayData?.promotionProducts || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);

  // 构建订单商品信息映射（商品ID -> {name, code}）
  const productInfoMap = useMemo(() => {
    const map: Record<string, { name: string; code: string }> = {};
    orders.forEach((o: any) => {
      const pid = String(o['商品id'] || o['商品ID'] || '').trim().replace(/\t$/, '');
      const name = String(o['商品'] || o['商品名称'] || '').trim();
      const code = String(o['商家编码-商品维度'] || o['商家编码'] || '').trim();
      if (pid && !map[pid]) {
        map[pid] = { name, code };
      }
    });
    return map;
  }, [orders]);

  const topProducts = useMemo(() => {
    if (!filteredPromoProducts.length) return [];
    return filteredPromoProducts
      .map((r: any) => {
        const pid = String(r['商品ID'] || r['商品id'] || '').trim();
        const orderInfo = productInfoMap[pid] || { name: '', code: '' };
        return {
          pid,
          name: String(r['商品名称'] || r['商品'] || orderInfo.name || '').slice(0, 20),
          code: orderInfo.code,
          cost: safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费']),
          orders: parseInt(r['成交笔数'] || r['订单数'] || '0') || 0,
          gmv: safeFloat(r['交易额(元)'] || r['成交金额(元)'] || r['GMV']),
          roi: safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费']) > 0 ? safeFloat(r['交易额(元)'] || r['成交金额(元)'] || r['GMV']) / safeFloat(r['总花费(元)'] || r['花费(元)'] || r['推广花费']) : 0,
          cvr: safeFloat(r['点击率'] || r['转化率'] || r['CTR']) || 0,
        };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [filteredPromoProducts, productInfoMap]);

  const filteredInsurance = useMemo(() => filterPromoByTimeRange(currentDisplayData?.shippingInsurance || [], allDates, timeRange, '日期'), [currentDisplayData, allDates, timeRange]);

  const profitData = useMemo(() => {
    if (!filteredOrders.length || !hasAnyPromo) return null;
    const merchantIncome = filteredOrders.reduce((s: number, o: any) => s + safeFloat(o['商家实收金额(元)']), 0);
    const promoCost = totalKpiData?.totalCost || 0;
    const insuranceCost = filteredInsurance.reduce((s: number, r: any) => s + safeFloat(r['保费(元)'] || r['运费险成本']), 0);
    const rawCost = Object.values((currentDisplayData as any)?.productCosts || {}).reduce((s: number, v: any) => s + safeFloat(v), 0);
    const netProfit = merchantIncome - promoCost - insuranceCost - rawCost;
    return { merchantIncome, promoCost, insuranceCost, rawCost, netProfit };
  }, [filteredOrders, hasAnyPromo, totalKpiData, filteredInsurance, currentDisplayData]);

  if (!hasAnyPromo) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Megaphone size={18} color="var(--pdd-danger)" />推广利润</h2>
        <div className="pdd-card text-center py-12 text-[var(--pdd-text-secondary)]">
          <p>请上传推广数据文件（商品推广/明星店铺/直播推广）</p>
          {currentDisplayData && (
            <p className="text-xs mt-2 text-[var(--pdd-text-secondary)]">
              当前数据状态：订单 {currentDisplayData.orders?.length || 0} 条
              {currentDisplayData.promotionSummary?.length > 0 && ` | 推广汇总 ${currentDisplayData.promotionSummary.length} 条`}
            </p>
          )}
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'total', label: '合计', icon: BarChart3, hasData: hasAnyPromo },
    { key: 'product', label: '商品推广', icon: Package, hasData: hasPromo },
    { key: 'star', label: '明星店铺', icon: Star, hasData: hasStar },
    { key: 'live', label: '直播推广', icon: Video, hasData: hasLive },
  ];

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone size={18} color="var(--pdd-danger)" />推广利润分析</h2>
      <TimeFilter state={tfState} />

      <div className="flex gap-2 border-b border-[var(--pdd-border)] pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            disabled={!tab.hasData}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
              activeTab === tab.key 
                ? 'bg-[var(--pdd-danger)] text-white' 
                : tab.hasData 
                  ? 'text-[var(--pdd-text-secondary)] hover:bg-[var(--pdd-hover)]' 
                  : 'text-[var(--pdd-text-secondary)] opacity-50 cursor-not-allowed'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'total' && <PromotionTotalTab totalKpiData={totalKpiData} channelData={channelData} profitData={profitData} rangeLabel={rangeLabel} />}
      {activeTab === 'product' && <PromotionProductTab productKpiData={productKpiData} trendData={trendData} topProducts={topProducts} rangeLabel={rangeLabel} />}
      {activeTab === 'star' && <PromotionStarTab starKpiData={starKpiData} />}
      {activeTab === 'live' && <PromotionLiveTab liveKpiData={liveKpiData} />}
    </div>
  );
}
