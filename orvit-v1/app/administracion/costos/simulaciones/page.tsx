'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, 
  Plus, 
  Save,
  Download, 
  Upload,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Calculator,
  BarChart3,
  Zap
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';

interface Simulacion {
  id: number;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
  estado: 'borrador' | 'activa' | 'completada';
  escenarios: Escenario[];
}

interface Escenario {
  id: number;
  nombre: string;
  descripcion: string;
  variaciones: Variacion[];
  costoActual: number;
  costoProyectado: number;
  variacion: number;
  estado: 'ok' | 'warning' | 'danger';
}

interface Variacion {
  id: number;
  tipo: 'aumento_salarial' | 'precio_insumo' | 'servicio' | 'dolar' | 'ipc';
  descripcion: string;
  porcentaje: number;
  impacto: number;
}

export default function SimulacionesPage() {
  const { currentCompany } = useCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [simulaciones, setSimulaciones] = useState<Simulacion[]>([]);
  const [selectedSimulacion, setSelectedSimulacion] = useState<Simulacion | null>(null);
  const [nuevaSimulacion, setNuevaSimulacion] = useState({
    nombre: '',
    descripcion: ''
  });

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de carga
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Datos de ejemplo
      setSimulaciones([
        {
          id: 1,
          nombre: 'Simulación Aumento Salarial 2024',
          descripcion: 'Análisis del impacto de un aumento salarial del 15%',
          fechaCreacion: '2024-01-15',
          estado: 'activa',
          escenarios: [
            {
              id: 1,
              nombre: 'Escenario Conservador',
              descripcion: 'Aumento del 10% en salarios',
              variaciones: [
                {
                  id: 1,
                  tipo: 'aumento_salarial',
                  descripcion: 'Aumento salarial general',
                  porcentaje: 10,
                  impacto: 45000
                }
              ],
              costoActual: 450000,
              costoProyectado: 495000,
              variacion: 10,
              estado: 'warning'
            },
            {
              id: 2,
              nombre: 'Escenario Moderado',
              descripcion: 'Aumento del 15% en salarios',
              variaciones: [
                {
                  id: 2,
                  tipo: 'aumento_salarial',
                  descripcion: 'Aumento salarial general',
                  porcentaje: 15,
                  impacto: 67500
                }
              ],
              costoActual: 450000,
              costoProyectado: 517500,
              variacion: 15,
              estado: 'danger'
            }
          ]
        },
        {
          id: 2,
          nombre: 'Simulación Variación Dólar',
          descripcion: 'Impacto de la variación del dólar en insumos',
          fechaCreacion: '2024-01-10',
          estado: 'completada',
          escenarios: [
            {
              id: 3,
              nombre: 'Dólar +20%',
              descripcion: 'Incremento del 20% en el tipo de cambio',
              variaciones: [
                {
                  id: 3,
                  tipo: 'dolar',
                  descripcion: 'Variación del dólar',
                  porcentaje: 20,
                  impacto: 76000
                }
              ],
              costoActual: 380000,
              costoProyectado: 456000,
              variacion: 20,
              estado: 'danger'
            }
          ]
        },
        {
          id: 3,
          nombre: 'Simulación Completa 2024',
          descripcion: 'Análisis integral de todos los factores',
          fechaCreacion: '2024-01-05',
          estado: 'borrador',
          escenarios: [
            {
              id: 4,
              nombre: 'Escenario Base',
              descripcion: 'Variaciones moderadas en todos los factores',
              variaciones: [
                {
                  id: 4,
                  tipo: 'aumento_salarial',
                  descripcion: 'Aumento salarial 12%',
                  porcentaje: 12,
                  impacto: 54000
                },
                {
                  id: 5,
                  tipo: 'precio_insumo',
                  descripcion: 'Incremento precios insumos 8%',
                  porcentaje: 8,
                  impacto: 30400
                },
                {
                  id: 6,
                  tipo: 'servicio',
                  descripcion: 'Aumento servicios 5%',
                  porcentaje: 5,
                  impacto: 15600
                }
              ],
              costoActual: 1142000,
              costoProyectado: 1230000,
              variacion: 7.7,
              estado: 'warning'
            }
          ]
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
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

  const getSimulacionEstadoBadge = (estado: 'borrador' | 'activa' | 'completada') => {
    switch (estado) {
      case 'borrador':
        return <Badge className="bg-muted text-foreground hover:bg-muted">Borrador</Badge>;
      case 'activa':
        return <Badge className="bg-info-muted text-info-muted-foreground hover:bg-info-muted">Activa</Badge>;
      case 'completada':
        return <Badge className="bg-success-muted text-success hover:bg-success-muted">Completada</Badge>;
    }
  };

  const getVariacionIcon = (variacion: number) => {
    if (variacion > 0) {
      return <TrendingUp className="h-4 w-4 text-destructive" />;
    } else if (variacion < 0) {
      return <TrendingDown className="h-4 w-4 text-success" />;
    } else {
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTipoVariacionBadge = (tipo: string) => {
    const tipos = {
      'aumento_salarial': { label: 'Salarios', color: 'bg-info-muted text-info-muted-foreground' },
      'precio_insumo': { label: 'Insumos', color: 'bg-warning-muted text-warning-muted-foreground' },
      'servicio': { label: 'Servicios', color: 'bg-purple-100 text-purple-800' },
      'dolar': { label: 'Dólar', color: 'bg-success-muted text-success' },
      'ipc': { label: 'IPC', color: 'bg-destructive/10 text-destructive' }
    };
    
    const tipoInfo = tipos[tipo as keyof typeof tipos] || { label: tipo, color: 'bg-muted text-foreground' };
    
    return <Badge className={tipoInfo.color}>{tipoInfo.label}</Badge>;
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Simulaciones</h1>
            <p className="text-muted-foreground">
              Escenarios, proyecciones y análisis de sensibilidad
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Simulación
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Simulaciones</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{simulaciones.length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Simulaciones creadas</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Simulaciones Activas</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{simulaciones.filter(s => s.estado === 'activa').length}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>En ejecución</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escenarios Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {simulaciones.reduce((sum, sim) => sum + sim.escenarios.filter(e => e.estado === 'danger').length, 0)}
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>Requieren atención</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Simulación</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15/01/2024</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Hace 2 días</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="simulaciones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="simulaciones">Simulaciones</TabsTrigger>
          <TabsTrigger value="escenarios">Escenarios</TabsTrigger>
          <TabsTrigger value="analisis">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="simulaciones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Simulaciones</CardTitle>
              <CardDescription>Gestión de simulaciones y escenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {simulaciones.map((simulacion) => (
                  <div key={simulacion.id} className="border rounded-lg">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{simulacion.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {simulacion.descripcion} • {formatDate(simulacion.fechaCreacion)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-medium">{simulacion.escenarios.length} escenarios</div>
                          <div className="text-sm text-muted-foreground">
                            {simulacion.escenarios.filter(e => e.estado === 'danger').length} críticos
                          </div>
                        </div>
                        {getSimulacionEstadoBadge(simulacion.estado)}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium mb-2">Escenarios:</div>
                      <div className="space-y-2">
                        {simulacion.escenarios.map((escenario) => (
                          <div key={escenario.id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div>
                              <div className="font-medium">{escenario.nombre}</div>
                              <div className="text-sm text-muted-foreground">{escenario.descripcion}</div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <div className="font-medium">{formatCurrency(escenario.costoProyectado)}</div>
                                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                  {getVariacionIcon(escenario.variacion)}
                                  <span className={escenario.variacion > 0 ? 'text-destructive' : 'text-success'}>
                                    {escenario.variacion > 0 ? '+' : ''}{formatNumber(escenario.variacion, 1)}%
                                  </span>
                                </div>
                              </div>
                              {getEstadoBadge(escenario.estado)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escenarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Escenarios</CardTitle>
              <CardDescription>Comparativa de diferentes escenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {simulaciones.flatMap(simulacion => simulacion.escenarios).map((escenario) => (
                  <div key={escenario.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">{escenario.nombre}</div>
                        <div className="text-sm text-muted-foreground">{escenario.descripcion}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          {escenario.variaciones.map((variacion) => (
                            <div key={variacion.id} className="flex items-center space-x-1">
                              {getTipoVariacionBadge(variacion.tipo)}
                              <span className="text-xs text-muted-foreground">
                                {variacion.porcentaje > 0 ? '+' : ''}{variacion.porcentaje}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(escenario.costoProyectado)}</div>
                        <div className="text-sm text-muted-foreground">
                          vs {formatCurrency(escenario.costoActual)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{escenario.variacion > 0 ? '+' : ''}{formatNumber(escenario.variacion, 1)}%</div>
                        <div className="text-sm text-muted-foreground">Variación</div>
                      </div>
                      {getEstadoBadge(escenario.estado)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analisis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Impacto por Tipo de Variación</CardTitle>
                <CardDescription>Análisis del impacto de diferentes factores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['aumento_salarial', 'precio_insumo', 'servicio', 'dolar', 'ipc'].map((tipo) => {
                    const variaciones = simulaciones.flatMap(s => s.escenarios).flatMap(e => e.variaciones).filter(v => v.tipo === tipo);
                    const impactoTotal = variaciones.reduce((sum, v) => sum + v.impacto, 0);
                    const promedio = variaciones.length > 0 ? impactoTotal / variaciones.length : 0;
                    
                    return (
                      <div key={tipo} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getTipoVariacionBadge(tipo)}
                          <span className="text-sm font-medium">
                            {variaciones.length} variaciones
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(impactoTotal)}</div>
                          <div className="text-xs text-muted-foreground">
                            Promedio: {formatCurrency(promedio)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertas y Recomendaciones</CardTitle>
                <CardDescription>Estado actual de las simulaciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span>3 escenarios críticos detectados</span>
                  </div>
                  <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Crítico</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                    <span>2 simulaciones activas</span>
                  </div>
                  <Badge className="bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted">Atención</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>1 simulación completada</span>
                  </div>
                  <Badge className="bg-success-muted text-success hover:bg-success-muted">OK</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 