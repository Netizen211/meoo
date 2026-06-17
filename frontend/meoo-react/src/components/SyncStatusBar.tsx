/**
 * 同步状态提示条 — 让用户知道数据正在同步/失败/可操作
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  status: 'idle' | 'syncing' | 'done' | 'error';
}

export default function SyncStatusBar({ status }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'syncing' || status === 'error') setVisible(true);
    else if (status === 'done') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    } else setVisible(false);
  }, [status]);

  if (!visible) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-[0_4px_12px_rgba(16,24,40,0.1)] text-sm flex items-center gap-2 transition-all duration-300 ${
      status === 'syncing' ? 'bg-pdd-primary text-white' :
      status === 'done' ? 'bg-pdd-success text-white' :
      'bg-pdd-danger text-white'
    }`}>
      {status === 'syncing' && <><RefreshCw size={14} className="animate-spin" /> 正在同步数据到云端...</>}
      {status === 'done' && <><CheckCircle size={14} /> 同步完成</>}
      {status === 'error' && (
        <>
          <AlertTriangle size={14} />
          <span>同步失败</span>
          <button onClick={() => navigate('/stores')} className="underline flex items-center gap-1 ml-1">
            去店铺页导入<ArrowRight size={12} />
          </button>
        </>
      )}
    </div>
  );
}
