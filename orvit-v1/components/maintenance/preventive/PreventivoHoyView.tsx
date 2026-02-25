'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Clock,
 AlertTriangle,
 CheckCircle,
  Check,
 Calendar as CalendarIcon,
 Wrench,
 Building,
 Cog,
 Settings,
 User,
 SquarePen,
 Trash2,
 Copy,
 CalendarDays,
 ListTodo,
 Search,
 X,
 CheckSquare2,
 Download,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { exportPreventivePDF } from '@/lib/pdf/preventive-pdf';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useMaintenancePending } from '@/hooks/mantenimiento';
import { formatDate } from '@/lib/date-utils';
import { stripHtmlTags } from '@/lib/utils';
import {
 getPriorityLabel,
 getPriorityColor,
 translateExecutionWindow,
 formatFrequency
} from '@/lib/maintenance/display-utils';

interface PreventivoHoyViewProps {
 className?: string;
 onViewMaintenance?: (maintenance: any) => void;
 onEditMaintenance?: (maintenance: any) => void;
 onExecuteMaintenance?: (maintenance: any) => void;
 onDeleteMaintenance?: (maintenance: any) => void;
 onDuplicateMaintenance?: (maintenance: any) => void;
}

/**
 * Calcula el badge SLA para mantenimientos preventivos.
 * Retorna null si la fecha es nula o está a más de 30 días.
 */
const getPreventiveSLABadge = (dateStr: string | undefined | null): {
 text: string;
 className: string;
} | null => {
 if (!dateStr) return null;
 try {
 const date = new Date(dateStr);
 if (isNaN(date.getTime())) return null;
 date.setHours(0, 0, 0, 0);
 const now = new Date();
 now.setHours(0, 0, 0, 0);
 const days = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

 if (days < 0) {
 const abs = Math.abs(days);
 return {
 text: abs === 1 ? 'Vencida ayer' : `Vencida hace ${abs} días`,
 className: 'bg-destructive/10 text-destructive border-destructive/20',
 };
 }
 if (days === 0) return { text: 'Vence hoy', className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted ' };
 if (days === 1) return { text: 'Vence mañana', className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted ' };
 if (days <= 7) return { text: `Vence en ${days} días`, className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted ' };
 if (days <= 30) return { text: `Vence en ${days} días`, className: 'bg-muted text-muted-foreground border-border' };
 return null;
 } catch {
 return null;
 }
};

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
 * Vista "Hoy" del Preventivo - Muestra tareas vencidas + hoy + próximos 7 días
 * Usa datos reales de la base de datos
 */
export function PreventivoHoyView({
 className,
 onViewMaintenance,
 onEditMaintenance,
 onExecuteMaintenance,
 onDeleteMaintenance,
 onDuplicateMaintenance,
}: PreventivoHoyViewProps) {
 const { currentCompany, currentSector } = useCompany();
 const [groupBy, setGroupBy] = useState<'none' | 'machine' | 'date'>('none');
 const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'today' | 'week' | 'future'>('all');
 const [searchTerm, setSearchTerm] = useState('');
 const [selectionMode, setSelectionMode] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
 const { toast } = useToast();
 const queryClient = useQueryClient();

 const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
 const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

 // Fetch de mantenimientos pendientes
 const { data, isLoading, error } = useMaintenancePending({
 companyId,
 sectorId,
 type: 'PREVENTIVE',
 enabled: !!companyId,
 });

 // Filtrar solo preventivos y calcular KPIs
 const { maintenances, kpis } = useMemo(() => {
 const allMaintenances = data?.maintenances || [];
 const preventiveMaintenances = allMaintenances.filter(
 (m: any) => m.type === 'PREVENTIVE' || m.isPreventive
 );

 const now = new Date();
 now.setHours(0, 0, 0, 0);

 const in7Days = new Date(now);
 in7Days.setDate(in7Days.getDate() + 7);

 let overdue = 0;
 let dueToday = 0;
 let next7Days = 0;
 let backlog = 0;

 preventiveMaintenances.forEach((maintenance: any) => {
 const maintenanceDate = maintenance.nextMaintenanceDate
 ? new Date(maintenance.nextMaintenanceDate)
 : maintenance.scheduledDate
 ? new Date(maintenance.scheduledDate)
 : null;

 if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
 backlog++;
 return;
 }

 maintenanceDate.setHours(0, 0, 0, 0);
 const daysDiff = Math.floor(
 (maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
 );

 if (daysDiff < 0) {
 overdue++;
 } else if (daysDiff === 0) {
 dueToday++;
 } else if (daysDiff <= 7) {
 next7Days++;
 } else {
 backlog++;
 }
 });

 return {
 maintenances: preventiveMaintenances,
 kpis: { overdue, dueToday, next7Days, backlog },
 };
 }, [data]);

 // Filtrar mantenimientos según búsqueda y filtro de estado
 const filteredMaintenances = useMemo(() => {
 let filtered = maintenances;

 // Filtrar por término de búsqueda
 if (searchTerm) {
 const s = searchTerm.toLowerCase();
 filtered = filtered.filter((m: any) =>
 (m.title || '').toLowerCase().includes(s) ||
 (m.machine?.name || '').toLowerCase().includes(s) ||
 (m.unidadMovil?.nombre || '').toLowerCase().includes(s)
 );
 }

 if (statusFilter === 'all') return filtered;

 const now = new Date();
 now.setHours(0, 0, 0, 0);

 return filtered.filter((m: any) => {
 const maintenanceDate = m.nextMaintenanceDate
 ? new Date(m.nextMaintenanceDate)
 : m.scheduledDate
 ? new Date(m.scheduledDate)
 : null;

 if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
 return statusFilter === 'future'; // Sin fecha va a "Programados"
 }

 maintenanceDate.setHours(0, 0, 0, 0);
 const daysDiff = Math.floor(
 (maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
 );

 switch (statusFilter) {
 case 'overdue': return daysDiff < 0;
 case 'today': return daysDiff === 0;
 case 'week': return daysDiff > 0 && daysDiff <= 7;
 case 'future': return daysDiff > 7;
 default: return true;
 }
 });
 }, [maintenances, statusFilter, searchTerm]);

 // Agrupar mantenimientos por máquina o fecha
 const groupedMaintenances = useMemo(() => {
 if (groupBy === 'none') return null;

 if (groupBy === 'machine') {
 const groups: Record<string, any[]> = {};
 filteredMaintenances.forEach((m: any) => {
 const machineName = m.unidadMovil?.nombre || m.machine?.name || 'Sin equipo asignado';
 if (!groups[machineName]) groups[machineName] = [];
 groups[machineName].push(m);
 });
 // Ordenar grupos alfabéticamente, pero "Sin equipo" al final
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
 'Mañana': [],
 'Esta semana': [],
 'Próximamente': [],
 };

 filteredMaintenances.forEach((m: any) => {
 const maintenanceDate = m.nextMaintenanceDate
 ? new Date(m.nextMaintenanceDate)
 : m.scheduledDate
 ? new Date(m.scheduledDate)
 : null;

 if (!maintenanceDate || isNaN(maintenanceDate.getTime())) {
 groups['Próximamente'].push(m);
 return;
 }

 maintenanceDate.setHours(0, 0, 0, 0);
 const daysDiff = Math.floor(
 (maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
 );

 if (daysDiff < 0) groups['Vencidos'].push(m);
 else if (daysDiff === 0) groups['Hoy'].push(m);
 else if (daysDiff === 1) groups['Mañana'].push(m);
 else if (daysDiff <= 7) groups['Esta semana'].push(m);
 else groups['Próximamente'].push(m);
 });

 // Filtrar grupos vacíos
 return Object.entries(groups).filter(([_, items]) => items.length > 0);
 }

 return null;
 }, [filteredMaintenances, groupBy]);

 // Handlers de selección
 const toggleSelection = useCallback((id: number) => {
   setSelectedIds(prev => {
     const next = new Set(prev);
     if (next.has(id)) next.delete(id); else next.add(id);
     return next;
   });
 }, []);

 const toggleSelectionMode = useCallback(() => {
   setSelectionMode(prev => !prev);
   setSelectedIds(new Set());
 }, []);

 const handleRescheduleOverdue = useCallback(async () => {
   if (!companyId) return;
   try {
     const res = await fetch('/api/maintenance/preventive/reschedule-overdue', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ companyId }),
     });
     const data = await res.json();
     toast({
       title: res.ok ? 'Reprogramados' : 'Error',
       description: data.message || (res.ok ? 'Instancias reprogramadas' : 'No se pudo reprogramar'),
       variant: res.ok ? 'default' : 'destructive',
     });
     if (res.ok) queryClient.invalidateQueries({ queryKey: ['maintenance-pending'] });
   } catch {
     toast({ title: 'Error', description: 'No se pudo conectar con el servidor', variant: 'destructive' });
   }
 }, [companyId, toast, queryClient]);

 const handleBulkDelete = useCallback(async () => {
   if (selectedIds.size === 0) return;
   const ids = Array.from(selectedIds);
   let deleted = 0;
   for (const id of ids) {
     try {
       const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
       if (res.ok) deleted++;
     } catch {}
   }
   toast({
     title: deleted > 0 ? 'Eliminados' : 'Error al eliminar',
     description: `${deleted} de ${ids.length} mantenimiento${ids.length !== 1 ? 's' : ''} eliminado${deleted !== 1 ? 's' : ''}`,
     variant: deleted === 0 ? 'destructive' : 'default',
   });
   setSelectedIds(new Set());
   setSelectionMode(false);
   queryClient.invalidateQueries({ queryKey: ['maintenance-pending'] });
 }, [selectedIds, toast, queryClient]);

 // Loading state
 if (isLoading) {
 return (
 <div className={cn('space-y-4', className)}>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-24" />
 ))}
 </div>
 <div className="space-y-4">
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
 No se pudieron cargar los mantenimientos preventivos
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
 Selecciona una empresa para ver los mantenimientos preventivos
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className={cn('space-y-4', className)}>
 {/* Header con buscador, toggle y contador */}
 <div className="space-y-2">
 <div className="flex items-center justify-center gap-3 flex-wrap">
 {/* Buscador */}
 <div className="relative w-64">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar mantenimientos..."
 className="pl-8"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 {searchTerm && (
 <Button
 variant="ghost"
 size="sm"
 className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
 onClick={() => setSearchTerm('')}
 >
 <X className="h-4 w-4" />
 </Button>
 )}
 </div>
 {/* Toggle de agrupación */}
 <div className="flex items-center border rounded-md shrink-0">
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
 {/* Exportar PDF */}
 <Button
   variant="ghost"
   size="sm"
   className="shrink-0"
   onClick={() => exportPreventivePDF(
     filteredMaintenances,
     currentCompany?.name || '',
     'Mantenimientos Preventivos Pendientes'
   )}
   title="Exportar PDF"
   disabled={filteredMaintenances.length === 0}
 >
   <Download className="h-4 w-4" />
 </Button>
 {/* Modo selección */}
 <Button
   variant={selectionMode ? 'secondary' : 'ghost'}
   size="sm"
   className="shrink-0"
   onClick={toggleSelectionMode}
   title={selectionMode ? 'Salir de selección' : 'Seleccionar para acciones masivas'}
 >
   <CheckSquare2 className="h-4 w-4" />
 </Button>
 </div>
 {/* Barra de selección */}
 {selectionMode && (
   <div className="flex items-center gap-2 text-xs">
     <button
       className="text-primary hover:underline"
       onClick={() => setSelectedIds(new Set(filteredMaintenances.map((m: any) => m.id)))}
     >
       Seleccionar todos ({filteredMaintenances.length})
     </button>
     {selectedIds.size > 0 && (
       <>
         <span className="text-muted-foreground">·</span>
         <span className="text-muted-foreground">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
         <button className="text-muted-foreground hover:underline" onClick={() => setSelectedIds(new Set())}>
           Limpiar
         </button>
       </>
     )}
   </div>
 )}
 {/* Contador + limpiar filtros */}
 <div className="flex items-center gap-2">
 <p className="text-sm text-muted-foreground">
 {(statusFilter !== 'all' || searchTerm) ? (
 <>
 {filteredMaintenances.length} de {maintenances.length} mantenimiento{maintenances.length !== 1 ? 's' : ''}
 </>
 ) : (
 <>
 {maintenances.length} mantenimiento{maintenances.length !== 1 ? 's' : ''} pendiente{maintenances.length !== 1 ? 's' : ''}
 </>
 )}
 </p>
 {(statusFilter !== 'all' || searchTerm) && (
 <Button
 variant="ghost"
 size="sm"
 onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
 className="h-6 px-2 text-xs"
 >
 Limpiar filtros ×
 </Button>
 )}
 </div>
 </div>

 {/* KPIs de Pendientes (clickeables como filtros) */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {/* Vencidos */}
 <Card
 className={cn(
 "hover:shadow-md transition-all cursor-pointer",
 statusFilter === 'overdue'
 ? "ring-2 ring-destructive border-destructive bg-destructive/10"
 : "border-destructive/30 bg-destructive/10/50"
 )}
 onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Vencidos</p>
 <p className="text-2xl font-bold text-destructive">{kpis.overdue}</p>
 </div>
 <div className="h-10 w-10 bg-destructive/10 rounded-full flex items-center justify-center">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 </div>
 </div>
 {kpis.overdue > 0 && (
   <Button
     variant="ghost"
     size="sm"
     className="w-full mt-2 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
     onClick={(e) => { e.stopPropagation(); handleRescheduleOverdue(); }}
     title="Reprogramar todas las instancias vencidas al día de hoy"
   >
     Reprogramar vencidos
   </Button>
 )}
 </CardContent>
 </Card>

 {/* Vencen Hoy */}
 <Card
 className={cn(
 "hover:shadow-md transition-all cursor-pointer",
 statusFilter === 'today' && "ring-2 ring-primary border-primary"
 )}
 onClick={() => setStatusFilter(statusFilter === 'today' ? 'all' : 'today')}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Vencen Hoy</p>
 <p className="text-2xl font-bold text-foreground">{kpis.dueToday}</p>
 </div>
 <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
 <Clock className="h-5 w-5 text-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Próximos 7 días */}
 <Card
 className={cn(
 "hover:shadow-md transition-all cursor-pointer",
 statusFilter === 'week' && "ring-2 ring-primary border-primary"
 )}
 onClick={() => setStatusFilter(statusFilter === 'week' ? 'all' : 'week')}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Próximos 7 días</p>
 <p className="text-2xl font-bold text-foreground">{kpis.next7Days}</p>
 </div>
 <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
 <CalendarDays className="h-5 w-5 text-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Programados (antes Backlog) */}
 <Card
 className={cn(
 "hover:shadow-md transition-all cursor-pointer",
 statusFilter === 'future' && "ring-2 ring-primary border-primary"
 )}
 onClick={() => setStatusFilter(statusFilter === 'future' ? 'all' : 'future')}
 >
 <CardContent className="p-4">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs text-muted-foreground">Programados</p>
 <p className="text-2xl font-bold text-foreground">{kpis.backlog}</p>
 </div>
 <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
 <ListTodo className="h-5 w-5 text-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Lista de mantenimientos */}
 <div className="space-y-4">
 {filteredMaintenances.length === 0 ? (
 <Card>
 <CardContent className="p-8 text-center">
 {maintenances.length === 0 ? (
 <>
 <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin tareas pendientes</h3>
 <p className="text-sm text-muted-foreground">
 No hay mantenimientos preventivos pendientes
 </p>
 </>
 ) : (
 <>
 <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin resultados</h3>
 <p className="text-sm text-muted-foreground mb-4">
 No hay mantenimientos que coincidan con los filtros seleccionados
 </p>
 <Button variant="outline" onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}>
 Ver todos
 </Button>
 </>
 )}
 </CardContent>
 </Card>
 ) : groupedMaintenances ? (
 // Vista agrupada
 <div className="space-y-6">
 {groupedMaintenances.map(([groupName, items]) => (
 <div key={groupName}>
 {/* Header del grupo */}
 <div className="flex items-center gap-2 mb-3 pb-2 border-b">
 {groupBy === 'machine' ? (
 <Wrench className="h-4 w-4 text-muted-foreground" />
 ) : groupName === 'Vencidos' ? (
 <AlertTriangle className="h-4 w-4 text-destructive" />
 ) : (
 <CalendarIcon className="h-4 w-4 text-muted-foreground" />
 )}
 <h3 className={cn(
 "font-medium text-sm",
 groupName === 'Vencidos' && "text-destructive"
 )}>
 {groupName}
 </h3>
 <Badge variant="secondary" className="text-xs">
 {items.length}
 </Badge>
 </div>
 {/* Cards del grupo */}
 <div className="space-y-3">
 {items.map((maintenance: any) => (
 <MaintenanceCard
 key={maintenance.id}
 maintenance={maintenance}
 onView={onViewMaintenance}
 onEdit={onEditMaintenance}
 onExecute={onExecuteMaintenance}
 onDelete={onDeleteMaintenance}
 onDuplicate={onDuplicateMaintenance}
 hideEquipo={groupBy === 'machine'}
 isSelected={selectedIds.has(maintenance.id)}
 onToggleSelect={toggleSelection}
 selectionMode={selectionMode}
 />
 ))}
 </div>
 </div>
 ))}
 </div>
 ) : (
 // Vista lista normal
 <div className="space-y-3">
 {filteredMaintenances.map((maintenance: any) => (
 <MaintenanceCard
 key={maintenance.id}
 maintenance={maintenance}
 onView={onViewMaintenance}
 onEdit={onEditMaintenance}
 onExecute={onExecuteMaintenance}
 onDelete={onDeleteMaintenance}
 onDuplicate={onDuplicateMaintenance}
 isSelected={selectedIds.has(maintenance.id)}
 onToggleSelect={toggleSelection}
 selectionMode={selectionMode}
 />
 ))}
 </div>
 )}
 </div>

 {/* Barra de acciones masivas */}
 {selectionMode && selectedIds.size > 0 && (
   <div className="sticky bottom-0 bg-background border border-border rounded-lg shadow-lg p-3 flex items-center justify-between gap-3">
     <span className="text-sm font-medium">
       {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
     </span>
     <div className="flex gap-2">
       <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
         Limpiar
       </Button>
       <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
         <Trash2 className="h-4 w-4 mr-1" />
         Eliminar ({selectedIds.size})
       </Button>
     </div>
   </div>
 )}
 </div>
 );
}

// Componente de tarjeta de mantenimiento extraído
interface MaintenanceCardProps {
 maintenance: any;
 onView?: (m: any) => void;
 onEdit?: (m: any) => void;
 onExecute?: (m: any) => void;
 onDelete?: (m: any) => void;
 onDuplicate?: (m: any) => void;
 hideEquipo?: boolean;
 isSelected?: boolean;
 onToggleSelect?: (id: number) => void;
 selectionMode?: boolean;
}

function MaintenanceCard({
 maintenance,
 onView,
 onEdit,
 onExecute,
 onDelete,
 onDuplicate,
 hideEquipo = false,
 isSelected = false,
 onToggleSelect,
 selectionMode = false,
}: MaintenanceCardProps) {
 const maintenanceDate = maintenance.nextMaintenanceDate || maintenance.scheduledDate;
 const isPreventiveOverdue = (() => {
 if (!maintenanceDate) return false;
 try {
 const d = new Date(maintenanceDate);
 d.setHours(0, 0, 0, 0);
 const now = new Date();
 now.setHours(0, 0, 0, 0);
 return d.getTime() < now.getTime();
 } catch { return false; }
 })();

 return (
 <Card
 className={cn(
 'cursor-pointer hover:shadow-md transition-shadow w-full overflow-hidden',
 isPreventiveOverdue && 'border-l-[3px] border-l-rose-500',
 selectionMode && isSelected && 'ring-2 ring-primary border-primary'
 )}
 onClick={() => selectionMode ? onToggleSelect?.(maintenance.id) : onView?.(maintenance)}
 >
 <div className="p-4">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
 <div className="flex-1 min-w-0">
 {/* Título, prioridad y badge SLA */}
 <div className="flex flex-wrap items-center gap-2 mb-2">
 {selectionMode && (
   <Checkbox
     checked={isSelected}
     onCheckedChange={() => onToggleSelect?.(maintenance.id)}
     onClick={(e) => e.stopPropagation()}
     className="shrink-0"
   />
 )}
 <h3 className="text-sm font-medium break-words">
 {maintenance.title || 'Sin título'}
 </h3>
 <Badge className={cn('text-xs shrink-0', getPriorityColor(maintenance.priority))}>
 {getPriorityLabel(maintenance.priority)}
 </Badge>
 {(() => {
 const sla = getPreventiveSLABadge(
 maintenance.nextMaintenanceDate || maintenance.scheduledDate
 );
 if (!sla) return null;
 return (
 <span className={cn(
 'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border shrink-0',
 sla.className
 )}>
 <Clock className="h-2.5 w-2.5" />
 {sla.text}
 </span>
 );
 })()}
 </div>

 {/* Descripción */}
 <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">
 {stripHtmlTags(maintenance.description) || 'Sin descripción'}
 </p>

 {/* Ventana de ejecución */}
 <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 <span>
 Ventana: {translateExecutionWindow(maintenance.executionWindow)}
 </span>
 </div>
 </div>

 {/* Badges de activo - colores neutros */}
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 {!hideEquipo && (
 <Badge variant="outline" className="text-xs">
 <Wrench className="h-3 w-3 mr-1" />
 {maintenance.unidadMovil?.nombre ||
 maintenance.machine?.name ||
 'Sin equipo'}
 </Badge>
 )}
 {maintenance.machine?.sector && (
 <Badge variant="outline" className="text-xs">
 <Building className="h-3 w-3 mr-1" />
 {maintenance.machine.sector.name}
 </Badge>
 )}
 {/* Componentes */}
 {(maintenance.componentNames || []).map((name: string, idx: number) => (
 <Badge
 key={`component-${idx}`}
 variant="outline"
 className="text-xs"
 >
 <Cog className="h-3 w-3 mr-1" />
 {name}
 </Badge>
 ))}
 {/* Subcomponentes */}
 {(maintenance.subcomponentNames || []).map((name: string, idx: number) => (
 <Badge
 key={`subcomponent-${idx}`}
 variant="secondary"
 className="text-xs"
 >
 <Settings className="h-3 w-3 mr-1" />
 {name}
 </Badge>
 ))}
 </div>

 {/* Info adicional */}
 <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
 {/* Frecuencia */}
 {maintenance.frequency && (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>{formatFrequency(maintenance.frequency)}</span>
 </div>
 )}
 {/* Duración */}
 <div className="flex items-center gap-1">
 <Clock className="h-3 w-3" />
 {getDurationDisplay(maintenance)}
 </div>
 {/* Próxima fecha */}
 {maintenance.nextMaintenanceDate && (
 <div className="flex items-center gap-1">
 <CalendarIcon className="h-3 w-3" />
 <span>Próximo: {formatDate(maintenance.nextMaintenanceDate)}</span>
 </div>
 )}
 {/* Asignado */}
 <div className="flex items-center gap-1">
 <User className="h-3 w-3" />
 {maintenance.assignedTo?.name ||
 maintenance.assignedWorker?.name ||
 maintenance.assignedToName || (
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
 onClick={(e) => {
 e.stopPropagation();
 onEdit(maintenance);
 }}
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
 onClick={(e) => {
 e.stopPropagation();
 onExecute(maintenance);
 }}
 title="Realizar mantenimiento"
 >
 <Check className="h-4 w-4" />
 </Button>
 )}
 {onDelete && (
 <Button
 variant="outline"
 size="sm"
 className="h-8 w-8 p-0"
 onClick={(e) => {
 e.stopPropagation();
 onDelete(maintenance);
 }}
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
 onClick={(e) => {
 e.stopPropagation();
 onDuplicate(maintenance);
 }}
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

export default PreventivoHoyView;
