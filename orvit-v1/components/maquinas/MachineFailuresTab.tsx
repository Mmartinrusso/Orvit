'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Search,
  Plus,
  LayoutGrid,
  List,
  CheckCircle,
  Clock,
  AlertCircle,
  Wrench,
  Calendar,
  Timer,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FailureQuickReportDialog } from '@/components/corrective/failures/FailureQuickReportDialog';
import { FailureDetailSheet } from '@/components/corrective/failures/FailureDetailSheet';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MachineFailuresTabProps {
  machineId: number;
  machineName: string;
  components?: Array<{ id: number; name: string }>;
}

interface Failure {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  failureType?: string;
  reportedAt: string;
  resolvedAt?: string;
  machine?: { id: number; name: string };
  component?: { id: number; name: string };
  reportedBy?: { name: string };
  causedDowntime?: boolean;
  downtimeMinutes?: number;
  isRecurring?: boolean;
  occurrenceCount?: number;
  _count?: { occurrences?: number };
}

export default function MachineFailuresTab({
  machineId,
  machineName,
  components = [],
}: MachineFailuresTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userRole = user?.role?.toUpperCase() || '';
  const isAdmin = userRole.includes('ADMIN') || userRole === 'SUPERADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [quickReportOpen, setQuickReportOpen] = useState(false);
  const [selectedFailure, setSelectedFailure] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const { hasPermission: canCreateFailure } = usePermissionRobust('failures.create');
  const { hasPermission: canEditFailure } = usePermissionRobust('failures.edit');

  // Fetch failures for this machine
  const { data: failuresData, isLoading, refetch } = useQuery({
    queryKey: ['machine-failures-tab', machineId, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('machineId', machineId.toString());
      params.append('limit', '100');
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }
      const res = await fetch(`/api/failure-occurrences?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar fallas');
      const json = await res.json();
      return json.data || json || [];
    },
    staleTime: 30000,
  });

  const failures = failuresData || [];

  // Filter by search
  const filteredFailures = useMemo(() => {
    if (!searchTerm) return failures;
    const term = searchTerm.toLowerCase();
    return failures.filter((f: Failure) =>
      f.title?.toLowerCase().includes(term) ||
      f.description?.toLowerCase().includes(term) ||
      f.component?.name?.toLowerCase().includes(term)
    );
  }, [failures, searchTerm]);

  // Stats
  const stats = useMemo(() => ({
    total: failures.length,
    open: failures.filter((f: Failure) => f.status === 'OPEN').length,
    inProgress: failures.filter((f: Failure) => f.status === 'IN_PROGRESS').length,
    resolved: failures.filter((f: Failure) => f.status === 'RESOLVED' || f.status === 'CLOSED').length,
    withDowntime: failures.filter((f: Failure) => f.causedDowntime).length,
    critical: failures.filter((f: Failure) => f.priority?.toUpperCase() === 'CRITICAL').length,
  }), [failures]);

  const handleSelectFailure = (id: number) => {
    setSelectedFailure(id);
    setDetailSheetOpen(true);
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['machine-failures-tab', machineId] });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || priorityFilter !== 'all';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="destructive" className="text-[10px] px-1.5">Abierta</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-warning text-[10px] px-1.5">En Progreso</Badge>;
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="secondary" className="text-[10px] px-1.5">Resuelta</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] px-1.5">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    switch (priority.toUpperCase()) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="text-[10px] px-1.5">Crítica</Badge>;
      case 'HIGH':
        return <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5">Alta</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-warning/80 text-warning-foreground text-[10px] px-1.5">Media</Badge>;
      case 'LOW':
        return <Badge variant="outline" className="text-[10px] px-1.5">Baja</Badge>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 flex-1" />)}
        </div>
        <Skeleton className="h-10" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-x-hidden p-4 gap-3">
      {/* KPIs compactos - colores solo cuando hay valores que requieren atención */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {/* Total - siempre neutral */}
        <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50" onClick={() => setStatusFilter('all')}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        {/* Abiertas - rojo solo si > 0 */}
        <Card
          className={cn('p-2 cursor-pointer hover:shadow-md transition-shadow',
            stats.open > 0 ? 'bg-destructive/5 border-destructive/20' : 'border-border/50'
          )}
          onClick={() => setStatusFilter('OPEN')}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className={cn('h-4 w-4', stats.open > 0 ? 'text-destructive' : 'text-muted-foreground')} />
            <div>
              <p className="text-[10px] text-muted-foreground">Abiertas</p>
              <p className={cn('text-lg font-bold', stats.open > 0 && 'text-destructive')}>{stats.open}</p>
            </div>
          </div>
        </Card>
        {/* En Progreso - amber solo si > 0 */}
        <Card
          className={cn('p-2 cursor-pointer hover:shadow-md transition-shadow',
            stats.inProgress > 0 ? 'bg-warning-muted border-warning/20' : 'border-border/50'
          )}
          onClick={() => setStatusFilter('IN_PROGRESS')}
        >
          <div className="flex items-center gap-2">
            <Clock className={cn('h-4 w-4', stats.inProgress > 0 ? 'text-warning' : 'text-muted-foreground')} />
            <div>
              <p className="text-[10px] text-muted-foreground">En Progreso</p>
              <p className={cn('text-lg font-bold', stats.inProgress > 0 && 'text-warning')}>{stats.inProgress}</p>
            </div>
          </div>
        </Card>
        {/* Resueltas - siempre neutral (positivo, no requiere atención) */}
        <Card className="p-2 cursor-pointer hover:shadow-md transition-shadow border-border/50" onClick={() => setStatusFilter('RESOLVED')}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Resueltas</p>
              <p className="text-lg font-bold">{stats.resolved}</p>
            </div>
          </div>
        </Card>
        {/* Con Parada - destacar solo si > 0 (importante) */}
        <Card className={cn('p-2 border-border/50', stats.withDowntime > 0 && 'bg-primary/5 border-primary/20')}>
          <div className="flex items-center gap-2">
            <Timer className={cn('h-4 w-4', stats.withDowntime > 0 ? 'text-primary' : 'text-muted-foreground')} />
            <div>
              <p className="text-[10px] text-muted-foreground">Con Parada</p>
              <p className={cn('text-lg font-bold', stats.withDowntime > 0 && 'text-primary')}>{stats.withDowntime}</p>
            </div>
          </div>
        </Card>
        {/* Críticas - destacar solo si > 0 */}
        <Card className={cn('p-2 border-border/50', stats.critical > 0 && 'bg-destructive/5 border-destructive/20')}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn('h-4 w-4', stats.critical > 0 ? 'text-destructive' : 'text-muted-foreground')} />
            <div>
              <p className="text-[10px] text-muted-foreground">Críticas</p>
              <p className={cn('text-lg font-bold', stats.critical > 0 && 'text-destructive')}>{stats.critical}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fallas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="OPEN">Abiertas</SelectItem>
            <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
            <SelectItem value="RESOLVED">Resueltas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="CRITICAL">Crítica</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Media</SelectItem>
            <SelectItem value="LOW">Baja</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpiar
          </Button>
        )}
        <div className="flex-1" />
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}
          className="border rounded-md h-8"
        >
          <ToggleGroupItem value="grid" className="h-8 w-8 p-0">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className="h-8 w-8 p-0">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
        {(canCreateFailure || isAdmin) && (
          <Button size="sm" onClick={() => setQuickReportOpen(true)} className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Reportar
          </Button>
        )}
      </div>

      {/* Lista de Fallas */}
      <ScrollArea className="flex-1 min-h-0">
        {filteredFailures.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No hay fallas registradas</p>
            <p className="text-xs mt-1">
              {hasActiveFilters ? 'Intenta con otros filtros' : 'Esta máquina no tiene fallas reportadas'}
            </p>
            {(canCreateFailure || isAdmin) && !hasActiveFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickReportOpen(true)}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-1" />
                Reportar Primera Falla
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredFailures.map((failure: Failure) => (
              <Card
                key={failure.id}
                className="p-3 cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
                onClick={() => handleSelectFailure(failure.id)}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium line-clamp-2 flex-1">{failure.title}</h4>
                    {getStatusBadge(failure.status)}
                  </div>
                  {failure.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{failure.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getPriorityBadge(failure.priority)}
                    {failure.component && (
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        <Wrench className="h-2.5 w-2.5 mr-0.5" />
                        {failure.component.name}
                      </Badge>
                    )}
                    {failure.causedDowntime && (
                      <Badge variant="destructive" className="text-[10px] px-1.5">
                        <Timer className="h-2.5 w-2.5 mr-0.5" />
                        Parada
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(failure.reportedAt), 'dd/MM/yy HH:mm', { locale: es })}
                    </span>
                    {failure.reportedBy && (
                      <span className="truncate max-w-[100px]">{failure.reportedBy.name}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredFailures.map((failure: Failure) => (
              <Card
                key={failure.id}
                className="p-2.5 cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
                onClick={() => handleSelectFailure(failure.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{failure.title}</span>
                      {getPriorityBadge(failure.priority)}
                      {failure.causedDowntime && (
                        <Badge variant="destructive" className="text-[10px] px-1">Parada</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {failure.component && <span>{failure.component.name}</span>}
                      <span>•</span>
                      <span>{format(new Date(failure.reportedAt), 'dd/MM/yy HH:mm', { locale: es })}</span>
                      {failure.reportedBy && (
                        <>
                          <span>•</span>
                          <span>{failure.reportedBy.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(failure.status)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Quick Report Dialog */}
      <FailureQuickReportDialog
        open={quickReportOpen}
        onOpenChange={setQuickReportOpen}
        preselectedMachineId={machineId}
      />

      {/* Failure Detail Sheet */}
      <FailureDetailSheet
        failureId={selectedFailure}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) {
            setSelectedFailure(null);
            handleRefresh();
          }
        }}
      />
    </div>
  );
}
