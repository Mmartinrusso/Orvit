'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Lightbulb,
  CheckCircle2,
  Star,
  Search,
  X,
  RefreshCw,
  Repeat2,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SolutionsData {
  solutions: Array<{
    id: number;
    title: string;
    rootCause: string | null;
    preventiveActions: string | null;
    effectiveness: number | null;
    isPreferred: boolean;
    appliedAt: string;
    appliedByName: string;
    actualHours: number | null;
    reuseCount: number;
    avgAppEffectiveness: number | null;
    machine: { id: number | null; name: string | null };
    failureCategory: string | null;
    occurrenceTitle: string | null;
  }>;
  kpis: {
    total: number;
    preferred: number;
    avgEffectiveness: number | null;
    mostUsedTitle: string | null;
    mostUsedCount: number;
  };
}

async function fetchSolutions(search: string): Promise<SolutionsData> {
  const params = new URLSearchParams({ limit: '100' });
  if (search) params.set('search', search);
  const res = await fetch(`/api/metrics/solutions?${params}`);
  if (!res.ok) throw new Error('Error al cargar soluciones');
  return res.json();
}

function EffectivenessStars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">Sin rating</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= score ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const map: Record<string, string> = {
    MECANICA: 'Mecánica',
    ELECTRICA: 'Eléctrica',
    ELECTRONICA: 'Electrónica',
    HIDRAULICA: 'Hidráulica',
    NEUMATICA: 'Neumática',
    SOFTWARE: 'Software',
    OTRO: 'Otro',
  };
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {map[category] ?? category}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(new Date(iso));
}

export default function SolucionesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce manual: actualizar el search debounced con un pequeño delay
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((handleSearch as any).__timer);
    (handleSearch as any).__timer = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['solutions-kb', debouncedSearch],
    queryFn: () => fetchSolutions(debouncedSearch),
  });

  const kpis = data?.kpis;
  const solutions = data?.solutions ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Base de Soluciones</h1>
          <p className="text-muted-foreground">
            Conocimiento acumulado de diagnósticos y soluciones aplicadas a fallas
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Soluciones Registradas</CardTitle>
              <Lightbulb className="h-4 w-4 text-warning-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">Total en base de conocimiento</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Preferidas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{kpis?.preferred ?? 0}</div>
              <p className="text-xs text-muted-foreground">Marcadas como recomendadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efectividad Promedio</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpis?.avgEffectiveness != null ? `${kpis.avgEffectiveness}/5` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Rating promedio de soluciones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Más Reutilizada</CardTitle>
              <Repeat2 className="h-4 w-4 text-info-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpis?.mostUsedCount ?? 0}×
              </div>
              <p className="text-xs text-muted-foreground truncate" title={kpis?.mostUsedTitle ?? undefined}>
                {kpis?.mostUsedTitle ?? 'Sin reutilización'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla con búsqueda */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Todas las Soluciones
              </CardTitle>
              <CardDescription>
                Diagnósticos y resoluciones documentadas — ordenadas por recomendación y efectividad
              </CardDescription>
            </div>
            {/* Búsqueda */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar solución, máquina, causa..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-10 pr-8"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setDebouncedSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-destructive py-8">Error al cargar soluciones</p>
          ) : solutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-1">
                {debouncedSearch ? 'Sin resultados' : 'Sin soluciones registradas'}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {debouncedSearch
                  ? `No se encontraron soluciones que coincidan con "${debouncedSearch}"`
                  : 'Las soluciones se registran al resolver fallas en el módulo de OTs correctivas.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solución</TableHead>
                  <TableHead className="hidden md:table-cell">Máquina / Categoría</TableHead>
                  <TableHead className="hidden sm:table-cell">Efectividad</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Reusos</TableHead>
                  <TableHead className="hidden lg:table-cell">Tiempo</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solutions.map(solution => (
                  <TableRow key={solution.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {solution.isPreferred && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                          )}
                          <span className="font-medium text-sm">{solution.title}</span>
                        </div>
                        {solution.rootCause && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            Causa: {solution.rootCause}
                          </p>
                        )}
                        {solution.occurrenceTitle && !solution.rootCause && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {solution.occurrenceTitle}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-1">
                        {solution.machine.name && (
                          <div className="text-sm">{solution.machine.name}</div>
                        )}
                        <CategoryBadge category={solution.failureCategory} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <EffectivenessStars score={solution.effectiveness} />
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {solution.reuseCount > 0 ? (
                        <Badge variant="secondary">
                          <Repeat2 className="h-3 w-3 mr-1" />
                          {solution.reuseCount}×
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {solution.actualHours != null ? (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {solution.actualHours < 1
                            ? `${Math.round(solution.actualHours * 60)}m`
                            : `${solution.actualHours}h`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-xs text-muted-foreground">
                      {formatDate(solution.appliedAt)}
                      <div className="text-muted-foreground/60">{solution.appliedByName}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {solutions.length > 0 && (
            <p className="text-xs text-muted-foreground text-right mt-3">
              {solutions.length} solución{solutions.length !== 1 ? 'es' : ''}
              {debouncedSearch ? ` que coinciden con "${debouncedSearch}"` : ' en total'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
