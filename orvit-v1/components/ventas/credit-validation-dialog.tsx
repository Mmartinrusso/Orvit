'use client';

import { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  XCircle,
  CheckCircle,
  CreditCard,
  Clock,
  Ban,
  Receipt
} from 'lucide-react';

interface CreditStatus {
  limit: number;
  usedFromLedger: number;
  cachedDebt: number;
  available: number;
  utilizationPercent: number;
  needsReconciliation: boolean;
  differenceAmount: number;
}

interface OverdueInvoice {
  id: number;
  numero: string;
  amount: number;
  daysOverdue: number;
  fechaVencimiento: string;
  saldoPendiente: number;
}

interface OverdueStatus {
  hasOverdue: boolean;
  overdueAmount: number;
  oldestOverdueDays: number;
  overdueInvoices: OverdueInvoice[];
  aging: Array<{
    label: string;
    amount: number;
    count: number;
  }>;
}

interface CheckStatus {
  totalInCartera: number;
  cantidadCheques: number;
  excedeLimite: boolean;
  limiteCheques: number | null;
  proximoVencimiento: string | null;
  chequesPorVencer30Dias: number;
}

interface BlockStatus {
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  tipoBloqueo: string | null;
}

interface ClientInfo {
  id: string;
  name: string;
  cuit: string | null;
  paymentTerms: number;
}

export interface CreditValidationResult {
  canProceed: boolean;
  requiresOverride: boolean;
  warnings: string[];
  errors: string[];
  creditStatus: CreditStatus;
  overdueStatus: OverdueStatus;
  checkStatus: CheckStatus;
  blockStatus: BlockStatus;
  clientInfo: ClientInfo;
}

interface CreditValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: CreditValidationResult | null;
  onProceed: () => void;
  onCancel: () => void;
  orderAmount?: number;
  hasOverridePermission?: boolean;
}

export function CreditValidationDialog({
  open,
  onOpenChange,
  validationResult,
  onProceed,
  onCancel,
  orderAmount = 0,
  hasOverridePermission = false,
}: CreditValidationDialogProps) {
  if (!validationResult) return null;

  const {
    canProceed,
    requiresOverride,
    warnings,
    errors,
    creditStatus,
    overdueStatus,
    checkStatus,
    blockStatus,
    clientInfo,
  } = validationResult;

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  // formatDate is now imported from @/lib/date-utils

  const canOverride = !canProceed && hasOverridePermission;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {canProceed ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            Validacion de Credito
          </DialogTitle>
          <DialogDescription>
            Cliente: {clientInfo.name}
            {clientInfo.cuit && ` (CUIT: ${clientInfo.cuit})`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>No se puede continuar</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert variant="default" className="border-warning-muted bg-warning-muted">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
              <AlertTitle className="text-warning-muted-foreground">Advertencias</AlertTitle>
              <AlertDescription className="text-warning-muted-foreground">
                <ul className="list-disc list-inside mt-2">
                  {warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Block Status */}
          {blockStatus.isBlocked && (
            <Card className="border-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <Ban className="w-4 h-4" />
                  Cliente Bloqueado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <strong>Motivo:</strong> {blockStatus.blockedReason || 'Sin especificar'}
                </p>
                {blockStatus.tipoBloqueo && (
                  <p className="text-sm">
                    <strong>Tipo:</strong> {blockStatus.tipoBloqueo}
                  </p>
                )}
                {blockStatus.blockedAt && (
                  <p className="text-sm text-muted-foreground">
                    Bloqueado el {formatDate(blockStatus.blockedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Credit Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Estado del Credito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Limite</p>
                  <p className="font-semibold">{formatCurrency(creditStatus.limit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilizado</p>
                  <p className="font-semibold">{formatCurrency(creditStatus.usedFromLedger)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className={cn('font-semibold', creditStatus.available < orderAmount ? 'text-destructive' : 'text-success')}>
                    {formatCurrency(creditStatus.available)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilizacion</p>
                  <p className={cn('font-semibold', creditStatus.utilizationPercent >= 80 && 'text-warning-muted-foreground', creditStatus.utilizationPercent >= 100 && 'text-destructive')}>
                    {formatNumber(creditStatus.utilizationPercent, 1)}%
                  </p>
                </div>
              </div>
              {orderAmount > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm">
                    <strong>Monto de la orden:</strong> {formatCurrency(orderAmount)}
                  </p>
                  {creditStatus.available < orderAmount && (
                    <p className="text-sm text-destructive">
                      <strong>Excede en:</strong> {formatCurrency(orderAmount - creditStatus.available)}
                    </p>
                  )}
                </div>
              )}
              {creditStatus.needsReconciliation && (
                <div className="mt-3 pt-3 border-t">
                  <Badge variant="outline" className="text-warning-muted-foreground border-warning-muted">
                    Requiere reconciliacion
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Diferencia detectada: {formatCurrency(creditStatus.differenceAmount)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overdue Invoices */}
          {overdueStatus.hasOverdue && (
            <Card className="border-warning-muted">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-warning-muted-foreground">
                  <Clock className="w-4 h-4" />
                  Facturas Vencidas ({overdueStatus.overdueInvoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <p className="text-sm">
                    <strong>Total vencido:</strong>{' '}
                    <span className="text-destructive">{formatCurrency(overdueStatus.overdueAmount)}</span>
                  </p>
                  <p className="text-sm">
                    <strong>Mas antigua:</strong> {overdueStatus.oldestOverdueDays} dias de mora
                  </p>
                </div>

                {overdueStatus.overdueInvoices.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Factura</TableHead>
                        <TableHead className="text-xs">Vencimiento</TableHead>
                        <TableHead className="text-xs">Dias</TableHead>
                        <TableHead className="text-xs text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueStatus.overdueInvoices.slice(0, 5).map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-mono">{inv.numero}</TableCell>
                          <TableCell className="text-xs">{formatDate(inv.fechaVencimiento)}</TableCell>
                          <TableCell className="text-xs">{inv.daysOverdue}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(inv.saldoPendiente)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {overdueStatus.overdueInvoices.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ... y {overdueStatus.overdueInvoices.length - 5} mas
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Aging */}
          {overdueStatus.aging && overdueStatus.aging.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Antiguedad de Saldos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {overdueStatus.aging.map((bucket, i) => (
                    <div key={i} className="text-center p-2 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">{bucket.label}</p>
                      <p className="font-semibold text-sm">{formatCurrency(bucket.amount)}</p>
                      <p className="text-xs text-muted-foreground">({bucket.count})</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Check Portfolio */}
          {checkStatus.cantidadCheques > 0 && (
            <Card className={checkStatus.excedeLimite ? 'border-warning-muted' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cartera de Cheques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">En cartera</p>
                    <p className="font-semibold">{formatCurrency(checkStatus.totalInCartera)}</p>
                    <p className="text-xs text-muted-foreground">{checkStatus.cantidadCheques} cheques</p>
                  </div>
                  {checkStatus.limiteCheques && (
                    <div>
                      <p className="text-xs text-muted-foreground">Limite</p>
                      <p className={cn('font-semibold', checkStatus.excedeLimite && 'text-warning-muted-foreground')}>
                        {formatCurrency(checkStatus.limiteCheques)}
                      </p>
                    </div>
                  )}
                </div>
                {checkStatus.proximoVencimiento && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Proximo vencimiento: {formatDate(checkStatus.proximoVencimiento)}
                    {checkStatus.chequesPorVencer30Dias > 0 &&
                      ` (${checkStatus.chequesPorVencer30Dias} en proximos 30 dias)`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          {canProceed && (
            <Button onClick={onProceed}>Continuar</Button>
          )}
          {canOverride && (
            <Button variant="destructive" onClick={onProceed}>
              Continuar con Excepcion
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
