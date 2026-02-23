'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import {
 FileText,
 Plus,
 Search,
 Filter,
 Wrench,
 Calendar as CalendarIcon,
 User,
 Clock,
 AlertTriangle,
 Building,
 Cog,
 Settings,
  Check,
 SquarePen,
 Trash2,
 Copy,
 X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/date-utils';
import { stripHtmlTags } from '@/lib/utils';
import {
 getPriorityLabel,
 getPriorityColor,
 formatFrequency
} from '@/lib/maintenance/display-utils';

interface PreventivoPlanesViewProps {
 className?: string;
 onCreatePlan?: () => void;
 onViewPlan?: (plan: any) => void;
 onEditPlan?: (plan: any) => void;
 onExecutePlan?: (plan: any) => void;
 onDeletePlan?: (plan: any) => void;
 onDuplicatePlan?: (plan: any) => void;
 hideCreateButton?: boolean;
}

const getDurationDisplay = (maintenance: any) => {
 if (maintenance.timeValue && maintenance.timeUnit) {
 const unitLabel = maintenance.timeUnit === 'HOURS' ? 'h' : 'min';
 return `${maintenance.timeValue}${unitLabel}`;
 }
 if (maintenance.estimatedHours) {
 return `${maintenance.estimatedHours}h`;
 }
 if (maintenance.estimatedMinutes) {
 return `${maintenance.estimatedMinutes}min`;
 }
 return 'Sin estimar';
};

/**
 * Vista "Planes" del Preventivo
 * Lista de planes de mantenimiento preventivo (templates activos)
 * Cada plan define: máquina, frecuencia, checklist, responsable
 */
export function PreventivoPlanesView({
 className,
 onCreatePlan,
 onViewPlan,
 onEditPlan,
 onExecutePlan,
 onDeletePlan,
 onDuplicatePlan,
 hideCreateButton = false,
}: PreventivoPlanesViewProps) {
 const { currentCompany, currentSector } = useCompany();
 const [searchTerm, setSearchTerm] = useState('');
 const [isFilterOpen, setIsFilterOpen] = useState(false);
 const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
 const [frequencyFilter, setFrequencyFilter] = useState<string[]>([]);
 const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
 const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
 const [isDateFromOpen, setIsDateFromOpen] = useState(false);
 const [isDateToOpen, setIsDateToOpen] = useState(false);
 const [groupBy, setGroupBy] = useState<'none' | 'machine' | 'date'>('none');

 // Opciones de filtro
 const priorityOptions = [
 { value: 'CRITICAL', label: 'Critica' },
 { value: 'HIGH', label: 'Alta' },
 { value: 'MEDIUM', label: 'Media' },
 { value: 'LOW', label: 'Baja' },
 ];

 const frequencyOptions = [
 { value: 'DAILY', label: 'Diario' },
 { value: 'WEEKLY', label: 'Semanal' },
 { value: 'BIWEEKLY', label: 'Quincenal' },
 { value: 'MONTHLY', label: 'Mensual' },
 { value: 'QUARTERLY', label: 'Trimestral' },
 { value: 'YEARLY', label: 'Anual' },
 ];

 const togglePriorityFilter = (value: string) => {
 setPriorityFilter(prev =>
 prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
 );
 };

 const toggleFrequencyFilter = (value: string) => {
 setFrequencyFilter(prev =>
 prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
 );
 };

 const clearFilters = () => {
 setPriorityFilter([]);
 setFrequencyFilter([]);
 setDateFrom(undefined);
 setDateTo(undefined);
 };

 const hasActiveFilters = priorityFilter.length > 0 || frequencyFilter.length > 0 || dateFrom || dateTo;
 const activeFiltersCount = priorityFilter.length + frequencyFilter.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

 const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
 const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

 // Fetch de todos los planes preventivos activos (templates)
 const { data, isLoading, error } = useQuery({
 queryKey: ['preventive-planes', companyId],
 queryFn: async () => {
 const params = new URLSearchParams();
 if (companyId) params.append('companyId', companyId.toString());
 const res = await fetch(`/api/maintenance/preventive?${params.toString()}`);
 if (!res.ok) throw new Error(`Error ${res.status}`);
 return res.json();
 },
 enabled: !!companyId,
 staleTime: 30 * 1000,
 refetchOnWindowFocus: false,
 });

 // Filtrar y procesar planes
 const { planes, stats } = useMemo(() => {
 // /api/maintenance/preventive devuelve un array directo de templates
 let allPlans: any[] = Array.isArray(data) ? data : [];

 // Filtrar por sector si hay uno seleccionado
 if (sectorId) {
 allPlans = allPlans.filter((plan: any) => {
 // Si el template tiene sectorId directo, comparar
 if (plan.sectorId) return plan.sectorId === sectorId;
 // Si tiene máquina con sectorId, comparar
 if (plan.machine?.sectorId) return plan.machine.sectorId === sectorId;
 // Sin sector asignado → incluir (plan general)
 return true;
 });
 }

 // Filtrar por término de búsqueda
 let filteredPlans = searchTerm
 ? allPlans.filter((plan: any) => {
 const search = searchTerm.toLowerCase();
 return (
 (plan.title || '').toLowerCase().includes(search) ||
 (plan.machine?.name || plan.machineName || '').toLowerCase().includes(search) ||
 (plan.unidadMovil?.nombre || '').toLowerCase().includes(search)
 );
 })
 : allPlans;

 // Filtrar por prioridad
 if (priorityFilter.length > 0) {
 filteredPlans = filteredPlans.filter((plan: any) => {
 const priority = (plan.priority || '').toUpperCase();
 return priorityFilter.includes(priority);
 });
 }

 // Filtrar por frecuencia
 if (frequencyFilter.length > 0) {
 filteredPlans = filteredPlans.filter((plan: any) => {
 const freq = typeof plan.frequency === 'string'
 ? plan.frequency.toUpperCase()
 : '';
 return frequencyFilter.includes(freq);
 });
 }

 // Filtrar por rango de fechas
 if (dateFrom || dateTo) {
 filteredPlans = filteredPlans.filter((plan: any) => {
 const planDate = plan.nextMaintenanceDate
 ? new Date(plan.nextMaintenanceDate)
 : plan.scheduledDate
 ? new Date(plan.scheduledDate)
 : null;

 if (!planDate || isNaN(planDate.getTime())) return false;

 if (dateFrom && dateTo) {
 return planDate >= dateFrom && planDate <= dateTo;
 } else if (dateFrom) {
 return planDate >= dateFrom;
 } else if (dateTo) {
 return planDate <= dateTo;
 }
 return true;
 });
 }

 // Calcular estadísticas
 const activos = filteredPlans.filter((p: any) => p.isActive !== false).length;
 const sinResponsable = filteredPlans.filter(
 (p: any) => !p.assignedTo && !p.assignedWorker && !p.assignedToName && !p.assignedToId
 ).length;

 return {
 planes: filteredPlans,
 stats: {
 total: filteredPlans.length,
 activos,
 sinResponsable,
 },
 };
 }, [data, searchTerm, priorityFilter, frequencyFilter, dateFrom, dateTo, sectorId]);

 // Agrupar planes por máquina o fecha
 const groupedPlanes = useMemo(() => {
 if (groupBy === 'none') return null;

 if (groupBy === 'machine') {
 const groups: Record<string, any[]> = {};
 planes.forEach((p: any) => {
 const key = p.unidadMovil?.nombre || p.machine?.name || 'Sin equipo asignado';
 if (!groups[key]) groups[key] = [];
 groups[key].push(p);
 });
 return Object.entries(groups).sort(([a], [b]) => {
 if (a === 'Sin equipo asignado') return 1;
 if (b === 'Sin equipo asignado') return -1;
 return a.localeCompare(b);
 });
 }

 if (groupBy === 'date') {
 const now = new Date();
 now.setHours(0, 0, 0, 0);
 const groups: Record<string, any[]> = {
 'Vencidos': [],
 'Hoy': [],
 'Esta semana': [],
 'Próximo mes': [],
 'Programados': [],
 };
 planes.forEach((p: any) => {
 const d = p.nextMaintenanceDate
 ? new Date(p.nextMaintenanceDate)
 : p.scheduledDate
 ? new Date(p.scheduledDate)
 : null;
 if (!d || isNaN(d.getTime())) { groups['Programados'].push(p); return; }
 d.setHours(0, 0, 0, 0);
 const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
 if (diff < 0) groups['Vencidos'].push(p);
 else if (diff === 0) groups['Hoy'].push(p);
 else if (diff <= 7) groups['Esta semana'].push(p);
 else if (diff <= 30) groups['Próximo mes'].push(p);
 else groups['Programados'].push(p);
 });
 return Object.entries(groups).filter(([, items]) => items.length > 0);
 }

 return null;
 }, [planes, groupBy]);

 // Loading state
 if (isLoading) {
 return (
 <div className={cn('space-y-4', className)}>
 <div className="flex gap-3">
 <Skeleton className="h-10 flex-1 max-w-sm" />
 <Skeleton className="h-10 w-10" />
 <Skeleton className="h-10 w-32" />
 </div>
 <div className="flex gap-2">
 <Skeleton className="h-6 w-24" />
 <Skeleton className="h-6 w-20" />
 <Skeleton className="h-6 w-28" />
 </div>
 <div className="space-y-3">
 {[1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-32" />
 ))}
 </div>
 </div>
 );
 }

 // Error state
 if (error) {
 return (
 <div className={cn('space-y-4', className)}>
 <Card>
 <CardContent className="p-8 text-center">
 <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
 <p className="text-sm text-muted-foreground">
 No se pudieron cargar los planes de mantenimiento
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 // No company selected
 if (!companyId) {
 return (
 <div className={cn('space-y-4', className)}>
 <Card>
 <CardContent className="p-8 text-center">
 <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin empresa seleccionada</h3>
 <p className="text-sm text-muted-foreground">
 Selecciona una empresa para ver los planes de mantenimiento
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className={cn('space-y-4', className)}>
 {/* Header con búsqueda y acciones */}
 <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
 <div />
 <div className="flex items-center gap-2">
 <div className="relative w-64">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar planes..."
 className="pl-8"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
 <PopoverTrigger asChild>
 <Button variant="outline" size="icon" className={cn("relative", hasActiveFilters && "border-primary text-primary")}>
 <Filter className="h-4 w-4" />
 {hasActiveFilters && (
 <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-white flex items-center justify-center">
 {activeFiltersCount}
 </span>
 )}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-72" align="start">
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h4 className="font-medium text-sm">Filtros</h4>
 {hasActiveFilters && (
 <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFilters}>
 <X className="h-3 w-3 mr-1" />
 Limpiar
 </Button>
 )}
 </div>

 {/* Filtro por rango de fechas */}
 <div className="space-y-2">
 <Label className="text-xs font-medium text-muted-foreground">Rango de fechas</Label>
 <div className="grid grid-cols-2 gap-2">
 <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 size="sm"
 className={cn(
 "h-8 text-xs justify-start font-normal",
 !dateFrom && "text-muted-foreground"
 )}
 >
 <CalendarIcon className="h-3 w-3 mr-1" />
 {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: es }) : 'Desde'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={dateFrom}
 onSelect={(date) => {
 setDateFrom(date);
 setIsDateFromOpen(false);
 }}
 locale={es}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen}>
 <PopoverTrigger asChild>
 <Button
 variant="outline"
 size="sm"
 className={cn(
 "h-8 text-xs justify-start font-normal",
 !dateTo && "text-muted-foreground"
 )}
 >
 <CalendarIcon className="h-3 w-3 mr-1" />
 {dateTo ? format(dateTo, 'dd/MM/yy', { locale: es }) : 'Hasta'}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
 <Calendar
 mode="single"
 selected={dateTo}
 onSelect={(date) => {
 setDateTo(date);
 setIsDateToOpen(false);
 }}
 locale={es}
 initialFocus
 />
 </PopoverContent>
 </Popover>
 </div>
 </div>

 <Separator />

 {/* Filtro por prioridad */}
 <div className="space-y-2">
 <Label className="text-xs font-medium text-muted-foreground">Prioridad</Label>
 <div className="grid grid-cols-2 gap-2">
 {priorityOptions.map((option) => (
 <div key={option.value} className="flex items-center space-x-2">
 <Checkbox
 id={`priority-${option.value}`}
 checked={priorityFilter.includes(option.value)}
 onCheckedChange={() => togglePriorityFilter(option.value)}
 className="h-3.5 w-3.5"
 />
 <label
 htmlFor={`priority-${option.value}`}
 className="text-xs cursor-pointer"
 >
 {option.label}
 </label>
 </div>
 ))}
 </div>
 </div>

 <Separator />

 {/* Filtro por frecuencia */}
 <div className="space-y-2">
 <Label className="text-xs font-medium text-muted-foreground">Frecuencia</Label>
 <div className="grid grid-cols-2 gap-2">
 {frequencyOptions.map((option) => (
 <div key={option.value} className="flex items-center space-x-2">
 <Checkbox
 id={`freq-${option.value}`}
 checked={frequencyFilter.includes(option.value)}
 onCheckedChange={() => toggleFrequencyFilter(option.value)}
 className="h-3.5 w-3.5"
 />
 <label
 htmlFor={`freq-${option.value}`}
 className="text-xs cursor-pointer"
 >
 {option.label}
 </label>
 </div>
 ))}
 </div>
 </div>
 </div>
 </PopoverContent>
 </Popover>
 {/* Toggle de agrupación */}
 <div className="flex items-center border rounded-md">
 <Button
 variant={groupBy === 'none' ? 'secondary' : 'ghost'}
 size="sm"
 className="rounded-r-none border-r"
 onClick={() => setGroupBy('none')}
 >
 Lista
 </Button>
 <Button
 variant={groupBy === 'machine' ? 'secondary' : 'ghost'}
 size="sm"
 className="rounded-none border-r"
 onClick={() => setGroupBy('machine')}
 >
 <Wrench className="h-3 w-3 mr-1" />
 Máquina
 </Button>
 <Button
 variant={groupBy === 'date' ? 'secondary' : 'ghost'}
 size="sm"
 className="rounded-l-none"
 onClick={() => setGroupBy('date')}
 >
 <CalendarIcon className="h-3 w-3 mr-1" />
 Fecha
 </Button>
 </div>
 </div>
 <div className="flex justify-end">
 {!hideCreateButton && onCreatePlan && (
 <Button onClick={onCreatePlan}>
 <Plus className="h-4 w-4 mr-2" />
 Nuevo Plan
 </Button>
 )}
 </div>
 </div>

 {/* Stats rápidas */}
 <div className="flex flex-wrap gap-2">
 <Badge variant="outline" className="gap-1">
 <FileText className="h-3 w-3" />
 {stats.total} planes
 </Badge>
 <Badge variant="outline" className="gap-1 text-success border-success">
 {stats.activos} activos
 </Badge>
 {stats.sinResponsable > 0 && (
 <Badge variant="outline" className="gap-1 text-warning-muted-foreground border-warning-muted">
 {stats.sinResponsable} sin responsable
 </Badge>
 )}
 </div>

 {/* Filtros activos */}
 {hasActiveFilters && (
 <div className="flex flex-wrap items-center gap-2">
 {dateFrom && (
 <Badge variant="secondary" className="text-xs gap-1">
 Desde: {format(dateFrom, 'dd/MM/yy', { locale: es })}
 <button onClick={() => setDateFrom(undefined)} className="hover:text-destructive ml-1">
 <X className="h-3 w-3" />
 </button>
 </Badge>
 )}
 {dateTo && (
 <Badge variant="secondary" className="text-xs gap-1">
 Hasta: {format(dateTo, 'dd/MM/yy', { locale: es })}
 <button onClick={() => setDateTo(undefined)} className="hover:text-destructive ml-1">
 <X className="h-3 w-3" />
 </button>
 </Badge>
 )}
 {priorityFilter.map(p => (
 <Badge key={p} variant="secondary" className="text-xs gap-1">
 {priorityOptions.find(o => o.value === p)?.label}
 <button onClick={() => togglePriorityFilter(p)} className="hover:text-destructive ml-1">
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 {frequencyFilter.map(f => (
 <Badge key={f} variant="secondary" className="text-xs gap-1">
 {frequencyOptions.find(o => o.value === f)?.label}
 <button onClick={() => toggleFrequencyFilter(f)} className="hover:text-destructive ml-1">
 <X className="h-3 w-3" />
 </button>
 </Badge>
 ))}
 </div>
 )}

 {/* Lista de planes */}
 <div className="space-y-4">
 {planes.length === 0 ? (
 <Card>
 <CardContent className="p-8 text-center">
 <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin planes</h3>
 <p className="text-sm text-muted-foreground mb-4">
 {searchTerm
 ? 'No se encontraron planes con ese criterio de búsqueda'
 : 'No hay planes de mantenimiento preventivo configurados'}
 </p>
 {onCreatePlan && !searchTerm && (
 <Button onClick={onCreatePlan}>
 <Plus className="h-4 w-4 mr-2" />
 Crear primer plan
 </Button>
 )}
 </CardContent>
 </Card>
 ) : groupedPlanes ? (
 // Vista agrupada
 <div className="space-y-6">
 {groupedPlanes.map(([groupName, items]) => (
 <div key={groupName}>
 <div className="flex items-center gap-2 mb-3 pb-2 border-b">
 {groupBy === 'machine' ? (
 <Wrench className="h-4 w-4 text-muted-foreground" />
 ) : groupName === 'Vencidos' ? (
 <AlertTriangle className="h-4 w-4 text-destructive" />
 ) : (
 <CalendarIcon className="h-4 w-4 text-muted-foreground" />
 )}
 <h3 className={cn(
 'font-medium text-sm',
 groupName === 'Vencidos' && 'text-destructive'
 )}>
 {groupName}
 </h3>
 <Badge variant="secondary" className="text-xs">
 {items.length}
 </Badge>
 </div>
 <div className="space-y-3">
 {items.map((plan: any) => (
 <PlanCard
 key={plan.id}
 plan={plan}
 hideEquipo={groupBy === 'machine'}
 onView={onViewPlan}
 onEdit={onEditPlan}
 onExecute={onExecutePlan}
 onDelete={onDeletePlan}
 onDuplicate={onDuplicatePlan}
 />
 ))}
 </div>
 </div>
 ))}
 </div>
 ) : (
 // Vista lista normal
 <div className="space-y-3">
 {planes.map((plan: any) => (
 <PlanCard
 key={plan.id}
 plan={plan}
 onView={onViewPlan}
 onEdit={onEditPlan}
 onExecute={onExecutePlan}
 onDelete={onDeletePlan}
 onDuplicate={onDuplicatePlan}
 />
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

// Componente de tarjeta de plan extraído
interface PlanCardProps {
 plan: any;
 hideEquipo?: boolean;
 onView?: (p: any) => void;
 onEdit?: (p: any) => void;
 onExecute?: (p: any) => void;
 onDelete?: (p: any) => void;
 onDuplicate?: (p: any) => void;
}

function PlanCard({
 plan,
 hideEquipo = false,
 onView,
 onEdit,
 onExecute,
 onDelete,
 onDuplicate,
}: PlanCardProps) {
 return (
 <Card
 className="cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden"
 onClick={() => onView?.(plan)}
 >
 <div className="p-4">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
 <div className="flex-1 min-w-0">
 {/* Título y prioridad */}
 <div className="flex flex-wrap items-center gap-2 mb-2">
 <h3 className="text-sm font-medium break-words">
 {plan.title || 'Sin título'}
 </h3>
 <Badge className={cn('text-xs shrink-0', getPriorityColor(plan.priority))}>
 {getPriorityLabel(plan.priority)}
 </Badge>
 </div>

 {/* Descripción */}
 <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">
 {stripHtmlTags(plan.description) || 'Sin descripción'}
 </p>

 {/* Badges */}
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 {!hideEquipo && (
 <Badge variant="outline" className="text-xs">
 <Wrench className="h-3 w-3 mr-1" />
 {plan.unidadMovil?.nombre || plan.machine?.name || 'Sin equipo'}
 </Badge>
 )}
 {plan.machine?.sector && (
 <Badge variant="outline" className="text-xs">
 <Building className="h-3 w-3 mr-1" />
 {plan.machine.sector.name}
 </Badge>
 )}
 {(plan.componentNames || []).map((name: string, idx: number) => (
 <Badge key={`component-${idx}`} variant="outline" className="text-xs">
 <Cog className="h-3 w-3 mr-1" />
 {name}
 </Badge>
 ))}
 {(plan.subcomponentNames || []).map((name: string, idx: number) => (
 <Badge key={`subcomponent-${idx}`} variant="secondary" className="text-xs">
 <Settings className="h-3 w-3 mr-1" />
 {name}
 </Badge>
 ))}
 </div>

 {/* Info adicional */}
 <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
 {plan.frequency && (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>{formatFrequency(plan.frequency)}</span>
 </div>
 )}
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {getDurationDisplay(plan)}
 </div>
 {plan.nextMaintenanceDate && (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(plan.nextMaintenanceDate)}</span>
 </div>
 )}
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 {plan.assignedTo?.name ||
 plan.assignedWorker?.name ||
 plan.assignedToName || (
 <span className="text-warning-muted-foreground">Sin asignar</span>
 )}
 </div>
 </div>
 </div>

 {/* Botones de acción */}
 <div className="flex gap-2 ml-4">
 {onEdit && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => { e.stopPropagation(); onEdit(plan); }}
 title="Editar"
 >
 <SquarePen className="h-3.5 w-3.5" />
 </Button>
 )}
 {onExecute && (
 <Button
 variant="default"
 size="sm"
 className="h-8 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
 onClick={(e) => { e.stopPropagation(); onExecute(plan); }}
 title="Ejecutar ahora"
 >
 <Check className="h-4 w-4" />
 </Button>
 )}
 {onDelete && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => { e.stopPropagation(); onDelete(plan); }}
 title="Eliminar"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 {onDuplicate && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => { e.stopPropagation(); onDuplicate(plan); }}
 title="Duplicar"
 >
 <Copy className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </div>
 </div>
 </Card>
 );
}

export default PreventivoPlanesView;
