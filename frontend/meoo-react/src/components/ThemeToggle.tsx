import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

interface ThemeToggleProps {
  /** 紧凑模式：仅显示图标按钮 */
  compact?: boolean;
  /** 是否显示标签文字 */
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, showLabel = false, className = '' }: ThemeToggleProps) {
  const { isDark, toggle } = useDarkMode();

  if (compact) {
    return (
      <button
        onClick={toggle}
        className={'p-2 rounded-lg transition-colors hover:bg-pdd-gray-100 ' + className}
        style={{ color: 'var(--pdd-text-secondary)' }}
        title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:shadow-sm ' + className}
      style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
      <span className="text-xs font-medium">{isDark ? '亮色模式' : '暗色模式'}</span>
      {showLabel && <span className="text-[10px] opacity-60">{isDark ? '切换至亮色' : '切换至暗色'}</span>}
    </button>
  );
}
