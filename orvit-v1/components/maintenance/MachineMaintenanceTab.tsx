'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Calendar,
  Clock,
  CheckCircle,
  Search,
  Plus,
  Wrench,
  FileText,
  Loader2,
  CalendarDays,
  ChevronDown,
  AlertCircle,
  Box,
  User,
  TrendingUp,
  Timer,
  BarChart3,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRight,
  History,
  Zap,
  Target,
  ClipboardList,
  LayoutGrid,
  List,
  CalendarRange,
  Copy,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMachineMaintenanceHistory, useMachineWorkOrders, useMachineComponents } from '@/hooks/use-machine-detail';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import PreventiveMaintenanceDialog from '../work-orders/PreventiveMaintenanceDialog';
import CorrectiveMaintenanceDialog from '../work-orders/CorrectiveMaintenanceDialog';
import { WorkOrderDetailDialog } from '../work-orders/WorkOrderDetailDialog';
import WorkOrderWizard from '../work-orders/WorkOrderWizard';
import MaintenanceDetailDialog from './MaintenanceDetailDialog';

interface MachineMaintenanceTabProps {
  machineId: number;
  machineName: string;
  sectorId?: number;
  companyId: number;
  sectorName?: string;
}

type FilterType = 'all' | 'pending' | 'preventive' | 'corrective' | 'history';
type ViewMode = 'grid' | 'list' | 'timeline';

export default function MachineMaintenanceTab({
  machineId,
  machineName,
  sectorId,
  companyId: propCompanyId,
  sectorName
}: MachineMaintenanceTabProps) {
  // Fallback para companyId: usar localStorage si no viene en props
  const companyId = propCompanyId || (typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('currentCompany') || '{}').id
    : null);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreventiveDialog, setShowPreventiveDialog] = useState(false);
  const [showCorrectiveDialog, setShowCorrectiveDialog] = useState(false);
  const [showWorkOrderWizard, setShowWorkOrderWizard] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
  const [selectedPreventive, setSelectedPreventive] = useState<any>(null);
  const [hideDuplicates, setHideDuplicates] = useState(true);

  const { maintenanceHistory, isLoading: historyLoading, refetch } = useMachineMaintenanceHistory(
    machineId,
    true,
    companyId,
    sectorId
  );
  const { workOrders, isLoading: workOrdersLoading } = useMachineWorkOrders(
    machineId,
    true,
    companyId,
    sectorId
  );
  const { components } = useMachineComponents(machineId, true);

  const { hasPermission: canCreateMaintenance } = usePermissionRobust('crear_mantenimiento');

  // Filtrar por componente
  const filteredByComponent = useMemo(() => {
    if (componentFilter === 'all') return workOrders;
    return workOrders.filter((wo: any) =>
      wo.component?.id?.toString() === componentFilter ||
      wo.componentId?.toString() === componentFilter
    );
  }, [workOrders, componentFilter]);

  // Filtrar duplicados por nombre (mantener solo el primero de cada nombre)
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

  // Estadísticas
  const stats = useMemo(() => {
    const all = filteredByComponent;
    const preventive = all.filter((wo: any) => wo.type === 'PREVENTIVE');
    const corrective = all.filter((wo: any) => wo.type === 'CORRECTIVE');
    const pending = all.filter((wo: any) => wo.status === 'PENDING');
    const inProgress = all.filter((wo: any) => wo.status === 'IN_PROGRESS');
    const completed = all.filter((wo: any) => wo.status === 'COMPLETED');
    const overdue = pending.filter((wo: any) =>
      wo.scheduledDate && isBefore(new Date(wo.scheduledDate), new Date())
    );

    // Próximo mantenimiento
    const nextScheduled = all
      .filter((wo: any) => wo.status === 'PENDING' && wo.scheduledDate)
      .sort((a: any, b: any) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())[0];

    // Calcular tasa de cumplimiento
    const totalScheduled = all.filter((wo: any) => wo.scheduledDate).length;
    const completedOnTime = completed.filter((wo: any) => {
      if (!wo.scheduledDate || !wo.completedAt) return false;
      return isBefore(new Date(wo.completedAt), addDays(new Date(wo.scheduledDate), 1));
    }).length;
    const complianceRate = totalScheduled > 0 ? Math.round((completedOnTime / totalScheduled) * 100) : 100;

    return {
      total: all.length,
      preventive: preventive.length,
      corrective: corrective.length,
      pending: pending.length,
      inProgress: inProgress.length,
      completed: completed.length,
      overdue: overdue.length,
      nextScheduled,
      complianceRate,
      historyCount: maintenanceHistory.length,
    };
  }, [filteredByComponent, maintenanceHistory]);

  // Filtros específicos (usando datos sin duplicados)
  const preventiveOrders = useMemo(() =>
    filteredWithoutDuplicates.filter((wo: any) => wo.type === 'PREVENTIVE'),
    [filteredWithoutDuplicates]
  );

  const correctiveOrders = useMemo(() =>
    filteredWithoutDuplicates.filter((wo: any) => wo.type === 'CORRECTIVE'),
    [filteredWithoutDuplicates]
  );

  const pendingOrders = useMemo(() =>
    filteredWithoutDuplicates.filter((wo: any) => wo.status === 'PENDING' || wo.status === 'IN_PROGRESS'),
    [filteredWithoutDuplicates]
  );

  // Filtrar historial
  const filteredHistory = useMemo(() => {
    let history = maintenanceHistory;

    if (componentFilter !== 'all') {
      history = history.filter((item: any) =>
        item.Component?.id?.toString() === componentFilter ||
        item.componentId?.toString() === componentFilter
      );
    }

    if (!searchTerm) return history;
    const term = searchTerm.toLowerCase();
    return history.filter((item: any) =>
      item.work_orders?.title?.toLowerCase().includes(term) ||
      item.notes?.toLowerCase().includes(term) ||
      item.rootCause?.toLowerCase().includes(term)
    );
  }, [maintenanceHistory, searchTerm, componentFilter]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    switch (activeFilter) {
      case 'pending':
        return pendingOrders;
      case 'preventive':
        return preventiveOrders;
      case 'corrective':
        return correctiveOrders;
      case 'history':
        return [];
      default:
        return filteredWithoutDuplicates;
    }
  }, [activeFilter, filteredWithoutDuplicates, pendingOrders, preventiveOrders, correctiveOrders]);

  const isLoading = historyLoading || workOrdersLoading;

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
      'PENDING': {
        label: 'Pendiente',
        icon: <Clock className="h-3 w-3" />,
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200'
      },
      'IN_PROGRESS': {
        label: 'En Progreso',
        icon: <PlayCircle className="h-3 w-3" />,
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200'
      },
      'COMPLETED': {
        label: 'Completado',
        icon: <CheckCircle2 className="h-3 w-3" />,
        color: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200'
      },
      'CANCELLED': {
        label: 'Cancelado',
        icon: <XCircle className="h-3 w-3" />,
        color: 'text-gray-600',
        bg: 'bg-gray-50',
        border: 'border-gray-200'
      }
    };
    return config[status] || { label: status, icon: null, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  // Handler para abrir el detalle correcto según el tipo de ítem
  const handleItemClick = (item: any) => {
    // Si es un template de preventivo, abrir el modal de preventivo
    if (item._isPreventiveTemplate && item._templateId) {
      setSelectedPreventive({
        id: item._templateId,
        title: item.title,
        description: item.description,
        priority: item.priority,
        frequencyDays: item._frequencyDays,
        estimatedHours: item.estimatedHours,
        machineId: item.machineId,
        scheduledDate: item.scheduledDate,
        assignedTo: item.assignedTo,
        component: item.component,
      });
    } else {
      // Es una orden de trabajo real
      setSelectedWorkOrder(item);
    }
  };

  // Card de OT - Diseño mejorado
  const renderWorkOrderCard = (wo: any) => {
    const statusConfig = getStatusConfig(wo.status);
    const isPreventive = wo.type === 'PREVENTIVE';
    const isOverdue = wo.status === 'PENDING' && wo.scheduledDate && isBefore(new Date(wo.scheduledDate), new Date());
    const daysUntil = wo.scheduledDate ? differenceInDays(new Date(wo.scheduledDate), new Date()) : null;

    if (viewMode === 'list') {
      return (
        <div
          key={wo.id}
          onClick={() => handleItemClick(wo)}
          className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer ${
            isOverdue ? 'border-red-300 bg-red-50/50' : ''
          }`}
        >
          {/* Indicador tipo */}
          <div className={`w-1 h-10 rounded-full ${isPreventive ? 'bg-blue-500' : 'bg-orange-500'}`} />

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{wo.title}</p>
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1">
                  Vencida
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              {wo.scheduledDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(wo.scheduledDate), 'dd MMM', { locale: es })}
                </span>
              )}
              {wo.assignedTo && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {wo.assignedTo.name?.split(' ')[0]}
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

          {/* Status */}
          <Badge className={`${statusConfig.bg} ${statusConfig.color} border-0 text-[10px]`}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.label}</span>
          </Badge>

          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      );
    }

    // Vista Grid (default)
    return (
      <Card
        key={wo.id}
        onClick={() => handleItemClick(wo)}
        className={`group cursor-pointer transition-all hover:shadow-md ${
          isOverdue ? 'border-red-300 bg-red-50/30' : 'hover:border-primary/30'
        }`}
      >
        <CardContent className="p-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isPreventive ? 'bg-blue-500' : 'bg-orange-500'}`} />
              <span className={`text-[10px] font-medium ${isPreventive ? 'text-blue-600' : 'text-orange-600'}`}>
                {isPreventive ? 'Preventivo' : 'Correctivo'}
              </span>
            </div>
            <Badge className={`${statusConfig.bg} ${statusConfig.color} border-0 text-[10px] h-5`}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Título */}
          <p className="font-medium text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{wo.title}</p>

          {/* Indicador de prioridad */}
          {wo.priority && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(wo.priority)}`} />
              <span className="text-[10px] text-muted-foreground capitalize">
                {wo.priority?.toLowerCase()}
              </span>
            </div>
          )}

          {/* Meta info */}
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            {wo.scheduledDate && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(wo.scheduledDate), 'dd MMM yyyy', { locale: es })}
                </span>
                {daysUntil !== null && wo.status === 'PENDING' && (
                  <span className={`font-medium ${
                    daysUntil < 0 ? 'text-red-600' : daysUntil <= 3 ? 'text-amber-600' : 'text-muted-foreground'
                  }`}>
                    {daysUntil < 0 ? `${Math.abs(daysUntil)}d vencido` : daysUntil === 0 ? 'Hoy' : `${daysUntil}d`}
                  </span>
                )}
              </div>
            )}
            {wo.assignedTo && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="truncate">{wo.assignedTo.name}</span>
              </div>
            )}
          </div>

          {/* Footer con componente */}
          {wo.component && (
            <div className="mt-2 pt-2 border-t">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Box className="h-3 w-3" />
                {wo.component.name}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Card de historial mejorada
  const renderHistoryCard = (item: any) => {
    const isPreventive = item.work_orders?.type === 'PREVENTIVE';

    if (viewMode === 'list') {
      return (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card/50"
        >
          <div className={`w-1 h-10 rounded-full ${isPreventive ? 'bg-blue-300' : 'bg-orange-300'}`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {item.work_orders?.title || 'Mantenimiento'}
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{format(new Date(item.executedAt), 'dd MMM yyyy', { locale: es })}</span>
              {item.duration && <span>{item.duration}h</span>}
              {item.User && <span>{item.User.name?.split(' ')[0]}</span>}
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ejecutado
          </Badge>
        </div>
      );
    }

    return (
      <Card key={item.id} className="bg-card/50">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isPreventive ? 'bg-blue-300' : 'bg-orange-300'}`} />
              <span className={`text-[10px] font-medium ${isPreventive ? 'text-blue-500' : 'text-orange-500'}`}>
                {isPreventive ? 'Preventivo' : 'Correctivo'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(item.executedAt), 'dd/MM/yy', { locale: es })}
            </span>
          </div>
          <p className="font-medium text-sm line-clamp-2 mb-2">
            {item.work_orders?.title || 'Mantenimiento'}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {item.duration && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {item.duration}h
              </span>
            )}
            {item.User && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.User.name?.split(' ')[0]}
              </span>
            )}
          </div>
          {item.notes && (
            <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 italic">
              "{item.notes}"
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = (message: string) => (
    <div className="col-span-2 flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <FileText className="h-6 w-6 opacity-50" />
      </div>
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs mt-1">Los registros aparecerán aquí</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Cargando mantenimientos...</p>
        </div>
      </div>
    );
  }

  const filters: { key: FilterType; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Todos', count: filteredWithoutDuplicates.length, icon: <ClipboardList className="h-3 w-3" /> },
    { key: 'pending', label: 'Pendientes', count: pendingOrders.length, icon: <Clock className="h-3 w-3" /> },
    { key: 'preventive', label: 'Preventivos', count: preventiveOrders.length, icon: <CalendarDays className="h-3 w-3" /> },
    { key: 'corrective', label: 'Correctivos', count: correctiveOrders.length, icon: <Wrench className="h-3 w-3" /> },
    { key: 'history', label: 'Historial', count: stats.historyCount, icon: <History className="h-3 w-3" /> },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* KPI Cards - Estilo compacto horizontal */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-4 pb-2">
          {/* Total */}
          <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>

          {/* Activas/Pendientes */}
          <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Activas</p>
                <p className={`text-lg font-bold ${stats.pending + stats.inProgress > 0 ? 'text-amber-600' : ''}`}>
                  {stats.pending + stats.inProgress}
                </p>
              </div>
            </div>
          </Card>

          {/* Preventivos */}
          <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Preventivos</p>
                <p className="text-lg font-bold text-blue-600">{stats.preventive}</p>
              </div>
            </div>
          </Card>

          {/* Correctivos */}
          <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Correctivos</p>
                <p className="text-lg font-bold text-orange-600">{stats.corrective}</p>
              </div>
            </div>
          </Card>

          {/* Completados */}
          <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Completados</p>
                <p className="text-lg font-bold text-green-600">{stats.completed}</p>
              </div>
            </div>
          </Card>

          {/* Vencidas */}
          <Card className="p-2 border-border/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Vencidas</p>
                <p className={`text-lg font-bold ${stats.overdue > 0 ? 'text-red-600' : ''}`}>{stats.overdue}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Próximo programado */}
        {stats.nextScheduled && activeFilter !== 'history' && (
          <div className="mx-4 mb-2">
            <div
              className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer hover:bg-primary/10 transition"
              onClick={() => setSelectedWorkOrder(stats.nextScheduled)}
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-primary">Próximo mantenimiento</p>
                <p className="text-sm truncate">{stats.nextScheduled.title}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-primary">
                  {format(new Date(stats.nextScheduled.scheduledDate!), 'dd MMM', { locale: es })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(stats.nextScheduled.scheduledDate!), { locale: es, addSuffix: true })}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 border-b overflow-hidden">
          {/* Filtros - scrollable en móvil */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {filters.map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`flex items-center gap-1 shrink-0 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                {filter.icon}
                <span className="text-[11px]">{filter.label}</span>
                {filter.count !== undefined && filter.count > 0 && (
                  <Badge
                    variant={activeFilter === filter.key ? 'secondary' : 'outline'}
                    className="h-4 px-1 text-[10px] ml-0.5"
                  >
                    {filter.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Controles derecha */}
          <div className="flex items-center gap-1.5 justify-between sm:justify-end shrink-0">
            {/* Filtro componente - oculto en móvil muy pequeño */}
            {components.length > 0 && (
              <Select value={componentFilter} onValueChange={setComponentFilter}>
                <SelectTrigger className="w-[90px] sm:w-[100px] h-8 text-xs shrink-0">
                  <Box className="h-3 w-3 mr-1 shrink-0" />
                  <SelectValue placeholder="Comp." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {components.map((comp: any) => (
                    <SelectItem key={comp.id} value={comp.id.toString()}>
                      {comp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* View toggle */}
            <div className="flex border rounded-lg p-0.5 gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Vista grilla</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-muted' : 'hover:bg-muted/50'}`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Vista lista</TooltipContent>
              </Tooltip>
            </div>

            {/* Filtro de duplicados */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHideDuplicates(!hideDuplicates)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                    hideDuplicates
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted border border-transparent'
                  }`}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Sin dup.</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {hideDuplicates ? 'Mostrando únicos por nombre' : 'Mostrar todos (incluyendo duplicados)'}
              </TooltipContent>
            </Tooltip>

            {/* Nueva OT */}
            {canCreateMaintenance && (
              <Button size="sm" className="h-8 text-xs gap-1 shrink-0 px-2 sm:px-3" onClick={() => setShowWorkOrderWizard(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nueva OT</span>
              </Button>
            )}
          </div>
        </div>

        {/* Search para historial */}
        {activeFilter === 'history' && (
          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en historial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Lista de OTs */}
        <ScrollArea className="flex-1 px-4 py-2">
          <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3' : 'space-y-2'}`}>
            {activeFilter === 'history' ? (
              filteredHistory.length === 0 ? (
                renderEmptyState('No hay historial de mantenimientos')
              ) : (
                filteredHistory.map(renderHistoryCard)
              )
            ) : (
              filteredData.length === 0 ? (
                renderEmptyState(
                  activeFilter === 'pending' ? 'No hay órdenes pendientes' :
                  activeFilter === 'preventive' ? 'No hay mantenimientos preventivos' :
                  activeFilter === 'corrective' ? 'No hay mantenimientos correctivos' :
                  'No hay órdenes de trabajo'
                )
              ) : (
                filteredData.map(renderWorkOrderCard)
              )
            )}
          </div>
        </ScrollArea>

        {/* Dialogs */}
        {showPreventiveDialog && (
          <PreventiveMaintenanceDialog
            isOpen={showPreventiveDialog}
            onClose={() => setShowPreventiveDialog(false)}
            preselectedMachineId={machineId}
            onSave={() => {
              setShowPreventiveDialog(false);
              refetch();
            }}
          />
        )}

        {showCorrectiveDialog && (
          <CorrectiveMaintenanceDialog
            isOpen={showCorrectiveDialog}
            onClose={() => setShowCorrectiveDialog(false)}
            preselectedMachineId={machineId}
            onSave={() => {
              setShowCorrectiveDialog(false);
              refetch();
            }}
          />
        )}

        {selectedWorkOrder && (
          <WorkOrderDetailDialog
            workOrder={selectedWorkOrder}
            isOpen={!!selectedWorkOrder}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedWorkOrder(null);
                refetch();
              }
            }}
          />
        )}

        {/* Work Order Wizard */}
        {showWorkOrderWizard && (
          <WorkOrderWizard
            isOpen={showWorkOrderWizard}
            onClose={() => setShowWorkOrderWizard(false)}
            preselectedMachine={{ id: machineId, name: machineName }}
            onSubmit={async (data) => {
              setShowWorkOrderWizard(false);
              refetch();
            }}
          />
        )}

        {/* Preventive Maintenance Detail Modal */}
        {selectedPreventive && (
          <MaintenanceDetailDialog
            maintenance={selectedPreventive}
            isOpen={!!selectedPreventive}
            onClose={() => {
              setSelectedPreventive(null);
              refetch();
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
