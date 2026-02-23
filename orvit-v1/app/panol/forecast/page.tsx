'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/date-utils';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  TrendingUp,
  AlertTriangle,
  Package,
  Calendar,
  Wrench,
  ShoppingCart,
  DollarSign,
  Loader2,
  AlertCircle,
  Clock,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';
import Link from 'next/link';

interface ToolNeed {
  tool: {
    id: number;
    name: string;
    stockQuantity: number;
    minStockLevel?: number;
    unit?: string;
    cost?: number;
    category?: string;
    itemType?: string;
  };
  currentStock: number;
  minStock: number;
  reservedForPM: number;
  avgMonthlyConsumption: number;
  projectedNeed: number;
  suggestedOrder: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  linkedMachines: Array<{ id: number; name: string; criticality?: number }>;
  scheduledPMs: Array<{ id: number; title: string; date: Date }>;
}

interface ScheduledPM {
  id: number;
  title: string;
  machine?: { id: number; name: string; code?: string; criticalityScore?: number };
  scheduledDate: string;
  reservationsCount: number;
}

interface ForecastStats {
  totalScheduledPMs: number;
  uniqueToolsNeeded: number;
  criticalItems: number;
  highPriorityItems: number;
  estimatedCost: number;
  stockoutRisk: number;
}

const priorityConfig = {
  CRITICAL: { label: 'Crítico', color: 'bg-destructive/10 text-destructive', textColor: 'text-destructive' },
  HIGH: { label: 'Alto', color: 'bg-warning-muted text-warning-muted-foreground', textColor: 'text-warning-muted-foreground' },
  MEDIUM: { label: 'Medio', color: 'bg-info-muted text-info-muted-foreground', textColor: 'text-info-muted-foreground' },
  LOW: { label: 'Bajo', color: 'bg-muted text-foreground', textColor: 'text-muted-foreground' },
};

export default function ForecastPage() {
  const permissions = usePanolPermissions();

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [includeHistory, setIncludeHistory] = useState(true);

  const [needs, setNeeds] = useState<ToolNeed[]>([]);
  const [scheduledPMs, setScheduledPMs] = useState<ScheduledPM[]>([]);
  const [stats, setStats] = useState<ForecastStats>({
    totalScheduledPMs: 0,
    uniqueToolsNeeded: 0,
    criticalItems: 0,
    highPriorityItems: 0,
    estimatedCost: 0,
    stockoutRisk: 0,
  });
  const [forecastPeriod, setForecastPeriod] = useState({ from: new Date(), to: new Date(), days: 30 });

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('days', days);
      if (includeHistory) params.set('includeHistory', 'true');

      const res = await fetch(`/api/panol/forecast?${params}`);
      const data = await res.json();

      if (data.success) {
        setNeeds(data.data.needs || []);
        setScheduledPMs(data.data.scheduledPMs || []);
        setStats(data.data.stats || {});
        setForecastPeriod(data.data.forecastPeriod || {});
      }
    } catch (error) {
      toast.error('Error al calcular pronóstico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [days, includeHistory]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <TrendingUp className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Calculando pronóstico...</p>
        </div>
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
              <h1 className="text-xl font-semibold text-foreground">Pronóstico de Stock</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Necesidades de repuestos según mantenimientos preventivos programados
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchForecast}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* Period Selector */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Período:</span>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 días</SelectItem>
                      <SelectItem value="15">15 días</SelectItem>
                      <SelectItem value="30">30 días</SelectItem>
                      <SelectItem value="60">60 días</SelectItem>
                      <SelectItem value="90">90 días</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(new Date())} → {formatDate(addDays(new Date(), parseInt(days)))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className={cn(
            "grid gap-4",
            permissions.canViewCosts ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"
          )}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">PMs Programados</p>
                    <p className="text-2xl font-bold">{stats.totalScheduledPMs}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(stats.criticalItems > 0 && 'border-destructive/30/50')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Items Críticos</p>
                    <p className="text-2xl font-bold text-destructive">{stats.criticalItems}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn(stats.stockoutRisk > 0 && 'border-warning-muted/50')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Riesgo Stockout</p>
                    <p className="text-2xl font-bold text-warning-muted-foreground">{stats.stockoutRisk}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-warning-muted flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Repuestos a Pedir</p>
                    <p className="text-2xl font-bold">{needs.filter(n => n.suggestedOrder > 0).length}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-info-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {permissions.canViewCosts && (
              <Card className="bg-gradient-to-br from-success-muted to-success-muted/60 border-success-muted">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-success">Costo Estimado</p>
                      <p className="text-xl font-bold text-success">
                        {formatCurrency(stats.estimatedCost)}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Needs Table */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Repuestos Requeridos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {needs.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No hay necesidades proyectadas para este período</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Repuesto</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-center">Necesidad</TableHead>
                        <TableHead className="text-center">Pedir</TableHead>
                        <TableHead className="text-center">Prioridad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {needs.map((need) => {
                        const priorityInfo = priorityConfig[need.priority];
                        const stockRatio = (need.currentStock / Math.max(need.projectedNeed, 1)) * 100;

                        return (
                          <TableRow key={need.tool.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{need.tool.name}</p>
                                {need.linkedMachines.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {need.linkedMachines.slice(0, 2).map(m => m.name).join(', ')}
                                    {need.linkedMachines.length > 2 && ` +${need.linkedMachines.length - 2}`}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-center">
                                <p className={cn(
                                  'font-semibold',
                                  need.currentStock <= 0 ? 'text-destructive' :
                                  need.currentStock < need.minStock ? 'text-warning-muted-foreground' : ''
                                )}>
                                  {need.currentStock}
                                </p>
                                <Progress
                                  value={Math.min(stockRatio, 100)}
                                  className={cn(
                                    'h-1 mt-1 w-16 mx-auto',
                                    stockRatio < 50 && '[&>div]:bg-destructive',
                                    stockRatio >= 50 && stockRatio < 100 && '[&>div]:bg-warning'
                                  )}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="font-medium">{need.projectedNeed}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Reservado PM: {need.reservedForPM}</p>
                                  <p>Prom. mensual: {need.avgMonthlyConsumption}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-center">
                              {need.suggestedOrder > 0 ? (
                                <Badge variant="outline" className="font-semibold text-info-muted-foreground border-info-muted-foreground">
                                  +{need.suggestedOrder}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Scheduled PMs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  PMs Programados
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {scheduledPMs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin PMs programados</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {scheduledPMs.slice(0, 15).map((pm) => (
                      <Link
                        key={pm.id}
                        href={`/mantenimiento/ordenes/${pm.id}`}
                        className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">OT-{pm.id}</p>
                            <p className="text-xs text-muted-foreground truncate">{pm.title}</p>
                            {pm.machine && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Wrench className="h-3 w-3" />
                                {pm.machine.name}
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-xs font-medium">
                              {format(new Date(pm.scheduledDate), 'dd/MM')}
                            </p>
                            {pm.reservationsCount > 0 && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {pm.reservationsCount} rep.
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                    {scheduledPMs.length > 15 && (
                      <p className="text-center text-xs text-muted-foreground py-2">
                        +{scheduledPMs.length - 15} más
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Suggestions */}
          {(stats.criticalItems > 0 || stats.stockoutRisk > 0) && (
            <Card className="border-warning-muted/50 bg-warning-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-warning-muted-foreground">Acciones Recomendadas</p>
                    <ul className="text-sm text-warning-muted-foreground mt-2 space-y-1">
                      {stats.criticalItems > 0 && (
                        <li>• Revisar {stats.criticalItems} items críticos para máquinas de alta criticidad</li>
                      )}
                      {stats.stockoutRisk > 0 && (
                        <li>• {stats.stockoutRisk} items tienen riesgo de stockout antes de los PMs programados</li>
                      )}
                      <li>• Generar orden de compra para {needs.filter(n => n.suggestedOrder > 0).length} repuestos</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
