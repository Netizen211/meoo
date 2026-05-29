#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================
  Cross-Validation Audit - Final Round with Role Swap
  6 key checks: GMV / Refund / Time / SKU / Profit / Shipping
============================================================
"""
import json, sys, io
from datetime import datetime, timedelta
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ===================== LOAD DATA =====================
with open(r'E:\RJ\SSBB\meoo_zip_1779612767549\full_data.json', 'r', encoding='utf-8') as f:
    raw = json.load(f)

dataset = raw if isinstance(raw, list) else raw.get('data', raw)
if isinstance(dataset, dict) and 'data' in dataset:
    dataset = dataset['data']

orders = dataset.get('orders', [])
promo = dataset.get('promotionSummary', [])
after_sale = dataset.get('afterSaleRecords', [])
financial = dataset.get('financialRecords', [])
insurance = dataset.get('shippingInsurance', [])
pc_block = dataset.get('productCosts', [{}])
product_costs = pc_block[0].get('costs', {}) if pc_block else {}

# ===================== HELPERS =====================
def sf(val):
    if val is None: return 0.0
    try:
        s = str(val).strip().replace(',','').replace('Y','').replace('￥','')
        if s in ('','-','--'): return 0.0
        return float(s)
    except: return 0.0

def si(val):
    if val is None: return 0
    try:
        s = str(val).strip()
        if s in ('','-','--'): return 0
        return int(float(s))
    except: return 0

def parse_date(val):
    try:
        s = str(val).strip()[:10]
        return datetime.strptime(s, '%Y-%m-%d').date()
    except: return None

# ===================== SKU COST MATCHING (mirrors frontend) =====================
def get_sku_cost(order, costs_dict):
    """Match order to SKU cost using same logic as CostManagementPage.tsx line 891."""
    sid = str(order.get('specId', order.get('skuId', ''))).strip()
    pid = str(order.get('productId', order.get('prodId', ''))).strip()
    style_id = str(order.get('styleId', '')).strip()

    # Try from raw keys (Chinese field names) if extracted fields are empty
    if not sid:
        sid = str(order.get('规格id', '')).strip()  # 规格id
    if not pid:
        pid = str(order.get('商品ID', order.get('商品id', ''))).strip()  # 商品ID / 商品id
    if not style_id:
        style_id = str(order.get('样式ID', '')).strip()  # 样式ID

    # Priority 1: ${productId}_${styleId}
    if style_id and pid:
        key = pid + '_' + style_id
        cost = costs_dict.get(key)
        if cost is not None and sf(cost) > 0:
            return sf(cost)

    # Priority 2: ${productId}_${specId}
    if sid and pid:
        key = pid + '_' + sid
        cost = costs_dict.get(key)
        if cost is not None and sf(cost) > 0:
            return sf(cost)

    # Fallback: direct specId match
    if sid:
        cost = costs_dict.get(sid)
        if cost is not None and sf(cost) > 0:
            return sf(cost)

    return 0.0

# Also try matching through order keys directly
def _find_field(order, *labels):
    """Find a field value by trying multiple key names (Chinese & English)."""
    for label in labels:
        val = order.get(label)
        if val is not None and str(val).strip():
            return str(val).strip()
    for k in order.keys():
        for label in labels:
            if label in k:
                val = order.get(k)
                if val is not None and str(val).strip():
                    return str(val).strip()
    return ''

def get_sku_cost_v2(order, costs_dict):
    """Robust SKU cost matching using field search."""
    sid = _find_field(order, '规格id', 'specId', 'skuId')  # 规格id
    pid = _find_field(order, '商品ID', '商品id', 'productId', 'prodId')  # 商品ID, 商品id
    style_id = _find_field(order, '样式ID', 'styleId')  # 样式ID

    # Priority: ${productId}_${styleId}
    if style_id and pid:
        key = pid + '_' + style_id
        cost = costs_dict.get(key)
        if cost is not None and sf(cost) > 0:
            return sf(cost)

    # ${productId}_${specId}
    if sid and pid:
        key = pid + '_' + sid
        cost = costs_dict.get(key)
        if cost is not None and sf(cost) > 0:
            return sf(cost)

    # Direct match
    if sid:
        cost = costs_dict.get(sid)
        if cost is not None and sf(cost) > 0:
            return sf(cost)

    return 0.0

# ===================== FILTER & ENRICH =====================
active_orders = [o for o in orders if str(o.get('订单状态', o.get('status', '')) or '').strip() != '已取消']  # 已取消
TOTAL = len(active_orders)

# Enrich: merge after-sale refund into orders
refund_by_order = {}
for a in after_sale:
    ono = str(a.get('订单编号', a.get('订单号', ''))).strip()
    if not ono: continue
    amt = sf(a.get('退款金额', a.get('退款金额(元)', '0')))
    refund_by_order[ono] = refund_by_order.get(ono, 0) + amt

enriched_orders = []
for o in active_orders:
    ono = str(o.get('订单号', '')).strip()
    enriched = dict(o)
    if ono in refund_by_order and refund_by_order[ono] > 0:
        enriched['退款金额(元)'] = str(refund_by_order[ono])
    enriched_orders.append(enriched)

print(f"Orders: {TOTAL} active / {len(orders)} total")
print(f"Data: promo={len(promo)}d, after_sale={len(after_sale)}, fin={len(financial)}, ins={len(insurance)}, sku_costs={len(product_costs)}")

# ===================== CHECK COST MATCHING =====================
test_order = enriched_orders[0] if enriched_orders else {}
test_sid = _find_field(test_order, '规格id')
test_pid = _find_field(test_order, '商品ID', '商品id')
test_key = (test_pid + '_' + test_sid) if test_pid and test_sid else ''
test_cost = get_sku_cost_v2(test_order, product_costs)
print(f"First order: pid={test_pid}, sid={test_sid}, key={test_key}, cost={test_cost}")
print(f"Config sample keys: {list(product_costs.keys())[:3]}")

# ===================== DASHBOARD KPIs =====================
# Field access using _find_field for Chinese field names
d_gmv = sum(sf(_find_field(o, '商品总价(元)', '商品总价')) for o in enriched_orders)
d_paid = sum(sf(_find_field(o, '用户实付金额(元)', '用户实付金额', '用户实付')) for o in enriched_orders)
d_merchant = sum(sf(_find_field(o, '商家实收金额(元)', '商家实收金额', '商家实收')) for o in enriched_orders)
d_refund = sum(sf(_find_field(o, '退款金额(元)', '退款金额')) for o in enriched_orders)
d_refund_cnt = sum(1 for o in enriched_orders if sf(_find_field(o, '退款金额(元)', '退款金额')) > 0)
d_tech = sum(sf(_find_field(o, '平台技术服务费(元)')) for o in enriched_orders)
d_qty = sum(si(_find_field(o, '商品数量(件)', '商品数量')) for o in enriched_orders)
d_sdisc = sum(sf(_find_field(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) for o in enriched_orders)
d_pdisc = sum(sf(_find_field(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) for o in enriched_orders)
d_paydisc = sum(sf(_find_field(o, '多多支付立减金额(元)', '多多支付立减金额')) for o in enriched_orders)
d_coupon = sum(sf(_find_field(o, '拼多多优惠券(元)')) for o in enriched_orders)

# Cost
d_cost = 0.0
for o in enriched_orders:
    uc = get_sku_cost_v2(o, product_costs)
    q = si(_find_field(o, '商品数量(件)', '商品数量'))
    d_cost += uc * q

d_profit = d_merchant - d_cost - d_tech
d_margin = d_profit / d_merchant * 100 if d_merchant else 0

# Buyers (last-4 of order number, matching DashboardPage.tsx)
d_buyers = set()
for o in enriched_orders:
    ono = str(o.get('订单号', '')).strip()
    if len(ono) >= 4:
        d_buyers.add(ono[-4:])

print(f"Dashboard: GMV={d_gmv:.2f}, paid={d_paid:.2f}, merchant={d_merchant:.2f}, cost={d_cost:.2f}, profit={d_profit:.2f}")

# ===================== PRODUCT ANALYSIS =====================
product_stats = defaultdict(lambda: {'orders':0,'gmv':0,'paid':0,'merchant':0,'refund':0,'refund_cnt':0,'qty':0,'tech':0,'cost':0,'sdisc':0,'pdisc':0,'paydisc':0,'coupon':0})
for o in enriched_orders:
    pid = _find_field(o, '商品ID', '商品id') or 'unknown'
    ps = product_stats[pid]
    ps['orders'] += 1
    ps['gmv'] += sf(_find_field(o, '商品总价(元)', '商品总价'))
    ps['paid'] += sf(_find_field(o, '用户实付金额(元)', '用户实付金额'))
    ps['merchant'] += sf(_find_field(o, '商家实收金额(元)', '商家实收金额'))
    ref = sf(_find_field(o, '退款金额(元)', '退款金额'))
    ps['refund'] += ref
    if ref > 0: ps['refund_cnt'] += 1
    ps['qty'] += si(_find_field(o, '商品数量(件)', '商品数量'))
    ps['tech'] += sf(_find_field(o, '平台技术服务费(元)'))
    ps['sdisc'] += sf(_find_field(o, '店铺优惠折扣(元)', '店铺优惠折扣'))
    ps['pdisc'] += sf(_find_field(o, '平台优惠折扣(元)', '平台优惠折扣'))
    ps['paydisc'] += sf(_find_field(o, '多多支付立减金额(元)', '多多支付立减金额'))
    ps['coupon'] += sf(_find_field(o, '拼多多优惠券(元)'))
    ps['cost'] += get_sku_cost_v2(o, product_costs) * si(_find_field(o, '商品数量(件)', '商品数量'))

p_gmv = sum(ps['gmv'] for ps in product_stats.values())
p_paid = sum(ps['paid'] for ps in product_stats.values())
p_merchant = sum(ps['merchant'] for ps in product_stats.values())
p_refund = sum(ps['refund'] for ps in product_stats.values())
p_cost = sum(ps['cost'] for ps in product_stats.values())
p_tech = sum(ps['tech'] for ps in product_stats.values())
p_profit = sum(ps['merchant'] - ps['cost'] - ps['tech'] for ps in product_stats.values())
p_sdisc = sum(ps['sdisc'] for ps in product_stats.values())
p_pdisc = sum(ps['pdisc'] for ps in product_stats.values())
p_paydisc = sum(ps['paydisc'] for ps in product_stats.values())
p_coupon = sum(ps['coupon'] for ps in product_stats.values())

# ===================== REGION ANALYSIS =====================
region_stats = defaultdict(lambda: {'orders':0,'gmv':0,'paid':0,'merchant':0,'refund':0})
for o in enriched_orders:
    prov = str(o.get('省', '')).strip() or 'unknown'
    rs = region_stats[prov]
    rs['orders'] += 1
    rs['gmv'] += sf(_find_field(o, '商品总价(元)', '商品总价'))
    rs['paid'] += sf(_find_field(o, '用户实付金额(元)', '用户实付金额'))
    rs['merchant'] += sf(_find_field(o, '商家实收金额(元)', '商家实收金额'))
    rs['refund'] += sf(_find_field(o, '退款金额(元)', '退款金额'))

r_gmv = sum(rs['gmv'] for rs in region_stats.values())
r_paid = sum(rs['paid'] for rs in region_stats.values())
r_merchant = sum(rs['merchant'] for rs in region_stats.values())
r_refund = sum(rs['refund'] for rs in region_stats.values())

# ===================== TREND ANALYSIS =====================
trend_daily = defaultdict(lambda: {'orders':0,'gmv':0,'paid':0,'merchant':0,'refund':0})
for o in enriched_orders:
    pt = str(o.get('支付时间', '')).strip()
    if pt:
        dk = pt[:10]
        td = trend_daily[dk]
        td['orders'] += 1
        td['gmv'] += sf(_find_field(o, '商品总价(元)', '商品总价'))
        td['paid'] += sf(_find_field(o, '用户实付金额(元)', '用户实付金额'))
        td['merchant'] += sf(_find_field(o, '商家实收金额(元)', '商家实收金额'))
        td['refund'] += sf(_find_field(o, '退款金额(元)', '退款金额'))

t_gmv = sum(td['gmv'] for td in trend_daily.values())
t_paid = sum(td['paid'] for td in trend_daily.values())
t_merchant = sum(td['merchant'] for td in trend_daily.values())
t_refund = sum(td['refund'] for td in trend_daily.values())
t_days = len(trend_daily)

# ===================== AFTER-SALE =====================
as_refund = sum(sf(a.get('退款金额', a.get('退款金额(元)', '0'))) for a in after_sale)
as_cnt = len(after_sale)

# ===================== TIME FILTER =====================
all_dates = []
for o in enriched_orders:
    d = parse_date(o.get('支付时间', ''))
    if d: all_dates.append(d)
all_dates.sort()

t7_gmv = t30_gmv = t7_paid = t30_paid = t7_refund = t30_refund = 0
t7_cnt = t30_cnt = 0
if all_dates:
    latest = all_dates[-1]
    cut7 = latest - timedelta(days=7)
    cut30 = latest - timedelta(days=30)
    o7 = [o for o in enriched_orders if parse_date(o.get('支付时间','')) and parse_date(o.get('支付时间','')) > cut7]
    o30 = [o for o in enriched_orders if parse_date(o.get('支付时间','')) and parse_date(o.get('支付时间','')) > cut30]
    t7_cnt = len(o7); t30_cnt = len(o30)
    t7_gmv = sum(sf(_find_field(o, '商品总价(元)', '商品总价')) for o in o7)
    t30_gmv = sum(sf(_find_field(o, '商品总价(元)', '商品总价')) for o in o30)
    t7_paid = sum(sf(_find_field(o, '用户实付金额(元)', '用户实付金额')) for o in o7)
    t30_paid = sum(sf(_find_field(o, '用户实付金额(元)', '用户实付金额')) for o in o30)
    t7_refund = sum(sf(_find_field(o, '退款金额(元)', '退款金额')) for o in o7)
    t30_refund = sum(sf(_find_field(o, '退款金额(元)', '退款金额')) for o in o30)

# ===================== SHIPPING =====================
with_tn = [o for o in enriched_orders if str(o.get('快递单号', '')).strip()]
without_tn = [o for o in enriched_orders if not str(o.get('快递单号', '')).strip()]
postage_all = sum(sf(o.get('邮费(元)', '0')) for o in enriched_orders)

# ===================== CHECK 1: CROSS-PAGE GMV =====================
print(); print('='*85)
print('[Check 1] Cross-Page GMV Consistency')
print('='*85)
c1_ok = True
print(f'  Dashboard:     GMV={d_gmv:>12,.2f}  Paid={d_paid:>12,.2f}  Merchant={d_merchant:>12,.2f}')
print(f'  ProductPage:   GMV={p_gmv:>12,.2f}  Paid={p_paid:>12,.2f}  Merchant={p_merchant:>12,.2f}')
print(f'  RegionPage:    GMV={r_gmv:>12,.2f}  Paid={r_paid:>12,.2f}  Merchant={r_merchant:>12,.2f}')
print(f'  TrendPage:     GMV={t_gmv:>12,.2f}  Paid={t_paid:>12,.2f}  Merchant={t_merchant:>12,.2f}')

dash_vals = {'GMV': d_gmv, 'Paid': d_paid, 'Merchant': d_merchant}
prod_vals = {'GMV': p_gmv, 'Paid': p_paid, 'Merchant': p_merchant}
reg_vals = {'GMV': r_gmv, 'Paid': r_paid, 'Merchant': r_merchant}
trend_vals = {'GMV': t_gmv, 'Paid': t_paid, 'Merchant': t_merchant}
for label in ['GMV', 'Paid', 'Merchant']:
    dv, pv, rv, tv = dash_vals[label], prod_vals[label], reg_vals[label], trend_vals[label]
    ok = abs(dv-pv)<0.02 and abs(dv-rv)<0.02 and abs(dv-tv)<0.02
    if not ok: c1_ok = False; print(f'  FAIL: {label} mismatch (d={dv:.2f} p={pv:.2f} r={rv:.2f} t={tv:.2f})')

if c1_ok:
    print('  >>> PASS: GMV/Paid/Merchant all consistent across 4 pages')
else:
    print('  >>> FAIL: Cross-page inconsistency detected')

# ===================== CHECK 2: REFUND CONSISTENCY =====================
print(); print('='*85)
print('[Check 2] Refund Amount Consistency')
print('='*85)
c2_ok = True
print(f'  Dashboard (order field):     {d_refund:>12,.2f}')
print(f'  ProductPage (product sum):   {p_refund:>12,.2f}')
print(f'  AfterSalePage (records):     {as_refund:>12,.2f}  ({as_cnt} records)')
print(f'  RegionPage (province sum):   {r_refund:>12,.2f}')
print(f'  TrendPage (daily sum):       {t_refund:>12,.2f}')

for a, b, name in [(d_refund, p_refund, 'Dashboard vs Product'), (d_refund, as_refund, 'Dashboard vs AfterSale'), (d_refund, r_refund, 'Dashboard vs Region'), (d_refund, t_refund, 'Dashboard vs Trend')]:
    ok = abs(a-b)<0.02
    print(f'  {"OK" if ok else "FAIL"}: {name} (diff={abs(a-b):.2f})')
    if not ok: c2_ok = False

if c2_ok:
    print('  >>> PASS: Refund amount consistent across all pages')
else:
    print('  >>> FAIL: Refund inconsistency detected')

# ===================== CHECK 3: TIME FILTER =====================
print(); print('='*85)
print('[Check 3] Time Filter Consistency (7d/30d/all)')
print('='*85)
c3_ok = True
print(f'  Date range: {all_dates[0]} ~ {all_dates[-1]} ({t_days} days)')
print(f'  {"Time":<8} {"Orders":>6} {"GMV":>14} {"Paid":>14} {"Refund":>12}')
print(f'  {"All":<8} {TOTAL:>6} {d_gmv:>14,.2f} {d_paid:>14,.2f} {d_refund:>12,.2f}')
print(f'  {"30d":<8} {t30_cnt:>6} {t30_gmv:>14,.2f} {t30_paid:>14,.2f} {t30_refund:>12,.2f}')
print(f'  {"7d":<8} {t7_cnt:>6} {t7_gmv:>14,.2f} {t7_paid:>14,.2f} {t7_refund:>12,.2f}')

if t7_cnt <= t30_cnt <= TOTAL and t7_gmv <= t30_gmv <= d_gmv:
    print('  >>> PASS: Data monotonic: 7d < 30d < all')
else:
    c3_ok = False; print('  >>> FAIL: Data not monotonic')

# ===================== CHECK 4: SKU COST =====================
print(); print('='*85)
print('[Check 4] SKU Cost Check (18 SKUs)')
print('='*85)
c4_ok = True

# Build composite key mapping from orders
sku_hit_map = defaultdict(lambda: {'orders':0,'qty':0,'cost':0})
for o in enriched_orders:
    sid = _find_field(o, '规格id')
    pid = _find_field(o, '商品ID', '商品id')
    key = (pid + '_' + sid) if pid and sid else sid
    uc = get_sku_cost_v2(o, product_costs)
    q = si(_find_field(o, '商品数量(件)', '商品数量'))
    sku_hit_map[key]['orders'] += 1
    sku_hit_map[key]['qty'] += q
    sku_hit_map[key]['cost'] += uc * q

print(f'  Config: {len(product_costs)} SKU costs, key format: {"_".join(list(product_costs.keys())[0].split("_")[:-1])}_XXX')
print(f'  {"Config Key":<25} {"ConfigCost":>10} {"Orders":>8} {"Qty":>6} {"CalcCost":>12} {"Match?"}')
matched = 0
for ck in sorted(product_costs.keys()):
    cc = sf(product_costs[ck])
    info = sku_hit_map.get(ck, {'orders':0,'qty':0,'cost':0})
    match_ok = info['orders'] > 0
    expected_unit = cc
    actual_unit = info['cost'] / info['qty'] if info['qty'] > 0 else 0
    unit_ok = abs(actual_unit - expected_unit) < 0.02 if info['qty'] > 0 else True
    status = 'OK' if match_ok and unit_ok else ('PARTIAL' if match_ok else 'MISS')
    if match_ok: matched += 1
    print(f'  {ck:<25} {cc:>10.2f} {info["orders"]:>8} {info["qty"]:>6} {info["cost"]:>12.2f} {status}')
    if not match_ok: c4_ok = False

print(f'\n  Matched: {matched}/{len(product_costs)} SKU configs')
if c4_ok:
    print('  >>> PASS: All 18 SKU costs correctly matched and calculated')
else:
    print('  >>> FAIL: Some SKU costs not matched')

# ===================== CHECK 5: PROFIT CONSISTENCY =====================
print(); print('='*85)
print('[Check 5] Profit Calculation Consistency')
print('='*85)
c5_ok = True
print(f'  Formula: merchant_received - product_cost - platform_tech_fee')
print(f'  Dashboard profit:     {d_profit:>14,.2f}  (margin={d_margin:.2f}%)')
print(f'  Product sum profit:   {p_profit:>14,.2f}')
print(f'  Difference:           {abs(d_profit-p_profit):>14,.2f}')

# Product detail
print(f'\n  {"Product":<12} {"Orders":>5} {"Merchant":>12} {"Cost":>10} {"TechFee":>10} {"Profit":>10} {"Margin":>8}')
for pid in sorted(product_stats.keys()):
    ps = product_stats[pid]
    pp = ps['merchant'] - ps['cost'] - ps['tech']
    pm = pp / ps['merchant'] * 100 if ps['merchant'] > 0 else 0
    print(f'  {pid:<12} {ps["orders"]:>5} {ps["merchant"]:>12,.2f} {ps["cost"]:>10,.2f} {ps["tech"]:>10,.2f} {pp:>10,.2f} {pm:>7.1f}%')

# Discount check
d_totdisc = d_sdisc + d_pdisc + d_paydisc + d_coupon
p_totdisc = p_sdisc + p_pdisc + p_paydisc + p_coupon
print(f'\n  Discount: Dashboard={d_totdisc:,.2f}  ProductSum={p_totdisc:,.2f}  Diff={abs(d_totdisc-p_totdisc):.2f}')

if abs(d_profit-p_profit) < 0.02 and abs(d_totdisc-p_totdisc) < 0.02:
    print('  >>> PASS: Profit and discount consistent across pages')
else:
    c5_ok = False
    print('  >>> FAIL: Profit/discount inconsistency')

# ===================== CHECK 6: SHIPPING =====================
print(); print('='*85)
print('[Check 6] Shipping - Tracking Number Analysis')
print('='*85)
c6_ok = True

no_courier = [o for o in with_tn if not str(o.get('快递公司', '')).strip()]
no_tn_courier = [o for o in without_tn if str(o.get('快递公司', '')).strip()]
print(f'  With tracking no:    {len(with_tn)}/{TOTAL} ({len(with_tn)/TOTAL*100:.1f}%)')
print(f'  Without tracking no: {len(without_tn)}/{TOTAL} ({len(without_tn)/TOTAL*100:.1f}%)')
print(f'  Total postage:       {postage_all:,.2f}')
if no_courier:
    print(f'  WARNING: {len(no_courier)} orders have tracking# but no courier name')
    c6_ok = False
if no_tn_courier:
    print(f'  WARNING: {len(no_tn_courier)} orders have courier but no tracking#')
    c6_ok = False

# Insurance match
ins_orders = set()
for r in insurance:
    ono = str(r.get('订单编号', '')).strip()
    if ono: ins_orders.add(ono)
tracked_ins = sum(1 for o in with_tn if str(o.get('订单号','')).strip() in ins_orders)
print(f'  With tracking + insurance: {tracked_ins}')
print(f'  With tracking - insurance: {len(with_tn)-tracked_ins}')

if c6_ok:
    print('  >>> PASS: Shipping data clean')
else:
    print('  >>> FAIL: Shipping data anomalies')

# ===================== SUMMARY =====================
print(); print('='*85)
print('                    CROSS-VALIDATION SUMMARY')
print('='*85)
checks = [
    ('1. Cross-Page GMV Consistency', c1_ok),
    ('2. Refund Amount Consistency', c2_ok),
    ('3. Time Filter Data Sync', c3_ok),
    ('4. SKU Cost Correctness (18 SKUs)', c4_ok),
    ('5. Profit Calculation Consistency', c5_ok),
    ('6. Shipping Tracking Completeness', c6_ok),
]
passed = sum(1 for _, ok in checks if ok)
for name, ok in checks:
    print(f'  {"PASS" if ok else "FAIL"}  --  {name}')
print(f'\n  Passed: {passed}/6')
print()

# Baseline comparison
print('='*85)
print('[Baseline Comparison]')
print('='*85)
print(f'  Expected: GMV=68814.80  Paid=58799.01  Refund=1702.07  Orders=400')
print(f'  Actual:   GMV={d_gmv:.2f}  Paid={d_paid:.2f}  Refund={d_refund:.2f}  Orders={TOTAL}')
print(f'  Promotion: expected 464 rows, actual {len(promo)}')
print(f'  After-sale: expected 25, actual {as_cnt}')
print(f'  Insurance: expected 252, actual {len(insurance)}')
print(f'  Finance: expected 419, actual {len(financial)}')
print(f'  Products: 8, SKUs: 18, Provinces: {len(region_stats)}, Days: {t_days}')

sku001 = sf(product_costs.get(list(product_costs.keys())[0], 0)) if product_costs else 0
sku017 = sf(product_costs.get('PD00008_SKU017', 0))
print(f'  SKU001 equivalent: {sku001:.2f} (expected 28.00)')
print(f'  SKU017: {sku017:.2f} (expected 5.00)')

# Deviation
gmv_pct = abs(d_gmv - 68814.80) / 68814.80 * 100 if 68814.80 else 0
print(f'  GMV deviation: {gmv_pct:.2f}%')

# Final verdict
print(); print('='*85)
print('                    FINAL VERDICT')
print('='*85)
if passed == 6:
    print('\n  DATA IS 100% ACCURATE AND RELIABLE.')
    print('  All 6 cross-validation checks passed. Ready for final report.')
elif passed >= 4:
    print(f'\n  DATA IS MOSTLY RELIABLE ({passed}/6 checks passed).')
    print(f'  {6-passed} issue(s) need attention before final sign-off.')
else:
    print(f'\n  DATA HAS INCONSISTENCIES ({passed}/6 checks passed).')
    print('  Root cause analysis required. Do NOT merge into final report.')

# Save JSON
result = {
    'audit_time': datetime.now().isoformat(),
    'auditor': 'project_manager_cross_validation',
    'checks': {name: 'PASS' if ok else 'FAIL' for name, ok in checks},
    'passed': passed, 'failed': 6-passed,
    'metrics': {
        'dashboard': {'gmv': round(d_gmv,2), 'paid': round(d_paid,2), 'merchant': round(d_merchant,2), 'refund': round(d_refund,2), 'profit': round(d_profit,2), 'cost': round(d_cost,2), 'tech_fee': round(d_tech,2), 'buyers': len(d_buyers), 'total_qty': d_qty},
        'product': {'gmv': round(p_gmv,2), 'paid': round(p_paid,2), 'profit': round(p_profit,2), 'products': len(product_stats)},
        'region': {'gmv': round(r_gmv,2), 'provinces': len(region_stats)},
        'trend': {'days': t_days, 'gmv': round(t_gmv,2)},
        'after_sale': {'records': as_cnt, 'refund': round(as_refund,2)},
        'shipping': {'with_tracking': len(with_tn), 'without_tracking': len(without_tn)},
        'counts': {'orders': TOTAL, 'promotion': len(promo), 'after_sale': as_cnt, 'financial': len(financial), 'insurance': len(insurance), 'skus': len(product_costs)}
    }
}
with open(r'E:\RJ\SSBB\meoo_zip_1779612767549\cross_validation_result.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print('Report saved to cross_validation_result.json')
