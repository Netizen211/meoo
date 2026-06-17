/**
 * ============================================================
 *  🗂 Collapsible 折叠面板组件
 *  ============================================================
 *
 *  底层：@radix-ui/react-collapsible — 支持 ARIA 展开/收起语义
 *  来源：shadcn/ui
 *  作用：设置中心分组、筛选条件折叠、详情展开等
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    <Collapsible>
 *      <CollapsibleTrigger asChild>
 *        <Button variant="ghost">
 *          高级筛选
 *          <ChevronDown className="ml-2" />
 *        </Button>
 *      </CollapsibleTrigger>
 *      <CollapsibleContent>
 *        <div className="mt-2 p-4 border rounded-md">
 *          // 折叠内容
 *        </div>
 *      </CollapsibleContent>
 *    </Collapsible>
 *
 *    // 默认展开
 *    <Collapsible defaultOpen>
 *      ...
 *    </Collapsible>
 *
 *    // 受控模式
 *    const [open, setOpen] = useState(false);
 *    <Collapsible open={open} onOpenChange={setOpen}>
 *      ...
 *    </Collapsible>
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 展开/收起动画使用 data-[state=open] 控制
 *    - 动画效果由 tailwindcss-animate 插件提供
 *    - Trigger 可以是任意元素（通过 asChild）
 */

import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '../../lib/utils';

// ===== 根容器 =====
const Collapsible = CollapsiblePrimitive.Root;

// ===== 触发按钮 =====
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

// ===== 折叠内容区域 =====
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      className
    )}
    {...props}
  >
    <div className="pb-1">{children}</div>
  </CollapsiblePrimitive.Content>
));
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
