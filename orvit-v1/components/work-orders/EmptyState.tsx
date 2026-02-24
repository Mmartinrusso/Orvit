'use client';

import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  hint?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, subtitle, hint, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-6 sm:py-8 px-4 text-center', className)}>
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />}
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
