# 多店数据隔离重构计划

## 根因分析

### 问题根源：`currentDisplayData` 在 `dataFilter='all'` 时合并所有店铺数据

数据流链路：
```
上传文件 → UploadPage 按 currentStore.id 写入 storeDataMap[storeId] ✅ 正确
读取数据 → 各页面通过 currentDisplayData 取数据
           → dataFilter='all' 时调用 getAllStoresData() 合合所有店铺 ❌ 串联根源
           → dataFilter=storeId 时取 storeDataMap[storeId] ✅ 正确
```

**5个串联点：**

1. **`StoreDataSync` (App.tsx:549-557)** — 切换店铺时强制 `setDataFilter(currentStore.id)`，但用户选"全部店铺"会被覆盖
2. **`getAllStoresData` (App.tsx:385-449)** — 合合所有店铺的 orders/promotion/starStore/liveStream/insurance，导致跨店数据混在一起
3. **`currentDisplayData` (App.tsx:451-460)** — `dataFilter='all'` 时返回合并数据，各页面直接使用此数据展示
4. **localStorage `dianfx_data_filter`** — 默认值 `'all'`，新用户首次登录看到所有店铺合并数据
5. **MainLayout 店铺选择器** — 提供"全部店铺"选项，允许用户选择合并模式

## 重构方案

### 核心原则：彻底移除"全部店铺"合并模式，每个页面只展示当前店铺的数据

### 修改清单

#### 1. App.tsx — DataProvider 重构

**改动：**
- 移除 `getAllStoresData` 方法（不再需要合并）
- `currentDisplayData` 改为始终返回当前店铺数据，不再有 `'all'` 模式
- `dataFilter` 类型从 `'all' | string` 改为 `string`（只存店铺ID）
- 移除 `StoreDataSync` 组件（不再需要自动同步，因为 dataFilter 始终等于 currentStore.id）
- `setDataFilter` 保留但只接受店铺ID
- `deleteUploadRecord` 中移除 `dataFilter === record.storeId` 时重置为 'all' 的逻辑

**新的 currentDisplayData 逻辑：**
```typescript
const currentDisplayData = useMemo(() => {
  const storeId = currentStore?.id || dataFilter;
  if (!storeId) return EMPTY_STORE_DATA;
  return storeDataMap[storeId] || EMPTY_STORE_DATA;
}, [dataFilter, storeDataMap, currentStore]);
```

#### 2. App.tsx — StoreDataSync 移除

移除 `StoreDataSync` 组件及其在 App 中的引用。改为在 DataProvider 内部通过 useEffect 自动将 dataFilter 同步为 currentStore.id。

#### 3. MainLayout.tsx — 店铺选择器重构

**改动：**
- 移除"全部店铺"选项
- 店铺选择器只允许选择具体店铺
- 切换店铺时同时更新 `currentStore` 和 `dataFilter`
- 保留店铺下拉菜单UI，但去掉"全部"按钮

#### 4. UploadPage.tsx — 无需改动

上传逻辑已经正确使用 `currentStore.id` 作为 `targetStoreId`，数据按店铺ID存入 `storeDataMap`。

#### 5. StoresPage.tsx — 移除 'all' 相关逻辑

**改动：**
- 删除店铺时 `setDataFilter('all')` 改为切换到剩余的第一个店铺
- 切换店铺时 `setDataFilter(storeId)` 保持不变

#### 6. DataContextType 类型调整

```typescript
interface DataContextType {
  dataFilter: string;  // 移除 'all'，只存店铺ID
  setDataFilter: (filter: string) => void;
  // 移除 getAllStoresData
  currentDisplayData: StoreDataItem;
  // 其余保持不变
}
```

#### 7. localStorage 清理

- `dianfx_data_filter` 默认值改为空字符串或当前店铺ID
- 需要处理旧数据迁移：如果 localStorage 中存的是 'all'，改为当前店铺ID

## 不需要改动的文件

以下页面只通过 `currentDisplayData` 取数据，只要 `currentDisplayData` 正确隔离，这些页面自动正确：
- DashboardPage.tsx
- ProductPage.tsx
- UserPage.tsx
- TrendPage.tsx
- RegionPage.tsx
- LogisticsPage.tsx
- CostPage.tsx
- AfterSalePage.tsx
- InsurancePage.tsx
- PromotionPage.tsx
- RiskPage.tsx
- CostManagementPage.tsx
- ProductLinksPage.tsx

## 验证方案

1. 创建A店和B店两个店铺
2. A店上传订单CSV，B店上传推广XLSX
3. 切换到A店 → 只看到A店的订单数据，看不到B店的推广数据
4. 切换到B店 → 只看到B店的推广数据，看不到A店的订单数据
5. 刷新页面 → 数据隔离仍然正确
6. 删除A店 → B店数据不受影响