'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  /** Texto explicativo que aparece al hacer hover en el ícono "i" */
  info?: string;
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  /** Height class for the card content area */
  contentHeight?: string;
}

export function DashboardCard({ title, subtitle, info, children, className, isLoading, contentHeight = 'min-h-[200px]' }: DashboardCardProps) {
  return (
    <div className={cn(
      'rounded-xl border bg-card text-card-foreground shadow-sm',
      'transition-shadow hover:shadow-md',
      className
    )}>
      {title && (
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h4>
            {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
          </div>
          {info && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors mt-0.5"
                    aria-label="Más información"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="end"
                  className="max-w-[240px] text-xs leading-relaxed"
                >
                  {info}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <div className={cn('px-4 pb-4', !title && 'pt-4', contentHeight)}>
        {isLoading ? (
          <div className="space-y-3 h-full flex flex-col justify-center">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : children}
      </div>
    </div>
  );
}

/** Compact stat card for displaying a single KPI inline */
export function StatMini({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={cn('text-2xl font-bold tabular-nums', color || 'text-foreground')}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
