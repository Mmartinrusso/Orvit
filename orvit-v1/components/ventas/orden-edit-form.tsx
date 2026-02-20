'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useApiClient } from '@/hooks/use-api-client';

const itemSchema = z.object({
  id: z.number().optional(),
  productId: z.string().optional(),
  codigo: z.string().optional(),
  descripcion: z.string().min(1, 'Descripción requerida'),
  cantidad: z.number().min(0.01, 'Cantidad debe ser mayor a 0'),
  unidad: z.string().default('UN'),
  precioUnitario: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
  descuento: z.number().min(0).max(100).default(0),
  notas: z.string().optional(),
});

const ordenSchema = z.object({
  clientId: z.string().min(1, 'Cliente requerido'),
  sellerId: z.number().optional(),
  fechaEmision: z.string(),
  fechaEntregaEstimada: z.string().optional(),
  condicionesPago: z.string().optional(),
  diasPlazo: z.number().optional(),
  lugarEntrega: z.string().optional(),
  descuentoGlobal: z.number().min(0).max(100).default(0),
  notas: z.string().optional(),
  notasInternas: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Debe agregar al menos un item'),
});

type OrdenFormData = z.infer<typeof ordenSchema>;

interface OrdenEditFormProps {
  orden: any;
  clientes: any[];
  vendedores: any[];
  productos: any[];
}

export function OrdenEditForm({ orden, clientes, vendedores, productos }: OrdenEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { put: apiPut } = useApiClient({ silent: true });
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<OrdenFormData>({
    resolver: zodResolver(ordenSchema),
    defaultValues: {
      clientId: orden.clientId,
      sellerId: orden.sellerId || undefined,
      fechaEmision: orden.fechaEmision?.split('T')[0],
      fechaEntregaEstimada: orden.fechaEntregaEstimada?.split('T')[0],
      condicionesPago: orden.condicionesPago || '',
      diasPlazo: orden.diasPlazo || undefined,
      lugarEntrega: orden.lugarEntrega || '',
      descuentoGlobal: Number(orden.descuentoGlobal) || 0,
      notas: orden.notas || '',
      notasInternas: orden.notasInternas || '',
      items: orden.items?.map((item: any) => ({
        id: item.id,
        productId: item.productId || '',
        codigo: item.codigo || '',
        descripcion: item.descripcion,
        cantidad: Number(item.cantidad),
        unidad: item.unidad,
        precioUnitario: Number(item.precioUnitario),
        descuento: Number(item.descuento) || 0,
        notas: item.notas || '',
      })) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchItems = form.watch('items');
  const watchDescuentoGlobal = form.watch('descuentoGlobal');

  // Cálculo de totales en tiempo real
  const calcularTotales = () => {
    const subtotalItems = watchItems.reduce((sum, item) => {
      const subtotal = item.cantidad * item.precioUnitario;
      const descuentoItem = subtotal * (item.descuento / 100);
      return sum + (subtotal - descuentoItem);
    }, 0);

    const descuentoGlobalMonto = subtotalItems * (watchDescuentoGlobal / 100);
    const subtotal = subtotalItems - descuentoGlobalMonto;
    const iva = subtotal * 0.21; // TODO: Hacer configurable
    const total = subtotal + iva;

    return {
      subtotalItems,
      descuentoGlobalMonto,
      subtotal,
      iva,
      total,
    };
  };

  const totales = calcularTotales();

  const onSubmit = async (data: OrdenFormData) => {
    setSubmitting(true);

    const { error } = await apiPut(`/api/ventas/ordenes/${orden.id}`, data);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: 'Orden actualizada',
      description: 'La orden se actualizó correctamente',
    });

    router.push(`/administracion/ventas/ordenes/${orden.id}`);
    setSubmitting(false);
  };

  const handleAgregarItem = () => {
    append({
      codigo: '',
      descripcion: '',
      cantidad: 1,
      unidad: 'UN',
      precioUnitario: 0,
      descuento: 0,
      notas: '',
    });
  };

  const handleSeleccionarProducto = (index: number, productId: string) => {
    const producto = productos.find(p => p.id === productId);
    if (producto) {
      form.setValue(`items.${index}.productId`, producto.id);
      form.setValue(`items.${index}.codigo`, producto.code);
      form.setValue(`items.${index}.descripcion`, producto.name);
      form.setValue(`items.${index}.unidad`, producto.unit || 'UN');
      // TODO: Obtener precio según lista del cliente
      form.setValue(`items.${index}.precioUnitario`, Number(producto.salePrice || 0));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Cabecera */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.legalName || cliente.name}
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
              name="sellerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar vendedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendedores.map((vendedor) => (
                        <SelectItem key={vendedor.id} value={vendedor.id.toString()}>
                          {vendedor.name}
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
              name="fechaEmision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Emisión *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fechaEntregaEstimada"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha Entrega Estimada</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condicionesPago"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condiciones de Pago</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 30 días, Contado, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="diasPlazo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Días de Plazo</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="lugarEntrega"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lugar de Entrega</FormLabel>
                    <FormControl>
                      <Input placeholder="Dirección de entrega" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items de la Orden</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={handleAgregarItem}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay items. Haga clic en "Agregar Item" para comenzar.
              </p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4 relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Selector de producto */}
                  <div className="md:col-span-2">
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={(value) => handleSeleccionarProducto(index, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Buscar producto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {productos.map((producto) => (
                          <SelectItem key={producto.id} value={producto.id}>
                            {producto.code} - {producto.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <FormField
                    control={form.control}
                    name={`items.${index}.codigo`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="Código" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.descripcion`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción *</FormLabel>
                          <FormControl>
                            <Input placeholder="Descripción del producto" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.cantidad`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.unidad`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad</FormLabel>
                        <FormControl>
                          <Input placeholder="UN" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.precioUnitario`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio Unitario *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`items.${index}.descuento`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desc. %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <div className="w-full">
                      <FormLabel>Subtotal</FormLabel>
                      <p className="text-lg font-semibold">
                        ${(watchItems[index].cantidad * watchItems[index].precioUnitario * (1 - watchItems[index].descuento / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name={`items.${index}.notas`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas del Item</FormLabel>
                      <FormControl>
                        <Input placeholder="Observaciones específicas del item" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Descuento y Totales */}
        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="descuentoGlobal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descuento Global (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      max="100"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal Items</span>
                <span className="font-mono">${totales.subtotalItems.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              {totales.descuentoGlobalMonto > 0 && (
                <div className="flex justify-between text-sm text-warning-muted-foreground">
                  <span>Descuento Global ({watchDescuentoGlobal}%)</span>
                  <span className="font-mono">- ${totales.descuentoGlobalMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Subtotal</span>
                <span className="font-mono">${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (21%)</span>
                <span className="font-mono">${totales.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>TOTAL</span>
                <span className="font-mono text-2xl">${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader>
            <CardTitle>Notas y Observaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Públicas (visibles para el cliente)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notas que aparecerán en documentos..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notasInternas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Internas (uso interno)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Observaciones internas..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            <Save className="h-4 w-4 mr-2" />
            {submitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
