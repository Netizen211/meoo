// 商品分析组件类型定义

export interface CostBreakdown {
  productCost: number;
  packagingFee: number;
  shippingFee: number;
  promoCost: number;
  discount: number;
  platformFee: number;
  insuranceFee?: number;
  penaltyFee?: number;
  marketingFee?: number;
  taxes: number;
  customDeductions: number;
}

export interface CostSource {
  productCost: 'real' | 'estimated' | 'missing';
  taxes: 'default' | 'configured';
  customDeductions: 'configured' | 'none';
}

export interface TaxDetail {
  name: string;
  amount: number;
  rate: number;
  base: number;
}

export interface DeductionDetail {
  name: string;
  amount: number;
  formula: string;
}

export interface PromoSourceDetail {
  source: string;
  date: string;
  cost: number;
  clicks: number;
  impressions: number;
  orders: number;
  transaction: number;
  ctr: number;
  cvr: number;
  productName: string;
}

export interface DailySales {
  date: string;
  sales: number;
  revenue: number;
  orders: number;
}

export interface PriceDistribution {
  price: number;
  count: number;
}

export interface AfterSaleBreakdown {
  [status: string]: number;
}

export interface RelatedProduct {
  productId: string;
  productName: string;
  correlation: number;
  coOrders: number;
}

export interface RegionData {
  province: string;
  sales: number;
  orders: number;
  revenue: number;
  isRemote: boolean;
}

export interface ProductStat {
  productId: string;
  productName: string;
  productCode: string;
  gmv: number;
  orders: number;
  sales: number;
  revenue: number;
  refund: number;
  discount: number;
  afterSaleCount: number;
  afterSaleRate: number;
  avgOrderValue: number;
  promoCost: number;
  promoClicks: number;
  promoImpressions: number;
  promoOrders: number;
  promoTransaction: number;
  ctr: number;
  cvr: number;
  totalCost: number;
  netProfit: number;
  profitRate: number;
  roi: number;
  refundRate: number;
  discountRatio: number;
  promoCostRatio: number;
  hasOrderData: boolean;
  hasPromoData: boolean;
  promoSourceDetails: PromoSourceDetail[];
  dailySales: DailySales[];
  priceDistribution: PriceDistribution[];
  afterSaleBreakdown: AfterSaleBreakdown;
  relatedProducts: RelatedProduct[];
  firstOrderDate: string;
  lastOrderDate: string;
  activeDays: number;
  avgDailySales: number;
  inventoryEstimate: number;
  turnoverDays: number;
  sellThroughRate: number;
  costBreakdown: CostBreakdown;
  costSource: CostSource;
  taxDetails: TaxDetail[];
  deductionDetails: DeductionDetail[];
  profitConfidence: 'high' | 'medium' | 'low';
  grossProfit: number;
  preTaxProfit: number;
  netProfitAfterTax: number;
}

export interface ProductAnalysisProps {
  productStat: ProductStat;
  orders: any[];
  isExpanded?: boolean;
  onToggle?: () => void;
  onDrillDown?: (metric: string) => void;
}

export interface CardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export interface MetricItem {
  label: string;
  value: number;
  unit?: string;
  prefix?: string;
  suffix?: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  tooltip?: string;
}

export interface TrendData {
  date: string;
  value: number;
  label: string;
}

export interface ExportConfig {
  filename: string;
  fields: string[];
  format: 'xlsx' | 'csv';
}
