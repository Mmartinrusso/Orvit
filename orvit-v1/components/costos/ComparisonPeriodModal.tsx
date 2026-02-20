'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, BarChart3, TrendingUp, Loader2, CalendarDays } from 'lucide-react';
import { MonthlyComparison } from './MonthlyComparison';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ComparisonPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

type PeriodType = '1year' | '6months' | '3months' | 'custom';

export function ComparisonPeriodModal({ isOpen, onClose, companyId }: ComparisonPeriodModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('6months');
  const [customStartMonth, setCustomStartMonth] = useState('');
  const [customEndMonth, setCustomEndMonth] = useState('');
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const formatMonth = (month: string) => {
    if (!month) return '';
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };

  // Generar opciones de períodos
  const periodOptions = [
    {
      id: '1year' as PeriodType,
      name: 'Último Año',
      description: '12 meses completos',
      icon: <Calendar className="h-5 w-5" />,
      color: 'bg-info-muted border-info-muted text-info-muted-foreground'
    },
    {
      id: '6months' as PeriodType,
      name: 'Últimos 6 Meses',
      description: '6 meses completos',
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'bg-success-muted border-success-muted text-success'
    },
    {
      id: '3months' as PeriodType,
      name: 'Últimos 3 Meses',
      description: '3 meses completos',
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-warning-muted border-warning-muted text-warning-muted-foreground'
    },
    {
      id: 'custom' as PeriodType,
      name: 'Período Personalizado',
      description: 'Selecciona fechas específicas',
      icon: <CalendarDays className="h-5 w-5" />,
      color: 'bg-info-muted border-info-muted text-info-muted-foreground'
    }
  ];

  // Generar meses para un período
  const generateMonths = (period: PeriodType, startMonth?: string, endMonth?: string) => {
    const months = [];
    const currentDate = new Date();

    if (period === 'custom' && startMonth && endMonth) {
      const start = new Date(startMonth + '-01');
      const end = new Date(endMonth + '-01');
      const current = new Date(start);
      
      while (current <= end) {
        months.push(current.toISOString().slice(0, 7));
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      let monthsCount = 0;
      switch (period) {
        case '1year':
          monthsCount = 12;
          break;
        case '6months':
          monthsCount = 6;
          break;
        case '3months':
          monthsCount = 3;
          break;
      }

      for (let i = 0; i < monthsCount; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        months.push(date.toISOString().slice(0, 7));
      }
    }

    return months.reverse(); // Ordenar de más antiguo a más reciente
  };

  // Cargar datos de comparación
  const fetchComparisonData = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const months = generateMonths(selectedPeriod, customStartMonth, customEndMonth);
      
      if (months.length === 0) {
        setComparisonData([]);
        return;
      }

      const promises = months.map(month => 
        fetch(`/api/registros-mensuales?companyId=${companyId}&month=${month}`)
          .then(res => res.json())
          .then(data => ({ ...data.data, month }))
          .catch(() => ({ 
            sueldosEmpleados: [], 
            preciosInsumos: [], 
            ventas: [], 
            produccion: [], 
            registrosMensuales: [],
            month 
          }))
      );

      const results = await Promise.all(promises);
      const filteredResults = results.filter(result => 
        result.sueldosEmpleados.length > 0 || 
        result.preciosInsumos.length > 0 || 
        result.ventas.length > 0 || 
        result.produccion.length > 0 || 
        result.registrosMensuales.length > 0
      );
      
      setComparisonData(filteredResults);
      setShowComparison(true);
    } catch (error) {
      console.error('Error cargando datos de comparativa:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateComparison = () => {
    if (selectedPeriod === 'custom' && (!customStartMonth || !customEndMonth)) {
      toast.warning('Por favor selecciona las fechas de inicio y fin para el período personalizado');
      return;
    }
    fetchComparisonData();
  };

  const handleClose = () => {
    setShowComparison(false);
    setComparisonData([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-6 w-6 text-info-muted-foreground" />
            Comparativa de Períodos
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        {!showComparison ? (
          <div className="space-y-6">
            {/* Selección de período */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Selecciona el período a comparar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {periodOptions.map((option) => (
                  <Card 
                    key={option.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      selectedPeriod === option.id
                        ? 'ring-2 ring-info border-info'
                        : 'hover:border-border'
                    )}
                    onClick={() => setSelectedPeriod(option.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', option.color)}>
                          {option.icon}
                        </div>
                        <div>
                          <h4 className="font-medium">{option.name}</h4>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Período personalizado */}
            {selectedPeriod === 'custom' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Período Personalizado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Mes de inicio</label>
                      <input
                        type="month"
                        value={customStartMonth}
                        onChange={(e) => setCustomStartMonth(e.target.value)}
                        className="w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-info focus:border-info"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Mes de fin</label>
                      <input
                        type="month"
                        value={customEndMonth}
                        onChange={(e) => setCustomEndMonth(e.target.value)}
                        className="w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-info focus:border-info"
                      />
                    </div>
                  </div>
                  {customStartMonth && customEndMonth && (
                    <div className="mt-4 p-3 bg-info-muted rounded-lg">
                      <p className="text-sm text-info-muted-foreground">
                        <strong>Período seleccionado:</strong> {formatMonth(customStartMonth)} - {formatMonth(customEndMonth)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Resumen del período seleccionado */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen del Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-lg', periodOptions.find(p => p.id === selectedPeriod)?.color || 'bg-muted')}>
                    {periodOptions.find(p => p.id === selectedPeriod)?.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-lg">
                      {periodOptions.find(p => p.id === selectedPeriod)?.name}
                    </h4>
                    <p className="text-muted-foreground">
                      {selectedPeriod === 'custom' && customStartMonth && customEndMonth
                        ? `${formatMonth(customStartMonth)} - ${formatMonth(customEndMonth)}`
                        : periodOptions.find(p => p.id === selectedPeriod)?.description
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botón para generar comparativa */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGenerateComparison}
                disabled={loading || (selectedPeriod === 'custom' && (!customStartMonth || !customEndMonth))}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    Generar Comparativa
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header con información del período */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Comparativa: {periodOptions.find(p => p.id === selectedPeriod)?.name}
                </h3>
                <p className="text-muted-foreground">
                  {comparisonData.length} mes(es) con datos disponibles
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowComparison(false)}>
                  Cambiar Período
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cerrar
                </Button>
              </div>
            </div>

            {/* Componente de comparación */}
            {comparisonData.length > 0 ? (
              <MonthlyComparison
                data={comparisonData}
                selectedMonth={comparisonData[comparisonData.length - 1]?.month || ''}
              />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No hay datos disponibles para el período seleccionado</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
