'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({ title, icon: Icon, subtitle, children, className }: DashboardSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        </div>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="w-full h-px bg-border/60" />
      {children}
    </section>
  );
}
