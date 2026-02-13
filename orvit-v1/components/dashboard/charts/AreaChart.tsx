'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface AreaChartData {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: AreaChartData[];
  height?: number;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  showLabels?: boolean;
  showGrid?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  height = 150,
  color = '#3b82f6',
  gradientFrom,
  gradientTo,
  showLabels = true,
  showGrid = true,
  className,
}: AreaChartProps) {
  const gradientId = useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  
  const { linePath, areaPath, points } = useMemo(() => {
    if (data.length === 0) return { linePath: '', areaPath: '', points: [] };

    const values = data.map(d => d.value);
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const range = max - min || 1;
    
    const padding = { left: 10, right: 10, top: 10, bottom: showLabels ? 30 : 10 };
    const chartWidth = 100;
    const chartHeight = height - padding.top - padding.bottom;
    
    const pts = data.map((item, index) => {
      const x = padding.left + ((chartWidth - padding.left - padding.right) * index) / (data.length - 1 || 1);
      const y = padding.top + chartHeight - ((item.value - min) / range) * chartHeight;
      return { x, y, ...item };
    });

    // Create smooth curve using bezier
    const line = pts.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
    }).join(' ');
    
    const area = `${line} L ${pts[pts.length - 1].x} ${height - (showLabels ? 30 : 10)} L ${pts[0].x} ${height - (showLabels ? 30 : 10)} Z`;

    return { linePath: line, areaPath: area, points: pts };
  }, [data, height, showLabels]);

  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-xs text-muted-foreground">Sin datos</p>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} style={{ height }}>
      <svg 
        viewBox={`0 0 100 ${height}`} 
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom || color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={gradientTo || color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {showGrid && (
          <g className="text-gray-200">
            {[0.25, 0.5, 0.75].map((ratio, i) => (
              <line
                key={i}
                x1="10"
                x2="90"
                y1={10 + (height - 40) * ratio}
                y2={10 + (height - 40) * ratio}
                stroke="currentColor"
                strokeWidth={0.5}
                strokeDasharray="2,2"
              />
            ))}
          </g>
        )}
        
        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          className="transition-all duration-500"
        />
        
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3}
            fill="white"
            stroke={color}
            strokeWidth={2}
            className="transition-all duration-300"
          />
        ))}
      </svg>
      
      {/* Labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          {data.map((item, index) => (
            <span key={index} className="text-xs text-muted-foreground truncate max-w-[60px]">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

