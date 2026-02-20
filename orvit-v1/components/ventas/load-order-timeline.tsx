'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  X,
  User,
  FileText,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type LoadOrderStatus = 'PENDIENTE' | 'CARGANDO' | 'CARGADA' | 'DESPACHADA' | 'CANCELADA';

const ESTADOS_CONFIG: Record<LoadOrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-muted text-foreground', icon: Clock },
  CARGANDO: { label: 'Cargando', color: 'bg-warning-muted text-warning-muted-foreground', icon: Package },
  CARGADA: { label: 'Cargada', color: 'bg-info-muted text-info-muted-foreground', icon: CheckCircle2 },
  DESPACHADA: { label: 'Despachada', color: 'bg-success-muted text-success', icon: Truck },
  CANCELADA: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: X },
};

interface LoadOrderTimelineProps {
  loadOrder: any;
}

export function LoadOrderTimeline({ loadOrder }: LoadOrderTimelineProps) {
  // Build timeline from load order data
  const timelineEvents = [
    {
      estado: 'PENDIENTE',
      fecha: loadOrder.createdAt,
      usuario: loadOrder.createdByUser?.name || 'Sistema',
      notas: 'Orden de carga creada',
      isInitial: true,
    },
  ];

  // Add confirmed event if exists
  if (loadOrder.confirmadoAt) {
    timelineEvents.push({
      estado: 'CARGADA',
      fecha: loadOrder.confirmadoAt,
      usuario: loadOrder.confirmedBy?.name || 'Usuario desconocido',
      notas: 'Carga confirmada y stock decrementado',
      isInitial: false,
    });
  }

  // Add current state if different from confirmed
  if (loadOrder.estado === 'CARGANDO' && !loadOrder.confirmadoAt) {
    timelineEvents.push({
      estado: 'CARGANDO',
      fecha: loadOrder.updatedAt,
      usuario: 'Sistema',
      notas: 'Proceso de carga iniciado',
      isInitial: false,
    });
  }

  if (loadOrder.estado === 'DESPACHADA') {
    timelineEvents.push({
      estado: 'DESPACHADA',
      fecha: loadOrder.updatedAt,
      usuario: 'Sistema',
      notas: 'Vehículo despachado',
      isInitial: false,
    });
  }

  if (loadOrder.estado === 'CANCELADA') {
    timelineEvents.push({
      estado: 'CANCELADA',
      fecha: loadOrder.updatedAt,
      usuario: 'Sistema',
      notas: 'Orden cancelada',
      isInitial: false,
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
              const config = ESTADOS_CONFIG[event.estado as LoadOrderStatus] || ESTADOS_CONFIG.PENDIENTE;
              const Icon = config.icon;
              const isLast = index === timelineEvents.length - 1;
              const isCurrent = event.estado === loadOrder.estado;

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
                        <p className="text-sm">{event.notas}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Steps Suggestion */}
          {loadOrder.estado === 'PENDIENTE' && (
            <div className="mt-6 p-4 bg-info-muted border border-info-muted rounded-lg">
              <p className="text-sm text-info-muted-foreground">
                <strong>Próximo paso:</strong> Iniciar el proceso de carga
              </p>
            </div>
          )}
          {loadOrder.estado === 'CARGANDO' && (
            <div className="mt-6 p-4 bg-warning-muted border border-warning-muted rounded-lg">
              <p className="text-sm text-warning-muted-foreground">
                <strong>Próximo paso:</strong> Confirmar las cantidades cargadas
              </p>
            </div>
          )}
          {loadOrder.estado === 'CARGADA' && (
            <div className="mt-6 p-4 bg-info-muted border border-info-muted rounded-lg">
              <p className="text-sm text-info-muted-foreground">
                <strong>Próximo paso:</strong> Despachar el vehículo
              </p>
            </div>
          )}
          {loadOrder.estado === 'DESPACHADA' && loadOrder.delivery && (
            <div className="mt-6 p-4 bg-success-muted border border-success-muted rounded-lg">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-success font-medium">
                    Orden despachada - Entrega en proceso
                  </p>
                  <p className="text-xs text-success mt-1">
                    Entrega: {loadOrder.delivery.numero} - Estado: {loadOrder.delivery.estado}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
