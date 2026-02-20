'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
  showArea?: boolean;
  className?: string;
}

export function SparkLine({
  data,
  width = 100,
  height = 30,
  color = 'hsl(var(--primary))',
  showDot = true,
  showArea = false,
  className,
}: SparkLineProps) {
  const { path, areaPath, lastPoint } = useMemo(() => {
    if (data.length === 0) return { path: '', areaPath: '', lastPoint: null };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const points = data.map((value, index) => {
      const x = padding + (chartWidth * index) / (data.length - 1 || 1);
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    const area = showArea 
      ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

    return { 
      path: linePath, 
      areaPath: area, 
      lastPoint: points[points.length - 1] 
    };
  }, [data, width, height, showArea]);

  if (data.length === 0) {
    return <div className={cn('', className)} style={{ width, height }} />;
  }

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className={cn('', className)}
    >
      {showArea && (
        <path
          d={areaPath}
          fill={`${color}20`}
        />
      )}
      
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {showDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

