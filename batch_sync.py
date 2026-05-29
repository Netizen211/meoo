"""分批次同步演示数据"""
import json, csv, subprocess, os, tempfile

TOKEN = subprocess.run(['curl', '-s', '-X', 'POST', 'https://melody.wang/api/auth/login',
    '-H', 'Content-Type: application/json',
    '-d', '{"username":"yunyingA","password":"123456"}', '--max-time', '10'],
    capture_output=True, text=True).stdout
TOKEN = json.loads(TOKEN)['data']['accessToken']
print(f"Login OK, token: {TOKEN[:40]}...")

STORE_ID = 'store-1780055412115'
CSV_PATH = r'E:\RJ\SSBB\meoo_zip_1779612767549\demo_orders.csv'

with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
    orders = list(csv.DictReader(f))
print(f"Total: {len(orders)} orders")

# Sync in batches of 200
batch_size = 200
success_count = 0
tmp_dir = r'E:\RJ\SSBB\meoo_zip_1779612767549'

for i in range(0, len(orders), batch_size):
    batch = orders[i:i+batch_size]
    extra = {'promotionSummary':[],'afterSaleRecords':[],'financialRecords':[],
             'shippingInsurance':[],'productCosts':[{'costs':{}}],
             'starStoreSummary':[],'liveStreamSummary':[]}
    payload = {
        'storeId': STORE_ID,
        'storeName': 'demo',
        'clientUpdatedAt': '2026-05-29T11:00:00.000Z',
        'data': {'orders': batch, **extra},
        'configs': {},
        'uploadRecords': []
    }

    # Write to temp file
    tmp_file = os.path.join(tmp_dir, f'batch_{i//batch_size}.json')
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)

    batch_num = i // batch_size + 1
    print(f"Batch {batch_num}: {len(batch)} orders, file={os.path.getsize(tmp_file)} bytes...", end=' ', flush=True)

    # Use curl with temp file (use forward slashes for shell)
    result = subprocess.run([
        'bash', '-c',
        f'curl -s -X POST https://melody.wang/api/data/sync '
        f'-H "Authorization: Bearer {TOKEN}" '
        f'-H "Content-Type: application/json" '
        f'-d @/e/RJ/SSBB/meoo_zip_1779612767549/batch_{i//batch_size}.json '
        f'--max-time 60'
    ], capture_output=True, text=True, timeout=90)

    try:
        resp = json.loads(result.stdout.strip())
        ok = resp.get('success', False)
        if ok:
            success_count += len(batch)
            print("OK")
        else:
            print(f"FAIL: {resp.get('error', '?')}")
    except:
        print(f"PARSE_ERR: {result.stdout[:100]}")

    # Cleanup
    try:
        os.remove(tmp_file)
    except:
        pass

print(f"\nTotal synced: {success_count}/{len(orders)}")

# Verify
print("Verifying...")
result = subprocess.run(['bash', '-c',
    f'curl -s -X POST https://melody.wang/api/data/pull '
    f'-H "Authorization: Bearer {TOKEN}" '
    f'-H "Content-Type: application/json" '
    f'-d \'{{"storeId":"{STORE_ID}"}}\' '
    f'--max-time 15'],
    capture_output=True, text=True)

try:
    resp = json.loads(result.stdout.strip())
    data = resp.get('data', {}).get('data', {})
    orders_count = len(data.get('orders', []))
    print(f"Store has {orders_count} orders")
except:
    print(f"Verify error: {result.stdout[:200]}")
