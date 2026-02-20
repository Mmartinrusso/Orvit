'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

interface DowntimeLog {
  id: number;
  startedAt: string;
  endedAt?: string | null;
  workOrderId?: number | null;
  machine?: {
    id: number;
    name: string;
  };
}

interface ReturnToProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downtimeLog: DowntimeLog;
  failureId: number;
}

/**
 * Dialog para confirmar retorno a producción
 * Cierra el DowntimeLog y marca WorkOrder.returnToProductionConfirmed = true
 */
export function ReturnToProductionDialog({
  open,
  onOpenChange,
  downtimeLog,
  failureId,
}: ReturnToProductionDialogProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [productionImpact, setProductionImpact] = useState('');

  // Calcular tiempo de downtime actual
  const downtimeMinutes = differenceInMinutes(
    new Date(),
    new Date(downtimeLog.startedAt)
  );
  const hours = Math.floor(downtimeMinutes / 60);
  const minutes = downtimeMinutes % 60;
  const downtimeDisplay =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;

  // Mutation para confirmar retorno
  const confirmReturnMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/downtime/${downtimeLog.id}/confirm-return`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workOrderId: downtimeLog.workOrderId,
            notes: notes.trim() || undefined,
            productionImpact: productionImpact.trim() || undefined,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al confirmar retorno');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Retorno a producción confirmado');
      // Refrescar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['failure-detail', failureId] });
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
      onOpenChange(false);
      setNotes('');
      setProductionImpact('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleConfirm = () => {
    confirmReturnMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Confirmar Retorno a Producción
          </DialogTitle>
          <DialogDescription>
            Confirme que la máquina ha vuelto a producción normal.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {/* Info del downtime */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Máquina</span>
            <span className="text-sm font-medium">
              {downtimeLog.machine?.name || 'Sin máquina'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Inicio parada</span>
            <span className="text-sm">
              {formatDistanceToNow(new Date(downtimeLog.startedAt), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Tiempo total de parada
            </span>
            <Badge
              variant={downtimeMinutes > 60 ? 'destructive' : 'secondary'}
              className="text-sm"
            >
              <Clock className="mr-1 h-3 w-3" />
              {downtimeDisplay}
            </Badge>
          </div>
        </div>

        {/* Alerta si downtime alto */}
        {downtimeMinutes > 60 && (
          <div className="rounded-lg border border-warning-muted bg-warning-muted p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning-muted-foreground">Downtime alto</p>
              <p className="text-warning-muted-foreground text-xs">
                Se recomienda documentar el impacto en producción.
              </p>
            </div>
          </div>
        )}

        {/* Campos opcionales */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="production-impact">
              Impacto en producción (opcional)
            </Label>
            <Textarea
              id="production-impact"
              placeholder="Ej: Se perdieron 50 unidades, se reprogramó turno..."
              value={productionImpact}
              onChange={(e) => setProductionImpact(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas adicionales (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones sobre el retorno a producción..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmReturnMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmReturnMutation.isPending}
            className="bg-success hover:bg-success/90"
          >
            {confirmReturnMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirmar Retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
