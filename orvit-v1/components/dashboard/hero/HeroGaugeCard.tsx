'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface HeroGaugeCardProps {
  title: string;
  value: number | null;
  unit?: string;
  maxValue?: number;
  info?: string;
  isLoading?: boolean;
}

export function HeroGaugeCard({
  title,
  value,
  unit = '%',
  maxValue = 100,
  info,
  isLoading,
}: HeroGaugeCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4 flex flex-col items-center">
          <Skeleton className="h-3 w-[80px] mb-3" />
          <Skeleton className="h-16 w-16 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const displayValue = value ?? 0;
  const percentage = Math.min((displayValue / maxValue) * 100, 100);

  // Color based on percentage thresholds
  const getColor = (pct: number) => {
    if (pct >= 80) return { stroke: 'hsl(var(--success))', text: 'text-success' };
    if (pct >= 50) return { stroke: 'hsl(var(--warning))', text: 'text-warning-muted-foreground' };
    return { stroke: 'hsl(var(--destructive))', text: 'text-destructive' };
  };

  const colors = getColor(percentage);

  // SVG gauge arc
  const size = 72;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Semi-circle
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4 flex flex-col items-center">
        <div className="flex items-center justify-between w-full mb-2">
          <p className="text-xs font-medium text-muted-foreground text-center truncate flex-1">
            {title}
          </p>
          {info && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    aria-label="Más información"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" className="max-w-[220px] text-xs leading-relaxed">
                  {info}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="relative" style={{ width: size, height: size / 2 + 8 }}>
          <svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`}>
            {/* Background arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Value arc */}
            <path
              d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
              fill="none"
              stroke={colors.stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-end justify-center pb-0">
            <span className={cn('text-lg font-bold tabular-nums', colors.text)}>
              {value !== null ? displayValue : '—'}
            </span>
            {value !== null && (
              <span className="text-xs text-muted-foreground ml-0.5 mb-0.5">
                {unit}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
