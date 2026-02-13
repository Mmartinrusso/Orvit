'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Loader2, User, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, addHours, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

// SLA por defecto según prioridad (en horas)
const DEFAULT_SLA_HOURS: Record<string, number> = {
  URGENT: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgente (P1)',
  HIGH: 'Alta (P2)',
  MEDIUM: 'Media (P3)',
  LOW: 'Baja (P4)',
};

const assignAndPlanSchema = z.object({
  assignedToId: z.number({ required_error: 'Seleccione un responsable' }),
  scheduledDate: z.date().optional(),
  estimatedMinutes: z.number().min(1).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startImmediately: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

type FormData = z.infer<typeof assignAndPlanSchema>;

interface WorkOrder {
  id: number;
  title: string;
  priority: string;
  status: string;
  machine?: { id: number; name: string };
  assignedTo?: { id: number; name: string };
}

interface AssignAndPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  onSuccess?: () => void;
}

export function AssignAndPlanDialog({
  open,
  onOpenChange,
  workOrder,
  onSuccess,
}: AssignAndPlanDialogProps) {
  const queryClient = useQueryClient();
  const [calculatedSla, setCalculatedSla] = useState<Date | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(assignAndPlanSchema),
    defaultValues: {
      startImmediately: false,
      notes: '',
    },
  });

  const priority = form.watch('priority') || workOrder?.priority || 'MEDIUM';

  // Calcular SLA cuando cambia la prioridad
  useEffect(() => {
    const slaHours = DEFAULT_SLA_HOURS[priority] || 72;
    const slaDue = addHours(new Date(), slaHours);
    setCalculatedSla(slaDue);
  }, [priority]);

  // Fetch usuarios disponibles
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const res = await fetch('/api/users?active=true&limit=100');
      if (!res.ok) throw new Error('Error al cargar usuarios');
      const data = await res.json();
      return data.users || data || [];
    },
    enabled: open,
  });

  // Mutation para asignar y planificar
  const assignMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/work-orders/${workOrder?.id}/assign-and-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al asignar');
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'OT asignada correctamente');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder?.id] });
      queryClient.invalidateQueries({ queryKey: ['dispatcher'] });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: FormData) => {
    // Convert Date to ISO string for API
    const payload = {
      ...data,
      scheduledDate: data.scheduledDate?.toISOString(),
    };
    assignMutation.mutate(payload as any);
  };

  // Reset form cuando se abre
  useEffect(() => {
    if (open && workOrder) {
      form.reset({
        assignedToId: workOrder.assignedTo?.id,
        priority: workOrder.priority as any,
        startImmediately: false,
        notes: '',
      });
    }
  }, [open, workOrder, form]);

  if (!workOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] flex flex-col p-0"
        onEscapeKeyDown={() => onOpenChange(false)}
        onPointerDownOutside={() => onOpenChange(false)}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Asignar y Planificar
          </DialogTitle>
          <DialogDescription>
            OT #{workOrder.id}: {workOrder.title}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0" id="assign-plan-form">
            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Responsable */}
              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      value={field.value?.toString()}
                      disabled={loadingUsers}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar responsable" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fecha planificada */}
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha planificada</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        minDate={startOfDay(new Date())}
                        placeholder="Seleccionar fecha y hora"
                      />
                    </FormControl>
                    <FormDescription>
                      Opcional. Si no se especifica, quedará solo asignada.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimación y Prioridad en fila */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="estimatedMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimación (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="60"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || workOrder.priority}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
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
              </div>

              {/* SLA calculado */}
              {calculatedSla && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-900">
                      SLA: {format(calculatedSla, "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {DEFAULT_SLA_HOURS[priority]}h
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-700 mt-1.5">
                    Vencimiento calculado según prioridad {PRIORITY_LABELS[priority]}
                  </p>
                </div>
              )}

              {/* Iniciar inmediatamente */}
              <FormField
                control={form.control}
                name="startImmediately"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <FormLabel>Iniciar inmediatamente</FormLabel>
                      <FormDescription>
                        Marcar la OT como "En Progreso" al asignar
                      </FormDescription>
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

              {/* Notas */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Instrucciones adicionales..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Footer fijo */}
            <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={assignMutation.isPending}>
                {assignMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Asignar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
