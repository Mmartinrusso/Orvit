'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  History,
  Package,
  Settings,
  Wrench,
  Cog,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MachineComponent } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ComponentOverviewTabProps {
  component: MachineComponent;
  onTabChange?: (tab: string) => void;
}

interface ComponentStatsData {
  stats: {
    totalFailures: number;
    openFailures: number;
    resolvedFailures: number;
    totalSubcomponents: number;
    totalDocuments: number;
    totalMaintenanceRecords: number;
  };
  recentFailures: Array<{
    id: number;
    title: string;
    priority: string;
    status: string;
    reportedDate: string;
  }>;
  recentMaintenance: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
  }>;
  linkedSpares: Array<{
    id: number;
    name: string;
    stockQuantity: number;
    minStockLevel: number;
  }>;
}

export function ComponentOverviewTab({ component, onTabChange }: ComponentOverviewTabProps) {
  // Fetch component stats
  const statsQuery = useQuery<ComponentStatsData>({
    queryKey: ['component-overview-stats', component.id],
    queryFn: async () => {
      // Fetch failures for this component
      const failuresRes = await fetch(`/api/components/${component.id}/failures`);
      const failuresData = failuresRes.ok ? await failuresRes.json() : { failures: [] };
      const failures = failuresData.failures || [];

      // Calculate stats from failures
      const openFailures = failures.filter((f: any) =>
        f.status === 'OPEN' || f.status === 'PENDING' || f.status === 'IN_PROGRESS'
      ).length;
      const resolvedFailures = failures.filter((f: any) =>
        f.status === 'RESOLVED' || f.status === 'COMPLETED'
      ).length;

      // Get subcomponents count
      const subcomponentsCount = component.children?.length || 0;

      // Get documents count
      const docsRes = await fetch(`/api/documents?entityType=component&entityId=${component.id}`);
      const docsData = docsRes.ok ? await docsRes.json() : [];
      const documentsCount = Array.isArray(docsData) ? docsData.length : 0;

      // Get recent maintenance history
      let maintenanceRecords: any[] = [];
      if (component.machineId) {
        const historyRes = await fetch(`/api/machines/${component.machineId}/history?componentId=${component.id}`);
        const historyData = historyRes.ok ? await historyRes.json() : { history: [] };
        maintenanceRecords = historyData.history || [];
      }

      // Get linked spares (tools)
      const linkedSpares = component.tools?.map((t: any) => ({
        id: t.toolId || t.tool?.id,
        name: t.tool?.name || 'Repuesto',
        stockQuantity: t.tool?.stockQuantity || 0,
        minStockLevel: t.minStockLevel || 0,
      })) || [];

      return {
        stats: {
          totalFailures: failures.length,
          openFailures,
          resolvedFailures,
          totalSubcomponents: subcomponentsCount,
          totalDocuments: documentsCount,
          totalMaintenanceRecords: maintenanceRecords.length,
        },
        recentFailures: failures.slice(0, 3).map((f: any) => ({
          id: f.id,
          title: f.title,
          priority: f.priority,
          status: f.status,
          reportedDate: f.reportedDate,
        })),
        recentMaintenance: maintenanceRecords.slice(0, 3).map((m: any) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          date: m.date || m.createdAt,
        })),
        linkedSpares,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const statsData = statsQuery.data;
  const isLoading = statsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const getSystemLabel = (system: string) => {
    const normalizedSystem = system?.toLowerCase() || '';
    switch (normalizedSystem) {
      case 'electrico': return 'Sistema Eléctrico';
      case 'hidraulico': return 'Sistema Hidráulico';
      case 'neumatico': return 'Sistema Neumático';
      case 'automatizacion': return 'Automatización';
      case 'mecanico': return 'Sistema Mecánico';
      case 'refrigeracion': return 'Sistema de Refrigeración';
      case 'lubricacion': return 'Sistema de Lubricación';
      case 'combustible': return 'Sistema de Combustible';
      case 'control': return 'Sistema de Control';
      case 'seguridad': return 'Sistema de Seguridad';
      default: return system || 'No especificado';
    }
  };

  const getTypeLabel = (type: string) => {
    const normalizedType = type?.toLowerCase() || '';
    switch (normalizedType) {
      case 'part': return 'Parte Principal';
      case 'piece': return 'Pieza';
      case 'subpiece': return 'Subpieza';
      default: return type || 'Componente';
    }
  };

  return (
    <div className="space-y-6 p-4 max-h-[calc(90vh-200px)] overflow-y-auto">
      {/* Header con info principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              {component.logo ? (
                <img src={component.logo} alt={component.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Settings className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {getTypeLabel(component.type)}
              </Badge>
              {component.system && (
                <Badge variant="secondary" className="text-xs">
                  {getSystemLabel(component.system)}
                </Badge>
              )}
            </div>
            {component.machineName && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Cog className="h-3 w-3" />
                <span>Máquina: <strong>{component.machineName}</strong></span>
              </div>
            )}
            {component.breadcrumb && component.breadcrumb.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Layers className="h-3 w-3" />
                <span>{component.breadcrumb.join(' → ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Fallas Abiertas"
          value={statsData?.stats?.openFailures ?? 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          trend={statsData?.stats?.openFailures === 0 ? 'positive' : 'negative'}
          onClick={() => onTabChange?.('failures')}
        />
        <StatCard
          title="Subcomponentes"
          value={statsData?.stats?.totalSubcomponents ?? 0}
          icon={Wrench}
          iconColor="text-blue-500"
          onClick={() => onTabChange?.('subcomponents')}
        />
        <StatCard
          title="Mantenimientos"
          value={statsData?.stats?.totalMaintenanceRecords ?? 0}
          icon={History}
          iconColor="text-green-500"
          onClick={() => onTabChange?.('history')}
        />
        <StatCard
          title="Documentos"
          value={statsData?.stats?.totalDocuments ?? 0}
          icon={FileText}
          iconColor="text-purple-500"
          onClick={() => onTabChange?.('info')}
        />
      </div>

      {/* Info del componente y Repuestos vinculados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Descripción */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Descripción Técnica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {typeof component.technicalInfo === 'string'
                ? component.technicalInfo
                : component.technicalInfo
                  ? JSON.stringify(component.technicalInfo)
                  : 'Sin descripción técnica disponible'}
            </p>
          </CardContent>
        </Card>

        {/* Repuestos Vinculados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Repuestos Vinculados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(statsData?.linkedSpares?.length ?? 0) === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin repuestos vinculados</p>
              </div>
            ) : (
              <div className="space-y-2">
                {statsData?.linkedSpares?.map((spare) => {
                  const isLowStock = spare.stockQuantity <= spare.minStockLevel;
                  return (
                    <div
                      key={spare.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg border",
                        isLowStock && "border-amber-300 bg-amber-50"
                      )}
                    >
                      <span className="text-sm font-medium">{spare.name}</span>
                      <Badge variant={isLowStock ? "destructive" : "secondary"} className="text-xs">
                        Stock: {spare.stockQuantity}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fallas Recientes y Historial Reciente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fallas Recientes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Fallas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(statsData?.recentFailures?.length ?? 0) === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50 text-green-500" />
                <p className="text-sm">Sin fallas recientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {statsData?.recentFailures?.map((failure) => (
                  <div key={failure.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{failure.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {failure.reportedDate && formatDistanceToNow(new Date(failure.reportedDate), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                    <Badge
                      variant={failure.priority === 'HIGH' || failure.priority === 'CRITICAL' ? 'destructive' : 'secondary'}
                      className="text-xs ml-2"
                    >
                      {failure.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historial Reciente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(statsData?.recentMaintenance?.length ?? 0) === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin historial de mantenimiento</p>
              </div>
            ) : (
              <div className="space-y-2">
                {statsData?.recentMaintenance?.map((record, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <div className="p-1.5 rounded-full bg-green-100">
                      <Wrench className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{record.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.date && formatDistanceToNow(new Date(record.date), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen de estadísticas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Resumen del Componente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{statsData?.stats?.resolvedFailures ?? 0}</p>
              <p className="text-xs text-muted-foreground">Fallas Resueltas</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{statsData?.stats?.totalFailures ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Fallas</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{statsData?.stats?.totalMaintenanceRecords ?? 0}</p>
              <p className="text-xs text-muted-foreground">Mantenimientos</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{statsData?.stats?.totalDocuments ?? 0}</p>
              <p className="text-xs text-muted-foreground">Documentos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente auxiliar para estadísticas
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  onClick?: () => void;
}

function StatCard({ title, value, icon: Icon, iconColor = 'text-gray-500', trend, onClick }: StatCardProps) {
  return (
    <Card
      className={cn("cursor-pointer hover:shadow-md transition-shadow", onClick && "hover:border-primary/50")}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={cn("p-2 rounded-lg bg-muted/50", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center text-xs">
            {trend === 'positive' ? (
              <>
                <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-600">Óptimo</span>
              </>
            ) : trend === 'negative' ? (
              <>
                <ArrowUpRight className="h-3 w-3 text-red-500 mr-1" />
                <span className="text-red-600">Requiere atención</span>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ComponentOverviewTab;
