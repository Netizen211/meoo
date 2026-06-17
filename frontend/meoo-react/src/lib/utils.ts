/**
 * ============================================================
 *  🛠 工具函数 — cn() 类名合并工具
 *  ============================================================
 *  
 *  用途：
 *    合并 Tailwind CSS 类名，自动处理冲突（如 bg-red-500 和 bg-blue-500 共存时保留后者）
 *  
 *  来源：
 *    shadcn/ui 标准工具函数 — github.com/shadcn-ui/ui
 *  
 *  用法：
 *    cn('px-4 py-2', isActive && 'bg-blue-500', className)
 *    → 自动合并所有类名，冲突时后者覆盖前者
 *  
 *  为什么不用普通字符串拼接？
 *    Tailwind 的类名可能有冲突，tailwind-merge 会自动解决冲突
 *    例：cn('px-4', 'px-6') → 'px-6'（后者覆盖前者）
 * ============================================================
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind CSS 类名（支持条件、数组、对象多种写法）
 * 
 * @param inputs  - 类名、条件类名、或它们的数组
 * @returns       - 合并后的类名字符串
 * 
 * @example
 *   cn('text-sm', isRed && 'text-red-500', 'px-4')
 *   cn(['text-sm', 'px-4'], { 'text-red-500': isRed })
 *   cn(className)  // 传入外部 className
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
