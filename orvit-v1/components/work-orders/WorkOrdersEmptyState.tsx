'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Zap, X } from 'lucide-react';

interface WorkOrdersEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
  onCreateOrder?: () => void;
  canCreate?: boolean;
}

export function WorkOrdersEmptyState({
  hasFilters,
  onClearFilters,
  onCreateOrder,
  canCreate = false,
}: WorkOrdersEmptyStateProps) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-12 text-center">
        <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
          <Search className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">No se encontraron órdenes</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          {hasFilters
            ? 'Intenta ajustar los filtros para ver más resultados o limpiar todos los filtros para ver todas las órdenes.'
            : 'Crea tu primera orden de trabajo para comenzar a gestionar el mantenimiento.'}
        </p>
        {hasFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="text-xs">
            <X className="h-3.5 w-3.5 mr-1.5" />
            Limpiar filtros
          </Button>
        ) : (
          canCreate && onCreateOrder && (
            <Button onClick={onCreateOrder} size="sm" className="text-xs">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Crear Primera Orden
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
