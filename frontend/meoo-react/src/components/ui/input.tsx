/**
 * Input 输入框组件
 * 统一全站输入框样式（搜索框/金额输入/文本输入）
 *
 * @example
 *   // 默认输入框
 *   <Input placeholder="请输入商品ID" />
 *
 *   // 金额输入框
 *   <Input type="number" step="0.01" placeholder="0.00" />
 *
 *   // 带图标（手动布局）
 *   <div className="relative">
 *     <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} />
 *     <Input className="pl-10" placeholder="搜索..." />
 *   </div>
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-pdd-border bg-pdd-card px-3 py-2 text-sm text-pdd-text placeholder:text-pdd-gray-400 focus:outline-none focus:ring-2 focus:ring-pdd-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
