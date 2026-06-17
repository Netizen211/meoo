/**
 * ============================================================
 *  ⌨️ Command 命令面板组件（⌘K 搜索）
 *  ============================================================
 *
 *  底层：cmdk — github.com/pacocoursey/cmdk
 *  来源：shadcn/ui
 *  作用：全局键盘搜索、命令面板、快速导航
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 基础命令面板
 *    <Command>
 *      <CommandInput placeholder="搜索功能..." />
 *      <CommandList>
 *        <CommandEmpty>没有找到结果</CommandEmpty>
 *        <CommandGroup heading="页面">
 *          <CommandItem onSelect={() => navigate('/dashboard')}>
 *            <LayoutDashboard className="mr-2" />
 *            数据中心
 *          </CommandItem>
 *          <CommandItem onSelect={() => navigate('/products')}>
 *            <Package className="mr-2" />
 *            商品分析
 *          </CommandItem>
 *        </CommandGroup>
 *        <CommandSeparator />
 *        <CommandGroup heading="操作">
 *          <CommandItem onSelect={() => toast('刷新完成')}>
 *            <RefreshCw className="mr-2" />
 *            刷新数据
 *          </CommandItem>
 *        </CommandGroup>
 *      </CommandList>
 *    </Command>
 *
 *    // 对话框模式
 *    <CommandDialog open={open} onOpenChange={setOpen}>
 *      <CommandInput placeholder="输入命令..." />
 *      <CommandList>
 *        ...
 *      </CommandList>
 *    </CommandDialog>
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 自动过滤：输入文字自动筛选匹配项
 *    - 键盘导航：↑↓ 选择，Enter 确认，ESC 关闭
 *    - 分组显示：通过 CommandGroup 分组
 *    - 对话框模式：通过 CommandDialog 全屏展示
 */

import * as React from 'react';
import { type DialogProps } from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '../../lib/utils';
import { Dialog, DialogContent } from './dialog';

// ===== 命令面板根容器 =====
const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md bg-pdd-card text-pdd-text',
      className
    )}
    {...props}
  />
));
Command.displayName = 'Command';

// ===== 对话框模式 =====
interface CommandDialogProps extends DialogProps {}

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-pdd-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-pdd-text-secondary [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

// ===== 输入框 =====
const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-pdd-border px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-pdd-text-secondary disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = 'CommandInput';

// ===== 列表容器 =====
const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)}
    {...props}
  />
));
CommandList.displayName = 'CommandList';

// ===== 空状态 =====
const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm text-pdd-text-secondary"
    {...props}
  />
));
CommandEmpty.displayName = 'CommandEmpty';

// ===== 分组 =====
const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-pdd-text [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-pdd-text-secondary',
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = 'CommandGroup';

// ===== 分隔线 =====
const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 h-px bg-pdd-border', className)}
    {...props}
  />
));
CommandSeparator.displayName = 'CommandSeparator';

// ===== 列表项 =====
const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'aria-selected:bg-pdd-gray-100 aria-selected:text-pdd-text',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className
    )}
    {...props}
  />
));
CommandItem.displayName = 'CommandItem';

// ===== 加载状态 =====
const CommandLoading = CommandPrimitive.Loading;

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandLoading,
};
