/**
 * ============================================================
 *  🦴 Skeleton 加载骨架屏组件
 *  ============================================================
 *
 *  来源：shadcn/ui — github.com/shadcn-ui/ui
 *  作用：数据加载时显示灰色占位动画，提升用户体验
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 基础用法
 *    <Skeleton className="h-4 w-[250px]" />
 *
 *    // 卡片骨架
 *    <Card>
 *      <CardHeader>
 *        <Skeleton className="h-5 w-1/3" />
 *      </CardHeader>
 *      <CardContent>
 *        <Skeleton className="h-4 w-full mb-2" />
 *        <Skeleton className="h-4 w-3/4" />
 *      </CardContent>
 *    </Card>
 *
 *    // 表格行骨架
 *    {Array.from({ length: 5 }).map((_, i) => (
 *      <Skeleton key={i} className="h-10 w-full mb-2" />
 *    ))}
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 使用 animate-pulse 实现呼吸灯效果（Tailwind 内置）
 *    - bg-pdd-gray-200 在暗色模式下自动变为深灰色
 *    - 通过 className 完全控制宽高/形状（圆形/矩形/圆角）
 */

import { cn } from '../../lib/utils';

/**
 * Skeleton 组件
 *
 * @example
 *   // 圆形头像骨架
 *   <Skeleton className="h-10 w-10 rounded-full" />
 *
 *   // 文字行骨架
 *   <Skeleton className="h-4 w-full" />
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-pdd-gray-200',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
