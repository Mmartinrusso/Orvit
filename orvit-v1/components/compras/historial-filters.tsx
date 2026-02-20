'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import {
 type AuditableEntity,
 type AuditAction,
 ENTIDAD_CONFIG,
 ACCION_CONFIG,
} from '@/lib/compras/audit-config';

export type QuickFilter =
 | 'hoy'
 | 'ayer'
 | '7dias'
 | '30dias'
 | 'aprobaciones'
 | 'rechazos'
 | null;

export interface HistorialFilters {
 search: string;
 entidad: AuditableEntity | 'all';
 accion: AuditAction | 'all';
 fechaDesde: string;
 fechaHasta: string;
 quickFilter: QuickFilter;
}

interface HistorialFiltersProps {
 filters: HistorialFilters;
 onChange: (filters: HistorialFilters) => void;
 onClear: () => void;
}

export function HistorialFiltersComponent({
 filters,
 onChange,
 onClear,
}: HistorialFiltersProps) {
 const [showAdvanced, setShowAdvanced] = useState(false);

 const handleQuickFilterChange = (qf: QuickFilter) => {
 const newFilters = { ...filters };

 // Toggle si es el mismo
 if (filters.quickFilter === qf) {
 newFilters.quickFilter = null;
 newFilters.fechaDesde = '';
 newFilters.fechaHasta = '';
 newFilters.accion = 'all';
 } else {
 newFilters.quickFilter = qf;

 // Calcular fechas
 const today = new Date();
 const todayStr = today.toISOString().split('T')[0];

 switch (qf) {
 case 'hoy':
 newFilters.fechaDesde = todayStr;
 newFilters.fechaHasta = todayStr;
 newFilters.accion = 'all';
 break;
 case 'ayer': {
 const yesterday = new Date(today);
 yesterday.setDate(yesterday.getDate() - 1);
 const yStr = yesterday.toISOString().split('T')[0];
 newFilters.fechaDesde = yStr;
 newFilters.fechaHasta = yStr;
 newFilters.accion = 'all';
 break;
 }
 case '7dias': {
 const d7 = new Date(today);
 d7.setDate(d7.getDate() - 7);
 newFilters.fechaDesde = d7.toISOString().split('T')[0];
 newFilters.fechaHasta = todayStr;
 newFilters.accion = 'all';
 break;
 }
 case '30dias': {
 const d30 = new Date(today);
 d30.setDate(d30.getDate() - 30);
 newFilters.fechaDesde = d30.toISOString().split('T')[0];
 newFilters.fechaHasta = todayStr;
 newFilters.accion = 'all';
 break;
 }
 case 'aprobaciones':
 newFilters.accion = 'APPROVE';
 newFilters.fechaDesde = '';
 newFilters.fechaHasta = '';
 break;
 case 'rechazos':
 newFilters.accion = 'REJECT';
 newFilters.fechaDesde = '';
 newFilters.fechaHasta = '';
 break;
 }
 }

 onChange(newFilters);
 };

 const hasActiveFilters =
 filters.search ||
 filters.entidad !== 'all' ||
 filters.accion !== 'all' ||
 filters.fechaDesde ||
 filters.fechaHasta;

 return (
 <div className="space-y-3">
 {/* Quick Filters (Chips) */}
 <div className="flex gap-2 flex-wrap">
 {(['hoy', 'ayer', '7dias', '30dias'] as QuickFilter[]).map((qf) => (
 <Button
 key={qf}
 variant={filters.quickFilter === qf ? 'default' : 'outline'}
 size="sm"
 className="h-6 text-[10px] px-2"
 onClick={() => handleQuickFilterChange(qf)}
 >
 {qf === 'hoy' && 'Hoy'}
 {qf === 'ayer' && 'Ayer'}
 {qf === '7dias' && '7 días'}
 {qf === '30dias' && '30 días'}
 </Button>
 ))}
 <div className="border-l mx-1" />
 <Button
 variant={filters.quickFilter === 'aprobaciones' ? 'default' : 'outline'}
 size="sm"
 className={cn('h-6 text-[10px] px-2', filters.quickFilter !== 'aprobaciones' && 'bg-success-muted hover:bg-success-muted text-success border-success-muted')}
 onClick={() => handleQuickFilterChange('aprobaciones')}
 >
 Aprobaciones
 </Button>
 <Button
 variant={filters.quickFilter === 'rechazos' ? 'default' : 'outline'}
 size="sm"
 className={cn('h-6 text-[10px] px-2', filters.quickFilter !== 'rechazos' && 'bg-destructive/10 hover:bg-destructive/10 text-destructive border-destructive/30')}
 onClick={() => handleQuickFilterChange('rechazos')}
 >
 Rechazos
 </Button>
 </div>

 {/* Search + Toggle Advanced */}
 <div className="flex gap-3 items-center">
 <div className="relative flex-1 max-w-xs">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
 <Input
 placeholder="Buscar OC-2026-..., REC-..."
 value={filters.search}
 onChange={(e) => onChange({ ...filters, search: e.target.value })}
 className="pl-8 h-8 text-xs"
 />
 </div>

 <Button
 variant="ghost"
 size="sm"
 onClick={() => setShowAdvanced(!showAdvanced)}
 className="text-[10px] gap-1 h-7"
 >
 Filtros avanzados
 {showAdvanced ? (
 <ChevronUp className="w-3 h-3" />
 ) : (
 <ChevronDown className="w-3 h-3" />
 )}
 </Button>

 {hasActiveFilters && (
 <Button
 variant="ghost"
 size="sm"
 onClick={onClear}
 className="text-[10px] gap-1 text-muted-foreground h-7"
 >
 <X className="w-3 h-3" />
 Limpiar
 </Button>
 )}
 </div>

 {/* Advanced Filters */}
 {showAdvanced && (
 <div className="grid grid-cols-4 gap-3 pt-2 border-t">
 {/* Tipo de documento */}
 <div className="space-y-1">
 <label className="text-[10px] text-muted-foreground">Tipo de documento</label>
 <Select
 value={filters.entidad}
 onValueChange={(v) =>
 onChange({ ...filters, entidad: v as AuditableEntity | 'all' })
 }
 >
 <SelectTrigger className="h-7 text-xs">
 <SelectValue placeholder="Todos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all" className="text-xs">
 Todos los documentos
 </SelectItem>
 {Object.entries(ENTIDAD_CONFIG).map(([key, config]) => (
 <SelectItem key={key} value={key} className="text-xs">
 {config.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Tipo de acción */}
 <div className="space-y-1">
 <label className="text-[10px] text-muted-foreground">Tipo de acción</label>
 <Select
 value={filters.accion}
 onValueChange={(v) =>
 onChange({
 ...filters,
 accion: v as AuditAction | 'all',
 quickFilter: null,
 })
 }
 >
 <SelectTrigger className="h-7 text-xs">
 <SelectValue placeholder="Todas" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all" className="text-xs">
 Todas las acciones
 </SelectItem>
 {Object.entries(ACCION_CONFIG).map(([key, config]) => (
 <SelectItem key={key} value={key} className="text-xs">
 {config.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Fecha desde */}
 <div className="space-y-1">
 <label className="text-[10px] text-muted-foreground">Desde</label>
 <DatePicker
 value={filters.fechaDesde}
 onChange={(date) =>
 onChange({ ...filters, fechaDesde: date, quickFilter: null })
 }
 placeholder="Desde"
 clearable
 className="h-7 text-xs"
 />
 </div>

 {/* Fecha hasta */}
 <div className="space-y-1">
 <label className="text-[10px] text-muted-foreground">Hasta</label>
 <DatePicker
 value={filters.fechaHasta}
 onChange={(date) =>
 onChange({ ...filters, fechaHasta: date, quickFilter: null })
 }
 placeholder="Hasta"
 clearable
 className="h-7 text-xs"
 />
 </div>
 </div>
 )}
 </div>
 );
}

export default HistorialFiltersComponent;
