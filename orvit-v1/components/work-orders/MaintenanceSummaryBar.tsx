'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Wrench, Calendar, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Priority } from '@/lib/types';

interface MaintenanceSummaryBarProps {
  machineName?: string;
  priority?: Priority;
  frequencyDays?: number;
  nextExecutionDate?: string;
  isActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  className?: string;
  compact?: boolean;
}

export function MaintenanceSummaryBar({
  machineName,
  priority,
  frequencyDays,
  nextExecutionDate,
  isActive,
  onActiveChange,
  className,
  compact = false
}: MaintenanceSummaryBarProps) {
  const getPriorityColor = (pri?: Priority) => {
    switch (pri) {
      case Priority.LOW:
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case Priority.MEDIUM:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case Priority.HIGH:
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case Priority.URGENT:
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (pri?: Priority) => {
    switch (pri) {
      case Priority.LOW:
        return 'Baja';
      case Priority.MEDIUM:
        return 'Media';
      case Priority.HIGH:
        return 'Alta';
      case Priority.URGENT:
        return 'Urgente';
      default:
        return 'Sin prioridad';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return null;
    }
  };

  // Modo compacto: solo renderiza los badges sin wrapper
  if (compact) {
    return (
      <>
        {/* Máquina/Activo */}
        {machineName ? (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Wrench className="h-3 w-3 mr-1" />
            {machineName}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground border-dashed">
            <Wrench className="h-3 w-3 mr-1" />
            Sin máquina
          </Badge>
        )}

        {/* Prioridad */}
        <Badge variant="outline" className={cn('text-xs', getPriorityColor(priority))}>
          {getPriorityLabel(priority)}
        </Badge>

        {/* Frecuencia - solo si existe */}
        {frequencyDays && frequencyDays > 0 && (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Calendar className="h-3 w-3 mr-1" />
            {frequencyDays}d
          </Badge>
        )}

        {/* Toggle Activo */}
        {onActiveChange !== undefined && (
          <div className="flex items-center gap-1.5">
            <Switch
              checked={isActive}
              onCheckedChange={onActiveChange}
              className="h-4 w-7"
            />
            <span className="text-xs text-muted-foreground">
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 py-2', className)}>
      {/* Máquina/Activo */}
      {machineName ? (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Wrench className="h-3 w-3 mr-1" />
          {machineName}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <Wrench className="h-3 w-3 mr-1" />
          Sin máquina
        </Badge>
      )}

      {/* Prioridad */}
      {priority ? (
        <Badge variant="outline" className={cn('text-xs', getPriorityColor(priority))}>
          {getPriorityLabel(priority)}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Sin prioridad
        </Badge>
      )}

      {/* Frecuencia */}
      {frequencyDays ? (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          <Calendar className="h-3 w-3 mr-1" />
          Cada {frequencyDays} día{frequencyDays !== 1 ? 's' : ''}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 mr-1" />
          Sin frecuencia
        </Badge>
      )}

      {/* Próxima ejecución */}
      {nextExecutionDate && formatDate(nextExecutionDate) ? (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Próxima: {formatDate(nextExecutionDate)}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3 mr-1" />
          Sin fecha
        </Badge>
      )}

      {/* Toggle Activo */}
      {onActiveChange !== undefined && (
        <div className="flex items-center gap-2 ml-auto">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <Switch
            checked={isActive}
            onCheckedChange={onActiveChange}
            className="h-4 w-8"
          />
          <span className="text-xs text-muted-foreground">
            {isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      )}
    </div>
  );
}
