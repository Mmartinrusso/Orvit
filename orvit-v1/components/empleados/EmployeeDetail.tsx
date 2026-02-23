'use client';

import { formatNumber } from '@/lib/utils';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  User, 
  Building2,
  History,
  BarChart3,
  X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface EmployeeDetailProps {
  employee: {
    id: string;
    name: string;
    role: string;
    grossSalary: number;
    payrollTaxes: number;
    totalCost: number;
    categoryName?: string;
    startDate: string;
  };
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
}

interface SalaryHistoryEntry {
  id: string;
  fecha_imputacion: string;
  grossSalary: number;
  payrollTaxes: number;
  totalCost: number;
  notes?: string;
  createdAt: string;
}

export default function EmployeeDetail({ employee, isOpen, onClose, companyId }: EmployeeDetailProps) {
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Cargar historial de sueldos
  useEffect(() => {
    if (isOpen && employee.id) {
      loadSalaryHistory();
    }
  }, [isOpen, employee.id, companyId]);

  const loadSalaryHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/employees/salaries?companyId=${companyId}&employeeId=${employee.id}`);
      if (!response.ok) {
        throw new Error('Error cargando historial de sueldos');
      }
      
      const data = await response.json();
      setSalaryHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Calcular estadísticas del historial
  const getHistoryStats = () => {
    if (salaryHistory.length === 0) return null;

    const sortedHistory = [...salaryHistory].sort((a, b) => 
      new Date(a.fecha_imputacion).getTime() - new Date(b.fecha_imputacion).getTime()
    );

    const firstSalary = sortedHistory[0];
    const lastSalary = sortedHistory[sortedHistory.length - 1];
    
    const totalIncrease = lastSalary.totalCost - firstSalary.totalCost;
    const percentageIncrease = firstSalary.totalCost > 0 ? (totalIncrease / firstSalary.totalCost) * 100 : 0;
    
    const increases = [];
    for (let i = 1; i < sortedHistory.length; i++) {
      const increase = sortedHistory[i].totalCost - sortedHistory[i - 1].totalCost;
      if (increase > 0) {
        increases.push({
          from: sortedHistory[i - 1].fecha_imputacion,
          to: sortedHistory[i].fecha_imputacion,
          amount: increase,
          percentage: (increase / sortedHistory[i - 1].totalCost) * 100
        });
      }
    }

    return {
      totalIncreases: increases.length,
      totalIncreaseAmount: totalIncrease,
      percentageIncrease,
      averageIncrease: increases.length > 0 ? increases.reduce((sum, inc) => sum + inc.amount, 0) / increases.length : 0,
      increases
    };
  };

  // Preparar datos para el gráfico
  const getChartData = () => {
    return salaryHistory
      .sort((a, b) => new Date(a.fecha_imputacion).getTime() - new Date(b.fecha_imputacion).getTime())
      .map(entry => ({
        month: entry.fecha_imputacion,
        grossSalary: entry.grossSalary,
        totalCost: entry.totalCost,
        payrollTaxes: entry.payrollTaxes
      }));
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + '-01');
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long'
    });
  };

  const stats = getHistoryStats();
  const chartData = getChartData();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">{employee.name}</DialogTitle>
              <p className="text-muted-foreground">{employee.role} - {employee.categoryName || 'Sin categoría'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="trends">Tendencias</TabsTrigger>
          </TabsList>

          {/* Pestaña Resumen */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Sueldo Actual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(employee.totalCost)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bruto: {formatCurrency(employee.grossSalary)} + Impuestos: {formatCurrency(employee.payrollTaxes)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Aumentos Totales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-info-muted-foreground">
                    {stats ? stats.totalIncreases : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats ? `+${formatCurrency(stats.totalIncreaseAmount)}` : 'Sin historial'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Crecimiento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats ? `${formatNumber(stats.percentageIncrease, 1)}%` : '0%'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Desde el inicio
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Información básica */}
            <Card>
              <CardHeader>
                <CardTitle>Información del Empleado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                    <p className="text-lg">{employee.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Rol</label>
                    <p className="text-lg">{employee.role}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Categoría</label>
                    <p className="text-lg">{employee.categoryName || 'Sin categoría'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha de Inicio</label>
                    <p className="text-lg">{new Date(employee.startDate).toLocaleDateString('es-AR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pestaña Historial */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Sueldos</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Cargando historial...</div>
                ) : error ? (
                  <div className="text-center py-8 text-destructive">Error: {error}</div>
                ) : salaryHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay historial de sueldos registrado
                  </div>
                ) : (
                  <div className="space-y-4">
                    {salaryHistory
                      .sort((a, b) => new Date(b.fecha_imputacion).getTime() - new Date(a.fecha_imputacion).getTime())
                      .map((entry, index) => {
                        const previousEntry = salaryHistory
                          .sort((a, b) => new Date(b.fecha_imputacion).getTime() - new Date(a.fecha_imputacion).getTime())
                          [index + 1];
                        
                        const increase = previousEntry ? entry.totalCost - previousEntry.totalCost : 0;
                        const percentageIncrease = previousEntry && previousEntry.totalCost > 0 
                          ? (increase / previousEntry.totalCost) * 100 
                          : 0;

                        return (
                          <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <h4 className="font-medium">{formatDate(entry.fecha_imputacion)}</h4>
                              <p className="text-sm text-muted-foreground">
                                Bruto: {formatCurrency(entry.grossSalary)} + Impuestos: {formatCurrency(entry.payrollTaxes)}
                              </p>
                              {entry.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-success">
                                {formatCurrency(entry.totalCost)}
                              </p>
                              {increase > 0 && (
                                <div className="flex items-center gap-1 text-success text-sm">
                                  <TrendingUp className="h-3 w-3" />
                                  <span>+{formatCurrency(increase)} ({formatNumber(percentageIncrease, 1)}%)</span>
                                </div>
                              )}
                              {increase < 0 && (
                                <div className="flex items-center gap-1 text-destructive text-sm">
                                  <TrendingDown className="h-3 w-3" />
                                  <span>{formatCurrency(increase)} ({formatNumber(percentageIncrease, 1)}%)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pestaña Tendencias */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Evolución de Sueldos</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos suficientes para mostrar tendencias
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          tickFormatter={(value) => formatDate(value)}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            formatCurrency(value), 
                            name === 'totalCost' ? 'Costo Total' : 
                            name === 'grossSalary' ? 'Sueldo Bruto' : 'Impuestos'
                          ]}
                          labelFormatter={(value) => formatDate(value)}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="totalCost" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="grossSalary" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de barras para aumentos */}
            {stats && stats.increases.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Aumentos por Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.increases}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="to" 
                          tickFormatter={(value) => formatDate(value)}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Aumento']}
                          labelFormatter={(value) => `Hasta ${formatDate(value)}`}
                        />
                        <Bar dataKey="amount" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
