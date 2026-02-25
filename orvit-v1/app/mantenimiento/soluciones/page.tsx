'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, List, Search, X, Lightbulb, CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SolutionCard, Solution } from '@/components/solutions/SolutionCard';
import { SolutionDetailDialog } from '@/components/solutions/SolutionDetailDialog';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 40;

// Map SolutionApplied API data → Solution interface for SolutionCard
function mapToSolution(sa: any): Solution {
  return {
    id: sa.id,
    title: sa.failureOccurrence?.title || sa.diagnosis?.substring(0, 80) || `Solución #${sa.id}`,
    description: sa.diagnosis,
    rootCause: sa.confirmedCause || sa.diagnosis,
    solution: sa.solution,
    machineName: sa.failureOccurrence?.machine?.name,
    machineId: sa.failureOccurrence?.machineId,
    componentName: sa.failureOccurrence?.component?.name,
    componentId: sa.failureOccurrence?.component?.id,
    subcomponentNames: sa.failureOccurrence?.subComponent?.name || undefined,
    completedDate: sa.performedAt,
    createdAt: sa.createdAt,
    executedBy: sa.performedBy ? { id: sa.performedBy.id, name: sa.performedBy.name } : undefined,
    effectiveness: sa.effectiveness,
    priority: undefined,
    status: sa.outcome,
    attachments: sa.attachments || [],
    _workOrder: sa.workOrder,
  };
}

export default function SolucionesPage() {
  const { currentCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  const [activeKPI, setActiveKPI] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Build query params
  const queryParams = useMemo(() => {
    const p: Record<string, string> = { mode: 'history', limit: String(PAGE_SIZE) };
    if (debouncedSearch) p.search = debouncedSearch;
    if (machineFilter !== 'ALL') p.machineId = machineFilter;
    if (outcomeFilter !== 'ALL') p.outcome = outcomeFilter;
    if (activeKPI === 'worked') p.outcome = 'FUNCIONÓ';
    if (activeKPI === 'partial') p.outcome = 'PARCIAL';
    if (activeKPI === 'failed') p.outcome = 'NO_FUNCIONÓ';
    return p;
  }, [debouncedSearch, machineFilter, outcomeFilter, activeKPI]);

  // Main query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['solutions-applied', currentCompany?.id, queryParams],
    queryFn: async () => {
      if (!currentCompany?.id) return { data: [], pagination: { total: 0, hasMore: false } };

      const params = new URLSearchParams(queryParams);
      const response = await fetch(`/api/solutions-applied?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching solutions');
      return response.json();
    },
    enabled: !!currentCompany?.id,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  // Totals query (no filters, for KPIs)
  const { data: totalsData } = useQuery({
    queryKey: ['solutions-applied-totals', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;

      const [allRes, workedRes, partialRes, failedRes] = await Promise.all([
        fetch('/api/solutions-applied?mode=history&limit=1'),
        fetch('/api/solutions-applied?mode=history&limit=1&outcome=FUNCION%C3%93'),
        fetch('/api/solutions-applied?mode=history&limit=1&outcome=PARCIAL'),
        fetch('/api/solutions-applied?mode=history&limit=1&outcome=NO_FUNCION%C3%93'),
      ]);

      const [all, worked, partial, failed] = await Promise.all([
        allRes.ok ? allRes.json() : { pagination: { total: 0 } },
        workedRes.ok ? workedRes.json() : { pagination: { total: 0 } },
        partialRes.ok ? partialRes.json() : { pagination: { total: 0 } },
        failedRes.ok ? failedRes.json() : { pagination: { total: 0 } },
      ]);

      return {
        total: all.pagination?.total || 0,
        worked: worked.pagination?.total || 0,
        partial: partial.pagination?.total || 0,
        failed: failed.pagination?.total || 0,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
  });

  const solutions: Solution[] = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map(mapToSolution);
  }, [data]);

  const totalResults = data?.pagination?.total || 0;
  const hasMore = data?.pagination?.hasMore || false;

  // Machine list from loaded results
  const solutionMachines = useMemo(() => {
    const machineMap = new Map<number, string>();
    solutions.forEach((sol) => {
      if (sol.machineId && sol.machineName) {
        machineMap.set(sol.machineId, sol.machineName);
      }
    });
    return Array.from(machineMap, ([id, name]) => ({ id, name }));
  }, [solutions]);

  const stats = totalsData || { total: 0, worked: 0, partial: 0, failed: 0 };
  const hasActiveFilters = searchTerm || machineFilter !== 'ALL' || outcomeFilter !== 'ALL' || activeKPI;

  const clearFilters = () => {
    setSearchTerm('');
    setMachineFilter('ALL');
    setOutcomeFilter('ALL');
    setActiveKPI(null);
  };

  const kpiDefinitions = [
    {
      key: 'total',
      title: 'Total',
      value: stats.total,
      icon: Lightbulb,
      iconColor: 'text-warning-muted-foreground',
    },
    {
      key: 'worked',
      title: 'Funcionaron',
      value: stats.worked,
      icon: CheckCircle2,
      iconColor: 'text-success',
    },
    {
      key: 'partial',
      title: 'Parciales',
      value: stats.partial,
      icon: AlertTriangle,
      iconColor: 'text-warning-muted-foreground',
    },
    {
      key: 'failed',
      title: 'No Funcionaron',
      value: stats.failed,
      icon: XCircle,
      iconColor: 'text-destructive',
    },
  ];

  const isKPIActive = (key: string) => activeKPI === key;

  const handleKPIClick = (key: string) => {
    if (key === 'total') {
      setActiveKPI(null);
      setOutcomeFilter('ALL');
      return;
    }
    if (activeKPI === key) {
      setActiveKPI(null);
      setOutcomeFilter('ALL');
    } else {
      setActiveKPI(key);
      setOutcomeFilter('ALL'); // KPI overrides dropdown
    }
  };

  return (
    <div className="h-screen sidebar-shell flex flex-col min-h-0">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">
                Soluciones
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Base de conocimiento
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as 'grid' | 'list')}
              className="border border-border rounded-lg bg-background shrink-0"
            >
              <ToggleGroupItem value="grid" aria-label="Vista de cuadrícula" className="h-9 px-3 data-[state=on]:bg-muted">
                <LayoutGrid className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Vista de lista" className="h-9 px-3 data-[state=on]:bg-muted">
                <List className="h-3.5 w-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 md:px-6 py-4 space-y-4">
          {/* KPIs */}
          {isLoading && !totalsData ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <Skeleton className="h-3 w-[80px] mb-2" />
                        <Skeleton className="h-7 w-[40px]" />
                      </div>
                      <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpiDefinitions.map((kpi) => {
                const Icon = kpi.icon;
                const isActive = isKPIActive(kpi.key);

                return (
                  <Card
                    key={kpi.key}
                    className={cn(
                      'cursor-pointer transition-all duration-200 border-border bg-card',
                      'hover:shadow-md hover:border-border/80',
                      kpi.key !== 'total' && isActive && 'ring-2 ring-ring/30 border-ring/50 bg-accent/30 shadow-sm'
                    )}
                    onClick={() => handleKPIClick(kpi.key)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground truncate mb-1">
                            {kpi.title}
                          </p>
                          <p className="text-2xl font-normal text-foreground tabular-nums">
                            {kpi.value}
                          </p>
                        </div>
                        <div className={cn(
                          'flex items-center justify-center w-10 h-10 rounded-xl',
                          'bg-muted/50',
                          isActive && 'bg-primary/10'
                        )}>
                          <Icon className={cn('w-5 h-5', kpi.iconColor)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por diagnóstico, solución..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-background"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Máquina */}
            {solutionMachines.length > 0 && (
              <Select value={machineFilter} onValueChange={setMachineFilter}>
                <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs bg-background">
                  <SelectValue placeholder="Máquina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  {solutionMachines.map((machine) => (
                    <SelectItem key={machine.id} value={machine.id.toString()}>
                      {machine.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Limpiar filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </Button>
            )}

            {/* Contador */}
            <div className="ml-auto text-xs text-muted-foreground">
              {solutions.length} de {totalResults} resultado{totalResults !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : solutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'No se encontraron soluciones con los filtros aplicados'
                  : 'No hay soluciones documentadas'}
              </p>
            </div>
          ) : (
            <>
              <div className={cn(
                viewMode === 'grid'
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                  : "flex flex-col gap-2"
              )}>
                {solutions.map((solution: Solution) => (
                  <SolutionCard
                    key={solution.id}
                    solution={solution}
                    onClick={setSelectedSolution}
                    variant={viewMode === 'list' ? 'compact' : 'default'}
                  />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-2 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    disabled={isFetching}
                  >
                    <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                    {isFetching ? 'Cargando...' : `Mostrar más (${totalResults - solutions.length} restantes)`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Solution Detail Dialog */}
      <SolutionDetailDialog
        solution={selectedSolution}
        isOpen={!!selectedSolution}
        onOpenChange={(open) => {
          if (!open) setSelectedSolution(null);
        }}
      />
    </div>
  );
}
