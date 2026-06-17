/**
 * ============================================================
 *  📋 Sheet 滑出面板组件
 *  ============================================================
 *
 *  底层：@radix-ui/react-dialog（已在依赖中，和 Dialog 共用）
 *  作用：从屏幕右侧滑出一个面板，用于订单详情、商品详情等场景
 *
 *  参考：shadcn/ui Sheet 组件模式
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    <Sheet>
 *      [ 触发按钮 ]
 *      <SheetTrigger asChild>
 *        <Button variant="outline">查看详情</Button>
 *      </SheetTrigger>
 *
 *      [ 滑出面板内容 ]
 *      <SheetContent>
 *        <SheetHeader>
 *          <SheetTitle>订单详情 #2024001</SheetTitle>
 *          <SheetDescription>
 *            订单号：PDD2024001xxxx
 *          </SheetDescription>
 *        </SheetHeader>
 *
 *        [ 正文内容 ]
 *        <div className="py-4">
 *          <p>商品：XXX</p>
 *          <p>金额：¥100.00</p>
 *        </div>
 *
 *        <SheetFooter>
 *          <Button>关闭</Button>
 *        </SheetFooter>
 *      </SheetContent>
 *    </Sheet>
 *  ═════════════════════════════════════════════════════════
 *
 *  变体说明：
 *    side="right"  — 从右侧滑入（默认，适用于订单详情）
 *    side="left"   — 从左侧滑入（适用于菜单）
 *
 *  设计说明：
 *    - 使用 Dialog 的 Portal/Overlay 实现模态背景
 *    - 滑入动画用 translate-x 过渡
 *    - ESC 键关闭 / 点击遮罩关闭（Dialog 内置）
 *    - 焦点锁定在面板内（Dialog 内置）
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ===== Sheet 根容器 =====
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;
const SheetOverlay = DialogPrimitive.Overlay;

// ===== Sheet 内容面板 =====
interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** 滑出方向：right（默认）| left */
  side?: 'left' | 'right';
}

/**
 * SheetContent — 滑出面板主体
 *
 * 支持 side="left" | side="right" 两种方向
 * 带滑入动画 + 关闭按钮
 */
const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPortal>
    {/* 半透明遮罩 */}
    <SheetOverlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out" />

    {/* 滑出面板本体 */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 gap-4 bg-pdd-card p-6 shadow-pdd-xl transition ease-in-out',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        side === 'right' &&
          'inset-y-0 right-0 h-full w-full max-w-md border-l border-pdd-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        side === 'left' &&
          'inset-y-0 left-0 h-full w-full max-w-md border-r border-pdd-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        className
      )}
      {...props}
    >
      {/* 子元素 */}
      {children}

      {/* 关闭按钮（右上角 X） */}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-pdd-primary focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

// ===== Sheet 头部 =====
const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

// ===== Sheet 底部 =====
const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

// ===== Sheet 标题 =====
const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold text-pdd-text',
      className
    )}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

// ===== Sheet 描述 =====
const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      'text-sm text-pdd-text-secondary',
      className
    )}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
export type { SheetContentProps };
