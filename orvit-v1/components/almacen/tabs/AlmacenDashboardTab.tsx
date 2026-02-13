'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ClipboardList,
  PackageCheck,
  RotateCcw,
  Package,
  AlertTriangle,
  Bookmark,
  ArrowRight,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Calendar,
  User,
  ExternalLink,
} from 'lucide-react';
import { useAlmacenStats } from '../hooks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlmacenDashboardTabProps {
  onOpenSolicitud?: (id: number) => void;
  onOpenDespacho?: (id: number) => void;
  onNavigateTab?: (tab: string) => void;
}

/**
 * Tab de Dashboard mejorado para el módulo de Almacén
 * Muestra KPIs, items en salida, stock bajo, y actividad reciente
 */
export function AlmacenDashboardTab({
  onOpenSolicitud,
  onOpenDespacho,
  onNavigateTab,
}: AlmacenDashboardTabProps) {
  const { data: stats, isLoading } = useAlmacenStats();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards - Primera fila */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Solicitudes Pendientes"
          value={stats?.solicitudesPendientes || 0}
          description="Requieren aprobación"
          icon={ClipboardList}
          trend={stats?.solicitudesPendientes ? 'attention' : 'neutral'}
          color="yellow"
          onClick={() => onNavigateTab?.('solicitudes')}
        />
        <KPICard
          title="Despachos Listos"
          value={stats?.despachosListos || 0}
          description="Listos para entregar"
          icon={PackageCheck}
          trend="neutral"
          color="blue"
          onClick={() => onNavigateTab?.('despachos')}
        />
        <KPICard
          title="En Salida"
          value={stats?.despachosEnSalida || 0}
          description="Sin devolver"
          icon={ArrowUpRight}
          trend={stats?.despachosEnSalida && stats.despachosEnSalida > 5 ? 'attention' : 'neutral'}
          color="orange"
          onClick={() => onNavigateTab?.('despachos')}
        />
        <KPICard
          title="Stock Bajo"
          value={stats?.alertasStock || 0}
          description="Items críticos"
          icon={AlertTriangle}
          trend={stats?.alertasStock && stats.alertasStock > 5 ? 'critical' : 'neutral'}
          color={stats?.alertasStock && stats.alertasStock > 5 ? 'red' : 'green'}
          onClick={() => onNavigateTab?.('inventario')}
        />
        <KPICard
          title="Reservas Activas"
          value={stats?.reservasActivas || 0}
          description="Stock reservado"
          icon={Bookmark}
          trend="neutral"
          color="purple"
          onClick={() => onNavigateTab?.('reservas')}
        />
      </div>

      {/* Actividad del Día */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Actividad de Hoy</CardTitle>
            </div>
            <Badge variant="outline" className="font-normal">
              {stats?.movimientosHoy || 0} movimientos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
              <div className="p-2 rounded-full bg-green-100">
                <ArrowDownLeft className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats?.entradasHoy || 0}</p>
                <p className="text-xs text-green-600">Entradas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
              <div className="p-2 rounded-full bg-orange-100">
                <ArrowUpRight className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{stats?.salidasHoy || 0}</p>
                <p className="text-xs text-orange-600">Salidas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="p-2 rounded-full bg-blue-100">
                <PackageCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats?.despachosHoy || 0}</p>
                <p className="text-xs text-blue-600">Despachos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segunda fila: Items en Salida y Stock Bajo */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Items en Salida (Sin devolver) */}
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-base">Items en Salida</CardTitle>
              </div>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {stats?.despachosEnSalida || 0} despachos
              </Badge>
            </div>
            <CardDescription>
              Despachos que no han sido devueltos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.despachosEnSalidaList && stats.despachosEnSalidaList.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {stats.despachosEnSalidaList.map((despacho) => (
                    <div
                      key={despacho.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors',
                        despacho.diasEnSalida > 7 && 'border-orange-300 bg-orange-50/50'
                      )}
                      onClick={() => onOpenDespacho?.(despacho.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-full',
                          despacho.diasEnSalida > 7 ? 'bg-orange-100' : 'bg-muted'
                        )}>
                          <Package className={cn(
                            'h-4 w-4',
                            despacho.diasEnSalida > 7 ? 'text-orange-600' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{despacho.numero}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {despacho.destinatario}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={despacho.diasEnSalida > 7 ? 'destructive' : 'secondary'} className="text-xs">
                          {despacho.diasEnSalida} días
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {despacho.itemsCount} items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <PackageCheck className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">No hay items en salida</p>
                <p className="text-xs">Todos los despachos han sido devueltos</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 justify-between"
              onClick={() => onNavigateTab?.('despachos')}
            >
              Ver todos los despachos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Stock Bajo */}
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <CardTitle className="text-base">Stock Bajo</CardTitle>
              </div>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {stats?.alertasStock || 0} items
              </Badge>
            </div>
            <CardDescription>
              Items bajo mínimo o punto de reorden
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.itemsBajoStockList && stats.itemsBajoStockList.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs text-right">Disponible</TableHead>
                      <TableHead className="text-xs text-right">Mínimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.itemsBajoStockList.map((item) => (
                      <TableRow key={item.supplierItemId} className="text-xs">
                        <TableCell className="py-2">
                          <div>
                            <p className="font-medium truncate max-w-[150px]">{item.itemName}</p>
                            <p className="text-muted-foreground">{item.warehouseName}</p>
                          </div>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-medium',
                          item.available <= 0 ? 'text-red-600' : 'text-orange-600'
                        )}>
                          {item.available.toFixed(1)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.stockMinimo.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Stock OK</p>
                <p className="text-xs">No hay items bajo mínimo</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 justify-between"
              onClick={() => onNavigateTab?.('inventario')}
            >
              Ver inventario completo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tercera fila: Resumen Operativo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Solicitudes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Solicitudes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatRow
                label="Pendientes de Aprobación"
                value={stats?.solicitudesPendientes || 0}
                color="yellow"
              />
              <StatRow
                label="Aprobadas (sin despachar)"
                value={stats?.solicitudesAprobadas || 0}
                color="green"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 justify-between"
              onClick={() => onNavigateTab?.('solicitudes')}
            >
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Despachos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              Despachos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatRow
                label="En Preparación"
                value={stats?.despachosPendientes || 0}
                color="blue"
              />
              <StatRow
                label="Listos para Despacho"
                value={stats?.despachosListos || 0}
                color="green"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 justify-between"
              onClick={() => onNavigateTab?.('despachos')}
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Devoluciones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Devoluciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatRow
                label="Pendientes de Revisión"
                value={stats?.devolucionesPendientes || 0}
                color="yellow"
              />
              <StatRow
                label="Procesadas Hoy"
                value={stats?.devolucionesHoy || 0}
                color="green"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 justify-between"
              onClick={() => onNavigateTab?.('devoluciones')}
            >
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Reservas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bookmark className="h-4 w-4" />
              Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatRow
                label="Activas"
                value={stats?.reservasActivas || 0}
                color="blue"
              />
              <StatRow
                label="Próximas a Vencer (7d)"
                value={stats?.reservasProximasVencer || 0}
                color={stats?.reservasProximasVencer ? 'orange' : 'green'}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 justify-between"
              onClick={() => onNavigateTab?.('reservas')}
            >
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Últimos Movimientos */}
      {stats?.movimientosRecientes && stats.movimientosRecientes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Últimos Movimientos</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigateTab?.('kardex')}>
                Ver kardex
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.movimientosRecientes.slice(0, 5).map((mov) => (
                <div
                  key={mov.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-1.5 rounded-full',
                      mov.tipo.includes('ENTRADA') || mov.tipo === 'DEVOLUCION' ? 'bg-green-100' : 'bg-orange-100'
                    )}>
                      {mov.tipo.includes('ENTRADA') || mov.tipo === 'DEVOLUCION' ? (
                        <ArrowDownLeft className="h-3 w-3 text-green-600" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{mov.itemName}</p>
                      <p className="text-xs text-muted-foreground">{mov.warehouseName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-medium',
                      mov.tipo.includes('ENTRADA') || mov.tipo === 'DEVOLUCION' ? 'text-green-600' : 'text-orange-600'
                    )}>
                      {mov.tipo.includes('ENTRADA') || mov.tipo === 'DEVOLUCION' ? '+' : '-'}{mov.cantidad}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(mov.fecha), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Acciones Rápidas</CardTitle>
          <CardDescription>Accesos directos a las operaciones más comunes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onNavigateTab?.('solicitudes')}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Nueva Solicitud
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab?.('despachos')}>
              <PackageCheck className="h-4 w-4 mr-2" />
              Nuevo Despacho
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab?.('devoluciones')}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nueva Devolución
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab?.('kardex')}>
              Ver Kardex
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componentes auxiliares
interface KPICardProps {
  title: string;
  value: number;
  description: string;
  icon: any;
  trend: 'attention' | 'critical' | 'neutral';
  color: 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  onClick?: () => void;
}

function KPICard({ title, value, description, icon: Icon, trend, color, onClick }: KPICardProps) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  const iconColors = {
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md border-l-4',
        colorClasses[color]
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconColors[color])} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend === 'attention' && value > 0 && (
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          )}
          {trend === 'critical' && value > 0 && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'yellow' | 'blue' | 'green' | 'red' | 'orange';
}) {
  const dotColors = {
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', dotColors[color])} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
