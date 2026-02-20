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
  DialogBody,
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const immediateCloseSchema = z.object({
  diagnosis: z.string().min(5, 'Mínimo 5 caracteres'),
  solution: z.string().min(5, 'Mínimo 5 caracteres'),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ']),
  actualMinutes: z.number().int().positive().optional(),
  closeDowntime: z.boolean().default(false),
  notes: z.string().optional(),
});

type ImmediateCloseFormData = z.infer<typeof immediateCloseSchema>;

interface ImmediateCloseDialogProps {
  failureId: number;
  failureTitle?: string;
  hasActiveDowntime?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Dialog para resolver una falla inmediatamente sin crear OT formal
 * Respeta reglas de downtime
 */
export function ImmediateCloseDialog({
  failureId,
  failureTitle,
  hasActiveDowntime = false,
  open,
  onOpenChange,
  onSuccess,
}: ImmediateCloseDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<ImmediateCloseFormData>({
    resolver: zodResolver(immediateCloseSchema),
    defaultValues: {
      diagnosis: '',
      solution: '',
      outcome: 'FUNCIONÓ',
      closeDowntime: hasActiveDowntime, // Auto-marcar si hay downtime
      notes: '',
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (data: ImmediateCloseFormData) => {
      const res = await fetch(
        `/api/failure-occurrences/${failureId}/immediate-close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            actualMinutes: data.actualMinutes || undefined,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al cerrar falla');
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success('Falla resuelta exitosamente');
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

  const handleSubmit = (data: ImmediateCloseFormData) => {
    closeMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Resolver Inmediatamente
          </DialogTitle>
          <DialogDescription className="text-sm">
            {failureTitle
              ? `Resolver: ${failureTitle}`
              : 'Complete la información para cerrar la falla'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <DialogBody className="space-y-5">
              {/* Alerta de downtime activo */}
              {hasActiveDowntime && (
                <Alert variant="destructive">
                  <Clock className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Hay un downtime activo. Al resolver, se cerrará automáticamente
                    el registro de parada.
                  </AlertDescription>
                </Alert>
              )}

              {/* Diagnóstico */}
              <FormField
                control={form.control}
                name="diagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">¿Qué encontraste? *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe el diagnóstico de la falla..."
                        rows={3}
                        className="text-sm resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Solución */}
              <FormField
                control={form.control}
                name="solution"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">¿Qué hiciste? *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe la solución aplicada..."
                        rows={3}
                        className="text-sm resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Resultado y Tiempo en grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Resultado */}
                <FormField
                  control={form.control}
                  name="outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Resultado *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FUNCIONÓ">
                            <span className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                              Funcionó
                            </span>
                          </SelectItem>
                          <SelectItem value="PARCIAL">
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                              Parcial
                            </span>
                          </SelectItem>
                          <SelectItem value="NO_FUNCIONÓ">
                            <span className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                              No funcionó
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tiempo real */}
                <FormField
                  control={form.control}
                  name="actualMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Tiempo (minutos)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ej: 30"
                          min={1}
                          className="h-10"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Cerrar downtime automáticamente */}
              {hasActiveDowntime && (
                <FormField
                  control={form.control}
                  name="closeDowntime"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/30">
                      <div className="space-y-1">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          Confirmar Retorno a Producción
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Cerrar el downtime activo automáticamente
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
              )}

              {/* Notas adicionales */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Notas adicionales</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Información adicional..."
                        rows={2}
                        className="text-sm resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </DialogBody>

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
                disabled={closeMutation.isPending}
                className="bg-success hover:bg-success/90"
              >
                {closeMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Resolver Falla
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
