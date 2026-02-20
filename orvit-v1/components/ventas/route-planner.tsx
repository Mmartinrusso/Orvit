'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Package,
  MapPin,
  User,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Delivery {
  id: number;
  numero: string;
  estado: string;
  fechaProgramada: string | null;
  direccionEntrega: string | null;
  conductorNombre: string | null;
  vehiculo: string | null;
  sale: {
    numero: string;
    client: {
      legalName?: string;
      name?: string;
    };
  };
  _count: {
    items: number;
  };
}

interface RoutePlannerProps {
  deliveries: Delivery[];
  selectedIds: number[];
  onToggleSelection: (id: number) => void;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-muted text-foreground',
  EN_PREPARACION: 'bg-warning-muted text-warning-muted-foreground',
  LISTA_PARA_DESPACHO: 'bg-info-muted text-info-muted-foreground',
  EN_TRANSITO: 'bg-purple-100 text-purple-700',
  ENTREGADA: 'bg-success-muted text-success-muted-foreground',
};

export function RoutePlanner({
  deliveries,
  selectedIds,
  onToggleSelection,
}: RoutePlannerProps) {
  if (deliveries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No hay entregas para esta fecha</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-3">
        {deliveries.map((delivery, index) => {
          const isSelected = selectedIds.includes(delivery.id);
          const sequenceNumber = selectedIds.indexOf(delivery.id) + 1;

          return (
            <div
              key={delivery.id}
              className={cn('relative border rounded-lg p-4 transition-all', isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50')}
            >
              {/* Sequence number badge for selected items */}
              {isSelected && sequenceNumber > 0 && (
                <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">
                  {sequenceNumber}
                </div>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(delivery.id)}
                  className="mt-1"
                />

                <div className="flex-1 space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{delivery.numero}</div>
                      <div className="text-sm text-muted-foreground">
                        OV: {delivery.sale.numero}
                      </div>
                    </div>
                    <Badge className={ESTADO_COLORS[delivery.estado] || ''}>
                      {delivery.estado.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {/* Client */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {delivery.sale.client.legalName || delivery.sale.client.name}
                    </span>
                  </div>

                  {/* Address */}
                  {delivery.direccionEntrega && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">
                        {delivery.direccionEntrega}
                      </span>
                    </div>
                  )}

                  {/* Time and items */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {delivery.fechaProgramada && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(delivery.fechaProgramada), 'HH:mm', {
                          locale: es,
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {delivery._count.items} items
                    </div>
                  </div>

                  {/* Driver and vehicle */}
                  {(delivery.conductorNombre || delivery.vehiculo) && (
                    <Separator className="my-2" />
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    {delivery.conductorNombre && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <User className="h-4 w-4" />
                        {delivery.conductorNombre}
                      </div>
                    )}
                    {delivery.vehiculo && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Truck className="h-4 w-4" />
                        {delivery.vehiculo}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
