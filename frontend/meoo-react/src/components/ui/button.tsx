/**
 * ============================================================
 *  🔘 Button 按钮组件
 *  ============================================================
 *  
 *  来源：shadcn/ui — github.com/shadcn-ui/ui
 *  底层：@radix-ui/react-slot（支持 asChild 将按钮行为传递给子元素）
 *  
 *  ═════════════════════════════════════════════════════════
 *  变体 (variant) 说明：
 *    default    → 蓝色主按钮（最常用）
 *    destructive→ 红色危险操作按钮（删除/清空等）
 *    outline    → 白色背景+边框按钮（次要操作）
 *    secondary  → 灰色次要按钮
 *    ghost      → 无边框透明按钮（hover 才显示背景）
 *    link       → 文字链接风格
 *  
 *  尺寸 (size) 说明：
 *    default    → h-10 px-4 py-2（标准大小）
 *    sm         → h-9 px-3（紧凑）
 *    lg         → h-11 px-8（大按钮）
 *    icon       → h-10 w-10（正方形，只放图标）
 *  ═════════════════════════════════════════════════════════
 *  
 *  @example
 *    // 默认蓝色按钮
 *    <Button>上传数据</Button>
 *    
 *    // 危险操作（红色）
 *    <Button variant="destructive">删除店铺</Button>
 *    
 *    // 次要操作（边框）
 *    <Button variant="outline">取消</Button>
 *    
 *    // 图标按钮（正方形）
 *    <Button variant="ghost" size="icon">
 *      <Trash2 size={16} />
 *    </Button>
 *    
 *    // 自定义颜色（覆盖默认样式）
 *    <Button className="bg-purple-500 hover:bg-purple-600">自定义</Button>
 * ============================================================
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * 按钮变体定义（cva = class-variance-authority）
 * 所有样式集中在这里，方便统一修改
 */
const buttonVariants = cva(
  // ★ 所有变体共用的基础样式
  // 参考: shadcn/ui (基础过渡) + Horizon UI (active 反馈) + CoreUI (企业风格)
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-pdd-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pdd-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        // 主按钮: 蓝色背景 + 阴影 + 点击下沉效果
        default:    'bg-pdd-primary text-white shadow-pdd-sm hover:bg-pdd-primary-dark hover:shadow-pdd-md active:scale-[0.97] active:shadow-pdd-xs',
        // 危险按钮: 红色背景
        destructive:'bg-pdd-danger text-white shadow-pdd-sm hover:bg-pdd-danger/90 active:scale-[0.97]',
        // 渐变色按钮: 蓝色渐变 (Horizon UI 风格)
        gradient:   'btn-gradient text-white shadow-pdd-md hover:shadow-pdd-lg active:scale-[0.97] active:shadow-pdd-xs',
        // 边框按钮: 白色 + 边框 + 无背景
        outline:    'border border-pdd-border bg-pdd-card shadow-pdd-xs hover:bg-pdd-gray-100 hover:text-pdd-text active:scale-[0.97]',
        // 次要按钮: 浅灰背景
        secondary:  'bg-pdd-gray-100 text-pdd-text-secondary shadow-pdd-xs hover:bg-pdd-gray-200 hover:text-pdd-text active:scale-[0.97]',
        // 幽灵按钮: 透明背景
        ghost:      'text-pdd-text-secondary hover:bg-pdd-gray-100 hover:text-pdd-text active:scale-[0.97]',
        // 链接按钮: 文字链接
        link:       'text-pdd-primary underline-offset-4 hover:underline active:text-pdd-primary-dark',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-9 rounded-md px-3 text-xs',
        lg:      'h-11 rounded-md px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/** Button 组件 Props 类型定义 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * asChild — 将按钮的行为和样式传递给唯一的子元素
   * 用于需要让 <a> 标签或其他组件表现得像按钮的场景
   * 例：<Button asChild><a href="/dashboard">去数据中心</a></Button>
   */
  asChild?: boolean;
}

/**
 * Button 组件
 * 
 * ⚠️ 修改指南：
 *   - 改所有按钮的基础样式 → 修改 buttonVariants 的基础字符串
 *   - 改某个变体的颜色     → 修改对应 variant 的颜色类
 *   - 改按钮尺寸           → 修改对应 size 的 padding/height
 *   - 新增变体             → 在 variants.variant 里加一项
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
