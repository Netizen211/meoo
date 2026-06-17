/**
 * ============================================================
 *  🏷 Badge 徽章/标签组件
 *  ============================================================
 *  
 *  来源：shadcn/ui — github.com/shadcn-ui/ui
 *  
 *  用途：状态标记、分类标签、角标提示
 *  
 *  ═════════════════════════════════════════════════════════
 *  变体说明：
 *    default    → 蓝色主标签（最常见）
 *    secondary  → 灰色辅助标签
 *    destructive→ 红色警告标签（退款/亏损）
 *    outline    → 白色边框标签（轻量展示）
 *    success    → 绿色成功标签（✅ 已对账/已配置）
 *    warning    → 黄色警告标签（⚠️ 待同步/需关注）
 *  ═════════════════════════════════════════════════════════
 *  
 *  @example
 *    // 蓝色标签（默认）
 *    <Badge>已配置</Badge>
 *    
 *    // 成功状态（绿色）
 *    <Badge variant="success">✅ 已对账</Badge>
 *    
 *    // 警告状态（黄色）  
 *    <Badge variant="warning">⚠️ 待同步</Badge>
 *    
 *    // 危险状态（红色）
 *    <Badge variant="destructive">亏损</Badge>
 *    
 *    // 自定义标签色（覆盖默认变体色）
 *    <Badge className="bg-purple-100 text-purple-700 border-purple-200">推广</Badge>
 * ============================================================
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-pdd-primary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:      'border-transparent bg-pdd-primary text-white shadow',
        secondary:    'border-transparent bg-pdd-gray-100 text-pdd-text-secondary',
        destructive:  'border-transparent bg-pdd-danger text-white shadow',
        outline:      'text-pdd-text border-pdd-border',
        /** 成功状态（绿色）— 用于已对账/已配置/正常状态 */
        success:      'border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        /** 警告状态（黄色）— 用于待同步/需关注/估算数据 */
        warning:      'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
