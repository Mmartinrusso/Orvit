"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3, PieChart, Users, Building2, Calculator, RefreshCw, ShoppingCart, Loader2 } from "lucide-react";

interface MonthlyData {
  supplies: any[];
  employees: any[];
  indirectCosts: any[];
  recipes: any[];
  purchases?: Array<{
    month: string;
    amount: number;
    updatedAt?: string;
    description?: string;
    supplier?: string;
  }>;
  totals: {
    supplies: number;
    employees: number;
    indirect: number;
    total: number;
    purchasesTotal?: number;
  };
  counts: {
    supplies: number;
    employees: number;
    indirectCosts: number;
    recipes: number;
    purchases?: number;
  };
}

interface ComparisonData {
  base: MonthlyData;
  compare: MonthlyData;
  differences: {
    supplies: number;
    employees: number;
    indirect: number;
    total: number;
  };
  percentages: {
    supplies: number;
    employees: number;
    indirect: number;
    total: number;
  };
}

export default function MonthlyAnalysis() {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(9);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [compareMonth, setCompareMonth] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [purchases, setPurchases] = useState<Record<number, number>>({});
  const [purchaseInputs, setPurchaseInputs] = useState<Record<number, string>>({});
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [savingPurchaseMonth, setSavingPurchaseMonth] = useState<number | null>(null);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);

  const months = [
    { value: 1, label: "Enero" },
    { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" },
    { value: 6, label: "Junio" },
    { value: 7, label: "Julio" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" },
    { value: 12, label: "Diciembre" }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/monthly-analysis?year=${selectedYear}&month=${selectedMonth}&companyId=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        setMonthlyData(data.summary);
      } else {
        console.error('❌ Error cargando datos mensuales:', response.status);
      }
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyPurchases = async () => {
    setLoadingPurchases(true);
    setPurchasesError(null);
    try {
      const response = await fetch(`/api/purchases/monthly?companyId=1&year=${selectedYear}`);
      if (response.ok) {
        const data = await response.json();
        const map: Record<number, number> = {};
        const inputs: Record<number, string> = {};

        if (Array.isArray(data.purchases)) {
          data.purchases.forEach((purchase: any) => {
            if (!purchase?.month) return;
            const parts = purchase.month.split('-');
            if (parts.length < 2) return;
            const monthNumber = parseInt(parts[1], 10);
            if (Number.isNaN(monthNumber)) return;
            const numericAmount =
              typeof purchase.amount === 'number'
                ? purchase.amount
                : parseFloat(purchase.amount);
            if (!Number.isNaN(numericAmount)) {
              map[monthNumber] = numericAmount;
            }
          });
        }

        months.forEach(({ value }) => {
          inputs[value] = map[value] !== undefined ? map[value].toString() : '';
        });

        setPurchases(map);
        setPurchaseInputs(inputs);
      } else {
        console.error('❌ Error cargando compras mensuales:', response.status);
        setPurchasesError('No se pudieron cargar las compras del año seleccionado.');
      }
    } catch (error) {
      console.error('❌ Error cargando compras mensuales:', error);
      setPurchasesError('Ocurrió un error al obtener las compras.');
    } finally {
      setLoadingPurchases(false);
    }
  };

  const loadComparison = async () => {
    if (!compareYear || !compareMonth) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/monthly-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseYear: selectedYear,
          baseMonth: selectedMonth,
          compareYear,
          compareMonth,
          companyId: 1
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setComparisonData(data.comparison);
      } else {
        console.error('Error cargando comparación');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyData();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadMonthlyPurchases();
  }, [selectedYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${formatNumber(value, 1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-success";
    if (value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const handlePurchaseInputChange = (monthNumber: number, value: string) => {
    setPurchaseInputs(prev => ({ ...prev, [monthNumber]: value }));
    setPurchasesError(null);
  };

  const handleSavePurchase = async (monthNumber: number) => {
    const rawValue = purchaseInputs[monthNumber];
    const trimmed = rawValue?.toString().trim() ?? '';

    if (trimmed === '') {
      setSavingPurchaseMonth(monthNumber);
      try {
        const response = await fetch('/api/purchases/monthly', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: 1,
            year: selectedYear,
            month: monthNumber
          })
        });

        if (response.ok) {
          setPurchases(prev => {
            const { [monthNumber]: _removed, ...rest } = prev;
            return rest;
          });
          setPurchaseInputs(prev => ({ ...prev, [monthNumber]: '' }));
        } else {
          console.error('❌ Error eliminando compra mensual:', response.status);
          setPurchasesError('No se pudo eliminar la compra seleccionada.');
        }
      } catch (error) {
        console.error('❌ Error eliminando compra mensual:', error);
        setPurchasesError('Ocurrió un error al eliminar la compra.');
      } finally {
        setSavingPurchaseMonth(null);
      }
      return;
    }

    const amountValue = Number(trimmed);
    if (Number.isNaN(amountValue)) {
      setPurchasesError('Ingresá un monto válido para guardar.');
      return;
    }

    setSavingPurchaseMonth(monthNumber);
    setPurchasesError(null);
    try {
      const response = await fetch('/api/purchases/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 1,
          year: selectedYear,
          month: monthNumber,
          amount: amountValue
        })
      });

      if (response.ok) {
        setPurchases(prev => ({ ...prev, [monthNumber]: amountValue }));
        setPurchaseInputs(prev => ({ ...prev, [monthNumber]: amountValue.toString() }));
      } else {
        console.error('❌ Error guardando compra mensual:', response.status);
        setPurchasesError('No se pudo guardar la compra. Intentá nuevamente.');
      }
    } catch (error) {
      console.error('❌ Error guardando compra mensual:', error);
      setPurchasesError('Ocurrió un error al guardar la compra.');
    } finally {
      setSavingPurchaseMonth(null);
    }
  };

  const totalPurchases = Object.values(purchases).reduce((sum, value) => sum + value, 0);
  const currentMonthPurchase = purchases[selectedMonth] ?? 0;

  return (
    <div className="space-y-6">
      {/* Controles de filtrado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros de Análisis Mensual
          </CardTitle>
          <CardDescription>
            Selecciona el período a analizar. Se usa el último registro del mes para cada entidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Año</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Mes</Label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compareYear">Comparar Año (Opcional)</Label>
              <Select 
                value={compareYear?.toString() || ""} 
                onValueChange={(value) => setCompareYear(value ? parseInt(value) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compareMonth">Comparar Mes (Opcional)</Label>
              <Select 
                value={compareMonth?.toString() || ""} 
                onValueChange={(value) => setCompareMonth(value ? parseInt(value) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={loadMonthlyData} disabled={loading}>
              {loading ? "Cargando..." : "Aplicar Filtros"}
            </Button>
            {compareYear && compareMonth && (
              <Button onClick={loadComparison} variant="outline" disabled={loading}>
                Comparar Períodos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contenido principal */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="indirectos">Indirectos</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
        </TabsList>

        {/* Pestaña de Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Cargando datos mensuales...</p>
              </div>
            </div>
          ) : monthlyData ? (
            <>
              {/* KPIs principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Insumos</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(monthlyData.totals.supplies)}</div>
                    <p className="text-xs text-muted-foreground">
                      {monthlyData.counts.supplies} insumos
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(monthlyData.totals.employees)}</div>
                    <p className="text-xs text-muted-foreground">
                      {monthlyData.counts.employees} empleados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Costos Indirectos</CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(monthlyData.totals.indirect)}</div>
                    <p className="text-xs text-muted-foreground">
                      {monthlyData.counts.indirectCosts} rubros
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Compras del Mes</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(currentMonthPurchase)}</div>
                    <p className="text-xs text-muted-foreground">
                      {months[selectedMonth - 1].label} {selectedYear}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total General</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(monthlyData.totals.total)}</div>
                    <p className="text-xs text-muted-foreground">
                      {monthlyData.counts.recipes} recetas
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Comparación si está disponible */}
              {comparisonData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Comparación de Períodos</CardTitle>
                    <CardDescription>
                      Diferencias entre {months[selectedMonth - 1].label} {selectedYear} y {months[compareMonth! - 1].label} {compareYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(comparisonData.differences.supplies)}
                          <span className="font-medium">Insumos</span>
                        </div>
                        <div className={cn('text-lg font-bold', getTrendColor(comparisonData.differences.supplies))}>
                          {formatCurrency(comparisonData.differences.supplies)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPercentage(comparisonData.percentages.supplies)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(comparisonData.differences.employees)}
                          <span className="font-medium">Empleados</span>
                        </div>
                        <div className={cn('text-lg font-bold', getTrendColor(comparisonData.differences.employees))}>
                          {formatCurrency(comparisonData.differences.employees)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPercentage(comparisonData.percentages.employees)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(comparisonData.differences.indirect)}
                          <span className="font-medium">Indirectos</span>
                        </div>
                        <div className={cn('text-lg font-bold', getTrendColor(comparisonData.differences.indirect))}>
                          {formatCurrency(comparisonData.differences.indirect)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPercentage(comparisonData.percentages.indirect)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(comparisonData.differences.total)}
                          <span className="font-medium">Total</span>
                        </div>
                        <div className={cn('text-lg font-bold', getTrendColor(comparisonData.differences.total))}>
                          {formatCurrency(comparisonData.differences.total)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPercentage(comparisonData.percentages.total)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay datos disponibles</h3>
                <p className="text-muted-foreground">
                  No se encontraron datos para {months[selectedMonth - 1].label} {selectedYear}
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Pestaña de Insumos */}
        <TabsContent value="insumos" className="space-y-6">
          {monthlyData?.supplies && monthlyData.supplies.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Insumos - {months[selectedMonth - 1].label} {selectedYear}</CardTitle>
                <CardDescription>
                  Últimos precios registrados en el mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {monthlyData.supplies.map((supply, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{supply.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({supply.unit_measure})
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(supply.price_per_unit)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(supply.last_updated)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay datos de insumos para {months[selectedMonth - 1].label} {selectedYear}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pestaña de Empleados */}
        <TabsContent value="empleados" className="space-y-6">
          {monthlyData?.employees && monthlyData.employees.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Empleados - {months[selectedMonth - 1].label} {selectedYear}</CardTitle>
                <CardDescription>
                  Costos de empleados actualizados en el mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {monthlyData.employees.map((employee, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{employee.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({employee.role})
                        </span>
                        {employee.category_name && (
                          <Badge variant="secondary" className="ml-2">
                            {employee.category_name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(employee.total_cost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(employee.gross_salary)} + {formatCurrency(employee.payroll_taxes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay datos de empleados para {months[selectedMonth - 1].label} {selectedYear}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pestaña de Costos Indirectos */}
        <TabsContent value="indirectos" className="space-y-6">
          {monthlyData?.indirectCosts && monthlyData.indirectCosts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Costos Indirectos - {months[selectedMonth - 1].label} {selectedYear}</CardTitle>
                <CardDescription>
                  Rubros de costos indirectos actualizados en el mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {monthlyData.indirectCosts.map((cost, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{cost.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {cost.cost_type}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(cost.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(cost.last_updated)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay datos de costos indirectos para {months[selectedMonth - 1].label} {selectedYear}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compras" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compras Mensuales - {selectedYear}</CardTitle>
              <CardDescription>
                Registrá o actualizá el total de compras para cada mes. Dejá el campo vacío y guardá para eliminar el registro del mes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {purchasesError && (
                <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {purchasesError}
                </div>
              )}
              {loadingPurchases ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Cargando compras...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 border-b">Mes</th>
                        <th className="text-right p-3 border-b">Monto registrado</th>
                        <th className="text-right p-3 border-b">Nuevo monto</th>
                        <th className="text-right p-3 border-b">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((month, index) => {
                        const amount = purchases[month.value];
                        const inputValue = purchaseInputs[month.value] ?? '';
                        const isCurrentMonth = month.value === selectedMonth;
                        const rowClass =
                          `border-b ${isCurrentMonth ? 'bg-info-muted' : index % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`;
                        return (
                          <tr key={month.value} className={rowClass}>
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{month.label}</span>
                                {isCurrentMonth && (
                                  <Badge variant="secondary">Mes seleccionado</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-semibold">
                              {amount !== undefined ? formatCurrency(amount) : '-'}
                            </td>
                            <td className="p-3 text-right">
                              <Input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                value={inputValue}
                                onChange={(event) =>
                                  handlePurchaseInputChange(month.value, event.target.value)
                                }
                                placeholder="0.00"
                                className="text-right"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSavePurchase(month.value)}
                                  disabled={savingPurchaseMonth === month.value}
                                >
                                  {savingPurchaseMonth === month.value ? 'Guardando...' : 'Guardar'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold bg-muted">
                        <td className="p-3 text-right" colSpan={2}>
                          Total anual registrado
                        </td>
                        <td className="p-3 text-right">
                          {formatCurrency(totalPurchases)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
