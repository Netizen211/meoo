/**
 * ============================================================
 *  UI 组件库 - 统一导出入口
 *
 *  所有页面只需从这一个文件 import：
 *    import { Button, Card, Table, ... } from '../components/ui';
 *
 *  如需新增组件：
 *    1. 在 src/components/ui/ 下创建 .tsx 文件
 *    2. 在此文件添加 export
 * ============================================================
 */
// ===== 基础组件 =====
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";
export { Badge, badgeVariants } from "./badge";
export type { BadgeProps } from "./badge";
export { Separator } from "./separator";
export { Input } from "./input";
export { Label } from "./label";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";

// ===== 弹窗 & 滑出面板 =====
export { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "./dialog";
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "./sheet";

// ===== 导航 & 选择 =====
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectSeparator } from "./select";
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuPortal } from "./dropdown-menu";
export { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis } from "./pagination";
export type { PaginationLinkProps } from "./pagination";

// ===== 表格 & 滚动 =====
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";
export { ScrollArea, ScrollBar } from "./scroll-area";

// ===== 提示 & 消息 =====
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
export { Toaster, toast } from "./toast";

// ===== 表单 =====
export { Checkbox } from "./checkbox";
export { Switch } from "./switch";
export { DatePicker } from "./date-picker";
export type { DatePickerProps, DateRange } from "./date-picker";

// ===== 反馈组件 =====
export { Progress } from "./progress";
export type { ProgressProps } from "./progress";
export { Skeleton } from "./skeleton";
export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";

// ===== 折叠 & 命令 =====
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./collapsible";
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandLoading } from "./command";

// ===== 弹出框 =====
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./popover";
