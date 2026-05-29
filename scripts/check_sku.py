import json, urllib.request

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

# Check SKU fields in first 3 orders
print("=== SKU fields in orders ===")
sku_fields = set()
for x in o[:5]:
    for k in sorted(x.keys()):
        kl = k.lower()
        if any(w in kl for w in ['sku', '编码', '规格id', 'style', 'spec']):
            sku_fields.add(k)
            print("  " + k + ": " + str(x[k])[:50])
print("\nAll SKU-related fields:", sku_fields)

# Check cost configs
print("\n=== Cost configs ===")
cfgs = d['data'].get('configs', {})
for k, v in cfgs.items():
    if 'cost' in k.lower() or 'product' in k.lower():
        if isinstance(v, str):
            parsed = json.loads(v)
            keys = list(parsed.keys())
            print(k + ": " + str(keys[:5]) + " ... total " + str(len(keys)))
        else:
            print(k + ": " + str(v)[:100])

# Count orders per SKU field
print("\n=== SKU dimension value samples ===")
for field in ['商家编码-SKU维度', '规格id', '商品规格', 'SKU编码', 'sku_code']:
    vals = set()
    for x in o:
        v = str(x.get(field, '')).strip()
        if v: vals.add(v)
    print(field + ": " + str(len(vals)) + " unique values: " + str(sorted(vals)[:5]))
