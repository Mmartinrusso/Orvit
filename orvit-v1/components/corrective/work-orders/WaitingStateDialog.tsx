'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogBody,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';

const waitingSchema = z.object({
  waitingReason: z.enum(['SPARE_PART', 'VENDOR', 'PRODUCTION', 'OTHER'], {
    required_error: 'Seleccione un motivo',
  }),
  waitingDescription: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(500),
  waitingETA: z.string({ required_error: 'ETA requerido' }),
});

type WaitingFormData = z.infer<typeof waitingSchema>;

interface WaitingStateDialogProps {
  workOrderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const reasonLabels = {
  SPARE_PART: 'Esperando Repuesto',
  VENDOR: 'Esperando Proveedor/Externo',
  PRODUCTION: 'Esperando Ventana de Producción',
  OTHER: 'Otro Motivo',
};

/**
 * Dialog para poner Work Order en espera
 *
 * Validaciones:
 * - Motivo obligatorio
 * - ETA obligatorio y debe ser fecha futura
 * - Descripción mínima 10 caracteres
 */
export function WaitingStateDialog({
  workOrderId,
  open,
  onOpenChange,
}: WaitingStateDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<WaitingFormData>({
    resolver: zodResolver(waitingSchema),
    defaultValues: {
      waitingReason: 'SPARE_PART',
      waitingETA: format(addDays(new Date(), 3), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  const waitingMutation = useMutation({
    mutationFn: async (data: WaitingFormData) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/waiting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al poner en espera');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Orden puesta en espera');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: WaitingFormData) => {
    waitingMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Poner en Espera</DialogTitle>
          <DialogDescription>
            Indique el motivo y el tiempo estimado de espera. La orden se
            bloqueará hasta que sea reanudada manualmente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} id="waiting-form">
            <DialogBody className="px-6 py-5 space-y-5">
              {/* Motivo */}
              <FormField
                control={form.control}
                name="waitingReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de Espera *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione motivo..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(reasonLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descripción */}
              <FormField
                control={form.control}
                name="waitingDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Esperando rodamiento SKF 6205. Pedido realizado el 10/01."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ETA */}
              <FormField
                control={form.control}
                name="waitingETA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Estimada de Resolución (ETA) *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogBody>
          </form>
        </Form>

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" form="waiting-form" disabled={waitingMutation.isPending}>
            {waitingMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Poner en Espera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
