'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LucideIcon, Info } from 'lucide-react';

interface HeroKpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: string;       // Tailwind text color e.g. 'text-primary'
  bgColor: string;     // Tailwind bg color e.g. 'bg-primary/10'
  subtitle?: string;
  info?: string;
  isLoading?: boolean;
  onClick?: () => void;
}

export function HeroKpiCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  subtitle,
  info,
  isLoading,
  onClick,
}: HeroKpiCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <Skeleton className="h-3 w-[80px] mb-2" />
              <Skeleton className="h-8 w-[50px]" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'border-border bg-card transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-border/80'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="text-xs font-medium text-muted-foreground truncate flex-1">
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-semibold text-foreground tabular-nums">
              {value}
            </p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
            bgColor
          )}>
            <Icon className={cn('w-5 h-5', color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
