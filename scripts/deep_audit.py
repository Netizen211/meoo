import json, urllib.request
from collections import defaultdict

def api(path, data=None, token=None):
    url = 'http://localhost:3007' + path
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers)
    return json.loads(urllib.request.urlopen(req).read())

login = api('/api/auth/login', {'username': 'demo888', 'password': '123456'})
token = login['data']['accessToken']
d = api('/api/data/pull', {'storeId': 'demo-1779974414869-55m59i'}, token)
sd = d['data']['data']
o = sd.get('orders', [])
a = sd.get('afterSaleRecords', [])
p = sd.get('promotionProducts', [])
psum = sd.get('promotionSummary', [])
fin = sd.get('financialRecords', [])
ins = sd.get('shippingInsurance', [])

def sv(arr, key): return sum(float(x.get(key, 0) or 0) for x in arr)

print("=" * 60)
print("  深度审计")
print("=" * 60)

# 1. 退款率
print("\n--- 1. 各商品退款率 ---")
by_pid = defaultdict(list)
for x in o:
    pid = str(x.get('商品ID', x.get('商品id', '')))
    by_pid[pid].append(x)

for pid, orders in sorted(by_pid.items()):
    refund_rows = 0
    for x in orders:
        st = str(x.get('售后状态', '')).strip()
        if st and '退款' in st:
            refund_rows += 1
    total = len(orders)
    print("  {}: {}/{} = {:.1f}%".format(pid, refund_rows, total, refund_rows/total*100 if total else 0))

# 2. 售后状态字段值
print("\n--- 2. 售后状态值 ---")
as_st = defaultdict(int)
for x in o:
    st = str(x.get('售后状态', '')).strip()
    if st: as_st[st] += 1
for k, v in sorted(as_st.items(), key=lambda x: -x[1]):
    print("  [{}]: {}".format(k, v))

# 3. 售后记录商品ID匹配
print("\n--- 3. 售后vs订单商品ID ---")
as_pids = set(str(x.get('商品ID', x.get('商品id', ''))) for x in a)
order_pids = set(str(x.get('商品ID', x.get('商品id', ''))) for x in o)
print("  售后中有,订单中无:", as_pids - order_pids)

# 4. 退款金额差异
print("\n--- 4. 退款金额 ---")
print("  订单退款: {:.2f}".format(sv(o, '退款金额(元)')))
print("  售后退款: {:.2f}".format(sv(a, '退款金额(元)')))
print("  差异: {:.2f}".format(sv(o, '退款金额(元)') - sv(a, '退款金额(元)')))

# 5. 推广汇总 vs 产品
print("\n--- 5. 推广数据一致性 ---")
psum_cost = sv(psum, '总花费(元)')
pprod_cost = sv(p, '总花费(元)')
print("  汇总: 花费{:.2f} GMV{:.2f}".format(psum_cost, sv(psum, '交易额(元)')))
print("  产品: 花费{:.2f} GMV{:.2f}".format(pprod_cost, sv(p, '交易额(元)')))
print("  差: 花费{:.2f}".format(psum_cost - pprod_cost))

# 6. 财务分类
print("\n--- 6. 财务分类 ---")
fin_cats = defaultdict(lambda: {'c': 0, 'inc': 0, 'exp': 0})
for x in fin:
    desc = str(x.get('业务描述', ''))
    cat = desc[:30]
    fin_cats[cat]['c'] += 1
    fin_cats[cat]['inc'] += float(x.get('收入金额（+元)', x.get('收入金额(元)', 0)) or 0)
    fin_cats[cat]['exp'] += float(x.get('支出金额（-元)', x.get('支出金额(元)', 0)) or 0)
for cat, data in sorted(fin_cats.items(), key=lambda x: -x[1]['c']):
    print("  [{}]: {}条 收{:.2f} 支{:.2f}".format(cat.strip(), data['c'], data['inc'], data['exp']))

# 7. 运费险
print("\n--- 7. 运费险状态 ---")
for k, v in sorted(defaultdict(int, **{str(x.get('理赔状态','')):0 for x in ins}).items()):
    pass
ins_st = defaultdict(int)
for x in ins:
    ins_st[str(x.get('理赔状态', '未理赔'))] += 1
for k, v in sorted(ins_st.items()):
    print("  {}: {}".format(k, v))

# 8. 快递公司分布
print("\n--- 8. 快递公司 ---")
couriers = defaultdict(int)
for x in o:
    c = str(x.get('快递公司', '')).strip()
    if c: couriers[c] += 1
for c, n in sorted(couriers.items(), key=lambda x: -x[1]):
    print("  {}: {}".format(c, n))

# 9. 订单来源
print("\n--- 9. 订单来源 ---")
sources = defaultdict(int)
for x in o:
    src = str(x.get('订单来源', '')).strip()
    if src: sources[src] += 1
for s, n in sorted(sources.items(), key=lambda x: -x[1]):
    print("  {}: {}".format(s, n))

# 10. 是否直播间成交
print("\n--- 10. 直播间成交 ---")
live = defaultdict(int)
for x in o:
    lv = str(x.get('是否直播间成交', '')).strip()
    live[lv or '(空)'] += 1
for k, v in sorted(live.items()):
    print("  {}: {}".format(k, v))

# 11. 百亿补贴/节能补贴
print("\n--- 11. 补贴标记 ---")
subsidy = defaultdict(int)
for x in o:
    s = str(x.get('是否节能补贴', '')).strip()
    subsidy[s or '(空)'] += 1
for k, v in sorted(subsidy.items()):
    print("  {}: {}".format(k, v))

# 12. 支付方式
print("\n--- 12. 支付方式 ---")
pays = defaultdict(int)
for x in o:
    pm = str(x.get('支付方式', '')).strip()
    pays[pm or '(空)'] += 1
for k, v in sorted(pays.items(), key=lambda x: -x[1]):
    print("  {}: {}".format(k, v))

# 13. 运费字段
print("\n--- 13. 邮费分析 ---")
postage_vals = [float(x.get('邮费(元)', 0) or 0) for x in o]
print("  有邮费的订单: {}/{}".format(len([p for p in postage_vals if p > 0]), len(o)))
print("  邮费总计: {:.2f}".format(sum(postage_vals)))

# 14. 优惠构成
print("\n--- 14. 优惠构成 ---")
print("  店铺优惠: {:.2f}".format(sv(o, '店铺优惠折扣(元)')))
print("  平台优惠: {:.2f}".format(sv(o, '平台优惠折扣(元)')))
print("  多多立减: {:.2f}".format(sv(o, '多多支付立减金额(元)')))
print("  拼多多券: {:.2f}".format(sv(o, '拼多多优惠券(元)')))

print("\n" + "=" * 60)
print("  深度审计完毕")
print("=" * 60)
