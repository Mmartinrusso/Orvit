'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Save,
  Loader2,
  Package,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

const formSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  shiftId: z.number().min(1, 'Seleccione un turno'),
  productionOrderId: z.number().optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  operatorId: z.number().min(1, 'Seleccione un operador'),
  supervisorId: z.number().optional().nullable(),
  teamSize: z.number().optional().nullable(),
  goodQuantity: z.number().min(0, 'La cantidad no puede ser negativa'),
  scrapQuantity: z.number().min(0).default(0),
  reworkQuantity: z.number().min(0).default(0),
  uom: z.string().min(1, 'Seleccione una unidad'),
  shiftDurationMinutes: z.number().min(1, 'Duración requerida'),
  productiveMinutes: z.number().min(0),
  downtimeMinutes: z.number().min(0).default(0),
  setupMinutes: z.number().min(0).default(0),
  observations: z.string().optional().nullable(),
  issues: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewDailyReportFormProps {
  preselectedOrderId?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ProductionOrder {
  id: number;
  code: string;
  status: string;
  targetUom: string;
  product: {
    name: string;
    code: string;
  };
  workCenter?: {
    id: number;
    name: string;
  };
}

export default function NewDailyReportForm({
  preselectedOrderId,
  onSuccess,
  onCancel,
}: NewDailyReportFormProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [shifts, setShifts] = useState<{ id: number; code: string; name: string; breakMinutes: number }[]>([]);
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      shiftId: 0,
      productionOrderId: preselectedOrderId || null,
      workCenterId: null,
      operatorId: user?.id || 0,
      supervisorId: null,
      teamSize: 1,
      goodQuantity: 0,
      scrapQuantity: 0,
      reworkQuantity: 0,
      uom: 'unidades',
      shiftDurationMinutes: 480, // 8 hours default
      productiveMinutes: 450,
      downtimeMinutes: 0,
      setupMinutes: 30,
      observations: '',
      issues: '',
    },
  });

  const fetchMasterData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [shiftsRes, workCentersRes, ordersRes, usersRes] = await Promise.all([
        fetch('/api/production/shifts?activeOnly=true'),
        fetch('/api/production/work-centers?status=ACTIVE'),
        fetch('/api/production/orders?status=IN_PROGRESS,PAUSED&limit=100'),
        fetch('/api/users?limit=200'),
      ]);

      const [shiftsData, workCentersData, ordersData, usersData] = await Promise.all([
        shiftsRes.json(),
        workCentersRes.json(),
        ordersRes.json(),
        usersRes.json(),
      ]);

      if (shiftsData.success) {
        setShifts(shiftsData.shifts);
        // Auto-select first shift if only one
        if (shiftsData.shifts.length === 1) {
          form.setValue('shiftId', shiftsData.shifts[0].id);
        }
      }

      if (workCentersData.success) setWorkCenters(workCentersData.workCenters);
      if (ordersData.success) setOrders(ordersData.orders);
      if (usersData.users) setUsers(usersData.users);

      // Set operator to current user
      if (user?.id) {
        form.setValue('operatorId', user.id);
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoadingData(false);
    }
  }, [form, user?.id]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Auto-set UOM and workCenter when order is selected
  const selectedOrderId = form.watch('productionOrderId');
  useEffect(() => {
    if (selectedOrderId) {
      const order = orders.find(o => o.id === selectedOrderId);
      if (order) {
        form.setValue('uom', order.targetUom);
        if (order.workCenter) {
          form.setValue('workCenterId', order.workCenter.id);
        }
      }
    }
  }, [selectedOrderId, orders, form]);

  // Auto-calculate shift duration when shift is selected
  const selectedShiftId = form.watch('shiftId');
  useEffect(() => {
    const shift = shifts.find(s => s.id === selectedShiftId);
    if (shift) {
      // Default to 8 hours minus break
      const duration = 480 - (shift.breakMinutes || 30);
      form.setValue('shiftDurationMinutes', 480);
      form.setValue('productiveMinutes', duration);
    }
  }, [selectedShiftId, shifts, form]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Parte registrado exitosamente');
        onSuccess();
      } else {
        toast.error(data.error || 'Error al registrar el parte');
      }
    } catch (error) {
      console.error('Error creating report:', error);
      toast.error('Error al registrar el parte');
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shiftId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Turno *</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(parseInt(val))}
                  value={field.value?.toString() || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar turno" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {shifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.id.toString()}>
                        {shift.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Order Selection */}
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
                    <SelectValue placeholder="Sin orden (producción general)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="_none">Sin orden asociada</SelectItem>
                  {orders.map(order => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      {order.code} - {order.product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Asocie el parte a una orden de producción activa
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Work Center & Operator */}
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
            name="operatorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operador *</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(parseInt(val))}
                  value={field.value?.toString() || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar operador" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Production Quantities */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Producción
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="goodQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad Buena *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scrapQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scrap</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="uom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad *</FormLabel>
                  <FormControl>
                    <Input placeholder="unidades, kg, m2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Time Tracking */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h3 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tiempos (minutos)
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="shiftDurationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duración Turno</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="productiveMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Productivos</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="downtimeMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paradas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="setupMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setup</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Observations */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observaciones</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Observaciones del turno..."
                    {...field}
                    value={field.value || ''}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="issues"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Problemas / Incidentes
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Problemas o incidentes..."
                    {...field}
                    value={field.value || ''}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                Guardar Parte
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
