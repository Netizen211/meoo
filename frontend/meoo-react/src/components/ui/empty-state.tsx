/**
 * ============================================================
 *  📭 EmptyState 空状态组件
 *  ============================================================
 *
 *  作用：当页面/列表/表格没有数据时，显示友好的提示信息
 *  参考：shadcn/ui + Mantine 的空状态模式
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 基础用法
 *    <EmptyState
 *      icon={<Inbox size={48} />}
 *      title="暂无数据"
 *      description="请先导入数据后再查看"
 *    />
 *
 *    // 带操作按钮
 *    <EmptyState
 *      icon={<Upload size={48} />}
 *      title="还没有上传数据"
 *      description="上传您的第一份订单数据开始分析"
 *      action={
 *        <Button onClick={() => navigate('/upload')}>
 *          上传数据
 *        </Button>
 *      }
 *    />
 *
 *    // 带次级操作链接
 *    <EmptyState
 *      title="未找到相关记录"
 *      description="尝试更换筛选条件"
 *      secondaryAction={
 *        <Button variant="link" onClick={clearFilters}>
 *          清除筛选
 *        </Button>
 *      }
 *    />
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 居中布局，垂直水平居中
 *    - icon 可选，用 lucide-react 图标
 *    - title 必填，description 可选
 *    - action 主按钮 + secondaryAction 次级操作
 */

import { cn } from '../../lib/utils';

interface EmptyStateProps {
  /** 标题（必填） */
  title: string;
  /** 描述文字（可选） */
  description?: string;
  /** 图标组件（可选，用 lucide-react 传入） */
  icon?: React.ReactNode;
  /** 主要操作按钮（可选） */
  action?: React.ReactNode;
  /** 次级操作（可选，如"清除筛选"链接） */
  secondaryAction?: React.ReactNode;
  /** 自定义类名覆盖容器样式 */
  className?: string;
}

/**
 * EmptyState 空状态组件
 *
 * 数据加载完成后，如果列表/表格/页面为空，显示此组件
 * 而不是直接显示空白页
 */
function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {/* 图标区域 */}
      {icon && (
        <div className="mb-4 text-pdd-gray-300">
          {icon}
        </div>
      )}

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-pdd-text">
        {title}
      </h3>

      {/* 描述 */}
      {description && (
        <p className="mt-2 text-sm text-pdd-text-secondary max-w-sm">
          {description}
        </p>
      )}

      {/* 主操作按钮 */}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}

      {/* 次级操作 */}
      {secondaryAction && (
        <div className="mt-2">
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
