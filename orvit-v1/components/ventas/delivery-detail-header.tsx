'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  X,
  Calendar,
  User,
  MapPin,
  FileText,
  Download,
  Share2,
} from 'lucide-react';
import { WhatsAppDropdown } from '@/components/ventas/whatsapp-button';
import { formatDateTime } from '@/lib/date-utils';
import { toast } from 'sonner';

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
  PENDIENTE: { label: 'Pendiente', color: 'bg-muted text-foreground border-border', icon: Clock },
  EN_PREPARACION: { label: 'Preparación', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', icon: Package },
  LISTA_PARA_DESPACHO: { label: 'Lista', color: 'bg-info-muted text-info-muted-foreground border-info-muted', icon: CheckCircle2 },
  EN_TRANSITO: { label: 'En Tránsito', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
  RETIRADA: { label: 'Retirada', color: 'bg-accent-cyan-muted text-accent-cyan-muted-foreground border-accent-cyan-muted', icon: Package },
  ENTREGADA: { label: 'Entregada', color: 'bg-success-muted text-success border-success-muted', icon: CheckCircle2 },
  ENTREGA_FALLIDA: { label: 'Fallida', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: X },
  PARCIAL: { label: 'Parcial', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', icon: Package },
  CANCELADA: { label: 'Cancelada', color: 'bg-muted text-muted-foreground border-border', icon: X },
};

interface DeliveryDetailHeaderProps {
  delivery: any;
  onRefresh: () => void;
}

export function DeliveryDetailHeader({ delivery, onRefresh }: DeliveryDetailHeaderProps) {
  const config = ESTADOS_CONFIG[delivery.estado as DeliveryStatus] || ESTADOS_CONFIG.PENDIENTE;
  const Icon = config.icon;

  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${delivery.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('Estado actualizado');
        onRefresh();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar');
      }
    } catch (error) {
      toast.error('Error al procesar acción');
    }
  };

  const handleDownloadPOD = async () => {
    try {
      const response = await fetch(`/api/ventas/entregas/${delivery.id}/pod`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `POD-${delivery.numero}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('POD descargado');
      } else {
        toast.error('Error al descargar POD');
      }
    } catch (error) {
      toast.error('Error al descargar POD');
    }
  };

  const handleShareTracking = () => {
    const trackingUrl = `${window.location.origin}/tracking/${delivery.numero}`;
    navigator.clipboard.writeText(trackingUrl).then(
      () => {
        toast.success('Enlace de seguimiento copiado al portapapeles');
      },
      () => {
        toast.error('Error al copiar enlace');
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Entrega {delivery.numero}</h1>
            <Badge className={cn(config.color, 'border')}>
              <Icon className="w-4 h-4 mr-1" />
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Orden de Venta: <strong>{delivery.sale?.numero}</strong></span>
            <span>•</span>
            <span>Cliente: <strong>{delivery.sale?.client?.legalName || delivery.sale?.client?.name}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {delivery.sale?.client?.phone && (
            <WhatsAppDropdown
              phone={delivery.sale.client.phone}
              clientName={delivery.sale.client.legalName || delivery.sale.client.name || 'Cliente'}
              companyName="ORVIT"
              documentType="delivery"
              documentNumber={delivery.numero}
              deliveryDate={delivery.fechaProgramada}
              deliveryAddress={delivery.direccionEntrega}
              driverName={delivery.conductorNombre}
              deliveryStatus={
                delivery.estado === 'ENTREGADA' ? 'delivered' :
                delivery.estado === 'EN_TRANSITO' ? 'dispatched' :
                delivery.estado === 'ENTREGA_FALLIDA' ? 'failed' : 'scheduled'
              }
              variant="outline"
              size="sm"
            />
          )}

          <Button variant="outline" size="sm" onClick={handleShareTracking}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartir Seguimiento
          </Button>

          {delivery.estado === 'ENTREGADA' && (
            <Button variant="outline" size="sm" onClick={handleDownloadPOD}>
              <Download className="w-4 h-4 mr-2" />
              Descargar POD
            </Button>
          )}

          {delivery.estado === 'PENDIENTE' && (
            <Button size="sm" onClick={() => handleAction('preparar')}>
              <Package className="w-4 h-4 mr-2" />
              Iniciar preparación
            </Button>
          )}

          {delivery.estado === 'EN_PREPARACION' && (
            <Button size="sm" onClick={() => handleAction('listar')}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Lista para despacho
            </Button>
          )}

          {delivery.estado === 'LISTA_PARA_DESPACHO' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleAction('retirar')}>
                <Package className="w-4 h-4 mr-2" />
                Marcar retirada
              </Button>
              <Button size="sm" onClick={() => handleAction('despachar')}>
                <Truck className="w-4 h-4 mr-2" />
                Despachar
              </Button>
            </>
          )}

          {delivery.estado === 'EN_TRANSITO' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleAction('fallar')}>
                <X className="w-4 h-4 mr-2" />
                Marcar fallida
              </Button>
              <Button size="sm" onClick={() => handleAction('entregar')}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar entrega
              </Button>
            </>
          )}

          {delivery.estado === 'RETIRADA' && (
            <Button size="sm" onClick={() => handleAction('entregar')}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmar entrega
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-info-muted rounded-lg">
                <Calendar className="w-5 h-5 text-info-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha Programada</p>
                <p className="text-sm font-medium">
                  {delivery.fechaProgramada
                    ? formatDateTime(delivery.fechaProgramada)
                    : 'No programada'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-success-muted rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha Entrega</p>
                <p className="text-sm font-medium">
                  {delivery.fechaEntrega
                    ? formatDateTime(delivery.fechaEntrega)
                    : 'Pendiente'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conductor</p>
                <p className="text-sm font-medium">{delivery.conductorNombre || 'No asignado'}</p>
                {delivery.conductorDNI && (
                  <p className="text-xs text-muted-foreground">DNI: {delivery.conductorDNI}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-warning-muted rounded-lg">
                <Truck className="w-5 h-5 text-warning-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vehículo</p>
                <p className="text-sm font-medium">{delivery.vehiculo || 'No asignado'}</p>
                {delivery.transportista && (
                  <p className="text-xs text-muted-foreground">{delivery.transportista}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Address & Notes */}
      {(delivery.direccionEntrega || delivery.notas) && (
        <div className="grid grid-cols-2 gap-4">
          {delivery.direccionEntrega && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Dirección de Entrega</p>
                    <p className="text-sm">{delivery.direccionEntrega}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {delivery.notas && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm whitespace-pre-wrap">{delivery.notas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recipient Info (if delivered) */}
      {(delivery.recibeNombre || delivery.recibeDNI) && (
        <Card className="bg-success-muted border-success-muted">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm font-medium text-success">Recibido por:</p>
                <p className="text-sm text-success">
                  {delivery.recibeNombre}
                  {delivery.recibeDNI && ` - DNI: ${delivery.recibeDNI}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
