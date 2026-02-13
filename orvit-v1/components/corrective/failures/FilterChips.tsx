'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { FailureFilters } from './FailureFiltersBar';

interface FilterChipsProps {
  filters: FailureFilters;
  onRemoveFilter: <K extends keyof FailureFilters>(
    key: K,
    value?: FailureFilters[K] extends (infer U)[] ? U : never
  ) => void;
  onClearAll: () => void;
  machineName?: string;
  componentName?: string;
  reportedByName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  REPORTED: 'Reportada',
  IN_PROGRESS: 'En Proceso',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
};

const PRIORITY_LABELS: Record<string, string> = {
  P1: 'P1 - Urgente',
  P2: 'P2 - Alta',
  P3: 'P3 - Media',
  P4: 'P4 - Baja',
};

/**
 * Chips de filtros activos con opción de remover
 */
export function FilterChips({
  filters,
  onRemoveFilter,
  onClearAll,
  machineName,
  componentName,
  reportedByName,
}: FilterChipsProps) {
  const chips: Array<{
    key: keyof FailureFilters;
    label: string;
    value?: string;
  }> = [];

  // Search
  if (filters.search) {
    chips.push({ key: 'search', label: `Búsqueda: "${filters.search}"` });
  }

  // Status (array)
  filters.status?.forEach((status) => {
    chips.push({
      key: 'status',
      label: STATUS_LABELS[status] || status,
      value: status,
    });
  });

  // Machine
  if (filters.machineId && machineName) {
    chips.push({ key: 'machineId', label: `Máquina: ${machineName}` });
  }

  // Priority (array)
  filters.priority?.forEach((priority) => {
    chips.push({
      key: 'priority',
      label: PRIORITY_LABELS[priority] || priority,
      value: priority,
    });
  });

  // Boolean filters
  if (filters.causedDowntime) {
    chips.push({ key: 'causedDowntime', label: 'Con Downtime' });
  }
  if (filters.isIntermittent) {
    chips.push({ key: 'isIntermittent', label: 'Intermitente' });
  }
  if (filters.isObservation) {
    chips.push({ key: 'isObservation', label: 'Observación' });
  }

  // Advanced filters
  if (filters.dateFrom) {
    chips.push({
      key: 'dateFrom',
      label: `Desde: ${new Date(filters.dateFrom).toLocaleDateString('es-AR')}`,
    });
  }
  if (filters.dateTo) {
    chips.push({
      key: 'dateTo',
      label: `Hasta: ${new Date(filters.dateTo).toLocaleDateString('es-AR')}`,
    });
  }
  if (filters.componentId && componentName) {
    chips.push({ key: 'componentId', label: `Componente: ${componentName}` });
  }
  if (filters.reportedById && reportedByName) {
    chips.push({
      key: 'reportedById',
      label: `Reportado por: ${reportedByName}`,
    });
  }
  if (filters.hasWorkOrder === true) {
    chips.push({ key: 'hasWorkOrder', label: 'Con OT' });
  }
  if (filters.hasWorkOrder === false) {
    chips.push({ key: 'hasWorkOrder', label: 'Sin OT' });
  }
  if (filters.hasDuplicates === true) {
    chips.push({ key: 'hasDuplicates', label: 'Con duplicados' });
  }
  if (filters.hasDuplicates === false) {
    chips.push({ key: 'hasDuplicates', label: 'Sin duplicados' });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, index) => (
        <Badge
          key={`${chip.key}-${chip.value || index}`}
          variant="secondary"
          className="h-7 gap-1 pr-1 text-xs"
        >
          {chip.label}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 hover:bg-muted"
            onClick={() => onRemoveFilter(chip.key, chip.value as any)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={onClearAll}
        >
          Limpiar todos
        </Button>
      )}
    </div>
  );
}
