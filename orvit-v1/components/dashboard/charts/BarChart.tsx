'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  horizontal?: boolean;
  animated?: boolean;
  className?: string;
  barClassName?: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-cyan-500',
];

export function BarChart({
  data,
  height = 200,
  showLabels = true,
  showValues = true,
  horizontal = false,
  animated = true,
  className,
  barClassName,
  colors = DEFAULT_COLORS,
}: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  if (horizontal) {
    return (
      <div className={cn('space-y-2', className)}>
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const barColor = item.color || colors[index % colors.length];
          
          return (
            <div key={index} className="space-y-1">
              {showLabels && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate">{item.label}</span>
                  {showValues && (
                    <span className="font-medium text-foreground">{item.value}</span>
                  )}
                </div>
              )}
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={cn(
                    'h-2.5 rounded-full',
                    animated && 'transition-all duration-700 ease-out',
                    barColor,
                    barClassName
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical bar chart
  return (
    <div className={cn('flex items-end justify-around gap-2', className)} style={{ height }}>
      {data.map((item, index) => {
        const percentage = (item.value / maxValue) * 100;
        const barColor = item.color || colors[index % colors.length];
        
        return (
          <div key={index} className="flex flex-col items-center gap-1 flex-1">
            <div className="relative w-full flex justify-center" style={{ height: height - 40 }}>
              {showValues && (
                <span className="absolute -top-5 text-xs font-medium text-foreground">
                  {item.value}
                </span>
              )}
              <div
                className={cn(
                  'w-full max-w-[40px] rounded-t-md',
                  animated && 'transition-all duration-700 ease-out',
                  barColor,
                  barClassName
                )}
                style={{ 
                  height: `${percentage}%`,
                  minHeight: item.value > 0 ? '4px' : '0'
                }}
              />
            </div>
            {showLabels && (
              <span className="text-xs text-muted-foreground text-center truncate w-full">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

