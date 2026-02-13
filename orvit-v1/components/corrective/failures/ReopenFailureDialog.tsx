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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const reopenSchema = z.object({
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
  createNewWorkOrder: z.boolean().default(false),
});

type ReopenFormData = z.infer<typeof reopenSchema>;

interface ReopenFailureDialogProps {
  failureId: number;
  failureTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog para reabrir una falla resuelta
 */
export function ReopenFailureDialog({
  failureId,
  failureTitle,
  open,
  onOpenChange,
  onSuccess,
}: ReopenFailureDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<ReopenFormData>({
    resolver: zodResolver(reopenSchema),
    defaultValues: {
      reason: '',
      createNewWorkOrder: false,
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (data: ReopenFormData) => {
      const res = await fetch(
        `/api/failure-occurrences/${failureId}/reopen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al reabrir falla');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Falla reabierta exitosamente');
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
      queryClient.invalidateQueries({ queryKey: ['failure-detail', failureId] });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: ReopenFormData) => {
    reopenMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" />
            Reabrir Falla
          </DialogTitle>
          <DialogDescription>
            {failureTitle
              ? `Reabrir: ${failureTitle}`
              : 'Ingrese el motivo para reabrir esta falla'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Motivo */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de reapertura *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explique por qué necesita reabrir esta falla..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Crear nueva OT */}
            <FormField
              control={form.control}
              name="createNewWorkOrder"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer">
                      Crear nueva Orden de Trabajo
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Si la OT anterior fue cerrada, crear una nueva
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={reopenMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {reopenMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Reabrir Falla
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
