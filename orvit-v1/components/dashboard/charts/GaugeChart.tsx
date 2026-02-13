'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GaugeChartProps {
  value: number;
  max?: number;
  min?: number;
  size?: number;
  thickness?: number;
  label?: string;
  unit?: string;
  thresholds?: { value: number; color: string }[];
  className?: string;
}

const DEFAULT_THRESHOLDS = [
  { value: 30, color: '#ef4444' },  // red
  { value: 60, color: '#eab308' },  // yellow
  { value: 100, color: '#22c55e' }, // green
];

export function GaugeChart({
  value,
  max = 100,
  min = 0,
  size = 120,
  thickness = 12,
  label,
  unit = '%',
  thresholds = DEFAULT_THRESHOLDS,
  className,
}: GaugeChartProps) {
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const radius = (size - thickness) / 2;
  const circumference = Math.PI * radius; // Half circle
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  // Get color based on thresholds
  const getColor = () => {
    for (const threshold of thresholds) {
      if (percentage <= threshold.value) {
        return threshold.color;
      }
    }
    return thresholds[thresholds.length - 1]?.color || '#22c55e';
  };

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg 
        width={size} 
        height={size / 2 + 10} 
        viewBox={`0 0 ${size} ${size / 2 + 10}`}
      >
        {/* Background arc */}
        <path
          d={describeArc(center, center, radius, 180, 360)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        
        {/* Value arc */}
        <path
          d={describeArc(center, center, radius, 180, 180 + (percentage / 100) * 180)}
          fill="none"
          stroke={getColor()}
          strokeWidth={thickness}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-xl font-bold text-foreground">
          {value}{unit}
        </span>
        {label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>
    </div>
  );
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

