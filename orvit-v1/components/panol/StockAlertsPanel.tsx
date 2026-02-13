'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  Package,
  RefreshCw,
  ExternalLink,
  TrendingDown,
  Bell,
  BellOff,
  AlertOctagon,
  Wrench,
  Box,
  Cog,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';

interface ToolWithLowStock {
  id: number;
  name: string;
  code: string | null;
  stockQuantity: number;
  minStockLevel: number;
  reorderPoint: number | null;
  itemType: 'TOOL' | 'SUPPLY' | 'SPARE_PART' | 'HAND_TOOL';
  isCritical: boolean;
  category: { name: string } | null;
  location: { name: string } | null;
  deficit: number;
  percentageOfMin: number;
}

interface StockAlertsPanelProps {
  className?: string;
  onItemClick?: (itemId: number) => void;
  compact?: boolean;
  maxItems?: number;
  userColors?: {
    chart1: string;
    chart4: string;
    kpiNegative: string;
    kpiPositive: string;
  };
}

const defaultColors = {
  chart1: '#6366f1',
  chart4: '#f59e0b',
  kpiNegative: '#ef4444',
  kpiPositive: '#10b981',
};

export function StockAlertsPanel({
  className,
  onItemClick,
  compact = false,
  maxItems = 20,
  userColors = defaultColors,
}: StockAlertsPanelProps) {
  const { currentCompany } = useCompany();
  const [items, setItems] = useState<ToolWithLowStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLowStockItems = useCallback(async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}`);
      if (!response.ok) throw new Error('Error cargando items');
      const allItems = await response.json();

      // Filtrar items con stock bajo
      const lowStock: ToolWithLowStock[] = allItems
        .filter((item: any) => {
          const current = item.stockQuantity || 0;
          const min = item.minStockLevel || 0;
          return min > 0 && current <= min;
        })
        .map((item: any) => {
          const current = item.stockQuantity || 0;
          const min = item.minStockLevel || 0;
          return {
            id: item.id,
            name: item.name,
            code: item.code,
            stockQuantity: current,
            minStockLevel: min,
            reorderPoint: item.reorderPoint,
            itemType: item.itemType || 'TOOL',
            isCritical: item.isCritical || false,
            category: item.category,
            location: item.location,
            deficit: min - current,
            percentageOfMin: min > 0 ? (current / min) * 100 : 0,
          };
        })
        // Ordenar: primero críticos, luego sin stock, luego por porcentaje
        .sort((a: ToolWithLowStock, b: ToolWithLowStock) => {
          if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
          if ((a.stockQuantity === 0) !== (b.stockQuantity === 0)) {
            return a.stockQuantity === 0 ? -1 : 1;
          }
          return a.percentageOfMin - b.percentageOfMin;
        });

      setItems(lowStock);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadLowStockItems();
  }, [loadLowStockItems]);

  const getAlertLevel = (item: ToolWithLowStock) => {
    if (item.stockQuantity === 0) return 'critical';
    if (item.isCritical) return 'urgent';
    if (item.percentageOfMin <= 25) return 'danger';
    if (item.percentageOfMin <= 50) return 'warning';
    return 'low';
  };

  const getAlertStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-200',
          badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
      case 'urgent':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/30',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-800 dark:text-orange-200',
          badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        };
      case 'danger':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-800 dark:text-amber-200',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-950/30',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/30',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        };
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'TOOL':
        return <Wrench className="h-4 w-4" />;
      case 'SUPPLY':
        return <Box className="h-4 w-4" />;
      case 'SPARE_PART':
        return <Cog className="h-4 w-4" />;
      case 'HAND_TOOL':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'TOOL':
        return 'Herramienta';
      case 'SUPPLY':
        return 'Insumo';
      case 'SPARE_PART':
        return 'Repuesto';
      case 'HAND_TOOL':
        return 'Herr. Manual';
      default:
        return type;
    }
  };

  // Estadísticas rápidas
  const stats = {
    total: items.length,
    critical: items.filter((i) => i.stockQuantity === 0).length,
    criticalItems: items.filter((i) => i.isCritical && i.stockQuantity > 0).length,
    low: items.filter((i) => i.stockQuantity > 0 && !i.isCritical).length,
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Card className={cn('', className)}>
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: userColors.chart4 }} />
                Alertas de Stock
              </CardTitle>
              <div className="flex items-center gap-1">
                {stats.critical > 0 && (
                  <Badge
                    variant="destructive"
                    className="text-xs px-1.5"
                  >
                    {stats.critical}
                  </Badge>
                )}
                {stats.total > 0 && stats.total !== stats.critical && (
                  <Badge variant="secondary" className="text-xs px-1.5">
                    {stats.total}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                >
                  <BellOff className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                </div>
                <p>Todo el stock en orden</p>
              </div>
            ) : (
              <ScrollArea className="h-[180px]">
                <div className="space-y-1.5">
                  {items.slice(0, 10).map((item) => {
                    const level = getAlertLevel(item);
                    const styles = getAlertStyles(level);
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onItemClick?.(item.id)}
                            className={cn(
                              'w-full p-2 rounded text-left text-xs transition-colors border',
                              styles.bg,
                              styles.border,
                              styles.text,
                              'hover:opacity-80'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {item.isCritical && (
                                  <AlertOctagon className="h-3 w-3 flex-shrink-0 text-red-500" />
                                )}
                                <span className="font-medium truncate">{item.name}</span>
                              </div>
                              <span className="text-xs whitespace-nowrap font-mono">
                                {item.stockQuantity}/{item.minStockLevel}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <div className="text-xs">
                            <p className="font-medium">{item.name}</p>
                            {item.code && <p className="text-muted-foreground">{item.code}</p>}
                            <p className="mt-1">
                              Stock: {item.stockQuantity} / Mín: {item.minStockLevel}
                            </p>
                            <p>Faltan: {item.deficit} unidades</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {items.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground pt-1">
                      +{items.length - 10} más...
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  }

  // Vista completa
  return (
    <TooltipProvider>
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${userColors.chart4}15` }}
              >
                <AlertTriangle className="h-4 w-4" style={{ color: userColors.chart4 }} />
              </div>
              <div>
                <span>Alertas de Stock</span>
                {items.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {stats.critical > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {stats.critical} sin stock
                      </Badge>
                    )}
                    {stats.criticalItems > 0 && (
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: `${userColors.chart4}20`,
                          color: userColors.chart4,
                        }}
                      >
                        {stats.criticalItems} críticos
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadLowStockItems}
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Actualizar</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle
                className="h-12 w-12 mx-auto mb-2 opacity-50"
                style={{ color: userColors.kpiNegative }}
              />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={loadLowStockItems} className="mt-2">
                Reintentar
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: `${userColors.kpiPositive}15` }}
              >
                <BellOff className="h-8 w-8" style={{ color: userColors.kpiPositive }} />
              </div>
              <p className="font-medium" style={{ color: userColors.kpiPositive }}>
                Stock en orden
              </p>
              <p className="text-sm">Todos los items tienen stock suficiente</p>
            </div>
          ) : (
            <ScrollArea className="h-[350px] pr-3">
              <div className="space-y-2">
                {items.slice(0, maxItems).map((item) => {
                  const level = getAlertLevel(item);
                  const styles = getAlertStyles(level);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer',
                        styles.bg,
                        styles.border
                      )}
                      onClick={() => onItemClick?.(item.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                              styles.badge
                            )}
                          >
                            {item.stockQuantity === 0 ? (
                              <AlertOctagon className="h-4 w-4" />
                            ) : item.isCritical ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              getItemTypeIcon(item.itemType)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('font-medium', styles.text)}>
                                {item.name}
                              </span>
                              {item.isCritical && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  CRÍTICO
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              {item.code && <span>{item.code}</span>}
                              <span>•</span>
                              <span>{getItemTypeLabel(item.itemType)}</span>
                              {item.location && (
                                <>
                                  <span>•</span>
                                  <span>{item.location.name}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className={styles.text}>
                                Stock:{' '}
                                <strong>
                                  {item.stockQuantity === 0 ? (
                                    <span style={{ color: userColors.kpiNegative }}>SIN STOCK</span>
                                  ) : (
                                    item.stockQuantity
                                  )}
                                </strong>
                              </span>
                              <span className="text-muted-foreground">Mín: {item.minStockLevel}</span>
                              <span style={{ color: userColors.kpiNegative }} className="font-medium">
                                Faltan: {item.deficit}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onItemClick?.(item.id);
                              }}
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver / Reponer</TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Barra de progreso */}
                      <div className="mt-3">
                        <div className="h-1.5 w-full bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all rounded-full"
                            style={{
                              width: `${Math.min(item.percentageOfMin, 100)}%`,
                              backgroundColor:
                                item.stockQuantity === 0
                                  ? userColors.kpiNegative
                                  : item.percentageOfMin <= 25
                                  ? userColors.chart4
                                  : userColors.chart1,
                            }}
                          />
                        </div>
                        <p className="text-[10px] mt-1 text-right text-muted-foreground">
                          {item.percentageOfMin.toFixed(0)}% del mínimo
                        </p>
                      </div>
                    </div>
                  );
                })}
                {items.length > maxItems && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    Mostrando {maxItems} de {items.length} alertas
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default StockAlertsPanel;
