'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  User,
  Phone,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryTracking {
  numero: string;
  estado: string;
  fechaProgramada: string | null;
  fechaEntrega: string | null;
  direccionEntrega: string | null;
  conductorNombre: string | null;
  vehiculo: string | null;
  sale: {
    numero: string;
    client: {
      businessName: string;
    };
  };
  items: Array<{
    product: {
      name: string;
    };
    cantidad: number;
  }>;
  timeline: Array<{
    estado: string;
    fecha: string;
    notas: string | null;
  }>;
}

const ESTADO_INFO: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: 'bg-gray-100 text-gray-700',
    icon: Clock,
    description: 'Tu pedido está siendo procesado',
  },
  EN_PREPARACION: {
    label: 'En Preparación',
    color: 'bg-yellow-100 text-yellow-700',
    icon: Package,
    description: 'Estamos preparando tu pedido',
  },
  LISTA_PARA_DESPACHO: {
    label: 'Lista para Despacho',
    color: 'bg-blue-100 text-blue-700',
    icon: CheckCircle2,
    description: 'Tu pedido está listo para ser despachado',
  },
  EN_TRANSITO: {
    label: 'En Tránsito',
    color: 'bg-purple-100 text-purple-700',
    icon: Truck,
    description: 'Tu pedido está en camino',
  },
  RETIRADA: {
    label: 'Retirada',
    color: 'bg-cyan-100 text-cyan-700',
    icon: Package,
    description: 'Pedido retirado en sucursal',
  },
  ENTREGADA: {
    label: 'Entregada',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle2,
    description: 'Tu pedido ha sido entregado',
  },
  ENTREGA_FALLIDA: {
    label: 'Entrega Fallida',
    color: 'bg-red-100 text-red-700',
    icon: AlertCircle,
    description: 'No pudimos completar la entrega. Nos contactaremos contigo',
  },
  CANCELADA: {
    label: 'Cancelada',
    color: 'bg-gray-100 text-gray-500',
    icon: AlertCircle,
    description: 'Esta entrega ha sido cancelada',
  },
};

export default function TrackingPage() {
  const params = useParams();
  const numero = params.numero as string;

  const [delivery, setDelivery] = useState<DeliveryTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTracking();
  }, [numero]);

  const loadTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tracking/${encodeURIComponent(numero)}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Entrega no encontrada');
        } else {
          setError('Error al cargar información de seguimiento');
        }
        return;
      }

      const data = await response.json();
      setDelivery(data);
    } catch (err) {
      console.error('Error loading tracking:', err);
      setError('Error al cargar información de seguimiento');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
              <div>
                <h2 className="text-xl font-bold">Entrega no encontrada</h2>
                <p className="text-muted-foreground mt-2">
                  {error || 'Verifica el número de entrega e intenta nuevamente'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const estadoInfo = ESTADO_INFO[delivery.estado] || ESTADO_INFO.PENDIENTE;
  const EstadoIcon = estadoInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Seguimiento de Entrega
          </h1>
          <p className="text-muted-foreground">
            Rastrea tu pedido en tiempo real
          </p>
        </div>

        {/* Current Status */}
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className={`p-6 rounded-full ${estadoInfo.color}`}>
                <EstadoIcon className="h-12 w-12" />
              </div>
            </div>
            <CardTitle className="text-2xl">{estadoInfo.label}</CardTitle>
            <p className="text-muted-foreground mt-2">{estadoInfo.description}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Número de Entrega</p>
                  <p className="font-medium">{delivery.numero}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{delivery.sale.client.businessName}</p>
                </div>
              </div>

              {delivery.fechaProgramada && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha Programada</p>
                    <p className="font-medium">
                      {format(new Date(delivery.fechaProgramada), "dd 'de' MMMM 'a las' HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              )}

              {delivery.direccionEntrega && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dirección de Entrega</p>
                    <p className="font-medium">{delivery.direccionEntrega}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Driver Info */}
        {(delivery.conductorNombre || delivery.vehiculo) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                Información del Transporte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {delivery.conductorNombre && (
                  <div>
                    <p className="text-sm text-muted-foreground">Conductor</p>
                    <p className="font-medium">{delivery.conductorNombre}</p>
                  </div>
                )}
                {delivery.vehiculo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Vehículo</p>
                    <p className="font-medium">{delivery.vehiculo}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items */}
        {delivery.items && delivery.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Productos ({delivery.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {delivery.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center pb-3 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{item.product.name}</p>
                    </div>
                    <Badge variant="secondary">Cantidad: {item.cantidad}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {delivery.timeline && delivery.timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {delivery.timeline.map((event, index) => {
                  const eventInfo = ESTADO_INFO[event.estado];
                  const EventIcon = eventInfo?.icon || Clock;

                  return (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`p-2 rounded-full ${eventInfo?.color || 'bg-gray-100'}`}>
                          <EventIcon className="h-4 w-4" />
                        </div>
                        {index < delivery.timeline.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{eventInfo?.label || event.estado}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                        {event.notas && (
                          <p className="text-sm text-muted-foreground mt-1">{event.notas}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>
            ¿Necesitas ayuda? Contactanos con el número de entrega:{' '}
            <span className="font-medium">{delivery.numero}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
