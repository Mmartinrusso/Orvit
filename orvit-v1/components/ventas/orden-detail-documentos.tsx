'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Truck, Package, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface OrdenDetailDocumentosProps {
  deliveries?: any[];
  remitos?: any[];
  invoices?: any[];
  loadOrders?: any[];
}

const estadoColors: Record<string, string> = {
  PENDIENTE: 'bg-muted text-foreground',
  PREPARADO: 'bg-warning-muted text-warning-muted-foreground',
  CARGADO: 'bg-info-muted text-info-muted-foreground',
  EN_TRANSITO: 'bg-purple-100 text-purple-800',
  ENTREGADA: 'bg-success-muted text-success-muted-foreground',
  EMITIDO: 'bg-success-muted text-success-muted-foreground',
  BORRADOR: 'bg-muted text-foreground',
  EMITIDA: 'bg-info-muted text-info-muted-foreground',
  COBRADA: 'bg-success-muted text-success-muted-foreground',
  COMPLETADA: 'bg-teal-100 text-teal-800',
  CANCELADA: 'bg-destructive/10 text-destructive',
  ANULADA: 'bg-destructive/10 text-destructive',
};

export function OrdenDetailDocumentos({
  deliveries = [],
  remitos = [],
  invoices = [],
  loadOrders = []
}: OrdenDetailDocumentosProps) {
  const hasDocuments = deliveries.length > 0 || remitos.length > 0 || invoices.length > 0 || loadOrders.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentos Relacionados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasDocuments ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No se han generado documentos para esta orden
            </p>
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Crear Paquete de Documentos
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Órdenes de Carga */}
            {loadOrders.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Órdenes de Carga ({loadOrders.length})
                </h4>
                <div className="space-y-2">
                  {loadOrders.map((loadOrder) => (
                    <div
                      key={loadOrder.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{loadOrder.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(loadOrder.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                        {loadOrder.vehiculo && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Vehículo: {loadOrder.vehiculo} {loadOrder.vehiculoPatente && `(${loadOrder.vehiculoPatente})`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={estadoColors[loadOrder.estado]}>
                          {loadOrder.estado}
                        </Badge>
                        <Link href={`/administracion/ventas/ordenes-carga/${loadOrder.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entregas */}
            {deliveries.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Entregas ({deliveries.length})
                </h4>
                <div className="space-y-2">
                  {deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{delivery.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {delivery.fechaEntrega
                            ? format(new Date(delivery.fechaEntrega), 'dd/MM/yyyy', { locale: es })
                            : 'Fecha no especificada'
                          }
                        </p>
                        {delivery.direccionEntrega && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {delivery.direccionEntrega}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={estadoColors[delivery.estado]}>
                          {delivery.estado}
                        </Badge>
                        <Link href={`/administracion/ventas/entregas/${delivery.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remitos */}
            {remitos.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Remitos ({remitos.length})
                </h4>
                <div className="space-y-2">
                  {remitos.map((remito) => (
                    <div
                      key={remito.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {remito.numeroCompleto || remito.numero}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {remito.fechaEmision
                            ? format(new Date(remito.fechaEmision), 'dd/MM/yyyy', { locale: es })
                            : 'Sin emitir'
                          }
                        </p>
                        {remito.cae && (
                          <p className="text-xs text-muted-foreground mt-1">
                            CAE: {remito.cae}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={estadoColors[remito.estado]}>
                          {remito.estado}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {remito.estado === 'EMITIDO' && (
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Facturas */}
            {invoices.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Facturas ({invoices.length})
                </h4>
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {invoice.numeroCompleto || `${invoice.tipo}-${invoice.puntoVenta}-${invoice.numero}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.fechaEmision
                            ? format(new Date(invoice.fechaEmision), 'dd/MM/yyyy', { locale: es })
                            : 'Sin emitir'
                          }
                        </p>
                        <p className="text-sm font-semibold mt-1">
                          Total: ${Number(invoice.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                        {invoice.saldoPendiente && Number(invoice.saldoPendiente) > 0 && (
                          <p className="text-xs text-warning-muted-foreground">
                            Saldo pendiente: ${Number(invoice.saldoPendiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={estadoColors[invoice.estado]}>
                          {invoice.estado}
                        </Badge>
                        <Link href={`/administracion/ventas/facturas/${invoice.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {invoice.estado === 'EMITIDA' && (
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
