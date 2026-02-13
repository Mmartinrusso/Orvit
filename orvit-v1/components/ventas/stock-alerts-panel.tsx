'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Package,
  RefreshCw,
  ExternalLink,
  TrendingDown,
  Bell,
  BellOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductWithLowStock {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  minStock: number;
  unit: string;
  category?: { name: string };
  deficit: number;
  percentageOfMin: number;
}

interface StockAlertsPanelProps {
  className?: string;
  onProductClick?: (productId: string) => void;
  compact?: boolean;
}

export function StockAlertsPanel({
  className,
  onProductClick,
  compact = false,
}: StockAlertsPanelProps) {
  const [products, setProducts] = useState<ProductWithLowStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLowStockProducts();
  }, []);

  const loadLowStockProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/products?onlyActive=true');
      if (!response.ok) throw new Error('Error cargando productos');
      const allProducts = await response.json();

      // Filtrar productos con stock bajo
      const lowStock: ProductWithLowStock[] = allProducts
        .filter((p: any) => {
          const current = p.currentStock || 0;
          const min = p.minStock || 0;
          return min > 0 && current <= min;
        })
        .map((p: any) => {
          const current = p.currentStock || 0;
          const min = p.minStock || 0;
          return {
            id: p.id,
            name: p.name,
            code: p.code,
            currentStock: current,
            minStock: min,
            unit: p.unit || 'unidad',
            category: p.category,
            deficit: min - current,
            percentageOfMin: min > 0 ? (current / min) * 100 : 0,
          };
        })
        .sort((a: ProductWithLowStock, b: ProductWithLowStock) => a.percentageOfMin - b.percentageOfMin);

      setProducts(lowStock);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAlertLevel = (percentageOfMin: number) => {
    if (percentageOfMin === 0) return 'critical';
    if (percentageOfMin <= 25) return 'danger';
    if (percentageOfMin <= 50) return 'warning';
    return 'low';
  };

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'danger':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'danger':
        return <TrendingDown className="w-4 h-4 text-orange-600" />;
      default:
        return <Bell className="w-4 h-4 text-amber-600" />;
    }
  };

  if (compact) {
    // Vista compacta para sidebar o widgets
    return (
      <Card className={cn('', className)}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Stock Bajo
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {products.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Sin alertas de stock</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-1.5">
                {products.slice(0, 10).map((product) => {
                  const level = getAlertLevel(product.percentageOfMin);
                  return (
                    <button
                      key={product.id}
                      onClick={() => onProductClick?.(product.id)}
                      className={cn(
                        'w-full p-2 rounded text-left text-xs transition-colors',
                        getAlertColor(level),
                        'hover:opacity-80'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate flex-1 mr-2">
                          {product.name}
                        </span>
                        <span className="text-xs whitespace-nowrap">
                          {product.currentStock}/{product.minStock}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    );
  }

  // Vista completa
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alertas de Stock Bajo
            {products.length > 0 && (
              <Badge variant="destructive">{products.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadLowStockProducts}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadLowStockProducts} className="mt-2">
              Reintentar
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BellOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Sin alertas de stock</p>
            <p className="text-sm">Todos los productos tienen stock suficiente</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {products.map((product) => {
                const level = getAlertLevel(product.percentageOfMin);
                return (
                  <div
                    key={product.id}
                    className={cn(
                      'p-3 rounded-lg border',
                      getAlertColor(level)
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getAlertIcon(level)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {product.code}
                            </Badge>
                          </div>
                          {product.category && (
                            <p className="text-xs text-muted-foreground">
                              {product.category.name}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span>
                              Stock: <strong>{product.currentStock}</strong> {product.unit}
                            </span>
                            <span className="text-muted-foreground">
                              Minimo: {product.minStock} {product.unit}
                            </span>
                            <span className="text-destructive font-medium">
                              Faltan: {product.deficit} {product.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                      {onProductClick && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onProductClick(product.id)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Barra de progreso */}
                    <div className="mt-3">
                      <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all',
                            level === 'critical'
                              ? 'bg-red-500'
                              : level === 'danger'
                              ? 'bg-orange-500'
                              : level === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-yellow-500'
                          )}
                          style={{ width: `${Math.min(product.percentageOfMin, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs mt-1 text-right">
                        {product.percentageOfMin.toFixed(0)}% del minimo
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
