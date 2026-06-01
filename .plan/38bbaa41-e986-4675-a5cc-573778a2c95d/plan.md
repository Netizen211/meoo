# 修复：切换店铺后数据不显示的问题

## 问题根因分析

经过代码审查，发现 **两个关键 bug** 导致切换店铺后第二个店的数据无法显示：

### Bug 1：`StoreDataSync` 组件的 dataFilter 同步逻辑有缺陷

**位置**：`src/App.tsx:543-554`

```tsx
function StoreDataSync() {
  const { currentStore } = useStore();
  const { dataFilter, setDataFilter } = useData();

  useEffect(() => {
    if (currentStore && dataFilter !== 'all' && dataFilter !== currentStore.id) {
      setDataFilter(currentStore.id);
    }
  }, [currentStore?.id, dataFilter, setDataFilter]);

  return null;
}
```

**问题**：当用户从店铺A跳到店铺B上传数据时：
- 用户在店铺A上传完数据后，`dataFilter = store-A-id`
- 用户切换到店铺B，`currentStore.id = store-B-id`
- `StoreDataSync` 检测到 `dataFilter !== currentStore.id`，将 `dataFilter` 更新为 `store-B-id`
- 但此时店铺B还没有数据（刚切换过来），所以 `currentDisplayData` 返回空数据
- **关键缺陷**：条件 `dataFilter !== 'all'` 意味着如果 dataFilter 已经是 'all'，切换店铺不会更新 filter，导致显示的是全部店铺的合并数据而非当前店铺

### Bug 2：`useSyncStoreDataFilter` 函数存在同样问题

**位置**：`src/App.tsx:170-179`

```tsx
function useSyncStoreDataFilter() {
  const { currentStore } = useStore();
  const { dataFilter, setDataFilter } = useData();

  useEffect(() => {
    if (currentStore && dataFilter !== currentStore.id && dataFilter !== 'all') {
      setDataFilter(currentStore.id);
    }
  }, [currentStore, dataFilter, setDataFilter]);
}
```

这个函数虽然定义了但未被使用（`StoreDataSync` 组件替代了它），逻辑同样有缺陷。

### Bug 3：`StoresPage` 中 `handleSelect` 的时序问题

**位置**：`src/pages/StoresPage.tsx:22-26`

```tsx
const handleSelect = (id: string) => {
  switchStore(id);
  setDataFilter(id);
  setTimeout(() => navigate('/upload'), 0);
};
```

`switchStore` 和 `setDataFilter` 是同步调用，但 `switchStore` 内部依赖 `stores` 状态（`useCallback` 闭包），如果 `stores` 还未更新，`setCurrentStore` 可能找不到对应的 store 对象。

### Bug 4：`switchStore` 的闭包陷阱

**位置**：`src/App.tsx:149-151`

```tsx
const switchStore = useCallback((id: string) => {
  setCurrentStore(stores.find(s => s.id === id) || null);
}, [stores]);
```

`switchStore` 依赖 `stores` 作为依赖项，但在 `handleSelect` 中调用时，可能使用的是旧的 `stores` 引用。

## 修复方案

### 修复 1：改进 `StoreDataSync` 逻辑

**文件**：`src/App.tsx`

将 `StoreDataSync` 的逻辑改为：**当切换店铺时，始终将 dataFilter 更新为新店铺的 id**，不再跳过 'all' 状态：

```tsx
function StoreDataSync() {
  const { currentStore } = useStore();
  const { setDataFilter } = useData();

  useEffect(() => {
    if (currentStore) {
      setDataFilter(currentStore.id);
    }
  }, [currentStore?.id, setDataFilter]);

  return null;
}
```

这样当用户切换到店铺B时，dataFilter 会立即更新为店铺B的 id，确保显示店铺B的数据。

### 修复 2：删除未使用的 `useSyncStoreDataFilter`

**文件**：`src/App.tsx`

删除 `useSyncStoreDataFilter` 函数（第170-179行），它未被使用且逻辑有缺陷。

### 修复 3：确保 `switchStore` 不受闭包影响

**文件**：`src/App.tsx`

将 `switchStore` 改为通过 id 直接查找，不依赖 `stores` 闭包：

```tsx
const switchStore = useCallback((id: string) => {
  setStores(currentStores => {
    const found = currentStores.find(s => s.id === id);
    if (found) setCurrentStore(found);
    return currentStores;
  });
}, []);
```

或者更简洁的方式，直接用 `setCurrentStore` 配合 `stores` 的最新值：

```tsx
const switchStore = useCallback((id: string) => {
  setCurrentStore(prev => null); // 先清空触发重渲染
  // 在下一帧用最新 stores 设置
}, []);
```

最佳方案是使用 `useEffect` 监听 stores 变化后自动同步 currentStore：

```tsx
// 在 StoreProvider 中添加
useEffect(() => {
  if (currentStore && !stores.find(s => s.id === currentStore.id)) {
    setCurrentStore(stores[0] || null);
  }
}, [stores, currentStore]);
```

### 修复 4：`StoresPage` handleSelect 确保顺序

**文件**：`src/pages/StoresPage.tsx`

确保 `switchStore` 完成后再导航：

```tsx
const handleSelect = (id: string) => {
  switchStore(id);
  setDataFilter(id);
  navigate('/upload');
};
```

去掉 `setTimeout`，因为 React 状态更新是批处理的，导航会在状态更新后自然触发。

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/App.tsx` | 1. 修复 `StoreDataSync` 逻辑，去掉 `dataFilter !== 'all'` 条件限制 |
| `src/App.tsx` | 2. 删除未使用的 `useSyncStoreDataFilter` 函数 |
| `src/App.tsx` | 3. 改进 `switchStore` 避免闭包陷阱 |
| `src/pages/StoresPage.tsx` | 4. 修复 `handleSelect` 去掉不必要的 setTimeout |

## 验证步骤

1. 创建店铺A，上传数据，确认数据正常显示
2. 切换到店铺B，上传数据，确认店铺B的数据正常显示
3. 切换回店铺A，确认店铺A的数据仍然正常显示
4. 在店铺B查看各分析页面（dashboard、product、user等），确认数据正确
5. 运行 `pnpm run dev` 确保编译无错误