'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Save,
  Package,
  Calendar,
  Factory,
  User,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useTheme } from '@/components/providers/ThemeProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';

const formSchema = z.object({
  productId: z.string().min(1, 'Seleccione un producto'),
  recipeId: z.string().optional().nullable(),
  plannedQuantity: z.number().positive('La cantidad debe ser mayor a 0'),
  targetUom: z.string().min(1, 'Seleccione una unidad'),
  plannedStartDate: z.string().min(1, 'Seleccione la fecha de inicio'),
  plannedEndDate: z.string().optional().nullable(),
  workCenterId: z.number().optional().nullable(),
  sectorId: z.number().optional().nullable(),
  responsibleId: z.number().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  code: string;
  unit: string;
}

interface WorkCenter {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface Sector {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function NewProductionOrderPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: '',
      recipeId: null,
      plannedQuantity: 0,
      targetUom: '',
      plannedStartDate: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
      plannedEndDate: null,
      workCenterId: null,
      sectorId: null,
      responsibleId: null,
      priority: 'NORMAL',
      notes: '',
    },
  });

  const fetchMasterData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [productsRes, workCentersRes, sectorsRes, usersRes] = await Promise.all([
        fetch('/api/costs/products?limit=500'),
        fetch('/api/production/work-centers?status=ACTIVE'),
        fetch('/api/sectors'),
        fetch('/api/users?limit=200'),
      ]);

      const [productsData, workCentersData, sectorsData, usersData] = await Promise.all([
        productsRes.json(),
        workCentersRes.json(),
        sectorsRes.json(),
        usersRes.json(),
      ]);

      if (productsData.products) {
        setProducts(productsData.products);
      }

      if (workCentersData.success) {
        setWorkCenters(workCentersData.workCenters);
      }

      if (sectorsData.sectors) {
        setSectors(sectorsData.sectors);
      }

      if (usersData.users) {
        setUsers(usersData.users);
      }
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

  // Auto-set UOM when product is selected
  const selectedProduct = products.find(p => p.id === form.watch('productId'));
  useEffect(() => {
    if (selectedProduct && !form.getValues('targetUom')) {
      form.setValue('targetUom', selectedProduct.unit || 'unidades');
    }
  }, [selectedProduct, form]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          plannedStartDate: new Date(values.plannedStartDate).toISOString(),
          plannedEndDate: values.plannedEndDate
            ? new Date(values.plannedEndDate).toISOString()
            : null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Orden ${data.order.code} creada exitosamente`);
        router.push(`/produccion/ordenes/${data.order.id}`);
      } else {
        toast.error(data.error || 'Error al crear la orden');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="px-4 md:px-6 py-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Cargando datos del pedido...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">
            Nueva Orden de Producción
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete los datos para crear una nueva orden
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Product Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Producto
              </CardTitle>
              <CardDescription>
                Seleccione el producto a fabricar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.code} - {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plannedQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad Planificada *</FormLabel>
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
                  name="targetUom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad de Medida *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ej: unidades, kg, m2"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Programación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plannedStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha/Hora Inicio *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha/Hora Fin (opcional)</FormLabel>
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

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar prioridad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LOW">Baja</SelectItem>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="HIGH">Alta</SelectItem>
                        <SelectItem value="URGENT">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Assignment Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Asignación
              </CardTitle>
              <CardDescription>
                Asigne un centro de trabajo y responsable (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="workCenterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro de Trabajo</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val && val !== 'none' ? parseInt(val) : null)}
                      value={field.value?.toString() || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar centro" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {workCenters.map(wc => (
                          <SelectItem key={wc.id} value={wc.id.toString()}>
                            [{wc.type}] {wc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val && val !== 'none' ? parseInt(val) : null)}
                        value={field.value?.toString() || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {sectors.map(sector => (
                            <SelectItem key={sector.id} value={sector.id.toString()}>
                              {sector.name}
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
                  name="responsibleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsable</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val && val !== 'none' ? parseInt(val) : null)}
                        value={field.value?.toString() || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar responsable" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {users.map(user => (
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
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Instrucciones adicionales, observaciones..."
                        {...field}
                        value={field.value || ''}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Crear Orden
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
