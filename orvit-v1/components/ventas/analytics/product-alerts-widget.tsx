'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertBadge, AlertCountBadge } from './alert-badge';
import { AlertTriangle, Package, TrendingDown, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

type AlertType = 'STOCK_BAJO' | 'MARGEN_BAJO' | 'SIN_VENTAS' | 'ROTACION_LENTA';
type AlertPriority = 'ALTA' | 'MEDIA' | 'BAJA';

interface ProductAlert {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  tipo: AlertType;
  prioridad: AlertPriority;
  mensaje: string;
  detalles: {
    valorActual?: number;
    valorEsperado?: number;
    diferencia?: number;
    diasSinVenta?: number;
  };
  sugerencias: string[];
  fechaDeteccion: Date;
}

interface AlertsResponse {
  alerts: ProductAlert[];
  resumen: {
    total: number;
    porTipo: Record<AlertType, number>;
    porPrioridad: Record<AlertPriority, number>;
  };
}

interface ProductAlertsWidgetProps {
  limite?: number;
  showFilters?: boolean;
  compactMode?: boolean;
}

export function ProductAlertsWidget({
  limite = 10,
  showFilters = true,
  compactMode = false,
}: ProductAlertsWidgetProps) {
  const [tipo, setTipo] = useState<string>('all');
  const [prioridad, setPrioridad] = useState<string>('all');

  const { data, isLoading, error } = useQuery<AlertsResponse>({
    queryKey: ['product-alerts', tipo, prioridad, limite],
    queryFn: async () => {
      const params = new URLSearchParams({
        tipo,
        prioridad,
        limite: limite.toString(),
      });
      const res = await fetch(`/api/ventas/productos/analytics/alertas?${params}`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas de Productos
          </CardTitle>
          <CardDescription>Productos que requieren atención</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas de Productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Error al cargar alertas. Intenta nuevamente.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { alerts, resumen } = data!;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Productos
              {resumen.total > 0 && <AlertCountBadge count={resumen.total} prioridad="MEDIA" />}
            </CardTitle>
            <CardDescription>
              {resumen.total === 0
                ? 'No hay alertas activas'
                : `${resumen.total} ${resumen.total === 1 ? 'producto requiere' : 'productos requieren'} atención`}
            </CardDescription>
          </div>
        </div>

        {showFilters && resumen.total > 0 && (
          <div className="flex gap-2 mt-4">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de alerta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="stock">Stock Bajo</SelectItem>
                <SelectItem value="margen">Margen Bajo</SelectItem>
                <SelectItem value="ventas">Sin Ventas</SelectItem>
                <SelectItem value="rotacion">Rotación Lenta</SelectItem>
              </SelectContent>
            </Select>

            <Select value={prioridad} onValueChange={setPrioridad}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No se encontraron alertas con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertBadge tipo={alert.tipo} prioridad={alert.prioridad} showIcon />
                      <span className="font-medium text-sm truncate">
                        {alert.productCode} - {alert.productName}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{alert.mensaje}</p>

                    {!compactMode && alert.sugerencias.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Sugerencia:</span> {alert.sugerencias[0]}
                      </div>
                    )}
                  </div>

                  <Link href={`/administracion/ventas/productos?productId=${alert.productId}`}>
                    <Button variant="ghost" size="sm" className="flex-shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {resumen.total > limite && (
          <div className="mt-4 text-center">
            <Link href="/administracion/ventas/productos?mostrarAlertas=true">
              <Button variant="outline" size="sm">
                Ver todas las alertas ({resumen.total})
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
