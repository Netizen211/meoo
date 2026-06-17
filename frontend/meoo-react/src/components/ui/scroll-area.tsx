/**
 * ============================================================
 *  📜 ScrollArea 统一滚动区域组件
 *  ============================================================
 *
 *  底层：@radix-ui/react-scroll-area
 *  来源：shadcn/ui
 *  作用：统一浏览器滚动条样式，在所有浏览器中保持一致的滚动体验
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 基础用法
 *    <ScrollArea className="h-[400px]">
 *      <div className="p-4">
 *        [ 长内容 ]
 *      </div>
 *    </ScrollArea>
 *
 *    // 横向滚动
 *    <ScrollArea className="w-full">
 *      <div className="flex w-[800px]">
 *        [ 宽内容 ]
 *      </div>
 *    </ScrollArea>
 *
 *    // 隐藏滚动条
 *    <ScrollArea className="h-96 [&>div>div]:hidden">
 *      [ 内容 ]
 *    </ScrollArea>
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 自定义滚动条样式（现代、圆角、半透明）
 *    - 只在 hover 时显示滚动条（Mac 风格）
 *    - 统一了 Firefox/Chrome/Safari 的滚动条表现
 */

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../../lib/utils';

// ===== 滚动区域容器 =====
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    {/* 内容视口 */}
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>

    {/* 垂直滚动条 */}
    <ScrollBar orientation="vertical" />

    {/* 水平滚动条 */}
    <ScrollBar orientation="horizontal" />

    {/* 角落（右下角交汇处） */}
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = 'ScrollArea';

// ===== 滚动条 =====
const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' &&
        'h-full w-2.5 border-l border-l-transparent p-px',
      orientation === 'horizontal' &&
        'h-2.5 border-t border-t-transparent p-px',
      className
    )}
    {...props}
  >
    {/* 滚动滑块 */}
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-pdd-gray-300" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
