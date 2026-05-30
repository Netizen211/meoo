/**
 * 同步状态提示条 — 让用户知道数据正在同步/失败/可操作
 */
import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  status: 'idle' | 'syncing' | 'done' | 'error';
}

export default function SyncStatusBar({ status }: Props) {
  const navigate = useNavigate();

  // 同步完成后3秒自动消失
  if (status === 'idle') return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2 transition-all duration-300 ${
      status === 'syncing' ? 'bg-blue-500 text-white' :
      status === 'done' ? 'bg-green-500 text-white animate-pulse' :
      'bg-red-500 text-white'
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
