# 数据流修复计划 - 店铺数据汇总问题

## 问题分析

用户反馈：全部店铺显示8331条订单，但A店3944条 + B店510条 = 4454条，与8331不符。

**根本原因排查方向：**

1. **数据重复问题** - getAllStoresData 可能存在重复合并
2. **数据过滤问题** - currentDisplayData 计算逻辑可能有误
3. **数据源问题** - storeDataMap 中可能存在脏数据或重复数据
4. **上传逻辑问题** - UploadPage 写入数据时可能写入错误位置

## 修复计划

### 第一步：添加数据诊断工具

在 App.tsx 的 DataProvider 中添加诊断日志：

```typescript
// 在 getAllStoresData 中添加
console.log('[数据诊断] getAllStoresData 调用');
console.log('[数据诊断] storeDataMap keys:', Object.keys(storeDataMap));
Object.entries(storeDataMap).forEach(([storeId, data]) => {
  console.log(`[数据诊断] 店铺 ${storeId}:`, {
    orders: data.orders.length,
    promotionSummary: data.promotionSummary.length,
    promotionProducts: data.promotionProducts.length,
    starStoreSummary: data.starStoreSummary.length,
    liveStreamSummary: data.liveStreamSummary.length,
    shippingInsurance: data.shippingInsurance.length
  });
});
```

### 第二步：检查数据去重逻辑

在 getAllStoresData 中添加订单号去重：

```typescript
const getAllStoresData = useCallback((): StoreDataItem => {
  const allData: StoreDataItem = { ... };
  const seenOrderIds = new Set<string>();
  
  for (const storeData of Object.values(storeDataMap)) {
    // 订单去重
    storeData.orders.forEach(order => {
      const orderId = String(order['订单号'] || '');
      if (orderId && !seenOrderIds.has(orderId)) {
        allData.orders.push(order);
        seenOrderIds.add(orderId);
      }
    });
    // 其他数据类型同样处理...
  }
  return allData;
}, [storeDataMap]);
```

### 第三步：修复 UploadPage 数据写入逻辑

检查 UploadPage.tsx 中的 setStoreData 调用，确保：
1. 使用正确的 targetStoreId
2. 正确合并现有数据而非覆盖
3. 去重逻辑正确

### 第四步：统一数据读取入口

确保所有页面都通过 currentDisplayData 读取数据，而不是直接访问 storeDataMap。

### 第五步：添加数据一致性校验

在 StoresPage 中添加数据校验显示：
- 显示每个店铺的实际数据量
- 显示汇总后的数据量
- 显示差异警告

## 需要修改的文件

1. `src/App.tsx` - DataProvider 中的 getAllStoresData 和 currentDisplayData
2. `src/pages/UploadPage.tsx` - 数据写入逻辑
3. `src/pages/StoresPage.tsx` - 添加数据诊断显示

## 验证步骤

1. 清空 localStorage 重新测试
2. 分别上传两个店铺的数据
3. 检查各店铺数据量是否正确
4. 检查"全部店铺"汇总是否等于各店铺之和
5. 切换店铺时数据是否正确切换