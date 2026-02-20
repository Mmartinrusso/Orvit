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
import { History, Calendar, TrendingUp, TrendingDown, Loader2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CompHistoryRecord {
  id: string;
  effectiveFrom: string;
  grossSalary: number;
  payrollTaxes: number;
  changePct: number | null;
  createdAt: string;
}

interface EmployeeHistoryDialogProps {
  employeeId: string;
  employeeName: string;
  currentRole: string;
  children?: React.ReactNode;
}

export function EmployeeHistoryDialog({
  employeeId,
  employeeName,
  currentRole,
  children
}: EmployeeHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<CompHistoryRecord[]>([]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/employees/${employeeId}/comp-history`);
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        toast.error('Error al cargar historial de sueldos');
      }
    } catch (error) {
      console.error('Error fetching employee history:', error);
      toast.error('Error al cargar historial de sueldos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, employeeId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  const getTotalComp = (record: CompHistoryRecord) => {
    return record.grossSalary + record.payrollTaxes;
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
            Historial de Sueldos - {employeeName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {currentRole}
              </Badge>
              <span>Historial de compensaciones y aumentos</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Summary Statistics */}
          {history.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Registros</div>
                <div className="text-lg font-bold text-foreground">{history.length}</div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <div className="text-sm text-muted-foreground">Actual (Bruto)</div>
                <div className="text-lg font-bold text-primary">
                  {formatCurrency(history[0]?.grossSalary || 0)}
                </div>
              </div>
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30 col-span-2 md:col-span-1">
                <div className="text-sm text-muted-foreground">Total + Cargas</div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(getTotalComp(history[0] || { grossSalary: 0, payrollTaxes: 0 } as any))}
                </div>
              </div>
            </div>
          )}

          {/* History Timeline */}
          <div>
            <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Cronología de Cambios
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Cargando historial...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay historial de sueldos disponible</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record, index) => {
                  const totalComp = getTotalComp(record);
                  const isLatest = index === 0;

                  return (
                    <div
                      key={record.id}
                      className={cn('relative flex items-center justify-between p-4 rounded-lg border transition-shadow', isLatest ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card border-border hover:shadow-sm')}
                    >
                      {/* Timeline line */}
                      {index < history.length - 1 && (
                        <div className="absolute left-6 top-full w-0.5 h-3 bg-border"></div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-3 h-3 rounded-full', isLatest ? 'bg-primary' : 'bg-muted-foreground')}></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {formatCurrency(record.grossSalary)} bruto
                              </span>
                              <span className="text-sm text-muted-foreground">
                                + {formatCurrency(record.payrollTaxes)} cargas
                              </span>
                              {isLatest && (
                                <Badge variant="default" className="text-xs">
                                  Vigente
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Efectivo desde: {formatDate(record.effectiveFrom)}
                            </div>
                            <div className="text-sm font-medium text-foreground mt-1">
                              Total: {formatCurrency(totalComp)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Change percentage */}
                      {record.changePct !== null && (
                        <div className="text-right">
                          <div className={cn('flex items-center gap-1 text-sm font-medium', record.changePct >= 0 ? 'text-success' : 'text-destructive')}>
                            {record.changePct >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>
                              {record.changePct >= 0 ? '+' : ''}
                              {record.changePct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            vs anterior
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary insights */}
          {history.length > 1 && (
            <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
              <h5 className="font-medium text-foreground mb-2">Resumen de Aumentos</h5>
              <div className="space-y-2 text-sm">
                {(() => {
                  const increases = history.filter(r => r.changePct && r.changePct > 0);
                  const avgIncrease = increases.length > 0 
                    ? increases.reduce((sum, r) => sum + (r.changePct || 0), 0) / increases.length 
                    : 0;
                  const totalGrowth = history.length > 1 
                    ? ((history[0].grossSalary - history[history.length - 1].grossSalary) / history[history.length - 1].grossSalary) * 100
                    : 0;

                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aumentos registrados:</span>
                        <span className="font-medium">{increases.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aumento promedio:</span>
                        <span className="font-medium text-success">
                          +{avgIncrease.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Crecimiento total:</span>
                        <span className={cn('font-medium', totalGrowth >= 0 ? 'text-success' : 'text-destructive')}>
                          {totalGrowth >= 0 ? '+' : ''}{totalGrowth.toFixed(1)}%
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
