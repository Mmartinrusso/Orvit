'use client';

/**
 * Barra de acciones masivas para cargas
 * Aparece cuando hay items seleccionados
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Printer,
  Download,
  Trash2,
  Copy,
  X,
} from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkPrint: () => void;
  onBulkExport: () => void;
  onBulkDuplicate: () => void;
  onBulkDelete: () => void;
  isAllSelected: boolean;
}

export default function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkPrint,
  onBulkExport,
  onBulkDuplicate,
  onBulkDelete,
  isAllSelected,
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={false}
            onCheckedChange={onSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            Seleccionar todas ({totalCount})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectAll();
            } else {
              onClearSelection();
            }
          }}
        />
        <span className="text-sm font-medium">
          {selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-2 flex-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={onBulkPrint}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={onBulkExport}
        >
          <Download className="h-4 w-4" />
          Exportar
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={onBulkDuplicate}
        >
          <Copy className="h-4 w-4" />
          Duplicar
        </Button>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          onClick={onBulkDelete}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={onClearSelection}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
