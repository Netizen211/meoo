/**
 * ============================================================
 *  📊 Progress 进度条组件
 *  ============================================================
 *
 *  底层：@radix-ui/react-progress — 支持 ARIA 进度条语义
 *  来源：shadcn/ui
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 基础进度条
 *    <Progress value={45} />
 *
 *    // 带标签
 *    <div className="flex items-center gap-2">
 *      <Progress value={75} className="flex-1" />
 *      <span className="text-sm text-pdd-text-secondary">75%</span>
 *    </div>
 *
 *    // 不同颜色
 *    <Progress value={100} className="[&>div]:bg-pdd-success" />
 *    <Progress value={30} className="[&>div]:bg-pdd-warning" />
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 默认蓝色进度条
 *    - 通过 [&>div]:bg-xxx 可以自定义进度条颜色
 *    - value 范围 0-100，超出自动裁剪
 *    - 0 时隐藏填充，100 时满格
 */

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/utils';

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** 进度值 0-100 */
  value?: number;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, ...props }, ref) => {
  // 确保 value 在 0-100 范围内
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-pdd-gray-200',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-pdd-primary transition-all duration-pdd-normal"
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = 'Progress';

export { Progress };
export type { ProgressProps };
