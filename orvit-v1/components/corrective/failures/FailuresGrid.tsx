'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  MoreVertical,
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle,
  Link as LinkIcon,
  Pencil,
  Trash2,
  Cog,
  ChevronRight,
  Zap,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface FailureOccurrence {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  causedDowntime: boolean;
  isIntermittent: boolean;
  isSafetyRelated?: boolean;
  reportedAt: string;
  symptomsList?: Array<{ id: number; label: string }>;
  machine?: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  };
  workOrder?: {
    id: number;
    status: string;
  };
  workOrders?: Array<{
    id: number;
    status: string;
  }>;
  affectedComponentsList?: Array<{ id: number; name: string }>;
  affectedSubcomponentsList?: Array<{ id: number; name: string }>;
  reportedBy?: {
    id: number;
    name: string;
    avatar?: string;
  };
}

interface FailuresGridProps {
  failures: FailureOccurrence[];
  onSelectFailure?: (id: number) => void;
  onCreateWorkOrder?: (failureId: number) => void;
  onResolveFailure?: (failureId: number) => void;
  onLinkDuplicate?: (failureId: number) => void;
  onEditFailure?: (failureId: number) => void;
  onDeleteFailure?: (failureId: number) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  P1: { color: 'bg-destructive', bg: 'bg-destructive/10', label: 'Urgente' },
  P2: { color: 'bg-warning', bg: 'bg-warning-muted', label: 'Alta' },
  P3: { color: 'bg-warning', bg: 'bg-warning-muted', label: 'Media' },
  P4: { color: 'bg-info', bg: 'bg-info-muted', label: 'Baja' },
  URGENT: { color: 'bg-destructive', bg: 'bg-destructive/10', label: 'Urgente' },
  HIGH: { color: 'bg-warning', bg: 'bg-warning-muted', label: 'Alta' },
  MEDIUM: { color: 'bg-warning', bg: 'bg-warning-muted', label: 'Media' },
  LOW: { color: 'bg-info', bg: 'bg-info-muted', label: 'Baja' },
};

const statusConfig: Record<string, { color: string; bgBadge: string; label: string }> = {
  REPORTED: { color: 'bg-info', bgBadge: 'bg-info-muted text-info-muted-foreground', label: 'Reportada' },
  OPEN: { color: 'bg-info', bgBadge: 'bg-info-muted text-info-muted-foreground', label: 'Abierta' },
  IN_PROGRESS: { color: 'bg-warning', bgBadge: 'bg-warning-muted text-warning-muted-foreground', label: 'En Proceso' },
  RESOLVED: { color: 'bg-success', bgBadge: 'bg-success-muted text-success', label: 'Resuelta' },
  CANCELLED: { color: 'bg-muted-foreground', bgBadge: 'bg-muted text-foreground', label: 'Cancelada' },
};

const formatPriority = (priority: string) => {
  if (priority?.startsWith('P')) return priority;
  const map: Record<string, string> = {
    URGENT: 'P1',
    HIGH: 'P2',
    MEDIUM: 'P3',
    LOW: 'P4',
  };
  return map[priority] || priority;
};

export function FailuresGrid({
  failures,
  onSelectFailure,
  onCreateWorkOrder,
  onResolveFailure,
  onLinkDuplicate,
  onEditFailure,
  onDeleteFailure,
  canCreate = true,
  canEdit = true,
  canDelete = false,
  className,
}: FailuresGridProps) {
  if (failures.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3',
      className
    )}>
      {failures.map((failure) => {
        const displayPriority = formatPriority(failure.priority);
        const hasWorkOrder = (failure.workOrders?.length ?? 0) > 0 || !!failure.workOrder;
        const isResolved = failure.status === 'RESOLVED' || failure.status === 'CANCELLED';

        const priorityInfo = priorityConfig[failure.priority] || priorityConfig[displayPriority] || priorityConfig.P3;
        const statusInfo = statusConfig[failure.status] || statusConfig.OPEN;

        const allComponents = failure.affectedComponentsList ||
                              (failure.component ? [failure.component] : []);
        const allSubcomponents = failure.affectedSubcomponentsList || [];

        return (
          <Card
            key={failure.id}
            className={cn(
              'overflow-hidden cursor-pointer hover:shadow-md transition-all group',
              failure.causedDowntime && 'ring-1 ring-rose-200 dark:ring-rose-900/50'
            )}
            onClick={() => onSelectFailure?.(failure.id)}
          >
            {/* Header */}
            <div className={cn('px-4 py-3 border-b', priorityInfo.bg)}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  'p-2 rounded-lg shrink-0',
                  failure.causedDowntime
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                )}>
                  <Zap className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {failure.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelectFailure?.(failure.id); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </DropdownMenuItem>
                          {onEditFailure && canEdit && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditFailure(failure.id); }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canCreate && !hasWorkOrder && !isResolved && onCreateWorkOrder && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateWorkOrder(failure.id); }}>
                              <FileText className="h-4 w-4 mr-2" />
                              Crear OT
                            </DropdownMenuItem>
                          )}
                          {canEdit && !isResolved && onResolveFailure && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResolveFailure(failure.id); }}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Resolver
                            </DropdownMenuItem>
                          )}
                          {canEdit && !isResolved && onLinkDuplicate && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLinkDuplicate(failure.id); }}>
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Vincular duplicado
                            </DropdownMenuItem>
                          )}
                          {canDelete && onDeleteFailure && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onDeleteFailure(failure.id); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Máquina */}
                  {failure.machine?.name && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Cog className="h-3 w-3" />
                        {failure.machine.name}
                      </span>
                      {allComponents.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          • {allComponents.map((c: any) => c.name).join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Descripción o Síntomas */}
              {failure.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {failure.description}
                </p>
              ) : failure.symptomsList && failure.symptomsList.length > 0 ? (
                <div className="space-y-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-warning-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Síntomas
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {failure.symptomsList.slice(0, 3).map((symptom) => (
                      <Badge
                        key={symptom.id}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-5 bg-warning-muted text-warning-muted-foreground"
                      >
                        {symptom.label}
                      </Badge>
                    ))}
                    {failure.symptomsList.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        +{failure.symptomsList.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Subcomponentes */}
              {allSubcomponents.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Subcomponentes:</span>{' '}
                  {allSubcomponents.map((s: any) => s.name).join(', ')}
                </div>
              )}

              {/* Badges de características */}
              <div className="flex flex-wrap gap-1.5">
                {hasWorkOrder && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-info-muted text-info-muted-foreground">
                    <FileText className="mr-0.5 h-2.5 w-2.5" />
                    OT
                  </Badge>
                )}
                {failure.causedDowntime && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                    <Clock className="mr-0.5 h-2.5 w-2.5" />
                    Downtime
                  </Badge>
                )}
                {failure.isIntermittent && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                    Intermitente
                  </Badge>
                )}
                {failure.isSafetyRelated && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                    <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                    Seguridad
                  </Badge>
                )}
              </div>
            </div>

            {/* Footer info */}
            <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {failure.reportedBy ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={failure.reportedBy.avatar} />
                      <AvatarFallback className="text-[9px] bg-muted">
                        {failure.reportedBy.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                      {failure.reportedBy.name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2.5 w-2.5 rounded-full', priorityInfo.color)} />
                    <span className="text-xs font-medium">{displayPriority}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(failure.reportedAt), { addSuffix: true, locale: es })}
                </span>
                <Badge className={cn('text-[10px] px-1.5 py-0 h-5', statusInfo.bgBadge)}>
                  {statusInfo.label}
                </Badge>
              </div>
            </div>

            {/* Footer actions */}
            {!isResolved && (
              <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-2">
                {canCreate && !hasWorkOrder && onCreateWorkOrder && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onCreateWorkOrder(failure.id); }}
                    className="h-7 text-xs flex-1"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Crear OT
                  </Button>
                )}
                {canEdit && onResolveFailure && (
                  <Button
                    variant={hasWorkOrder ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onResolveFailure(failure.id); }}
                    className="h-7 text-xs flex-1"
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Resolver
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
