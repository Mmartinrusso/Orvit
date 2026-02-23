'use client';

import { cn, formatNumber } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MarginIndicatorProps {
  costPrice: number;
  salePrice: number;
  marginMin?: number;
  marginMax?: number;
  costCurrency?: string;
  saleCurrency?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MarginIndicator({
  costPrice: rawCostPrice,
  salePrice: rawSalePrice,
  marginMin,
  marginMax,
  costCurrency = 'ARS',
  saleCurrency = 'ARS',
  showPercentage = true,
  size = 'md',
  className,
}: MarginIndicatorProps) {
  // Convertir a numeros para evitar errores
  const costPrice = typeof rawCostPrice === 'number' ? rawCostPrice : parseFloat(String(rawCostPrice)) || 0;
  const salePrice = typeof rawSalePrice === 'number' ? rawSalePrice : parseFloat(String(rawSalePrice)) || 0;

  // Calcular margen solo si las monedas coinciden o si hay precio de venta
  if (!salePrice || salePrice <= 0 || costPrice <= 0) {
    return (
      <div className={cn('text-muted-foreground', className)}>
        <span className="text-sm">Sin precio de venta</span>
      </div>
    );
  }

  // Calcular margen
  const margin = ((salePrice - costPrice) / costPrice) * 100;
  const marginAmount = salePrice - costPrice;

  // Determinar estado del margen
  let status: 'danger' | 'warning' | 'success' | 'high' = 'success';
  let statusMessage = 'Margen correcto';

  if (marginMin !== undefined && margin < marginMin) {
    status = 'danger';
    statusMessage = `Margen por debajo del mínimo (${marginMin}%)`;
  } else if (marginMax !== undefined && margin > marginMax) {
    status = 'high';
    statusMessage = `Margen por encima del máximo (${marginMax}%)`;
  } else if (marginMin !== undefined && margin < marginMin * 1.2) {
    status = 'warning';
    statusMessage = 'Margen cercano al mínimo';
  }

  const statusColors = {
    danger: 'text-destructive bg-destructive/10 border-destructive/30',
    warning: 'text-warning-muted-foreground bg-warning-muted border-warning-muted',
    success: 'text-success bg-success-muted border-success-muted',
    high: 'text-info-muted-foreground bg-info-muted border-info-muted',
  };

  const statusIcons = {
    danger: TrendingDown,
    warning: AlertTriangle,
    success: CheckCircle2,
    high: TrendingUp,
  };

  const StatusIcon = statusIcons[status];

  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-2',
    lg: 'text-lg px-4 py-3',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const currencyWarning = costCurrency !== saleCurrency;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border',
              statusColors[status],
              sizeClasses[size],
              className
            )}
          >
            <StatusIcon className={iconSizes[size]} />
            <div className="flex flex-col">
              {showPercentage && (
                <span className="font-bold">
                  {margin >= 0 ? '+' : ''}{formatNumber(margin, 1)}%
                </span>
              )}
              {currencyWarning && (
                <span className="text-xs text-muted-foreground">
                  (Monedas diferentes)
                </span>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{statusMessage}</p>
            <div className="text-sm space-y-1">
              <p>Costo: {costCurrency} {formatNumber(costPrice, 2)}</p>
              <p>Venta: {saleCurrency} {formatNumber(salePrice, 2)}</p>
              <p>Ganancia: {saleCurrency} {formatNumber(marginAmount, 2)}</p>
              <p>Margen: {formatNumber(margin, 2)}%</p>
              {marginMin !== undefined && (
                <p className="text-muted-foreground">Mínimo: {marginMin}%</p>
              )}
              {marginMax !== undefined && (
                <p className="text-muted-foreground">Máximo: {marginMax}%</p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente simplificado para mostrar solo el valor del margen
export function MarginValue({
  costPrice: rawCostPrice,
  salePrice: rawSalePrice,
  className,
}: {
  costPrice: number;
  salePrice: number;
  className?: string;
}) {
  const costPrice = typeof rawCostPrice === 'number' ? rawCostPrice : parseFloat(String(rawCostPrice)) || 0;
  const salePrice = typeof rawSalePrice === 'number' ? rawSalePrice : parseFloat(String(rawSalePrice)) || 0;

  if (!salePrice || salePrice <= 0 || costPrice <= 0) {
    return <span className={cn('text-muted-foreground', className)}>-</span>;
  }

  const margin = ((salePrice - costPrice) / costPrice) * 100;

  return (
    <span
      className={cn(
        'font-mono',
        margin < 0 ? 'text-destructive' : margin > 30 ? 'text-success' : 'text-foreground',
        className
      )}
    >
      {margin >= 0 ? '+' : ''}{formatNumber(margin, 1)}%
    </span>
  );
}

// Barra visual de margen
export function MarginBar({
  current: rawCurrent,
  min: rawMin,
  max: rawMax,
  className,
}: {
  current: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  // Convertir a numeros
  const current = typeof rawCurrent === 'number' ? rawCurrent : parseFloat(String(rawCurrent)) || 0;
  const min = rawMin !== undefined ? (typeof rawMin === 'number' ? rawMin : parseFloat(String(rawMin)) || undefined) : undefined;
  const max = rawMax !== undefined ? (typeof rawMax === 'number' ? rawMax : parseFloat(String(rawMax)) || undefined) : undefined;

  // Escala: 0% a 100% (o max + 20% si max > 100)
  const scaleMax = Math.max(100, (max || 50) + 20);
  const currentPos = Math.min(Math.max(0, (current / scaleMax) * 100), 100);
  const minPos = min !== undefined ? (min / scaleMax) * 100 : undefined;
  const maxPos = max !== undefined ? (max / scaleMax) * 100 : undefined;

  // Determinar color
  let barColor = 'bg-success';
  if (min !== undefined && current < min) {
    barColor = 'bg-destructive';
  } else if (max !== undefined && current > max) {
    barColor = 'bg-info';
  } else if (min !== undefined && current < min * 1.2) {
    barColor = 'bg-warning-muted-foreground';
  }

  return (
    <div className={cn('relative w-full h-4 bg-muted rounded-full overflow-hidden', className)}>
      {/* Zona mínima */}
      {minPos !== undefined && (
        <div
          className="absolute top-0 h-full bg-destructive/20 opacity-50"
          style={{ width: `${minPos}%` }}
        />
      )}

      {/* Zona máxima */}
      {maxPos !== undefined && (
        <div
          className="absolute top-0 h-full bg-info-muted opacity-50"
          style={{ left: `${maxPos}%`, right: 0 }}
        />
      )}

      {/* Marcador mínimo */}
      {minPos !== undefined && (
        <div
          className="absolute top-0 w-0.5 h-full bg-destructive"
          style={{ left: `${minPos}%` }}
        />
      )}

      {/* Marcador máximo */}
      {maxPos !== undefined && (
        <div
          className="absolute top-0 w-0.5 h-full bg-info"
          style={{ left: `${maxPos}%` }}
        />
      )}

      {/* Barra actual */}
      <div
        className={cn('absolute top-0 h-full transition-all duration-300', barColor)}
        style={{ width: `${currentPos}%` }}
      />

      {/* Valor actual */}
      <div
        className="absolute top-0 flex items-center justify-center h-full"
        style={{ left: `${Math.min(currentPos, 85)}%` }}
      >
        <span className="text-xs font-bold text-white drop-shadow-sm">
          {formatNumber(current, 0)}%
        </span>
      </div>
    </div>
  );
}
