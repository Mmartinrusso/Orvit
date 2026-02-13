'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectionSummaryChipsProps {
  machineName?: string;
  componentNames?: string[];
  subcomponentNames?: string[];
  onClear?: () => void;
  className?: string;
  maxItems?: number;
}

export function SelectionSummaryChips({
  machineName,
  componentNames = [],
  subcomponentNames = [],
  onClear,
  className,
  maxItems = 3
}: SelectionSummaryChipsProps) {
  const hasSelection = machineName || componentNames.length > 0 || subcomponentNames.length > 0;

  if (!hasSelection) return null;

  return (
    <Card className={cn('p-4 bg-muted/30 border rounded-lg', className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Resumen de selección</span>
        </div>
        {onClear && (componentNames.length > 0 || subcomponentNames.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar selección
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {machineName && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Wrench className="h-3 w-3 mr-1" />
            {machineName}
          </Badge>
        )}
        {componentNames.slice(0, maxItems).map((name, idx) => (
          <Badge key={idx} variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {name}
          </Badge>
        ))}
        {componentNames.length > maxItems && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            +{componentNames.length - maxItems} más
          </Badge>
        )}
        {subcomponentNames.slice(0, maxItems).map((name, idx) => (
          <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {name}
          </Badge>
        ))}
        {subcomponentNames.length > maxItems && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            +{subcomponentNames.length - maxItems} más
          </Badge>
        )}
        {!machineName && componentNames.length === 0 && subcomponentNames.length === 0 && (
          <span className="text-xs text-muted-foreground">No hay componentes seleccionados</span>
        )}
      </div>
    </Card>
  );
}
