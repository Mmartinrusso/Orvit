'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface LineChartData {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartData[];
  height?: number;
  showLabels?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  color?: string;
  areaColor?: string;
  className?: string;
  strokeWidth?: number;
}

export function LineChart({
  data,
  height = 150,
  showLabels = true,
  showDots = true,
  showArea = false,
  color = '#3b82f6',
  areaColor,
  className,
  strokeWidth = 2,
}: LineChartProps) {
  const { path, areaPath, points, minValue, maxValue } = useMemo(() => {
    if (data.length === 0) return { path: '', areaPath: '', points: [], minValue: 0, maxValue: 0 };

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    const padding = 20;
    const chartWidth = 100; // porcentaje
    const chartHeight = height - (showLabels ? 30 : 10);
    
    const pts = data.map((item, index) => {
      const x = padding + ((chartWidth - 2 * padding) * index) / (data.length - 1 || 1);
      const y = chartHeight - ((item.value - min) / range) * (chartHeight - 20) - 10;
      return { x, y, ...item };
    });

    // Crear path de línea
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    // Crear path de área
    const area = showArea 
      ? `${linePath} L ${pts[pts.length - 1].x} ${chartHeight} L ${pts[0].x} ${chartHeight} Z`
      : '';

    return { path: linePath, areaPath: area, points: pts, minValue: min, maxValue: max };
  }, [data, height, showLabels, showArea]);

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
        {/* Área bajo la línea */}
        {showArea && (
          <path
            d={areaPath}
            fill={areaColor || `${color}20`}
            className="transition-all duration-500"
          />
        )}
        
        {/* Línea principal */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />
        
        {/* Puntos */}
        {showDots && points.map((point, index) => (
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
            <span key={index} className="text-xs text-muted-foreground truncate">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

