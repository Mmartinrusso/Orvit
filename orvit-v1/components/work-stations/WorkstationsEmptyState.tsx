'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';

interface WorkstationsEmptyStateProps {
  hasFilters: boolean;
  onCreateWorkstation?: () => void;
  canCreate?: boolean;
  onClearFilters?: () => void;
}

export function WorkstationsEmptyState({
  hasFilters,
  onCreateWorkstation,
  canCreate = false,
  onClearFilters,
}: WorkstationsEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-sm font-semibold mb-2 text-foreground">
        {hasFilters ? 'No se encontraron puestos' : 'No hay puestos de trabajo'}
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
        {hasFilters
          ? 'No se encontraron puestos con los filtros aplicados. Intentá ajustar los filtros o limpiarlos.'
          : 'Comienza creando tu primer puesto de trabajo para gestionar estaciones y áreas operativas.'}
      </p>
      <div className="flex items-center justify-center gap-2">
        {hasFilters && onClearFilters && (
          <Button onClick={onClearFilters} variant="outline" size="lg" className="text-xs">
            Limpiar filtros
          </Button>
        )}
        {!hasFilters && canCreate && onCreateWorkstation && (
          <Button onClick={onCreateWorkstation} size="lg" className="text-xs">
            <Plus className="h-3 w-3 mr-2" />
            Crear primer puesto
          </Button>
        )}
      </div>
    </div>
  );
}

