'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Timer,
  AlertTriangle,
  BarChart3,
  Activity
} from 'lucide-react';

interface ReliabilityData {
  period: {
    days: number;
    startDate: string;
    endDate: string;
    machinesCount: number;
  };
  global: {
    mtbf: { hours: number | null; formatted: string };
    mttr: { minutes: number | null; formatted: string };
    availability: { percentage: number | null; formatted: string };
    totalFailures: number;
    totalDowntime: { minutes: number; hours: number };
  };
  byMachine: Array<{
    machineId: number;
    machineName: string;
    failureCount: number;
    totalDowntimeMinutes: number;
    mtbfHours: number | null;
    mttrMinutes: number | null;
    availability: number | null;
  }>;
  pareto: Array<{
    machineId: number;
    machineName: string;
    failureCount: number;
    totalDowntimeMinutes: number;
  }>;
  trends: Array<{
    month: string;
    year: number;
    mtbfHours: number | null;
    mttrMinutes: number | null;
    failureCount: number;
    downtimeMinutes: number;
  }>;
}

async function fetchReliabilityMetrics(period: number): Promise<ReliabilityData> {
  const res = await fetch(`/api/metrics/reliability?period=${period}`);
  if (!res.ok) throw new Error('Error al cargar métricas');
  const json = await res.json();
  return json.data;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: ReliabilityData['trends'] }) {
  if (!data || data.length === 0) return null;

  const maxMtbf = Math.max(...data.map(d => d.mtbfHours || 0), 1);
  const maxMttr = Math.max(...data.map(d => d.mttrMinutes || 0), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Tendencia MTBF / MTTR (6 meses)
        </CardTitle>
        <CardDescription>
          Evolución de la confiabilidad en el tiempo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Simple bar chart representation */}
          <div className="grid grid-cols-6 gap-2">
            {data.map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="h-32 flex flex-col justify-end gap-1 mb-2">
                  {/* MTBF bar */}
                  <div
                    className="bg-success/80 rounded-t w-full mx-auto"
                    style={{
                      height: `${item.mtbfHours ? (item.mtbfHours / maxMtbf) * 100 : 0}%`,
                      minHeight: item.mtbfHours ? '4px' : '0'
                    }}
                    title={`MTBF: ${item.mtbfHours?.toFixed(1) || 'N/A'} hrs`}
                  />
                  {/* MTTR bar */}
                  <div
                    className="bg-info/80 rounded-t w-full mx-auto"
                    style={{
                      height: `${item.mttrMinutes ? (item.mttrMinutes / maxMttr) * 50 : 0}%`,
                      minHeight: item.mttrMinutes ? '4px' : '0'
                    }}
                    title={`MTTR: ${item.mttrMinutes || 'N/A'} min`}
                  />
                </div>
                <div className="text-xs font-medium">{item.month}</div>
                <div className="text-xs text-muted-foreground">{item.failureCount} fallas</div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success/80 rounded" />
              <span className="text-sm">MTBF (hrs)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-info/80 rounded" />
              <span className="text-sm">MTTR (min)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ParetoTable({ data }: { data: ReliabilityData['pareto'] }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pareto - Máquinas con más fallas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No hay fallas registradas en el período
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalFallas = data.reduce((sum, m) => sum + m.failureCount, 0);
  let accumulated = 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Pareto - Top 10 Máquinas Problemáticas
        </CardTitle>
        <CardDescription>
          Máquinas con mayor cantidad de fallas en el período
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead className="text-right">Fallas</TableHead>
              <TableHead className="text-right">% del Total</TableHead>
              <TableHead className="text-right">% Acumulado</TableHead>
              <TableHead className="text-right">Downtime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((machine, idx) => {
              const percentage = totalFallas > 0 ? (machine.failureCount / totalFallas) * 100 : 0;
              accumulated += percentage;

              return (
                <TableRow key={machine.machineId}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {idx < 3 && <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />}
                      {machine.machineName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={machine.failureCount > 5 ? "destructive" : "secondary"}>
                      {machine.failureCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {accumulated.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {machine.totalDowntimeMinutes < 60
                      ? `${machine.totalDowntimeMinutes}m`
                      : `${Math.floor(machine.totalDowntimeMinutes / 60)}h ${machine.totalDowntimeMinutes % 60}m`
                    }
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MachineReliabilityTable({ data }: { data: ReliabilityData['byMachine'] }) {
  const sortedData = [...data].sort((a, b) => (b.availability || 0) - (a.availability || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confiabilidad por Máquina</CardTitle>
        <CardDescription>
          Métricas individuales de cada máquina
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Máquina</TableHead>
              <TableHead className="text-right">Fallas</TableHead>
              <TableHead className="text-right">MTBF (hrs)</TableHead>
              <TableHead className="text-right">MTTR</TableHead>
              <TableHead className="text-right">Disponibilidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.slice(0, 15).map((machine) => (
              <TableRow key={machine.machineId}>
                <TableCell className="font-medium">{machine.machineName}</TableCell>
                <TableCell className="text-right">{machine.failureCount}</TableCell>
                <TableCell className="text-right">
                  {machine.mtbfHours !== null ? machine.mtbfHours.toFixed(1) : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  {machine.mttrMinutes !== null
                    ? machine.mttrMinutes < 60
                      ? `${machine.mttrMinutes}m`
                      : `${Math.floor(machine.mttrMinutes / 60)}h ${machine.mttrMinutes % 60}m`
                    : 'N/A'
                  }
                </TableCell>
                <TableCell className="text-right">
                  {machine.availability !== null ? (
                    <Badge
                      variant={
                        machine.availability >= 95 ? "default" :
                        machine.availability >= 85 ? "secondary" : "destructive"
                      }
                    >
                      {machine.availability}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function MTTRMTBFPage() {
  const [period, setPeriod] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reliability-metrics', period],
    queryFn: () => fetchReliabilityMetrics(period)
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MTTR / MTBF</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">Error al cargar métricas</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MTTR / MTBF</h1>
          <p className="text-muted-foreground">
            Métricas de tiempo medio entre fallas y tiempo medio de reparación
          </p>
        </div>
        <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="60">Últimos 60 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard
            title="MTBF"
            value={data.global.mtbf.formatted}
            subtitle="Tiempo medio entre fallas"
            icon={TrendingUp}
            iconColor="text-success"
          />
          <KPICard
            title="MTTR"
            value={data.global.mttr.formatted}
            subtitle="Tiempo medio de reparación"
            icon={TrendingDown}
            iconColor="text-info-muted-foreground"
          />
          <KPICard
            title="Disponibilidad"
            value={data.global.availability.formatted}
            subtitle="MTBF / (MTBF + MTTR)"
            icon={Timer}
            iconColor="text-purple-500"
          />
          <KPICard
            title="Total Fallas"
            value={data.global.totalFailures.toString()}
            subtitle={`Downtime: ${data.global.totalDowntime.hours}h`}
            icon={Clock}
            iconColor="text-warning-muted-foreground"
          />
        </div>
      ) : null}

      {/* Trend Chart */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : data ? (
        <TrendChart data={data.trends} />
      ) : null}

      {/* Pareto Table */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : data ? (
        <ParetoTable data={data.pareto} />
      ) : null}

      {/* Machine Reliability Table */}
      {isLoading ? null : data && data.byMachine.length > 0 ? (
        <MachineReliabilityTable data={data.byMachine} />
      ) : null}
    </div>
  );
}
