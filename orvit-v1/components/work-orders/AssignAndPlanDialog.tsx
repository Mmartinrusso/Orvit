'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import {
  Loader2,
  User,
  Clock,
  Check,
  ChevronsUpDown,
  Wrench,
  Play,
  CalendarClock,
  ClipboardList,
  ArrowRight,
  X,
} from 'lucide-react';
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

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  URGENT: { label: 'Urgente (P1)', color: 'text-red-600', dot: 'bg-red-500' },
  HIGH: { label: 'Alta (P2)', color: 'text-orange-600', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Media (P3)', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  LOW: { label: 'Baja (P4)', color: 'text-blue-600', dot: 'bg-blue-500' },
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
  const [responsableOpen, setResponsableOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(assignAndPlanSchema),
    defaultValues: {
      startImmediately: false,
      notes: '',
    },
  });

  const priority = form.watch('priority') || workOrder?.priority || 'MEDIUM';
  const startImmediately = form.watch('startImmediately');
  const scheduledDate = form.watch('scheduledDate');
  const assignedToId = form.watch('assignedToId');

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

  // Nombre del responsable seleccionado
  const selectedUserName = useMemo(() => {
    if (!assignedToId || !users) return null;
    const u = users.find((u: any) => u.id === assignedToId);
    return u?.name || null;
  }, [assignedToId, users]);

  // Preview del resultado
  const resultPreview = useMemo(() => {
    if (startImmediately) {
      return { label: 'En Progreso', icon: Play, color: 'text-green-600 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900' };
    }
    if (scheduledDate) {
      return { label: 'Programada', icon: CalendarClock, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900' };
    }
    return { label: 'Pendiente', icon: ClipboardList, color: 'text-muted-foreground bg-muted/50 border-border' };
  }, [startImmediately, scheduledDate]);

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

  const prioConf = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        className="p-0 flex flex-col max-h-[90vh]"
        hideCloseButton
      >
        {/* ── Header: Info de la OT ── */}
        <div className="flex-shrink-0 bg-background border-b">
          <div className="px-5 py-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold truncate">
                  Asignar y Planificar
                </h2>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  OT #{workOrder.id}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {workOrder.title}
              </p>
              {workOrder.machine && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  <span>{workOrder.machine.name}</span>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            {/* ── Contenido scrollable ── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* ── Sección: Asignación ── */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Asignación
                </p>

                {/* Responsable — Combobox buscable */}
                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Responsable *</FormLabel>
                      <Popover open={responsableOpen} onOpenChange={setResponsableOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={responsableOpen}
                              className={cn(
                                'w-full justify-between font-normal h-10',
                                !field.value && 'text-muted-foreground'
                              )}
                              disabled={loadingUsers}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {field.value ? (
                                  <>
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-semibold text-primary">
                                        {selectedUserName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                      </span>
                                    </div>
                                    <span className="truncate">{selectedUserName}</span>
                                  </>
                                ) : (
                                  <>
                                    <User className="h-4 w-4 shrink-0" />
                                    <span>Buscar responsable...</span>
                                  </>
                                )}
                              </div>
                              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar por nombre..." />
                            <CommandList>
                              <CommandEmpty>No se encontró ningún usuario</CommandEmpty>
                              <CommandGroup>
                                {users?.map((user: any) => (
                                  <CommandItem
                                    key={user.id}
                                    value={user.name}
                                    onSelect={() => {
                                      field.onChange(user.id);
                                      setResponsableOpen(false);
                                    }}
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-medium">
                                          {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                        </span>
                                      </div>
                                      <span className="truncate">{user.name}</span>
                                    </div>
                                    <Check
                                      className={cn(
                                        'h-4 w-4 shrink-0',
                                        field.value === user.id ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Prioridad y Estimación */}
                <div className="grid grid-cols-2 gap-3">
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
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  <div className={cn('h-2 w-2 rounded-full', prioConf.dot)} />
                                  <span>{prioConf.label}</span>
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PRIORITY_CONFIG).map(([value, conf]) => (
                              <SelectItem key={value} value={value}>
                                <div className="flex items-center gap-2">
                                  <div className={cn('h-2 w-2 rounded-full', conf.dot)} />
                                  <span>{conf.label}</span>
                                </div>
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
                    name="estimatedMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimación (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="60"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* SLA calculado — compacto */}
                {calculatedSla && (
                  <div className="flex items-center gap-2 rounded-lg border border-warning-muted bg-warning-muted/50 px-3 py-2.5">
                    <Clock className="h-3.5 w-3.5 text-warning-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-foreground">
                        SLA: {format(calculatedSla, "dd/MM/yyyy HH:mm", { locale: es })}
                      </span>
                      <span className="text-xs text-warning-muted-foreground ml-1.5">
                        ({DEFAULT_SLA_HOURS[priority]}h)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Sección: Planificación ── */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Planificación
                </p>

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

                {/* Iniciar inmediatamente */}
                <FormField
                  control={form.control}
                  name="startImmediately"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <Play className="h-3.5 w-3.5 text-green-600" />
                          Iniciar inmediatamente
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Marcar como &quot;En Progreso&quot; al asignar
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
                          placeholder="Instrucciones adicionales para el técnico..."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Footer: Preview + Acción ── */}
            <div className="flex-shrink-0 border-t px-5 py-3 space-y-3">
              {/* Preview del resultado */}
              {assignedToId && (
                <div className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                  resultPreview.color
                )}>
                  <resultPreview.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Se asignará a <strong>{selectedUserName}</strong> como{' '}
                    <strong>{resultPreview.label}</strong>
                    {scheduledDate && !startImmediately && (
                      <> para el <strong>{format(scheduledDate, "dd/MM HH:mm", { locale: es })}</strong></>
                    )}
                  </span>
                </div>
              )}

              {/* Botones */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={assignMutation.isPending}
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Asignar
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
