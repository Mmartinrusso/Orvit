'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
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
import { toast } from 'sonner';
import { format } from 'date-fns';

const formSchema = z.object({
  type: z.enum(['PLANNED', 'UNPLANNED']),
  reasonCodeId: z.number().optional().nullable(),
  description: z.string().min(1, 'La descripción es requerida'),
  rootCause: z.string().optional().nullable(),
  startTime: z.string().min(1, 'La hora de inicio es requerida'),
  endTime: z.string().optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  machineId: z.number().optional().nullable(),
  productionOrderId: z.number().optional().nullable(),
  shiftId: z.number().optional().nullable(),
  affectsLine: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface NewDowntimeFormProps {
  preselectedOrderId?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function NewDowntimeForm({
  preselectedOrderId,
  onSuccess,
  onCancel,
}: NewDowntimeFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [reasonCodes, setReasonCodes] = useState<{ id: number; code: string; name: string; triggersMaintenance: boolean }[]>([]);
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [machines, setMachines] = useState<{ id: number; name: string }[]>([]);
  const [orders, setOrders] = useState<{ id: number; code: string; product: { name: string } }[]>([]);
  const [shifts, setShifts] = useState<{ id: number; name: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'UNPLANNED',
      reasonCodeId: null,
      description: '',
      rootCause: '',
      startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: null,
      workCenterId: null,
      machineId: null,
      productionOrderId: preselectedOrderId || null,
      shiftId: null,
      affectsLine: true,
    },
  });

  const fetchMasterData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [rcRes, wcRes, machinesRes, ordersRes, shiftsRes] = await Promise.all([
        fetch('/api/production/reason-codes?type=DOWNTIME&activeOnly=true&flat=true'),
        fetch('/api/production/work-centers?status=ACTIVE'),
        fetch('/api/machines?limit=200'),
        fetch('/api/production/orders?status=IN_PROGRESS,PAUSED&limit=100'),
        fetch('/api/production/shifts?activeOnly=true'),
      ]);

      const [rcData, wcData, machinesData, ordersData, shiftsData] = await Promise.all([
        rcRes.json(),
        wcRes.json(),
        machinesRes.json(),
        ordersRes.json(),
        shiftsRes.json(),
      ]);

      if (rcData.success) setReasonCodes(rcData.reasonCodes);
      if (wcData.success) setWorkCenters(wcData.workCenters);
      if (machinesData.machines) setMachines(machinesData.machines);
      if (ordersData.success) setOrders(ordersData.orders);
      if (shiftsData.success) setShifts(shiftsData.shifts);
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/downtimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          startTime: new Date(values.startTime).toISOString(),
          endTime: values.endTime ? new Date(values.endTime).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Parada registrada');
        if (data.suggestWorkOrder) {
          toast.info('Se sugiere crear una orden de trabajo para esta parada');
        }
        onSuccess();
      } else {
        toast.error(data.error || 'Error al registrar la parada');
      }
    } catch (error) {
      console.error('Error creating downtime:', error);
      toast.error('Error al registrar la parada');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const selectedReasonCode = reasonCodes.find(rc => rc.id === form.watch('reasonCodeId'));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Type and Reason Code */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="UNPLANNED">No Planificada</SelectItem>
                    <SelectItem value="PLANNED">Planificada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reasonCodeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de Motivo</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val && val !== '_none' ? parseInt(val) : null)}
                  value={field.value?.toString() || '_none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar motivo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Sin código</SelectItem>
                    {reasonCodes.map(rc => (
                      <SelectItem key={rc.id} value={rc.id.toString()}>
                        [{rc.code}] {rc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedReasonCode?.triggersMaintenance && (
                  <FormDescription className="text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Se sugerirá crear OT
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describa la parada..."
                  {...field}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Times */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tiempos
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inicio *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fin (vacío si sigue en curso)</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="workCenterId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Centro de Trabajo</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val && val !== '_none' ? parseInt(val) : null)}
                  value={field.value?.toString() || '_none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar centro" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Sin asignar</SelectItem>
                    {workCenters.map(wc => (
                      <SelectItem key={wc.id} value={wc.id.toString()}>
                        {wc.name}
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
            name="machineId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Máquina</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val && val !== '_none' ? parseInt(val) : null)}
                  value={field.value?.toString() || '_none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar máquina" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Sin asignar</SelectItem>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Production Order and Shift */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="productionOrderId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orden de Producción</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val && val !== '_none' ? parseInt(val) : null)}
                  value={field.value?.toString() || '_none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin orden asociada" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Sin orden</SelectItem>
                    {orders.map(o => (
                      <SelectItem key={o.id} value={o.id.toString()}>
                        {o.code} - {o.product.name}
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
            name="shiftId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Turno</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val && val !== '_none' ? parseInt(val) : null)}
                  value={field.value?.toString() || '_none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar turno" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Sin asignar</SelectItem>
                    {shifts.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Root Cause */}
        <FormField
          control={form.control}
          name="rootCause"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Causa Raíz (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Análisis de causa raíz..."
                  {...field}
                  value={field.value || ''}
                  rows={2}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Affects Line */}
        <FormField
          control={form.control}
          name="affectsLine"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Afecta toda la línea</FormLabel>
                <FormDescription>
                  Marcar si la parada detiene toda la línea de producción
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Registrar Parada
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
