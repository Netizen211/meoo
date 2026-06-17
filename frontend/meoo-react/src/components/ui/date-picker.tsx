/**
 * ============================================================
 *  📅 DatePicker 日期选择器组件
 *  ============================================================
 *
 *  底层：react-day-picker v10 + @radix-ui/react-popover
 *  来源：shadcn/ui 模式
 *  作用：统一日期选择体验，用于筛选时间范围、设置日期等
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 单日选择
 *    const [date, setDate] = useState<Date>();
 *    <DatePicker date={date} onSelect={setDate} />
 *
 *    // 带占位文字
 *    <DatePicker
 *      date={date}
 *      onSelect={setDate}
 *      placeholder="选择日期"
 *    />
 *
 *    // 日期范围选择
 *    <DatePicker
 *      mode="range"
 *      date={range}
 *      onSelect={setRange}
 *    />
 *  ═════════════════════════════════════════════════════════
 *
 *  设计说明：
 *    - 点击按钮弹出日历面板
 *    - 选择后自动关闭面板
 *    - 支持单日和日期范围两种模式
 *    - 使用 date-fns 格式化显示（已在依赖中）
 */

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { cn } from '../../lib/utils';
import { Button } from './button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';

// ===== Props 类型 =====
interface DatePickerProps {
  /** 当前选中的日期（单日模式）或日期范围 */
  date?: Date | DateRange;
  /** 选择回调 */
  onSelect: (date: Date | undefined) => void;
  /** 占位文字 */
  placeholder?: string;
  /** 选择模式 */
  mode?: 'single' | 'range';
  /** 禁用状态 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * DatePicker 日期选择器
 *
 * 单日模式：
 *   date: Date | undefined
 *   onSelect: (date: Date | undefined) => void
 *
 * 范围模式：
 *   date: DateRange | undefined
 *   onSelect: (range: DateRange | undefined) => void
 */
function DatePicker({
  date,
  onSelect,
  placeholder = '选择日期',
  mode = 'single',
  disabled = false,
  className,
}: DatePickerProps) {
  // 格式化显示日期
  const formatDate = (d: Date | undefined) => {
    if (!d) return '';
    return format(d, 'yyyy-MM-dd');
  };

  // 格式化显示日期范围
  const formatRange = (r: DateRange | undefined) => {
    if (!r?.from) return '';
    if (!r.to) return formatDate(r.from);
    return `${formatDate(r.from)} - ${formatDate(r.to)}`;
  };

  // 当前显示的文本
  const displayText = mode === 'range'
    ? formatRange(date as DateRange)
    : formatDate(date as Date);

  // 判断是否已选择
  const hasSelection = mode === 'range'
    ? !!(date as DateRange)?.from
    : !!date;

  return (
    <Popover>
      {/* 触发按钮 */}
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-[240px] justify-start text-left font-normal',
            !hasSelection && 'text-pdd-text-secondary',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {hasSelection ? displayText : placeholder}
        </Button>
      </PopoverTrigger>

      {/* 日历面板 */}
      <PopoverContent className="w-auto p-0" align="start">
        {mode === 'range' ? (
          <DayPicker
            mode="range"
            selected={date as DateRange}
            onSelect={onSelect as any}
          />
        ) : (
          <DayPicker
            mode="single"
            selected={date as Date}
            onSelect={onSelect as any}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
export type { DatePickerProps, DateRange };
