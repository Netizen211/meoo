/**
 * ============================================================
 *  ➖ Separator 分割线组件
 *  ============================================================
 *  
 *  来源：shadcn/ui — github.com/shadcn-ui/ui
 *  底层：@radix-ui/react-separator
 *  
 *  用途：在卡片、弹窗、列表等区块之间画一条分割线
 *  
 *  @example
 *    // 水平分割线（默认）
 *    <Separator />
 *    
 *    // 垂直分割线（用于 Flex 容器内）
 *    <Separator orientation="vertical" />
 * ============================================================
 */

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '../../lib/utils';

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-pdd-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = 'Separator';

export { Separator };
