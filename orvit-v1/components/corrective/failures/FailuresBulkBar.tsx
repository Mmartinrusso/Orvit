'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckSquare,
  Trash2,
  X,
  Loader2,
  ArrowUpDown,
  CheckCircle,
} from 'lucide-react';
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
  const [loadingOp, setLoadingOp] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  if (selectedIds.length === 0) return null;

  const executeBulk = async (operation: string, extraData: Record<string, any> = {}, toastId: string, successMsg: string) => {
    setLoading(true);
    setLoadingOp(operation);
    toast.loading('Procesando...', { id: toastId });

    try {
      const res = await fetch('/api/failure-occurrences/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, operation, ...extraData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en operación');

      toast.success(`${successMsg} (${data.updated})`, { id: toastId });
      onClearSelection();
      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Error', { id: toastId });
    } finally {
      setLoading(false);
      setLoadingOp(null);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar fallas',
      description: `¿Eliminar ${selectedIds.length} falla${selectedIds.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    await executeBulk('delete', {}, 'bulk-delete', 'Fallas eliminadas');
  };

  const handleChangePriority = async (priority: string) => {
    await executeBulk('updatePriority', { priority }, 'bulk-priority', `Prioridad cambiada a ${priority}`);
  };

  const handleChangeStatus = async (status: string) => {
    await executeBulk('updateStatus', { status }, 'bulk-status', `Estado cambiado`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-2 px-4 py-3 bg-card border shadow-lg rounded-xl">
        {/* Counter */}
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

        {/* Change Priority */}
        <Select onValueChange={handleChangePriority} disabled={loading}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="P1">P1 - Urgente</SelectItem>
            <SelectItem value="P2">P2 - Alta</SelectItem>
            <SelectItem value="P3">P3 - Media</SelectItem>
            <SelectItem value="P4">P4 - Baja</SelectItem>
          </SelectContent>
        </Select>

        {/* Change Status */}
        <Select onValueChange={handleChangeStatus} disabled={loading}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="REPORTED">Reportada</SelectItem>
            <SelectItem value="IN_PROGRESS">En Proceso</SelectItem>
          </SelectContent>
        </Select>

        {/* Delete */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          onClick={handleDelete}
        >
          {loadingOp === 'delete' ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Eliminar
        </Button>

        {/* Close */}
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
