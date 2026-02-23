'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Gauge,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  History,
  AlertTriangle,
  Clock,
  Zap,
} from 'lucide-react';
import { CounterReadingDialog } from './CounterReadingDialog';
import { CounterFormDialog } from './CounterFormDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Counter {
  id: number;
  name: string;
  unit: string;
  currentValue: number;
  lastReadingAt: string | null;
  source: string;
  lastReadingBy?: { id: number; name: string };
  triggers?: Array<{
    id: number;
    triggerEvery: number;
    nextTriggerValue: number;
    checklist: { id: number; title: string };
  }>;
  readings?: Array<{
    id: number;
    value: number;
    delta: number;
    recordedAt: string;
    recordedBy: { id: number; name: string };
  }>;
}

interface CounterPanelProps {
  machineId: number;
  machineName?: string;
}

export function CounterPanel({ machineId, machineName }: CounterPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCounter, setEditingCounter] = useState<Counter | null>(null);
  const [recordingCounter, setRecordingCounter] = useState<Counter | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Counter | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['machine-counters', machineId],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machineId}/counters`);
      if (!res.ok) throw new Error('Error fetching counters');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (counterId: number) => {
      const res = await fetch(`/api/counters/${counterId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting counter');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contador eliminado');
      queryClient.invalidateQueries({ queryKey: ['machine-counters', machineId] });
    },
    onError: () => toast.error('Error al eliminar contador'),
  });

  const counters: Counter[] = data?.counters || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Contadores de Uso
              </CardTitle>
              <CardDescription>
                Mantenimiento basado en uso para {machineName || 'esta máquina'}
              </CardDescription>
            </div>
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Contador
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {counters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gauge className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay contadores configurados</p>
              <p className="text-sm">
                Los contadores permiten programar mantenimiento basado en horas, ciclos u otras métricas
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {counters.map((counter) => (
                <CounterCard
                  key={counter.id}
                  counter={counter}
                  onRecord={() => setRecordingCounter(counter)}
                  onEdit={() => setEditingCounter(counter)}
                  onDelete={() => deleteMutation.mutate(counter.id)}
                  onViewHistory={() => setViewingHistory(counter)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CounterFormDialog
        machineId={machineId}
        counter={editingCounter}
        open={isFormOpen || !!editingCounter}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCounter(null);
        }}
      />

      {recordingCounter && (
        <CounterReadingDialog
          counter={recordingCounter}
          open={!!recordingCounter}
          onClose={() => setRecordingCounter(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['machine-counters', machineId] });
            setRecordingCounter(null);
          }}
        />
      )}

      {viewingHistory && (
        <CounterHistoryDialog
          counter={viewingHistory}
          open={!!viewingHistory}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </>
  );
}

interface CounterCardProps {
  counter: Counter;
  onRecord: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewHistory: () => void;
}

function CounterCard({ counter, onRecord, onEdit, onDelete, onViewHistory }: CounterCardProps) {
  const trigger = counter.triggers?.[0];
  const progressPercent = trigger
    ? Math.min(100, ((Number(counter.currentValue) - (Number(trigger.nextTriggerValue) - Number(trigger.triggerEvery))) / Number(trigger.triggerEvery)) * 100)
    : 0;
  const isNearTrigger = trigger && progressPercent >= 90;

  const sourceIcon = counter.source === 'IOT' ? Zap : counter.source === 'PLC' ? Zap : Clock;
  const SourceIcon = sourceIcon;

  return (
    <div className={cn('p-4 border rounded-lg', isNearTrigger && 'border-warning-muted bg-warning-muted')}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            {counter.name}
            <Badge variant="outline" className="text-xs">
              <SourceIcon className="h-3 w-3 mr-1" />
              {counter.source}
            </Badge>
          </h4>
          <p className="text-2xl font-bold mt-1">
            {Number(counter.currentValue).toLocaleString()} {counter.unit}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewHistory}>
              <History className="h-4 w-4 mr-2" />
              Ver historial
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {trigger && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Próximo PM: {trigger.checklist.title}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className={isNearTrigger ? 'bg-warning-muted' : ''} />
          <p className="text-xs text-muted-foreground mt-1">
            Cada {Number(trigger.triggerEvery).toLocaleString()} {counter.unit} |
            Próximo: {Number(trigger.nextTriggerValue).toLocaleString()} {counter.unit}
          </p>
        </div>
      )}

      {isNearTrigger && (
        <div className="flex items-center gap-2 text-warning-muted-foreground text-sm mb-3">
          <AlertTriangle className="h-4 w-4" />
          <span>Cerca del próximo mantenimiento</span>
        </div>
      )}

      {counter.lastReadingAt && (
        <p className="text-xs text-muted-foreground mb-3">
          Última lectura: {formatDistanceToNow(new Date(counter.lastReadingAt), { addSuffix: true, locale: es })}
          {counter.lastReadingBy && ` por ${counter.lastReadingBy.name}`}
        </p>
      )}

      <Button onClick={onRecord} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" />
        Registrar lectura
      </Button>
    </div>
  );
}

interface CounterHistoryDialogProps {
  counter: Counter;
  open: boolean;
  onClose: () => void;
}

function CounterHistoryDialog({ counter, open, onClose }: CounterHistoryDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['counter-readings', counter.id],
    queryFn: async () => {
      const res = await fetch(`/api/counters/${counter.id}/readings?limit=50`);
      if (!res.ok) throw new Error('Error fetching readings');
      return res.json();
    },
    enabled: open,
  });

  const readings = data?.readings || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>
            Historial: {counter.name}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : readings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay lecturas registradas
            </div>
          ) : (
            <div className="space-y-2">
              {readings.map((reading: any) => (
                <div key={reading.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {Number(reading.value).toLocaleString()} {counter.unit}
                      </p>
                      {reading.delta > 0 && (
                        <p className="text-sm text-success">
                          +{Number(reading.delta).toLocaleString()} {counter.unit}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{reading.source}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(reading.recordedAt).toLocaleString()} por {reading.recordedBy?.name}
                  </p>
                  {reading.notes && (
                    <p className="text-sm mt-1">{reading.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default CounterPanel;
