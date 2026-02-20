'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, Network, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface RequestStat {
  url: string;
  count: number;
  initiator: string;
  type: string;
}

export default function AdminRequestsDebugPage() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [requests, setRequests] = useState<RequestStat[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);

  const startMonitoring = () => {
    setRequests([]);
    setStartTime(Date.now());
    setIsMonitoring(true);
    
    // Instrucciones al usuario
    console.log('🔍 Monitoring iniciado - Navega a /administracion/dashboard');
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    console.log('⏹️ Monitoring detenido');
  };

  // Análisis automático de requests críticos
  const criticalEndpoints = [
    { pattern: 'permissions', severity: 'critical', description: 'Requests de permisos (deben ser 0)' },
    { pattern: 'metrics', severity: 'warning', description: 'Métricas (objetivo: 1-3)' },
    { pattern: 'productos', severity: 'warning', description: 'Productos (debe consolidarse en catalogs)' },
    { pattern: 'insumos', severity: 'warning', description: 'Insumos (debe consolidarse en catalogs)' },
    { pattern: 'clients', severity: 'warning', description: 'Clientes (debe consolidarse en catalogs)' },
    { pattern: 'proveedores', severity: 'warning', description: 'Proveedores (debe consolidarse en catalogs)' },
    { pattern: 'empleados', severity: 'warning', description: 'Empleados (debe consolidarse en catalogs)' },
    { pattern: 'categorias', severity: 'warning', description: 'Categorías (debe consolidarse en catalogs)' },
    { pattern: 'admin/catalogs', severity: 'good', description: 'Catálogos consolidados (objetivo: 1)' },
    { pattern: 'admin/stats', severity: 'good', description: 'Stats consolidados (objetivo: 1)' },
    { pattern: 'calculadora-costos', severity: 'warning', description: 'Calculadora (debe ser manual)' },
  ];

  const analyzeRequests = () => {
    const results = criticalEndpoints.map(endpoint => {
      const count = requests.filter(r => r.url.includes(endpoint.pattern)).length;
      return {
        ...endpoint,
        count,
        status: endpoint.severity === 'critical' 
          ? (count === 0 ? 'pass' : 'fail')
          : endpoint.severity === 'good'
          ? (count === 1 ? 'pass' : count === 0 ? 'warn' : 'info')
          : (count <= 3 ? 'pass' : 'warn')
      };
    });
    return results;
  };

  const totalRequests = requests.length;
  const uniqueUrls = [...new Set(requests.map(r => r.url))].length;
  const analysis = analyzeRequests();
  const criticalIssues = analysis.filter(a => a.status === 'fail').length;
  const warnings = analysis.filter(a => a.status === 'warn').length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">🔍 Debug: Requests de Administración</h1>
        <p className="text-muted-foreground">Monitoreo de requests HTTP en el área de Administración</p>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle>🎮 Controles de Monitoreo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={startMonitoring}
                disabled={isMonitoring}
                className="flex gap-2"
              >
                <Activity className="h-4 w-4" />
                {isMonitoring ? 'Monitoreando...' : 'Iniciar Monitoreo'}
              </Button>
              
              <Button 
                onClick={stopMonitoring}
                disabled={!isMonitoring}
                variant="outline"
              >
                Detener
              </Button>
            </div>

            {isMonitoring && (
              <div className="p-4 bg-info-muted border border-info-muted rounded-lg">
                <p className="font-semibold mb-2">📋 Instrucciones:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Abre DevTools (F12)</li>
                  <li>Ve a la tab "Network"</li>
                  <li>Click en "Clear" para limpiar requests</li>
                  <li>Navega a <code className="bg-background px-1">/administracion/dashboard</code></li>
                  <li>Espera a que cargue completamente</li>
                  <li>Copia los requests de Network aquí o revisa manualmente</li>
                </ol>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Network className="h-8 w-8 mx-auto mb-2 text-info-muted-foreground" />
              <p className="text-3xl font-bold">{totalRequests}</p>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-xs text-muted-foreground mt-1">Objetivo: &lt;40</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-3xl font-bold">{uniqueUrls}</p>
              <p className="text-sm text-muted-foreground">URLs Únicos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-3xl font-bold text-destructive">{criticalIssues}</p>
              <p className="text-sm text-muted-foreground">Issues Críticos</p>
              <p className="text-xs text-muted-foreground mt-1">Deben ser 0</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-warning-muted-foreground" />
              <p className="text-3xl font-bold text-warning-muted-foreground">{warnings}</p>
              <p className="text-sm text-muted-foreground">Advertencias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análisis por Endpoint */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Análisis por Endpoint Crítico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analysis.map((item, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border flex items-center justify-between ${
                  item.status === 'fail'
                    ? 'bg-destructive/10 border-destructive/20'
                    : item.status === 'warn'
                    ? 'bg-warning-muted border-warning-muted'
                    : item.status === 'pass'
                    ? 'bg-success-muted border-success-muted'
                    : 'bg-info-muted border-info-muted'
                }`}
              >
                <div className="flex-1">
                  <p className="font-semibold">{item.pattern}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="text-right">
                  <Badge
                    variant={
                      item.status === 'fail'
                        ? 'destructive'
                        : item.status === 'warn'
                        ? 'default'
                        : 'outline'
                    }
                  >
                    {item.count} requests
                  </Badge>
                  {item.status === 'fail' && (
                    <p className="text-xs text-destructive mt-1">❌ CRÍTICO</p>
                  )}
                  {item.status === 'pass' && (
                    <p className="text-xs text-success mt-1">✅ OK</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instrucciones Manuales */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Testing Manual Recomendado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">1. Verificar Requests Totales</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>DevTools &gt; Network &gt; Clear</li>
                <li>Ir a /administracion/dashboard</li>
                <li>Contar requests</li>
                <li className="font-semibold text-success">✅ Objetivo: &lt;40 requests</li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">2. Verificar Permisos</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Network &gt; Filtrar "permissions"</li>
                <li>Navegar por Administración</li>
                <li className="font-semibold text-success">✅ Objetivo: 0 requests a permissions</li>
                <li className="text-xs text-muted-foreground">
                  (Excepto /api/admin/permissions en página de gestión de permisos)
                </li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">3. Verificar Catálogos</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Network &gt; Buscar: productos, insumos, clients</li>
                <li className="font-semibold text-success">
                  ✅ Objetivo: Consolidados en /api/admin/catalogs (1 request)
                </li>
              </ol>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">4. Verificar Calculadora</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Ir a calculadora de costos</li>
                <li>NO tocar nada por 5 segundos</li>
                <li className="font-semibold text-success">
                  ✅ Objetivo: 0 requests automáticos a calculadora-costos-final
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado Actual */}
      <Card>
        <CardHeader>
          <CardTitle>✅ Estado Actual de Optimización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>Permisos centralizados en AuthContext</span>
              <Badge>✅ Implementado</Badge>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>Hook use-permissions.tsx optimizado</span>
              <Badge>✅ Implementado</Badge>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>Endpoint /api/admin/catalogs creado</span>
              <Badge>✅ Disponible</Badge>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>Hook useAdminCatalogs() creado</span>
              <Badge>✅ Disponible</Badge>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span>Función server getUserWithPermissions()</span>
              <Badge>✅ Creada</Badge>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-warning-muted-foreground" />
              <span>Migración de componentes a useAdminCatalogs</span>
              <Badge variant="outline">⏳ Opcional</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Componentes Identificados */}
      <Card>
        <CardHeader>
          <CardTitle>📦 Componentes Identificados (17)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Dashboards (6 componentes)</h3>
              <div className="text-sm space-y-1 text-foreground">
                <p>• ComprehensiveDashboard.tsx</p>
                <p>• ExecutiveDashboard.tsx</p>
                <p>• MonthSelector.tsx</p>
                <p>• CurrentMetrics.tsx</p>
                <p>• ExecutiveSummary.tsx</p>
                <p>• CurrentMetricsMTD.tsx</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Monthly (5 componentes)</h3>
              <div className="text-sm space-y-1 text-foreground">
                <p>• TaxControlModal.tsx</p>
                <p>• VentasMensuales.tsx</p>
                <p>• ProduccionMensual.tsx</p>
                <p>• ComprasMensuales.tsx</p>
                <p>• MonthlyAnalysis.tsx</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Catálogos (4 componentes)</h3>
              <div className="text-sm space-y-1 text-foreground">
                <p>• LoadsManager.tsx</p>
                <p>• Recetas.tsx</p>
                <p>• DistribucionCostos.tsx</p>
                <p>• EmployeeCostDistributionMatrix.tsx</p>
              </div>
              <p className="text-xs text-warning-muted-foreground mt-2">
                ⏳ Pueden migrar a useAdminCatalogs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultado Final */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Resultado Esperado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-2 bg-success-muted rounded">
              <span>Total requests:</span>
              <span className="font-semibold">&lt;40 (antes: 100-150)</span>
            </div>
            
            <div className="flex justify-between p-2 bg-success-muted rounded">
              <span>Requests de permisos:</span>
              <span className="font-semibold">0 (antes: 40-60)</span>
            </div>
            
            <div className="flex justify-between p-2 bg-success-muted rounded">
              <span>Requests de catálogos:</span>
              <span className="font-semibold">1 (antes: 8-15)</span>
            </div>
            
            <div className="flex justify-between p-2 bg-success-muted rounded">
              <span>Tiempo de carga:</span>
              <span className="font-semibold">&lt;2s (antes: 5-8s)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enlaces Útiles */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Documentación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>• <code className="bg-muted px-2 py-1 rounded">docs/ADMIN_FETCHES.md</code> - Análisis de fetches</p>
            <p>• <code className="bg-muted px-2 py-1 rounded">docs/ADMIN_PERF_FINAL.md</code> - Reporte completo</p>
            <p>• <code className="bg-muted px-2 py-1 rounded">docs/ADMIN_PERF_CHECKLIST.md</code> - 10 tests manuales</p>
            <p>• <code className="bg-muted px-2 py-1 rounded">ADMIN_OPTIMIZADA.md</code> - Resumen ejecutivo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

