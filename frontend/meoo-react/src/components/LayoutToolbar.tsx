import React from 'react';
import { Edit3, Save, RotateCcw, X } from 'lucide-react';

interface Props {
  editMode: boolean;
  onToggle: () => void;
  onSave: () => void;
  onReset: () => void;
  loading?: boolean;
}

export default function LayoutToolbar({ editMode, onToggle, onSave, onReset, loading }: Props) {
  return (
    <div className="flex items-center gap-2">
      {!editMode ? (
        <button onClick={onToggle}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-pdd-border rounded text-xs text-pdd-text-secondary hover:border-pdd-primary hover:text-pdd-primary transition-colors">
          <Edit3 size={12} /> 编辑布局
        </button>
      ) : (
        <>
          <button onClick={onSave} disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-pdd-primary text-white rounded text-xs hover:opacity-90">
            <Save size={12} /> 保存
          </button>
          <button onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-pdd-border rounded text-xs text-pdd-text-secondary hover:border-pdd-primary">
            <RotateCcw size={12} /> 恢复
          </button>
          <button onClick={onToggle}
            className="flex items-center gap-1 px-2 py-1.5 text-pdd-text-secondary hover:text-pdd-danger text-xs">
            <X size={12} /> 退出
          </button>
        </>
      )}
    </div>
  );
}
