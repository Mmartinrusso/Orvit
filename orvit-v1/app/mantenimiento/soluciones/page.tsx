'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, List, Search, X, Lightbulb, AlertTriangle, Wrench, Shield, FileText } from 'lucide-react';
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
import { cn } from '@/lib/utils';

export default function SolucionesPage() {
  const { currentCompany, currentSector } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);
  const [activeKPI, setActiveKPI] = useState<string | null>(null);

  // Fetch completed corrective work orders with solution data
  const { data: solutions, isLoading } = useQuery({
    queryKey: ['solutions', currentCompany?.id, currentSector?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const params = new URLSearchParams({
        companyId: currentCompany.id.toString(),
        type: 'CORRECTIVE',
        status: 'COMPLETED'
      });

      if (currentSector?.id) {
        params.append('sectorId', currentSector.id.toString());
      }

      const response = await fetch(`/api/work-orders?${params.toString()}`);
      if (!response.ok) throw new Error('Error fetching solutions');

      const workOrders = await response.json();

      return workOrders
        .filter((wo: any) => wo.solution || wo.rootCause || wo.correctiveActions)
        .map((wo: any) => ({
          id: wo.id,
          title: wo.title,
          description: wo.description,
          rootCause: wo.rootCause,
          solution: wo.solution,
          correctiveActions: wo.correctiveActions,
          preventiveActions: wo.preventiveActions,
          failureDescription: wo.failureDescription,
          machineId: wo.machineId,
          machineName: wo.machine?.name,
          componentId: wo.componentId,
          componentName: wo.component?.name,
          // Subcomponentes ya vienen procesados del API
          subcomponentNames: wo.subcomponentNames?.join(', ') || null,
          completedDate: wo.completedDate,
          createdAt: wo.createdAt,
          executedBy: wo.assignedTo || wo.assignedWorker,
          assignedTo: wo.assignedTo,
          priority: wo.priority,
          status: wo.status,
          attachments: wo.attachments || [],
          _workOrder: wo
        }));
    },
    enabled: !!currentCompany?.id,
    staleTime: 2 * 60 * 1000
  });

  // Stats
  const stats = useMemo(() => {
    if (!solutions) return { total: 0, withRootCause: 0, withPreventive: 0, withSolution: 0 };

    return {
      total: solutions.length,
      withRootCause: solutions.filter((s: Solution) => s.rootCause).length,
      withSolution: solutions.filter((s: Solution) => s.solution || s.correctiveActions).length,
      withPreventive: solutions.filter((s: Solution) => s.preventiveActions).length
    };
  }, [solutions]);

  // Filter solutions
  const filteredSolutions = useMemo(() => {
    if (!solutions) return [];

    return solutions.filter((sol: Solution) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          sol.title?.toLowerCase().includes(term) ||
          sol.rootCause?.toLowerCase().includes(term) ||
          sol.solution?.toLowerCase().includes(term) ||
          sol.correctiveActions?.toLowerCase().includes(term) ||
          sol.machineName?.toLowerCase().includes(term) ||
          sol.componentName?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (machineFilter !== 'ALL' && sol.machineId?.toString() !== machineFilter) {
        return false;
      }

      if (activeKPI === 'rootCause' && !sol.rootCause) return false;
      if (activeKPI === 'solution' && !sol.solution && !sol.correctiveActions) return false;
      if (activeKPI === 'preventive' && !sol.preventiveActions) return false;

      return true;
    });
  }, [solutions, searchTerm, machineFilter, activeKPI]);

  // Unique machines
  const solutionMachines = useMemo(() => {
    if (!solutions) return [];
    const machineMap = new Map();
    solutions.forEach((sol: Solution) => {
      if (sol.machineId && sol.machineName) {
        machineMap.set(sol.machineId, sol.machineName);
      }
    });
    return Array.from(machineMap, ([id, name]) => ({ id, name }));
  }, [solutions]);

  const hasActiveFilters = searchTerm || machineFilter !== 'ALL' || activeKPI;

  const clearFilters = () => {
    setSearchTerm('');
    setMachineFilter('ALL');
    setActiveKPI(null);
  };

  // KPI definitions matching Fallas style
  const kpiDefinitions = [
    {
      key: 'total',
      title: 'Total',
      value: stats.total,
      icon: Lightbulb,
      iconColor: 'text-warning-muted-foreground',
    },
    {
      key: 'rootCause',
      title: 'Con Causa Raíz',
      value: stats.withRootCause,
      icon: AlertTriangle,
      iconColor: 'text-destructive',
    },
    {
      key: 'solution',
      title: 'Documentadas',
      value: stats.withSolution,
      icon: Wrench,
      iconColor: 'text-success',
    },
    {
      key: 'preventive',
      title: 'Con Preventivas',
      value: stats.withPreventive,
      icon: Shield,
      iconColor: 'text-info-muted-foreground',
    },
  ];

  const isKPIActive = (key: string) => activeKPI === key;

  const handleKPIClick = (key: string) => {
    if (key === 'total') return;
    setActiveKPI(activeKPI === key ? null : key);
  };

  return (
    <div className="h-screen sidebar-shell flex flex-col min-h-0">
      {/* Header sticky - mismo que Fallas */}
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
          {/* KPIs - mismo estilo que FailureKPIs */}
          {isLoading ? (
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

          {/* Filters - mismo estilo que FailureFiltersBar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por título, causa raíz..."
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
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger className="h-9 w-[140px] text-xs bg-background">
                <SelectValue placeholder="Máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {solutionMachines.map((machine: any) => (
                  <SelectItem key={machine.id} value={machine.id.toString()}>
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
              {filteredSolutions.length} resultado{filteredSolutions.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : filteredSolutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'No se encontraron soluciones con los filtros aplicados'
                  : 'No hay soluciones documentadas'}
              </p>
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid'
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                : "flex flex-col gap-2"
            )}>
              {filteredSolutions.map((solution: Solution) => (
                <SolutionCard
                  key={solution.id}
                  solution={solution}
                  onClick={setSelectedSolution}
                  variant={viewMode === 'list' ? 'compact' : 'default'}
                />
              ))}
            </div>
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
