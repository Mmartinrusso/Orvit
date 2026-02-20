'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Download, 
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  FileText,
  Calculator,
  PieChart,
  LineChart
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';

interface ReporteCosto {
  id: number;
  nombre: string;
  categoria: string;
  costoActual: number;
  costoAnterior: number;
  variacion: number;
  tendencia: 'up' | 'down' | 'stable';
  estado: 'ok' | 'warning' | 'danger';
}

interface AnalisisMargen {
  id: number;
  producto: string;
  costoUnitario: number;
  precioVenta: number;
  margen: number;
  estado: 'ok' | 'warning' | 'danger';
}

interface EvolucionTemporal {
  mes: string;
  costosLaborales: number;
  materiaPrima: number;
  servicios: number;
  total: number;
}

interface RankingInsumo {
  id: number;
  nombre: string;
  categoria: string;
  impacto: number;
  variacion: number;
  estado: 'ok' | 'warning' | 'danger';
}

export default function ReportesPage() {
  const { currentCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [reportesCostos, setReportesCostos] = useState<ReporteCosto[]>([]);
  const [analisisMargenes, setAnalisisMargenes] = useState<AnalisisMargen[]>([]);
  const [evolucionTemporal, setEvolucionTemporal] = useState<EvolucionTemporal[]>([]);
  const [rankingInsumos, setRankingInsumos] = useState<RankingInsumo[]>([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState('mes');

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setReportesCostos([
        {
          id: 1,
          nombre: 'Costos Laborales',
          categoria: 'Personal',
          costoActual: 450000,
          costoAnterior: 436500,
          variacion: 3.1,
          tendencia: 'up',
          estado: 'warning'
        },
        {
          id: 2,
          nombre: 'Materia Prima',
          categoria: 'Insumos',
          costoActual: 380000,
          costoAnterior: 389500,
          variacion: -2.4,
          tendencia: 'down',
          estado: 'ok'
        },
        {
          id: 3,
          nombre: 'Servicios Operativos',
          categoria: 'Servicios',
          costoActual: 312000,
          costoAnterior: 292000,
          variacion: 6.8,
          tendencia: 'up',
          estado: 'danger'
        }
      ]);
      
      setAnalisisMargenes([
        {
          id: 1,
          producto: 'Bloque 20x20x40',
          costoUnitario: 45.50,
          precioVenta: 65.00,
          margen: 30.0,
          estado: 'ok'
        },
        {
          id: 2,
          producto: 'Vigueta 12x30',
          costoUnitario: 78.20,
          precioVenta: 95.00,
          margen: 18.0,
          estado: 'warning'
        },
        {
          id: 3,
          producto: 'Adoquín 20x10',
          costoUnitario: 32.80,
          precioVenta: 45.00,
          margen: 27.1,
          estado: 'ok'
        },
        {
          id: 4,
          producto: 'Losa 60x60',
          costoUnitario: 125.40,
          precioVenta: 145.00,
          margen: 13.5,
          estado: 'danger'
        }
      ]);
      
      setEvolucionTemporal([
        { mes: 'Oct 2023', costosLaborales: 420000, materiaPrima: 365000, servicios: 285000, total: 1070000 },
        { mes: 'Nov 2023', costosLaborales: 425000, materiaPrima: 370000, servicios: 288000, total: 1083000 },
        { mes: 'Dic 2023', costosLaborales: 430000, materiaPrima: 375000, servicios: 290000, total: 1095000 },
        { mes: 'Ene 2024', costosLaborales: 436500, materiaPrima: 389500, servicios: 292000, total: 1118000 },
        { mes: 'Feb 2024', costosLaborales: 450000, materiaPrima: 380000, servicios: 312000, total: 1142000 }
      ]);
      
      setRankingInsumos([
        {
          id: 1,
          nombre: 'Cemento Portland',
          categoria: 'Materiales Básicos',
          impacto: 35.2,
          variacion: 6.25,
          estado: 'warning'
        },
        {
          id: 2,
          nombre: 'Hierro 6mm',
          categoria: 'Acero',
          impacto: 28.7,
          variacion: 9.09,
          estado: 'danger'
        },
        {
          id: 3,
          nombre: 'Arena Fina',
          categoria: 'Áridos',
          impacto: 18.3,
          variacion: 7.14,
          estado: 'warning'
        },
        {
          id: 4,
          nombre: 'Piedra Partida',
          categoria: 'Áridos',
          impacto: 12.1,
          variacion: 0,
          estado: 'ok'
        }
      ]);
      
      setIsLoading(false);
    };
    
    loadData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const getEstadoBadge = (estado: 'ok' | 'warning' | 'danger') => {
    switch (estado) {
      case 'ok':
        return <Badge className="bg-success-muted text-success hover:bg-success-muted">OK</Badge>;
      case 'warning':
        return <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Atención</Badge>;
      case 'danger':
        return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Crítico</Badge>;
    }
  };

  const getTendenciaIcon = (tendencia: 'up' | 'down' | 'stable') => {
    switch (tendencia) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-destructive" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-success" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMargenBadge = (margen: number) => {
    if (margen >= 25) {
      return <Badge className="bg-success-muted text-success hover:bg-success-muted">{margen.toFixed(1)}%</Badge>;
    } else if (margen >= 15) {
      return <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">{margen.toFixed(1)}%</Badge>;
    } else {
      return <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">{margen.toFixed(1)}%</Badge>;
    }
  };

  const totalCostos = reportesCostos.reduce((sum, reporte) => sum + reporte.costoActual, 0);
  const totalAnterior = reportesCostos.reduce((sum, reporte) => sum + reporte.costoAnterior, 0);
  const variacionTotal = ((totalCostos - totalAnterior) / totalAnterior) * 100;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reportes de Costos</h1>
            <p className="text-muted-foreground">
              Análisis de costos, márgenes y evolución temporal
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Seleccionar Período
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar Reporte
            </Button>
            <Button>
              <BarChart3 className="h-4 w-4 mr-2" />
              Generar Análisis
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCostos)}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {getTendenciaIcon(variacionTotal > 0 ? 'up' : 'down')}
              <span className={variacionTotal > 0 ? 'text-destructive' : 'text-success'}>
                {variacionTotal > 0 ? '+' : ''}{variacionTotal.toFixed(1)}% vs mes anterior
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Analizados</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analisisMargenes.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Productos con margen</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insumos Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankingInsumos.filter(i => i.estado === 'danger').length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Requieren atención</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Feb 2024</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Último mes</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="costos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="costos">Análisis de Costos</TabsTrigger>
          <TabsTrigger value="margenes">Análisis de Márgenes</TabsTrigger>
          <TabsTrigger value="evolucion">Evolución Temporal</TabsTrigger>
          <TabsTrigger value="ranking">Ranking de Insumos</TabsTrigger>
        </TabsList>

        <TabsContent value="costos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Costos por Categoría</CardTitle>
                <CardDescription>Desglose de costos y variaciones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportesCostos.map((reporte) => (
                    <div key={reporte.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{reporte.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {reporte.categoria}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(reporte.costoActual)}</div>
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            {getTendenciaIcon(reporte.tendencia)}
                            <span className={reporte.variacion > 0 ? 'text-destructive' : 'text-success'}>
                              {reporte.variacion > 0 ? '+' : ''}{reporte.variacion.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {getEstadoBadge(reporte.estado)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribución de Costos</CardTitle>
                <CardDescription>Porcentaje de cada categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportesCostos.map((reporte) => {
                    const porcentaje = (reporte.costoActual / totalCostos) * 100;
                    return (
                      <div key={reporte.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">{reporte.nombre}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(reporte.costoActual)}</div>
                          <div className="text-xs text-muted-foreground">{porcentaje.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="margenes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Márgenes por Producto</CardTitle>
              <CardDescription>Rentabilidad y márgenes de productos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analisisMargenes.map((analisis) => (
                  <div key={analisis.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{analisis.producto}</div>
                        <div className="text-sm text-muted-foreground">
                          Costo: {formatCurrency(analisis.costoUnitario)} • Precio: {formatCurrency(analisis.precioVenta)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(analisis.precioVenta - analisis.costoUnitario)}</div>
                        <div className="text-sm text-muted-foreground">Utilidad unitaria</div>
                      </div>
                      {getMargenBadge(analisis.margen)}
                      {getEstadoBadge(analisis.estado)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolucion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolución Temporal de Costos</CardTitle>
              <CardDescription>Tendencia de costos en los últimos meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {evolucionTemporal.map((evolucion, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{evolucion.mes}</div>
                        <div className="text-sm text-muted-foreground">
                          Total: {formatCurrency(evolucion.total)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">Laborales: {formatCurrency(evolucion.costosLaborales)}</div>
                        <div className="text-xs text-muted-foreground">Materia Prima: {formatCurrency(evolucion.materiaPrima)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">Servicios: {formatCurrency(evolucion.servicios)}</div>
                        <div className="text-xs text-muted-foreground">Total: {formatCurrency(evolucion.total)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Insumos por Impacto</CardTitle>
              <CardDescription>Insumos con mayor impacto en costos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rankingInsumos.map((insumo) => (
                  <div key={insumo.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{insumo.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {insumo.categoria} • Impacto: {insumo.impacto.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{insumo.impacto.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">
                          {insumo.variacion > 0 ? '+' : ''}{insumo.variacion.toFixed(1)}% variación
                        </div>
                      </div>
                      {getEstadoBadge(insumo.estado)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 