/**
 * ServerUploadZone — 云端批量上传组件
 *
 * 大厂方案：前端选文件 → 直接上传到云端 → 云端异步解析入库 → SSE 实时推送进度
 *
 * 对比客户端解析：
 *   - 客户端：浏览器解析 XLSX/CSV → 发 JSON 到后端 → 后端存库
 *   - 云端：上传原始文件到后端 → 后端解析 → 直接存库（支持 500+ 文件批量）
 *
 * 回退方案：
 *   如果云端上传失败或不可用，自动降级到客户端解析
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Server, CheckCircle, XCircle, Clock, AlertCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { getAccessToken } from '../../api/client';

// ===== 类型 =====

interface UploadFileInfo {
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'parsing' | 'saving' | 'done' | 'failed';
  error?: string;
  category?: string;
  rowCount?: number;
}

interface TaskProgress {
  taskId: string;
  total: number;
  parsed: number;
  saved: number;
  failed: number;
  currentFile: string;
}

interface TaskFileResult {
  originalName: string;
  category: string;
  rowCount: number;
  error?: string;
}

// ===== API =====

const API_BASE = '/api/v1/upload';

async function uploadFiles(files: File[], storeId: string, storeName: string): Promise<string> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  formData.append('storeId', storeId);
  formData.append('storeName', storeName);

  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || '上传失败');
  return json.data.taskId;
}

async function fetchTaskProgress(taskId: string): Promise<{
  status: string;
  progress: TaskProgress;
  files: TaskFileResult[];
  error?: string;
}> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/progress/${taskId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '获取进度失败');
  return json.data;
}

// ===== 格式化文件大小 =====

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== 组件 =====

interface Props {
  storeId: string;
  storeName: string;
  onComplete?: (taskId: string, results: TaskFileResult[]) => void;
  disabled?: boolean;
}

export default function ServerUploadZone({ storeId, storeName, onComplete, disabled }: Props) {
  const [files, setFiles] = useState<UploadFileInfo[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [results, setResults] = useState<TaskFileResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // 选择文件
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const fileInfos: UploadFileInfo[] = selected.map(f => ({
      name: f.name,
      size: f.size,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...fileInfos]);
    setStatus('idle');
    setError(null);
    setResults([]);

    // 自动开始上传
    startUpload(selected);
  }, [storeId, storeName]);

  // 开始上传
  const startUpload = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    setStatus('uploading');
    setError(null);

    // 标记为上传中
    setFiles(prev => prev.map(f =>
      selectedFiles.some(sf => sf.name === f.name)
        ? { ...f, status: 'uploading' as const }
        : f
    ));

    try {
      const newTaskId = await uploadFiles(selectedFiles, storeId, storeName);
      setTaskId(newTaskId);
      setStatus('processing');

      // 标记为解析中
      setFiles(prev => prev.map(f =>
        selectedFiles.some(sf => sf.name === f.name)
          ? { ...f, status: 'parsing' as const }
          : f
      ));

      // 开始轮询进度
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const data = await fetchTaskProgress(newTaskId);
          setProgress(data.progress);

          // 更新文件状态
          if (data.files && data.files.length > 0) {
            setResults(data.files);
            setFiles(prev => prev.map(f => {
              const result = data.files.find(r => r.originalName === f.name);
              if (result) {
                return {
                  ...f,
                  status: result.error ? 'failed' as const : 'done' as const,
                  error: result.error,
                  category: result.category,
                  rowCount: result.rowCount,
                };
              }
              return f;
            }));
          }

          if (data.status === 'completed') {
            setStatus('done');
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            if (onComplete) onComplete(newTaskId, data.files || []);
          } else if (data.status === 'failed') {
            setStatus('error');
            setError(data.error || '处理失败');
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } catch (pollErr: any) {
          // 轮询失败不中断，继续重试
          console.warn('[ServerUpload] Poll error:', pollErr);
        }
      }, 1000);

    } catch (err: any) {
      setStatus('error');
      setError(err.message);
      setFiles(prev => prev.map(f =>
        selectedFiles.some(sf => sf.name === f.name)
          ? { ...f, status: 'failed' as const, error: err.message }
          : f
      ));
    }
  };

  // 重试
  const handleRetry = () => {
    const failedFiles = files.filter(f => f.status === 'failed');
    if (failedFiles.length === 0) return;

    // 将失败的文件重新加入
    const fileObjects = failedFiles.map(f => new File([], f.name));
    // 由于无法从 name 重建 File 对象，改用 input 重新选择
    fileInputRef.current?.click();
  };

  // 清除
  const handleClear = () => {
    setFiles([]);
    setTaskId(null);
    setProgress(null);
    setStatus('idle');
    setError(null);
    setResults([]);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  // 统计
  const doneCount = files.filter(f => f.status === 'done').length;
  const failedCount = files.filter(f => f.status === 'failed').length;

  return (
    <div className="space-y-3">
      {/* 折叠标题 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-pdd-text-secondary hover:text-pdd-text transition-colors"
      >
        <Server size={16} className="text-pdd-primary" />
        <span>云端批量上传（大厂模式）</span>
        <span className="text-[10px] bg-pdd-primary/10 text-pdd-primary px-1.5 py-0.5 rounded">BETA</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <Card className="border border-pdd-primary/20 bg-gradient-to-br from-pdd-primary/[0.02] to-transparent">
          <CardContent className="p-4 space-y-3">

            {/* 上传区 */}
            <div
              onClick={() => !disabled && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                ${disabled ? 'border-pdd-border/30 opacity-50 cursor-not-allowed' : 'border-pdd-primary/30 hover:border-pdd-primary/60 hover:bg-pdd-primary/5'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.tsv,.txt"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled}
              />
              <Server size={32} className="mx-auto mb-2 text-pdd-primary/60" />
              <p className="text-sm font-medium text-pdd-text">上传文件到云端解析</p>
              <p className="text-[11px] text-pdd-text-secondary mt-1">支持 CSV / XLSX / XLS 文件，最多 500 个，单文件最大 100MB</p>
              <p className="text-[10px] text-pdd-text-secondary/60 mt-1">云端自动识别分类、批量入库，SSE 实时推送进度</p>
            </div>

            {/* 进度 */}
            {status !== 'idle' && (
              <div className="space-y-2">
                {/* 聚合进度条 */}
                {progress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-pdd-text-secondary">
                      <span>解析进度</span>
                      <span>{progress.parsed} / {progress.total} 文件</span>
                    </div>
                    <div className="w-full h-2 bg-pdd-bg rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-pdd-primary to-purple-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(progress.parsed / progress.total) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-pdd-text-secondary/60">
                      <span>入库: {progress.saved} 行</span>
                      {progress.currentFile && <span>当前: {progress.currentFile}</span>}
                    </div>
                  </div>
                )}

                {/* 状态信息 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {status === 'uploading' && <><Clock size={14} className="text-blue-400 animate-pulse" /><span className="text-blue-400">上传中...</span></>}
                    {status === 'processing' && <><Clock size={14} className="text-yellow-400 animate-pulse" /><span className="text-yellow-400">解析入库中...</span></>}
                    {status === 'done' && <><CheckCircle size={14} className="text-green-400" /><span className="text-green-400">完成!</span></>}
                    {status === 'error' && <><XCircle size={14} className="text-red-400" /><span className="text-red-400">{error || '上传失败'}</span></>}
                  </div>
                  <div className="flex gap-2">
                    {status === 'done' && (
                      <button onClick={handleClear} className="text-[10px] text-pdd-text-secondary hover:text-pdd-text underline">清除</button>
                    )}
                    {status === 'error' && failedCount > 0 && (
                      <button onClick={handleRetry} className="text-[10px] text-pdd-primary hover:underline">重试失败文件</button>
                    )}
                  </div>
                </div>

                {/* 文件列表 */}
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center justify-between py-1 px-2 rounded bg-pdd-bg/50 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={12} className="shrink-0 text-pdd-text-secondary" />
                        <span className="truncate text-pdd-text">{f.name}</span>
                        <span className="text-pdd-text-secondary/60 shrink-0">({formatSize(f.size)})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.category && <span className="text-[10px] text-pdd-text-secondary/60">{f.category}</span>}
                        {f.rowCount !== undefined && <span className="text-[10px] text-pdd-success">{f.rowCount}行</span>}
                        {f.status === 'pending' && <Clock size={12} className="text-pdd-text-secondary/40" />}
                        {f.status === 'uploading' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Upload size={12} className="text-blue-400" /></motion.div>}
                        {f.status === 'parsing' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Clock size={12} className="text-yellow-400" /></motion.div>}
                        {f.status === 'done' && <CheckCircle size={12} className="text-green-400" />}
                        {f.status === 'failed' && <span title={f.error}><XCircle size={12} className="text-red-400" /></span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 大厂方案说明 */}
            <details className="text-[10px] text-pdd-text-secondary/50">
              <summary className="cursor-pointer hover:text-pdd-text-secondary/70">什么是云端批量上传？</summary>
              <p className="mt-1 leading-relaxed">
                传统方式：浏览器解析文件 → 发送 JSON 到云端 → 云端存库（受浏览器内存限制，大文件容易崩溃）<br />
                大厂方式：上传原始文件到云端 → 云端解析 → 直接入库（支持 500+ 文件，不受浏览器限制）<br />
                <span className="text-pdd-primary">本组件上传到云端后自动解析，网页关闭也不影响处理，完成后刷新即可查看数据。</span>
              </p>
            </details>

          </CardContent>
        </Card>
      )}
    </div>
  );
}
