'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface DonutChartData {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  showTotal?: boolean;
  totalLabel?: string;
  className?: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function DonutChart({
  data,
  size = 120,
  thickness = 20,
  showLegend = true,
  showTotal = true,
  totalLabel = 'Total',
  className,
  colors = DEFAULT_COLORS,
}: DonutChartProps) {
  const { segments, total } = useMemo(() => {
    const t = data.reduce((sum, d) => sum + d.value, 0);
    if (t === 0) return { segments: [], total: 0 };

    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    
    let offset = circumference * 0.25; // Start from top
    
    const s = data.map((item, index) => {
      const percentage = item.value / t;
      const strokeLength = circumference * percentage;
      const currentOffset = offset;
      offset -= strokeLength;
      
      return {
        ...item,
        percentage: percentage * 100,
        strokeLength,
        offset: currentOffset,
        color: item.color || colors[index % colors.length],
        radius,
        circumference,
      };
    });

    return { segments: s, total: t };
  }, [data, size, thickness, colors]);

  if (data.length === 0 || total === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height: size }}>
        <p className="text-xs text-muted-foreground">Sin datos</p>
      </div>
    );
  }

  const center = size / 2;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={segments[0]?.radius || 0}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={thickness}
          />
          
          {/* Data segments */}
          {segments.map((segment, index) => (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={segment.radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${segment.strokeLength} ${segment.circumference}`}
              strokeDashoffset={segment.offset}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          ))}
        </svg>
        
        {/* Center text */}
        {showTotal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">{totalLabel}</span>
          </div>
        )}
      </div>
      
      {showLegend && (
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {segment.label}
              </span>
              <span className="text-xs font-medium text-foreground">
                {segment.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

