'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const returnSchema = z.object({
  notes: z.string().max(1000).optional(),
  productionImpact: z.string().max(500).optional(),
});

type ReturnFormData = z.infer<typeof returnSchema>;

interface ReturnToProductionDialogProps {
  downtimeLogId?: number | null;
  workOrderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog para confirmar Retorno a Producción
 *
 * CRÍTICO: Este dialog SIEMPRE debe:
 * 1. Cerrar DowntimeLog.endedAt = ahora (si hay downtimeLogId)
 * 2. Marcar WorkOrder.returnToProductionConfirmed = true
 * 3. Si QA requiere confirmación, también marcar QA
 *
 * Sin esto, la OT NO puede cerrarse
 */
export function ReturnToProductionDialog({
  downtimeLogId,
  workOrderId,
  open,
  onOpenChange,
}: ReturnToProductionDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
  });

  const returnMutation = useMutation({
    mutationFn: async (data: ReturnFormData) => {
      // Si hay downtimeLogId, usar el endpoint de downtime
      // Si no, usar el endpoint de work-order para marcar retorno directo
      const url = downtimeLogId
        ? `/api/downtime/${downtimeLogId}/confirm-return`
        : `/api/work-orders/${workOrderId}/confirm-return`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          workOrderId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al confirmar retorno');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Retorno a Producción confirmado');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      if (downtimeLogId) {
        queryClient.invalidateQueries({ queryKey: ['downtime', downtimeLogId] });
      }
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: ReturnFormData) => {
    returnMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Confirmar Retorno a Producción
          </DialogTitle>
          <DialogDescription>
            Esta acción cerrará el registro de downtime y habilitará el cierre
            de la orden de trabajo.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Solo confirme cuando la máquina/equipo
              haya vuelto a operación normal y producción esté reiniciada.
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5" id="return-form">
              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observaciones sobre el retorno a producción..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Impacto en Producción */}
              <FormField
                control={form.control}
                name="productionImpact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impacto en Producción (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Se perdieron 2 horas de producción, afectó lote XYZ..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="return-form"
            disabled={returnMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {returnMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Confirmar Retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
