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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  UserPlus,
  AlertTriangle,
  Calendar,
  XCircle,
  X,
  Loader2,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WorkOrdersBulkBarProps {
  selectedIds: number[];
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  availableUsers: Array<{ id: number; name: string }>;
  onComplete: () => void; // callback after successful operation
}

export function WorkOrdersBulkBar({
  selectedIds,
  totalCount,
  onSelectAll,
  onClearSelection,
  availableUsers,
  onComplete,
}: WorkOrdersBulkBarProps) {
  const [loading, setLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  if (selectedIds.length === 0) return null;

  const executeBulk = async (operation: string, extra: Record<string, any> = {}) => {
    setLoading(true);
    const toastId = `bulk-${operation}`;
    toast.loading('Procesando operación en lote...', { id: toastId });

    try {
      const res = await fetch('/api/work-orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, operation, ...extra }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error en operación bulk');
      }

      toast.success(`${data.updated} OTs actualizadas`, { id: toastId });
      onClearSelection();
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = (userId: string) => {
    setAssignOpen(false);
    executeBulk('assign', { assignToId: Number(userId) });
  };

  const handlePriority = (priority: string) => {
    setPriorityOpen(false);
    executeBulk('updatePriority', { priority });
  };

  const handleSchedule = () => {
    if (!scheduleDate) return;
    setScheduleOpen(false);
    executeBulk('schedule', { scheduledDate: new Date(scheduleDate).toISOString() });
    setScheduleDate('');
  };

  const handleCancel = () => {
    if (!confirm(`¿Cancelar ${selectedIds.length} orden(es)? Esta acción no se puede deshacer.`)) return;
    executeBulk('cancel', { cancelReason: 'Cancelación en lote' });
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

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {/* Asignar */}
          <Popover open={assignOpen} onOpenChange={setAssignOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading} className="h-8 text-xs">
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Asignar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="center" side="top">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                Asignar técnico
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {availableUsers.map((u) => (
                  <Button
                    key={u.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs"
                    onClick={() => handleAssign(String(u.id))}
                  >
                    {u.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Prioridad */}
          <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading} className="h-8 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Prioridad
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2" align="center" side="top">
              <div className="space-y-1">
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
                  <Button
                    key={p}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs"
                    onClick={() => handlePriority(p)}
                  >
                    {p === 'LOW' ? 'Baja' : p === 'MEDIUM' ? 'Media' : p === 'HIGH' ? 'Alta' : 'Urgente'}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Programar */}
          <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading} className="h-8 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Programar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="center" side="top">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Fecha programada
              </p>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="text-xs h-8 mb-2"
              />
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!scheduleDate}
                onClick={handleSchedule}
              >
                Confirmar
              </Button>
            </PopoverContent>
          </Popover>

          {/* Cancelar */}
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleCancel}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Cancelar
          </Button>
        </div>

        {/* Loading indicator */}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {/* Cerrar selección */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-1"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
