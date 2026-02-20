'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  User,
  Calendar,
  BarChart3,
  RefreshCw,
  List,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PriceLog {
  id: string;
  productId: string;
  companyId: number;
  previousPrice: number | null;
  newPrice: number;
  changeSource: string;
  reason: string | null;
  notes: string | null;
  salesPriceListId: number | null;
  salesPriceList: { id: number; nombre: string } | null;
  createdById: number | null;
  createdAt: string;
  changePercentage: number;
  createdBy?: { id: number; name: string } | null;
}

interface PriceStats {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  firstRecord: string;
  lastRecord: string;
  totalChanges: number;
}

interface ProductPriceHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentPrice: number | null;
  currency: string;
}

export function ProductPriceHistory({
  open,
  onOpenChange,
  productId,
  productName,
  currentPrice,
  currency,
}: ProductPriceHistoryProps) {
  const [logs, setLogs] = useState<PriceLog[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      loadPriceHistory();
    }
  }, [open, productId]);

  const loadPriceHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ventas/productos/${productId}/price-history?limit=100`);
      if (!response.ok) throw new Error('Error cargando historial');
      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading price history:', error);
      toast.error('Error al cargar el historial de precios');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : currency === 'EUR' ? 'EUR' : 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getChangeIcon = (percentage: number) => {
    if (percentage > 0) return <TrendingUp className="w-4 h-4 text-destructive" />;
    if (percentage < 0) return <TrendingDown className="w-4 h-4 text-success" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'PRICE_LIST':
        return 'Lista de Precios';
      case 'PRODUCT_DIRECT':
        return 'Directo';
      case 'BULK_UPDATE':
        return 'Masivo';
      case 'IMPORT':
        return 'Importacion';
      default:
        return source;
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'PRICE_LIST':
        return 'bg-info-muted text-info-muted-foreground';
      case 'PRODUCT_DIRECT':
        return 'bg-purple-100 text-purple-700';
      case 'BULK_UPDATE':
        return 'bg-warning-muted text-warning-muted-foreground';
      case 'IMPORT':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  // Bar chart max value
  const maxPrice = stats?.maxPrice || Math.max(...logs.map((l) => l.newPrice), currentPrice || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Historial de Precios de Venta
          </DialogTitle>
          <DialogDescription>
            {productName} - Precio actual: {currentPrice ? formatCurrency(currentPrice) : 'No definido'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Estadisticas */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Precio Minimo</p>
                  <p className="font-semibold text-success">
                    {formatCurrency(stats.minPrice)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Precio Maximo</p>
                  <p className="font-semibold text-destructive">
                    {formatCurrency(stats.maxPrice)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Promedio</p>
                  <p className="font-semibold">{formatCurrency(stats.avgPrice)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Cambios</p>
                  <p className="font-semibold">{stats.totalChanges}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Grafico de barras simple */}
          {logs.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Evolucion del Precio
                </h4>
                <div className="space-y-2">
                  {logs.slice(0, 10).reverse().map((log) => (
                    <div key={log.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 truncate">
                        {format(new Date(log.createdAt), 'dd/MM', { locale: es })}
                      </span>
                      <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-info transition-all duration-300"
                          style={{
                            width: `${maxPrice > 0 ? (log.newPrice / maxPrice) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono w-20 text-right">
                        {formatCurrency(log.newPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista detallada */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Registros de Cambio
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPriceHistory}
                disabled={loading}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay registros de cambio de precio</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getChangeIcon(log.changePercentage)}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {log.previousPrice != null ? formatCurrency(log.previousPrice) : '-'}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">
                              {formatCurrency(log.newPrice)}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn('text-xs', log.changePercentage > 0 ? 'text-destructive border-destructive/30' : log.changePercentage < 0 ? 'text-success border-success-muted' : '')}
                            >
                              {log.changePercentage > 0 ? '+' : ''}
                              {log.changePercentage.toFixed(1)}%
                            </Badge>
                            <Badge className={cn('text-xs', getSourceBadgeColor(log.changeSource))}>
                              {getSourceLabel(log.changeSource)}
                            </Badge>
                          </div>
                          {log.salesPriceList && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <List className="w-3 h-3" />
                              {log.salesPriceList.nombre}
                            </div>
                          )}
                          {log.reason && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {log.reason}
                            </p>
                          )}
                          {log.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {log.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-right text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', {
                            locale: es,
                          })}
                        </div>
                        {log.createdBy && (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            {log.createdBy.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
