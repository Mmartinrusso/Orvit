'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  showPercentages?: boolean;
  className?: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',           // blue
  'hsl(var(--success))',           // green
  'hsl(var(--warning))',           // yellow
  'hsl(var(--destructive))',       // red
  'hsl(var(--chart-1))',           // purple
  'hsl(var(--chart-1))',           // indigo
  'hsl(var(--chart-3))',           // pink
  'hsl(var(--chart-5))',           // orange
  'hsl(var(--info))',              // teal
  'hsl(var(--info))',              // cyan
];

export function PieChart({
  data,
  size = 150,
  showLabels = false,
  showLegend = true,
  showPercentages = true,
  className,
  colors = DEFAULT_COLORS,
}: PieChartProps) {
  const { slices, total } = useMemo(() => {
    const t = data.reduce((sum, d) => sum + d.value, 0);
    if (t === 0) return { slices: [], total: 0 };

    let currentAngle = -90; // Start from top
    const s = data.map((item, index) => {
      const percentage = (item.value / t) * 100;
      const angle = (item.value / t) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      
      return {
        ...item,
        percentage,
        startAngle,
        endAngle: currentAngle,
        color: item.color || colors[index % colors.length],
      };
    });

    return { slices: s, total: t };
  }, [data, colors]);

  if (data.length === 0 || total === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height: size }}>
        <p className="text-xs text-muted-foreground">Sin datos</p>
      </div>
    );
  }

  const radius = size / 2 - 10;
  const center = size / 2;

  const getPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, radius, endAngle);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    return [
      'M', center, center,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'Z'
    ].join(' ');
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, index) => (
          <path
            key={index}
            d={getPath(slice.startAngle, slice.endAngle)}
            fill={slice.color}
            stroke="white"
            strokeWidth={2}
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}
      </svg>
      
      {showLegend && (
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {slices.map((slice, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {slice.label}
              </span>
              {showPercentages && (
                <span className="text-xs font-medium text-foreground">
                  {slice.percentage.toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

