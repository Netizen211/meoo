"""
全站数据审计脚本 — 计算网页上每一个可能显示的数字的基准值
运营可对照此清单逐一排查
"""
import json, urllib.request, sys, os
from collections import defaultdict

def api(path, data=None, token=None):
    url = 'http://localhost:3007' + path
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers)
    return json.loads(urllib.request.urlopen(req).read())

# Login
login = api('/api/auth/login', {'username': 'demo888', 'password': '123456'})
token = login['data']['accessToken']

# Get store with data
stores = api('/api/stores', token=token)
sid = None
for s in stores['data']:
    # Try each store until we find one with data
    r = api('/api/data/pull', {'storeId': s['id']}, token)
    if r['data']['data']:
        sid = s['id']
        break

if not sid:
    print("No store with data found!")
    sys.exit(1)

d = api('/api/data/pull', {'storeId': sid}, token=token)
sd = d['data']['data']
o = sd.get('orders', [])
p = sd.get('promotionProducts', [])
a = sd.get('afterSaleRecords', [])
ins = sd.get('shippingInsurance', [])
fin = sd.get('financialRecords', [])
psum = sd.get('promotionSummary', [])
cfgs = d['data'].get('configs', {})

def sv(arr, key):
    return sum(float(x.get(key, 0) or 0) for x in arr)
def cnt(arr, key, cond=None):
    if cond:
        return len([x for x in arr if cond(str(x.get(key, '')))])
    return len([x for x in arr if x.get(key) is not None and str(x.get(key, '')).strip()])

# Cost config
costs_str = cfgs.get(f'dianfx_product_costs_{sid}', '{}')
if isinstance(costs_str, str):
    productCosts = json.loads(costs_str)
else:
    productCosts = costs_str

cost_config = cfgs.get(f'dianfx_cost_configs_{sid}', {})
if isinstance(cost_config, str):
    cost_config = json.loads(cost_config)
pkg_fee = cost_config.get('packagingFeePerOrder', 1.5)
ship_fee = cost_config.get('shippingFeePerOrder', 3.0)
commission_rate = cost_config.get('platformCommissionRate', 0.6) / 100
insurance_fee = cost_config.get('insuranceFeePerOrder', 1.0)
default_ratio = cost_config.get('defaultCostRatio', 30) / 100

# ===== 按商品聚合 =====
products = defaultdict(lambda: {'orders': [], 'gmv': 0, 'revenue': 0, 'refund': 0, 'refund_count': 0, 'qty': 0, 'order_count': 0, 'names': set()})
for x in o:
    pid = str(x.get('商品ID', x.get('商品id', '')))
    products[pid]['orders'].append(x)
    products[pid]['gmv'] += float(x.get('商品总价(元)', 0) or 0)
    products[pid]['revenue'] += float(x.get('商家实收金额(元)', 0) or 0)
    products[pid]['refund'] += float(x.get('退款金额(元)', 0) or 0)
    products[pid]['qty'] += int(float(x.get('商品数量(件)', 1) or 1))
    products[pid]['order_count'] += 1
    products[pid]['names'].add(str(x.get('商品名称', '')))

# 推广按商品
promo_by_pid = defaultdict(lambda: {'cost': 0, 'gmv': 0, 'orders': 0, 'imp': 0, 'click': 0})
for x in p:
    pid = str(x.get('商品ID', ''))
    promo_by_pid[pid]['cost'] += float(x.get('总花费(元)', 0) or 0)
    promo_by_pid[pid]['gmv'] += float(x.get('交易额(元)', 0) or 0)
    promo_by_pid[pid]['orders'] += float(x.get('成交笔数', 0) or 0)
    promo_by_pid[pid]['imp'] += float(x.get('曝光量', 0) or 0)
    promo_by_pid[pid]['click'] += float(x.get('点击量', 0) or 0)

# 售后按商品
as_by_pid = defaultdict(lambda: {'count': 0, 'amount': 0})
for x in a:
    pid = str(x.get('商品ID', x.get('商品id', '')))
    as_by_pid[pid]['count'] += 1
    as_by_pid[pid]['amount'] += float(x.get('退款金额(元)', 0) or 0)

print("=" * 70)
print("  全站数据审计基准清单")
print("  Store:", sid)
print("=" * 70)

# ===================================================================
# 1. 数据中心 Dashboard KPI
# ===================================================================
print("\n" + "=" * 50)
print("  1. 数据中心 Dashboard — 每个KPI卡片的基准值")
print("=" * 50)

total_gmv = sv(o, '商品总价(元)')
total_revenue = sv(o, '商家实收金额(元)')
total_paid = sv(o, '用户实付金额(元)')
total_refund = sv(o, '退款金额(元)')
total_qty = sum(int(float(x.get('商品数量(件)', 1) or 1)) for x in o)
total_orders = len(o)
refund_orders = len([x for x in o if float(x.get('退款金额(元)', 0) or 0) > 0])
total_discount = sv(o, '店铺优惠折扣(元)') + sv(o, '平台优惠折扣(元)') + sv(o, '多多支付立减金额(元)')
total_platform = sv(o, '平台技术服务费(元)')
total_promo_cost = sv(p, '总花费(元)')
total_promo_gmv = sv(p, '交易额(元)')
total_promo_orders = sum(float(x.get('成交笔数', 0) or 0) for x in p)
total_as = len(a)
total_ins_fee = sv(ins, '服务费用（元)')
fin_penalties = sum(float(x.get('支出金额（-元)', x.get('支出金额(元)', 0)) or 0) for x in fin if str(x.get('业务描述', '')).startswith('004'))

# 快递统计
has_tracking = len([x for x in o if str(x.get('快递单号', '')).strip()])
no_tracking = len(o) - has_tracking

# 买家
phones = set()
for x in o:
    ph = str(x.get('收货人手机', '')).strip()
    if ph: phones.add(ph)

# 商品
unique_products = len(set(str(x.get('商品ID', x.get('商品id', ''))) for x in o))
unique_skus = len(set(str(x.get('商家编码-SKU维度', x.get('规格编码', ''))) for x in o))

# 自然单/利润率
organic_orders = max(0, total_orders - int(total_promo_orders))
organic_gmv = max(0, total_gmv - total_promo_gmv)
profit = total_revenue - total_refund - total_promo_cost - total_platform - total_ins_fee - fin_penalties
profit_rate = (profit / total_revenue * 100) if total_revenue > 0 else 0
promo_ratio = (total_promo_cost / total_gmv * 100) if total_gmv > 0 else 0
avg_order = total_revenue / total_orders if total_orders > 0 else 0
as_rate = (total_as / total_orders * 100) if total_orders > 0 else 0
rf_rate = (refund_orders / total_orders * 100) if total_orders > 0 else 0
promo_roi = total_promo_gmv / total_promo_cost if total_promo_cost > 0 else 0
ctr = sv(p, '点击量') / max(1, sv(p, '曝光量')) * 100
cvr = total_promo_orders / max(1, sv(p, '点击量')) * 100

# 发货时长
ship_hours = []
for x in o:
    pay = str(x.get('支付时间', '')).strip()
    ship = str(x.get('发货时间', '')).strip()
    if pay and ship:
        try:
            from datetime import datetime
            pt = datetime.strptime(pay[:19], '%Y-%m-%d %H:%M:%S')
            st = datetime.strptime(ship[:19], '%Y-%m-%d %H:%M:%S')
            h = (st - pt).total_seconds() / 3600
            if 0 <= h <= 720:
                ship_hours.append(h)
        except:
            pass
avg_ship = sum(ship_hours) / len(ship_hours) if ship_hours else 0

kpis = [
    ('GMV(商品总价)', f'¥{total_gmv:,.2f}'),
    ('有效订单量', f'{total_orders}'),
    ('用户实付', f'¥{total_paid:,.2f}'),
    ('商家实收', f'¥{total_revenue:,.2f}'),
    ('客单价', f'¥{avg_order:,.2f}'),
    ('售后率', f'{as_rate:.1f}%'),
    ('退款率', f'{rf_rate:.1f}%'),
    ('退款金额', f'¥{total_refund:,.2f}'),
    ('买家数(手机)', f'{len(phones)}'),
    ('商品数', f'{unique_products}'),
    ('优惠总额', f'¥{total_discount:,.2f}'),
    ('利润金额', f'¥{profit:,.2f}'),
    ('利润率', f'{profit_rate:.1f}%'),
    ('平均发货时长', f'{avg_ship:.1f}h'),
    ('罚款金额', f'¥{fin_penalties:,.2f}'),
    ('推广花费', f'¥{total_promo_cost:,.2f}'),
    ('推广GMV', f'¥{total_promo_gmv:,.2f}'),
    ('推广ROI', f'{promo_roi:.2f}'),
    ('推广占比', f'{promo_ratio:.1f}%'),
    ('全店投产', f'{total_gmv/max(1,total_promo_cost):.2f}'),
    ('自然单', f'{organic_orders}'),
    ('自然GMV', f'¥{organic_gmv:,.2f}'),
    ('CTR', f'{ctr:.2f}%'),
    ('CVR', f'{cvr:.2f}%'),
]
for label, val in kpis:
    print(f"  {label}: {val}")

# 状态分布
print("\n  订单状态分布:")
st = defaultdict(int)
for x in o:
    st[str(x.get('订单状态', ''))] += 1
for k, v in sorted(st.items(), key=lambda x: -x[1]):
    print(f"    {k}: {v} ({v/total_orders*100:.1f}%)")

# ===================================================================
# 2. 商品分析 ProductPage — 每个商品的KPI
# ===================================================================
print("\n" + "=" * 50)
print("  2. 商品分析 — 每个商品的KPI")
print("=" * 50)

for pid in sorted(products.keys()):
    pr = products[pid]
    name = list(pr['names'])[0][:20] if pr['names'] else pid
    promo = promo_by_pid.get(pid, {'cost': 0, 'gmv': 0, 'orders': 0})
    as_data = as_by_pid.get(pid, {'count': 0, 'amount': 0})

    # SKU成本
    sku_cost_total = 0
    for x in pr['orders']:
        sid_key = str(x.get('商家编码-SKU维度', x.get('规格编码', '')))
        k = f"{pid}_{sid_key}" if sid_key else pid
        unit_cost = productCosts.get(k, productCosts.get(pid, 0))
        qty = int(float(x.get('商品数量(件)', 1) or 1))
        sku_cost_total += unit_cost * qty

    gmv = pr['gmv']
    rev = pr['revenue']
    orders = pr['order_count']
    refund = pr['refund']
    refund_cnt = pr['refund_count']
    promo_cost = promo['cost']
    promo_gmv = promo['gmv']

    product_profit = rev - sku_cost_total - refund - promo_cost - (rev * commission_rate) - (orders * pkg_fee) - (orders * ship_fee)
    product_profit_rate = (product_profit / rev * 100) if rev > 0 else 0
    product_roi = promo_gmv / promo_cost if promo_cost > 0 else 0
    product_rf_rate = (refund_cnt / orders * 100) if orders > 0 else 0

    print(f"\n  {pid} {name}")
    print(f"    订单: {orders}  销量: {pr['qty']}件")
    print(f"    GMV: ¥{gmv:,.2f}  实收: ¥{rev:,.2f}")
    print(f"    退款: ¥{refund:,.2f}  退款率: {product_rf_rate:.1f}%")
    print(f"    推广花费: ¥{promo_cost:,.2f}  推广ROI: {product_roi:.2f}")
    print(f"    产品利润: ¥{product_profit:,.2f}  利润率: {product_profit_rate:.1f}%")

# ===================================================================
# 3. 商品沉浸分析 — 单商品深度
# ===================================================================
print("\n" + "=" * 50)
print("  3. 沉浸分析 — PD00001 为例")
print("=" * 50)

pid = 'PD00001'
pr = products[pid]
orders_p1 = pr['orders']

# 按SKU分组
sku_map = defaultdict(lambda: {'qty': 0, 'revenue': 0, 'gmv': 0, 'orders': 0})
for x in orders_p1:
    sku = str(x.get('商家编码-SKU维度', x.get('规格编码', '默认')))
    sku_map[sku]['qty'] += int(float(x.get('商品数量(件)', 1) or 1))
    sku_map[sku]['revenue'] += float(x.get('商家实收金额(元)', 0) or 0)
    sku_map[sku]['gmv'] += float(x.get('商品总价(元)', 0) or 0)
    sku_map[sku]['orders'] += 1

print(f"  {list(pr['names'])[0]}")
print(f"  KPI: GMV=¥{pr['gmv']:,.2f} 实收=¥{pr['revenue']:,.2f} 订单={pr['order_count']}")
print(f"  退款=¥{pr['refund']:,.2f} 退款率={pr['refund_count']/max(1,pr['order_count'])*100:.1f}%")

# 推广费
promo_p1 = promo_by_pid.get(pid, {'cost': 0})
print(f"  推广花费(全周期): ¥{promo_p1['cost']:,.2f}")

# 趋势数据 (最近7天逐日)
from datetime import datetime
dates_p1 = sorted(set(str(x.get('支付时间', '')).strip()[:10] for x in orders_p1 if str(x.get('支付时间', '')).strip()))
print(f"\n  日期范围: {dates_p1[0]} ~ {dates_p1[-1]} ({len(dates_p1)}天)")
print(f"  最近7天逐日GMV:")
daily = defaultdict(lambda: {'gmv': 0, 'revenue': 0, 'qty': 0, 'orders': 0})
for x in orders_p1:
    d = str(x.get('支付时间', '')).strip()[:10]
    if d:
        daily[d]['gmv'] += float(x.get('商品总价(元)', 0) or 0)
        daily[d]['revenue'] += float(x.get('商家实收金额(元)', 0) or 0)
        daily[d]['qty'] += int(float(x.get('商品数量(件)', 1) or 1))
        daily[d]['orders'] += 1

for d in dates_p1[-7:]:
    dd = daily[d]
    print(f"    {d}: GMV=¥{dd['gmv']:,.2f} 销量={dd['qty']} 实收=¥{dd['revenue']:,.2f} 订单={dd['orders']}")

# SKU 矩阵
print(f"\n  SKU矩阵 ({len(sku_map)}个SKU):")
for sku, data in sorted(sku_map.items()):
    sku_cost_unit = productCosts.get(f'{pid}_{sku}', productCosts.get(pid, 0))
    sku_total_cost = sku_cost_unit * data['qty']
    sku_profit = data['revenue'] - sku_total_cost
    sku_profit_rate = (sku_profit / data['revenue'] * 100) if data['revenue'] > 0 else 0
    print(f"    {sku}: 销量{data['qty']} 实收¥{data['revenue']:,.2f} 成本¥{sku_cost_unit}/件 利润¥{sku_profit:,.2f} 利润率{sku_profit_rate:.1f}%")

# ===================================================================
# 4. 退款原因
# ===================================================================
print("\n" + "=" * 50)
print("  4. 退款原因分布")
print("=" * 50)
reasons = defaultdict(lambda: {'count': 0, 'amount': 0})
for x in a:
    r = str(x.get('退款原因', x.get('售后原因', '其他')))
    reasons[r]['count'] += 1
    reasons[r]['amount'] += float(x.get('退款金额(元)', 0) or 0)
for r, data in sorted(reasons.items(), key=lambda x: -x[1]['count']):
    print(f"  {r}: {data['count']}笔 ¥{data['amount']:,.2f}")

# ===================================================================
# 5. 财务分类
# ===================================================================
print("\n" + "=" * 50)
print("  5. 财务分类")
print("=" * 50)
fin_cats = defaultdict(lambda: {'count': 0, 'income': 0, 'expense': 0})
for x in fin:
    desc = str(x.get('业务描述', ''))
    cat = desc[:7] if len(desc) >= 3 else desc
    fin_cats[cat]['count'] += 1
    fin_cats[cat]['income'] += float(x.get('收入金额（+元)', x.get('收入金额(元)', 0)) or 0)
    fin_cats[cat]['expense'] += float(x.get('支出金额（-元)', x.get('支出金额(元)', 0)) or 0)
for cat, data in sorted(fin_cats.items(), key=lambda x: -x[1]['count']):
    print(f"  {cat}: {data['count']}条 收入¥{data['income']:,.2f} 支出¥{data['expense']:,.2f}")

# ===================================================================
# 6. 地域TOP10
# ===================================================================
print("\n" + "=" * 50)
print("  6. 地域分析 TOP10省份")
print("=" * 50)
prov_gmv = defaultdict(lambda: {'orders': 0, 'gmv': 0, 'revenue': 0, 'refund': 0, 'buyers': set()})
for x in o:
    pv = str(x.get('省', '')).strip()
    if not pv: continue
    prov_gmv[pv]['orders'] += 1
    prov_gmv[pv]['gmv'] += float(x.get('商品总价(元)', 0) or 0)
    prov_gmv[pv]['revenue'] += float(x.get('商家实收金额(元)', 0) or 0)
    prov_gmv[pv]['refund'] += float(x.get('退款金额(元)', 0) or 0)
    ph = str(x.get('收货人手机', '')).strip()
    if ph: prov_gmv[pv]['buyers'].add(ph)

for i, (pv, data) in enumerate(sorted(prov_gmv.items(), key=lambda x: -x[1]['orders'])[:10]):
    rf = (data['refund'] / data['revenue'] * 100) if data['revenue'] > 0 else 0
    print(f"  {i+1}. {pv}: {data['orders']}单 GMV¥{data['gmv']:,.2f} 买家{len(data['buyers'])} 退款率{rf:.1f}%")

print(f"\n{'='*50}")
print(f"  审计基准清单生成完毕")
print(f"  共生成 {len(kpis)+len(products)*6+len(dates_p1)*4+len(sku_map)*4+len(reasons)*2+len(fin_cats)*2+len(prov_gmv)*4} 个验证点")
print(f"{'='*50}")
