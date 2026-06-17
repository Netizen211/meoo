import React, { useState, useEffect, useRef } from 'react';
import { Upload, Save, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/client';

interface QrItem { id: string; name: string; type: string; imageData: string; enabled: boolean; plan?: string; }

export default function QrUpload() {
  const [list, setList] = useState<QrItem[]>([]);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get('/admin/qrcodes').then(res => {
      if (res.success && Array.isArray(res.data)) setList(res.data);
    }).catch(() => {});
  }, []);

  const addItem = () => {
    const item: QrItem = { id: Date.now().toString(), name: '', type: 'wechat', imageData: '', enabled: true };
    setList(prev => [...prev, item]);
    setActiveIdx(list.length);
  };

  const updateItem = (idx: number, updates: Partial<QrItem>) => {
    setList(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const removeItem = (idx: number) => { setList(prev => prev.filter((_, i) => i !== idx)); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeIdx == null) return;
    const reader = new FileReader();
    reader.onload = () => { updateItem(activeIdx, { imageData: reader.result as string }); };
    reader.readAsDataURL(file);
  };

  const saveAll = async () => {
    await apiClient.post('/admin/qrcodes', { list });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={addItem} className="flex items-center gap-2 px-4 py-2 border border-pdd-border rounded-lg text-sm hover:bg-pdd-bg"><Plus size={14} /> 添加收款码</button>
        <button onClick={saveAll} className="flex items-center gap-2 px-4 py-2 bg-pdd-primary text-white rounded-lg text-sm"><Save size={14} /> 保存全部</button>
        {saved && <span className="text-pdd-success text-xs">已保存</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {list.map((item, idx) => (
        <div key={item.id} className="flex items-start gap-3 p-3 border border-pdd-border rounded-lg">
          {item.imageData && <img src={item.imageData} alt={item.name} className="w-16 h-16 rounded border object-cover shrink-0" />}
          <div className="flex-1 grid grid-cols-3 gap-2">
            <input className="px-2 py-1 border border-pdd-border rounded text-xs bg-pdd-bg" value={item.name}
              onChange={e => updateItem(idx, { name: e.target.value })} placeholder="名称" />
            <select className="px-2 py-1 border border-pdd-border rounded text-xs bg-pdd-bg" value={item.type}
              onChange={e => updateItem(idx, { type: e.target.value })}>
              <option value="wechat">微信</option><option value="alipay">支付宝</option><option value="bank">银行转账</option>
            </select>
            <select className="px-2 py-1 border border-pdd-border rounded text-xs bg-pdd-bg" value={item.plan || ''}
              onChange={e => updateItem(idx, { plan: e.target.value })}>
              <option value="">全部套餐</option><option value="pro">全功能会员</option><option value="enterprise">企业版</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={item.enabled} onChange={e => updateItem(idx, { enabled: e.target.checked })} className="w-3 h-3" /> 启用
              </label>
              <button onClick={() => { setActiveIdx(idx); fileRef.current?.click(); }} className="text-xs text-pdd-primary hover:underline">上传图片</button>
              <button onClick={() => removeItem(idx)} className="text-pdd-text-secondary hover:text-pdd-danger"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
