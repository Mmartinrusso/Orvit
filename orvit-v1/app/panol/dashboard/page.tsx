'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Wrench,
  Box,
  Cog,
  BarChart3,
  Activity,
  Target,
  Calendar,
  Loader2,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Eye,
  ShieldAlert,
  Layers,
  ClipboardList,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { subDays, eachDayOfInterval, format, startOfWeek, endOfWeek, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Tool {
  id: number;
  name: string;
  code: string | null;
  itemType: string;
  category: string | null;
  stockQuantity: number;
  minStockLevel: number;
  cost: number | null;
  isCritical: boolean;
  location: string | null;
  updatedAt: string;
}

interface Movement {
  id: number;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'MAINTENANCE' | 'RETURN' | 'STOCK_IN' | 'STOCK_OUT';
  quantity: number;
  createdAt: string;
  reason: string | null;
  user?: { name: string } | null;
  tool: {
    id: number;
    name: string;
    itemType: string;
  };
}

const ITEM_TYPE_CONFIG = {
  TOOL: { label: 'Herramientas', icon: Wrench, color: 'bg-info', textColor: 'text-info-muted-foreground', bgColor: 'bg-info-muted' },
  SUPPLY: { label: 'Insumos', icon: Box, color: 'bg-success', textColor: 'text-success', bgColor: 'bg-success-muted' },
  SPARE_PART: { label: 'Repuestos', icon: Cog, color: 'bg-accent-purple', textColor: 'text-accent-purple-muted-foreground', bgColor: 'bg-accent-purple-muted' },
  HAND_TOOL: { label: 'Herr. Manuales', icon: Wrench, color: 'bg-warning', textColor: 'text-warning-muted-foreground', bgColor: 'bg-warning-muted' },
};

export default function PanolDashboardPage() {
  const { currentCompany } = useCompany();
  const permissions = usePanolPermissions();

  const [tools, setTools] = useState<Tool[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('7');
  const [smartAlerts, setSmartAlerts] = useState<any[]>([]);
  const [alertsSummary, setAlertsSummary] = useState({ critical: 0, warning: 0, info: 0, total: 0 });

  const loadData = async (refresh = false) => {
    if (!currentCompany?.id) return;

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [toolsRes, movementsRes, alertsRes] = await Promise.all([
        fetch(`/api/tools?companyId=${currentCompany.id}`),
        fetch(`/api/tools/movements?companyId=${currentCompany.id}&limit=500`),
        fetch('/api/panol/alerts'),
      ]);

      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        const toolsArray = Array.isArray(toolsData) ? toolsData : (toolsData?.tools || toolsData?.items || []);
        setTools(toolsArray);
      }

      if (movementsRes.ok) {
        const movementsData = await movementsRes.json();
        const movementsArray = Array.isArray(movementsData) ? movementsData : (movementsData?.movements || movementsData?.items || []);
        setMovements(movementsArray);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        if (alertsData.success) {
          setSmartAlerts(alertsData.data.alerts || []);
          setAlertsSummary(alertsData.data.summary || { critical: 0, warning: 0, info: 0, total: 0 });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
      setTools([]);
      setMovements([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentCompany?.id]);

  const stats = useMemo(() => {
    const daysAgo = parseInt(dateRange);
    const startDate = subDays(new Date(), daysAgo);
    const recentMovements = movements.filter(m => new Date(m.createdAt) >= startDate);

    // Inventory stats
    const totalItems = tools.length;
    const totalStock = tools.reduce((sum, t) => sum + t.stockQuantity, 0);
    const totalValue = tools.reduce((sum, t) => sum + ((t.cost || 0) * t.stockQuantity), 0);
    const lowStockItems = tools.filter(t => t.stockQuantity > 0 && t.stockQuantity <= t.minStockLevel);
    const outOfStockItems = tools.filter(t => t.stockQuantity === 0);
    const criticalItems = tools.filter(t => t.isCritical && t.stockQuantity <= t.minStockLevel);
    const healthyItems = tools.filter(t => t.stockQuantity > t.minStockLevel);

    // Stock health percentage
    const stockHealth = totalItems > 0 ? Math.round((healthyItems.length / totalItems) * 100) : 100;

    // By type
    const byType = {
      TOOL: tools.filter(t => t.itemType === 'TOOL'),
      SUPPLY: tools.filter(t => t.itemType === 'SUPPLY'),
      SPARE_PART: tools.filter(t => t.itemType === 'SPARE_PART'),
      HAND_TOOL: tools.filter(t => t.itemType === 'HAND_TOOL'),
    };

    // Movement stats
    const isEntry = (type: string) => ['IN', 'RETURN', 'STOCK_IN'].includes(type);
    const isExit = (type: string) => ['OUT', 'STOCK_OUT'].includes(type);

    const entriesQty = recentMovements.filter(m => isEntry(m.type)).reduce((sum, m) => sum + m.quantity, 0);
    const exitsQty = recentMovements.filter(m => isExit(m.type)).reduce((sum, m) => sum + m.quantity, 0);
    const entriesCount = recentMovements.filter(m => isEntry(m.type)).length;
    const exitsCount = recentMovements.filter(m => isExit(m.type)).length;

    // Today movements
    const todayMovements = movements.filter(m => isToday(new Date(m.createdAt)));
    const todayEntries = todayMovements.filter(m => isEntry(m.type)).reduce((s, m) => s + m.quantity, 0);
    const todayExits = todayMovements.filter(m => isExit(m.type)).reduce((s, m) => s + m.quantity, 0);

    // Top movers
    const toolMovementCount = new Map<number, { name: string; count: number; qty: number; type: string }>();
    recentMovements.forEach(m => {
      const current = toolMovementCount.get(m.tool.id) || { name: m.tool.name, count: 0, qty: 0, type: m.tool.itemType };
      toolMovementCount.set(m.tool.id, {
        ...current,
        count: current.count + 1,
        qty: current.qty + m.quantity
      });
    });
    const topMovers = Array.from(toolMovementCount.entries())
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5)
      .map(([id, data]) => ({ id, ...data }));

    // Daily trend
    const dailyTrend = eachDayOfInterval({
      start: subDays(new Date(), Math.min(parseInt(dateRange), 14)),
      end: new Date(),
    }).map(date => {
      const dayMovements = movements.filter(m => {
        const mDate = new Date(m.createdAt);
        return mDate.toDateString() === date.toDateString();
      });
      return {
        date: format(date, 'EEE', { locale: es }),
        fullDate: format(date, 'dd/MM'),
        entries: dayMovements.filter(m => isEntry(m.type)).reduce((s, m) => s + m.quantity, 0),
        exits: dayMovements.filter(m => isExit(m.type)).reduce((s, m) => s + m.quantity, 0),
        total: dayMovements.length,
      };
    });

    // Recent movements for activity feed
    const recentActivity = movements
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    // Categories distribution
    const categories = [...new Set(tools.map(t => t.category).filter(Boolean))] as string[];
    const categoryStats = categories.map(cat => ({
      name: cat,
      count: tools.filter(t => t.category === cat).length,
      lowStock: tools.filter(t => t.category === cat && t.stockQuantity <= t.minStockLevel).length,
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Locations
    const locations = [...new Set(tools.map(t => t.location).filter(Boolean))] as string[];

    return {
      totalItems,
      totalStock,
      totalValue,
      lowStock: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 5),
      outOfStock: outOfStockItems.length,
      outOfStockItems: outOfStockItems.slice(0, 5),
      critical: criticalItems.length,
      criticalItems: criticalItems.slice(0, 5),
      stockHealth,
      byType,
      entriesQty,
      exitsQty,
      entriesCount,
      exitsCount,
      todayEntries,
      todayExits,
      topMovers,
      dailyTrend,
      recentActivity,
      recentMovementsCount: recentMovements.length,
      categoryStats,
      locationsCount: locations.length,
    };
  }, [tools, movements, dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return `Hoy ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `Ayer ${format(date, 'HH:mm')}`;
    }
    return format(date, "dd MMM HH:mm", { locale: es });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Dashboard de Pañol</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Resumen y métricas del inventario
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[150px] h-9 bg-background">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="14">Últimos 14 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => loadData(true)}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualizar datos</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Today's Activity */}
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Hoy</p>
                  <Zap className="h-4 w-4 text-warning-muted-foreground" />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-lg font-bold text-success">+{stats.todayEntries}</span>
                    <p className="text-xs text-muted-foreground">Entradas</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-lg font-bold text-destructive">-{stats.todayExits}</span>
                    <p className="text-xs text-muted-foreground">Salidas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Health */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Salud del Stock</p>
                  <Target className={cn("h-4 w-4", stats.stockHealth >= 80 ? "text-success" : stats.stockHealth >= 50 ? "text-warning-muted-foreground" : "text-destructive")} />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-2xl font-bold",
                    stats.stockHealth >= 80 ? "text-success" : stats.stockHealth >= 50 ? "text-warning-muted-foreground" : "text-destructive"
                  )}>
                    {stats.stockHealth}%
                  </span>
                </div>
                <Progress
                  value={stats.stockHealth}
                  className="h-1.5 mt-2"
                />
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card className={stats.lowStock + stats.outOfStock > 0 ? 'border-warning-muted/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Alertas</p>
                  <AlertTriangle className={cn("h-4 w-4", stats.lowStock + stats.outOfStock > 0 ? "text-warning-muted-foreground" : "text-muted-foreground")} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-warning-muted-foreground">{stats.lowStock}</span>
                  <span className="text-sm text-muted-foreground">bajo</span>
                  <span className="text-2xl font-bold text-destructive">{stats.outOfStock}</span>
                  <span className="text-sm text-muted-foreground">sin</span>
                </div>
              </CardContent>
            </Card>

            {/* Total Items */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Total Items</p>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{stats.totalItems}</span>
                  <span className="text-xs text-muted-foreground">({stats.totalStock} unid.)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links to New Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/panol/reservas">
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent-purple-muted">
                      <ClipboardList className="h-4 w-4 text-accent-purple-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Reservas OT</p>
                      <p className="text-xs text-muted-foreground">Gestión de reservas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/panol/lotes">
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-info-muted">
                      <Layers className="h-4 w-4 text-info-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Lotes</p>
                      <p className="text-xs text-muted-foreground">Trazabilidad</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/panol/consumo">
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning-muted">
                      <BarChart3 className="h-4 w-4 text-warning-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Consumo</p>
                      <p className="text-xs text-muted-foreground">Por OT y máquina</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/panol/forecast">
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success-muted">
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Pronóstico</p>
                      <p className="text-xs text-muted-foreground">Necesidades PM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Smart Alerts Section */}
          {smartAlerts.length > 0 && (
            <Card className={cn(
              'border-l-4',
              alertsSummary.critical > 0 ? 'border-l-red-500' :
              alertsSummary.warning > 0 ? 'border-l-amber-500' : 'border-l-blue-500'
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bell className={cn(
                      "h-4 w-4",
                      alertsSummary.critical > 0 ? "text-destructive" :
                      alertsSummary.warning > 0 ? "text-warning-muted-foreground" : "text-info-muted-foreground"
                    )} />
                    Alertas Inteligentes
                    {alertsSummary.total > 0 && (
                      <Badge variant="secondary">{alertsSummary.total}</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {alertsSummary.critical > 0 && (
                      <Badge className="bg-destructive/10 text-destructive">
                        {alertsSummary.critical} críticas
                      </Badge>
                    )}
                    {alertsSummary.warning > 0 && (
                      <Badge className="bg-warning-muted text-warning-muted-foreground">
                        {alertsSummary.warning} alertas
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  {smartAlerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3",
                        alert.type === 'CRITICAL' ? 'bg-destructive/10 border-destructive/30' :
                        alert.type === 'WARNING' ? 'bg-warning-muted border-warning-muted' :
                        'bg-info-muted border-info-muted'
                      )}
                    >
                      {alert.type === 'CRITICAL' ? (
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      ) : alert.type === 'WARNING' ? (
                        <AlertTriangle className="h-5 w-5 text-warning-muted-foreground mt-0.5 shrink-0" />
                      ) : (
                        <Bell className="h-5 w-5 text-info-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              alert.type === 'CRITICAL' ? 'text-destructive' :
                              alert.type === 'WARNING' ? 'text-warning-muted-foreground' :
                              'text-info-muted-foreground'
                            )}>
                              {alert.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {alert.description}
                            </p>
                          </div>
                          {alert.action && (
                            <Button variant="ghost" size="sm" className="shrink-0 h-7 text-xs" asChild>
                              <Link href={alert.action.href}>
                                {alert.action.label}
                                <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {smartAlerts.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    +{smartAlerts.length - 4} alertas más
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Charts & Stats */}
            <div className="lg:col-span-2 space-y-4">
              {/* Movement Trend Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-info-muted-foreground" />
                      Movimientos - Últimos {dateRange} días
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-success" />
                        <span>Entradas ({stats.entriesQty})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                        <span>Salidas ({stats.exitsQty})</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-40 flex items-end gap-1">
                    {stats.dailyTrend.map((day, i) => {
                      const maxVal = Math.max(
                        ...stats.dailyTrend.map(d => Math.max(d.entries, d.exits)),
                        1
                      );
                      const entryHeight = (day.entries / maxVal) * 100;
                      const exitHeight = (day.exits / maxVal) * 100;

                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div className="flex-1 flex flex-col items-center gap-1 cursor-default min-w-0">
                              <div className="w-full flex gap-0.5 h-28 items-end justify-center">
                                <div
                                  className="w-2 sm:w-3 bg-success rounded-t transition-all"
                                  style={{ height: `${entryHeight}%`, minHeight: day.entries > 0 ? '4px' : '0' }}
                                />
                                <div
                                  className="w-2 sm:w-3 bg-destructive rounded-t transition-all"
                                  style={{ height: `${exitHeight}%`, minHeight: day.exits > 0 ? '4px' : '0' }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground truncate w-full text-center">{day.date}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p className="font-medium mb-1">{day.fullDate}</p>
                              <p className="text-success">+{day.entries} entradas</p>
                              <p className="text-destructive">-{day.exits} salidas</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Distribution by Type */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent-purple-muted-foreground" />
                    Distribución por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    {(['TOOL', 'SUPPLY', 'SPARE_PART', 'HAND_TOOL'] as const).map((key) => {
                      const config = ITEM_TYPE_CONFIG[key];
                      const count = stats.byType[key]?.length || 0;
                      const percentage = stats.totalItems > 0 ? Math.round((count / stats.totalItems) * 100) : 0;
                      const Icon = config.icon;

                      return (
                        <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <div className={cn("p-2 rounded-lg", config.bgColor)}>
                            <Icon className={cn("h-4 w-4", config.textColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">{config.label}</span>
                              <Badge variant="secondary" className="text-xs">{count}</Badge>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", config.color)}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Categories */}
              {stats.categoryStats.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-info-muted-foreground" />
                      Top Categorías
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-2">
                      {stats.categoryStats.map((cat, i) => (
                        <div key={cat.name} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{cat.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">{cat.count}</Badge>
                                {cat.lowStock > 0 && (
                                  <Badge variant="outline" className="text-xs border-warning-muted text-warning-muted-foreground">
                                    {cat.lowStock} bajo
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Progress
                              value={(cat.count / stats.totalItems) * 100}
                              className="h-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Lists & Alerts */}
            <div className="space-y-4">
              {/* Critical Items */}
              {stats.critical > 0 && (
                <Card className="border-destructive/30/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <ShieldAlert className="h-4 w-4" />
                      Items Críticos ({stats.critical})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {stats.criticalItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/10">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.location || 'Sin ubicación'}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {item.stockQuantity} / {item.minStockLevel}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {stats.critical > 5 && (
                      <Button variant="ghost" size="sm" className="w-full mt-2 text-destructive" asChild>
                        <Link href="/panol?status=critical">
                          Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Low Stock Items */}
              {stats.lowStock > 0 && (
                <Card className="border-warning-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      Stock Bajo ({stats.lowStock})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {stats.lowStockItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category || 'Sin categoría'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-warning-muted-foreground">{item.stockQuantity}</p>
                            <p className="text-xs text-muted-foreground">mín: {item.minStockLevel}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {stats.lowStock > 5 && (
                      <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                        <Link href="/panol?status=low_stock">
                          Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Top Movers */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    Más Movimiento ({dateRange}d)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.topMovers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Sin movimientos</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stats.topMovers.map((item, index) => {
                        const config = ITEM_TYPE_CONFIG[item.type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.TOOL;
                        const Icon = config.icon;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm font-bold text-muted-foreground w-4">{index + 1}</span>
                            <div className={cn("p-1.5 rounded", config.bgColor)}>
                              <Icon className={cn("h-3 w-3", config.textColor)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.count} movimientos</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">{item.qty} u.</Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-info-muted-foreground" />
                    Actividad Reciente
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.recentActivity.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Sin actividad reciente</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stats.recentActivity.map((mov) => {
                        const isEntry = ['IN', 'RETURN', 'STOCK_IN'].includes(mov.type);

                        return (
                          <div key={mov.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className={cn(
                              "p-1 rounded mt-0.5",
                              isEntry ? "bg-success-muted" : "bg-destructive/10"
                            )}>
                              {isEntry ? (
                                <ArrowUpCircle className="h-3 w-3 text-success" />
                              ) : (
                                <ArrowDownCircle className="h-3 w-3 text-destructive" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                <span className={isEntry ? "text-success" : "text-destructive"}>
                                  {isEntry ? '+' : '-'}{mov.quantity}
                                </span>
                                {' '}{mov.tool.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(mov.createdAt)}
                                {mov.user?.name && ` · ${mov.user.name}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                    <Link href="/panol/movimientos">
                      Ver historial <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Value Card - Only for admins */}
              {permissions.canViewCosts && (
                <Card className="bg-success-muted border-success-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-success">Valor del Inventario</p>
                      <DollarSign className="h-4 w-4 text-success" />
                    </div>
                    <p className="text-2xl font-bold text-success">
                      {formatCurrency(stats.totalValue)}
                    </p>
                    <p className="text-xs text-success mt-1">
                      {stats.totalStock} unidades totales
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
