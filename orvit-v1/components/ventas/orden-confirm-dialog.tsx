'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useApiClient } from '@/hooks/use-api-client';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface StockAlert {
  productId: string;
  codigo: string;
  descripcion: string;
  cantidadPedida: number;
  stockActual: number;
  faltante: number;
}

interface CreditAlert {
  limiteCredito: number;
  deudaActual: number;
  montoOrden: number;
  totalProyectado: number;
  excedente: number;
}

interface ConfirmationChecks {
  stockAlerts: StockAlert[];
  creditAlert: CreditAlert | null;
  hasStockIssues: boolean;
  hasCreditIssue: boolean;
}

interface OrdenConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordenId: number;
  orden: any;
  onConfirm: (options: { ignorarAlertasStock: boolean; ignorarLimiteCredito: boolean }) => Promise<void>;
}

export function OrdenConfirmDialog({
  open,
  onOpenChange,
  ordenId,
  orden,
  onConfirm,
}: OrdenConfirmDialogProps) {
  const { get, error: apiError, clearError } = useApiClient({ silent: true });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checks, setChecks] = useState<ConfirmationChecks>({
    stockAlerts: [],
    creditAlert: null,
    hasStockIssues: false,
    hasCreditIssue: false,
  });
  const [confirmStockIssues, setConfirmStockIssues] = useState(false);
  const [confirmCreditIssue, setConfirmCreditIssue] = useState(false);

  useEffect(() => {
    if (open) {
      checkPrerequisites();
    }
  }, [open, ordenId]);

  const checkPrerequisites = async () => {
    setChecking(true);
    clearError();
    const { data, error } = await get(`/api/ventas/ordenes/${ordenId}/validar-confirmacion`);
    if (data) setChecks(data);
    setChecking(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm({
        ignorarAlertasStock: confirmStockIssues,
        ignorarLimiteCredito: confirmCreditIssue,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const canConfirm =
    (!checks.hasStockIssues || confirmStockIssues) &&
    (!checks.hasCreditIssue || confirmCreditIssue);

  const formatCurrency = (amount: number) => {
    return `$${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar Orden de Venta</DialogTitle>
          <DialogDescription>
            Se está por confirmar la orden <strong>{orden.numero}</strong>. Por favor revise las validaciones.
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3">Validando orden...</span>
          </div>
        ) : apiError ? (
          <ErrorMessage error={apiError} onRetry={checkPrerequisites} className="my-4" />
        ) : (
          <div className="space-y-4">
            {/* Resumen de la orden */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Resumen de la Orden</AlertTitle>
              <AlertDescription>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-semibold">{orden.client?.legalName || orden.client?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Items:</span>
                    <p className="font-semibold">{orden.items?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Unidades:</span>
                    <p className="font-semibold">
                      {orden.items?.reduce((sum: number, item: any) => sum + Number(item.cantidad), 0) || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monto Total:</span>
                    <p className="font-semibold text-lg">{formatCurrency(orden.total)}</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Alertas de Stock */}
            {checks.hasStockIssues && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Stock Insuficiente Detectado</AlertTitle>
                <AlertDescription>
                  <p className="mb-3">
                    Los siguientes productos tienen stock insuficiente. Se crearán backorders automáticamente:
                  </p>
                  <div className="space-y-2">
                    {checks.stockAlerts.map((alert, idx) => (
                      <div key={idx} className="bg-red-50 p-3 rounded border border-red-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{alert.descripcion}</p>
                            <p className="text-xs text-muted-foreground">Código: {alert.codigo}</p>
                          </div>
                          <Badge variant="destructive">Faltante: {alert.faltante}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Pedido:</span>
                            <p className="font-semibold">{alert.cantidadPedida}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stock Actual:</span>
                            <p className="font-semibold">{alert.stockActual}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-red-600">Faltante:</span>
                            <p className="font-semibold text-red-600">{alert.faltante}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2 mt-4 p-3 bg-white rounded border">
                    <Checkbox
                      id="confirm-stock"
                      checked={confirmStockIssues}
                      onCheckedChange={(checked) => setConfirmStockIssues(checked as boolean)}
                    />
                    <label
                      htmlFor="confirm-stock"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Confirmar de todos modos (se crearán backorders automáticamente)
                    </label>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Alerta de Crédito */}
            {checks.hasCreditIssue && checks.creditAlert && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Límite de Crédito Excedido</AlertTitle>
                <AlertDescription>
                  <p className="mb-3">El cliente excederá su límite de crédito con esta orden:</p>
                  <div className="bg-red-50 p-4 rounded border border-red-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Límite de Crédito:</span>
                      <span className="font-semibold">{formatCurrency(checks.creditAlert.limiteCredito)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deuda Actual:</span>
                      <span className="font-semibold">{formatCurrency(checks.creditAlert.deudaActual)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Esta Orden:</span>
                      <span className="font-semibold">{formatCurrency(checks.creditAlert.montoOrden)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-red-600">
                      <span>Total Proyectado:</span>
                      <span>{formatCurrency(checks.creditAlert.totalProyectado)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-red-600">
                      <span>Excedente:</span>
                      <span>{formatCurrency(checks.creditAlert.excedente)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-4 p-3 bg-white rounded border">
                    <Checkbox
                      id="confirm-credit"
                      checked={confirmCreditIssue}
                      onCheckedChange={(checked) => setConfirmCreditIssue(checked as boolean)}
                    />
                    <label
                      htmlFor="confirm-credit"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Confirmar de todos modos (requiere aprobación gerencial posterior)
                    </label>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Todo OK */}
            {!checks.hasStockIssues && !checks.hasCreditIssue && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">Validaciones Correctas</AlertTitle>
                <AlertDescription className="text-green-800">
                  ✓ Stock disponible para todos los productos
                  <br />
                  ✓ Cliente dentro del límite de crédito
                  <br />
                  <br />
                  La orden puede confirmarse sin problemas.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || checking}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || loading || checking}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
