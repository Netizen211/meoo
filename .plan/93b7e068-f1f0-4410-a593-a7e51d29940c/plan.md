# 店铺数据隔离与全局数据查看功能规划

## 问题分析

### 当前问题
1. **数据未按店铺隔离**：`parsedData` 存储在全局 `localStorage`，所有店铺共享同一份数据
2. **切换店铺数据不切换**：切换店铺后，显示的仍是之前店铺的数据
3. **缺少"全部店铺"视图**：无法查看所有店铺的汇总数据

### 根本原因
- `DataProvider` 中的 `parsedData` 是全局单例，没有按 `storeId` 区分
- `uploadRecords` 虽然有 `storeId` 字段，但数据本身没有关联

## 解决方案

### 数据结构改造

将全局数据改为按店铺存储：

```typescript
// 新的数据结构
interface StoreData {
  [storeId: string]: {
    orders: any[];
    promotionSummary: any[];
    promotionProducts: any[];
    starStoreSummary: any[];
    liveStreamSummary: any[];
    shippingInsurance: any[];
    availableFields: { csv: Set<string>; promotion: Set<string>; insurance: Set<string> };
  };
}

// 新增"全部"选项
type DataFilter = 'all' | string; // 'all' = 全部店铺, string = 具体店铺ID
```

### 修改文件清单

#### 1. `src/App.tsx` - 核心数据层改造
- 修改 `ParsedData` 接口，支持按店铺存储
- 新增 `dataFilter` 状态（默认 'all'）
- 新增 `getStoreData(storeId)` 方法获取指定店铺数据
- 新增 `getAllStoresData()` 方法获取全部店铺汇总数据
- 修改 `setParsedData` 支持按店铺设置

#### 2. `src/components/MainLayout.tsx` - 店铺选择器改造
- 店铺下拉菜单增加"全部店铺"选项（放在最前面）
- 显示当前选中的是"全部"还是具体店铺
- 切换店铺时同步更新数据筛选

#### 3. `src/pages/UploadPage.tsx` - 上传逻辑改造
- 上传数据时，存储到当前店铺的数据空间
- 保持 `storeId` 关联

#### 4. `src/pages/DashboardPage.tsx` - 数据中心改造
- 根据 `dataFilter` 显示对应店铺或全部数据
- 全部模式下显示各店铺汇总

#### 5. 其他数据展示页面
- `ProductPage.tsx`、`UserPage.tsx`、`TrendPage.tsx` 等
- 都需要根据 `dataFilter` 筛选数据

### 实现步骤

1. **Step 1**: 修改 `App.tsx` 数据结构
   - 重构 `DataContext`，支持按店铺存储
   - 添加 `dataFilter` 状态和切换方法
   - 实现数据迁移逻辑（兼容旧数据）

2. **Step 2**: 修改 `MainLayout.tsx` 店铺选择器
   - 添加"全部店铺"选项
   - 样式优化，区分"全部"和具体店铺

3. **Step 3**: 修改 `UploadPage.tsx`
   - 确保上传数据关联到正确店铺

4. **Step 4**: 修改各数据展示页面
   - 使用筛选后的数据

5. **Step 5**: 测试验证
   - 测试店铺切换
   - 测试全部店铺汇总
   - 测试数据隔离

### 数据迁移策略

为兼容已有数据，需要：
1. 检测旧格式数据（无 storeId 的全局数据）
2. 将旧数据迁移到当前店铺或默认店铺
3. 清理旧格式数据

### UI 设计

店铺选择器样式：
```
┌─────────────────────────┐
│ 🏪 全部店铺            ▼│  <- 默认选项，显示汇总
├─────────────────────────┤
│ 🏪 全部店铺              │  <- 选中状态高亮
│ 📍 A店铺                 │
│ 📍 B店铺                 │
│ 📍 C店铺                 │
│ ─────────────────────── │
│ ➕ 添加店铺              │
└─────────────────────────┘
```

## 预期效果

1. 默认显示"全部店铺"的汇总数据
2. 可选择查看单个店铺的数据
3. 切换店铺时数据正确切换
4. 上传数据自动关联到当前选中店铺