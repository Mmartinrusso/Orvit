'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Truck, Plus } from 'lucide-react';

interface UnitsEmptyStateProps {
  hasFilters: boolean;
  onCreateUnit?: () => void;
  canCreate?: boolean;
  onClearFilters?: () => void;
}

export function UnitsEmptyState({
  hasFilters,
  onCreateUnit,
  canCreate = false,
  onClearFilters,
}: UnitsEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-sm font-semibold mb-2 text-foreground">
        {hasFilters ? 'No se encontraron unidades' : 'No hay unidades móviles'}
      </h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
        {hasFilters
          ? 'No se encontraron unidades con los filtros aplicados. Intentá ajustar los filtros o limpiarlos.'
          : 'Comienza creando tu primera unidad móvil para gestionar vehículos y equipos móviles.'}
      </p>
      <div className="flex items-center justify-center gap-2">
        {hasFilters && onClearFilters && (
          <Button onClick={onClearFilters} variant="outline" size="lg" className="text-xs">
            Limpiar filtros
          </Button>
        )}
        {!hasFilters && canCreate && onCreateUnit && (
          <Button onClick={onCreateUnit} size="lg" className="text-xs">
            <Plus className="h-3 w-3 mr-2" />
            Crear Primera Unidad
          </Button>
        )}
      </div>
    </div>
  );
}

