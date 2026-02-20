'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRegistrosMensuales } from '@/hooks/use-registros-mensuales';
import { ComparisonPeriodModal } from './ComparisonPeriodModal';
import { Loader2, Users, DollarSign, ShoppingCart, Package, FileText, BarChart3 } from 'lucide-react';

interface RegistrosMensualesProps {
  companyId: string;
}

export function RegistrosMensuales({ companyId }: RegistrosMensualesProps) {
  const { data, loading, error, selectedMonth, setSelectedMonth, refreshData } = useRegistrosMensuales(companyId);
  const [showAmounts, setShowAmounts] = useState(true); // true = $, false = cantidades
  const [showComparisonModal, setShowComparisonModal] = useState(false); // true = mostrar modal de comparativa

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (month: string) => {
    if (!month) return '';
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  };


  const calculateTotals = () => {
    if (!data) return {
      totalSueldos: 0,
      totalInsumos: 0,
      totalVentas: 0,
      totalProduccion: 0,
      totalCostos: 0
    };

    const totalSueldos = data.sueldosEmpleados.reduce((sum, sueldo) => 
      sum + parseFloat(sueldo.total_cost || 0), 0
    );

    const totalInsumos = data.preciosInsumos.reduce((sum, insumo) => 
      sum + parseFloat(insumo.amount || 0), 0
    );

    const totalVentas = data.ventas.reduce((sum, venta) => 
      sum + parseFloat(venta.total_amount || 0), 0
    );

    const totalProduccion = data.produccion.reduce((sum, prod) => 
      sum + parseFloat(prod.quantity || 0), 0
    );

    const totalCostos = data.registrosMensuales.reduce((sum, costo) => 
      sum + parseFloat(costo.amount || 0), 0
    );

    return {
      totalSueldos,
      totalInsumos,
      totalVentas,
      totalProduccion,
      totalCostos
    };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Cargando registros...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-destructive mb-4">Error: {error}</p>
        <Button onClick={refreshData} variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Registros por Mes</h2>
          <p className="text-muted-foreground">Selecciona un mes para ver todos los registros</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Mostrar:</label>
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setShowAmounts(true)}
                className={cn('px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  showAmounts
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Montos ($)
              </button>
              <button
                onClick={() => setShowAmounts(false)}
                className={cn('px-3 py-1 rounded-md text-sm font-medium transition-colors',
                  !showAmounts
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Cantidades
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Mes:</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowComparisonModal(true)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Hacer Comparativas
          </Button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sueldos</CardTitle>
            <DollarSign className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">
              {showAmounts 
                ? formatCurrency(totals.totalSueldos)
                : (data?.totales.sueldosEmpleados || 0).toLocaleString('es-AR')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {showAmounts ? 'registros' : 'empleados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precios Insumos</CardTitle>
            <Package className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info-muted-foreground">
              {showAmounts 
                ? formatCurrency(totals.totalInsumos)
                : (data?.totales.preciosInsumos || 0).toLocaleString('es-AR')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {showAmounts ? 'registros' : 'insumos'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {showAmounts 
                ? formatCurrency(totals.totalVentas)
                : (data?.totales.ventas || 0).toLocaleString('es-AR')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {showAmounts ? 'registros' : 'ventas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Producción</CardTitle>
            <Package className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">
              {showAmounts 
                ? totals.totalProduccion.toLocaleString('es-AR')
                : (data?.totales.produccion || 0).toLocaleString('es-AR')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {showAmounts ? 'unidades' : 'registros'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Indirectos</CardTitle>
            <DollarSign className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info-muted-foreground">
              {showAmounts 
                ? formatCurrency(totals.totalCostos)
                : (data?.totales.registrosMensuales || 0).toLocaleString('es-AR')
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {showAmounts ? 'registros' : 'costos'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Registros del mes */}
      <Card>
        <CardHeader>
          <CardTitle>Registros del Mes - {formatMonth(selectedMonth)}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || Object.values(data.totales).every(total => total === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Selecciona un mes para ver los registros</p>
              <p className="text-sm">Los registros se mostrarán aquí organizados por fecha de imputación</p>
            </div>
          ) : (
            <Tabs defaultValue="sueldos" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="sueldos">Sueldos ({data.totales.sueldosEmpleados})</TabsTrigger>
                <TabsTrigger value="insumos">Insumos ({data.totales.preciosInsumos})</TabsTrigger>
                <TabsTrigger value="ventas">Ventas ({data.totales.ventas})</TabsTrigger>
                <TabsTrigger value="produccion">Producción ({data.totales.produccion})</TabsTrigger>
                <TabsTrigger value="costos">Costos ({data.totales.registrosMensuales})</TabsTrigger>
              </TabsList>


              <TabsContent value="sueldos" className="space-y-4">
                {data.sueldosEmpleados.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay sueldos registrados para este mes</p>
                ) : (
                  <div className="space-y-2">
                    {data.sueldosEmpleados.map((sueldo) => (
                      <div key={sueldo.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{sueldo.employee_name}</p>
                          <p className="text-sm text-muted-foreground">{sueldo.employee_role} - {sueldo.category_name}</p>
                          {sueldo.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{sueldo.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(sueldo.total_cost || 0)}</p>
                          <p className="text-sm text-muted-foreground">
                            Bruto: {formatCurrency(sueldo.gross_salary || 0)} | 
                            Impuestos: {formatCurrency(sueldo.payroll_taxes || 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">{formatMonth(sueldo.fecha_imputacion)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="insumos" className="space-y-4">
                {data.preciosInsumos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay precios de insumos registrados para este mes</p>
                ) : (
                  <div className="space-y-2">
                    {data.preciosInsumos.map((insumo) => (
                      <div key={insumo.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{insumo.supply_name}</p>
                          <p className="text-sm text-muted-foreground">{insumo.unit_measure}</p>
                          {insumo.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{insumo.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(insumo.amount || 0)}</p>
                          <p className="text-sm text-muted-foreground">{formatMonth(insumo.fecha_imputacion)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ventas" className="space-y-4">
                {data.ventas.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay ventas registradas para este mes</p>
                ) : (
                  <div className="space-y-2">
                    {data.ventas.map((venta) => (
                      <div key={venta.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{venta.product_name}</p>
                          <p className="text-sm text-muted-foreground">{venta.units_sold} unidades</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(venta.total_amount || 0)}</p>
                          <p className="text-sm text-muted-foreground">{formatMonth(venta.fecha_imputacion)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="produccion" className="space-y-4">
                {data.produccion.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay producción registrada para este mes</p>
                ) : (
                  <div className="space-y-2">
                    {data.produccion.map((prod) => (
                      <div key={prod.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{prod.product_name}</p>
                          <p className="text-sm text-muted-foreground">Cantidad: {prod.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{formatMonth(prod.fecha_imputacion)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="costos" className="space-y-4">
                {data.registrosMensuales.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No hay costos indirectos registrados para este mes</p>
                ) : (
                  <div className="space-y-2">
                    {data.registrosMensuales.map((costo) => (
                      <div key={costo.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{costo.base_name}</p>
                          <p className="text-sm text-muted-foreground">{costo.category_name}</p>
                          {costo.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{costo.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(costo.amount || 0)}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant={costo.status === 'paid' ? 'default' : 'secondary'}>
                              {costo.status === 'paid' ? 'Pagado' : 'Pendiente'}
                            </Badge>
                            <p className="text-sm text-muted-foreground">{formatMonth(costo.fecha_imputacion)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Modal de Comparativas */}
      <ComparisonPeriodModal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        companyId={companyId}
      />
    </div>
  );
}
