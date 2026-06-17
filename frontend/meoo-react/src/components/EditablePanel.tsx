import React, { useState } from 'react';
import { GripVertical, X, Check } from 'lucide-react';

interface Props {
  panelId: string;
  label: string;
  width: string;
  editMode: boolean;
  visible: boolean;
  onRename: (id: string, name: string) => void;
  onWidthChange: (id: string, width: string) => void;
  onToggle: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  children: React.ReactNode;
}

export default function EditablePanel({ panelId, label, width, editMode, visible, onRename, onWidthChange, onToggle, onDragStart, onDragOver, onDrop, children }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);

  if (!visible) return null;

  const saveRename = () => {
    if (name.trim()) onRename(panelId, name.trim());
    setEditing(false);
  };

  return (
    <div className="relative group" draggable={editMode} onDragStart={() => onDragStart(panelId)} onDragOver={onDragOver} onDrop={onDrop}>
      {editMode && (
        <div className="absolute -top-7 left-0 right-0 flex items-center gap-2 px-2 py-0.5 bg-pdd-card border border-pdd-border rounded-t z-10">
          <GripVertical size={14} className="text-pdd-text-secondary cursor-grab" />
          {editing ? (
            <input className="flex-1 text-xs bg-transparent outline-none border-b border-pdd-primary" value={name} onChange={e => setName(e.target.value)} onBlur={saveRename} onKeyDown={e => e.key==='Enter'&&saveRename()} autoFocus />
          ) : (
            <span className="flex-1 text-xs font-medium text-pdd-text cursor-pointer" onDoubleClick={() => setEditing(true)}>{label}</span>
          )}
          <select value={width} onChange={e => onWidthChange(panelId, e.target.value)}
            className="text-[10px] bg-transparent border border-pdd-border rounded px-1 py-0">
            <option value="full">全宽</option>
            <option value="2/3">2/3</option>
            <option value="1/2">1/2</option>
            <option value="1/3">1/3</option>
          </select>
          <button onClick={() => setEditing(!editing)} className="text-pdd-text-secondary hover:text-pdd-primary">
            <Check size={12} />
          </button>
          <button onClick={() => onToggle(panelId)} className="text-pdd-text-secondary hover:text-pdd-danger">
            <X size={12} />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
