/**
 * ============================================================
 *  🔢 Pagination 分页组件
 *  ============================================================
 *
 *  来源：shadcn/ui
 *  作用：表格/列表的页码导航
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 基础用法
 *    <Pagination>
 *      <PaginationContent>
 *        <PaginationItem>
 *          <PaginationPrevious href="#" />
 *        </PaginationItem>
 *        <PaginationItem>
 *          <PaginationLink href="#" isActive>1</PaginationLink>
 *        </PaginationItem>
 *        <PaginationItem>
 *          <PaginationLink href="#">2</PaginationLink>
 *        </PaginationItem>
 *        <PaginationItem>
 *          <PaginationEllipsis />
 *        </PaginationItem>
 *        <PaginationItem>
 *          <PaginationNext href="#" />
 *        </PaginationItem>
 *      </PaginationContent>
 *    </Pagination>
 *
 *    // 配合 TanStack Table 使用
 *    <Pagination>
 *      <PaginationContent>
 *        <PaginationItem>
 *          <Button
 *            variant="outline"
 *            size="sm"
 *            onClick={() => table.previousPage()}
 *            disabled={!table.getCanPreviousPage()}
 *          >
 *            上一页
 *          </Button>
 *        </PaginationItem>
 *        <PaginationItem>
 *          <span className="text-sm text-pdd-text-secondary">
 *            第 {pageIndex + 1} / {pageCount} 页
 *          </span>
 *        </PaginationItem>
 *        <PaginationItem>
 *          <Button
 *            variant="outline"
 *            size="sm"
 *            onClick={() => table.nextPage()}
 *            disabled={!table.getCanNextPage()}
 *          >
 *            下一页
 *          </Button>
 *        </PaginationItem>
 *      </PaginationContent>
 *    </Pagination>
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 使用 flex 居中对齐
 *    - 当前页码用 isActive 高亮
 *    - 省略号用 PaginationEllipsis 表示
 *    - 支持 href 用于 SEO（或 onClick 用于 SPA）
 */

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ButtonProps, buttonVariants } from './button';

// ===== 分页容器 =====
const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

// ===== 页码列表 =====
const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

// ===== 页码项 =====
const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

// ===== 页码链接 =====
interface PaginationLinkProps extends React.ComponentProps<'a'> {
  isActive?: boolean;
  size?: ButtonProps['size'];
}

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'default' : 'ghost',
        size,
      }),
      className
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

// ===== 上一页 =====
const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="上一页"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>上一页</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

// ===== 下一页 =====
const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="下一页"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>下一页</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

// ===== 省略号 =====
const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">更多页码</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
export type { PaginationLinkProps };
