'use client';

import { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  Building2, 
  DollarSign, 
  Target,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useCostosStats } from '@/hooks/use-costos-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EstadisticasCostosProps {
  companyId: string;
}

export function EstadisticasCostos({ companyId }: EstadisticasCostosProps) {
  const { stats, loading, error, refreshStats } = useCostosStats({ companyId });
  const [showDetailed, setShowDetailed] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        <p>Error: {error}</p>
        <Button onClick={refreshStats} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Estadísticas de Costos
          </h2>
          <p className="text-muted-foreground mt-1">
            Análisis completo de costos por categoría y empleado
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowDetailed(!showDetailed)}
          >
            {showDetailed ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showDetailed ? 'Vista Simple' : 'Vista Detallada'}
          </Button>
          <Button onClick={refreshStats} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costos</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalGeneral)}</div>
            <p className="text-xs text-muted-foreground">
              Costo total de la empresa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
            <Users className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmpleados}</div>
            <p className="text-xs text-muted-foreground">
              Personal activo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Building2 className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCategorias}</div>
            <p className="text-xs text-muted-foreground">
              Tipos de empleados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Salario</CardTitle>
            <Target className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.promedioSalario)}</div>
            <p className="text-xs text-muted-foreground">
              Salario promedio mensual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="categorias" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="categorias">Por Categoría</TabsTrigger>
          <TabsTrigger value="empleados">Por Empleado</TabsTrigger>
          <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
        </TabsList>

        {/* Tab: Distribución por Categoría */}
        <TabsContent value="categorias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribución de Costos por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.distribucionPorCategoria.map((categoria, index) => (
                  <div key={categoria.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-info-muted text-info-muted-foreground flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{categoria.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {categoria.empleadoCount} empleado{categoria.empleadoCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrency(categoria.totalCost)}</div>
                      <Badge variant="secondary">{formatPercentage(categoria.porcentaje)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Distribución por Empleado */}
        <TabsContent value="empleados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Empleados por Costo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.distribucionPorEmpleado.slice(0, showDetailed ? undefined : 10).map((empleado, index) => (
                  <div key={empleado.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-success-muted text-success flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{empleado.name}</div>
                        <div className="text-sm text-muted-foreground">{empleado.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatCurrency(empleado.totalCost)}</div>
                      <div className="text-sm text-muted-foreground">
                        Salario: {formatCurrency(empleado.grossSalary)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Impuestos: {formatCurrency(empleado.payrollTaxes)}
                      </div>
                      <Badge variant="outline">{formatPercentage(empleado.porcentaje)}</Badge>
                    </div>
                  </div>
                ))}
                {!showDetailed && stats.distribucionPorEmpleado.length > 10 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>Mostrando top 10 de {stats.distribucionPorEmpleado.length} empleados</p>
                    <p className="text-sm">Activa &quot;Vista Detallada&quot; para ver todos</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Tendencias */}
        <TabsContent value="tendencias" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Empleados Nuevos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">
                  {stats.tendencias.empleadosNuevos}
                </div>
                <p className="text-sm text-muted-foreground">
                  Contratados en el último mes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Variación Mensual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-info-muted-foreground">
                  {formatPercentage(stats.tendencias.variacionUltimoMes)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Cambio respecto al mes anterior
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Destacados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.empleadoMasCostoso && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Empleado Más Costoso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(stats.empleadoMasCostoso.totalCost)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {stats.empleadoMasCostoso.name}
                  </p>
                </CardContent>
              </Card>
            )}

            {stats.categoriaMasCostosa && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Categoría Más Costosa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-info-muted-foreground">
                    {formatCurrency(stats.categoriaMasCostosa.totalCost)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {stats.categoriaMasCostosa.name} ({stats.categoriaMasCostosa.empleadoCount} empleados)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
