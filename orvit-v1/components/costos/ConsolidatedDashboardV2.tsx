'use client';

import { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  Factory,
  Wrench,
  Building2,
  BarChart3,
  Lock,
  Unlock,
  Info,
} from 'lucide-react';
import {
  useConsolidation,
  useRecalculateConsolidation,
  useClosePeriod,
} from '@/hooks/use-cost-consolidation';

interface ConsolidatedDashboardV2Props {
  selectedMonth: string;
  companyId: string;
  onMonthChange?: (month: string) => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const formatPercent = (value: number): string => {
  return formatNumber(value, 1) + '%';
};

// Colores para el gráfico de torta
const COST_COLORS: Record<string, string> = {
  payroll: '#3b82f6',      // blue
  purchases: '#22c55e',    // green
  indirect: '#f59e0b',     // amber
  production: '#8b5cf6',   // violet
  maintenance: '#ef4444',  // red
};

const COST_LABELS: Record<string, string> = {
  payroll: 'Nóminas',
  purchases: 'Compras',
  indirect: 'Indirectos',
  production: 'Producción',
  maintenance: 'Mantenimiento',
};

const COST_ICONS: Record<string, React.ReactNode> = {
  payroll: <Users className="h-4 w-4" />,
  purchases: <ShoppingCart className="h-4 w-4" />,
  indirect: <Building2 className="h-4 w-4" />,
  production: <Factory className="h-4 w-4" />,
  maintenance: <Wrench className="h-4 w-4" />,
};

export function ConsolidatedDashboardV2({
  selectedMonth,
  companyId,
  onMonthChange,
}: ConsolidatedDashboardV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  const { data, isLoading, isError, refetch } = useConsolidation(currentMonth);
  const recalculate = useRecalculateConsolidation();
  const closePeriod = useClosePeriod();

  const handleMonthChange = (month: string) => {
    setCurrentMonth(month);
    onMonthChange?.(month);
  };

  const handleRecalculate = async () => {
    await recalculate.mutateAsync({ month: currentMonth });
  };

  const handleToggleClosed = async () => {
    if (!data) return;
    await closePeriod.mutateAsync({
      month: currentMonth,
      action: data.isClosed ? 'reopen' : 'close',
    });
  };

  // Generar lista de meses
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    };
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Error al cargar datos. <Button variant="link" onClick={() => refetch()}>Reintentar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const consolidation = data;
  const hasData = consolidation?.exists;

  // Calcular totales y porcentajes para el gráfico
  const totalCosts = consolidation?.summary?.totalCost || 0;
  const costBreakdown = consolidation?.costs || {
    payroll: 0,
    purchases: 0,
    indirect: 0,
    production: 0,
    maintenance: 0,
  };

  // Calcular porcentajes
  const costPercentages = Object.entries(costBreakdown).map(([key, value]) => ({
    key,
    label: COST_LABELS[key],
    value: value as number,
    percent: totalCosts > 0 ? ((value as number) / totalCosts) * 100 : 0,
    color: COST_COLORS[key],
    icon: COST_ICONS[key],
  })).sort((a, b) => b.value - a.value);

  const netResult = consolidation?.summary?.netResult || 0;
  const isProfit = netResult >= 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header con selector de mes y acciones */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Select value={currentMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasData && (
              <>
                <Badge variant={consolidation?.isClosed ? 'default' : 'outline'}>
                  {consolidation?.isClosed ? (
                    <><Lock className="h-3 w-3 mr-1" /> Cerrado</>
                  ) : (
                    <><Unlock className="h-3 w-3 mr-1" /> Abierto</>
                  )}
                </Badge>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="font-mono text-xs">
                      V2
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Datos consolidados automáticamente desde todos los módulos
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculate.isPending || consolidation?.isClosed}
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', recalculate.isPending && 'animate-spin')} />
              Recalcular
            </Button>

            {hasData && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleClosed}
                disabled={closePeriod.isPending}
              >
                {consolidation?.isClosed ? (
                  <><Unlock className="h-4 w-4 mr-1" /> Reabrir</>
                ) : (
                  <><Lock className="h-4 w-4 mr-1" /> Cerrar</>
                )}
              </Button>
            )}
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin consolidación</h3>
                <p className="text-muted-foreground mb-4">
                  No hay datos consolidados para {currentMonth}
                </p>
                <Button onClick={handleRecalculate} disabled={recalculate.isPending}>
                  <RefreshCw className={cn('h-4 w-4 mr-2', recalculate.isPending && 'animate-spin')} />
                  Calcular ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Ingresos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                  <SourceBadge source="Ventas" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    ${formatCurrency(consolidation?.revenue?.sales || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    COGS: ${formatCurrency(consolidation?.revenue?.cogs || 0)}
                  </p>
                </CardContent>
              </Card>

              {/* Total Costos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Costos</CardTitle>
                  <SourceBadge source="Consolidado" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    ${formatCurrency(totalCosts)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    5 categorías
                  </p>
                </CardContent>
              </Card>

              {/* Margen Bruto */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Margen Bruto</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(consolidation?.revenue?.margin || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPercent(
                      consolidation?.revenue?.sales > 0
                        ? ((consolidation?.revenue?.margin || 0) / consolidation?.revenue?.sales) * 100
                        : 0
                    )} del ingreso
                  </p>
                </CardContent>
              </Card>

              {/* Resultado Neto */}
              <Card className={isProfit ? 'border-success-muted bg-success-muted' : 'border-destructive/30 bg-destructive/10'}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resultado Neto</CardTitle>
                  {isProfit ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={cn('text-2xl font-bold', isProfit ? 'text-success' : 'text-destructive')}>
                    ${formatCurrency(Math.abs(netResult))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isProfit ? 'Ganancia' : 'Pérdida'} del período
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Desglose de costos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribución de costos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribución de Costos</CardTitle>
                  <CardDescription>Desglose por categoría</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {costPercentages.map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="flex items-center gap-1">
                              {item.icon}
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">${formatCurrency(item.value)}</span>
                            <span className="text-muted-foreground w-12 text-right">
                              {formatPercent(item.percent)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${item.percent}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Detalle por categoría */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle por Módulo</CardTitle>
                  <CardDescription>Fuente de cada costo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <CostDetailRow
                      icon={<Users className="h-4 w-4" />}
                      label="Nóminas"
                      value={costBreakdown.payroll}
                      source="PayrollRun"
                      detail={consolidation?.details?.payroll}
                    />
                    <CostDetailRow
                      icon={<ShoppingCart className="h-4 w-4" />}
                      label="Compras"
                      value={costBreakdown.purchases}
                      source="GoodsReceipt"
                      detail={consolidation?.details?.purchases}
                    />
                    <CostDetailRow
                      icon={<Building2 className="h-4 w-4" />}
                      label="Indirectos"
                      value={costBreakdown.indirect}
                      source="MonthlyIndirect"
                      detail={consolidation?.details?.indirect}
                    />
                    <CostDetailRow
                      icon={<Factory className="h-4 w-4" />}
                      label="Producción"
                      value={costBreakdown.production}
                      source="MonthlyProduction"
                      detail={consolidation?.details?.production}
                    />
                    <CostDetailRow
                      icon={<Wrench className="h-4 w-4" />}
                      label="Mantenimiento"
                      value={costBreakdown.maintenance}
                      source="MaintenanceCostBreakdown"
                      detail={consolidation?.details?.maintenance}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Metadata */}
            {consolidation?.calculatedAt && (
              <p className="text-xs text-muted-foreground text-right">
                Última actualización: {new Date(consolidation.calculatedAt).toLocaleString('es-AR')}
              </p>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

// Componente para badge de fuente
function SourceBadge({ source }: { source: string }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className="text-xs font-normal">
          {source}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Datos desde {source}</TooltipContent>
    </Tooltip>
  );
}

// Componente para fila de detalle de costo
function CostDetailRow({
  icon,
  label,
  value,
  source,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  source: string;
  detail?: any;
}) {
  const getDetailText = () => {
    if (!detail) return null;

    if (label === 'Nóminas' && detail.payrollCount !== undefined) {
      return `${detail.payrollCount} nóminas, ${detail.employeeCount} empleados`;
    }
    if (label === 'Compras' && detail.receiptCount !== undefined) {
      return `${detail.receiptCount} recepciones, ${detail.itemCount} items`;
    }
    if (label === 'Indirectos' && detail.itemCount !== undefined) {
      return `${detail.itemCount} items, ${detail.categoryCount} categorías`;
    }
    if (label === 'Producción' && detail.productCount !== undefined) {
      return `${detail.productCount} productos, ${detail.unitsProduced?.toLocaleString()} uds`;
    }
    if (label === 'Mantenimiento' && detail.workOrderCount !== undefined) {
      return `${detail.workOrderCount} OTs`;
    }
    return null;
  };

  const detailText = getDetailText();

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <span className="text-sm font-medium">{label}</span>
          {detailText && (
            <p className="text-xs text-muted-foreground">{detailText}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium">${formatCurrency(value)}</div>
        <Badge variant="outline" className="text-[9px]">{source}</Badge>
      </div>
    </div>
  );
}

// Skeleton para loading
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-24 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
