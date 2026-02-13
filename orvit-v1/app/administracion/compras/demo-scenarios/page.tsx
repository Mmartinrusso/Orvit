'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Play,
  PlayCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  Package,
  FileText,
  ShoppingCart,
  Clock,
  AlertTriangle,
  DollarSign,
  Users,
  RefreshCw,
  ArrowRight,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface ScenarioResult {
  scenario: string;
  description: string;
  created: Array<{
    type: string;
    id: number;
    numero?: string;
  }>;
  success: boolean;
  error?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Flujo Normal': <CheckCircle2 className="h-4 w-4 text-green-500" />,
  'Excepciones Match': <AlertTriangle className="h-4 w-4 text-amber-500" />,
  'GRNI': <Package className="h-4 w-4 text-blue-500" />,
  'Órdenes de Compra': <ShoppingCart className="h-4 w-4 text-purple-500" />,
  'Facturas': <FileText className="h-4 w-4 text-indigo-500" />,
  'Proveedores': <Users className="h-4 w-4 text-gray-500" />,
  'Recepciones': <Package className="h-4 w-4 text-teal-500" />,
  'Pedidos': <Clock className="h-4 w-4 text-orange-500" />,
  'NC/ND': <DollarSign className="h-4 w-4 text-red-500" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Flujo Normal': 'bg-green-100 text-green-700 border-green-200',
  'Excepciones Match': 'bg-amber-100 text-amber-700 border-amber-200',
  'GRNI': 'bg-blue-100 text-blue-700 border-blue-200',
  'Órdenes de Compra': 'bg-purple-100 text-purple-700 border-purple-200',
  'Facturas': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Proveedores': 'bg-gray-100 text-gray-700 border-gray-200',
  'Recepciones': 'bg-teal-100 text-teal-700 border-teal-200',
  'Pedidos': 'bg-orange-100 text-orange-700 border-orange-200',
  'NC/ND': 'bg-red-100 text-red-700 border-red-200',
};

export default function DemoScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [activeTab, setActiveTab] = useState('scenarios');

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    try {
      const response = await fetch('/api/compras/demo-scenarios');
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios);
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
      toast.error('Error al cargar escenarios');
    } finally {
      setLoading(false);
    }
  };

  const createScenario = async (scenarioId: string) => {
    setCreating(scenarioId);
    try {
      const response = await fetch('/api/compras/demo-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Escenario creado: ${data.description}`);
        setResults(prev => [data, ...prev]);
        setActiveTab('results');
      } else {
        toast.error(data.error || 'Error al crear escenario');
      }
    } catch (error) {
      toast.error('Error al crear escenario');
    } finally {
      setCreating(null);
    }
  };

  const createAllScenarios = async () => {
    setCreatingAll(true);
    try {
      const response = await fetch('/api/compras/demo-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createAll: true }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setResults(data.results);
        setActiveTab('results');
      } else {
        toast.error(data.error || 'Error al crear escenarios');
      }
    } catch (error) {
      toast.error('Error al crear escenarios');
    } finally {
      setCreatingAll(false);
    }
  };

  const deleteAllData = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/compras/demo-scenarios', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Datos de prueba eliminados');
        setResults([]);
      } else {
        toast.error(data.error || 'Error al eliminar datos');
      }
    } catch (error) {
      toast.error('Error al eliminar datos');
    } finally {
      setDeleting(false);
    }
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groupedScenarios = categories.reduce((acc, category) => {
    acc[category] = scenarios.filter(s => s.category === category);
    return acc;
  }, {} as Record<string, Scenario[]>);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Escenarios de Prueba P2P
          </h1>
          <p className="text-muted-foreground">
            Genera datos de prueba para todos los escenarios del flujo de compras
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={createAllScenarios}
            disabled={creatingAll}
            className="gap-2"
          >
            {creatingAll ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {creatingAll ? 'Creando...' : 'Crear Todos'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                Limpiar Todo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar todos los datos de prueba?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará todas las órdenes de compra, recepciones, facturas,
                  matches y documentos relacionados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAllData} className="bg-red-600 hover:bg-red-700">
                  {deleting ? 'Eliminando...' : 'Eliminar Todo'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scenarios">Escenarios Disponibles</TabsTrigger>
          <TabsTrigger value="results">
            Resultados
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-2">{results.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="navigation">Navegación Rápida</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-6 mt-6">
          {categories.map(category => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {CATEGORY_ICONS[category]}
                  {category}
                </CardTitle>
                <CardDescription>
                  {groupedScenarios[category].length} escenarios disponibles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {groupedScenarios[category].map(scenario => (
                    <div
                      key={scenario.id}
                      className={`p-4 border rounded-lg ${CATEGORY_COLORS[category]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium">{scenario.name}</h4>
                          <p className="text-sm mt-1 opacity-80">{scenario.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => createScenario(scenario.id)}
                          disabled={creating === scenario.id}
                        >
                          {creating === scenario.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="results" className="space-y-4 mt-6">
          {results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay resultados aún</p>
                <p className="text-sm text-muted-foreground">
                  Crea un escenario para ver los documentos generados
                </p>
              </CardContent>
            </Card>
          ) : (
            results.map((result, index) => (
              <Card key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      {result.scenario.replace(/_/g, ' ').toUpperCase()}
                    </CardTitle>
                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? 'Creado' : 'Error'}
                    </Badge>
                  </div>
                  <CardDescription>{result.description}</CardDescription>
                </CardHeader>
                {result.success && result.created.length > 0 && (
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {result.created.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                        >
                          <span className="font-medium">{item.type}</span>
                          <code className="text-xs bg-background px-2 py-0.5 rounded">
                            {item.numero || `#${item.id}`}
                          </code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
                {!result.success && result.error && (
                  <CardContent>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="navigation" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/torre-control')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Torre de Control</h3>
                  <p className="text-sm text-muted-foreground">Vista general de pendientes</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/match')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">3-Way Match</h3>
                  <p className="text-sm text-muted-foreground">Excepciones y resolución</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/grni')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">GRNI Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Recepciones sin facturar</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/ordenes-compra')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Órdenes de Compra</h3>
                  <p className="text-sm text-muted-foreground">Gestión de OCs</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/recepciones')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Recepciones</h3>
                  <p className="text-sm text-muted-foreground">Recepción de mercadería</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/comprobantes')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Facturas</h3>
                  <p className="text-sm text-muted-foreground">Comprobantes de compra</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/pedidos-compra')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Pedidos de Compra</h3>
                  <p className="text-sm text-muted-foreground">Requisiciones y aprobaciones</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/ordenes-pago')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Órdenes de Pago</h3>
                  <p className="text-sm text-muted-foreground">Pagos y tesorería</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigateTo('/administracion/compras/configuracion')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Configuración</h3>
                  <p className="text-sm text-muted-foreground">Reglas SoD, alertas</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Flujo de Prueba Recomendado</CardTitle>
              <CardDescription>
                Sigue estos pasos para probar el flujo completo P2P
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                  <div>
                    <p className="font-medium">Crear escenarios de prueba</p>
                    <p className="text-sm text-muted-foreground">
                      Usa "Crear Todos" para generar todos los escenarios automáticamente
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                  <div>
                    <p className="font-medium">Revisar Torre de Control</p>
                    <p className="text-sm text-muted-foreground">
                      Verifica que todos los KPIs y alertas se muestren correctamente
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                  <div>
                    <p className="font-medium">Resolver excepciones de Match</p>
                    <p className="text-sm text-muted-foreground">
                      Ve a Match, selecciona las discrepancias y resuélvelas
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">4</span>
                  <div>
                    <p className="font-medium">Revisar GRNI</p>
                    <p className="text-sm text-muted-foreground">
                      Verifica los buckets de antigüedad y proveedores
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">5</span>
                  <div>
                    <p className="font-medium">Intentar operaciones bloqueadas</p>
                    <p className="text-sm text-muted-foreground">
                      Intenta pagar una factura con match bloqueado o proveedor bloqueado
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
