import csv, json, urllib.request, time, openpyxl, sys

BASE = 'http://localhost:3007/api'
sid = 'verify-hongdou-001'
sname = '红豆验证店铺'

req = urllib.request.Request(f'{BASE}/auth/login',
    data=json.dumps({'username':'17516299920','password':'Aa17516299920'}).encode(),
    headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['data']['accessToken']

req = urllib.request.Request(f'{BASE}/stores',
    data=json.dumps({'name':sname,'id':sid}).encode(),
    headers={'Content-Type':'application/json','Authorization':f'Bearer {token}'})
try: urllib.request.urlopen(req)
except: pass

def sf(v):
    try: return float(str(v).strip() or 0)
    except: return 0

def make_rows(ws):
    headers = [ws.cell(1,c).value for c in range(1, ws.max_column+1)]
    rows = []
    for r in range(2, ws.max_row+1):
        row = {}
        for c in range(1, ws.max_column+1):
            val = ws.cell(r,c).value
            if val is not None:
                row[headers[c-1]] = val
        rows.append(row)
    return rows

def sync_data(data_type, rows):
    data = {'orders': [], 'promotionSummary': [], 'promotionProducts': [], 'starStoreSummary': [], 'liveStreamSummary': [], 'shippingInsurance': [], 'afterSaleRecords': [], 'financialRecords': []}
    data[data_type] = rows
    payload = json.dumps({'storeId':sid,'storeName':sname,'data':data,'configs':{},'uploadRecords':[]}).encode()
    req = urllib.request.Request(f'{BASE}/data/sync', data=payload,
        headers={'Content-Type':'application/json','Authorization':f'Bearer {token}'})
    resp = urllib.request.urlopen(req)
    r = json.loads(resp.read())
    st = r.get('data',{}).get('mergeStats',{}).get(data_type,{})
    print(f'  {data_type}: added={st.get("added",0)} skipped={st.get("skipped",0)} total={st.get("total",0)}')
    return r.get('success')

# Promotion Summary
wb = openpyxl.load_workbook('/tmp/商品推广_分天数据_20260222至20260522.xlsx')
ws = wb[wb.sheetnames[0]]
promo_summary = make_rows(ws)
pc = sum(sf(r.get('成交花费(元)',0)) for r in promo_summary)
pg = sum(sf(r.get('交易额(元)',0)) for r in promo_summary)
po = sum(int(sf(r.get('成交笔数',0))) for r in promo_summary)
pi = sum(int(sf(r.get('曝光量',0))) for r in promo_summary)
pcl = sum(int(sf(r.get('点击量',0))) for r in promo_summary)
print(f'Promo Summary: {len(promo_summary)} days, cost={pc:.2f} gmv={pg:.2f} orders={po} impr={pi} clicks={pcl}')
sync_data('promotionSummary', promo_summary)

# Promotion Products
ws2 = wb[wb.sheetnames[1]]
promo_products = make_rows(ws2)
seen = set()
deduped = []
for r in promo_products:
    key = str(r.get('日期','')) + '|' + str(r.get('商品ID','')) + '|' + str(r.get('推广名称',''))
    if key not in seen:
        seen.add(key)
        deduped.append(r)
print(f'Promo Products: {len(promo_products)} total, {len(deduped)} deduped')
sync_data('promotionProducts', deduped)

# Star Store
wb2 = openpyxl.load_workbook('/tmp/明星店铺_分天数据_20260222至20260522.xlsx')
star = make_rows(wb2[wb2.sheetnames[0]])
sc = sum(sf(r.get('花费(元)',0)) or sf(r.get('总花费(元)',0)) for r in star)
print(f'Star Store: {len(star)} days, cost={sc:.2f}')
sync_data('starStoreSummary', star)

# Live Stream
wb3 = openpyxl.load_workbook('/tmp/直播推广_分天数据_20260222至20260522.xlsx')
live = make_rows(wb3[wb3.sheetnames[0]])
lc = sum(sf(r.get('总花费(元)',0)) or sf(r.get('花费(元)',0)) for r in live)
print(f'Live Stream: {len(live)} days, cost={lc:.2f}')
sync_data('liveStreamSummary', live)

# After Sale
wb4 = openpyxl.load_workbook('/tmp/售后数据.xlsx')
aftersale = make_rows(wb4[wb4.sheetnames[0]])
PROHIBITED = ['收货人','收货人姓名','收件人','收货人手机','收货人电话','手机号','买家手机','收货地址','详细地址','街道/镇','街道','镇','区','买家留言','商家备注']
as_clean = [{k:v for k,v in r.items() if k not in PROHIBITED} for r in aftersale]
print(f'Aftersale: {len(aftersale)} rows')
if aftersale:
    ar = sum(sf(r.get('退款金额(元)',0)) or sf(r.get('买家退款金额',0)) for r in aftersale)
    print(f'  CSV refund={ar:.2f}')
sync_data('afterSaleRecords', as_clean)

# Insurance
wb5 = openpyxl.load_workbook('/tmp/运费险.xlsx')
ins = make_rows(wb5[wb5.sheetnames[0]])
print(f'Insurance: {len(ins)} rows')
if ins:
    inf = sum(sf(r.get('服务费用(元)',0)) or sf(r.get('服务费用（元）',0)) or sf(r.get('保费',0)) for r in ins)
    print(f'  CSV fee={inf:.2f}')
sync_data('shippingInsurance', ins)

# Financial
with open('/tmp/pdd-mall-bill-detail(wqggim03gw74jno17)_2026-05-26-15-58-27_8160.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    fin = list(reader)
print(f'Financial: {len(fin)} rows')
if fin:
    inc = sum(sf(r.get('收入金额（+元）',0)) or sf(r.get('收入金额(+元)',0)) for r in fin)
    exp = sum(sf(r.get('支出金额（-元）',0)) or sf(r.get('支出金额(-元)',0)) for r in fin)
    pen = sum(abs(sf(r.get('支出金额（-元）',0)) or sf(r.get('支出金额(-元)',0)) or 0) for r in fin if str(r.get('业务描述','') or '').startswith('004'))
    print(f'  CSV income={inc:.2f} expense={exp:.2f} penalties(004)={pen:.2f}')
sync_data('financialRecords', fin)

print()
print('Waiting for cache...')
time.sleep(2)

# VERIFY
req = urllib.request.Request(f'{BASE}/analytics/bulk?storeId={sid}&force=1',
    headers={'Authorization':f'Bearer {token}'})
resp = urllib.request.urlopen(req)
bulk = json.loads(resp.read())
kpi = bulk.get('data',{}).get('dashboard',{}).get('kpi',{})
promo = bulk.get('data',{}).get('promotion',{})
asrv = bulk.get('data',{}).get('afterSale',{})
fin_data = bulk.get('data',{}).get('financial',{})

print()
print('='*64)
print('  FULL VERIFICATION')
print('='*64)
print(f'  ORDERS:  GMV={kpi.get("gmv",0):.2f} Rev={kpi.get("revenue",0):.2f} Ord={kpi.get("orders",0)}')
ps = promo.get('summary',{})
print(f'  PROMO:   Cost={ps.get("cost",0):.2f} vs CSV={pc:.2f} OK={abs(pc-ps.get("cost",0))<0.02}')
print(f'           GMV={ps.get("gmv",0):.2f} vs CSV={pg:.2f} OK={abs(pg-ps.get("gmv",0))<0.02}')
print(f'           Orders={ps.get("orders",0)} vs CSV={po} OK={po==ps.get("orders",0)}')
print(f'  DASH:    promoCost={kpi.get("promoCost",0):.2f} promoGMV={kpi.get("promoGMV",0):.2f}')
print(f'           promoROI={kpi.get("promoROI",0):.2f} promoOrders={kpi.get("promoOrders",0)}')
print(f'  AFTER:   total={asrv.get("total",0)} refund={asrv.get("refundAmount",0):.2f}')
print(f'  INS:     fee={kpi.get("insuranceFee",0):.2f}')
print(f'  FIN:     income={fin_data.get("totalIncome",0):.2f} expense={fin_data.get("totalExpense",0):.2f}')
print(f'  PENALTY: {kpi.get("penalties",0):.2f}')
print(f'  PROFIT:  {kpi.get("profit",0):.2f}')
print('='*64)
