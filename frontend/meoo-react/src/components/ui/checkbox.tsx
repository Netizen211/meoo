/**
 * Checkbox 复选框组件
 * 底层：@radix-ui/react-checkbox
 * 用于多选/对比勾选/表单选项
 *
 * @example
 *   // 基础复选框
 *   <Checkbox checked={isChecked} onCheckedChange={setChecked} />
 *
 *   // 带标签
 *   <div className="flex items-center gap-2">
 *     <Checkbox id="compare" />
 *     <Label htmlFor="compare">对比此商品</Label>
 *   </div>
 */

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-pdd-primary ring-offset-pdd-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pdd-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-pdd-primary data-[state=checked]:text-white',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
