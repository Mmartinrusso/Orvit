'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Lightbulb,
  Cog,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Wrench,
  Image as ImageIcon,
  Video,
  Paperclip
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface SolutionAttachment {
  id: number;
  url: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface Solution {
  id: number | string;
  title: string;
  description?: string;
  rootCause?: string;
  solution?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  failureDescription?: string;
  machineId?: number;
  machineName?: string;
  componentId?: number;
  componentName?: string;
  subcomponentNames?: string; // Múltiples subcomponentes separados por coma
  completedDate?: string | Date;
  createdAt?: string | Date;
  executedBy?: {
    id: number;
    name: string;
    avatar?: string;
  };
  assignedTo?: {
    id: number;
    name: string;
    avatar?: string;
  };
  effectiveness?: number;
  timesApplied?: number;
  priority?: string;
  status?: string;
  attachments?: SolutionAttachment[];
  _workOrder?: any;
}

interface SolutionCardProps {
  solution: Solution;
  onClick?: (solution: Solution) => void;
  variant?: 'default' | 'compact' | 'mini';
  showMachine?: boolean;
  className?: string;
}

export function SolutionCard({
  solution,
  onClick,
  variant = 'default',
  showMachine = true,
  className
}: SolutionCardProps) {

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Crítica</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-500 text-[10px] px-1.5 py-0">Alta</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-amber-500 text-[10px] px-1.5 py-0">Media</Badge>;
      case 'LOW':
        return <Badge className="bg-green-500 text-[10px] px-1.5 py-0">Baja</Badge>;
      default:
        return null;
    }
  };

  const getAttachmentCounts = () => {
    if (!solution.attachments?.length) return null;
    const counts = { images: 0, videos: 0, files: 0 };
    solution.attachments.forEach(att => {
      if (att.fileType?.startsWith('image/')) counts.images++;
      else if (att.fileType?.startsWith('video/')) counts.videos++;
      else counts.files++;
    });
    return counts;
  };

  const attachmentCounts = getAttachmentCounts();
  const executor = solution.executedBy || solution.assignedTo;

  // Mini variant
  if (variant === 'mini') {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group",
          className
        )}
        onClick={() => onClick?.(solution)}
      >
        <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
          <Lightbulb className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{solution.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {solution.machineName || 'Sin máquina'}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0" />
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <Card
        className={cn(
          "p-3 cursor-pointer hover:bg-accent/50 transition-colors group border-l-4 border-l-amber-500",
          className
        )}
        onClick={() => onClick?.(solution)}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
            <Lightbulb className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm leading-tight line-clamp-2">{solution.title}</h4>
              {getPriorityBadge(solution.priority)}
            </div>

            {showMachine && solution.machineName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cog className="h-3 w-3" />
                <span className="truncate">{solution.machineName}</span>
                {solution.componentName && (
                  <>
                    <span>•</span>
                    <span className="truncate">{solution.componentName}</span>
                  </>
                )}
              </div>
            )}

            {solution.rootCause && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                <span className="text-red-500 font-medium">Causa:</span> {solution.rootCause}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              {executor && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={executor.avatar} />
                    <AvatarFallback className="text-[9px] bg-muted">
                      {executor.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">{executor.name}</span>
                </div>
              )}
              {solution.completedDate && (
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(solution.completedDate), { addSuffix: true, locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Default variant
  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer hover:shadow-md transition-all group",
        className
      )}
      onClick={() => onClick?.(solution)}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b bg-amber-50/50 dark:bg-amber-950/10">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 shrink-0">
            <Lightbulb className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-amber-600 transition-colors">
                {solution.title}
              </h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-amber-500 transition-colors shrink-0 mt-0.5" />
            </div>

            {showMachine && solution.machineName && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Cog className="h-3 w-3" />
                  {solution.machineName}
                </span>
                {solution.componentName && (
                  <span className="text-xs text-muted-foreground">
                    • {solution.componentName}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Root Cause */}
        {solution.rootCause && (
          <div className="space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Causa Raíz
            </span>
            <p className="text-sm text-muted-foreground line-clamp-2">{solution.rootCause}</p>
          </div>
        )}

        {/* Solution */}
        {(solution.solution || solution.correctiveActions) && (
          <div className="space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-green-600 flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Solución
            </span>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {solution.solution || solution.correctiveActions}
            </p>
          </div>
        )}

        {/* Attachments */}
        {attachmentCounts && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {attachmentCounts.images > 0 && (
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {attachmentCounts.images}
              </span>
            )}
            {attachmentCounts.videos > 0 && (
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                {attachmentCounts.videos}
              </span>
            )}
            {attachmentCounts.files > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {attachmentCounts.files}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {executor && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={executor.avatar} />
                <AvatarFallback className="text-[9px] bg-muted">
                  {executor.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">{executor.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {solution.completedDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(solution.completedDate), 'dd MMM yyyy', { locale: es })}
            </span>
          )}
          {getPriorityBadge(solution.priority)}
        </div>
      </div>
    </Card>
  );
}

export default SolutionCard;
