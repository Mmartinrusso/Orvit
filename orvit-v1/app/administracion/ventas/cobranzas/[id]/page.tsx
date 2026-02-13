'use client';

/**
 * Payment Detail Page
 *
 * Shows comprehensive information about a client payment:
 * - Payment details and status
 * - Timeline of changes
 * - Applied invoices
 * - Cheques received
 * - Treasury movements
 * - Actions (void, download receipt)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Download,
  Ban,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Banknote,
  DollarSign,
  FileText,
  CreditCard,
  Building,
  Receipt,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Payment {
  id: number;
  numero: string;
  clientId: string;
  fechaPago: string;
  totalPago: number;
  efectivo: number;
  transferencia: number;
  chequesTerceros: number;
  chequesPropios: number;
  tarjetaCredito: number;
  tarjetaDebito: number;
  otrosMedios: number;
  retIVA?: number;
  retGanancias?: number;
  retIngBrutos?: number;
  bancoOrigen?: string;
  numeroOperacion?: string;
  notas?: string;
  estado: string;
  docType: 'T1' | 'T2';
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    legalName?: string;
    name?: string;
    businessName?: string;
  };
  allocations: Array<{
    id: number;
    invoiceId: number;
    montoAplicado: number;
    invoice: {
      id: number;
      numero: string;
      total: number;
      saldoPendiente: number;
    };
  }>;
  cheques: Array<{
    id: number;
    numero: string;
    banco: string;
    titular?: string;
    cuit?: string;
    fechaEmision?: string;
    fechaVencimiento?: string;
    importe: number;
    tipo: string;
    estado: string;
  }>;
  createdByUser?: {
    id: number;
    name: string;
  };
  cashMovements?: Array<{
    id: number;
    fecha: string;
    tipo: string;
    ingreso: number;
    egreso: number;
    descripcion?: string;
    comprobante?: string;
    cashAccount: {
      id: number;
      nombre: string;
    };
  }>;
  bankMovements?: Array<{
    id: number;
    fecha: string;
    tipo: string;
    ingreso: number;
    egreso: number;
    descripcion?: string;
    comprobante?: string;
    bankAccount: {
      id: number;
      nombre: string;
      banco: string;
    };
  }>;
}

interface AuditLog {
  id: number;
  timestamp: string;
  userId: number;
  userName: string;
  action: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  detalles?: string;
}

const ESTADOS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-blue-100 text-blue-700', icon: Clock },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-100 text-red-700', icon: XCircle },
  ANULADO: { label: 'Anulado', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function PaymentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  useEffect(() => {
    loadPayment();
    loadAuditLogs();
  }, [params.id]);

  const loadPayment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ventas/pagos/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setPayment(data);
      } else {
        toast.error('Error al cargar el pago');
        router.push('/administracion/ventas/cobranzas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar el pago');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await fetch(
        `/api/ventas/audit-log?entidad=client_payment&entidadId=${params.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.data || []);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error('Debe ingresar un motivo de anulación');
      return;
    }

    setVoiding(true);
    try {
      const response = await fetch(`/api/ventas/pagos/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'anular', motivo: voidReason }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Pago anulado exitosamente (Tesorería revertida)');
        loadPayment();
        loadAuditLogs();
        setVoidDialogOpen(false);
        setVoidReason('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al anular el pago');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al anular el pago');
    } finally {
      setVoiding(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      const response = await fetch(`/api/ventas/pagos/${params.id}/recibo`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Recibo-${payment?.numero || params.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Recibo descargado exitosamente');
      } else {
        toast.error('Error al descargar el recibo');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al descargar el recibo');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-gray-500">Pago no encontrado</div>
      </div>
    );
  }

  const statusConfig = ESTADOS_CONFIG[payment.estado] || ESTADOS_CONFIG.PENDIENTE;
  const StatusIcon = statusConfig.icon;
  const clientName = payment.client.legalName || payment.client.businessName || payment.client.name;
  const paymentMethods = [
    { label: 'Efectivo', value: payment.efectivo, icon: Banknote },
    { label: 'Transferencia', value: payment.transferencia, icon: DollarSign },
    { label: 'Cheques Terceros', value: payment.chequesTerceros, icon: FileText },
    { label: 'Cheques Propios', value: payment.chequesPropios, icon: FileText },
    { label: 'Tarjeta Crédito', value: payment.tarjetaCredito, icon: CreditCard },
    { label: 'Tarjeta Débito', value: payment.tarjetaDebito, icon: CreditCard },
    { label: 'Otros Medios', value: payment.otrosMedios, icon: DollarSign },
  ].filter((method) => method.value > 0);

  const retentions = [
    { label: 'Ret. IVA', value: payment.retIVA || 0 },
    { label: 'Ret. Ganancias', value: payment.retGanancias || 0 },
    { label: 'Ret. Ing. Brutos', value: payment.retIngBrutos || 0 },
  ].filter((ret) => ret.value > 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cobro {payment.numero}</h1>
            <p className="text-sm text-gray-500">Cliente: {clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReceipt}
            disabled={downloadingReceipt}
          >
            {downloadingReceipt ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Descargar Recibo
          </Button>
          {payment.estado === 'CONFIRMADO' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setVoidDialogOpen(true)}
            >
              <Ban className="w-4 h-4 mr-2" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <Label className="text-xs text-gray-500">Estado</Label>
              <div className="mt-1">
                <Badge className={statusConfig.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Fecha de Pago</Label>
              <div className="mt-1 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="font-medium">
                  {format(new Date(payment.fechaPago), 'dd/MM/yyyy HH:mm', { locale: es })}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Monto Total</Label>
              <div className="mt-1 text-2xl font-bold text-green-600">
                {formatCurrency(payment.totalPago)}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Tipo</Label>
              <div className="mt-1">
                <Badge variant="outline">{payment.docType}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Medios de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentMethods.map((method, index) => {
                  const Icon = method.icon;
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span>{method.label}</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(method.value)}</span>
                    </div>
                  );
                })}
              </div>

              {payment.bancoOrigen && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Banco Origen:</span>
                      <span>{payment.bancoOrigen}</span>
                    </div>
                    {payment.numeroOperacion && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Nro. Operación:</span>
                        <span>{payment.numeroOperacion}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {retentions.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Retenciones</Label>
                    {retentions.map((ret, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{ret.label}</span>
                        <span className="font-semibold text-orange-600">
                          {formatCurrency(ret.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Applied Invoices */}
          {payment.allocations && payment.allocations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Facturas Aplicadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payment.allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <div className="font-medium">{allocation.invoice.numero}</div>
                        <div className="text-sm text-gray-500">
                          Saldo actual: {formatCurrency(allocation.invoice.saldoPendiente)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {formatCurrency(allocation.montoAplicado)}
                        </div>
                        <div className="text-xs text-gray-500">Aplicado</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cheques */}
          {payment.cheques && payment.cheques.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cheques Recibidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payment.cheques.map((cheque) => (
                    <div key={cheque.id} className="p-3 border rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          Cheque N° {cheque.numero}
                        </div>
                        <Badge variant="outline">{cheque.tipo}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Banco:</span> {cheque.banco}
                        </div>
                        {cheque.titular && (
                          <div>
                            <span className="text-gray-500">Titular:</span> {cheque.titular}
                          </div>
                        )}
                        {cheque.cuit && (
                          <div>
                            <span className="text-gray-500">CUIT:</span> {cheque.cuit}
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Importe:</span>{' '}
                          <span className="font-semibold">
                            {formatCurrency(cheque.importe)}
                          </span>
                        </div>
                      </div>
                      {cheque.fechaVencimiento && (
                        <div className="text-xs text-gray-500">
                          Vencimiento:{' '}
                          {format(new Date(cheque.fechaVencimiento), 'dd/MM/yyyy', {
                            locale: es,
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Treasury Movements */}
          {((payment.cashMovements && payment.cashMovements.length > 0) ||
            (payment.bankMovements && payment.bankMovements.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Movimientos de Tesorería
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Cash Movements */}
                  {payment.cashMovements?.map((movement) => (
                    <div
                      key={`cash-${movement.id}`}
                      className="p-3 border rounded-md space-y-2 bg-green-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-green-600" />
                          <div>
                            <div className="font-medium text-sm">
                              {movement.cashAccount.nombre}
                            </div>
                            <div className="text-xs text-gray-500">Caja</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-700">
                          {movement.tipo}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Fecha:</span>{' '}
                          {format(new Date(movement.fecha), 'dd/MM/yyyy', { locale: es })}
                        </div>
                        {movement.comprobante && (
                          <div>
                            <span className="text-gray-500">Comprobante:</span>{' '}
                            {movement.comprobante}
                          </div>
                        )}
                        {movement.ingreso > 0 && (
                          <div>
                            <span className="text-gray-500">Ingreso:</span>{' '}
                            <span className="font-semibold text-green-600">
                              {formatCurrency(movement.ingreso)}
                            </span>
                          </div>
                        )}
                        {movement.egreso > 0 && (
                          <div>
                            <span className="text-gray-500">Egreso:</span>{' '}
                            <span className="font-semibold text-red-600">
                              {formatCurrency(movement.egreso)}
                            </span>
                          </div>
                        )}
                      </div>
                      {movement.descripcion && (
                        <div className="text-xs text-gray-600 italic">
                          {movement.descripcion}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Bank Movements */}
                  {payment.bankMovements?.map((movement) => (
                    <div
                      key={`bank-${movement.id}`}
                      className="p-3 border rounded-md space-y-2 bg-blue-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="font-medium text-sm">
                              {movement.bankAccount.nombre}
                            </div>
                            <div className="text-xs text-gray-500">
                              {movement.bankAccount.banco}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700">
                          {movement.tipo}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Fecha:</span>{' '}
                          {format(new Date(movement.fecha), 'dd/MM/yyyy', { locale: es })}
                        </div>
                        {movement.comprobante && (
                          <div>
                            <span className="text-gray-500">Comprobante:</span>{' '}
                            {movement.comprobante}
                          </div>
                        )}
                        {movement.ingreso > 0 && (
                          <div>
                            <span className="text-gray-500">Ingreso:</span>{' '}
                            <span className="font-semibold text-green-600">
                              {formatCurrency(movement.ingreso)}
                            </span>
                          </div>
                        )}
                        {movement.egreso > 0 && (
                          <div>
                            <span className="text-gray-500">Egreso:</span>{' '}
                            <span className="font-semibold text-red-600">
                              {formatCurrency(movement.egreso)}
                            </span>
                          </div>
                        )}
                      </div>
                      {movement.descripcion && (
                        <div className="text-xs text-gray-600 italic">
                          {movement.descripcion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {payment.notas && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{payment.notas}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Línea de Tiempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Creation */}
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-blue-100 p-2">
                      <Receipt className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="w-px h-full bg-gray-200 mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="text-sm font-medium">Cobro Registrado</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>
                    {payment.createdByUser && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <User className="w-3 h-3" />
                        {payment.createdByUser.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit logs */}
                {auditLogs.map((log, index) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="rounded-full bg-gray-100 p-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                      </div>
                      {index < auditLogs.length - 1 && (
                        <div className="w-px h-full bg-gray-200 mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="text-sm font-medium">{log.action}</div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </div>
                      {log.userName && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" />
                          {log.userName}
                        </div>
                      )}
                      {log.detalles && (
                        <div className="text-xs text-gray-600 mt-1">{log.detalles}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-500">Razón Social</Label>
                  <div className="font-medium">{clientName}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/administracion/ventas/clientes/${payment.clientId}`)}
                >
                  <Building className="w-4 h-4 mr-2" />
                  Ver Ficha
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Treasury Movements */}
          {payment.treasuryMovementIds && payment.treasuryMovementIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Movimientos de Tesorería</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  {payment.treasuryMovementIds.length} movimiento(s) de tesorería creado(s)
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Void Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Cobro</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción revertirá el cobro y restaurará los saldos de las facturas
              aplicadas. Los movimientos de tesorería serán revertidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="voidReason">Motivo de Anulación *</Label>
            <Textarea
              id="voidReason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Ingrese el motivo de la anulación..."
              rows={3}
              disabled={voiding}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={voiding || !voidReason.trim()}>
              {voiding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
