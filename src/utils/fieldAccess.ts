import { findField, sf } from './index';

export { findField };

export function safeField(row: any, ...keywords: string[]): string {
  const v = findField(row, ...keywords);
  return v != null ? String(v).trim() : '';
}

export function safeFieldNum(row: any, ...keywords: string[]): number {
  return sf(findField(row, ...keywords));
}
