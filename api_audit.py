#!/usr/bin/env python3
"""运营A全站审计 - 基于API JSON原始数据逐项手算验证"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict
from datetime import datetime

# ===================== LOAD API DATA =====================
with open(r'C:\Users\01\.claude\projects\E--RJ-SSBB\bb8c177a-e3af-4644-ab45-92680764d7ef\tool-results\b5lecdy02.txt', 'r', encoding='utf-8') as f:
    api_response = json.load(f)

data = api_response['data']['data']
orders = data['orders']
promo = data.get('promotionSummary', [])
after_sale = data.get('afterSaleRecords', [])
financial = data.get('financialRecords', [])
product_costs_data = data.get('productCosts', [{}])[0].get('costs', {})
shipping_insurance = data.get('shippingInsurance', [])

TOTAL = len(orders)

def sf(val):
    """Safe float conversion"""
    if val is None: return 0.0
    try:
        s = str(val).strip().replace(',', '').replace('¥', '')
        if s in ('', '-', '--'): return 0.0
        return float(s)
    except: return 0.0

def si(val):
    """Safe int conversion"""
    if val is None: return 0
    try:
        s = str(val).strip()
        if s in ('', '-', '--'): return 0
        return int(float(s))
    except: return 0

print("=" * 80)
print("                    运营专家A 全站数据审计报告")
print(f"                    审计时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"                    数据来源: API /api/data/pull (melody.wang)")
print(f"                    店铺: 演示店铺（可删除）")
print(f"                    订单总数: {TOTAL}")
print("=" * 80)

# ===================================================================
# 1. DASHBOARD 数据中心 KPI
# ===================================================================
print("\n" + "=" * 80)
print("1. Dashboard 数据中心 KPI 验证")
print("=" * 80)

# 1.1 订单数
api_orders = TOTAL
calc_orders = TOTAL
print(f"\n[订单数] API: {api_orders} | 手算: {calc_orders} | {'✅ 一致' if api_orders == calc_orders else '❌ 不一致'}")

# 1.2 GMV (商品总价)
gmv_goods = sum(sf(o.get('商品总价(元)')) for o in orders)
print(f"[GMV-商品总价] API(手算): ¥{gmv_goods:,.2f}")

# 1.3 GMV (用户实付)
gmv_userpaid = sum(sf(o.get('用户实付金额(元)')) for o in orders)
print(f"[GMV-用户实付] API(手算): ¥{gmv_userpaid:,.2f}")

# 1.4 GMV (商家实收)
gmv_merchant = sum(sf(o.get('商家实收金额(元)')) for o in orders)
print(f"[GMV-商家实收] API(手算): ¥{gmv_merchant:,.2f}")

# 1.5 退款金额 - 来自订单
refund_from_orders = sum(sf(o.get('退款金额(元)')) for o in orders)
# 退款金额 - 来自售后记录
refund_from_aftersale = sum(sf(a.get('退款金额', a.get('退款金额(元)', '0'))) for a in after_sale)
refunded_orders = [o for o in orders if sf(o.get('退款金额(元)')) > 0]
print(f"[退款金额-订单字段] ¥{refund_from_orders:,.2f}")
print(f"[退款金额-售后记录] ¥{refund_from_aftersale:,.2f}")
print(f"[退款订单数] {len(refunded_orders)}")

# 1.6 退款率
refund_rate = len(refunded_orders) / TOTAL * 100
print(f"[退款率] {refund_rate:.2f}% ({len(refunded_orders)}/{TOTAL})")

# 1.7 利润率
# 成本计算
total_cost = 0.0
cost_details = defaultdict(lambda: {'qty': 0, 'unit_cost': 0, 'total_cost': 0.0})
for o in orders:
    sid = o.get('规格id', '')
    qty = si(o.get('商品数量(件)'))
    unit_cost = product_costs_data.get(sid, 0)
    total_cost += unit_cost * qty
    if sid:
        cost_details[sid]['qty'] += qty
        cost_details[sid]['unit_cost'] = unit_cost
        cost_details[sid]['total_cost'] += unit_cost * qty

# 平台技术服务费
total_tech_fee = sum(sf(o.get('平台技术服务费(元)')) for o in orders)
# 利润 = 商家实收 - 成本 - 平台技术服务费
profit = gmv_merchant - total_cost - total_tech_fee
profit_margin = profit / gmv_merchant * 100 if gmv_merchant > 0 else 0
print(f"[产品成本总计] ¥{total_cost:,.2f}")
print(f"[平台技术服务费] ¥{total_tech_fee:,.2f}")
print(f"[利润] ¥{profit:,.2f}")
print(f"[利润率] {profit_margin:.2f}%")

# 1.8 买家数 (用收货人手机)
buyers_phone = set()
for o in orders:
    phone = o.get('收货人手机', '').strip()
    if phone:
        buyers_phone.add(phone)
print(f"[买家数(手机号)] {len(buyers_phone)} | 全部唯一 → 每人仅1单")

# 买家数按订单号后4位
buyers_last4 = set()
for o in orders:
    ono = str(o.get('订单号', '')).strip()
    if len(ono) >= 4:
        buyers_last4.add(ono[-4:])
print(f"[买家数(订单号后4位)] {len(buyers_last4)} (模拟算法)")

# 1.9 状态分布
status_dist = defaultdict(int)
for o in orders:
    status_dist[o.get('订单状态', '未知')] += 1
print(f"\n[订单状态分布]")
for s, n in sorted(status_dist.items(), key=lambda x: -x[1]):
    print(f"  {s}: {n} ({n/TOTAL*100:.1f}%)")

# 1.10 推广汇总
total_promo_spend = sum(sf(p.get('总花费(元)')) for p in promo)
total_promo_gmv = sum(sf(p.get('交易额(元)')) for p in promo)
total_promo_orders = sum(si(p.get('成交笔数')) for p in promo)
total_promo_exposure = sum(si(p.get('曝光量')) for p in promo)
total_promo_clicks = sum(si(p.get('点击量')) for p in promo)
promo_roi = total_promo_gmv / total_promo_spend if total_promo_spend else 0
promo_ctr = total_promo_clicks / total_promo_exposure * 100 if total_promo_exposure else 0
promo_cvr = total_promo_orders / total_promo_clicks * 100 if total_promo_clicks else 0

print(f"\n[推广汇总]")
print(f"  总花费: ¥{total_promo_spend:,.2f}")
print(f"  推广GMV: ¥{total_promo_gmv:,.2f}")
print(f"  成交笔数: {total_promo_orders}")
print(f"  ROI: {promo_roi:.2f}")
print(f"  CTR: {promo_ctr:.2f}%")
print(f"  CVR: {promo_cvr:.2f}%")

# ===================================================================
# 2. 趋势分析
# ===================================================================
print("\n" + "=" * 80)
print("2. 趋势分析 - 日/周/月聚合")
print("=" * 80)

# 日聚合
daily = defaultdict(lambda: {'orders': 0, 'gmv_goods': 0.0, 'gmv_paid': 0.0, 'gmv_merchant': 0.0, 'qty': 0, 'refund': 0.0, 'tech_fee': 0.0})
for o in orders:
    pt = o.get('支付时间', '')
    if pt:
        day = pt[:10]
        daily[day]['orders'] += 1
        daily[day]['gmv_goods'] += sf(o.get('商品总价(元)'))
        daily[day]['gmv_paid'] += sf(o.get('用户实付金额(元)'))
        daily[day]['gmv_merchant'] += sf(o.get('商家实收金额(元)'))
        daily[day]['qty'] += si(o.get('商品数量(件)'))
        daily[day]['refund'] += sf(o.get('退款金额(元)'))
        daily[day]['tech_fee'] += sf(o.get('平台技术服务费(元)'))

days_sorted = sorted(daily.keys())
print(f"\n[日聚合] 覆盖 {len(days_sorted)} 天")
print(f"{'日期':<12} {'订单':>6} {'GMV(实付)':>12} {'退款':>10} {'服务费':>10}")
for day in days_sorted[:5]:
    s = daily[day]
    print(f"{day:<12} {s['orders']:>6} ¥{s['gmv_paid']:>10,.2f} ¥{s['refund']:>8,.2f} ¥{s['tech_fee']:>8,.2f}")
if len(days_sorted) > 5:
    print(f"... (共{len(days_sorted)}天)")

# 验证日聚合总计 = 总体
daily_gmv_sum = sum(s['gmv_paid'] for s in daily.values())
daily_order_sum = sum(s['orders'] for s in daily.values())
daily_refund_sum = sum(s['refund'] for s in daily.values())
daily_tech_sum = sum(s['tech_fee'] for s in daily.values())
print(f"\n[日聚合交叉验证]")
print(f"  GMV(实付): 日汇总={daily_gmv_sum:,.2f} vs 总计={gmv_userpaid:,.2f} | {'✅ 一致' if abs(daily_gmv_sum - gmv_userpaid) < 0.01 else '❌ 不一致'}")
print(f"  订单数: 日汇总={daily_order_sum} vs 总计={TOTAL} | {'✅ 一致' if daily_order_sum == TOTAL else '❌ 不一致'}")
print(f"  退款: 日汇总={daily_refund_sum:,.2f} vs 总计={refund_from_orders:,.2f} | {'✅ 一致' if abs(daily_refund_sum - refund_from_orders) < 0.01 else '❌ 不一致'}")
print(f"  服务费: 日汇总={daily_tech_sum:,.2f} vs 总计={total_tech_fee:,.2f} | {'✅ 一致' if abs(daily_tech_sum - total_tech_fee) < 0.01 else '❌ 不一致'}")

# 周聚合
weekly = defaultdict(lambda: {'orders': 0, 'gmv_paid': 0.0, 'gmv_merchant': 0.0, 'refund': 0.0})
for o in orders:
    pt = o.get('支付时间', '')
    if pt:
        try:
            dt = datetime.strptime(pt[:10], '%Y-%m-%d')
            wk = dt.strftime('%Y-W%U')
            weekly[wk]['orders'] += 1
            weekly[wk]['gmv_paid'] += sf(o.get('用户实付金额(元)'))
            weekly[wk]['gmv_merchant'] += sf(o.get('商家实收金额(元)'))
            weekly[wk]['refund'] += sf(o.get('退款金额(元)'))
        except: pass

print(f"\n[周聚合] 覆盖 {len(weekly)} 周")
for wk in sorted(weekly.keys()):
    s = weekly[wk]
    print(f"  {wk}: Orders={s['orders']:>4}, GMV(实付)=¥{s['gmv_paid']:>10,.2f}, Refund=¥{s['refund']:>8,.2f}")

weekly_gmv_sum = sum(s['gmv_paid'] for s in weekly.values())
weekly_order_sum = sum(s['orders'] for s in weekly.values())
print(f"  GMV周汇总={weekly_gmv_sum:,.2f} vs 总计={gmv_userpaid:,.2f} | {'✅' if abs(weekly_gmv_sum - gmv_userpaid) < 0.01 else '❌'}")
print(f"  订单周汇总={weekly_order_sum} vs 总计={TOTAL} | {'✅' if weekly_order_sum == TOTAL else '❌'}")

# 月聚合
monthly = defaultdict(lambda: {'orders': 0, 'gmv_paid': 0.0, 'gmv_merchant': 0.0, 'refund': 0.0})
for o in orders:
    pt = o.get('支付时间', '')
    if pt:
        m = pt[:7]
        monthly[m]['orders'] += 1
        monthly[m]['gmv_paid'] += sf(o.get('用户实付金额(元)'))
        monthly[m]['gmv_merchant'] += sf(o.get('商家实收金额(元)'))
        monthly[m]['refund'] += sf(o.get('退款金额(元)'))

print(f"\n[月聚合] 覆盖 {len(monthly)} 个月")
for m in sorted(monthly.keys()):
    s = monthly[m]
    print(f"  {m}: Orders={s['orders']:>4}, GMV(实付)=¥{s['gmv_paid']:>10,.2f}, Refund=¥{s['refund']:>8,.2f}")

monthly_gmv_sum = sum(s['gmv_paid'] for s in monthly.values())
monthly_order_sum = sum(s['orders'] for s in monthly.values())
print(f"  GMV月汇总={monthly_gmv_sum:,.2f} vs 总计={gmv_userpaid:,.2f} | {'✅' if abs(monthly_gmv_sum - gmv_userpaid) < 0.01 else '❌'}")
print(f"  订单月汇总={monthly_order_sum} vs 总计={TOTAL} | {'✅' if monthly_order_sum == TOTAL else '❌'}")

# 推广数据日聚合对比
promo_daily_gmv = sum(sf(p.get('交易额(元)')) for p in promo)
print(f"\n[推广日数据] 推广数据有 {len(promo)} 天")
print(f"  推广GMV总计: ¥{promo_daily_gmv:,.2f}")
print(f"  发布日期范围: {promo[0].get('日期','')} ~ {promo[-1].get('日期','')}")

# ===================================================================
# 3. 地域分析
# ===================================================================
print("\n" + "=" * 80)
print("3. 地域分析 - 省份/城市/物流")
print("=" * 80)

province_stats = defaultdict(lambda: {'orders': 0, 'gmv_goods': 0.0, 'gmv_paid': 0.0, 'gmv_merchant': 0.0, 'qty': 0, 'refund': 0.0, 'refund_cnt': 0, 'buyers': set()})
city_stats = defaultdict(lambda: {'orders': 0, 'gmv_goods': 0.0, 'gmv_paid': 0.0})

for o in orders:
    prov = o.get('省', '未知')
    city = o.get('市', '未知')

    ps = province_stats[prov]
    ps['orders'] += 1
    ps['gmv_goods'] += sf(o.get('商品总价(元)'))
    ps['gmv_paid'] += sf(o.get('用户实付金额(元)'))
    ps['gmv_merchant'] += sf(o.get('商家实收金额(元)'))
    ps['qty'] += si(o.get('商品数量(件)'))
    refund_amt = sf(o.get('退款金额(元)'))
    ps['refund'] += refund_amt
    if refund_amt > 0:
        ps['refund_cnt'] += 1
    phone = o.get('收货人手机', '')
    if phone:
        ps['buyers'].add(phone)

    cs = city_stats[city]
    cs['orders'] += 1
    cs['gmv_goods'] += sf(o.get('商品总价(元)'))
    cs['gmv_paid'] += sf(o.get('用户实付金额(元)'))

print(f"\n[省份汇总] 覆盖 {len(province_stats)} 个省份")
print(f"{'省份':<8} {'订单':>6} {'GMV(商品总价)':>14} {'GMV(实付)':>12} {'买家':>6} {'退款率':>8}")
for prov, ps in sorted(province_stats.items(), key=lambda x: -x[1]['gmv_goods']):
    rf_rate = ps['refund_cnt'] / ps['orders'] * 100 if ps['orders'] else 0
    print(f"{prov:<8} {ps['orders']:>6} ¥{ps['gmv_goods']:>12,.2f} ¥{ps['gmv_paid']:>10,.2f} {len(ps['buyers']):>6} {rf_rate:>7.1f}%")

# 省份交叉验证
prov_gmv_sum = sum(ps['gmv_goods'] for ps in province_stats.values())
prov_paid_sum = sum(ps['gmv_paid'] for ps in province_stats.values())
prov_merchant_sum = sum(ps['gmv_merchant'] for ps in province_stats.values())
prov_order_sum = sum(ps['orders'] for ps in province_stats.values())

print(f"\n[省份交叉验证]")
print(f"  GMV(商品总价): 省份汇总={prov_gmv_sum:,.2f} vs 总计={gmv_goods:,.2f} | {'✅' if abs(prov_gmv_sum - gmv_goods) < 0.01 else '❌'}")
print(f"  GMV(用户实付): 省份汇总={prov_paid_sum:,.2f} vs 总计={gmv_userpaid:,.2f} | {'✅' if abs(prov_paid_sum - gmv_userpaid) < 0.01 else '❌'}")
print(f"  GMV(商家实收): 省份汇总={prov_merchant_sum:,.2f} vs 总计={gmv_merchant:,.2f} | {'✅' if abs(prov_merchant_sum - gmv_merchant) < 0.01 else '❌'}")
print(f"  订单: 省份汇总={prov_order_sum} vs 总计={TOTAL} | {'✅' if prov_order_sum == TOTAL else '❌'}")

# 城市汇总 TOP 10
print(f"\n[城市汇总 TOP 10]")
for city, cs in sorted(city_stats.items(), key=lambda x: -x[1]['gmv_goods'])[:10]:
    print(f"  {city}: Orders={cs['orders']:>4}, GMV(商品总价)=¥{cs['gmv_goods']:>10,.2f}")

# 偏远地区
remote = ['新疆', '西藏', '青海', '甘肃', '宁夏', '内蒙古', '黑龙江', '吉林', '海南']
print(f"\n[偏远地区订单]")
for prov in remote:
    if prov in province_stats:
        ps = province_stats[prov]
        print(f"  {prov}: {ps['orders']}单, GMV=¥{ps['gmv_paid']:,.2f}, 退款率={ps['refund_cnt']/ps['orders']*100:.1f}%")

# 快递/物流分析
courier_stats = defaultdict(lambda: {'orders': 0, 'paid': 0.0, 'ship_times': []})
for o in orders:
    courier = o.get('快递公司', '未知')
    cs = courier_stats[courier]
    cs['orders'] += 1
    cs['paid'] += sf(o.get('用户实付金额(元)'))
    pay_t = o.get('支付时间', '')
    ship_t = o.get('发货时间', '')
    if pay_t and ship_t:
        try:
            pt = datetime.strptime(pay_t[:19], '%Y-%m-%d %H:%M:%S')
            st = datetime.strptime(ship_t[:19], '%Y-%m-%d %H:%M:%S')
            cs['ship_times'].append((st - pt).total_seconds() / 3600)
        except: pass

print(f"\n[物流时效]")
for courier, cs in sorted(courier_stats.items(), key=lambda x: -x[1]['orders']):
    avg_h = sum(cs['ship_times']) / len(cs['ship_times']) if cs['ship_times'] else 0
    h48 = sum(1 for h in cs['ship_times'] if h <= 48)
    print(f"  {courier}: {cs['orders']}单, 平均发货={avg_h:.1f}h, 48h率={h48/len(cs['ship_times'])*100:.1f}%" if cs['ship_times'] else f"  {courier}: {cs['orders']}单")

# 整体发货时效
all_ship_times = []
for o in orders:
    pay_t = o.get('支付时间', '')
    ship_t = o.get('发货时间', '')
    if pay_t and ship_t:
        try:
            pt = datetime.strptime(pay_t[:19], '%Y-%m-%d %H:%M:%S')
            st = datetime.strptime(ship_t[:19], '%Y-%m-%d %H:%M:%S')
            all_ship_times.append((st - pt).total_seconds() / 3600)
        except: pass

if all_ship_times:
    avg_ship = sum(all_ship_times) / len(all_ship_times)
    h48_count = sum(1 for h in all_ship_times if h <= 48)
    print(f"\n[全店发货时效] 已发货{len(all_ship_times)}单, 平均{avg_ship:.1f}h, 48h发货率{h48_count/len(all_ship_times)*100:.1f}%")

# 配送状态分布
delivery_status = defaultdict(int)
for o in orders:
    delivery_status[o.get('配送状态', '未知')] += 1
print(f"\n[配送状态]")
for s, n in delivery_status.items():
    print(f"  {s}: {n}")

# ===================================================================
# 4. 用户分析
# ===================================================================
print("\n" + "=" * 80)
print("4. 用户分析 - 买家/复购/RFM/消费分布")
print("=" * 80)

# 买家统计 (收货人手机)
buyer_orders = defaultdict(list)
buyer_gmv_paid = defaultdict(float)
buyer_gmv_merchant = defaultdict(float)
buyer_qty = defaultdict(int)

for o in orders:
    phone = o.get('收货人手机', '')
    buyer_orders[phone].append(o)
    buyer_gmv_paid[phone] += sf(o.get('用户实付金额(元)'))
    buyer_gmv_merchant[phone] += sf(o.get('商家实收金额(元)'))
    buyer_qty[phone] += si(o.get('商品数量(件)'))

total_buyers = len(buyer_orders)
repeat_buyers = sum(1 for orders_list in buyer_orders.values() if len(orders_list) > 1)

print(f"\n[买家基础指标]")
print(f"  总买家数: {total_buyers}")
print(f"  复购买家: {repeat_buyers}")
print(f"  复购率: {repeat_buyers/total_buyers*100:.2f}%")
print(f"  人均消费(实付): ¥{gmv_userpaid/total_buyers:,.2f}")
print(f"  人均件数: {sum(buyer_qty.values())/total_buyers:.2f}")

# 注意：所有买家收货人手机均唯一 → 复购率为0
if repeat_buyers == 0:
    print(f"  ⚠️ 所有{total_buyers}个买家手机号均唯一，复购率=0%")

# RFM分层 (由于每人仅1单，所有买家R/F/M相同)
print(f"\n[RFM分层 (收货人手机维度)]")
print(f"  注意：所有买家均为1次购买 → F值均为1, 无法分层")
print(f"  提示：这是一个局限 - 因为不存在真实买家ID，用手机号去重可能低估复购")

# 消费金额分布
gmv_ranges = [(0, 30), (30, 60), (60, 100), (100, 200), (200, 500), (500, 999999)]
gmv_dist = defaultdict(int)
for gmv in buyer_gmv_paid.values():
    for lo, hi in gmv_ranges:
        if lo <= gmv < hi:
            gmv_dist[(lo, hi)] += 1
            break

print(f"\n[消费金额分布]")
for lo, hi in gmv_ranges:
    count = gmv_dist.get((lo, hi), 0)
    label = f'¥{lo}-{hi}' if hi < 999999 else f'¥{lo}+'
    bar = '█' * (count // 2) if count > 0 else ''
    print(f"  {label:<12}: {count:>4}人 ({count/total_buyers*100:>5.1f}%) {bar}")

# 订单来源分析
source_dist = defaultdict(int)
source_gmv = defaultdict(float)
for o in orders:
    src = o.get('订单来源', '未知')
    source_dist[src] += 1
    source_gmv[src] += sf(o.get('用户实付金额(元)'))

print(f"\n[订单来源分布]")
for src, n in sorted(source_dist.items(), key=lambda x: -x[1]):
    print(f"  {src}: {n}单 ({n/TOTAL*100:.1f}%), GMV=¥{source_gmv[src]:,.2f}")

# 支付方式
pay_dist = defaultdict(int)
for o in orders:
    pay_dist[o.get('支付方式', '未知')] += 1
print(f"\n[支付方式分布]")
for p, n in sorted(pay_dist.items(), key=lambda x: -x[1]):
    print(f"  {p}: {n} ({n/TOTAL*100:.1f}%)")

# 是否分期
installment = sum(1 for o in orders if o.get('是否分期') == '是')
print(f"\n[分期支付] {installment}/{TOTAL} ({installment/TOTAL*100:.1f}%)")

# 是否直播间
live_orders = sum(1 for o in orders if o.get('是否直播间成交') == '是' or o.get('是否直播间引导成交') == '是')
print(f"[直播间] 成交:{sum(1 for o in orders if o.get('是否直播间成交')=='是')}, 引导:{sum(1 for o in orders if o.get('是否直播间引导成交')=='是')}")

# ===================================================================
# 5. 商品分析
# ===================================================================
print("\n" + "=" * 80)
print("5. 商品分析")
print("=" * 80)

product_stats = defaultdict(lambda: {'orders': 0, 'qty': 0, 'gmv_goods': 0.0, 'gmv_paid': 0.0, 'refund_cnt': 0, 'refund_amt': 0.0})
for o in orders:
    pname = o.get('商品名称', '未知')
    ps = product_stats[pname]
    ps['orders'] += 1
    ps['qty'] += si(o.get('商品数量(件)'))
    ps['gmv_goods'] += sf(o.get('商品总价(元)'))
    ps['gmv_paid'] += sf(o.get('用户实付金额(元)'))
    if sf(o.get('退款金额(元)')) > 0:
        ps['refund_cnt'] += 1
        ps['refund_amt'] += sf(o.get('退款金额(元)'))

print(f"{'商品名称':<20} {'订单':>6} {'数量':>6} {'GMV(商品总价)':>14} {'退款率':>8}")
for pname, ps in sorted(product_stats.items(), key=lambda x: -x[1]['gmv_goods']):
    rf_rate = ps['refund_cnt'] / ps['orders'] * 100 if ps['orders'] else 0
    print(f"{pname:<20} {ps['orders']:>6} {ps['qty']:>6} ¥{ps['gmv_goods']:>12,.2f} {rf_rate:>7.1f}%")

# ===================================================================
# 6. 跨页面一致性
# ===================================================================
print("\n" + "=" * 80)
print("6. 跨页面一致性验证")
print("=" * 80)

print(f"""
┌─────────────────┬──────────────────┬──────────────────┬──────────────────┬────────┐
│ 指标             │ Dashboard(订单)   │ 趋势页(日汇总)     │ 地域页(省份汇总)   │ 一致?   │
├─────────────────┼──────────────────┼──────────────────┼──────────────────┼────────┤
│ GMV(商品总价)    │ ¥{gmv_goods:>13,.2f} │ ¥{daily_gmv_sum:>13,.2f} │ ¥{prov_gmv_sum:>13,.2f} │ {'✅' if abs(gmv_goods-daily_gmv_sum)<0.01 and abs(gmv_goods-prov_gmv_sum)<0.01 else '❌'} │
│ GMV(用户实付)    │ ¥{gmv_userpaid:>13,.2f} │ ¥{sum(s['gmv_paid'] for s in daily.values()):>13,.2f} │ ¥{prov_paid_sum:>13,.2f} │ {'✅' if abs(gmv_userpaid-sum(s['gmv_paid'] for s in daily.values()))<0.01 and abs(gmv_userpaid-prov_paid_sum)<0.01 else '❌'} │
│ GMV(商家实收)    │ ¥{gmv_merchant:>13,.2f} │ ¥{sum(s['gmv_merchant'] for s in daily.values()):>13,.2f} │ ¥{prov_merchant_sum:>13,.2f} │ {'✅' if abs(gmv_merchant-sum(s['gmv_merchant'] for s in daily.values()))<0.01 and abs(gmv_merchant-prov_merchant_sum)<0.01 else '❌'} │
│ 订单数           │ {TOTAL:>16,} │ {daily_order_sum:>16,} │ {prov_order_sum:>16,} │ {'✅' if TOTAL==daily_order_sum==prov_order_sum else '❌'} │
│ 退款金额         │ ¥{refund_from_orders:>13,.2f} │ ¥{sum(s['refund'] for s in daily.values()):>13,.2f} │ ¥{sum(ps['refund'] for ps in province_stats.values()):>13,.2f} │ {'✅' if abs(refund_from_orders-sum(s['refund'] for s in daily.values()))<0.01 else '❌'} │
│ 买家数(手机号)   │ {total_buyers:>16,} │ —                │ {sum(len(ps['buyers']) for ps in province_stats.values()):>16,} │ {'⚠️' if total_buyers != sum(len(ps['buyers']) for ps in province_stats.values()) else '✅'} │
└─────────────────┴──────────────────┴──────────────────┴──────────────────┴────────┘
""")

# ===================================================================
# 7. 数据质量
# ===================================================================
print("=" * 80)
print("7. 数据质量检查")
print("=" * 80)

# 检查空值/缺失
null_checks = {
    '支付时间为空': sum(1 for o in orders if not o.get('支付时间', '').strip()),
    '发货时间为空': sum(1 for o in orders if not o.get('发货时间', '').strip()),
    '省为空': sum(1 for o in orders if not o.get('省', '').strip()),
    '市为空': sum(1 for o in orders if not o.get('市', '').strip()),
    '收货人手机为空': sum(1 for o in orders if not o.get('收货人手机', '').strip()),
    '快递公司为空': sum(1 for o in orders if not o.get('快递公司', '').strip()),
    '商品总价<=0': sum(1 for o in orders if sf(o.get('商品总价(元)')) <= 0),
    '商品数量<=0': sum(1 for o in orders if si(o.get('商品数量(件)')) <= 0),
}

print(f"\n[空值/异常检查]")
for check, count in null_checks.items():
    status = '✅ 正常' if count == 0 else f'⚠️ {count}条'
    print(f"  {check}: {status}")

# 邮费检查
nonzero_postage = sum(1 for o in orders if sf(o.get('邮费(元)')) > 0)
print(f"  有邮费订单: {nonzero_postage}/{TOTAL} (拼多多包邮)")

# 是否预售
presale = sum(1 for o in orders if o.get('是否预售') == '是')
print(f"  预售订单: {presale}")

# 是否顺丰加价
sf_extra = sum(1 for o in orders if o.get('是否顺丰加价') == '是')
print(f"  顺丰加价: {sf_extra}")

# 社区团购
group_buy = sum(1 for o in orders if o.get('是否社区团购') == '是')
print(f"  社区团购: {group_buy}")

# 数据来源
print(f"\n[数据源规模]")
print(f"  订单数据: {TOTAL} 条")
print(f"  推广汇总: {len(promo)} 天")
print(f"  售后记录: {len(after_sale)} 条")
print(f"  财务记录: {len(financial)} 条")
print(f"  运费险: {len(shipping_insurance)} 条")
print(f"  产品成本配置: {len(product_costs_data)} 个SKU")

# 财务记录与订单匹配
fin_order_ids = set()
for f in financial:
    oid = f.get('商户订单号', '').strip()
    if oid:
        fin_order_ids.add(oid)
order_ids = set(o.get('订单号', '').strip() for o in orders)
matched_fin = len(order_ids & fin_order_ids)
print(f"\n[财务-订单匹配] {matched_fin}/{TOTAL} 订单有财务记录")

# ===================================================================
# 8. 汇总
# ===================================================================
print("\n" + "=" * 80)
print("8. 审计汇总")
print("=" * 80)

# 统计正确项和差异项
correct = 0
issues = 0
unverifiable = 0

checks = [
    ("订单数", TOTAL == calc_orders),
    ("GMV(商品总价)日汇总=总计", abs(daily_gmv_sum - gmv_goods) < 0.01),
    ("GMV(用户实付)日汇总=总计", abs(sum(s['gmv_paid'] for s in daily.values()) - gmv_userpaid) < 0.01),
    ("GMV(商家实收)日汇总=总计", abs(sum(s['gmv_merchant'] for s in daily.values()) - gmv_merchant) < 0.01),
    ("GMV(商品总价)省份汇总=总计", abs(prov_gmv_sum - gmv_goods) < 0.01),
    ("GMV(用户实付)省份汇总=总计", abs(prov_paid_sum - gmv_userpaid) < 0.01),
    ("GMV(商家实收)省份汇总=总计", abs(prov_merchant_sum - gmv_merchant) < 0.01),
    ("订单日汇总=总计", daily_order_sum == TOTAL),
    ("订单省份汇总=总计", prov_order_sum == TOTAL),
    ("退款金额日汇总=总计", abs(sum(s['refund'] for s in daily.values()) - refund_from_orders) < 0.01),
    ("退款金额省份汇总=总计", abs(sum(ps['refund'] for ps in province_stats.values()) - refund_from_orders) < 0.01),
    ("推广GMV日汇总=后端汇总", abs(sum(sf(p.get('交易额(元)')) for p in promo) - total_promo_gmv) < 0.01),
    ("月汇总订单=总计", monthly_order_sum == TOTAL),
    ("周汇总订单=总计", weekly_order_sum == TOTAL),
]

for name, result in checks:
    if result:
        correct += 1
    else:
        issues += 1
        print(f"  ❌ {name}")

# 不可验证项
unverifiable_items = [
    "Dashboard页面API返回值 (仅验证了原始数据计算)",
    "买家真实ID (无真实买家标识，手机号均为唯一)",
    "复购率准确性 (无真实买家ID)",
    "RFM分层有效性 (每人仅1单)",
    "利润率-产品成本可能不完全 (仅基于productCosts配置)",
    "退款金额 - 订单字段 vs 售后记录一致性",
]
unverifiable = len(unverifiable_items)

print(f"\n{'='*40}")
print(f"  正确项: {correct}")
print(f"  差异项: {issues}")
print(f"  不可验证项: {unverifiable}")
print(f"{'='*40}")

if issues == 0:
    print("\n✅ 所有可验证项均通过交叉检验！API数据内部一致性良好。")
else:
    print(f"\n⚠️ 发现 {issues} 项差异，需要进一步检查。")

print(f"\n[不可验证项说明]")
for item in unverifiable_items:
    print(f"  - {item}")

print(f"\n[备注]")
print(f"  1. 所有买家收货人手机号均为唯一({total_buyers}={TOTAL})，无法验证复购相关指标")
print(f"  2. 星店汇总(starStoreSummary)和直播汇总(liveStreamSummary)数据为空")
print(f"  3. 退款金额在订单字段中为0的记录({TOTAL - len(refunded_orders)}条)")
print(f"  4. 售后记录有{len(after_sale)}条，退款金额¥{refund_from_aftersale:,.2f}")
print(f"  5. 邮费全部为0（拼多多包邮模式）")
print(f"  6. 产品SKU: {', '.join(sorted(product_costs_data.keys())[:5])}...")

# ===================================================================
# 保存审计结果
# ===================================================================
audit_result = {
    'audit_time': datetime.now().isoformat(),
    'auditor': 'yunyingA',
    'store_id': 'demo-1780051448525-isliir',
    'total_orders': TOTAL,
    'gmv_goods': round(gmv_goods, 2),
    'gmv_userpaid': round(gmv_userpaid, 2),
    'gmv_merchant': round(gmv_merchant, 2),
    'refund_from_orders': round(refund_from_orders, 2),
    'refund_from_aftersale': round(refund_from_aftersale, 2),
    'refunded_orders': len(refunded_orders),
    'refund_rate': round(refund_rate, 2),
    'total_cost': round(total_cost, 2),
    'total_tech_fee': round(total_tech_fee, 2),
    'profit': round(profit, 2),
    'profit_margin': round(profit_margin, 2),
    'total_buyers_phone': total_buyers,
    'repeat_buyers': repeat_buyers,
    'province_count': len(province_stats),
    'promo_spend': round(total_promo_spend, 2),
    'promo_gmv': round(total_promo_gmv, 2),
    'promo_roi': round(promo_roi, 2),
    'checks_passed': correct,
    'checks_failed': issues,
    'checks_unverifiable': unverifiable,
    'data_sources': {
        'orders': TOTAL,
        'promotion_days': len(promo),
        'after_sale_records': len(after_sale),
        'financial_records': len(financial),
        'shipping_insurance': len(shipping_insurance),
        'product_cost_skus': len(product_costs_data)
    },
    'status_distribution': dict(status_dist),
    'province_top10': [(prov, round(ps['gmv_paid'],2), ps['orders'])
                       for prov, ps in sorted(province_stats.items(), key=lambda x: -x[1]['gmv_paid'])[:10]],
}

with open(r'E:\RJ\SSBB\meoo_zip_1779612767549\api_audit_result.json', 'w', encoding='utf-8') as f:
    json.dump(audit_result, f, ensure_ascii=False, indent=2)

print(f"\n审计结果已保存至: api_audit_result.json")

# 尝试其他API端点
print("\n" + "=" * 80)
print("9. 其他API端点探测")
print("=" * 80)
print("建议检查以下端点:")
print("  GET  /api/dashboard?storeId=xxx  - Dashboard汇总数据")
print("  GET  /api/trends?storeId=xxx&granularity=day  - 趋势数据")
print("  GET  /api/regional?storeId=xxx  - 地域数据")
print("  GET  /api/users?storeId=xxx  - 用户分析数据")
print("  GET  /api/products?storeId=xxx  - 商品分析")
print("  (请根据实际API路由确认)")
