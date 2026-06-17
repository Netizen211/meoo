import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, ChevronRight, Clock } from 'lucide-react';
import { apiClient } from '../../../api/client';

interface Report {
  id: string;
  name: string;
  title: string;
  size: number;
  updatedAt: string;
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/admin/reports');
        if (res.success && res.data) {
          setReports(res.data);
          if (res.data.length > 0) {
            setActiveReport(res.data[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load reports', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeReport) return;
    (async () => {
      try {
        // 使用 fetch 获取原始 HTML
        const baseUrl = apiClient.getBaseUrl();
        const token = localStorage.getItem('dianfx_jwt_tokens');
        let accessToken = '';
        if (token) {
          try { accessToken = JSON.parse(token).accessToken || ''; } catch {}
        }
        const res = await fetch(baseUrl + '/admin/reports/' + activeReport, {
          headers: { 'Authorization': 'Bearer ' + accessToken },
        });
        if (res.ok) {
          setHtmlContent(await res.text());
        }
      } catch (e) {
        console.error('Failed to load report content', e);
      }
    })();
  }, [activeReport]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--pdd-border)', borderTopColor: 'var(--pdd-primary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--pdd-text)' }}>UI设计报告</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--pdd-text-secondary)' }}>数据中心UI可配置化分析 · 可行性评估</p>
        </div>
        {activeReport && (
          <a href={apiClient.getBaseUrl() + '/admin/reports/' + activeReport} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ color: 'var(--pdd-primary)', borderColor: 'var(--pdd-primary)' }}>
            <ExternalLink size={12} /> 新标签打开
          </a>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 text-xs" style={{ color: 'var(--pdd-gray-400)' }}>
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          暂无报告
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 space-y-1">
            {reports.map(r => (
              <button key={r.id} onClick={() => setActiveReport(r.id)}
                className={"w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors " + (
                  activeReport === r.id
                    ? 'bg-pdd-primary/10 text-pdd-primary font-medium'
                    : 'hover:bg-pdd-bg/80'
                )}
                style={{ color: activeReport === r.id ? undefined : 'var(--pdd-text-secondary)' }}>
                <div className="flex items-center gap-2">
                  <FileText size={14} />
                  <span className="flex-1 truncate">{r.title}</span>
                  <ChevronRight size={12} className="opacity-40" />
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: 'var(--pdd-gray-400)' }}>
                  <Clock size={10} />
                  <span>{new Date(r.updatedAt).toLocaleDateString('zh-CN')}</span>
                  <span>{formatSize(r.size)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Report content */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border shadow-sm overflow-hidden"
            style={{ borderColor: 'var(--pdd-border)' }}>
            {htmlContent ? (
              <iframe srcDoc={htmlContent} className="w-full border-none" style={{ height: 'calc(100vh - 200px)' }}
                title="报告内容" />
            ) : (
              <div className="flex items-center justify-center h-64 text-xs" style={{ color: 'var(--pdd-gray-400)' }}>
                加载中...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
