'use client';

import React, { useState, useMemo } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Clock,
  CheckCircle,
  Search,
  Plus,
  Wrench,
  FileText,
  Loader2,
  CalendarDays,
  AlertCircle,
  Box,
  User,
  Timer,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  History,
  Target,
  ClipboardList,
  LayoutGrid,
  List,
  Copy,
  MoreVertical,
  Eye,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Zap,
  Award,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, isBefore, addDays, formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { useMachineMaintenanceHistory, useMachineWorkOrders, useMachineComponents } from '@/hooks/use-machine-detail';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import PreventiveMaintenanceDialog from '../work-orders/PreventiveMaintenanceDialog';
import WorkOrderWizard from '../work-orders/WorkOrderWizard';
import { WorkOrderDetailDialog } from '../work-orders/WorkOrderDetailDialog';
import MaintenanceDetailDialog from './MaintenanceDetailDialog';
import ExecuteMaintenanceDialog from './ExecuteMaintenanceDialog';
import { useToast } from '@/components/ui/use-toast';

interface MachineMaintenanceTabProps {
  machineId: number;
  machineName: string;
  sectorId?: number;
  companyId: number;
  sectorName?: string;
  componentId?: number | string;
  componentName?: string;
  parentComponentId?: string;
}

type SubTab = 'preventive' | 'corrective';
type SubFilter = 'all' | 'pending' | 'history';
type ViewMode = 'grid' | 'list';

export default function MachineMaintenanceTab({
  machineId,
  machineName,
  sectorId,
  companyId: propCompanyId,
  sectorName,
  componentId,
  componentName,
  parentComponentId,
}: MachineMaintenanceTabProps) {
  const companyId = propCompanyId || (typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('currentCompany') || '{}').id
    : null);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('preventive');
  const [subFilter, setSubFilter] = useState<SubFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreventiveDialog, setShowPreventiveDialog] = useState(false);
  const [showCorrectiveDialog, setShowCorrectiveDialog] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
  const [selectedPreventive, setSelectedPreventive] = useState<any>(null);
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executingMaintenance, setExecutingMaintenance] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { maintenanceHistory, isLoading: historyLoading, refetch } = useMachineMaintenanceHistory(
    machineId, true, companyId, sectorId
  );
  const { workOrders, isLoading: workOrdersLoading, isError: workOrdersError, refetch: refetchWorkOrders } = useMachineWorkOrders(
    machineId, true, companyId, sectorId
  );
  const { components } = useMachineComponents(machineId, true);
  const { hasPermission: canCreateMaintenance } = usePermissionRobust('preventive_maintenance.create');

  const handleExecuteClick = (wo: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // Build the maintenance object expected by ExecuteMaintenanceDialog
    setExecutingMaintenance({
      id: wo._templateId,
      type: 'PREVENTIVE',
      isPreventive: true,
      title: wo.title,
      description: wo.description,
      machineId: wo.machineId,
      machine: { name: machineName },
      estimatedHours: wo.estimatedHours,
      timeValue: wo._timeValue,
      toolsRequired: wo._toolsRequired || [],
      assignedToId: wo._assignedToId,
      assignedTo: wo.assignedTo,
      assignedToName: wo.assignedTo?.name,
      componentIds: wo.componentIds || [],
      subcomponentIds: wo.subcomponentIds || [],
      lastMaintenanceDate: wo._lastCompletedDate,
    });
    setExecuteDialogOpen(true);
  };

  const handleExecutionSubmit = async (executionData: any) => {
    setIsExecuting(true);
    try {
      const response = await fetch('/api/maintenance/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(executionData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al ejecutar el mantenimiento');
      }
      const result = await response.json();
      toast({ title: 'Mantenimiento ejecutado', description: result.message, duration: 3000 });
      setExecuteDialogOpen(false);
      setExecutingMaintenance(null);
      queryClient.invalidateQueries({ queryKey: ['preventive-maintenance', 'machine', machineId] });
      refetchWorkOrders();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsExecuting(false);
    }
  };

  const filteredByComponent = useMemo(() => {
    let data = workOrders;
    if (componentId) {
      // En contexto de componente/subcomponente: filtrar planes que incluyen este componente
      // o que no tienen componente asignado (nivel máquina).
      // Los preventivos pueden tener múltiples componentes → buscar en componentIds[].
      data = data.filter((wo: any) => {
        // Sin componente asignado → mostrar siempre (nivel máquina)
        const hasNoComponent = !wo.componentId && (!wo.componentIds || wo.componentIds.length === 0);
        if (hasNoComponent) return true;
        // Preventivos con múltiples componentes
        if (wo.componentIds?.length > 0) {
          return wo.componentIds.some((id: any) => id?.toString() === componentId.toString());
        }
        // Work orders con componente único
        const single = wo.component?.id ?? wo.componentId;
        return single?.toString() === componentId.toString();
      });
    } else if (componentFilter !== 'all') {
      data = data.filter((wo: any) =>
        wo.component?.id?.toString() === componentFilter ||
        wo.componentId?.toString() === componentFilter
      );
    }
    return data;
  }, [workOrders, componentId, componentFilter]);

  const filteredWithoutDuplicates = useMemo(() => {
    if (!hideDuplicates) return filteredByComponent;
    const seenNames = new Set<string>();
    return filteredByComponent.filter((wo: any) => {
      const name = (wo.title || '').trim().toLowerCase();
      if (seenNames.has(name)) return false;
      seenNames.add(name);
      return true;
    });
  }, [filteredByComponent, hideDuplicates]);

  const preventiveOrders = useMemo(() =>
    filteredWithoutDuplicates.filter((wo: any) => wo.type === 'PREVENTIVE'),
    [filteredWithoutDuplicates]
  );

  const correctiveOrders = useMemo(() =>
    filteredWithoutDuplicates.filter((wo: any) => wo.type === 'CORRECTIVE'),
    [filteredWithoutDuplicates]
  );

  const preventivePending = useMemo(() =>
    preventiveOrders.filter((wo: any) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS'),
    [preventiveOrders]
  );
  const preventiveCompleted = useMemo(() =>
    preventiveOrders.filter((wo: any) => wo.status === 'COMPLETED'),
    [preventiveOrders]
  );
  const correctivePending = useMemo(() =>
    correctiveOrders.filter((wo: any) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS'),
    [correctiveOrders]
  );
  const correctiveInProgress = useMemo(() =>
    correctiveOrders.filter((wo: any) => wo.status === 'IN_PROGRESS'),
    [correctiveOrders]
  );
  const correctiveCompleted = useMemo(() =>
    correctiveOrders.filter((wo: any) => wo.status === 'COMPLETED'),
    [correctiveOrders]
  );

  const filteredHistory = useMemo(() => {
    let history = maintenanceHistory;
    if (componentId) {
      history = history.filter((item: any) =>
        item.Component?.id?.toString() === componentId.toString() ||
        item.componentId?.toString() === componentId.toString()
      );
    } else if (componentFilter !== 'all') {
      history = history.filter((item: any) =>
        item.Component?.id?.toString() === componentFilter ||
        item.componentId?.toString() === componentFilter
      );
    }
    if (activeSubTab === 'preventive') {
      history = history.filter((item: any) =>
        item.maintenanceType === 'PREVENTIVE' || item.work_orders?.type === 'PREVENTIVE'
      );
    } else {
      history = history.filter((item: any) =>
        item.maintenanceType !== 'PREVENTIVE' && item.work_orders?.type !== 'PREVENTIVE'
      );
    }
    if (!searchTerm) return history;
    const term = searchTerm.toLowerCase();
    return history.filter((item: any) =>
      item.title?.toLowerCase().includes(term) ||
      item.work_orders?.title?.toLowerCase().includes(term) ||
      item.notes?.toLowerCase().includes(term) ||
      item.rootCause?.toLowerCase().includes(term)
    );
  }, [maintenanceHistory, searchTerm, componentId, componentFilter, activeSubTab]);

  const preventiveStats = useMemo(() => {
    const pending = preventiveOrders.filter((wo: any) => wo.status === 'PENDING').length;
    const inProgress = preventiveOrders.filter((wo: any) => wo.status === 'IN_PROGRESS').length;
    const completed = preventiveCompleted.length;
    const overdue = preventiveOrders.filter((wo: any) =>
      wo.status === 'PENDING' && wo.scheduledDate && isBefore(new Date(wo.scheduledDate), new Date())
    ).length;
    const totalScheduled = preventiveOrders.filter((wo: any) => wo.scheduledDate).length;
    const completedOnTime = preventiveCompleted.filter((wo: any) => {
      if (!wo.scheduledDate || !wo.completedAt) return false;
      return isBefore(new Date(wo.completedAt), addDays(new Date(wo.scheduledDate), 1));
    }).length;
    const complianceRate = totalScheduled > 0 ? Math.round((completedOnTime / totalScheduled) * 100) : 100;
    return { total: preventiveOrders.length, pending, inProgress, completed, overdue, complianceRate };
  }, [preventiveOrders, preventiveCompleted]);

  const correctiveStats = useMemo(() => {
    const pending = correctiveOrders.filter((wo: any) => wo.status === 'PENDING').length;
    const inProgress = correctiveInProgress.length;
    const completed = correctiveCompleted.length;
    const overdue = correctiveOrders.filter((wo: any) =>
      wo.status === 'PENDING' && wo.scheduledDate && isBefore(new Date(wo.scheduledDate), new Date())
    ).length;
    return { total: correctiveOrders.length, pending, inProgress, completed, overdue };
  }, [correctiveOrders, correctiveInProgress, correctiveCompleted]);

  const filteredData = useMemo(() => {
    const orders = activeSubTab === 'preventive' ? preventiveOrders : correctiveOrders;
    switch (subFilter) {
      case 'pending': return orders.filter((wo: any) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS');
      case 'history': return [];
      default: return orders;
    }
  }, [activeSubTab, subFilter, preventiveOrders, correctiveOrders]);

  const isLoading = historyLoading || workOrdersLoading;

  // ─── Status helpers ───────────────────────────────────────────────────────

  const getStatusConfig = (status: string) => {
    const cfg: Record<string, { label: string; icon: React.ReactNode; className: string; dot: string }> = {
      PENDING: { label: 'Pendiente', icon: <Clock className="h-3 w-3" />, className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted/50', dot: 'bg-amber-400' },
      IN_PROGRESS: { label: 'En progreso', icon: <PlayCircle className="h-3 w-3" />, className: 'bg-info-muted text-info-muted-foreground border-info-muted/50', dot: 'bg-blue-400' },
      COMPLETED: { label: 'Completado', icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-success-muted text-success border-success-muted/50', dot: 'bg-success' },
      CANCELLED: { label: 'Cancelado', icon: <XCircle className="h-3 w-3" />, className: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400' },
    };
    return cfg[status] || cfg.PENDING;
  };

  const getPriorityBadge = (priority?: string) => {
    const cfg: Record<string, string> = {
      CRITICAL: 'bg-destructive/10 text-destructive border-destructive/20',
      HIGH: 'bg-warning-muted text-warning-muted-foreground border-warning-muted/50',
      MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
      LOW: 'bg-muted text-muted-foreground border-border',
    };
    const labels: Record<string, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
    if (!priority) return null;
    return (
      <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium', cfg[priority] || cfg.LOW)}>
        {labels[priority] || priority}
      </span>
    );
  };

  const handleItemClick = (item: any) => {
    if (item._isPreventiveTemplate && item._templateId) {
      setSelectedPreventive({
        id: item._templateId, title: item.title, description: item.description,
        priority: item.priority, frequencyDays: item._frequencyDays,
        estimatedHours: item.estimatedHours, machineId: item.machineId,
        scheduledDate: item.scheduledDate, assignedTo: item.assignedTo, component: item.component,
      });
    } else {
      setSelectedWorkOrder(item);
    }
  };

  // ─── Card preventivo ──────────────────────────────────────────────────────

  const renderPreventiveCard = (wo: any) => {
    const statusCfg = getStatusConfig(wo.status);
    // Si el último mantenimiento fue realizado dentro del período de frecuencia actual,
    // la instancia PENDING quedó stale. Calcular la fecha real de próxima ejecución.
    const isCoveredByLastExecution = !!(
      wo._lastCompletedDate &&
      wo._frequencyDays &&
      differenceInDays(new Date(wo.scheduledDate), new Date(wo._lastCompletedDate)) <= wo._frequencyDays
    );
    // Próxima fecha real: si está cubierto, recalcular desde lastCompletedDate + frequencyDays
    const nextScheduledDate = (isCoveredByLastExecution && wo._lastCompletedDate && wo._frequencyDays)
      ? addDays(new Date(wo._lastCompletedDate), wo._frequencyDays).toISOString()
      : wo.scheduledDate;
    const isOverdue = wo.status === 'PENDING' && nextScheduledDate && isBefore(new Date(nextScheduledDate), new Date());
    const daysUntil = nextScheduledDate ? differenceInDays(new Date(nextScheduledDate), new Date()) : null;

    if (viewMode === 'list') {
      return (
        <div
          key={wo.id}
          onClick={() => handleItemClick(wo)}
          className={cn(
            'group relative flex items-start gap-3 p-3 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-sm hover:border-primary/30',
            isOverdue && 'border-destructive/30 bg-destructive/5'
          )}
        >
          {/* Borde izquierdo de color */}
          <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', isOverdue ? 'bg-destructive' : 'bg-primary/60')} />

          <div className="ml-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <p className="font-semibold text-sm">{wo.title}</p>
              {isOverdue && <Badge variant="destructive" className="text-xs h-5 px-1 shrink-0">Vencida</Badge>}
              {getPriorityBadge(wo.priority)}
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                {wo.status === 'PENDING' && canCreateMaintenance && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2 gap-1"
                    onClick={(e) => handleExecuteClick(wo, e)}
                  >
                    <PlayCircle className="h-3 w-3" />
                    Ejecutar
                  </Button>
                )}
                <Badge className={cn(statusCfg.className, 'text-xs border gap-1')}>
                  {statusCfg.icon}
                  {statusCfg.label}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {wo._frequencyDays && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Cada {wo._frequencyDays}d
                </span>
              )}
              {(wo._lastCompletedDate || nextScheduledDate) && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {wo._lastCompletedDate && (
                    <span className="text-muted-foreground">
                      Ult vez {format(new Date(wo._lastCompletedDate), 'EEE dd/MM/yyyy', { locale: es })}
                    </span>
                  )}
                  {wo._lastCompletedDate && nextScheduledDate && (
                    <span className="text-muted-foreground/50">·</span>
                  )}
                  {nextScheduledDate && (
                    <span className={cn('font-medium',
                      isOverdue ? 'text-destructive' : daysUntil !== null && daysUntil <= 7 ? 'text-warning-muted-foreground' : ''
                    )}>
                      Próx {format(new Date(nextScheduledDate), 'dd/MM/yyyy', { locale: es })}
                      {daysUntil !== null && wo.status === 'PENDING' && (
                        <span className="ml-1 font-normal">
                          ({daysUntil < 0 ? `${Math.abs(daysUntil)}d vencido` : daysUntil === 0 ? 'hoy' : `en ${daysUntil}d`})
                        </span>
                      )}
                    </span>
                  )}
                </span>
              )}
              {wo.assignedTo && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {wo.assignedTo.name}
                </span>
              )}
              {wo.component && (
                <span className="flex items-center gap-1">
                  <Box className="h-3 w-3" />
                  {wo.component.name}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <Card
        key={wo.id}
        onClick={() => handleItemClick(wo)}
        className={cn(
          'group relative overflow-hidden cursor-pointer transition-all hover:shadow-md',
          isOverdue ? 'border-destructive/30' : 'hover:border-primary/30'
        )}
      >
        {/* Barra superior de color */}
        <div className={cn('h-1', isOverdue ? 'bg-destructive' : 'bg-primary/50')} />
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <Badge className={cn(statusCfg.className, 'text-xs border')}>
              {statusCfg.label}
            </Badge>
          </div>

          {/* Título */}
          <p className="font-semibold text-sm line-clamp-2 mb-2">{wo.title}</p>
          {getPriorityBadge(wo.priority)}

          {/* Frecuencia + fecha */}
          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {wo._frequencyDays && (
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 shrink-0" />
                <span>Cada {wo._frequencyDays} días</span>
              </div>
            )}
            {wo._lastCompletedDate && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3 shrink-0 text-success" />
                <span>Ult vez {format(new Date(wo._lastCompletedDate), 'EEE dd/MM/yyyy', { locale: es })}</span>
              </div>
            )}
            {nextScheduledDate && (
              <div className={cn('flex items-center justify-between',
                isOverdue ? 'text-destructive' : daysUntil !== null && daysUntil <= 7 ? 'text-warning-muted-foreground' : ''
              )}>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 shrink-0" />
                  Próx {format(new Date(nextScheduledDate), 'dd/MM/yyyy', { locale: es })}
                </span>
                {daysUntil !== null && wo.status === 'PENDING' && (
                  <span className="font-semibold text-xs">
                    {daysUntil < 0 ? `${Math.abs(daysUntil)}d vencido` : daysUntil === 0 ? 'Hoy' : `${daysUntil}d`}
                  </span>
                )}
              </div>
            )}
            {wo.assignedTo && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{wo.assignedTo.name}</span>
              </div>
            )}
          </div>

          {wo.component && (
            <div className="mt-3 pt-2.5 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
              <Box className="h-3 w-3" />
              {wo.component.name}
            </div>
          )}

          {wo.status === 'PENDING' && canCreateMaintenance && (
            <div className="mt-3 pt-2.5 border-t">
              <Button
                size="sm"
                className="w-full h-7 text-xs gap-1.5"
                onClick={(e) => handleExecuteClick(wo, e)}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Ejecutar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Card correctivo ──────────────────────────────────────────────────────

  const renderCorrectiveCard = (wo: any) => {
    const statusCfg = getStatusConfig(wo.status);
    const isOverdue = wo.status === 'PENDING' && wo.scheduledDate && isBefore(new Date(wo.scheduledDate), new Date());
    const daysUntil = wo.scheduledDate ? differenceInDays(new Date(wo.scheduledDate), new Date()) : null;
    const accentColor = wo.status === 'COMPLETED' ? 'bg-success' : isOverdue ? 'bg-destructive' : 'bg-amber-500';

    if (viewMode === 'list') {
      return (
        <div
          key={wo.id}
          onClick={() => handleItemClick(wo)}
          className={cn(
            'group relative flex items-start gap-3 p-3 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-sm hover:border-warning-muted/50',
            isOverdue && 'border-destructive/30 bg-destructive/5'
          )}
        >
          <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', accentColor)} />

          <div className="ml-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <p className="font-semibold text-sm">{wo.title}</p>
              {isOverdue && <Badge variant="destructive" className="text-xs h-5 px-1 shrink-0">Vencida</Badge>}
              {getPriorityBadge(wo.priority)}
              <Badge className={cn(statusCfg.className, 'text-xs border gap-1 ml-auto shrink-0')}>
                {statusCfg.icon}
                {statusCfg.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {wo.scheduledDate && (
                <span className={cn('flex items-center gap-1', isOverdue && 'text-destructive font-medium')}>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(wo.scheduledDate), 'dd MMM yyyy', { locale: es })}
                  {daysUntil !== null && wo.status === 'PENDING' && (
                    <span className="ml-1">({daysUntil < 0 ? `${Math.abs(daysUntil)}d vencido` : `en ${daysUntil}d`})</span>
                  )}
                </span>
              )}
              {wo.assignedTo && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {wo.assignedTo.name}
                </span>
              )}
              {wo.component && (
                <span className="flex items-center gap-1">
                  <Box className="h-3 w-3" />
                  {wo.component.name}
                </span>
              )}
              {wo.completedAt && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {format(new Date(wo.completedAt), 'dd MMM yyyy', { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <Card
        key={wo.id}
        onClick={() => handleItemClick(wo)}
        className={cn(
          'group relative overflow-hidden cursor-pointer transition-all hover:shadow-md',
          isOverdue ? 'border-destructive/30' : 'hover:border-warning-muted/50'
        )}
      >
        <div className={cn('h-1', accentColor)} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-warning-muted/50 flex items-center justify-center shrink-0">
              <Wrench className="h-4 w-4 text-warning-muted-foreground" />
            </div>
            <Badge className={cn(statusCfg.className, 'text-xs border')}>
              {statusCfg.label}
            </Badge>
          </div>

          <p className="font-semibold text-sm line-clamp-2 mb-2">{wo.title}</p>
          {getPriorityBadge(wo.priority)}

          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {wo.scheduledDate && (
              <div className={cn('flex items-center justify-between', isOverdue && 'text-destructive')}>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(wo.scheduledDate), 'dd MMM yyyy', { locale: es })}
                </span>
                {daysUntil !== null && wo.status === 'PENDING' && (
                  <span className="font-semibold text-xs">
                    {daysUntil < 0 ? `${Math.abs(daysUntil)}d` : `${daysUntil}d`}
                  </span>
                )}
              </div>
            )}
            {wo.assignedTo && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                <span className="truncate">{wo.assignedTo.name}</span>
              </div>
            )}
            {wo.completedAt && (
              <div className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Completado {format(new Date(wo.completedAt), 'dd MMM', { locale: es })}</span>
              </div>
            )}
          </div>

          {wo.component && (
            <div className="mt-3 pt-2.5 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
              <Box className="h-3 w-3" />
              {wo.component.name}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ─── Timeline de historial ────────────────────────────────────────────────

  const renderHistoryTimeline = () => {
    if (filteredHistory.length === 0) {
      return renderEmptyState('No hay ejecuciones registradas', 'Las ejecuciones aparecerán aquí cuando se completen mantenimientos');
    }

    return (
      <div className="relative space-y-0">
        {/* Línea vertical del timeline */}
        <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-border" />

        {filteredHistory.map((item: any, index: number) => {
          const isPreventive = item.maintenanceType === 'PREVENTIVE' || item.work_orders?.type === 'PREVENTIVE';
          const hasIssues = item.rootCause || item.issues;
          const qualityScore = item.qualityScore;
          // actualDuration viene en minutos desde la API
          const durationMinutes = item.actualDuration ?? (item.duration ? item.duration * 60 : null);
          const executedByName = item.assignedToName || item.User?.name;

          return (
            <div key={item.id} className="relative flex gap-4 pb-4 last:pb-0">
              {/* Dot del timeline */}
              <div className={cn(
                'relative z-10 h-7 w-7 rounded-full border-2 border-background flex items-center justify-center shrink-0 mt-1',
                isPreventive ? 'bg-primary' : 'bg-amber-500'
              )}>
                {isPreventive
                  ? <CalendarDays className="h-3.5 w-3.5 text-white" />
                  : <Wrench className="h-3.5 w-3.5 text-white" />
                }
              </div>

              {/* Contenido */}
              <div className={cn(
                'flex-1 rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow',
                hasIssues && 'border-warning-muted/50'
              )}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {item.title || item.work_orders?.title || 'Mantenimiento ejecutado'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(item.executedAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {qualityScore !== null && qualityScore !== undefined && (
                      <Tooltip>
                        <TooltipTrigger>
                          <div className={cn(
                            'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                            qualityScore >= 80 ? 'bg-success-muted text-success' : qualityScore >= 50 ? 'bg-warning-muted text-warning-muted-foreground' : 'bg-destructive/10 text-destructive'
                          )}>
                            <Award className="h-3 w-3" />
                            {qualityScore}%
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Calidad de ejecución</TooltipContent>
                      </Tooltip>
                    )}
                    <Badge variant="secondary" className="text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      Ejecutado
                    </Badge>
                  </div>
                </div>

                {/* Métricas */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
                  {durationMinutes != null && durationMinutes > 0 && (
                    <span className="flex items-center gap-1.5 font-medium">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      {durationMinutes < 60 ? `${Math.round(durationMinutes)} min` : `${(durationMinutes / 60).toFixed(1)}h`}
                    </span>
                  )}
                  {executedByName && (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {executedByName}
                    </span>
                  )}
                  {(item.Component?.name || item.componentName) && (
                    <span className="flex items-center gap-1.5">
                      <Box className="h-3.5 w-3.5" />
                      {item.Component?.name || item.componentName}
                    </span>
                  )}
                  {item.cost != null && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Costo:</span>
                      <span className="font-medium">${formatNumber(Number(item.cost), 0)}</span>
                    </span>
                  )}
                </div>

                {/* Notas */}
                {item.notes && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 mb-2 italic border-l-2 border-border">
                    &ldquo;{item.notes}&rdquo;
                  </div>
                )}

                {/* Problemas */}
                {hasIssues && (
                  <div className="flex items-start gap-2 text-xs bg-warning-muted/30 rounded-lg p-2.5 border border-warning-muted/40">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-warning-muted-foreground">Problemas encontrados: </span>
                      <span className="text-muted-foreground">{item.rootCause || item.issues}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Empty state ──────────────────────────────────────────────────────────

  const renderEmptyState = (title: string, subtitle?: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-7 w-7 opacity-40" />
      </div>
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs">{subtitle || 'Los registros aparecerán aquí'}</p>
    </div>
  );

  if (isLoading && !workOrdersError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando mantenimientos...</p>
        </div>
      </div>
    );
  }

  // ─── KPI Cards ────────────────────────────────────────────────────────────

  const renderKPIs = () => {
    if (activeSubTab === 'preventive') {
      return (
        <div className="grid grid-cols-4 gap-1 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-3">
          <Card className="overflow-hidden">
            <CardContent className="p-1.5 sm:p-4">
              <div className="flex items-start sm:items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">Total planes</p>
                  <p className="text-sm sm:text-2xl font-bold text-primary">{preventiveStats.total}</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-full bg-primary/10 items-center justify-center shrink-0">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn('overflow-hidden', preventiveStats.pending + preventiveStats.inProgress > 0 && 'border-warning-muted/60')}>
            <CardContent className="p-1.5 sm:p-4">
              <div className="flex items-start sm:items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">Pendientes</p>
                  <p className={cn('text-sm sm:text-2xl font-bold', preventiveStats.pending + preventiveStats.inProgress > 0 ? 'text-warning-muted-foreground' : 'text-foreground')}>
                    {preventiveStats.pending + preventiveStats.inProgress}
                  </p>
                  {preventiveStats.overdue > 0 && (
                    <p className="hidden sm:block text-xs text-destructive font-medium mt-0.5">{preventiveStats.overdue} vencidas</p>
                  )}
                </div>
                <div className={cn('hidden sm:flex h-10 w-10 rounded-full items-center justify-center shrink-0', preventiveStats.pending + preventiveStats.inProgress > 0 ? 'bg-warning-muted/50' : 'bg-muted')}>
                  <Clock className={cn('h-5 w-5', preventiveStats.pending + preventiveStats.inProgress > 0 ? 'text-warning-muted-foreground' : 'text-muted-foreground')} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-1.5 sm:p-4">
              <div className="flex items-start sm:items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">Completados</p>
                  <p className="text-sm sm:text-2xl font-bold text-success">{preventiveStats.completed}</p>
                  <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">{filteredHistory.length} ejecuciones</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-full bg-success-muted items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn('overflow-hidden', preventiveStats.complianceRate < 70 && 'border-destructive/30')}>
            <CardContent className="p-1.5 sm:p-4">
              <div>
                <div className="flex items-center justify-between mb-0.5 sm:mb-2">
                  <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate">Cumplimiento</p>
                  <Target className={cn('h-3 w-3 sm:h-4 sm:w-4 shrink-0', preventiveStats.complianceRate >= 80 ? 'text-success' : 'text-warning-muted-foreground')} />
                </div>
                <p className={cn('text-sm sm:text-2xl font-bold sm:mb-2', preventiveStats.complianceRate >= 80 ? 'text-success' : preventiveStats.complianceRate >= 50 ? 'text-warning-muted-foreground' : 'text-destructive')}>
                  {preventiveStats.complianceRate}%
                </p>
                <Progress value={preventiveStats.complianceRate} className="h-1 sm:h-1.5 mt-1 sm:mt-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 gap-1 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-3">
        <Card className="overflow-hidden">
          <CardContent className="p-1.5 sm:p-4">
            <div className="flex items-start sm:items-center justify-between">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">Total OTs</p>
                <p className="text-sm sm:text-2xl font-bold text-warning-muted-foreground">{correctiveStats.total}</p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-warning-muted/50 items-center justify-center shrink-0">
                <Wrench className="h-5 w-5 text-warning-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('overflow-hidden', correctiveStats.pending > 0 && 'border-warning-muted/60')}>
          <CardContent className="p-1.5 sm:p-4">
            <div className="flex items-start sm:items-center justify-between">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">Pendientes</p>
                <p className={cn('text-sm sm:text-2xl font-bold', correctiveStats.pending > 0 ? 'text-warning-muted-foreground' : 'text-foreground')}>
                  {correctiveStats.pending}
                </p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-muted items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-1.5 sm:p-4">
            <div className="flex items-start sm:items-center justify-between">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">En progreso</p>
                <p className="text-sm sm:text-2xl font-bold text-info-muted-foreground">{correctiveStats.inProgress}</p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-info-muted items-center justify-center shrink-0">
                <PlayCircle className="h-5 w-5 text-info-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-1.5 sm:p-4">
            <div className="flex items-start sm:items-center justify-between">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight truncate mb-0.5 sm:mb-1">Completados</p>
                <p className="text-sm sm:text-2xl font-bold text-success">{correctiveStats.completed}</p>
                <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">{filteredHistory.length} ejecuciones</p>
              </div>
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-success-muted items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Sub-filtros ──────────────────────────────────────────────────────────

  const getSubFilters = () => {
    if (activeSubTab === 'preventive') {
      return [
        { key: 'all' as SubFilter, label: 'Todos', count: preventiveOrders.length },
        { key: 'pending' as SubFilter, label: 'Pendientes', count: preventivePending.length },
        { key: 'history' as SubFilter, label: 'Ejecuciones', count: filteredHistory.length },
      ];
    }
    return [
      { key: 'all' as SubFilter, label: 'Todos', count: correctiveOrders.length },
      { key: 'pending' as SubFilter, label: 'Pendientes', count: correctivePending.length },
      { key: 'history' as SubFilter, label: 'Ejecuciones', count: filteredHistory.length },
    ];
  };

  // ─── Render principal ─────────────────────────────────────────────────────

  function renderTabContent() {
    const subFilters = getSubFilters();
    const renderCard = activeSubTab === 'preventive' ? renderPreventiveCard : renderCorrectiveCard;

    return (
      <>
        {renderKPIs()}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-3 sm:px-4 py-2 border-t border-b bg-muted/20">
          {/* Sub-filtros */}
          <div className="flex items-center justify-center sm:justify-start gap-1 overflow-x-auto">
            {subFilters.map(f => (
              <button
                key={f.key}
                onClick={() => { setSubFilter(f.key); setSearchTerm(''); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  subFilter === f.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={cn(
                    'inline-flex h-5 min-w-[1rem] items-center justify-center rounded-full px-1 text-xs font-bold',
                    subFilter === f.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Controles derecha */}
          <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:ml-auto">
            {/* Filtro componente */}
            {!componentId && components.length > 0 && (
              <Select value={componentFilter} onValueChange={setComponentFilter}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="Componente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {components.map((comp: any) => (
                    <SelectItem key={comp.id} value={comp.id.toString()}>{comp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* View toggle - solo cuando no es historial */}
            {subFilter !== 'history' && (
              <div className="flex items-center border rounded-lg p-0.5 gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded', viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted/50')}>
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Vista lista</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded', viewMode === 'grid' ? 'bg-muted' : 'hover:bg-muted/50')}>
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Vista grilla</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Sin duplicados */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHideDuplicates(!hideDuplicates)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    hideDuplicates ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                  )}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{hideDuplicates ? 'Sin duplicados activo' : 'Mostrar duplicados'}</TooltipContent>
            </Tooltip>

            {/* Crear */}
            {canCreateMaintenance && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => activeSubTab === 'preventive' ? setShowPreventiveDialog(true) : setShowCorrectiveDialog(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {activeSubTab === 'preventive' ? 'Nuevo Preventivo' : 'Nuevo Correctivo'}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Búsqueda en historial */}
        {subFilter === 'history' && (
          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en ejecuciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-3 sm:px-4 py-3">
            {subFilter === 'history' ? (
              renderHistoryTimeline()
            ) : filteredData.length === 0 ? (
              renderEmptyState(
                subFilter === 'pending'
                  ? 'No hay órdenes pendientes'
                  : activeSubTab === 'preventive'
                    ? 'No hay mantenimientos preventivos'
                    : 'No hay mantenimientos correctivos',
                canCreateMaintenance ? `Creá el primero con el botón "Nuevo ${activeSubTab === 'preventive' ? 'Preventivo' : 'Correctivo'}"` : undefined
              )
            ) : (
              <div className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
                  : 'space-y-2'
              )}>
                {filteredData.map(renderCard)}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-x-hidden">
        <Tabs
          value={activeSubTab}
          onValueChange={(v) => { setActiveSubTab(v as SubTab); setSubFilter('all'); setSearchTerm(''); }}
          className="flex flex-col h-full"
        >
          {/* Sub-tabs */}
          <div className="px-4 pt-3 pb-2 flex-shrink-0 flex justify-center">
            <TabsList className="w-fit h-7 bg-muted/50 border rounded-lg p-0.5 overflow-x-auto overflow-y-hidden hide-scrollbar">
              <TabsTrigger
                value="preventive"
                className="flex items-center justify-center gap-1.5 h-6 px-3 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-3 w-3 text-primary" />
                </div>
                <span>Preventivo</span>
                {preventiveOrders.length > 0 && (
                  <Badge className="ml-0.5 h-5 px-1 text-xs bg-primary text-primary-foreground border-0">
                    {preventiveOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="corrective"
                className="flex items-center justify-center gap-1.5 h-6 px-3 rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <div className="h-4 w-4 rounded bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Wrench className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <span>Correctivo</span>
                {correctiveOrders.length > 0 && (
                  <Badge className="ml-0.5 h-5 px-1 text-xs bg-amber-500 text-white border-0">
                    {correctiveOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preventive" className="mt-0 flex-1 flex flex-col min-h-0">
            {renderTabContent()}
          </TabsContent>
          <TabsContent value="corrective" className="mt-0 flex-1 flex flex-col min-h-0">
            {renderTabContent()}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {showPreventiveDialog && (
          <PreventiveMaintenanceDialog
            isOpen={showPreventiveDialog}
            onClose={() => setShowPreventiveDialog(false)}
            preselectedMachineId={machineId}
            preselectedComponentId={componentId}
            preselectedParentComponentId={parentComponentId}
            onSave={() => { setShowPreventiveDialog(false); refetch(); refetchWorkOrders(); }}
          />
        )}

        {showCorrectiveDialog && (
          <WorkOrderWizard
            isOpen={showCorrectiveDialog}
            onClose={() => setShowCorrectiveDialog(false)}
            preselectedMachine={{ id: machineId, name: machineName }}
            preselectedType="CORRECTIVE"
            onSubmit={async () => {
              setShowCorrectiveDialog(false);
              refetch();
            }}
          />
        )}

        {selectedWorkOrder && (
          <WorkOrderDetailDialog
            workOrder={selectedWorkOrder}
            isOpen={!!selectedWorkOrder}
            onOpenChange={(open) => { if (!open) { setSelectedWorkOrder(null); refetch(); } }}
          />
        )}

        {selectedPreventive && (
          <MaintenanceDetailDialog
            maintenance={selectedPreventive}
            isOpen={!!selectedPreventive}
            onClose={() => { setSelectedPreventive(null); refetch(); }}
            companyId={companyId}
          />
        )}

        <ExecuteMaintenanceDialog
          isOpen={executeDialogOpen}
          onClose={() => { setExecuteDialogOpen(false); setExecutingMaintenance(null); }}
          maintenance={executingMaintenance}
          onExecute={handleExecutionSubmit}
          isLoading={isExecuting}
        />
      </div>
    </TooltipProvider>
  );
}
