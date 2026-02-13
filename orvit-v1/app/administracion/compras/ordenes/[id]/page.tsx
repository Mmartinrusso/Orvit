'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  ShoppingCart,
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  User,
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
  Receipt,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import { generatePurchaseOrderPDF, PurchaseOrderPDFData } from '@/lib/pdf/purchase-order-pdf';

interface Proveedor {
  id: number;
  name: string;
  cuit?: string;
  razon_social?: string;
  email?: string;
  phone?: string;
  address?: string;
  condiciones_pago?: string;
}

interface OrdenItem {
  id: number;
  descripcion: string;
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

interface AuditLog {
  id: number;
  accion: string;
  datosAnteriores: any;
  datosNuevos: any;
  createdAt: string;
  user?: { name: string };
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
  requiereAprobacion: boolean;
  proveedor: Proveedor;
  items: OrdenItem[];
  goodsReceipts: GoodsReceipt[];
  createdByUser?: { id: number; name: string };
  aprobadoByUser?: { id: number; name: string };
  aprobadoAt?: string;
  rechazadoByUser?: { id: number; name: string };
  rechazadoAt?: string;
  costCenter?: { id: number; codigo: string; nombre: string };
  project?: { id: number; codigo: string; nombre: string };
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
  PENDIENTE_APROBACION: { label: 'Pendiente de Aprobación', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  APROBADA: { label: 'Aprobada', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
  RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  ENVIADA_PROVEEDOR: { label: 'Enviada al Proveedor', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Send },
  CONFIRMADA: { label: 'Confirmada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  PARCIALMENTE_RECIBIDA: { label: 'Parcialmente Recibida', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Package },
  COMPLETADA: { label: 'Completada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

const ACCIONES_POR_ESTADO: Record<EstadoOC, string[]> = {
  BORRADOR: ['enviar_aprobacion', 'enviar_proveedor', 'editar'],
  PENDIENTE_APROBACION: ['aprobar', 'rechazar'],
  APROBADA: ['enviar_proveedor'],
  RECHAZADA: ['reabrir', 'editar'],
  ENVIADA_PROVEEDOR: ['confirmar'],
  CONFIRMADA: ['crear_recepcion', 'completar', 'imprimir'],
  PARCIALMENTE_RECIBIDA: ['crear_recepcion', 'completar', 'imprimir'],
  COMPLETADA: ['imprimir'],
  CANCELADA: ['reabrir'],
};

export default function OrdenCompraDetallePage() {
  const router = useRouter();
  const params = useParams();
  const ordenId = params.id as string;

  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [historial, setHistorial] = useState<AuditLog[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Dialogs
  const [rechazarDialogOpen, setRechazarDialogOpen] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  useEffect(() => {
    if (ordenId) {
      loadOrden();
      loadHistorial();
    }
  }, [ordenId]);

  const loadOrden = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenId}`);
      if (response.ok) {
        const data = await response.json();
        setOrden(data);
      } else {
        toast.error('Error al cargar la orden');
        router.push('/administracion/compras/ordenes');
      }
    } catch (error) {
      console.error('Error loading orden:', error);
      toast.error('Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  };

  const loadHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenId}/historial`);
      if (response.ok) {
        const data = await response.json();
        setHistorial(data || []);
      }
    } catch (error) {
      console.error('Error loading historial:', error);
    } finally {
      setLoadingHistorial(false);
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
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const ejecutarAccion = async (accion: string, motivo?: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenId}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, motivo }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Acción ejecutada correctamente');
        loadOrden();
        loadHistorial();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al ejecutar la acción');
      }
    } catch (error) {
      console.error('Error ejecutando acción:', error);
      toast.error('Error al ejecutar la acción');
    } finally {
      setActionLoading(false);
      setRechazarDialogOpen(false);
      setMotivoRechazo('');
    }
  };

  const handleRechazar = () => {
    if (!motivoRechazo.trim()) {
      toast.error('Ingrese el motivo del rechazo');
      return;
    }
    ejecutarAccion('rechazar', motivoRechazo);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)]">
        <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Orden no encontrada</p>
        <Button variant="link" onClick={() => router.push('/administracion/compras/ordenes')}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const diasAtraso = getDiasAtraso();

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">{orden.numero}</h1>
                {orden.esEmergencia && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Emergencia
                  </Badge>
                )}
                {diasAtraso && (
                  <Badge variant="destructive" className="text-xs">
                    Atrasada {diasAtraso} días
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{orden.proveedor.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getEstadoBadge(orden.estado)}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Acciones
                      <MoreHorizontal className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {acciones.includes('editar') && (
                  <DropdownMenuItem onClick={() => router.push(`/administracion/compras/ordenes/${orden.id}/editar`)}>
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
                  <DropdownMenuItem onClick={() => setRechazarDialogOpen(true)}>
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
                {acciones.includes('confirmar') && (
                  <DropdownMenuItem onClick={() => ejecutarAccion('confirmar')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar Proveedor
                  </DropdownMenuItem>
                )}
                {acciones.includes('completar') && (
                  <DropdownMenuItem onClick={() => ejecutarAccion('completar')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Marcar Completada
                  </DropdownMenuItem>
                )}
                {acciones.includes('reabrir') && (
                  <DropdownMenuItem onClick={() => ejecutarAccion('reabrir')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reabrir
                  </DropdownMenuItem>
                )}
                {acciones.includes('crear_recepcion') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push(`/administracion/compras/recepciones/nueva?ocId=${orden.id}`)}>
                      <Truck className="w-4 h-4 mr-2" />
                      Nueva Recepción
                    </DropdownMenuItem>
                  </>
                )}
                {acciones.includes('imprimir') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleGeneratePDF}>
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir PDF
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Proveedor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-semibold">{orden.proveedor.name}</p>
              {orden.proveedor.cuit && (
                <p className="text-sm text-muted-foreground">CUIT: {orden.proveedor.cuit}</p>
              )}
              {orden.proveedor.email && (
                <p className="text-sm text-muted-foreground">{orden.proveedor.email}</p>
              )}
              {orden.proveedor.phone && (
                <p className="text-sm text-muted-foreground">{orden.proveedor.phone}</p>
              )}
              <Link
                href={`/administracion/compras/proveedores/${orden.proveedor.id}`}
                className="text-xs text-primary hover:underline inline-block mt-2"
              >
                Ver proveedor →
              </Link>
            </CardContent>
          </Card>

          {/* Fechas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Emisión:</span>
                <span className="text-sm font-medium">
                  {format(new Date(orden.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Entrega:</span>
                <span className={`text-sm font-medium ${diasAtraso ? 'text-red-600' : ''}`}>
                  {orden.fechaEntregaEsperada
                    ? format(new Date(orden.fechaEntregaEsperada), 'dd/MM/yyyy', { locale: es })
                    : '-'}
                </span>
              </div>
              {orden.fechaEntregaReal && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entregado:</span>
                  <span className="text-sm font-medium text-green-600">
                    {format(new Date(orden.fechaEntregaReal), 'dd/MM/yyyy', { locale: es })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info adicional */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Condiciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pago:</span>
                <span className="text-sm font-medium">{orden.condicionesPago || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Moneda:</span>
                <span className="text-sm font-medium">{orden.moneda}</span>
              </div>
              {orden.createdByUser && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Creado por:</span>
                  <span className="text-sm font-medium">{orden.createdByUser.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas / Mensajes */}
        {orden.estado === 'RECHAZADA' && orden.motivoRechazo && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Orden Rechazada</p>
                  <p className="text-sm text-red-600 mt-1">{orden.motivoRechazo}</p>
                  {orden.rechazadoByUser && (
                    <p className="text-xs text-red-500 mt-2">
                      Por {orden.rechazadoByUser.name} el{' '}
                      {orden.rechazadoAt && format(new Date(orden.rechazadoAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {orden.esEmergencia && orden.motivoEmergencia && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-700">Compra de Emergencia</p>
                  <p className="text-sm text-orange-600 mt-1">{orden.motivoEmergencia}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla de Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Items ({orden.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs w-[80px] text-center">Cant.</TableHead>
                  <TableHead className="text-xs w-[80px] text-center">Recibido</TableHead>
                  <TableHead className="text-xs w-[80px] text-center">Pendiente</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">Precio Unit.</TableHead>
                  <TableHead className="text-xs w-[60px] text-center">Desc.</TableHead>
                  <TableHead className="text-xs w-[100px] text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.descripcion || item.supplierItem?.nombre}</p>
                        {item.supplierItem?.codigoProveedor && (
                          <p className="text-xs text-muted-foreground">Cód: {item.supplierItem.codigoProveedor}</p>
                        )}
                      </div>
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
                    <TableCell className="text-center text-sm">
                      {item.cantidadPendiente > 0 ? (
                        <span className="text-orange-600">{item.cantidadPendiente}</span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.precioUnitario, orden.moneda)}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {item.descuento > 0 ? `${item.descuento}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(item.subtotal, orden.moneda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totales */}
            <div className="border-t p-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(orden.subtotal, orden.moneda)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA ({orden.tasaIva || 21}%):</span>
                    <span>{formatCurrency(orden.impuestos, orden.moneda)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(orden.total, orden.moneda)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recepciones */}
        {orden.goodsReceipts && orden.goodsReceipts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Recepciones ({orden.goodsReceipts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">N° Recepción</TableHead>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orden.goodsReceipts.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium text-sm">{rec.numero}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(rec.fechaRecepcion), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {rec.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/administracion/compras/recepciones/${rec.id}`)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Notas */}
        {(orden.notas || orden.notasInternas) && (
          <div className="grid grid-cols-2 gap-4">
            {orden.notas && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{orden.notas}</p>
                </CardContent>
              </Card>
            )}
            {orden.notasInternas && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notas Internas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{orden.notasInternas}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Historial (Timeline) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistorial ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : historial.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay registros en el historial
              </p>
            ) : (
              <div className="space-y-4">
                {historial.map((log, index) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      {index < historial.length - 1 && <div className="w-px h-full bg-border flex-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">
                        {log.accion.replace(/_/g, ' ')}
                      </p>
                      {log.datosNuevos?.motivo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Motivo: {log.datosNuevos.motivo}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                        {log.user && ` por ${log.user.name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Rechazar */}
      <Dialog open={rechazarDialogOpen} onOpenChange={setRechazarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Orden de Compra</DialogTitle>
            <DialogDescription>
              Ingrese el motivo del rechazo. Esta información será visible para el solicitante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo del rechazo *</Label>
              <Textarea
                placeholder="Describa el motivo del rechazo..."
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarDialogOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRechazar} disabled={actionLoading || !motivoRechazo.trim()}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Rechazar Orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
