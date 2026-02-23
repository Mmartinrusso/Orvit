'use client';

import React from 'react';
import { cn, formatNumber } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  bgColor?: string;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  showPercentage = true,
  size = 'md',
  color = 'bg-info',
  bgColor = 'bg-muted',
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between mb-1.5">
          {label && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-medium text-foreground">
              {showPercentage ? `${formatNumber(percentage, 0)}%` : `${value}/${max}`}
            </span>
          )}
        </div>
      )}
      <div className={cn('w-full rounded-full overflow-hidden', bgColor, heights[size])}>
        <div
          className={cn(
            'h-full rounded-full',
            animated && 'transition-all duration-700 ease-out',
            color
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Variante circular
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
  label?: string;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 8,
  color = 'hsl(var(--primary))',
  showValue = true,
  label,
  className,
}: CircularProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <div className={cn('relative inline-flex', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-foreground">{formatNumber(percentage, 0)}%</span>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
}

