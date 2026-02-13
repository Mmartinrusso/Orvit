'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShoppingCart,
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CreditCard,
  Package,
  Truck,
  MoreHorizontal,
  Send,
  Check,
  X,
  RotateCcw,
  Printer,
  Edit,
  Loader2,
  History,
  FileText,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { generatePurchaseOrderPDF, PurchaseOrderPDFData } from '@/lib/pdf/purchase-order-pdf';
import { CompletarOCModal } from './completar-oc-modal';

interface Proveedor {
  id: number;
  name: string;
  cuit?: string;
  razon_social?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface OrdenItem {
  id: number;
  descripcion: string;
  codigoPropio?: string;
  codigoProveedor?: string;
  cantidad: number;
  cantidadRecibida: number;
  cantidadPendiente: number;
  unidad: string;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  supplierItem?: {
    id: number;
    nombre: string;
    codigoProveedor?: string;
  };
}

interface GoodsReceipt {
  id: number;
  numero: string;
  fechaRecepcion: string;
  estado: string;
}

interface OrdenCompra {
  id: number;
  numero: string;
  estado: string;
  fechaEmision: string;
  fechaEntregaEsperada: string | null;
  fechaEntregaReal: string | null;
  condicionesPago: string | null;
  moneda: string;
  subtotal: number;
  tasaIva: number;
  impuestos: number;
  total: number;
  notas: string | null;
  notasInternas: string | null;
  esEmergencia: boolean;
  motivoEmergencia: string | null;
  motivoRechazo: string | null;
  proveedor: Proveedor;
  items: OrdenItem[];
  goodsReceipts: GoodsReceipt[];
  createdByUser?: { id: number; name: string };
  aprobadoByUser?: { id: number; name: string };
  aprobadoAt?: string;
  rechazadoByUser?: { id: number; name: string };
  rechazadoAt?: string;
}

type EstadoOC =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ENVIADA_PROVEEDOR'
  | 'CONFIRMADA'
  | 'PARCIALMENTE_RECIBIDA'
  | 'COMPLETADA'
  | 'CANCELADA';

const ESTADOS_CONFIG: Record<EstadoOC, { label: string; color: string; icon: React.ElementType }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileEdit },
  PENDIENTE_APROBACION: { label: 'Pend. Aprobación', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  APROBADA: { label: 'Aprobada', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
  RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  ENVIADA_PROVEEDOR: { label: 'Enviada', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Send },
  CONFIRMADA: { label: 'Confirmada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  PARCIALMENTE_RECIBIDA: { label: 'Parcial', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Package },
  COMPLETADA: { label: 'Completada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

const ACCIONES_POR_ESTADO: Record<EstadoOC, string[]> = {
  BORRADOR: ['enviar_aprobacion', 'enviar_proveedor', 'editar'],
  PENDIENTE_APROBACION: ['aprobar', 'rechazar'],
  APROBADA: ['enviar_proveedor'],
  RECHAZADA: ['reabrir', 'editar'],
  ENVIADA_PROVEEDOR: ['completar'],  // Completar abre modal de factura
  CONFIRMADA: ['completar', 'imprimir'],
  PARCIALMENTE_RECIBIDA: ['completar', 'imprimir'],
  COMPLETADA: ['imprimir'],
  CANCELADA: ['reabrir'],
};

interface OrdenCompraDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordenId: number | null;
  onEdit?: (ordenId: number) => void;
  onRefresh?: () => void;
}

export function OrdenCompraDetailModal({
  open,
  onOpenChange,
  ordenId,
  onEdit,
  onRefresh,
}: OrdenCompraDetailModalProps) {
  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [completarModalOpen, setCompletarModalOpen] = useState(false);

  useEffect(() => {
    if (open && ordenId) {
      loadOrden();
    }
  }, [open, ordenId]);

  const loadOrden = async () => {
    if (!ordenId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenId}`);
      if (response.ok) {
        const data = await response.json();
        setOrden(data);
      } else {
        toast.error('Error al cargar la orden');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error loading orden:', error);
      toast.error('Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  };

  const ejecutarAccion = async (accion: string, motivo?: string) => {
    if (!ordenId) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenId}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, motivo }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Acción ejecutada');
        loadOrden();
        onRefresh?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al ejecutar la acción');
      }
    } catch (error) {
      console.error('Error ejecutando acción:', error);
      toast.error('Error al ejecutar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    if (!orden) return;

    const pdfData: PurchaseOrderPDFData = {
      numero: orden.numero,
      fechaEmision: orden.fechaEmision,
      fechaEntregaEsperada: orden.fechaEntregaEsperada,
      estado: orden.estado,
      condicionesPago: orden.condicionesPago,
      moneda: orden.moneda,
      subtotal: orden.subtotal,
      tasaIva: orden.tasaIva || 21,
      impuestos: orden.impuestos,
      total: orden.total,
      notas: orden.notas,
      esEmergencia: orden.esEmergencia,
      motivoEmergencia: orden.motivoEmergencia,
      proveedor: {
        name: orden.proveedor.name,
        razonSocial: orden.proveedor.razon_social,
        cuit: orden.proveedor.cuit,
        email: orden.proveedor.email,
        phone: orden.proveedor.phone,
        address: orden.proveedor.address,
      },
      items: orden.items.map(item => ({
        descripcion: item.descripcion || item.supplierItem?.nombre || '',
        cantidad: item.cantidad,
        unidad: item.unidad,
        precioUnitario: item.precioUnitario,
        descuento: item.descuento,
        subtotal: item.subtotal,
        codigoProveedor: item.supplierItem?.codigoProveedor,
      })),
      createdByUser: orden.createdByUser,
    };

    try {
      const pdfUrl = generatePurchaseOrderPDF(pdfData);
      window.open(pdfUrl, '_blank');
      toast.success('PDF generado');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_CONFIG[estado as EstadoOC] || ESTADOS_CONFIG.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border text-xs px-2 py-1 font-medium`}>
        <Icon className="w-3.5 h-3.5 mr-1.5" />
        {config.label}
      </Badge>
    );
  };

  const getDiasAtraso = (): number | null => {
    if (!orden?.fechaEntregaEsperada) return null;
    if (['COMPLETADA', 'CANCELADA'].includes(orden.estado)) return null;
    const dias = differenceInDays(new Date(), new Date(orden.fechaEntregaEsperada));
    return dias > 0 ? dias : null;
  };

  const acciones = orden ? ACCIONES_POR_ESTADO[orden.estado as EstadoOC] || [] : [];
  const diasAtraso = getDiasAtraso();

  const canEdit = (estado: string) => ['BORRADOR', 'RECHAZADA'].includes(estado);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !orden ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Orden no encontrada</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-lg font-semibold">{orden.numero}</DialogTitle>
                  {orden.esEmergencia && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Emergencia
                    </Badge>
                  )}
                  {diasAtraso && (
                    <Badge variant="destructive" className="text-xs">
                      Atrasada {diasAtraso}d
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getEstadoBadge(orden.estado)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={actionLoading}>
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Acciones'}
                        <MoreHorizontal className="w-4 h-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {canEdit(orden.estado) && onEdit && (
                        <DropdownMenuItem onClick={() => { onOpenChange(false); onEdit(orden.id); }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {acciones.includes('enviar_aprobacion') && (
                        <DropdownMenuItem onClick={() => ejecutarAccion('enviar_aprobacion')}>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar a Aprobación
                        </DropdownMenuItem>
                      )}
                      {acciones.includes('aprobar') && (
                        <DropdownMenuItem onClick={() => ejecutarAccion('aprobar')}>
                          <Check className="w-4 h-4 mr-2" />
                          Aprobar
                        </DropdownMenuItem>
                      )}
                      {acciones.includes('rechazar') && (
                        <DropdownMenuItem onClick={() => {
                          const motivo = prompt('Motivo del rechazo:');
                          if (motivo) ejecutarAccion('rechazar', motivo);
                        }}>
                          <X className="w-4 h-4 mr-2" />
                          Rechazar
                        </DropdownMenuItem>
                      )}
                      {acciones.includes('enviar_proveedor') && (
                        <DropdownMenuItem onClick={() => ejecutarAccion('enviar_proveedor')}>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar a Proveedor
                        </DropdownMenuItem>
                      )}
                      {acciones.includes('completar') && (
                        <DropdownMenuItem onClick={() => setCompletarModalOpen(true)}>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Completar (Cargar Factura)
                        </DropdownMenuItem>
                      )}
                      {acciones.includes('reabrir') && (
                        <DropdownMenuItem onClick={() => ejecutarAccion('reabrir')}>
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Reabrir
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleGeneratePDF}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </DialogHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Info Cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Proveedor</p>
                      <p className="font-medium text-sm truncate">{orden.proveedor.name}</p>
                      {orden.proveedor.cuit && (
                        <p className="text-xs text-muted-foreground">CUIT: {orden.proveedor.cuit}</p>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fechas</p>
                      <p className="text-sm">
                        Emisión: {format(new Date(orden.fechaEmision), 'dd/MM/yy', { locale: es })}
                      </p>
                      {orden.fechaEntregaEsperada && (
                        <p className={`text-sm ${diasAtraso ? 'text-red-600' : ''}`}>
                          Entrega: {format(new Date(orden.fechaEntregaEsperada), 'dd/MM/yy', { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Condiciones</p>
                      <p className="text-sm">{orden.condicionesPago || '-'}</p>
                      <p className="text-xs text-muted-foreground">{orden.moneda}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Alertas */}
              {orden.estado === 'RECHAZADA' && orden.motivoRechazo && (
                <Card className="border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700 text-sm">Orden Rechazada</p>
                      <p className="text-sm text-red-600">{orden.motivoRechazo}</p>
                    </div>
                  </div>
                </Card>
              )}

              {orden.esEmergencia && orden.motivoEmergencia && (
                <Card className="border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-700 text-sm">Compra de Emergencia</p>
                      <p className="text-sm text-orange-600">{orden.motivoEmergencia}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Tabla de Items */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Items ({orden.items.length})
                </h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs w-[70px] text-center">Cant.</TableHead>
                        <TableHead className="text-xs w-[70px] text-center">Recib.</TableHead>
                        <TableHead className="text-xs w-[90px] text-right">Precio</TableHead>
                        <TableHead className="text-xs w-[90px] text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orden.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            <div>
                              {item.descripcion || item.supplierItem?.nombre}
                              {(item.codigoProveedor || item.supplierItem?.codigoProveedor) && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({item.codigoProveedor || item.supplierItem?.codigoProveedor})
                                </span>
                              )}
                            </div>
                            {item.codigoPropio && (
                              <div className="text-xs text-muted-foreground">
                                Cód. Interno: <span className="font-mono">{item.codigoPropio}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {item.cantidad} {item.unidad}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {item.cantidadRecibida > 0 ? (
                              <span className={item.cantidadRecibida >= item.cantidad ? 'text-green-600' : 'text-orange-600'}>
                                {item.cantidadRecibida}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatCurrency(item.precioUnitario, orden.moneda)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(item.subtotal, orden.moneda)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totales */}
                <div className="flex justify-end mt-3">
                  <div className="w-48 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{formatCurrency(orden.subtotal, orden.moneda)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA ({orden.tasaIva || 21}%):</span>
                      <span>{formatCurrency(orden.impuestos, orden.moneda)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(orden.total, orden.moneda)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recepciones */}
              {orden.goodsReceipts && orden.goodsReceipts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Recepciones ({orden.goodsReceipts.length})
                  </h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">N° Recepción</TableHead>
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orden.goodsReceipts.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="text-sm font-medium">{rec.numero}</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(rec.fechaRecepcion), 'dd/MM/yy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{rec.estado}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Notas */}
              {(orden.notas || orden.notasInternas) && (
                <div className="grid grid-cols-2 gap-3">
                  {orden.notas && (
                    <Card className="p-3">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Notas</p>
                          <p className="text-sm whitespace-pre-wrap">{orden.notas}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  {orden.notasInternas && (
                    <Card className="p-3 border-yellow-200 bg-yellow-50/50">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Notas Internas</p>
                          <p className="text-sm whitespace-pre-wrap">{orden.notasInternas}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>

      {/* Modal Completar OC */}
      {orden && (
        <CompletarOCModal
          open={completarModalOpen}
          onClose={() => setCompletarModalOpen(false)}
          ordenId={orden.id}
          ordenNumero={orden.numero}
          proveedorId={orden.proveedor.id}
          proveedorNombre={orden.proveedor.name}
          total={orden.total}
          moneda={orden.moneda}
          onSuccess={() => {
            loadOrden();
            onRefresh?.();
          }}
        />
      )}
    </Dialog>
  );
}

export default OrdenCompraDetailModal;
