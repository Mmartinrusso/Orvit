'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import {
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Calendar,
  User,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface LoadOrder {
  id: number;
  numero: string;
  estado: string;
  fechaCarga: Date;
  fechaEntregaEstimada: Date;
  vehiculo?: string;
  conductorNombre?: string;
  conductorTelefono?: string;
  notas?: string;
  deliveries: Array<{
    id: number;
    numero: string;
    estado: string;
    direccionEntrega: string;
    sale: {
      numero: string;
      client: {
        legalName: string;
        address: string;
        phone: string;
      };
    };
    items: Array<{
      id: number;
      descripcion: string;
      cantidad: number;
      unidad: string;
      product: {
        name: string;
        sku: string;
      };
    }>;
  }>;
}

export default function LoadOrderDetailPage() {
  const confirm = useConfirm();
  const params = useParams();
  const router = useRouter();
  const loadOrderId = params?.id as string;

  const [loadOrder, setLoadOrder] = useState<LoadOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizingRoute, setOptimizingRoute] = useState(false);

  useEffect(() => {
    if (loadOrderId) {
      fetchLoadOrder();
    }
  }, [loadOrderId]);

  const fetchLoadOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/ordenes-carga/${loadOrderId}`);

      if (!response.ok) {
        throw new Error('Error al cargar la orden de carga');
      }

      const data = await response.json();
      setLoadOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = async () => {
    try {
      setOptimizingRoute(true);
      const response = await fetch(`/api/ventas/ordenes-carga/${loadOrderId}/optimize-route`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al optimizar ruta');
      }

      const optimized = await response.json();
      alert(`Ruta optimizada! Distancia reducida en ${optimized.improvement}%`);
      await fetchLoadOrder();
    } catch (err) {
      console.error('Error optimizing route:', err);
      alert('Error al optimizar ruta');
    } finally {
      setOptimizingRoute(false);
    }
  };

  const handleDispatch = async () => {
    const ok = await confirm({
      title: 'Confirmar despacho',
      description: '¿Confirmar despacho de esta orden de carga?',
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${loadOrderId}/despachar`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al despachar');
      }

      alert('Orden de carga despachada exitosamente');
      await fetchLoadOrder();
    } catch (err) {
      console.error('Error dispatching:', err);
      alert('Error al despachar orden de carga');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !loadOrder) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Orden de carga no encontrada'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  const estadoConfig: Record<string, { label: string; variant: any; icon: any }> = {
    PENDIENTE: { label: 'Pendiente', variant: 'secondary', icon: Clock },
    EN_PREPARACION: { label: 'Preparación', variant: 'default', icon: Package },
    EN_TRANSITO: { label: 'En Tránsito', variant: 'default', icon: Truck },
    COMPLETADA: { label: 'Completada', variant: 'default', icon: CheckCircle2 },
  };

  const config = estadoConfig[loadOrder.estado] || estadoConfig.PENDIENTE;
  const StatusIcon = config.icon;

  const totalItems = loadOrder.deliveries.reduce((sum, d) => sum + d.items.length, 0);
  const totalPackages = loadOrder.deliveries.reduce(
    (sum, d) => sum + d.items.reduce((itemSum, i) => itemSum + i.cantidad, 0),
    0
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{loadOrder.numero}</h1>
            <p className="text-muted-foreground">Orden de Carga</p>
          </div>
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="w-4 h-4" />
            {config.label}
          </Badge>
        </div>

        <div className="flex gap-2">
          {loadOrder.estado === 'PENDIENTE' && (
            <>
              <Button variant="outline" onClick={handleOptimizeRoute} disabled={optimizingRoute}>
                <Sparkles className="w-4 h-4 mr-2" />
                {optimizingRoute ? 'Optimizando...' : 'Optimizar Ruta IA'}
              </Button>
              <Button onClick={handleDispatch}>
                <Truck className="w-4 h-4 mr-2" />
                Despachar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadOrder.deliveries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paquetes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalPackages)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fecha Estimada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {new Date(loadOrder.fechaEntregaEstimada).toLocaleDateString('es-AR')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="deliveries">Entregas ({loadOrder.deliveries.length})</TabsTrigger>
          <TabsTrigger value="route">Ruta</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Número</label>
                <p className="text-lg font-semibold">{loadOrder.numero}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Estado</label>
                <p className="text-lg font-semibold">{config.label}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Fecha de Carga</label>
                <p className="text-lg">
                  {new Date(loadOrder.fechaCarga).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Entrega Estimada</label>
                <p className="text-lg">
                  {new Date(loadOrder.fechaEntregaEstimada).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {loadOrder.vehiculo && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    Vehículo
                  </label>
                  <p className="text-lg">{loadOrder.vehiculo}</p>
                </div>
              )}

              {loadOrder.conductorNombre && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Conductor
                  </label>
                  <p className="text-lg">{loadOrder.conductorNombre}</p>
                  {loadOrder.conductorTelefono && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {loadOrder.conductorTelefono}
                    </p>
                  )}
                </div>
              )}

              {loadOrder.notas && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Notas</label>
                  <p className="text-sm bg-muted p-3 rounded-md mt-1">{loadOrder.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          {loadOrder.deliveries.map((delivery, index) => (
            <Card key={delivery.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Parada {index + 1}: {delivery.sale.client.legalName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Entrega #{delivery.numero} | Orden #{delivery.sale.numero}
                    </p>
                  </div>
                  <Badge variant="outline">{delivery.estado}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Dirección de Entrega</p>
                      <p className="text-sm text-muted-foreground">{delivery.direccionEntrega}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Contacto</p>
                      <p className="text-sm text-muted-foreground">
                        {delivery.sale.client.phone || 'No especificado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Productos ({delivery.items.length})</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">SKU</th>
                          <th className="text-left p-2">Producto</th>
                          <th className="text-right p-2">Cantidad</th>
                          <th className="text-left p-2">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {delivery.items.map(item => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2 font-mono text-xs">{item.product.sku}</td>
                            <td className="p-2">{item.descripcion}</td>
                            <td className="p-2 text-right font-semibold">{item.cantidad}</td>
                            <td className="p-2">{item.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/administracion/ventas/entregas/${delivery.id}`)}>
                    Ver Detalles de Entrega
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="route" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Planificación de Ruta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  La optimización de ruta con IA reduce tiempo y distancia organizando las paradas de manera eficiente.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {loadOrder.deliveries.map((delivery, index) => (
                  <div key={delivery.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{delivery.sale.client.legalName}</p>
                      <p className="text-sm text-muted-foreground">{delivery.direccionEntrega}</p>
                    </div>
                    <Badge variant="outline">{delivery.items.length} productos</Badge>
                  </div>
                ))}
              </div>

              {loadOrder.estado === 'PENDIENTE' && (
                <div className="mt-6 flex justify-center">
                  <Button onClick={handleOptimizeRoute} disabled={optimizingRoute} size="lg">
                    <Sparkles className="w-5 h-5 mr-2" />
                    {optimizingRoute ? 'Optimizando Ruta...' : 'Optimizar Ruta con IA'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
