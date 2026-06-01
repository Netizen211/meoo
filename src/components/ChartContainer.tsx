import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Download, MoreHorizontal, BarChart3, LineChart, PieChart, X } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
  onFullscreen?: () => void;
  onExport?: () => void;
}

export default function ChartContainer({ title, children, onRemove, onFullscreen, onExport }: ChartContainerProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
    onFullscreen?.();
  };

  return (
    <motion.div
      ref={containerRef}
      layout
      className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-pdd-border">
        <h3 className="text-sm font-semibold text-pdd-text tracking-tight">{title}</h3>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 bg-pdd-bg rounded-lg p-0.5">
            {(['bar', 'line', 'pie'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`p-1.5 rounded-md transition-colors ${
                  chartType === type
                    ? 'bg-pdd-card shadow-sm text-pdd-primary'
                    : 'text-pdd-text-secondary hover:text-pdd-text'
                }`}
              >
                {type === 'bar' && <BarChart3 size={14} />}
                {type === 'line' && <LineChart size={14} />}
                {type === 'pie' && <PieChart size={14} />}
              </button>
            ))}
          </div>
          <button
            onClick={handleFullscreen}
            className="p-1.5 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-colors"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onExport}
            className="p-1.5 text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg rounded-lg transition-colors"
          >
            <Download size={14} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  );
}
