'use client';

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
  FileText,
  Download,
  Play,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

type LoadOrderStatus = 'PENDIENTE' | 'CARGANDO' | 'CARGADA' | 'DESPACHADA' | 'CANCELADA';

const ESTADOS_CONFIG: Record<LoadOrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock },
  CARGANDO: { label: 'Cargando', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Package },
  CARGADA: { label: 'Cargada', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
  DESPACHADA: { label: 'Despachada', color: 'bg-green-100 text-green-700 border-green-200', icon: Truck },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-700 border-red-200', icon: X },
};

interface LoadOrderDetailHeaderProps {
  loadOrder: any;
  onRefresh: () => void;
}

export function LoadOrderDetailHeader({ loadOrder, onRefresh }: LoadOrderDetailHeaderProps) {
  const config = ESTADOS_CONFIG[loadOrder.estado as LoadOrderStatus] || ESTADOS_CONFIG.PENDIENTE;
  const Icon = config.icon;

  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${loadOrder.id}/${action}`, {
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

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${loadOrder.id}/pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OC-${loadOrder.numero}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('PDF descargado');
      } else {
        toast.error('Error al descargar PDF');
      }
    } catch (error) {
      toast.error('Error al descargar PDF');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Orden de Carga {loadOrder.numero}</h1>
            <Badge className={`${config.color} border`}>
              <Icon className="w-4 h-4 mr-1" />
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Orden de Venta: <strong>{loadOrder.sale?.numero}</strong></span>
            <span>•</span>
            <span>Cliente: <strong>{loadOrder.sale?.client?.legalName || loadOrder.sale?.client?.name}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>

          {loadOrder.estado === 'PENDIENTE' && (
            <>
              <Button size="sm" onClick={() => handleAction('iniciar-carga')}>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Carga
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAction('cancelar')}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}

          {loadOrder.estado === 'CARGANDO' && (
            <Button size="sm" onClick={() => window.location.href = `/administracion/ventas/ordenes-carga/${loadOrder.id}/confirmar`}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmar Carga
            </Button>
          )}

          {loadOrder.estado === 'CARGADA' && (
            <Button size="sm" onClick={() => handleAction('despachar')}>
              <Truck className="w-4 h-4 mr-2" />
              Despachar
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="text-sm font-medium">
                  {loadOrder.fecha
                    ? format(new Date(loadOrder.fecha), 'dd/MM/yyyy', { locale: es })
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Truck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vehículo</p>
                <p className="text-sm font-medium">{loadOrder.vehiculo || 'No asignado'}</p>
                {loadOrder.vehiculoPatente && (
                  <p className="text-xs text-muted-foreground">{loadOrder.vehiculoPatente}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chofer</p>
                <p className="text-sm font-medium">{loadOrder.chofer || 'No asignado'}</p>
                {loadOrder.choferDNI && (
                  <p className="text-xs text-muted-foreground">DNI: {loadOrder.choferDNI}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entrega</p>
                <p className="text-sm font-medium">
                  {loadOrder.delivery?.numero || 'Sin entrega'}
                </p>
                {loadOrder.delivery?.estado && (
                  <p className="text-xs text-muted-foreground">{loadOrder.delivery.estado}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weight & Volume */}
      {(loadOrder.pesoTotal || loadOrder.volumenTotal) && (
        <div className="grid grid-cols-2 gap-4">
          {loadOrder.pesoTotal && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Peso Total</p>
                    <p className="text-2xl font-bold">{loadOrder.pesoTotal} kg</p>
                  </div>
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}

          {loadOrder.volumenTotal && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Volumen Total</p>
                    <p className="text-2xl font-bold">{loadOrder.volumenTotal} m³</p>
                  </div>
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Observations */}
      {loadOrder.observaciones && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Observaciones</p>
                <p className="text-sm whitespace-pre-wrap">{loadOrder.observaciones}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Info */}
      {loadOrder.confirmadoAt && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Confirmado</p>
                <p className="text-xs text-green-700">
                  {format(new Date(loadOrder.confirmadoAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                  {loadOrder.confirmedBy && ` por ${loadOrder.confirmedBy.name}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
