#!/usr/bin/env python
"""解析演示CSV数据并同步到API"""
import json, csv, urllib.request, ssl, sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Login first
print("Logging in...")
login_req = urllib.request.Request(
    'https://melody.wang/api/auth/login',
    data=json.dumps({"username":"yunyingA","password":"123456"}).encode('utf-8'),
    method='POST',
    headers={'Content-Type': 'application/json'}
)
login_resp = urllib.request.urlopen(login_req, timeout=15, context=ctx)
login_data = json.loads(login_resp.read().decode('utf-8'))
TOKEN = login_data['data']['accessToken']
print(f"Login OK, token: {TOKEN[:40]}...")

DEMO_STORE_ID = 'store-1780055412115'

# Read CSV
csv_path = r'E:\RJ\SSBB\meoo_zip_1779612767549\demo_orders.csv'
print(f"Reading CSV from {csv_path}...")
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    orders = list(reader)

print(f"Parsed {len(orders)} orders")

# Build sync payload
sync_data = {
    'orders': orders,
    'promotionSummary': [],
    'afterSaleRecords': [],
    'financialRecords': [],
    'shippingInsurance': [],
    'productCosts': [{'costs': {}}],
    'starStoreSummary': [],
    'liveStreamSummary': []
}

payload = {
    'storeId': DEMO_STORE_ID,
    'storeName': '演示店铺(可删除)',
    'clientUpdatedAt': '2026-05-29T11:00:00.000Z',
    'data': sync_data,
    'configs': {},
    'uploadRecords': [{
        'fileName': 'demo_orders.csv',
        'type': 'orders',
        'uploadedAt': '2026-05-29T11:00:00.000Z',
        'recordCount': len(orders)
    }]
}

print(f"Sending sync payload ({len(json.dumps(payload))} bytes)...")
req = urllib.request.Request(
    'https://melody.wang/api/data/sync',
    data=json.dumps(payload).encode('utf-8'),
    method='POST',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {TOKEN}'
    }
)

try:
    resp = urllib.request.urlopen(req, timeout=120, context=ctx)
    result = json.loads(resp.read().decode('utf-8'))
    print(f"Sync result: success={result.get('success')}")
    if result.get('error'):
        print(f"Error: {result['error']}")
    if result.get('data'):
        print(f"Data: {json.dumps(result['data'], ensure_ascii=False)[:300]}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8', errors='replace')[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Verify data pull
print("\nVerifying data pull...")
pull_req = urllib.request.Request(
    'https://melody.wang/api/data/pull',
    data=json.dumps({'storeId': DEMO_STORE_ID}).encode('utf-8'),
    method='POST',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {TOKEN}'
    }
)
try:
    pull_resp = urllib.request.urlopen(pull_req, timeout=30, context=ctx)
    pull_data = json.loads(pull_resp.read().decode('utf-8'))
    orders_count = len(pull_data.get('data', {}).get('data', {}).get('orders', []))
    print(f"Pull result: {orders_count} orders in store")
except Exception as e:
    print(f"Pull error: {e}")
