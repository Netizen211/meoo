import { db } from '../db';
import { DATA_CATEGORIES, type DataCategory, type StoreDataItem, type StoreAvailableFields, type UploadRecord } from '../shared-types';

// ===== 店铺数据存储 =====

export async function saveStoreData(
  storeId: string,
  category: DataCategory,
  payloadJson: string,
  rowCount: number
): Promise<void> {
  await db('store_data')
    .insert({
      store_id: storeId,
      category,
      payload_json: payloadJson,
      row_count: rowCount,
    })
    .onConflict(['store_id', 'category'] as any)
    .merge({
      payload_json: payloadJson,
      row_count: rowCount,
      updated_at: db.fn.now(),
    });
}

export async function loadStoreData(storeId: string): Promise<StoreDataItem | null> {
  const rows = await db('store_data').where('store_id', storeId);

  const data: any = {
    orders: [],
    promotionSummary: [],
    promotionProducts: [],
    starStoreSummary: [],
    liveStreamSummary: [],
    shippingInsurance: [],
    afterSaleRecords: [],
    financialRecords: [],
  };

  for (const row of rows) {
    try {
      data[row.category] = JSON.parse(row.payload_json);
    } catch {
      data[row.category] = [];
    }
  }

  return data as StoreDataItem;
}

export async function deleteStoreData(storeId: string): Promise<void> {
  await db('store_data').where('store_id', storeId).del();
  await db('store_configs').where('store_id', storeId).del();
  await db('store_available_fields').where('store_id', storeId).del();
}

// ===== 店铺配置存储 =====

export async function saveStoreConfig(storeId: string, configKey: string, payloadJson: string): Promise<void> {
  await db('store_configs')
    .insert({
      store_id: storeId,
      config_key: configKey,
      payload_json: payloadJson,
    })
    .onConflict(['store_id', 'config_key'] as any)
    .merge({
      payload_json: payloadJson,
      updated_at: db.fn.now(),
    });
}

export async function loadStoreConfigs(storeId: string): Promise<Record<string, any>> {
  const rows = await db('store_configs').where('store_id', storeId);
  const configs: Record<string, any> = {};
  for (const row of rows) {
    try {
      configs[row.config_key] = JSON.parse(row.payload_json);
    } catch {
      configs[row.config_key] = row.payload_json;
    }
  }
  return configs;
}

// ===== 可用字段存储 =====

export async function saveAvailableFields(
  storeId: string,
  availableFields: StoreAvailableFields
): Promise<void> {
  const sources: Array<{ source: string; fields: string[] }> = [
    { source: 'csv', fields: availableFields.csv },
    { source: 'promotion', fields: availableFields.promotion },
    { source: 'insurance', fields: availableFields.insurance },
    { source: 'afterSale', fields: availableFields.afterSale },
  ];

  for (const { source, fields } of sources) {
    await db('store_available_fields')
      .insert({
        store_id: storeId,
        field_source: source,
        fields_json: JSON.stringify(fields),
      })
      .onConflict(['store_id', 'field_source'] as any)
      .merge({ fields_json: JSON.stringify(fields) });
  }
}

export async function loadAvailableFields(storeId: string): Promise<StoreAvailableFields> {
  const rows = await db('store_available_fields').where('store_id', storeId);
  const result: StoreAvailableFields = { csv: [], promotion: [], insurance: [], afterSale: [] };
  for (const row of rows) {
    try {
      (result as any)[row.field_source] = JSON.parse(row.fields_json);
    } catch {}
  }
  return result;
}

// ===== 上传记录 =====

export async function saveUploadRecords(storeId: string, userId: string, records: UploadRecord[]): Promise<void> {
  for (const record of records) {
    await db('upload_records')
      .insert({
        id: record.id,
        user_id: userId,
        store_id: storeId,
        store_name: record.storeName,
        file_name: record.fileName,
        file_type: record.fileType,
        row_count: record.rowCount,
        field_count: record.fieldCount,
        uploaded_at: record.uploadedAt,
      })
      .onConflict('id')
      .merge({
        store_name: record.storeName,
        row_count: record.rowCount,
        field_count: record.fieldCount,
      });
  }
}

export async function loadUploadRecords(storeId: string): Promise<UploadRecord[]> {
  const rows = await db('upload_records').where('store_id', storeId).orderBy('uploaded_at', 'desc');
  return rows.map((r: any) => ({
    id: r.id,
    fileName: r.file_name,
    fileType: r.file_type,
    storeId: r.store_id,
    storeName: r.store_name,
    uploadedAt: r.uploaded_at,
    rowCount: r.row_count,
    fieldCount: r.field_count,
  }));
}

// ===== 存储统计（用于 Admin） =====

export async function getStorageStats(): Promise<{
  totalUsers: number;
  totalStores: number;
  totalRecords: number;
  storageBytes: number;
}> {
  const userCount = await db('users').count('* as count').first();
  const storeCount = await db('stores').count('* as count').first();
  const dataRows = await db('store_data')
    .select(db.raw('SUM(row_count) as total_rows, SUM(LENGTH(payload_json)) as total_bytes'))
    .first();

  return {
    totalUsers: (userCount as any)?.count || 0,
    totalStores: (storeCount as any)?.count || 0,
    totalRecords: dataRows?.total_rows || 0,
    storageBytes: dataRows?.total_bytes || 0,
  };
}
