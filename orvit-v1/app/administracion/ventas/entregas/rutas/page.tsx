'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Calendar,
  Truck,
  Download,
  RefreshCw,
  Loader2,
  Route,
  User,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { RoutePlanner } from '@/components/ventas/route-planner';
import { DeliveryMap } from '@/components/ventas/delivery-map';

interface Delivery {
  id: number;
  numero: string;
  estado: string;
  fechaProgramada: string | null;
  direccionEntrega: string | null;
  conductorNombre: string | null;
  vehiculo: string | null;
  latitud: number | null;
  longitud: number | null;
  sale: {
    numero: string;
    client: {
      businessName: string;
    };
  };
  _count: {
    items: number;
  };
}

export default function DeliveryRoutesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [loading, setLoading] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState<number[]>([]);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    loadDeliveries();
  }, [selectedDate]);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        fechaProgramadaDesde: selectedDate,
        fechaProgramadaHasta: selectedDate,
        estado: 'PENDIENTE,EN_PREPARACION,LISTA_PARA_DESPACHO',
        limit: '100',
      });

      const response = await fetch(`/api/ventas/entregas?${params}`);
      if (!response.ok) throw new Error('Error loading deliveries');

      const data = await response.json();
      setDeliveries(data.data || []);
    } catch (error) {
      console.error('Error loading deliveries:', error);
      toast.error('Error al cargar entregas');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (selectedDeliveries.length < 2) {
      toast.error('Seleccione al menos 2 entregas para optimizar');
      return;
    }

    try {
      setOptimizing(true);
      const response = await fetch('/api/ventas/entregas/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryIds: selectedDeliveries }),
      });

      if (!response.ok) throw new Error('Error optimizing route');

      const data = await response.json();
      toast.success(`Ruta optimizada: ${data.totalDistance.toFixed(1)} km, ${data.estimatedTime} min`);

      // Update delivery order
      const optimizedDeliveries = data.optimizedRoute.map((id: number) =>
        deliveries.find((d) => d.id === id)
      ).filter(Boolean);

      setDeliveries([
        ...optimizedDeliveries,
        ...deliveries.filter((d) => !selectedDeliveries.includes(d.id))
      ]);
    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Error al optimizar ruta');
    } finally {
      setOptimizing(false);
    }
  };

  const handleExportRoute = () => {
    const selected = deliveries.filter((d) => selectedDeliveries.includes(d.id));

    const csv = [
      ['Orden', 'N° Entrega', 'Cliente', 'Dirección', 'Conductor', 'Vehículo', 'Items'].join(','),
      ...selected.map((d, index) => [
        index + 1,
        d.numero,
        d.sale.client.businessName,
        d.direccionEntrega || '',
        d.conductorNombre || '',
        d.vehiculo || '',
        d._count.items
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ruta-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Ruta exportada correctamente');
  };

  const handleToggleSelection = (id: number) => {
    setSelectedDeliveries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const deliveriesWithCoordinates = deliveries.filter(
    (d) => d.latitud && d.longitud
  );

  const stats = {
    total: deliveries.length,
    selected: selectedDeliveries.length,
    withAddress: deliveries.filter((d) => d.direccionEntrega).length,
    withGPS: deliveriesWithCoordinates.length,
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planificación de Rutas</h1>
          <p className="text-muted-foreground">
            Visualiza y optimiza las rutas de entrega
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadDeliveries}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            variant="outline"
            onClick={handleExportRoute}
            disabled={selectedDeliveries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>

          <Button
            onClick={handleOptimizeRoute}
            disabled={selectedDeliveries.length < 2 || optimizing}
          >
            {optimizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Optimizando...
              </>
            ) : (
              <>
                <Route className="h-4 w-4 mr-2" />
                Optimizar Ruta
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entregas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seleccionadas</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.selected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Dirección</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withAddress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con GPS</CardTitle>
            <MapPin className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withGPS}</div>
          </CardContent>
        </Card>
      </div>

      {/* Date selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            Fecha de Entregas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Map View */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Mapa de Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryMap
              deliveries={deliveriesWithCoordinates}
              selectedIds={selectedDeliveries}
              onSelectDelivery={handleToggleSelection}
            />
          </CardContent>
        </Card>

        {/* List View */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Entregas del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <RoutePlanner
              deliveries={deliveries}
              selectedIds={selectedDeliveries}
              onToggleSelection={handleToggleSelection}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
