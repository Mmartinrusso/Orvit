'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { History, Calendar, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthlyRecord {
  id: string;
  month: string;
  amount: number;
  label: string;
  variation: number | null;
  variationPct: number | null;
  createdAt: string;
}

interface IndirectItem {
  id: string;
  code: string;
  label: string;
  category: string;
}

interface IndirectHistoryDialogProps {
  itemId: string;
  itemCode: string;
  itemLabel: string;
  category: string;
  children?: React.ReactNode;
}

const categoryLabels = {
  RENT: 'Alquileres',
  UTILITIES: 'Servicios',
  MAINTENANCE: 'Mantenimiento',
  INSURANCE: 'Seguros',
  DEPRECIATION: 'Depreciaciones',
  OTHER: 'Otros',
};

const categoryColors = {
  RENT: 'bg-info-muted text-info-muted-foreground border-info-muted',
  UTILITIES: 'bg-success-muted text-success border-success-muted',
  MAINTENANCE: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  INSURANCE: 'bg-info-muted text-info-muted-foreground border-info-muted',
  DEPRECIATION: 'bg-destructive/10 text-destructive border-destructive/30',
  OTHER: 'bg-muted text-foreground border-border',
};

export function IndirectHistoryDialog({
  itemId,
  itemCode,
  itemLabel,
  category,
  children
}: IndirectHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<MonthlyRecord[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/indirect-items/${itemId}/history`);
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setStatistics(data.statistics || null);
      } else {
        toast.error('Error al cargar historial');
      }
    } catch (error) {
      console.error('Error fetching indirect history:', error);
      toast.error('Error al cargar historial');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, itemId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy', { locale: es });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Ver Historial
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Historial Mensual - {itemCode}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={cn(categoryColors[category as keyof typeof categoryColors])}
              >
                {categoryLabels[category as keyof typeof categoryLabels]}
              </Badge>
              <span>{itemLabel}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Statistics Summary */}
          {statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Total Meses</div>
                <div className="text-lg font-bold text-foreground">{statistics.totalRecords}</div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Promedio</div>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(statistics.avgAmount)}
                </div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Máximo</div>
                <div className="text-lg font-bold text-destructive">
                  {formatCurrency(statistics.maxAmount)}
                </div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Mínimo</div>
                <div className="text-lg font-bold text-success">
                  {formatCurrency(statistics.minAmount)}
                </div>
              </div>
            </div>
          )}

          {/* Monthly History */}
          <div>
            <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Historial por Mes
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Cargando historial...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay historial disponible para este ítem</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record, index) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {formatMonth(record.month)}
                          </div>
                          {record.label !== itemLabel && (
                            <div className="text-sm text-muted-foreground">
                              {record.label}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {record.variation !== null && record.variationPct !== null && (
                        <div className="text-right">
                          <div className={cn('flex items-center gap-1 text-sm', record.variation >= 0 ? 'text-destructive' : 'text-success')}>
                            {record.variation >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>
                              {record.variation >= 0 ? '+' : ''}
                              {record.variationPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.variation >= 0 ? '+' : ''}
                            {formatCurrency(record.variation)}
                          </div>
                        </div>
                      )}

                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatCurrency(record.amount)}
                        </div>
                        {index === 0 && (
                          <Badge variant="default" className="text-xs mt-1">
                            Más reciente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
