import React, { useState, useMemo, useCallback, useRef } from 'react';
import { X, Plus, Edit3, Trash2, Check } from 'lucide-react';
import { type SkuItem, type SkuClass } from '../utils';

interface Props {
  productId: string;
  productName: string;
  allSkus: SkuItem[];
  currentClasses: SkuClass[];
  skuClassMemory: Record<string, string>;
  onSave: (skuClassMemory: Record<string, string>) => void;
  onClose: () => void;
  /** 嵌入模式：不渲染自己的遮罩层和固定定位，适合放在 Drawer/Panel 内部 */
  embedded?: boolean;
}

export default function SkuClassificationManager({
  productId, productName, allSkus, currentClasses,
  skuClassMemory, onSave, onClose, embedded,
}: Props) {
  const [groups, setGroups] = useState<SkuClass[]>(() =>
    currentClasses.map(c => ({ ...c, skus: c.skus.map(s => ({ ...s })) }))
  );
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const assignedSkuIds = useMemo(() => {
    const s = new Set<string>();
    groups.forEach(g => g.skus.forEach(sk => s.add(sk.skuId)));
    return s;
  }, [groups]);

  const unassignedSkus = useMemo(() =>
    allSkus.filter(sk => !assignedSkuIds.has(sk.skuId)),
    [allSkus, assignedSkuIds]
  );

  const moveSku = useCallback((skuId: string, toGroupId: string) => {
    const sku = allSkus.find(s => s.skuId === skuId);
    if (!sku) return;
    setGroups(prev => {
      let ng = prev.map(g => ({ ...g, skus: g.skus.filter(s => s.skuId !== skuId) })).filter(g => g.skus.length > 0);
      return ng.map(g => g.classId === toGroupId ? { ...g, skus: [...g.skus, sku] } : g);
    });
  }, [allSkus]);

  const removeSku = useCallback((groupId: string, skuId: string) => {
    setGroups(prev => prev.map(g => g.classId === groupId ? { ...g, skus: g.skus.filter(s => s.skuId !== skuId) } : g).filter(g => g.skus.length > 0));
  }, []);

  const createGroup = useCallback(() => {
    const name = newGroupName.trim() || '新分类 ' + (groups.length + 1);
    const cid = 'manual_' + productId + '_' + Date.now();
    setGroups(prev => [...prev, { classId: cid, displayName: name, displayPrice: 0, skus: [], strategy: 'manual' }]);
    setNewGroupName('');
    setShowNewGroup(false);
  }, [newGroupName, groups.length, productId]);

  const deleteGroup = useCallback((groupId: string) => setGroups(prev => prev.filter(g => g.classId !== groupId)), []);
  const renameGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g => g.classId === groupId ? { ...g, displayName: editValue.trim() || g.displayName } : g));
    setEditingName(null);
  }, [editValue]);

  const startEdit = useCallback((cid: string, name: string) => {
    setEditingName(cid);
    setEditValue(name);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSave = useCallback(() => {
    const mem = { ...skuClassMemory };
    groups.forEach(g => g.skus.forEach(sk => { mem[sk.skuId + '|' + productId] = g.classId; }));
    const valid = new Set(groups.map(g => g.classId));
    Object.keys(mem).forEach(k => { if (k.endsWith('|' + productId) && !valid.has(mem[k])) delete mem[k]; });
    onSave(mem);
    onClose();
  }, [groups, productId, skuClassMemory, onSave, onClose]);

  // ── 共享的主体内容 ─────────────────────────────
  const bodyContent = (
    <>
      {groups.map(g => (
        <div key={g.classId} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-bold text-gray-800 tabular-nums shrink-0">{'¥'}{(g.displayPrice || g.skus[0]?.price || 0).toFixed(2)}</span>
            {editingName === g.classId ? (
              <div className="flex items-center gap-1 flex-1">
                <input ref={inputRef} value={editValue} onChange={e => setEditValue(e.target.value)}
                  className="flex-1 px-1.5 py-0.5 text-xs border border-gray-300 rounded outline-none focus:border-blue-400"
                  onKeyDown={e => e.key === 'Enter' && renameGroup(g.classId)}
                  onBlur={() => renameGroup(g.classId)} />
                <button onMouseDown={() => renameGroup(g.classId)} className="w-5 h-5 flex items-center justify-center rounded text-green-600 hover:bg-green-50 cursor-pointer border-none bg-transparent"><Check size={11} /></button>
              </div>
            ) : (
              <button onClick={() => startEdit(g.classId, g.displayName)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-gray-600 hover:bg-gray-100 cursor-pointer border-none bg-transparent max-w-[160px]">
                <span className="truncate">{g.displayName}</span>
                <Edit3 size={10} className="text-gray-300 shrink-0" />
              </button>
            )}
            <span className="text-[10px] text-gray-400 ml-auto tabular-nums">{g.skus.length} SKU</span>
            <button onClick={() => deleteGroup(g.classId)} className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 cursor-pointer border-none bg-transparent"><Trash2 size={11} /></button>
          </div>
          <div className="px-3 py-1.5 space-y-1">
            {g.skus.map(sk => (
              <div key={sk.skuId} className="flex items-center gap-2 text-xs text-gray-600 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200 shrink-0" />
                <span className="truncate flex-1">{sk.skuName || '未命名'}</span>
                <span className="text-gray-300 text-[10px] shrink-0">ID {sk.skuId}</span>
                <button onClick={() => removeSku(g.classId, sk.skuId)} className="px-1.5 py-0.5 rounded text-[10px] text-red-300 hover:text-red-500 hover:bg-red-50 cursor-pointer border-none bg-transparent shrink-0">移出</button>
              </div>
            ))}
            <div className="flex items-center gap-1 pt-0.5">
              <span className="text-[10px] text-gray-300">+ 移入</span>
              <select onChange={e => { if (e.target.value) { moveSku(e.target.value, g.classId); e.target.value = ''; } }} value="" className="flex-1 text-[10px] px-1 py-0.5 border border-gray-200 rounded text-gray-500 outline-none bg-transparent">
                <option value="">选择 SKU...</option>
                {unassignedSkus.map(sk => (<option key={sk.skuId} value={sk.skuId}>{sk.skuName || '未命名'} (ID:{sk.skuId})</option>))}
              </select>
            </div>
          </div>
        </div>
      ))}
      {showNewGroup ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-3">
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="输入分类名称（可选）" className="w-full px-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400 mb-2" onKeyDown={e => e.key === 'Enter' && createGroup()} autoFocus />
          <div className="flex items-center gap-2">
            <button onClick={createGroup} className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer border-none">创建</button>
            <button onClick={() => setShowNewGroup(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer border-none bg-transparent">取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowNewGroup(true)} className="flex items-center justify-center gap-1 w-full py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 cursor-pointer bg-transparent transition-colors">
          <Plus size={12} />新建分类
        </button>
      )}
      {unassignedSkus.length > 0 && (
        <div className="border border-yellow-200 rounded-lg bg-yellow-50/50 overflow-hidden">
          <div className="px-3 py-1.5 bg-yellow-50 border-b border-yellow-100 text-[11px] font-medium text-yellow-600">未分配 SKU（{unassignedSkus.length} 个）</div>
          <div className="px-3 py-1.5 space-y-1">
            {unassignedSkus.map(sk => (
              <div key={sk.skuId} className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shrink-0" />
                <span className="truncate flex-1">{sk.skuName || '未命名'}</span>
                <span className="text-gray-300 text-[10px]">ID {sk.skuId}</span>
                <select onChange={e => { if (e.target.value) moveSku(sk.skuId, e.target.value); }} value="" className="text-[10px] px-1 py-0.5 border border-yellow-200 rounded text-gray-500 outline-none bg-white">
                  <option value="">归入...</option>
                  {groups.map(g => (<option key={g.classId} value={g.classId}>{g.displayName} ({'¥'}{(g.displayPrice || g.skus[0]?.price || 0).toFixed(0)})</option>))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">{bodyContent}</div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-gray-500 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer bg-transparent">取消</button>
          <button onClick={handleSave} className="px-5 py-1.5 text-xs text-white bg-blue-500 rounded hover:bg-blue-600 cursor-pointer border-none">保存分类</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[420px] max-w-full bg-white border-l border-gray-200 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-800 truncate">SKU 分类管理</h2>
            <p className="text-[11px] text-gray-400 truncate">{productName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 cursor-pointer text-gray-400 border-none bg-transparent"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">{bodyContent}</div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-gray-500 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer bg-transparent">取消</button>
          <button onClick={handleSave} className="px-5 py-1.5 text-xs text-white bg-blue-500 rounded hover:bg-blue-600 cursor-pointer border-none">保存分类</button>
        </div>
      </div>
    </div>
  );
}
