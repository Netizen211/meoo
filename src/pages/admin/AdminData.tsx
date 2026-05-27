import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, HardDrive } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

interface StoreDataStat {
  storeId: string;
  storeName: string;
  ownerName: string;
  totalRows: number;
  categories: number;
  lastUpload: string;
}

export default function AdminData() {
  const [stats, setStats] = useState<StoreDataStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getDataStats().then(res => {
      if (res.success) setStats(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-pdd-text-secondary">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-pdd-text-primary">数据监控</h2>

      {stats.length === 0 ? (
        <div className="text-pdd-text-secondary text-sm">暂无店铺数据</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pdd-border text-pdd-text-secondary">
                <th className="text-left py-3 px-2">店铺名称</th>
                <th className="text-left py-3 px-2">所属用户</th>
                <th className="text-left py-3 px-2">数据类别</th>
                <th className="text-left py-3 px-2">总行数</th>
                <th className="text-left py-3 px-2">最近上传</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.storeId} className="border-b border-pdd-border/30">
                  <td className="py-3 px-2 text-pdd-text-primary font-medium">{s.storeName}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary">{s.ownerName}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary">{s.categories} 类</td>
                  <td className="py-3 px-2 text-pdd-text-secondary">{s.totalRows.toLocaleString()} 行</td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">
                    {s.lastUpload ? new Date(s.lastUpload).toLocaleDateString('zh-CN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
