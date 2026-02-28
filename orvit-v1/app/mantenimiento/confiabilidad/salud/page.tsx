'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface HealthScoreData {
  machines: Array<{
    id: number;
    name: string;
    nickname: string | null;
    healthScore: number | null;
    badge: { label: string; color: 'green' | 'yellow' | 'red' | 'gray'; emoji: string };
    lastUpdated: string | null;
  }>;
  summary: {
    average: number;
    critical: number;
    warning: number;
    healthy: number;
    totalMachines: number;
  } | null;
}

async function fetchHealthScores(): Promise<HealthScoreData> {
  const res = await fetch('/api/maintenance/health-score');
  if (!res.ok) throw new Error('Error al cargar salud de activos');
  return res.json();
}

function ScoreBadgeVariant(color: 'green' | 'yellow' | 'red' | 'gray'): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (color === 'green') return 'default';
  if (color === 'yellow') return 'secondary';
  if (color === 'red') return 'destructive';
  return 'outline';
}

function HealthBar({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground text-sm">Sin datos</span>;
  }
  const colorClass =
    score < 50
      ? '[&>div]:bg-destructive'
      : score < 80
      ? '[&>div]:bg-yellow-500'
      : '';
  return (
    <div className="flex items-center gap-2">
      <Progress value={score} className={`h-2 w-24 ${colorClass}`} />
      <span className="text-sm font-medium tabular-nums w-8">{score}</span>
    </div>
  );
}

export default function SaludActivosPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['health-scores'],
    queryFn: fetchHealthScores
  });

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salud de Activos</h1>
          <p className="text-muted-foreground">
            Estado de salud de máquinas basado en fallas, PMs vencidos y tendencia de MTTR
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
              <CardTitle className="text-sm font-medium">Óptimo</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{summary?.healthy ?? 0}</div>
              <p className="text-xs text-muted-foreground">Activos en buen estado (≥80)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atención</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning-muted-foreground">
                {summary?.warning ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Requieren monitoreo (50–79)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crítico</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary?.critical ?? 0}</div>
              <p className="text-xs text-muted-foreground">Acción inmediata (&lt;50)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Promedio</CardTitle>
              <Activity className="h-4 w-4 text-info-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? `${summary.average}` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary ? `${summary.totalMachines} máquinas activas` : 'Sin datos'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribution bar (visible when data loaded) */}
      {!isLoading && summary && summary.totalMachines > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Distribución de salud</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {summary.totalMachines} máquinas activas
              </span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {summary.healthy > 0 && (
                <div
                  className="bg-success/80"
                  style={{ width: `${(summary.healthy / summary.totalMachines) * 100}%` }}
                  title={`Óptimo: ${summary.healthy}`}
                />
              )}
              {summary.warning > 0 && (
                <div
                  className="bg-yellow-500/70"
                  style={{ width: `${(summary.warning / summary.totalMachines) * 100}%` }}
                  title={`Atención: ${summary.warning}`}
                />
              )}
              {summary.critical > 0 && (
                <div
                  className="bg-destructive/80"
                  style={{ width: `${(summary.critical / summary.totalMachines) * 100}%` }}
                  title={`Crítico: ${summary.critical}`}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-success/80" />
                Óptimo ({summary.healthy})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-yellow-500/70" />
                Atención ({summary.warning})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-destructive/80" />
                Crítico ({summary.critical})
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Machine health table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Salud por Máquina
          </CardTitle>
          <CardDescription>
            Estado actual de cada activo — ordenado de peor a mejor health score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <p className="text-center text-destructive py-8">Error al cargar datos de salud</p>
          ) : !data?.machines.length ? (
            <p className="text-center text-muted-foreground py-8">No hay máquinas activas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.machines.map(machine => (
                  <TableRow key={machine.id}>
                    <TableCell className="font-medium">
                      <div>{machine.name}</div>
                      {machine.nickname && (
                        <div className="text-xs text-muted-foreground">{machine.nickname}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ScoreBadgeVariant(machine.badge.color)}>
                        {machine.badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <HealthBar score={machine.healthScore} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-xs text-muted-foreground">
                      {machine.lastUpdated
                        ? new Intl.DateTimeFormat('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }).format(new Date(machine.lastUpdated))
                        : 'Nunca'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
