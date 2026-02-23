'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  Pencil,
  Check,
  X,
  Download,
  Truck,
  Package,
  ArrowLeft,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from 'next/link';
import { formatDate, formatDateTime } from '@/lib/date-utils';

interface OrdenDetailHeaderProps {
  orden: any;
  onConfirmar?: () => void;
  onPreparar?: () => void;
  onCancelar?: () => void;
  onDownloadPDF?: () => void;
  canEdit: boolean;
  canConfirm: boolean;
  canCancel: boolean;
}

const estadoConfig: Record<string, { variant: any; label: string; color: string }> = {
  BORRADOR: { variant: 'secondary', label: 'Borrador', color: 'bg-muted text-foreground' },
  CONFIRMADA: { variant: 'default', label: 'Confirmada', color: 'bg-info-muted text-info-muted-foreground' },
  EN_PREPARACION: { variant: 'default', label: 'En Preparación', color: 'bg-warning-muted text-warning-muted-foreground' },
  PARCIALMENTE_ENTREGADA: { variant: 'default', label: 'Parcialmente Entregada', color: 'bg-purple-100 text-purple-800' },
  ENTREGADA: { variant: 'default', label: 'Entregada', color: 'bg-success-muted text-success-muted-foreground' },
  FACTURADA: { variant: 'default', label: 'Facturada', color: 'bg-indigo-100 text-indigo-800' },
  COMPLETADA: { variant: 'default', label: 'Completada', color: 'bg-teal-100 text-teal-800' },
  CANCELADA: { variant: 'destructive', label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
};

export function OrdenDetailHeader({
  orden,
  onConfirmar,
  onPreparar,
  onCancelar,
  onDownloadPDF,
  canEdit,
  canConfirm,
  canCancel
}: OrdenDetailHeaderProps) {
  const estado = estadoConfig[orden.estado] || estadoConfig.BORRADOR;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link
                href="/administracion/ventas/ordenes"
                className="hover:bg-accent p-1 rounded"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  {orden.numero}
                  <Badge className={estado.color}>
                    {estado.label}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Creada el {formatDateTime(orden.fechaEmision)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón descargar PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>

            {/* Botón Editar (solo BORRADOR) */}
            {canEdit && orden.estado === 'BORRADOR' && (
              <Link href={`/administracion/ventas/ordenes/${orden.id}/editar`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </Link>
            )}

            {/* Botón Confirmar (solo BORRADOR) */}
            {canConfirm && orden.estado === 'BORRADOR' && (
              <Button variant="default" size="sm" onClick={onConfirmar}>
                <Check className="h-4 w-4 mr-2" />
                Confirmar
              </Button>
            )}

            {/* Botón Preparar (solo CONFIRMADA) */}
            {orden.estado === 'CONFIRMADA' && (
              <Button variant="default" size="sm" onClick={onPreparar}>
                <Package className="h-4 w-4 mr-2" />
                Iniciar Preparación
              </Button>
            )}

            {/* Menú de acciones adicionales */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDownloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Cotización Original
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Truck className="h-4 w-4 mr-2" />
                  Ver Entregas
                </DropdownMenuItem>
                {canCancel && orden.estado !== 'CANCELADA' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onCancelar}
                      className="text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar Orden
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Cliente */}
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-semibold">{orden.client?.legalName || orden.client?.name}</p>
            {orden.client?.cuit && (
              <p className="text-xs text-muted-foreground">CUIT: {orden.client.cuit}</p>
            )}
          </div>

          {/* Vendedor */}
          <div>
            <p className="text-sm text-muted-foreground">Vendedor</p>
            <p className="font-semibold">{orden.seller?.name || 'No asignado'}</p>
          </div>

          {/* Fecha de Entrega */}
          <div>
            <p className="text-sm text-muted-foreground">Entrega Estimada</p>
            <p className="font-semibold">
              {orden.fechaEntregaEstimada
                ? formatDate(orden.fechaEntregaEstimada)
                : 'No especificada'
              }
            </p>
            {orden.fechaEntregaReal && (
              <p className="text-xs text-success">
                Real: {formatDate(orden.fechaEntregaReal)}
              </p>
            )}
          </div>

          {/* Total */}
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">
              {orden.moneda} {Number(orden.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Condiciones y notas */}
        {(orden.condicionesPago || orden.lugarEntrega) && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
            {orden.condicionesPago && (
              <div>
                <p className="text-sm text-muted-foreground">Condiciones de Pago</p>
                <p className="text-sm">{orden.condicionesPago}</p>
                {orden.diasPlazo && (
                  <p className="text-xs text-muted-foreground">{orden.diasPlazo} días de plazo</p>
                )}
              </div>
            )}
            {orden.lugarEntrega && (
              <div>
                <p className="text-sm text-muted-foreground">Lugar de Entrega</p>
                <p className="text-sm">{orden.lugarEntrega}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
