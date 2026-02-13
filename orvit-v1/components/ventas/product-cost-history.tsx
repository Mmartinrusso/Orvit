'use client';

import { useState, useEffect } from 'react';
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
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CostLog {
  id: string;
  productId: string;
  companyId: number;
  previousCost: number;
  newCost: number;
  previousStock: number | null;
  newStock: number | null;
  changeSource: string;
  notes: string | null;
  createdById: number;
  createdAt: string;
  changePercentage: number;
  createdBy?: { id: number; name: string };
}

interface CostStats {
  minCost: number;
  maxCost: number;
  avgCost: number;
  firstRecord: string;
  lastRecord: string;
  totalChanges: number;
}

interface ProductCostHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  currentCost: number;
  currency: string;
}

export function ProductCostHistory({
  open,
  onOpenChange,
  productId,
  productName,
  currentCost,
  currency,
}: ProductCostHistoryProps) {
  const [logs, setLogs] = useState<CostLog[]>([]);
  const [stats, setStats] = useState<CostStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      loadCostHistory();
    }
  }, [open, productId]);

  const loadCostHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}/cost-history?limit=100`);
      if (!response.ok) throw new Error('Error cargando historial');
      const data = await response.json();
      setLogs(data.logs || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading cost history:', error);
      toast.error('Error al cargar el historial de costos');
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
    if (percentage > 0) return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (percentage < 0) return <TrendingDown className="w-4 h-4 text-green-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'RECIPE':
        return 'Receta';
      case 'PURCHASE':
        return 'Compra';
      case 'MANUAL':
        return 'Manual';
      case 'ADJUSTMENT':
        return 'Ajuste';
      case 'IMPORT':
        return 'Importacion';
      default:
        return source;
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'RECIPE':
        return 'bg-purple-100 text-purple-700';
      case 'PURCHASE':
        return 'bg-blue-100 text-blue-700';
      case 'MANUAL':
        return 'bg-gray-100 text-gray-700';
      case 'ADJUSTMENT':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Grafico simple de barras con CSS
  const maxCost = stats?.maxCost || Math.max(...logs.map((l) => l.newCost), currentCost);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Historial de Costos
          </DialogTitle>
          <DialogDescription>
            {productName} - Costo actual: {formatCurrency(currentCost)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto space-y-4">
          {/* Estadisticas */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Costo Minimo</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(stats.minCost)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Costo Maximo</p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(stats.maxCost)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Promedio</p>
                  <p className="font-semibold">{formatCurrency(stats.avgCost)}</p>
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
                  Evolucion del Costo
                </h4>
                <div className="space-y-2">
                  {logs.slice(0, 10).reverse().map((log, index) => (
                    <div key={log.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 truncate">
                        {format(new Date(log.createdAt), 'dd/MM', { locale: es })}
                      </span>
                      <div className="flex-1 h-6 bg-muted rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${(log.newCost / maxCost) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono w-20 text-right">
                        {formatCurrency(log.newCost)}
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
                onClick={loadCostHistory}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay registros de cambio de costo</p>
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
                              {formatCurrency(log.previousCost)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">
                              {formatCurrency(log.newCost)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                log.changePercentage > 0
                                  ? 'text-red-600 border-red-200'
                                  : log.changePercentage < 0
                                  ? 'text-green-600 border-green-200'
                                  : ''
                              }`}
                            >
                              {log.changePercentage > 0 ? '+' : ''}
                              {log.changePercentage.toFixed(1)}%
                            </Badge>
                            <Badge className={`text-xs ${getSourceBadgeColor(log.changeSource)}`}>
                              {getSourceLabel(log.changeSource)}
                            </Badge>
                          </div>
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
