'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
 History,
 CheckCircle2,
 XCircle,
 Activity,
 RefreshCw,
 Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
 HistorialFiltersComponent,
 type HistorialFilters,
} from '@/components/compras/historial-filters';
import {
 HistorialTimeline,
 type HistorialEvento,
} from '@/components/compras/historial-timeline';
import { useHistorialCompras } from '@/hooks/compras/use-historial-compras';

const DEFAULT_FILTERS: HistorialFilters = {
 search: '',
 entidad: 'all',
 accion: 'all',
 fechaDesde: '',
 fechaHasta: '',
 quickFilter: null,
};

export function HistorialComprasList() {
 const [filters, setFilters] = useState<HistorialFilters>(DEFAULT_FILTERS);

 const {
 eventos, total, stats, isLoading, isInitialLoad,
 isFetchingNextPage, hasNextPage, loadMore, invalidate,
 } = useHistorialCompras(filters);

 const handleClearFilters = () => setFilters(DEFAULT_FILTERS);

 const handleLoadMore = () => {
 if (hasNextPage && !isFetchingNextPage) loadMore();
 };

 const handleRefresh = () => invalidate();

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <History className="w-5 h-5 text-muted-foreground" />
 <h2 className="text-lg font-semibold">Historial de Compras</h2>
 <span className="text-xs text-muted-foreground">
 {total} evento(s)
 </span>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={handleRefresh}
 disabled={isLoading}
 >
 <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
 Actualizar
 </Button>
 </div>

 {/* KPIs */}
 <div className="grid grid-cols-4 gap-3">
 <Card
 className={cn('cursor-pointer transition-all', filters.quickFilter === 'hoy' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
 onClick={() => {
 if (filters.quickFilter === 'hoy') {
 setFilters({ ...filters, quickFilter: null, fechaDesde: '', fechaHasta: '' });
 } else {
 const todayStr = new Date().toISOString().split('T')[0];
 setFilters({ ...filters, quickFilter: 'hoy', fechaDesde: todayStr, fechaHasta: todayStr, accion: 'all' });
 }
 }}
 >
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-md bg-info-muted">
 <Activity className="w-3.5 h-3.5 text-info-muted-foreground" />
 </div>
 <div>
 <p className="text-xl font-bold">{stats.hoy}</p>
 <p className="text-[10px] text-muted-foreground">Hoy</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className={cn('cursor-pointer transition-all', filters.quickFilter === 'aprobaciones' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
 onClick={() => {
 if (filters.quickFilter === 'aprobaciones') {
 setFilters({ ...filters, quickFilter: null, accion: 'all' });
 } else {
 setFilters({ ...filters, quickFilter: 'aprobaciones', accion: 'APPROVE', fechaDesde: '', fechaHasta: '' });
 }
 }}
 >
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-md bg-success-muted">
 <CheckCircle2 className="w-3.5 h-3.5 text-success" />
 </div>
 <div>
 <p className="text-xl font-bold text-success">{stats.aprobaciones}</p>
 <p className="text-[10px] text-muted-foreground">Aprob. hoy</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className={cn('cursor-pointer transition-all', filters.quickFilter === 'rechazos' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
 onClick={() => {
 if (filters.quickFilter === 'rechazos') {
 setFilters({ ...filters, quickFilter: null, accion: 'all' });
 } else {
 setFilters({ ...filters, quickFilter: 'rechazos', accion: 'REJECT', fechaDesde: '', fechaHasta: '' });
 }
 }}
 >
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-md bg-destructive/10">
 <XCircle className="w-3.5 h-3.5 text-destructive" />
 </div>
 <div>
 <p className="text-xl font-bold text-destructive">{stats.rechazos}</p>
 <p className="text-[10px] text-muted-foreground">Rech. hoy</p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="hover:shadow-md transition-all">
 <CardContent className="p-3">
 <div className="flex items-center gap-2">
 <div className="p-1.5 rounded-md bg-purple-100">
 <History className="w-3.5 h-3.5 text-purple-600" />
 </div>
 <div>
 <p className="text-xl font-bold">{total}</p>
 <p className="text-[10px] text-muted-foreground">Total</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Filtros */}
 <HistorialFiltersComponent
 filters={filters}
 onChange={setFilters}
 onClear={handleClearFilters}
 />

 {/* Timeline */}
 <Card>
 <CardContent className="p-0">
 {isInitialLoad ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="h-8 w-8 animate-spin" />
 </div>
 ) : (
 <HistorialTimeline
 eventos={eventos}
 isLoading={isLoading}
 hasMore={!!hasNextPage}
 onLoadMore={handleLoadMore}
 />
 )}
 </CardContent>
 </Card>
 </div>
 );
}

export default HistorialComprasList;
