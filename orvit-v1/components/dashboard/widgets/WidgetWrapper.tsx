'use client';

import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MoreVertical, 
  Maximize2, 
  Minimize2, 
  X, 
  RefreshCw,
  GripVertical 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface WidgetProps {
  companyId: number;
  sectorId?: number | null;
  userId?: number;
  settings?: Record<string, any>;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

interface WidgetWrapperProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRefresh?: () => void;
  onRemove?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  isEditMode?: boolean;
  className?: string;
  headerActions?: ReactNode;
  noPadding?: boolean;
}

export function WidgetWrapper({
  title,
  icon,
  children,
  isLoading = false,
  isError = false,
  errorMessage = 'Error al cargar datos',
  onRefresh,
  onRemove,
  onExpand,
  isExpanded = false,
  isEditMode = false,
  className,
  headerActions,
  noPadding = false,
}: WidgetWrapperProps) {
  return (
    <Card className={cn(
      'h-full flex flex-col border border-border/30 transition-all duration-200',
      isEditMode && 'ring-2 ring-primary/20 cursor-move',
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 space-y-0">
        <div className="flex items-center gap-2">
          {isEditMode && (
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          )}
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          {(onRefresh || onExpand || onRemove) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onRefresh && (
                  <DropdownMenuItem onClick={onRefresh}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Actualizar
                  </DropdownMenuItem>
                )}
                {onExpand && (
                  <DropdownMenuItem onClick={onExpand}>
                    {isExpanded ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5 mr-2" />
                        Minimizar
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5 mr-2" />
                        Expandir
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {onRemove && isEditMode && (
                  <DropdownMenuItem onClick={onRemove} className="text-destructive">
                    <X className="h-3.5 w-3.5 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn(
        'flex-1 overflow-auto',
        noPadding ? 'p-0' : 'px-4 pb-4 pt-0'
      )}>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="mt-2 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reintentar
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Loading skeleton para widgets
export function WidgetSkeleton() {
  return (
    <Card className="h-full flex flex-col border border-border/30">
      <CardHeader className="py-3 px-4">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}

