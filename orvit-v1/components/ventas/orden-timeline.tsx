'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Check, Package, Truck, FileText, X, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
  timestamp: Date;
  estado: string;
  usuario?: string;
  descripcion?: string;
  detalles?: string[];
  tipo?: 'info' | 'success' | 'warning' | 'error';
}

interface OrdenTimelineProps {
  orden: any;
  eventos?: TimelineEvent[];
}

const estadoIcons: Record<string, any> = {
  BORRADOR: Clock,
  CONFIRMADA: Check,
  EN_PREPARACION: Package,
  PARCIALMENTE_ENTREGADA: Truck,
  ENTREGADA: Truck,
  FACTURADA: FileText,
  COMPLETADA: Check,
  CANCELADA: X,
};

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-muted text-foreground border-border',
  CONFIRMADA: 'bg-info-muted text-info-muted-foreground border-info',
  EN_PREPARACION: 'bg-warning-muted text-warning-muted-foreground border-warning',
  PARCIALMENTE_ENTREGADA: 'bg-purple-100 text-purple-800 border-purple-300',
  ENTREGADA: 'bg-success-muted text-success-muted-foreground border-success',
  FACTURADA: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  COMPLETADA: 'bg-teal-100 text-teal-800 border-teal-300',
  CANCELADA: 'bg-destructive/10 text-destructive border-destructive',
};

export function OrdenTimeline({ orden, eventos }: OrdenTimelineProps) {
  // Si no hay eventos personalizados, construir timeline básico desde la orden
  const timelineEvents: TimelineEvent[] = eventos || [
    {
      timestamp: new Date(orden.createdAt),
      estado: 'BORRADOR',
      usuario: orden.createdByUser?.name,
      descripcion: 'Orden creada',
    },
    ...(orden.estado !== 'BORRADOR' ? [{
      timestamp: new Date(orden.updatedAt), // Esto debería venir de un campo específico
      estado: orden.estado,
      descripcion: `Orden ${orden.estado.toLowerCase().replace('_', ' ')}`,
    }] : [])
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historial de Estados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Línea vertical conectora */}
          <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-border" />

          {timelineEvents.map((evento, index) => {
            const Icon = estadoIcons[evento.estado] || Clock;
            const isLast = index === timelineEvents.length - 1;
            const colorClass = estadoColors[evento.estado] || estadoColors.BORRADOR;

            return (
              <div key={index} className="relative flex gap-4">
                {/* Icono */}
                <div className={cn('relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2', colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Contenido */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">
                        {evento.descripcion || evento.estado}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(evento.timestamp), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                        {evento.usuario && ` por ${evento.usuario}`}
                      </p>
                    </div>
                    <Badge className={colorClass.replace('border-', '')}>
                      {evento.estado.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Detalles adicionales */}
                  {evento.detalles && evento.detalles.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {evento.detalles.map((detalle, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-0.5">•</span>
                          <span>{detalle}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Estado actual destacado */}
        <div className="mt-6 p-4 rounded-lg bg-muted">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estado Actual</p>
              <p className="text-lg font-bold">{orden.estado.replace('_', ' ')}</p>
            </div>
            <Badge className={estadoColors[orden.estado] + ' text-lg px-4 py-2'}>
              {orden.estado.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Próximos pasos */}
        {orden.estado !== 'COMPLETADA' && orden.estado !== 'CANCELADA' && (
          <div className="mt-4 p-4 rounded-lg border border-info bg-info-muted">
            <p className="text-sm font-semibold text-foreground mb-2">Próximos Pasos</p>
            <ul className="text-sm text-foreground space-y-1">
              {orden.estado === 'BORRADOR' && (
                <>
                  <li>• Revisar items y totales</li>
                  <li>• Confirmar la orden para reservar stock</li>
                </>
              )}
              {orden.estado === 'CONFIRMADA' && (
                <>
                  <li>• Iniciar preparación del pedido</li>
                  <li>• Crear documentos de despacho</li>
                </>
              )}
              {orden.estado === 'EN_PREPARACION' && (
                <>
                  <li>• Completar preparación</li>
                  <li>• Generar remito de entrega</li>
                </>
              )}
              {(orden.estado === 'ENTREGADA' || orden.estado === 'PARCIALMENTE_ENTREGADA') && (
                <>
                  <li>• Emitir factura</li>
                  <li>• Registrar en sistema contable</li>
                </>
              )}
              {orden.estado === 'FACTURADA' && (
                <>
                  <li>• Registrar pago del cliente</li>
                  <li>• Completar orden</li>
                </>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
