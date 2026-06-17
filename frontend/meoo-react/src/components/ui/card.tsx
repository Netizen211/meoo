/**
 * ============================================================
 *  🃏 Card 卡片组件
 *  ============================================================
 *  
 *  来源：shadcn/ui — github.com/shadcn-ui/ui
 *  
 *  用途：页面中的区块容器，用于分组展示相关内容
 *  组合：Card → CardHeader → CardTitle → CardContent → CardFooter
 *  
 *  ═════════════════════════════════════════════════════════
 *  修改指南：
 *    改所有卡片的圆角      → 修改 Card 的 rounded-lg
 *    改所有卡片的 padding   → 修改 CardContent 的 p-6
 *    改所有卡片边框         → 修改 index.css 中的 .pdd-card 的 border
 *  ═════════════════════════════════════════════════════════
 *  
 *  @example
 *    <Card>
 *      <CardHeader>
 *        <CardTitle>店铺概览</CardTitle>
 *      </CardHeader>
 *      <CardContent>
 *        <p>内容区域</p>
 *      </CardContent>
 *      <CardFooter>
 *        <Button>操作按钮</Button>
 *      </CardFooter>
 *    </Card>
 * ============================================================
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

/** 卡片容器 — 最外层包裹
 *  参考: shadcn/ui (基础样式) + Cruip/Mosaic (hover 抬起效果)
 *  卡片的 border 和 shadow 会根据是否交互自动变化
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-pdd-border bg-pdd-card text-pdd-text shadow-pdd-sm transition-all duration-pdd-normal hover:shadow-pdd-md',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/** 卡片头部 — 放标题+描述+操作按钮 */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

/** 卡片标题 — 放在 CardHeader 里 */
const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

/** 卡片描述 — 放在 CardHeader 里，副标题 */
const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-pdd-text-secondary', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

/** 卡片内容 — 主要展示区域 */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-4', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

/** 卡片底部 — 放操作按钮/提示信息 */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
