'use client';

import { cn } from '@/lib/utils';
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
    danger: 'text-red-600 bg-red-50 border-red-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    success: 'text-green-600 bg-green-50 border-green-200',
    high: 'text-blue-600 bg-blue-50 border-blue-200',
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
                  {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
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
              <p>Costo: {costCurrency} {costPrice.toFixed(2)}</p>
              <p>Venta: {saleCurrency} {salePrice.toFixed(2)}</p>
              <p>Ganancia: {saleCurrency} {marginAmount.toFixed(2)}</p>
              <p>Margen: {margin.toFixed(2)}%</p>
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
        margin < 0 ? 'text-red-600' : margin > 30 ? 'text-green-600' : 'text-foreground',
        className
      )}
    >
      {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
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
  let barColor = 'bg-green-500';
  if (min !== undefined && current < min) {
    barColor = 'bg-red-500';
  } else if (max !== undefined && current > max) {
    barColor = 'bg-blue-500';
  } else if (min !== undefined && current < min * 1.2) {
    barColor = 'bg-amber-500';
  }

  return (
    <div className={cn('relative w-full h-4 bg-muted rounded-full overflow-hidden', className)}>
      {/* Zona mínima */}
      {minPos !== undefined && (
        <div
          className="absolute top-0 h-full bg-red-200 opacity-50"
          style={{ width: `${minPos}%` }}
        />
      )}

      {/* Zona máxima */}
      {maxPos !== undefined && (
        <div
          className="absolute top-0 h-full bg-blue-200 opacity-50"
          style={{ left: `${maxPos}%`, right: 0 }}
        />
      )}

      {/* Marcador mínimo */}
      {minPos !== undefined && (
        <div
          className="absolute top-0 w-0.5 h-full bg-red-600"
          style={{ left: `${minPos}%` }}
        />
      )}

      {/* Marcador máximo */}
      {maxPos !== undefined && (
        <div
          className="absolute top-0 w-0.5 h-full bg-blue-600"
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
          {current.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
