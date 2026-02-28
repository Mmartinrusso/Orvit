'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  MoreVertical,
  FileText,
  Send,
  Ban,
  Trash2,
  CheckCircle,
  XCircle,
  User,
  Building,
  Calendar,
  Clock,
  DollarSign,
  Package,
  FileCheck,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Receipt,
  CreditCard,
} from 'lucide-react';
import { usePermission } from '@/hooks/use-permissions';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/date-utils';

interface FacturaDetailSheetProps {
  invoiceId: number;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface Invoice {
  id: number;
  numero: string;
  estado: string;
  tipoFactura?: string;
  puntoVenta?: number;
  fechaEmision?: string;
  fechaVencimiento?: string;
  subtotal: number;
  descuento?: number;
  iva: number;
  total: number;
  saldoPendiente: number;
  moneda: string;
  cae?: string;
  caeVencimiento?: string;
  observaciones?: string;
  motivoAnulacion?: string;
  docType: string;
  client: {
    id: number;
    legalName?: string;
    name?: string;
    cuit?: string;
    email?: string;
    phone?: string;
  };
  sale?: {
    id: number;
    numero: string;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
  items: Array<{
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento?: number;
    iva: number;
    subtotal: number;
    product?: {
      id: number;
      name: string;
      sku?: string;
    };
  }>;
  payments?: Array<{
    id: number;
    numero: string;
    fecha: string;
    monto: number;
    metodoPago: string;
  }>;
  _count?: {
    items: number;
    payments: number;
  };
}

const estadoConfig: Record<string, { label: string; color: string; icon: any }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-muted text-foreground', icon: FileText },
  EMITIDA: { label: 'Emitida', color: 'bg-info-muted text-info-muted-foreground', icon: Send },
  ENVIADA: { label: 'Enviada', color: 'bg-accent-cyan-muted text-accent-cyan-muted-foreground', icon: Send },
  PARCIALMENTE_COBRADA: { label: 'Parcial', color: 'bg-warning-muted text-warning-muted-foreground', icon: CreditCard },
  COBRADA: { label: 'Cobrada', color: 'bg-success-muted text-success', icon: CheckCircle },
  VENCIDA: { label: 'Vencida', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  ANULADA: { label: 'Anulada', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

export function FacturaDetailSheet({ invoiceId, open, onClose, onUpdate }: FacturaDetailSheetProps) {
  const router = useRouter();
  const { hasPermission: canSendInvoice } = usePermission('ventas.facturas.send');
  const { hasPermission: canApplyPayment } = usePermission('ventas.pagos.apply');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    requiresInput?: boolean;
    inputLabel?: string;
  }>({ open: false, title: '', description: '', action: () => {} });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoice();
    }
  }, [open, invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/facturas/${invoiceId}`);
      if (!response.ok) throw new Error('Error al cargar factura');
      const data = await response.json();
      setInvoice(data);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Error al cargar la factura');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!invoice) return;

    switch (action) {
      case 'pdf':
        window.open(`/api/ventas/facturas/${invoice.id}/pdf`, '_blank');
        break;

      case 'emitir':
        setConfirmDialog({
          open: true,
          title: 'Emitir factura',
          description: `¿Desea emitir la factura ${invoice.numero}? El estado cambiará a "Emitida" y se generará el comprobante fiscal.`,
          action: async () => {
            setActionLoading(true);
            try {
              const response = await fetch(`/api/ventas/facturas/${invoice.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'emitir' }),
              });
              if (!response.ok) throw new Error('Error al emitir');
              toast.success('Factura emitida correctamente');
              fetchInvoice();
              onUpdate?.();
            } catch (error) {
              toast.error('Error al emitir la factura');
            } finally {
              setActionLoading(false);
            }
          }
        });
        break;

      case 'anular':
        setConfirmDialog({
          open: true,
          title: 'Anular factura',
          description: `¿Desea anular la factura ${invoice.numero}? Esta acción no se puede deshacer.`,
          requiresInput: true,
          inputLabel: 'Motivo de anulación',
          action: async () => {
            if (!inputValue || inputValue.trim() === '') {
              toast.error('Debe especificar un motivo para anular la factura');
              return;
            }

            setActionLoading(true);
            try {
              const response = await fetch(`/api/ventas/facturas/${invoice.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'anular', motivo: inputValue }),
              });
              if (!response.ok) throw new Error('Error al anular');
              toast.success('Factura anulada correctamente');
              fetchInvoice();
              onUpdate?.();
              setInputValue('');
            } catch (error) {
              toast.error('Error al anular la factura');
            } finally {
              setActionLoading(false);
            }
          }
        });
        break;

      case 'ver_ov':
        if (invoice.sale) {
          router.push(`/administracion/ventas/ordenes/${invoice.sale.id}`);
        }
        break;

      case 'registrar_pago':
        router.push(`/administracion/ventas/pagos/nuevo?facturaId=${invoice.id}`);
        break;
    }
  };

  const StatusBadge = ({ estado }: { estado: string }) => {
    const config = estadoConfig[estado] || estadoConfig.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent size="xl" className="overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!invoice) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent size="xl" className="overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Factura no encontrada</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const isPendiente = invoice.saldoPendiente > 0 && invoice.estado !== 'ANULADA' && invoice.estado !== 'BORRADOR';
  const daysOverdue = invoice.fechaVencimiento
    ? differenceInDays(new Date(), new Date(invoice.fechaVencimiento))
    : 0;
  const isOverdue = daysOverdue > 0 && isPendiente;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent size="xl" className="overflow-y-auto">
          <SheetHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <SheetTitle className="text-2xl">Factura {invoice.numero}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge estado={invoice.estado} />
                    {invoice.tipoFactura && (
                      <Badge variant="outline">Tipo {invoice.tipoFactura}</Badge>
                    )}
                    {invoice.docType && (
                      <Badge variant="outline">{invoice.docType === 'T1' ? 'T1' : 'T2'}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={actionLoading}>
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MoreVertical className="w-4 h-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAction('pdf')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </DropdownMenuItem>

                  {invoice.estado === 'BORRADOR' && canSendInvoice && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleAction('emitir')}>
                        <Send className="w-4 h-4 mr-2" />
                        Emitir factura
                      </DropdownMenuItem>
                    </>
                  )}

                  {isPendiente && invoice.estado !== 'BORRADOR' && canApplyPayment && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleAction('registrar_pago')}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Registrar pago
                      </DropdownMenuItem>
                    </>
                  )}

                  {invoice.sale && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleAction('ver_ov')}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ver orden de venta
                      </DropdownMenuItem>
                    </>
                  )}

                  {invoice.estado !== 'ANULADA' && invoice.estado !== 'BORRADOR' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleAction('anular')}
                        className="text-destructive"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Anular factura
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Alert for overdue */}
            {isOverdue && (
              <Card className="border-destructive/30 bg-destructive/10">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">
                      Factura vencida hace {daysOverdue} día{daysOverdue !== 1 ? 's' : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </SheetHeader>

          <Tabs defaultValue="general" className="mt-6">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="items">Items ({invoice._count?.items || 0})</TabsTrigger>
              <TabsTrigger value="pagos">Pagos ({invoice._count?.payments || 0})</TabsTrigger>
              <TabsTrigger value="afip">AFIP</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Client Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Información del Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Razón Social</p>
                      <p className="font-medium">
                        {invoice.client.legalName || invoice.client.name || 'Sin nombre'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CUIT</p>
                      <p className="font-medium">{invoice.client.cuit || 'No especificado'}</p>
                    </div>
                    {invoice.client.email && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="font-medium">{invoice.client.email}</p>
                      </div>
                    )}
                    {invoice.client.phone && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                        <p className="font-medium">{invoice.client.phone}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Detalles de la Factura
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {invoice.fechaEmision && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Fecha de Emisión</p>
                        <p className="font-medium">
                          {format(new Date(invoice.fechaEmision), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                      </div>
                    )}
                    {invoice.fechaVencimiento && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Fecha de Vencimiento</p>
                        <p className="font-medium">
                          {format(new Date(invoice.fechaVencimiento), "d 'de' MMMM, yyyy", { locale: es })}
                          {isOverdue && (
                            <span className="text-destructive text-xs ml-2">
                              (Vencida)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    {invoice.sale && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Orden de Venta</p>
                        <Button
                          variant="link"
                          className="h-auto p-0 font-medium"
                          onClick={() => handleAction('ver_ov')}
                        >
                          {invoice.sale.numero}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    )}
                    {invoice.puntoVenta && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Punto de Venta</p>
                        <p className="font-medium">{invoice.puntoVenta.toString().padStart(4, '0')}</p>
                      </div>
                    )}
                    {invoice.createdByUser && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Creada por</p>
                        <p className="font-medium">{invoice.createdByUser.name}</p>
                      </div>
                    )}
                  </div>

                  {invoice.observaciones && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Observaciones</p>
                      <p className="text-sm bg-muted p-3 rounded-md">{invoice.observaciones}</p>
                    </div>
                  )}

                  {invoice.motivoAnulacion && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-destructive mb-1">Motivo de Anulación</p>
                      <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/30">
                        {invoice.motivoAnulacion}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Amounts Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Resumen de Montos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.moneda)}</span>
                    </div>
                    {invoice.descuento && invoice.descuento > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Descuento</span>
                        <span className="font-medium text-destructive">
                          -{formatCurrency(invoice.descuento, invoice.moneda)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA</span>
                      <span className="font-medium">{formatCurrency(invoice.iva, invoice.moneda)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold">{formatCurrency(invoice.total, invoice.moneda)}</span>
                    </div>
                    {isPendiente && (
                      <>
                        <div className="flex justify-between text-lg">
                          <span className="font-semibold">Cobrado</span>
                          <span className="font-bold text-success">
                            {formatCurrency(invoice.total - invoice.saldoPendiente, invoice.moneda)}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg">
                          <span className="font-semibold text-destructive">Saldo Pendiente</span>
                          <span className="font-bold text-destructive">
                            {formatCurrency(invoice.saldoPendiente, invoice.moneda)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Items Tab */}
            <TabsContent value="items" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Items de la Factura</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                        <TableHead className="text-right">Descuento</TableHead>
                        <TableHead className="text-right">IVA</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.descripcion}</p>
                              {item.product && (
                                <p className="text-xs text-muted-foreground">
                                  {item.product.sku || item.product.name}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.cantidad}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.precioUnitario, invoice.moneda)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.descuento ? formatCurrency(item.descuento, invoice.moneda) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.iva, invoice.moneda)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.subtotal, invoice.moneda)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="pagos" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Pagos Registrados</CardTitle>
                    {isPendiente && invoice.estado !== 'BORRADOR' && (
                      <Button onClick={() => handleAction('registrar_pago')}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Registrar Pago
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {invoice.payments && invoice.payments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.numero}</TableCell>
                            <TableCell>
                              {formatDate(payment.fecha)}
                            </TableCell>
                            <TableCell>{payment.metodoPago}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(payment.monto, invoice.moneda)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>No hay pagos registrados</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AFIP Tab */}
            <TabsContent value="afip" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5" />
                    Información AFIP
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {invoice.cae ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">CAE (Código de Autorización Electrónico)</p>
                        <p className="font-mono font-bold text-lg">{invoice.cae}</p>
                      </div>
                      {invoice.caeVencimiento && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Vencimiento CAE</p>
                          <p className="font-medium">
                            {formatDate(invoice.caeVencimiento)}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-success bg-success-muted p-3 rounded-md">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Factura autorizada por AFIP</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-warning-muted-foreground" />
                      <p className="text-muted-foreground">
                        {invoice.estado === 'BORRADOR'
                          ? 'La factura debe ser emitida para obtener autorización de AFIP'
                          : 'No hay información de AFIP disponible'
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          setConfirmDialog({ ...confirmDialog, open });
          if (!open) setInputValue('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmDialog.requiresInput && (
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">
                {confirmDialog.inputLabel || 'Motivo'}
              </label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ingrese el motivo..."
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDialog.action();
              }}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
