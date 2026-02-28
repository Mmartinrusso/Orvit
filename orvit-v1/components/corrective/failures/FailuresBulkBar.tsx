'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface FailuresBulkBarProps {
  selectedIds: number[];
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onComplete: () => void;
}

export function FailuresBulkBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onClearSelection,
  onComplete,
}: FailuresBulkBarProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  if (selectedIds.length === 0) return null;

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar fallas',
      description: `¿Eliminar ${selectedIds.length} falla${selectedIds.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    setLoading(true);
    toast.loading('Eliminando fallas...', { id: 'bulk-delete-failures' });

    try {
      const res = await fetch('/api/failure-occurrences/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, operation: 'delete' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      toast.success(`${data.updated} falla${data.updated !== 1 ? 's' : ''} eliminada${data.updated !== 1 ? 's' : ''}`, { id: 'bulk-delete-failures' });
      onClearSelection();
      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar', { id: 'bulk-delete-failures' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 px-4 py-3 bg-card border shadow-lg rounded-xl">
        {/* Contador */}
        <div className="flex items-center gap-2 pr-3 border-r border-border">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedIds.length} de {totalCount}
          </span>
          {selectedIds.length < totalCount && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onSelectAll}>
              Todos
            </Button>
          )}
        </div>

        {/* Eliminar */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          onClick={handleDelete}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Eliminar
        </Button>

        {/* Cerrar */}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
