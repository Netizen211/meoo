export function findField(row: any, ...keywords: string[]): any {
  if (!row || typeof row !== 'object') return undefined;
  const keys = Object.keys(row);
  for (const kw of keywords) {
    const kwClean = kw.toLowerCase().replace(/[\s\-_\(\)（）\[\]【】]/g, '');
    for (const k of keys) {
      const kClean = k.replace(/[﻿ \t\r\n\s\-_\(\)（）\[\]【】]/g, '').toLowerCase();
      if (kClean === kwClean) return row[k];
    }
    for (const k of keys) {
      const kClean = k.replace(/[﻿ \t\r\n\s\-_\(\)（）\[\]【】]/g, '').toLowerCase();
      if (kClean.includes(kwClean)) return row[k];
    }
  }
  return undefined;
}

export function sf(v: any): number {
  if (v == null) return 0;
  const s = String(v).trim().replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function ss(v: any): string {
  return String(v || '').trim();
}

export function hoursDiff(a: string, b: string): number {
  const da = new Date(a), db = new Date(b);
  return (da.getTime() - db.getTime()) / 3600000;
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

export function exportCSV(headers: string[], rows: any[][], filename: string) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}