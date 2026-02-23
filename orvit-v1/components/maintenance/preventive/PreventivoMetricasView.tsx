'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover';
import {
 BarChart3,
 TrendingUp,
 TrendingDown,
 CheckCircle2,
 AlertTriangle,
 Clock,
 FileText,
 History,
 Shield,
 Download,
 Calendar as CalendarIcon,
 Percent,
 Timer,
 Target,
 Activity,
 Truck,
 ChevronRight,
 XCircle,
 CheckCircle,
 AlertCircle,
 SkipForward,
 Search,
 Filter,
 X,
 Users,
} from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateTime } from '@/lib/date-utils';

interface PreventivoMetricasViewProps {
 className?: string;
}

// Tipos
interface DateRange {
 from: Date | undefined;
 to: Date | undefined;
}

interface KPIData {
 totalMaintenances: number;
 completedOnTime: number;
 overdueMaintenance: number;
 avgCompletionTime: number;
 avgMTTR: number;
 avgMTBF: number;
 completionRate: number;
 costEfficiency: number;
 qualityScore: number;
 uptime: number;
 downtime: number;
 preventiveVsCorrective: {
 preventive: number;
 corrective: number;
 };
 trends: {
 monthlyCompletion: Array<{ month: string; completed: number }>;
 costTrend: Array<{ month: string; cost: number }>;
 failureFrequency: Array<{ machineId: number; machineName: string; failureCount: number }>;
 };
}

interface Machine {
 id: number;
 name: string;
 type?: string;
}

interface Component {
 id: number;
 name: string;
 machineId?: number;
}

interface ChecklistExecution {
 id: number;
 checklistId: number;
 checklistTitle: string;
 executedAt: string;
 executedBy: string;
 status: string;
 completedItems: number;
 totalItems: number;
 executionTime: number;
 justifications?: Array<{
 itemTitle: string;
 justification: string;
 skippedAt: string;
 }>;
}

interface CompletedMaintenance {
 id: number;
 title: string;
 type: string;
 status: string;
 completedDate: string;
 scheduledDate?: string;
 actualHours?: number;
 estimatedHours?: number;
 machine?: { id: number; name: string };
 unidadMovil?: { id: number; nombre: string };
 assignedToName?: string;
 isPreventive: boolean;
}

// Presets de fechas
const datePresets = [
 { label: 'Hoy', value: 'today' },
 { label: 'Esta semana', value: 'week' },
 { label: 'Este mes', value: 'month' },
 { label: 'Últimos 3 meses', value: '3months' },
 { label: 'Este año', value: 'year' },
 { label: 'Todo', value: 'all' },
];

// Función para obtener rango de fechas según preset
function getDateRangeFromPreset(preset: string): DateRange {
 const now = new Date();
 switch (preset) {
 case 'today':
 return { from: now, to: now };
 case 'week':
 return { from: startOfWeek(now, { locale: es }), to: endOfWeek(now, { locale: es }) };
 case 'month':
 return { from: startOfMonth(now), to: endOfMonth(now) };
 case '3months':
 return { from: subMonths(now, 3), to: now };
 case 'year':
 return { from: new Date(now.getFullYear(), 0, 1), to: now };
 case 'all':
 default:
 return { from: undefined, to: undefined };
 }
}

// Formatear duración
function formatDuration(minutes: number | null | undefined): string {
 if (!minutes || minutes === 0) return '—';

 const hours = Math.floor(minutes / 60);
 const mins = Math.round(minutes % 60);

 if (hours === 0) return `${mins}min`;
 if (mins === 0) return `${hours}h`;
 return `${hours}h ${mins}min`;
}


// Obtener color del badge de estado
function getStatusColor(status: string): string {
 switch (status?.toUpperCase()) {
 case 'COMPLETED':
 return 'bg-success-muted text-success-muted-foreground border-success-muted';
 case 'PARTIAL':
 return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
 case 'SKIPPED':
 return 'bg-destructive/10 text-destructive border-destructive/30';
 case 'IN_PROGRESS':
 return 'bg-info-muted text-info-muted-foreground border-info-muted';
 default:
 return 'bg-muted text-foreground border-border';
 }
}

// Traducir estado
function translateStatus(status: string): string {
 switch (status?.toUpperCase()) {
 case 'COMPLETED':
 return 'Completado';
 case 'PARTIAL':
 return 'Parcial';
 case 'SKIPPED':
 return 'Omitido';
 case 'IN_PROGRESS':
 return 'En progreso';
 default:
 return status || '—';
 }
}

/**
 * Vista "Métricas" del Preventivo - Completa con datos reales
 */
export function PreventivoMetricasView({ className }: PreventivoMetricasViewProps) {
 const { currentCompany, currentSector } = useCompany();
 const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
 const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

 // Estado
 const [subTab, setSubTab] = useState('kpis');
 const [datePreset, setDatePreset] = useState('month');
 const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('month'));
 const [selectedMachine, setSelectedMachine] = useState<string>('all');
 const [selectedComponent, setSelectedComponent] = useState<string>('all');
 const [searchTerm, setSearchTerm] = useState('');
 const [expandedExecution, setExpandedExecution] = useState<number | null>(null);

 // Contar filtros activos
 const activeFiltersCount = useMemo(() => {
 let count = 0;
 if (selectedMachine !== 'all') count++;
 if (selectedComponent !== 'all') count++;
 return count;
 }, [selectedMachine, selectedComponent]);

 // Cambiar preset de fecha
 const handleDatePresetChange = useCallback((preset: string) => {
 setDatePreset(preset);
 setDateRange(getDateRangeFromPreset(preset));
 }, []);

 // Query para máquinas
 const { data: machinesData } = useQuery<Machine[]>({
 queryKey: ['machines', companyId, sectorId],
 queryFn: async () => {
 const params = new URLSearchParams({ companyId: companyId!.toString() });
 if (sectorId) params.append('sectorId', sectorId.toString());
 const response = await fetch(`/api/machines?${params.toString()}`);
 if (!response.ok) return [];
 const data = await response.json();
 return data.machines || data || [];
 },
 enabled: !!companyId,
 staleTime: 300000,
 });

 // Query para componentes
 const { data: componentsData } = useQuery<Component[]>({
 queryKey: ['components', companyId, selectedMachine],
 queryFn: async () => {
 const params = new URLSearchParams({ companyId: companyId!.toString() });
 if (selectedMachine !== 'all') params.append('machineId', selectedMachine);
 const response = await fetch(`/api/components?${params.toString()}`);
 if (!response.ok) return [];
 const data = await response.json();
 return data.components || data || [];
 },
 enabled: !!companyId,
 staleTime: 300000,
 });

 // Limpiar componente cuando cambia la máquina
 const handleMachineChange = useCallback((value: string) => {
 setSelectedMachine(value);
 setSelectedComponent('all');
 }, []);

 // Limpiar filtros
 const clearFilters = useCallback(() => {
 setSelectedMachine('all');
 setSelectedComponent('all');
 }, []);

 // Query para KPIs
 const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpis } = useQuery<KPIData>({
 queryKey: ['maintenance-kpis', companyId, sectorId, dateRange.from, dateRange.to, selectedMachine, selectedComponent],
 queryFn: async () => {
 const params = new URLSearchParams({ companyId: companyId!.toString() });
 if (sectorId) params.append('sectorId', sectorId.toString());
 if (dateRange.from) params.append('startDate', dateRange.from.toISOString());
 if (dateRange.to) params.append('endDate', dateRange.to.toISOString());
 if (selectedMachine !== 'all') params.append('machineId', selectedMachine);
 if (selectedComponent !== 'all') params.append('componentId', selectedComponent);

 const response = await fetch(`/api/maintenance/kpis?${params.toString()}`);
 if (!response.ok) throw new Error('Error fetching KPIs');
 return response.json();
 },
 enabled: !!companyId,
 staleTime: 60000,
 });

 // Query para historial de ejecuciones de checklists
 const { data: checklistHistory, isLoading: historyLoading, refetch: refetchHistory } = useQuery<{
 history: ChecklistExecution[];
 hasMore: boolean;
 }>({
 queryKey: ['checklist-history', companyId, sectorId],
 queryFn: async () => {
 const params = new URLSearchParams({
 companyId: companyId!.toString(),
 pageSize: '50'
 });
 if (sectorId) params.append('sectorId', sectorId.toString());

 const response = await fetch(`/api/maintenance/checklists/history?${params.toString()}`);
 if (!response.ok) throw new Error('Error fetching history');
 return response.json();
 },
 enabled: !!companyId,
 staleTime: 30000,
 });

 // Query para mantenimientos completados
 const { data: completedData, isLoading: completedLoading, refetch: refetchCompleted } = useQuery<{
 maintenances: CompletedMaintenance[];
 }>({
 queryKey: ['maintenance-completed', companyId, sectorId, datePreset, selectedMachine, selectedComponent],
 queryFn: async () => {
 const params = new URLSearchParams({
 companyId: companyId!.toString(),
 timeFilter: datePreset,
 pageSize: '100'
 });
 if (sectorId) params.append('sectorId', sectorId.toString());
 if (selectedMachine !== 'all') params.append('machineId', selectedMachine);
 if (selectedComponent !== 'all') params.append('componentId', selectedComponent);

 const response = await fetch(`/api/maintenance/completed?${params.toString()}`);
 if (!response.ok) throw new Error('Error fetching completed');
 return response.json();
 },
 enabled: !!companyId,
 staleTime: 30000,
 });

 // Calcular métricas derivadas
 const derivedMetrics = useMemo(() => {
 const executions = checklistHistory?.history || [];
 const completed = completedData?.maintenances || [];

 // Estadísticas de ejecuciones
 const totalExecutions = executions.length;
 const completedExecutions = executions.filter(e => e.status === 'COMPLETED').length;
 const partialExecutions = executions.filter(e => e.status === 'PARTIAL').length;
 const skippedItems = executions.reduce((sum, e) => {
 return sum + (e.totalItems - e.completedItems);
 }, 0);
 const totalItems = executions.reduce((sum, e) => sum + e.totalItems, 0);

 // Tiempo promedio de ejecución
 const avgExecutionTime = executions.length > 0
 ? executions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / executions.length
 : 0;

 // Tasa de cumplimiento (items completados vs total)
 const itemCompletionRate = totalItems > 0
 ? (executions.reduce((sum, e) => sum + e.completedItems, 0) / totalItems) * 100
 : 0;

 // Distribución por responsable
 const byResponsible = executions.reduce((acc, e) => {
 const name = e.executedBy || 'Desconocido';
 acc[name] = (acc[name] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 // Top checklists más ejecutados
 const byChecklist = executions.reduce((acc, e) => {
 const title = e.checklistTitle || 'Sin título';
 acc[title] = (acc[title] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 // Preventivo vs Correctivo de completados
 const preventiveCount = completed.filter(m => m.isPreventive || m.type === 'PREVENTIVE').length;
 const correctiveCount = completed.filter(m => !m.isPreventive && m.type !== 'PREVENTIVE').length;

 return {
 totalExecutions,
 completedExecutions,
 partialExecutions,
 skippedItems,
 totalItems,
 avgExecutionTime,
 itemCompletionRate,
 byResponsible: Object.entries(byResponsible)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 10),
 byChecklist: Object.entries(byChecklist)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 10),
 preventiveCount,
 correctiveCount,
 completedCount: completed.length,
 };
 }, [checklistHistory, completedData]);

 // Filtrar ejecuciones
 const filteredExecutions = useMemo(() => {
 let executions = checklistHistory?.history || [];

 // Filtrar por búsqueda
 if (searchTerm) {
 const search = searchTerm.toLowerCase();
 executions = executions.filter(e =>
 e.checklistTitle?.toLowerCase().includes(search) ||
 e.executedBy?.toLowerCase().includes(search)
 );
 }

 // Filtrar por rango de fechas
 if (dateRange.from && dateRange.to) {
 executions = executions.filter(e => {
 const date = parseISO(e.executedAt);
 return isWithinInterval(date, { start: dateRange.from!, end: dateRange.to! });
 });
 }

 return executions;
 }, [checklistHistory, searchTerm, dateRange]);

 // Refrescar todos los datos
 const handleRefresh = useCallback(() => {
 refetchKpis();
 refetchHistory();
 refetchCompleted();
 }, [refetchKpis, refetchHistory, refetchCompleted]);

 // Exportar datos
 const handleExport = useCallback(() => {
 const executions = filteredExecutions;
 if (executions.length === 0) return;

 const csvContent = [
 ['Checklist', 'Ejecutado por', 'Fecha', 'Estado', 'Items Completados', 'Total Items', 'Tiempo (min)'].join(','),
 ...executions.map(e => [
 `"${e.checklistTitle}"`,
 `"${e.executedBy}"`,
 formatDateTime(e.executedAt),
 translateStatus(e.status),
 e.completedItems,
 e.totalItems,
 e.executionTime
 ].join(','))
 ].join('\n');

 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `metricas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
 link.click();
 }, [filteredExecutions]);

 // Estado de carga
 const isLoading = kpiLoading || historyLoading || completedLoading;

 if (!companyId) {
 return (
 <Card>
 <CardContent className="p-8 text-center">
 <AlertTriangle className="h-12 w-12 text-warning-muted-foreground mx-auto mb-4" />
 <p className="text-muted-foreground">Selecciona una empresa para ver las métricas</p>
 </CardContent>
 </Card>
 );
 }

 return (
 <div className={cn('space-y-4', className)}>
 {/* Header con tabs y período */}
 <Tabs value={subTab} onValueChange={setSubTab}>
 <div className="flex items-center justify-between gap-4">
 <TabsList className="max-w-md justify-start overflow-x-auto">
 <TabsTrigger value="kpis" className="gap-1.5">
 <BarChart3 className="h-3.5 w-3.5" />
 <span>KPIs</span>
 </TabsTrigger>
 <TabsTrigger value="ejecuciones" className="gap-1.5">
 <History className="h-3.5 w-3.5" />
 <span>Ejecuciones</span>
 </TabsTrigger>
 <TabsTrigger value="auditoria" className="gap-1.5">
 <Shield className="h-3.5 w-3.5" />
 <span>Auditoría</span>
 </TabsTrigger>
 </TabsList>

 {/* Controles a la derecha */}
 <div className="flex items-center gap-2">
 {/* Selector de período */}
 <Select value={datePreset} onValueChange={handleDatePresetChange}>
 <SelectTrigger className="w-[130px] h-8 text-sm border-dashed">
 <CalendarIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {datePresets.map(preset => (
 <SelectItem key={preset.value} value={preset.value}>
 {preset.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Filtros en popover */}
 <Popover>
 <PopoverTrigger asChild>
 <Button variant="outline" size="sm" className="h-8 border-dashed gap-1.5">
 <Filter className="h-3.5 w-3.5" />
 <span className="hidden sm:inline">Filtros</span>
 {activeFiltersCount > 0 && (
 <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs rounded-full">
 {activeFiltersCount}
 </Badge>
 )}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-72" align="end">
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label className="text-sm font-medium">Filtros</Label>
 {activeFiltersCount > 0 && (
 <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
 Limpiar
 </Button>
 )}
 </div>

 {/* Máquina */}
 {machinesData && machinesData.length > 0 && (
 <div className="space-y-1.5">
 <Label className="text-xs text-muted-foreground">Máquina</Label>
 <Select value={selectedMachine} onValueChange={handleMachineChange}>
 <SelectTrigger className="h-8 text-sm">
 <SelectValue placeholder="Todas" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todas las máquinas</SelectItem>
 {machinesData.map(machine => (
 <SelectItem key={machine.id} value={machine.id.toString()}>
 {machine.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Componente */}
 {componentsData && componentsData.length > 0 && (
 <div className="space-y-1.5">
 <Label className="text-xs text-muted-foreground">Componente</Label>
 <Select value={selectedComponent} onValueChange={setSelectedComponent}>
 <SelectTrigger className="h-8 text-sm">
 <SelectValue placeholder="Todos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los componentes</SelectItem>
 {componentsData.map(component => (
 <SelectItem key={component.id} value={component.id.toString()}>
 {component.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>
 </PopoverContent>
 </Popover>
 </div>
 </div>

 {/* Filtros activos */}
 {activeFiltersCount > 0 && (
 <div className="flex items-center gap-2 mt-2">
 {selectedMachine !== 'all' && (
 <Badge variant="secondary" className="text-xs gap-1">
 {machinesData?.find(m => m.id.toString() === selectedMachine)?.name}
 <button onClick={() => setSelectedMachine('all')} className="hover:text-destructive">
 <X className="h-3 w-3" />
 </button>
 </Badge>
 )}
 {selectedComponent !== 'all' && (
 <Badge variant="secondary" className="text-xs gap-1">
 {componentsData?.find(c => c.id.toString() === selectedComponent)?.name}
 <button onClick={() => setSelectedComponent('all')} className="hover:text-destructive">
 <X className="h-3 w-3" />
 </button>
 </Badge>
 )}
 </div>
 )}

 {/* KPIs */}
 <TabsContent value="kpis" className="space-y-4 mt-4">
 {isLoading ? (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {[1, 2, 3, 4].map(i => (
 <Card key={i}>
 <CardContent className="pt-4">
 <Skeleton className="h-20 w-full" />
 </CardContent>
 </Card>
 ))}
 </div>
 ) : (
 <>
 {/* KPIs principales */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {/* Tasa de cumplimiento */}
 <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-success-muted">
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-success font-medium">Cumplimiento</p>
 <p className="text-2xl font-bold text-success-muted-foreground">
 {formatNumber(derivedMetrics.itemCompletionRate, 1)}%
 </p>
 <p className="text-xs text-success flex items-center gap-1 mt-1">
 <Target className="h-3 w-3" />
 {derivedMetrics.totalItems - derivedMetrics.skippedItems}/{derivedMetrics.totalItems} items
 </p>
 </div>
 <div className="h-12 w-12 rounded-full bg-success-muted flex items-center justify-center">
 <CheckCircle2 className="h-6 w-6 text-success" />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Ejecuciones totales */}
 <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-info-muted">
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-info-muted-foreground font-medium">Ejecuciones</p>
 <p className="text-2xl font-bold text-info-muted-foreground">
 {derivedMetrics.totalExecutions}
 </p>
 <p className="text-xs text-info-muted-foreground flex items-center gap-1 mt-1">
 <Activity className="h-3 w-3" />
 {derivedMetrics.completedExecutions} completas
 </p>
 </div>
 <div className="h-12 w-12 rounded-full bg-info-muted flex items-center justify-center">
 <BarChart3 className="h-6 w-6 text-info-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Items omitidos */}
 <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-warning-muted">
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-warning-muted-foreground font-medium">Items Omitidos</p>
 <p className="text-2xl font-bold text-warning-muted-foreground">
 {derivedMetrics.skippedItems}
 </p>
 <p className="text-xs text-warning-muted-foreground flex items-center gap-1 mt-1">
 <SkipForward className="h-3 w-3" />
 {derivedMetrics.totalItems > 0
 ? formatNumber((derivedMetrics.skippedItems / derivedMetrics.totalItems) * 100, 1)
 : 0}% del total
 </p>
 </div>
 <div className="h-12 w-12 rounded-full bg-warning-muted flex items-center justify-center">
 <AlertTriangle className="h-6 w-6 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Tiempo promedio */}
 <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-purple-700 font-medium">Tiempo Prom.</p>
 <p className="text-2xl font-bold text-purple-900">
 {formatDuration(derivedMetrics.avgExecutionTime)}
 </p>
 <p className="text-xs text-purple-600 flex items-center gap-1 mt-1">
 <Timer className="h-3 w-3" />
 por ejecución
 </p>
 </div>
 <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
 <Clock className="h-6 w-6 text-purple-600" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Segunda fila de KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 {/* Preventivo vs Correctivo */}
 <Card>
 <CardContent className="pt-4">
 <p className="text-xs text-muted-foreground font-medium mb-3">Preventivo vs Correctivo</p>
 <div className="flex items-center gap-4">
 <div className="flex-1">
 <div className="flex justify-between text-xs mb-1">
 <span className="text-success">Preventivo</span>
 <span className="font-medium">{derivedMetrics.preventiveCount}</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-success-muted0 rounded-full"
 style={{
 width: `${derivedMetrics.completedCount > 0
 ? (derivedMetrics.preventiveCount / derivedMetrics.completedCount) * 100
 : 0}%`
 }}
 />
 </div>
 </div>
 <div className="flex-1">
 <div className="flex justify-between text-xs mb-1">
 <span className="text-destructive">Correctivo</span>
 <span className="font-medium">{derivedMetrics.correctiveCount}</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className="h-full bg-destructive/100 rounded-full"
 style={{
 width: `${derivedMetrics.completedCount > 0
 ? (derivedMetrics.correctiveCount / derivedMetrics.completedCount) * 100
 : 0}%`
 }}
 />
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Mantenimientos vencidos */}
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground font-medium">Vencidos</p>
 <p className="text-2xl font-bold text-destructive">
 {kpiData?.overdueMaintenance || 0}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 en el período
 </p>
 </div>
 <XCircle className="h-8 w-8 text-destructive/20" />
 </div>
 </CardContent>
 </Card>

 {/* A tiempo */}
 <Card>
 <CardContent className="pt-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground font-medium">Completados a tiempo</p>
 <p className="text-2xl font-bold text-success">
 {kpiData?.completedOnTime || 0}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {kpiData?.completionRate != null ? formatNumber(kpiData.completionRate, 1) : 0}% del total
 </p>
 </div>
 <CheckCircle className="h-8 w-8 text-success/20" />
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Métricas de Cumplimiento Preventivo */}
 {kpiData?.preventiveCompliance && (
 <Card className="border-primary/20">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Target className="h-4 w-4 text-primary" />
 Cumplimiento de Mantenimiento Preventivo
 <Badge variant="outline" className="ml-auto text-xs">
 Últimos 30 días
 </Badge>
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
 {/* Tasa de cumplimiento */}
 <div className="text-center p-3 bg-success-muted rounded-lg">
 <p className="text-2xl font-bold text-success">
 {kpiData.preventiveCompliance.complianceRate}%
 </p>
 <p className="text-xs text-success font-medium">A tiempo</p>
 </div>
 {/* Tasa de ejecución */}
 <div className="text-center p-3 bg-info-muted rounded-lg">
 <p className="text-2xl font-bold text-info-muted-foreground">
 {kpiData.preventiveCompliance.executionRate}%
 </p>
 <p className="text-xs text-info-muted-foreground font-medium">Ejecutados</p>
 </div>
 {/* Vencidos */}
 <div className="text-center p-3 bg-destructive/10 rounded-lg">
 <p className="text-2xl font-bold text-destructive">
 {kpiData.preventiveCompliance.overdue}
 </p>
 <p className="text-xs text-destructive font-medium">Vencidos</p>
 </div>
 {/* Pendientes */}
 <div className="text-center p-3 bg-warning-muted rounded-lg">
 <p className="text-2xl font-bold text-warning-muted-foreground">
 {kpiData.preventiveCompliance.pending}
 </p>
 <p className="text-xs text-warning-muted-foreground font-medium">Pendientes</p>
 </div>
 </div>

 {/* Barra de progreso visual */}
 <div className="space-y-2">
 <div className="flex justify-between text-xs">
 <span className="text-muted-foreground">
 {kpiData.preventiveCompliance.completed} de {kpiData.preventiveCompliance.totalScheduled} programados
 </span>
 <span className="font-medium">
 {kpiData.preventiveCompliance.completedOnTime} a tiempo · {kpiData.preventiveCompliance.completedLate} con retraso
 </span>
 </div>
 <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
 {/* A tiempo */}
 <div
 className="h-full bg-success-muted0 transition-all"
 style={{
 width: kpiData.preventiveCompliance.totalScheduled > 0
 ? `${(kpiData.preventiveCompliance.completedOnTime / kpiData.preventiveCompliance.totalScheduled) * 100}%`
 : '0%'
 }}
 />
 {/* Con retraso */}
 <div
 className="h-full bg-warning-muted0 transition-all"
 style={{
 width: kpiData.preventiveCompliance.totalScheduled > 0
 ? `${(kpiData.preventiveCompliance.completedLate / kpiData.preventiveCompliance.totalScheduled) * 100}%`
 : '0%'
 }}
 />
 {/* Vencidos */}
 <div
 className="h-full bg-destructive/100 transition-all"
 style={{
 width: kpiData.preventiveCompliance.totalScheduled > 0
 ? `${(kpiData.preventiveCompliance.overdue / kpiData.preventiveCompliance.totalScheduled) * 100}%`
 : '0%'
 }}
 />
 </div>
 <div className="flex gap-4 text-xs">
 <span className="flex items-center gap-1">
 <div className="h-2 w-2 rounded-full bg-success-muted0" /> A tiempo
 </span>
 <span className="flex items-center gap-1">
 <div className="h-2 w-2 rounded-full bg-warning-muted0" /> Con retraso
 </span>
 <span className="flex items-center gap-1">
 <div className="h-2 w-2 rounded-full bg-destructive/100" /> Vencidos
 </span>
 <span className="flex items-center gap-1">
 <div className="h-2 w-2 rounded-full bg-muted" /> Pendientes
 </span>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Distribuciones */}
 <div className="grid md:grid-cols-2 gap-4">
 {/* Top responsables */}
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <Users className="h-4 w-4" />
 Ejecuciones por Responsable
 </CardTitle>
 </CardHeader>
 <CardContent>
 {derivedMetrics.byResponsible.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 Sin datos de responsables
 </p>
 ) : (
 <div className="space-y-2">
 {derivedMetrics.byResponsible.map(([name, count], index) => (
 <div key={name} className="flex items-center justify-between py-1">
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
 <span className="text-sm font-medium truncate max-w-[180px]">{name}</span>
 </div>
 <Badge variant="secondary" className="text-xs">
 {count} {count === 1 ? 'ejecución' : 'ejecuciones'}
 </Badge>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Top checklists */}
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <FileText className="h-4 w-4" />
 Checklists más Ejecutados
 </CardTitle>
 </CardHeader>
 <CardContent>
 {derivedMetrics.byChecklist.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-4">
 Sin ejecuciones de checklists
 </p>
 ) : (
 <div className="space-y-2">
 {derivedMetrics.byChecklist.map(([title, count], index) => (
 <div key={title} className="flex items-center justify-between py-1">
 <div className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
 <span className="text-sm truncate max-w-[180px]">{title}</span>
 </div>
 <Badge variant="outline" className="text-xs">
 {count}x
 </Badge>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Tendencia mensual */}
 {kpiData?.trends?.monthlyCompletion && kpiData.trends.monthlyCompletion.length > 0 && (
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm flex items-center gap-2">
 <TrendingUp className="h-4 w-4" />
 Tendencia de Completados (últimos 6 meses)
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex items-end gap-2 h-32">
 {kpiData.trends.monthlyCompletion.map((month, index) => {
 const maxCompleted = Math.max(...kpiData.trends.monthlyCompletion.map(m => m.completed));
 const height = maxCompleted > 0 ? (month.completed / maxCompleted) * 100 : 0;
 return (
 <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
 <span className="text-xs font-medium">{month.completed}</span>
 <div
 className="w-full bg-primary/80 rounded-t transition-all duration-300"
 style={{ height: `${Math.max(height, 5)}%` }}
 />
 <span className="text-xs text-muted-foreground">
 {format(new Date(month.month), 'MMM', { locale: es })}
 </span>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 )}
 </>
 )}
 </TabsContent>

 {/* Ejecuciones (Historial) */}
 <TabsContent value="ejecuciones" className="space-y-4 mt-4">
 {/* Barra de búsqueda y acciones */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar checklist o responsable..."
 className="pl-8"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="text-xs">
 {filteredExecutions.length} ejecuciones
 </Badge>
 <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredExecutions.length === 0}>
 <Download className="h-4 w-4 mr-2" />
 Exportar
 </Button>
 </div>
 </div>

 {historyLoading ? (
 <Card>
 <CardContent className="p-4">
 {[1, 2, 3, 4].map(i => (
 <Skeleton key={i} className="h-16 w-full mb-2" />
 ))}
 </CardContent>
 </Card>
 ) : filteredExecutions.length === 0 ? (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-12">
 <History className="h-12 w-12 text-muted-foreground mb-4" />
 <p className="text-sm text-muted-foreground">
 {searchTerm ? 'No se encontraron ejecuciones' : 'Sin ejecuciones registradas'}
 </p>
 </CardContent>
 </Card>
 ) : (
 <Card>
 <CardContent className="p-0">
 <div className="divide-y">
 {filteredExecutions.map((execution) => (
 <div key={execution.id}>
 <div
 className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
 onClick={() => setExpandedExecution(
 expandedExecution === execution.id ? null : execution.id
 )}
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="font-medium text-sm truncate">{execution.checklistTitle}</p>
 <Badge className={cn("text-xs", getStatusColor(execution.status))}>
 {translateStatus(execution.status)}
 </Badge>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 {execution.executedBy} • {formatDateTime(execution.executedAt)}
 </p>
 </div>
 <div className="flex items-center gap-4 text-sm">
 <div className="text-right hidden sm:block">
 <p className="font-medium">
 {execution.completedItems}/{execution.totalItems}
 </p>
 <p className="text-xs text-muted-foreground">items</p>
 </div>
 <div className="text-right hidden sm:block">
 <p className="font-medium">{formatDuration(execution.executionTime)}</p>
 <p className="text-xs text-muted-foreground">duración</p>
 </div>
 {execution.justifications && execution.justifications.length > 0 ? (
 expandedExecution === execution.id ? (
 <ChevronDown className="h-4 w-4 text-muted-foreground" />
 ) : (
 <ChevronRight className="h-4 w-4 text-muted-foreground" />
 )
 ) : (
 <div className="w-4" />
 )}
 </div>
 </div>

 {/* Justificaciones expandidas */}
 {expandedExecution === execution.id && execution.justifications && execution.justifications.length > 0 && (
 <div className="px-4 pb-4 bg-muted/30">
 <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
 <AlertCircle className="h-3 w-3" />
 Items omitidos ({execution.justifications.length})
 </p>
 <div className="space-y-2">
 {execution.justifications.map((just, idx) => (
 <div key={idx} className="bg-background p-2 rounded border text-sm">
 <p className="font-medium text-xs">{just.itemTitle}</p>
 <p className="text-xs text-muted-foreground mt-1">
 {just.justification}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </TabsContent>

 {/* Auditoría */}
 <TabsContent value="auditoria" className="space-y-4 mt-4">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-medium">Trail de auditoría</h3>
 <Button variant="outline" size="sm" disabled>
 <Download className="h-4 w-4 mr-2" />
 Exportar
 </Button>
 </div>

 {/* Eventos de auditoría derivados de ejecuciones */}
 <Card>
 <CardContent className="p-0">
 {historyLoading ? (
 <div className="p-4">
 {[1, 2, 3].map(i => (
 <Skeleton key={i} className="h-16 w-full mb-2" />
 ))}
 </div>
 ) : (checklistHistory?.history || []).length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12">
 <Shield className="h-12 w-12 text-muted-foreground mb-4" />
 <p className="text-sm text-muted-foreground">Sin eventos de auditoría</p>
 </div>
 ) : (
 <div className="divide-y">
 {(checklistHistory?.history || []).slice(0, 20).map((execution) => {
 const hasSkipped = execution.totalItems > execution.completedItems;
 const icon = execution.status === 'COMPLETED' && !hasSkipped
 ? <CheckCircle className="h-3 w-3 text-success" />
 : hasSkipped
 ? <AlertTriangle className="h-3 w-3 text-warning-muted-foreground" />
 : <Activity className="h-3 w-3 text-info-muted-foreground" />;

 const action = execution.status === 'COMPLETED' && !hasSkipped
 ? 'Checklist completado'
 : hasSkipped
 ? `Checklist con ${execution.totalItems - execution.completedItems} items omitidos`
 : 'Ejecución de checklist';

 return (
 <div key={execution.id} className="flex items-start gap-3 p-3 hover:bg-muted/50">
 <div className="rounded-full bg-muted p-1.5 mt-0.5">
 {icon}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">{action}</p>
 <p className="text-xs text-muted-foreground truncate">
 {execution.checklistTitle}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {formatDateTime(execution.executedAt)} • {execution.executedBy}
 </p>
 </div>
 <Badge variant="outline" className="text-xs shrink-0">
 {formatDuration(execution.executionTime)}
 </Badge>
 </div>
 );
 })}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Resumen de auditoría */}
 <div className="grid md:grid-cols-3 gap-3">
 <Card>
 <CardContent className="pt-4 text-center">
 <p className="text-3xl font-bold text-success">{derivedMetrics.completedExecutions}</p>
 <p className="text-xs text-muted-foreground">Ejecuciones exitosas</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <p className="text-3xl font-bold text-warning-muted-foreground">{derivedMetrics.partialExecutions}</p>
 <p className="text-xs text-muted-foreground">Ejecuciones parciales</p>
 </CardContent>
 </Card>
 <Card>
 <CardContent className="pt-4 text-center">
 <p className="text-3xl font-bold text-destructive">{derivedMetrics.skippedItems}</p>
 <p className="text-xs text-muted-foreground">Items omitidos</p>
 </CardContent>
 </Card>
 </div>
 </TabsContent>
 </Tabs>
 </div>
 );
}

export default PreventivoMetricasView;
