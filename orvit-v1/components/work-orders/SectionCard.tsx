'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, icon: Icon, description, children, className }: SectionCardProps) {
  return (
    <Card className={cn('rounded-xl shadow-sm border', className)}>
      <CardHeader className="pb-2.5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">{children}</CardContent>
    </Card>
  );
}
