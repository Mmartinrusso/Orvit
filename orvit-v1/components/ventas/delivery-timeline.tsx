'use client';

import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  X,
  MapPin,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type DeliveryStatus =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTA_PARA_DESPACHO'
  | 'EN_TRANSITO'
  | 'RETIRADA'
  | 'ENTREGADA'
  | 'ENTREGA_FALLIDA'
  | 'PARCIAL'
  | 'CANCELADA';

const ESTADOS_CONFIG: Record<DeliveryStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-muted text-foreground', icon: Clock },
  EN_PREPARACION: { label: 'En Preparación', color: 'bg-warning-muted text-warning-muted-foreground', icon: Package },
  LISTA_PARA_DESPACHO: { label: 'Lista para Despacho', color: 'bg-info-muted text-info-muted-foreground', icon: CheckCircle2 },
  EN_TRANSITO: { label: 'En Tránsito', color: 'bg-purple-100 text-purple-700', icon: Truck },
  RETIRADA: { label: 'Retirada', color: 'bg-accent-cyan-muted text-accent-cyan-muted-foreground', icon: Package },
  ENTREGADA: { label: 'Entregada', color: 'bg-success-muted text-success', icon: CheckCircle2 },
  ENTREGA_FALLIDA: { label: 'Entrega Fallida', color: 'bg-destructive/10 text-destructive', icon: X },
  PARCIAL: { label: 'Parcial', color: 'bg-warning-muted text-warning-muted-foreground', icon: Package },
  CANCELADA: { label: 'Cancelada', color: 'bg-muted text-muted-foreground', icon: X },
};

interface TimelineEvent {
  id: number;
  entidad: string;
  entidadId: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  userId: number | null;
  user?: {
    name: string;
  };
  notas?: string | null;
  createdAt: string;
}

interface DeliveryTimelineProps {
  delivery: any;
  auditLogs?: TimelineEvent[];
}

export function DeliveryTimeline({ delivery, auditLogs = [] }: DeliveryTimelineProps) {
  // Build timeline from audit logs and delivery data
  const timelineEvents = [
    {
      estado: 'PENDIENTE',
      fecha: delivery.createdAt,
      usuario: 'Sistema',
      notas: 'Entrega creada',
      isInitial: true,
    },
    ...auditLogs.map((log) => ({
      estado: log.estadoNuevo,
      fecha: log.createdAt,
      usuario: log.user?.name || 'Usuario desconocido',
      notas: log.notas,
      isInitial: false,
    })),
  ];

  // Add GPS coordinates if available
  const gpsEvents = [];
  if (delivery.latitudInicio && delivery.longitudInicio) {
    gpsEvents.push({
      type: 'gps',
      label: 'Inicio del recorrido',
      lat: delivery.latitudInicio,
      lng: delivery.longitudInicio,
    });
  }
  if (delivery.latitudEntrega && delivery.longitudEntrega) {
    gpsEvents.push({
      type: 'gps',
      label: 'Ubicación de entrega',
      lat: delivery.latitudEntrega,
      lng: delivery.longitudEntrega,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="w-5 h-5" />
          Historial de Estados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Timeline */}
          <div className="relative pl-8 space-y-6">
            {timelineEvents.map((event, index) => {
              const config = ESTADOS_CONFIG[event.estado as DeliveryStatus] || ESTADOS_CONFIG.PENDIENTE;
              const Icon = config.icon;
              const isLast = index === timelineEvents.length - 1;
              const isCurrent = event.estado === delivery.estado;

              return (
                <div key={index} className="relative">
                  {/* Vertical Line */}
                  {!isLast && (
                    <div className="absolute left-[-20px] top-[32px] w-[2px] h-[calc(100%+8px)] bg-muted" />
                  )}

                  {/* Icon Circle */}
                  <div
                    className={cn('absolute left-[-28px] top-0 w-8 h-8 rounded-full flex items-center justify-center', isCurrent ? config.color : 'bg-muted')}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Event Content */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge className={cn(config.color, 'border text-xs')}>
                        {config.label}
                      </Badge>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Estado actual
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{format(new Date(event.fecha), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span>{event.usuario}</span>
                    </div>

                    {event.notas && (
                      <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{event.notas}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* GPS Coordinates */}
          {gpsEvents.length > 0 && (
            <div className="mt-6 pt-6 border-t space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Coordenadas GPS
              </h4>
              {gpsEvents.map((gps, index) => (
                <div key={index} className="flex items-center justify-between text-sm bg-muted/30 p-3 rounded-lg">
                  <span className="text-muted-foreground">{gps.label}:</span>
                  <a
                    href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-mono text-xs"
                  >
                    {formatNumber(Number(gps.lat), 6)}, {formatNumber(Number(gps.lng), 6)}
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Next Steps Suggestion */}
          {delivery.estado === 'PENDIENTE' && (
            <div className="mt-6 p-4 bg-info-muted border border-info-muted rounded-lg">
              <p className="text-sm text-info-muted-foreground">
                <strong>Próximo paso:</strong> Iniciar la preparación de la entrega
              </p>
            </div>
          )}
          {delivery.estado === 'EN_PREPARACION' && (
            <div className="mt-6 p-4 bg-info-muted border border-info-muted rounded-lg">
              <p className="text-sm text-info-muted-foreground">
                <strong>Próximo paso:</strong> Marcar como lista para despacho
              </p>
            </div>
          )}
          {delivery.estado === 'LISTA_PARA_DESPACHO' && (
            <div className="mt-6 p-4 bg-info-muted border border-info-muted rounded-lg">
              <p className="text-sm text-info-muted-foreground">
                <strong>Próximo paso:</strong> Despachar la entrega o marcar como retirada
              </p>
            </div>
          )}
          {delivery.estado === 'EN_TRANSITO' && (
            <div className="mt-6 p-4 bg-info-muted border border-info-muted rounded-lg">
              <p className="text-sm text-info-muted-foreground">
                <strong>Próximo paso:</strong> Confirmar la entrega o marcar como fallida
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
