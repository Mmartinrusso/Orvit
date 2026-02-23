'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertCircle } from 'lucide-react';

interface Delivery {
  id: number;
  numero: string;
  estado: string;
  direccionEntrega: string | null;
  latitud: number | null;
  longitud: number | null;
  sale: {
    client: {
      legalName?: string;
      name?: string;
    };
  };
}

interface DeliveryMapProps {
  deliveries: Delivery[];
  selectedIds: number[];
  onSelectDelivery: (id: number) => void;
}

export function DeliveryMap({
  deliveries,
  selectedIds,
  onSelectDelivery,
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Simple map placeholder - can be enhanced with Leaflet/Mapbox later
  useEffect(() => {
    // Initialize map when component mounts
    // For now, we'll show a simple placeholder
    setMapLoaded(true);
  }, []);

  const deliveriesWithLocation = deliveries.filter(
    (d) => (d.latitud && d.longitud) || d.direccionEntrega
  );

  if (deliveriesWithLocation.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-lg bg-muted/10">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center px-4">
          No hay entregas con ubicación disponible
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Las entregas deben tener dirección para visualizarse en el mapa
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Container - Placeholder for now */}
      <div
        ref={mapRef}
        className="h-[400px] border rounded-lg bg-gradient-to-br from-blue-50 to-green-50 relative overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <MapPin className="h-16 w-16 text-primary mx-auto" />
            <p className="text-sm font-medium">Vista de Mapa</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {deliveriesWithLocation.length} entregas con ubicación
            </p>
            <Badge variant="outline" className="mt-2">
              Disponible próximamente
            </Badge>
          </div>
        </div>

        {/* Quick markers list */}
        <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg shadow-lg p-3 max-w-xs max-h-[360px] overflow-y-auto">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">
            ENTREGAS ({deliveriesWithLocation.length})
          </div>
          <div className="space-y-2">
            {deliveriesWithLocation.map((delivery, index) => {
              const isSelected = selectedIds.includes(delivery.id);
              const sequenceNumber = selectedIds.indexOf(delivery.id) + 1;

              return (
                <div
                  key={delivery.id}
                  onClick={() => onSelectDelivery(delivery.id)}
                  className={cn('text-xs p-2 rounded border cursor-pointer transition-all', isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-accent border-border')}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {sequenceNumber > 0 ? sequenceNumber : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {delivery.numero}
                      </div>
                      <div className="text-xs opacity-75 truncate">
                        {delivery.sale.client.legalName || delivery.sale.client.name}
                      </div>
                      {delivery.direccionEntrega && (
                        <div className="text-xs opacity-60 truncate mt-1">
                          {delivery.direccionEntrega}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            Visualizando {deliveriesWithLocation.length} de {deliveries.length}{' '}
            entregas
          </span>
        </div>
        {selectedIds.length > 0 && (
          <Badge variant="secondary">{selectedIds.length} seleccionadas</Badge>
        )}
      </div>
    </div>
  );
}
