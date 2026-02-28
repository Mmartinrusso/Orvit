'use client';

/**
 * Payment Approval Page
 *
 * Critical workflow for payment approval:
 * 1. Payments come in (echeqs, transfers, checks)
 * 2. Admin reviews them here
 * 3. Admin approves/rejects
 * 4. Only approved payments hit cuenta corriente
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { usePermission } from '@/hooks/use-permissions';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Clock, CheckCircle2, XCircle, RefreshCw, User, Calendar, DollarSign, FileText, CreditCard, Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PendingPayment {
  id: number;
  numero: string;
  fechaPago: Date;
  totalPago: number;
  efectivo: number;
  transferencia: number;
  chequesTerceros: number;
  chequesPropios: number;
  tarjetaCredito: number;
  tarjetaDebito: number;
  otrosMedios: number;
  notas: string | null;
  client: {
    id: string;
    name: string | null;
    legalName: string;
  };
  allocations: Array<{
    id: number;
    montoAplicado: number;
    invoice: {
      id: number;
      numero: string;
    };
  }>;
  cheques: Array<{
    id: number;
    numero: string;
    banco: string;
    titular: string | null;
    importe: number;
    fechaVencimiento: Date | null;
    tipo: string;
  }>;
  createdAt: Date;
  createdByUser: {
    id: number;
    name: string | null;
  };
}

export default function AprobacionPagosPage() {
  const { mode: viewMode } = useViewMode();
  const { toast } = useToast();

  // Permission checks
  const { hasPermission: canApprovePayment } = usePermission('ventas.aprobaciones.approve');
  const { hasPermission: canRejectPayment } = usePermission('ventas.aprobaciones.reject');

  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [dialogAction, setDialogAction] = useState<'aprobar' | 'rechazar' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionMotivo, setActionMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/ventas/pagos?estado=PENDIENTE&viewMode=${viewMode}&limit=100`,
        { credentials: 'include' }
      );

      if (!response.ok) throw new Error('Error al cargar pagos pendientes');

      const data = await response.json();
      setPayments(data.data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los pagos pendientes',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, [viewMode]);

  const handleApprove = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setDialogAction('aprobar');
    setActionNotes('');
  };

  const handleReject = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setDialogAction('rechazar');
    setActionMotivo('');
  };

  const executeAction = async () => {
    if (!selectedPayment || !dialogAction) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/ventas/pagos/${selectedPayment.id}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accion: dialogAction,
          notas: actionNotes || undefined,
          motivo: actionMotivo || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar acción');
      }

      toast({
        title: dialogAction === 'aprobar' ? 'Pago aprobado' : 'Pago rechazado',
        description: result.message,
      });

      // Refresh list
      fetchPendingPayments();

      // Close dialog
      setDialogAction(null);
      setSelectedPayment(null);
      setActionNotes('');
      setActionMotivo('');
    } catch (error) {
      console.error('Error executing action:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al procesar acción',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getMediosDisplay = (payment: PendingPayment) => {
    const medios = [];
    if (payment.efectivo > 0) medios.push({ label: 'Efectivo', amount: payment.efectivo, icon: Banknote });
    if (payment.transferencia > 0) medios.push({ label: 'Transferencia', amount: payment.transferencia, icon: CreditCard });
    if (payment.chequesTerceros > 0) medios.push({ label: 'Cheques 3ros', amount: payment.chequesTerceros, icon: FileText });
    if (payment.chequesPropios > 0) medios.push({ label: 'Cheques Propios', amount: payment.chequesPropios, icon: FileText });
    if (payment.tarjetaCredito > 0) medios.push({ label: 'Tarjeta Crédito', amount: payment.tarjetaCredito, icon: CreditCard });
    if (payment.tarjetaDebito > 0) medios.push({ label: 'Tarjeta Débito', amount: payment.tarjetaDebito, icon: CreditCard });
    if (payment.otrosMedios > 0) medios.push({ label: 'Otros', amount: payment.otrosMedios, icon: DollarSign });
    return medios;
  };

  return (
    <PermissionGuard permission="ventas.aprobaciones.view">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Aprobación de Pagos</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Revisa y aprueba pagos recibidos antes de impactar en cuenta corriente
            </p>
          </div>
          <Button variant="outline" onClick={fetchPendingPayments} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning-muted-foreground" />
                Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments.length}</div>
              <p className="text-xs text-muted-foreground">Pagos esperando aprobación</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success" />
                Total Pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(payments.reduce((sum, p) => sum + Number(p.totalPago), 0))}
              </div>
              <p className="text-xs text-muted-foreground">Suma de pagos pendientes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-info-muted-foreground" />
                Con Cheques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {payments.filter(p => p.cheques && p.cheques.length > 0).length}
              </div>
              <p className="text-xs text-muted-foreground">Pagos con cheques incluidos</p>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pagos Pendientes de Aprobación</h2>

          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Cargando aprobaciones...</span>
                </div>
              </CardContent>
            </Card>
          ) : payments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay pagos pendientes de aprobación</p>
              </CardContent>
            </Card>
          ) : (
            payments.map((payment) => (
              <Card key={payment.id} className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{payment.numero}</CardTitle>
                        <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning-muted">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendiente
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        {payment.client.name || payment.client.legalName}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-success">
                        {formatCurrency(payment.totalPago)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(payment.fechaPago)}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Payment Methods */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Medios de Pago</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {getMediosDisplay(payment).map((medio, idx) => {
                        const Icon = medio.icon;
                        return (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="text-xs text-muted-foreground">{medio.label}</div>
                              <div className="text-sm font-medium">{formatCurrency(medio.amount)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cheques */}
                  {payment.cheques && payment.cheques.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Cheques Recibidos</Label>
                      <div className="space-y-2 mt-2">
                        {payment.cheques.map((cheque) => (
                          <div key={cheque.id} className="flex items-center justify-between p-2 bg-info-muted rounded-md border border-info-muted">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-info-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">
                                  {cheque.numero} - {cheque.banco}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {cheque.titular} · Vence: {cheque.fechaVencimiento ? formatDate(cheque.fechaVencimiento) : 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-medium">{formatCurrency(cheque.importe)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Allocations */}
                  {payment.allocations && payment.allocations.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Aplicado a Facturas</Label>
                      <div className="space-y-1 mt-2">
                        {payment.allocations.map((alloc) => (
                          <div key={alloc.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded-md">
                            <span>{alloc.invoice.numero}</span>
                            <span className="font-medium">{formatCurrency(alloc.montoAplicado)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {payment.notas && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notas</Label>
                      <p className="text-sm mt-1">{payment.notas}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Registrado por: {payment.createdByUser.name || 'Usuario'} ·{' '}
                      {formatDateTime(payment.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      {canRejectPayment && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(payment)}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Rechazar
                        </Button>
                      )}
                      {canApprovePayment && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(payment)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aprobar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Approval Dialog */}
        <AlertDialog open={dialogAction === 'aprobar'} onOpenChange={(open) => !open && setDialogAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aprobar Pago</AlertDialogTitle>
              <AlertDialogDescription>
                Al aprobar el pago <strong>{selectedPayment?.numero}</strong>, se:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Actualizará la cuenta corriente del cliente</li>
                  <li>Aplicará el pago a las facturas seleccionadas</li>
                  <li>Confirmará los movimientos de tesorería</li>
                </ul>
                Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notas de aprobación (opcional)</Label>
              <Textarea
                id="approval-notes"
                placeholder="Agregar comentario sobre la aprobación..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={executeAction} disabled={submitting}>
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Aprobando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aprobar Pago
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rejection Dialog */}
        <AlertDialog open={dialogAction === 'rechazar'} onOpenChange={(open) => !open && setDialogAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rechazar Pago</AlertDialogTitle>
              <AlertDialogDescription>
                Al rechazar el pago <strong>{selectedPayment?.numero}</strong>, se:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Marcará el pago como rechazado</li>
                  <li>Cancelará los movimientos de tesorería</li>
                  <li>NO afectará la cuenta corriente del cliente</li>
                  <li>Marcará los cheques como rechazados</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo del rechazo (requerido)</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Especificar por qué se rechaza el pago..."
                value={actionMotivo}
                onChange={(e) => setActionMotivo(e.target.value)}
                rows={3}
                required
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeAction}
                disabled={submitting || !actionMotivo.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Rechazar Pago
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
