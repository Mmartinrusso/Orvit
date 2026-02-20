'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
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
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Schema para editar falla
 */
const editFailureSchema = z.object({
  title: z.string().min(5, 'Mínimo 5 caracteres').max(100),
  description: z.string().optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  status: z.enum(['REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']),
  causedDowntime: z.boolean(),
  isIntermittent: z.boolean(),
  isSafetyRelated: z.boolean(),
});

type EditFailureFormData = z.infer<typeof editFailureSchema>;

interface EditFailureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failureId: number | null;
  onSuccess?: () => void;
}

const priorityOptions = [
  { value: 'P1', label: 'P1 - Urgente', color: 'text-destructive' },
  { value: 'P2', label: 'P2 - Alta', color: 'text-warning-muted-foreground' },
  { value: 'P3', label: 'P3 - Media', color: 'text-warning-muted-foreground' },
  { value: 'P4', label: 'P4 - Baja', color: 'text-info-muted-foreground' },
];

const statusOptions = [
  { value: 'REPORTED', label: 'Reportada' },
  { value: 'IN_PROGRESS', label: 'En Proceso' },
  { value: 'RESOLVED', label: 'Resuelta' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export function EditFailureDialog({
  open,
  onOpenChange,
  failureId,
  onSuccess,
}: EditFailureDialogProps) {
  const queryClient = useQueryClient();

  // Cargar datos de la falla
  const { data: failure, isLoading } = useQuery({
    queryKey: ['failure-occurrence', failureId],
    queryFn: async () => {
      if (!failureId) return null;
      const res = await fetch(`/api/failure-occurrences/${failureId}`);
      if (!res.ok) throw new Error('Error al cargar la falla');
      return res.json();
    },
    enabled: open && !!failureId,
  });

  const form = useForm<EditFailureFormData>({
    resolver: zodResolver(editFailureSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'P3',
      status: 'REPORTED',
      causedDowntime: false,
      isIntermittent: false,
      isSafetyRelated: false,
    },
  });

  // Cargar datos cuando la falla se carga
  useEffect(() => {
    if (failure) {
      form.reset({
        title: failure.title || '',
        description: failure.description || '',
        priority: failure.priority || 'P3',
        status: failure.status || 'REPORTED',
        causedDowntime: failure.causedDowntime || false,
        isIntermittent: failure.isIntermittent || false,
        isSafetyRelated: failure.isSafetyRelated || false,
      });
    }
  }, [failure, form]);

  // Mutation para actualizar
  const updateMutation = useMutation({
    mutationFn: async (data: EditFailureFormData) => {
      if (!failureId) throw new Error('No failure ID');
      const res = await fetch(`/api/failure-occurrences/${failureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar la falla');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Falla actualizada correctamente');
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['failure-occurrence', failureId] });
      queryClient.invalidateQueries({ queryKey: ['failure-kpis'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar', {
        description: error.message,
      });
    },
  });

  const onSubmit = (data: EditFailureFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Falla
          </DialogTitle>
          <DialogDescription>
            Modifica los datos de la falla reportada
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 px-6 py-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="edit-failure-form">
              <DialogBody className="px-6 py-5 space-y-5">
              {/* Título */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título de la falla" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descripción */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción detallada..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Prioridad y Estado */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priorityOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className={opt.color}>{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Switches */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="causedDowntime"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Causó Downtime</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          ¿Esta falla detuvo la producción?
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

                <FormField
                  control={form.control}
                  name="isIntermittent"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Intermitente</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          ¿La falla ocurre de forma intermitente?
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

                <FormField
                  control={form.control}
                  name="isSafetyRelated"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Riesgo de Seguridad</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          ¿Representa un riesgo para la seguridad?
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
              </div>
              </DialogBody>
            </form>
          </Form>
        )}

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-failure-form"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
