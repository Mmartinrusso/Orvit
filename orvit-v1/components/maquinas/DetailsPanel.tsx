'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetailsFieldProps {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export function DetailsField({ label, value, fullWidth = false, className }: DetailsFieldProps) {
  return (
    <div className={cn(fullWidth ? 'col-span-1 sm:col-span-2' : '', className)}>
      <dt className="text-xs text-muted-foreground mb-1">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

interface DetailsPanelProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function DetailsPanel({ 
  title, 
  icon: Icon, 
  children, 
  className,
  fullWidth = false 
}: DetailsPanelProps) {
  return (
    <Card className={cn(
      'rounded-xl border border-border bg-background shadow-sm',
      fullWidth && 'md:col-span-2',
      className
    )}>
      <CardHeader className="p-5 pb-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

