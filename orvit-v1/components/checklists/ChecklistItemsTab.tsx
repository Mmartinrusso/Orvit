'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertCircle,
  CheckSquare,
  Clock,
  Wrench,
  Droplets,
  Search,
  Sparkles,
  Settings,
  Gauge,
  ClipboardCheck
} from 'lucide-react';
import { useChecklistItemsTree, parseCode, compareCodes } from '@/hooks/mantenimiento/use-checklist-items-tree';

interface ChecklistItemsTabProps {
  checklistId: number;
}

function formatMinutes(totalMinutes: number | null | undefined): string {
  if (!totalMinutes || totalMinutes === 0) return '—';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function safeText(text: string | null | undefined): string {
  return text && text.trim() ? text.trim() : '—';
}

function normalizeDescription(description: string | null | undefined): string {
  if (!description) return '';
  return description;
}

function getItemIcon(title: string): React.ReactNode {
  const t = title.toLowerCase();
  if (t.includes('lubric') || t.includes('aceite') || t.includes('grasa'))
    return <Droplets className="h-3.5 w-3.5 text-warning-muted-foreground" />;
  if (t.includes('limpi') || t.includes('lavar'))
    return <Sparkles className="h-3.5 w-3.5 text-info-muted-foreground" />;
  if (t.includes('inspecci') || t.includes('verific') || t.includes('revis') || t.includes('control'))
    return <Search className="h-3.5 w-3.5 text-primary" />;
  if (t.includes('ajust') || t.includes('calibr') || t.includes('torque'))
    return <Settings className="h-3.5 w-3.5 text-primary" />;
  if (t.includes('cambio') || t.includes('reempla') || t.includes('sustitu'))
    return <Wrench className="h-3.5 w-3.5 text-warning-muted-foreground" />;
  if (t.includes('medi') || t.includes('nivel') || t.includes('presi'))
    return <Gauge className="h-3.5 w-3.5 text-success" />;
  return <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getTimeColor(minutes: number): string {
  if (minutes <= 5) return 'bg-success-muted text-success border-success/20';
  if (minutes <= 15) return 'bg-info-muted text-info-muted-foreground border-info-muted-foreground/20';
  if (minutes <= 60) return 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
}

export function ChecklistItemsTab({ checklistId }: ChecklistItemsTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useChecklistItemsTree(checklistId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar los items</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>No se pudieron cargar los items del checklist.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['checklist-detail', checklistId] });
              refetch();
            }}
            className="ml-4"
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.totalItems === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Este checklist no tiene items cargados</p>
        </CardContent>
      </Card>
    );
  }

  const sortedItems = [...data.flatItems].sort((a, b) =>
    compareCodes(parseCode(a.code || ''), parseCode(b.code || ''))
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Items del Checklist ({data.totalItems})
        </h3>
        <Badge variant="outline" className="text-xs">
          Tiempo Total: {formatMinutes(data.totalMinutes)}
        </Badge>
      </div>

      {/* Lista plana */}
      <div className="space-y-2">
        {sortedItems.map((item, index) => (
          <div
            key={item.id || index}
            className="flex items-start gap-3 p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 mt-0.5">
              {getItemIcon(safeText(item.title))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.code && item.code !== '—' && (
                      <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {item.code}
                      </span>
                    )}
                    <h5 className="font-medium text-sm text-foreground truncate">
                      {safeText(item.title)}
                    </h5>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line mt-1 line-clamp-2">
                      {normalizeDescription(item.description)}
                    </p>
                  )}
                </div>
                {(item.minutes || 0) > 0 && (
                  <Badge
                    variant="outline"
                    className={cn('text-xs shrink-0 flex items-center gap-1', getTimeColor(item.minutes || 0))}
                  >
                    <Clock className="h-3 w-3" />
                    {formatMinutes(item.minutes)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
