'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Ban,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useCreditValidation, CreditValidationResult } from '@/hooks/use-credit-validation';
import { cn } from '@/lib/utils';

interface ClientCreditCardProps {
  clientId: string;
  orderAmount?: number;
  showDetails?: boolean;
  onValidationComplete?: (result: CreditValidationResult) => void;
  className?: string;
}

export function ClientCreditCard({
  clientId,
  orderAmount = 0,
  showDetails = true,
  onValidationComplete,
  className
}: ClientCreditCardProps) {
  const { isValidating, validationResult, validateCredit } = useCreditValidation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadCreditStatus();
    }
  }, [clientId, orderAmount]);

  const loadCreditStatus = async () => {
    const result = await validateCredit(clientId, orderAmount);
    if (result && onValidationComplete) {
      onValidationComplete(result);
    }
  };

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  if (isValidating && !validationResult) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Estado de Credito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!validationResult) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Estado de Credito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">No se pudo cargar el estado de credito</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadCreditStatus}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { creditStatus, overdueStatus, blockStatus, canProceed, warnings, errors } = validationResult;

  const getStatusColor = () => {
    if (blockStatus.isBlocked) return 'border-red-500 bg-red-50 dark:bg-red-900/10';
    if (errors.length > 0) return 'border-red-500 bg-red-50 dark:bg-red-900/10';
    if (warnings.length > 0) return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
    return '';
  };

  const getStatusBadge = () => {
    if (blockStatus.isBlocked) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <Ban className="w-3 h-3" />
          Bloqueado
        </Badge>
      );
    }
    if (errors.length > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Sin Credito
        </Badge>
      );
    }
    if (warnings.length > 0) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 text-yellow-700 bg-yellow-100">
          <AlertTriangle className="w-3 h-3" />
          Alerta
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-green-600">
        <CheckCircle className="w-3 h-3" />
        OK
      </Badge>
    );
  };

  const utilizationPercent = Math.min(creditStatus.utilizationPercent, 100);
  const utilizationColor = utilizationPercent >= 100 ? 'bg-red-500' : utilizationPercent >= 80 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <Card className={cn(getStatusColor(), className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Estado de Credito
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={loadCreditStatus}
              disabled={isValidating}
            >
              <RefreshCcw className={cn("w-3 h-3", isValidating && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Stats */}
        <div className="grid grid-cols-3 gap-4">
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
            <p className={cn(
              "font-semibold",
              creditStatus.available < orderAmount ? "text-red-600" : "text-green-600"
            )}>
              {formatCurrency(creditStatus.available)}
            </p>
          </div>
        </div>

        {/* Utilization Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Utilizacion</span>
            <span className={cn(
              utilizationPercent >= 100 ? "text-red-600" : utilizationPercent >= 80 ? "text-yellow-600" : ""
            )}>
              {creditStatus.utilizationPercent.toFixed(1)}%
            </span>
          </div>
          <Progress value={utilizationPercent} className="h-2" />
        </div>

        {/* Warnings/Errors Summary */}
        {(warnings.length > 0 || errors.length > 0) && (
          <div className="space-y-1">
            {errors.map((error, i) => (
              <div key={`error-${i}`} className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                {error}
              </div>
            ))}
            {warnings.map((warning, i) => (
              <div key={`warning-${i}`} className="flex items-center gap-1 text-xs text-yellow-600">
                <AlertTriangle className="w-3 h-3" />
                {warning}
              </div>
            ))}
          </div>
        )}

        {/* Overdue Summary */}
        {overdueStatus.hasOverdue && (
          <div className="flex items-center gap-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-300">
              {overdueStatus.overdueInvoices.length} factura(s) vencida(s): {formatCurrency(overdueStatus.overdueAmount)}
            </span>
          </div>
        )}

        {/* Expandable Details */}
        {showDetails && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Ocultar detalles
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Ver detalles
                </>
              )}
            </Button>

            {expanded && (
              <div className="space-y-3 pt-2 border-t">
                {/* Aging */}
                {overdueStatus.aging && overdueStatus.aging.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2">Antiguedad de Saldos</p>
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {overdueStatus.aging.map((bucket, i) => (
                        <div key={i} className="p-1 bg-muted rounded text-xs">
                          <p className="text-muted-foreground truncate">{bucket.label}</p>
                          <p className="font-semibold">{formatCurrency(bucket.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reconciliation Warning */}
                {creditStatus.needsReconciliation && (
                  <div className="p-2 bg-muted rounded text-xs">
                    <p className="font-medium text-yellow-600">Requiere reconciliacion</p>
                    <p className="text-muted-foreground">
                      Diferencia: {formatCurrency(creditStatus.differenceAmount)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
