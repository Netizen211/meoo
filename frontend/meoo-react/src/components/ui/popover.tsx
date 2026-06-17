/**
 * ============================================================
 *  💬 Popover 弹出框组件
 *  ============================================================
 *
 *  底层：@radix-ui/react-popover（已在依赖中）
 *  来源：shadcn/ui
 *  作用：点击触发元素后弹出的浮层，用于 DatePicker、下拉菜单等
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    <Popover>
 *      <PopoverTrigger asChild>
 *        <Button>点击打开</Button>
 *      </PopoverTrigger>
 *      <PopoverContent>
 *        <div className="p-4">弹出内容</div>
 *      </PopoverContent>
 *    </Popover>
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 点击外部关闭（默认行为）
 *    - ESC 键关闭
 *    - 自动定位（避免溢出视口）
 *    - 带弹出动画（tailwindcss-animate）
 */

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../../lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border border-pdd-border bg-pdd-card p-4 shadow-pdd-md outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
