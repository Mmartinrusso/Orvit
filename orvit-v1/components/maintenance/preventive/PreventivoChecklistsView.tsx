'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
 ClipboardCheck,
 Plus,
 Search,
 Filter,
 FileText,
 Copy,
 Archive,
 CheckCircle2,
 ListChecks,
 AlertTriangle,
 Settings,
 Calendar,
 SquarePen,
 Play,
 X,
 Trash2,
} from 'lucide-react';
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useChecklists } from '@/hooks/maintenance';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PreventivoChecklistsViewProps {
 className?: string;
 onCreateChecklist?: () => void;
 onViewChecklist?: (checklist: any) => void;
 onEditChecklist?: (checklist: any) => void;
 onExecuteChecklist?: (checklist: any) => void;
 onDuplicateChecklist?: (checklist: any) => void;
 onArchiveChecklist?: (checklist: any) => void;
 onDeleteChecklist?: (checklist: any) => void;
 hideCreateButton?: boolean;
}

const getEstadoBadge = (estado: string, hasInProgressExecution?: boolean) => {
 // Si hay una ejecución activa, mostrar "En ejecución"
 if (hasInProgressExecution) {
 return (
 <Badge className="text-[10px] bg-warning-muted text-warning-muted-foreground border-warning-muted animate-pulse">
 En ejecución
 </Badge>
 );
 }

 switch (estado?.toUpperCase()) {
 case 'PUBLISHED':
 case 'ACTIVE':
 return <Badge className="text-[10px] bg-success-muted text-success border-success-muted">Publicada</Badge>;
 case 'DRAFT':
 return <Badge className="text-[10px] bg-warning-muted text-warning-muted-foreground border-warning-muted">Borrador</Badge>;
 case 'ARCHIVED':
 return <Badge className="text-[10px] bg-muted text-foreground border-border">Archivada</Badge>;
 default:
 return <Badge className="text-[10px] bg-info-muted text-info-muted-foreground border-info-muted">Activa</Badge>;
 }
};

const formatDate = (dateString: string) => {
 try {
 const date = new Date(dateString);
 if (isNaN(date.getTime())) return 'Sin fecha';
 return format(date, 'dd/MM/yyyy', { locale: es });
 } catch {
 return 'Sin fecha';
 }
};

// Traducir frecuencia a español
const translateFrequency = (frequency: string | undefined | null): string => {
 if (!frequency) return '';
 const translations: Record<string, string> = {
 'DAILY': 'DIARIO',
 'WEEKLY': 'SEMANAL',
 'BIWEEKLY': 'QUINCENAL',
 'MONTHLY': 'MENSUAL',
 'BIMONTHLY': 'BIMESTRAL',
 'QUARTERLY': 'TRIMESTRAL',
 'SEMIANNUAL': 'SEMESTRAL',
 'ANNUAL': 'ANUAL',
 'YEARLY': 'ANUAL',
 'ON_DEMAND': 'A DEMANDA',
 'CUSTOM': 'PERSONALIZADO',
 };
 return translations[frequency.toUpperCase()] || frequency;
};

/**
 * Vista "Checklists" del Preventivo
 * Librería de plantillas de checklists con datos reales
 */
export function PreventivoChecklistsView({
 className,
 onCreateChecklist,
 onViewChecklist,
 onEditChecklist,
 onExecuteChecklist,
 onDuplicateChecklist,
 onArchiveChecklist,
 onDeleteChecklist,
 hideCreateButton = false,
}: PreventivoChecklistsViewProps) {
 const { currentCompany, currentSector } = useCompany();
 const [searchTerm, setSearchTerm] = useState('');
 const [showArchived, setShowArchived] = useState(false);
 const [isFilterOpen, setIsFilterOpen] = useState(false);
 const [frequencyFilter, setFrequencyFilter] = useState<string[]>([]);
 const [statusFilter, setStatusFilter] = useState<string[]>([]);

 const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
 const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

 // Opciones de filtro de frecuencia
 const frequencyOptions = [
 { value: 'DAILY', label: 'Diario' },
 { value: 'WEEKLY', label: 'Semanal' },
 { value: 'BIWEEKLY', label: 'Quincenal' },
 { value: 'MONTHLY', label: 'Mensual' },
 { value: 'QUARTERLY', label: 'Trimestral' },
 { value: 'SEMIANNUAL', label: 'Semestral' },
 { value: 'ANNUAL', label: 'Anual' },
 ];

 // Opciones de filtro de estado
 const statusOptions = [
 { value: 'ACTIVE', label: 'Activa' },
 { value: 'DRAFT', label: 'Borrador' },
 ];

 const toggleFrequencyFilter = (value: string) => {
 setFrequencyFilter(prev =>
 prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
 );
 };

 const toggleStatusFilter = (value: string) => {
 setStatusFilter(prev =>
 prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
 );
 };

 const clearFilters = () => {
 setFrequencyFilter([]);
 setStatusFilter([]);
 };

 const hasActiveFilters = frequencyFilter.length > 0 || statusFilter.length > 0;

 // Fetch de checklists
 const { data, isLoading, error } = useChecklists({
 companyId,
 sectorId,
 take: 100,
 enabled: !!companyId,
 });

 // Filtrar y procesar checklists
 const { checklists, stats, archivedCount } = useMemo(() => {
 const allChecklists = data?.checklists || data || [];

 // Asegurar que es un array
 const checklistsArray = Array.isArray(allChecklists) ? allChecklists : [];

 // Filtrar por término de búsqueda
 let filtered = searchTerm
 ? checklistsArray.filter((c: any) => {
 const search = searchTerm.toLowerCase();
 return (
 (c.title || c.nombre || '').toLowerCase().includes(search) ||
 (c.description || '').toLowerCase().includes(search)
 );
 })
 : checklistsArray;

 // Filtrar por frecuencia
 if (frequencyFilter.length > 0) {
 filtered = filtered.filter((c: any) => {
 const freq = (c.frequency || '').toUpperCase();
 return frequencyFilter.includes(freq);
 });
 }

 // Filtrar por estado
 if (statusFilter.length > 0) {
 filtered = filtered.filter((c: any) => {
 const status = (c.status || c.estado || '').toUpperCase();
 // Mapear PUBLISHED a ACTIVE para la comparación
 const normalizedStatus = status === 'PUBLISHED' ? 'ACTIVE' : status;
 return statusFilter.includes(normalizedStatus);
 });
 }

 // Separar activas y archivadas
 const active = filtered.filter((c: any) =>
 c.status?.toUpperCase() !== 'ARCHIVED' && c.estado?.toUpperCase() !== 'ARCHIVED'
 );
 const archived = filtered.filter((c: any) =>
 c.status?.toUpperCase() === 'ARCHIVED' || c.estado?.toUpperCase() === 'ARCHIVED'
 );

 // Calcular estadísticas
 const published = filtered.filter((c: any) =>
 c.status?.toUpperCase() === 'PUBLISHED' ||
 c.status?.toUpperCase() === 'ACTIVE' ||
 c.estado?.toUpperCase() === 'PUBLISHED'
 ).length;
 const drafts = filtered.filter((c: any) =>
 c.status?.toUpperCase() === 'DRAFT' || c.estado?.toUpperCase() === 'DRAFT'
 ).length;

 return {
 checklists: showArchived ? archived : active,
 stats: {
 total: checklistsArray.length,
 published,
 drafts,
 },
 archivedCount: archived.length,
 };
 }, [data, searchTerm, showArchived, frequencyFilter, statusFilter]);

 // Loading state
 if (isLoading) {
 return (
 <div className={cn('space-y-4', className)}>
 <div className="flex gap-3">
 <Skeleton className="h-10 flex-1 max-w-sm" />
 <Skeleton className="h-10 w-10" />
 </div>
 <div className="flex gap-2">
 <Skeleton className="h-6 w-24" />
 <Skeleton className="h-6 w-20" />
 <Skeleton className="h-6 w-28" />
 </div>
 <div className="grid gap-3 md:grid-cols-2">
 {[1, 2, 3, 4].map((i) => (
 <Skeleton key={i} className="h-40" />
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
 No se pudieron cargar las checklists
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
 Selecciona una empresa para ver las checklists
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className={cn('space-y-4', className)}>
 {/* Header con búsqueda */}
 <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
 <div className="flex items-center gap-2 flex-1">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar checklists..."
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
 <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
 {frequencyFilter.length + statusFilter.length}
 </span>
 )}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-64" align="start">
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

 <Separator />

 {/* Filtro por estado */}
 <div className="space-y-2">
 <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
 <div className="flex flex-col gap-2">
 {statusOptions.map((option) => (
 <div key={option.value} className="flex items-center space-x-2">
 <Checkbox
 id={`status-${option.value}`}
 checked={statusFilter.includes(option.value)}
 onCheckedChange={() => toggleStatusFilter(option.value)}
 className="h-3.5 w-3.5"
 />
 <label
 htmlFor={`status-${option.value}`}
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
 </div>
 {!hideCreateButton && onCreateChecklist && (
 <Button onClick={onCreateChecklist}>
 <Plus className="h-4 w-4 mr-2" />
 Nueva Checklist
 </Button>
 )}
 </div>

 {/* Stats rápidas */}
 <div className="flex flex-wrap gap-2">
 <Badge variant="outline" className="gap-1">
 <ClipboardCheck className="h-3 w-3" />
 {stats.total} checklists
 </Badge>
 <Badge variant="outline" className="gap-1 text-success border-success">
 {stats.published} publicadas
 </Badge>
 {stats.drafts > 0 && (
 <Badge variant="outline" className="gap-1 text-warning-muted-foreground border-warning-muted">
 {stats.drafts} borradores
 </Badge>
 )}
 </div>

 {/* Lista de checklists */}
 {checklists.length === 0 ? (
 <Card>
 <CardContent className="p-8 text-center">
 <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">
 {showArchived ? 'Sin checklists archivadas' : 'Sin checklists'}
 </h3>
 <p className="text-sm text-muted-foreground mb-4">
 {searchTerm
 ? 'No se encontraron checklists con ese criterio de búsqueda'
 : showArchived
 ? 'No hay checklists archivadas'
 : 'No hay checklists creadas aún'}
 </p>
 {!searchTerm && !showArchived && onCreateChecklist && (
 <Button onClick={onCreateChecklist}>
 <Plus className="h-4 w-4 mr-2" />
 Crear primera checklist
 </Button>
 )}
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-3 md:grid-cols-2">
 {checklists.map((checklist: any) => (
 <Card
 key={checklist.id}
 className={cn(
 'hover:shadow-md transition-shadow cursor-pointer',
 (checklist.status === 'DRAFT' || checklist.estado === 'DRAFT') && 'border-dashed'
 )}
 onClick={() => onViewChecklist?.(checklist)}
 >
 <CardContent className="py-4 px-4">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2">
 <div className="rounded-lg bg-primary/10 p-2">
 <ListChecks className="h-4 w-4 text-primary" />
 </div>
 <div>
 <h4 className="font-medium text-sm">{checklist.title || checklist.nombre}</h4>
 <p className="text-xs text-muted-foreground">
 v{checklist.version || 1}
 {checklist.frequency && ` • ${translateFrequency(checklist.frequency)}`}
 </p>
 </div>
 </div>
 {getEstadoBadge(checklist.status || checklist.estado, checklist.hasInProgressExecution)}
 </div>

 {/* Tags */}
 {(checklist.tags || []).length > 0 && (
 <div className="flex flex-wrap items-center gap-2 mb-3">
 {checklist.tags.map((tag: string) => (
 <Badge key={tag} variant="outline" className="text-[10px]">
 {tag}
 </Badge>
 ))}
 </div>
 )}

 {/* Info */}
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <div className="flex items-center gap-3">
 <span className="flex items-center gap-1">
 <CheckCircle2 className="h-3 w-3" />
 {checklist.items?.length || checklist.itemCount || 0} items
 </span>
 {checklist.updatedAt && (
 <span className="flex items-center gap-1">
 <Calendar className="h-3 w-3" />
 {formatDate(checklist.updatedAt)}
 </span>
 )}
 </div>
 <div className="flex items-center gap-1">
 {/* Botón ejecutar - visible para todas las checklists excepto archivadas */}
 {onExecuteChecklist &&
 checklist.status?.toUpperCase() !== 'ARCHIVED' &&
 checklist.estado?.toUpperCase() !== 'ARCHIVED' && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7 text-success hover:text-success hover:bg-success-muted"
 onClick={(e) => {
 e.stopPropagation();
 onExecuteChecklist(checklist);
 }}
 title="Ejecutar checklist"
 >
 <Play className="h-3.5 w-3.5" />
 </Button>
 )}
 {onEditChecklist && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7"
 onClick={(e) => {
 e.stopPropagation();
 onEditChecklist(checklist);
 }}
 title="Editar"
 >
 <SquarePen className="h-3.5 w-3.5" />
 </Button>
 )}
 {onDuplicateChecklist && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7"
 onClick={(e) => {
 e.stopPropagation();
 onDuplicateChecklist(checklist);
 }}
 title="Duplicar"
 >
 <Copy className="h-3.5 w-3.5" />
 </Button>
 )}
 {onDeleteChecklist && (
 <Button
 variant="ghost"
 size="icon"
 className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
 onClick={(e) => {
 e.stopPropagation();
 onDeleteChecklist(checklist);
 }}
 title="Eliminar"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 {/* Archivadas */}
 {archivedCount > 0 && !showArchived && (
 <div className="pt-4 border-t">
 <Button
 variant="ghost"
 className="text-sm text-muted-foreground"
 onClick={() => setShowArchived(true)}
 >
 <Archive className="h-4 w-4 mr-2" />
 Ver archivadas ({archivedCount})
 </Button>
 </div>
 )}

 {showArchived && (
 <div className="pt-4 border-t">
 <Button
 variant="ghost"
 className="text-sm text-muted-foreground"
 onClick={() => setShowArchived(false)}
 >
 <ListChecks className="h-4 w-4 mr-2" />
 Ver activas
 </Button>
 </div>
 )}
 </div>
 );
}

export default PreventivoChecklistsView;
