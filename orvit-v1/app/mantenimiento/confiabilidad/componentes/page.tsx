'use client';

import { formatNumber } from '@/lib/utils';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Cog,
  AlertTriangle,
  ShieldAlert,
  BarChart3,
  Timer,
  Wrench
} from 'lucide-react';

interface ComponentsData {
  period: { days: number; startDate: string; machineId?: number };
  components: Array<{
    componentId: number;
    componentName: string;
    machineName: string | null;
    machineId: number | null;
    criticality: number | null;
    isSafetyCritical: boolean;
    failureCount: number;
    mttrMinutes: number | null;
    mtbfHours: number | null;
  }>;
  kpis: {
    totalComponents: number;
    totalFailures: number;
    safetyCriticalFailing: number;
    topComponentName: string | null;
    topComponentFailures: number;
    avgMttrMinutes: number | null;
  };
}

async function fetchComponentsReliability(period: number): Promise<ComponentsData> {
  const res = await fetch(`/api/metrics/components-reliability?period=${period}`);
  if (!res.ok) throw new Error('Error al cargar datos');
  const json = await res.json();
  return json.data;
}

function formatMttr(minutes: number | null): string {
  if (minutes === null) return 'N/A';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  valueColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor ?? ''}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default function ConfiabilidadComponentesPage() {
  const [period, setPeriod] = useState(90);

  const { data, isLoading, error } = useQuery({
    queryKey: ['components-reliability', period],
    queryFn: () => fetchComponentsReliability(period),
  });

  const kpis = data?.kpis;
  const components = data?.components ?? [];

  // Máx fallas para barra de progreso
  const maxFailures = components.length > 0 ? Math.max(...components.map(c => c.failureCount), 1) : 1;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Confiabilidad por Componentes</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">Error al cargar datos de componentes</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Confiabilidad por Componentes</h1>
          <p className="text-muted-foreground">
            Análisis de fallas y tiempos de reparación a nivel de componente
          </p>
        </div>
        <Select value={period.toString()} onValueChange={v => setPeriod(parseInt(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="60">Últimos 60 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
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
      ) : kpis ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard
            title="Componentes con Fallas"
            value={kpis.totalComponents.toString()}
            subtitle={`${kpis.totalFailures} fallas en el período`}
            icon={Cog}
            iconColor="text-muted-foreground"
          />
          <KPICard
            title="Críticos de Seguridad"
            value={kpis.safetyCriticalFailing.toString()}
            subtitle="Componentes safety-critical afectados"
            icon={ShieldAlert}
            iconColor={kpis.safetyCriticalFailing > 0 ? 'text-destructive' : 'text-muted-foreground'}
            valueColor={kpis.safetyCriticalFailing > 0 ? 'text-destructive' : undefined}
          />
          <KPICard
            title="Componente Top"
            value={kpis.topComponentName ? `${kpis.topComponentFailures} fallas` : 'N/A'}
            subtitle={kpis.topComponentName ?? 'Sin fallas registradas'}
            icon={BarChart3}
            iconColor="text-warning-muted-foreground"
          />
          <KPICard
            title="MTTR Promedio"
            value={formatMttr(kpis.avgMttrMinutes)}
            subtitle="Tiempo medio de reparación"
            icon={Timer}
            iconColor="text-info-muted-foreground"
          />
        </div>
      ) : null}

      {/* Tabla de componentes */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : components.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Cog className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-1">Sin datos de componentes</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                No se registraron fallas con componente identificado en los últimos {period} días.
                Asegurate de vincular fallas a componentes al crear órdenes de trabajo.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Componentes — Top {components.length} por fallas
            </CardTitle>
            <CardDescription>
              Ordenados por cantidad de fallas — mayor es más problemático
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Componente</TableHead>
                  <TableHead className="hidden md:table-cell">Máquina</TableHead>
                  <TableHead className="text-right">Fallas</TableHead>
                  <TableHead className="hidden sm:table-cell">Frecuencia</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">MTTR</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">MTBF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((comp, idx) => {
                  const pct = maxFailures > 0 ? (comp.failureCount / maxFailures) * 100 : 0;
                  return (
                    <TableRow key={comp.componentId}>
                      <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {comp.isSafetyCritical && (
                            <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          {!comp.isSafetyCritical && comp.failureCount >= 3 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning-muted-foreground shrink-0" />
                          )}
                          <div>
                            <div className="font-medium text-sm">{comp.componentName}</div>
                            {comp.criticality !== null && (
                              <div className="text-xs text-muted-foreground">
                                Criticidad: {comp.criticality}/10
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {comp.machineName ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={comp.failureCount >= 5 ? 'destructive' : comp.failureCount >= 2 ? 'secondary' : 'outline'}>
                          {comp.failureCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={pct}
                            className={`h-2 w-20 shrink-0 ${
                              pct > 75 ? '[&>div]:bg-destructive' :
                              pct > 40 ? '[&>div]:bg-yellow-500' : ''
                            }`}
                          />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatNumber(pct, 0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell text-sm">
                        {formatMttr(comp.mttrMinutes)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-sm text-muted-foreground">
                        {comp.mtbfHours !== null ? `${formatNumber(comp.mtbfHours, 1)}h` : 'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Nota informativa si hay safety-critical */}
      {!isLoading && (kpis?.safetyCriticalFailing ?? 0) > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {kpis!.safetyCriticalFailing} componente{kpis!.safetyCriticalFailing > 1 ? 's' : ''} de seguridad crítica con fallas
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los componentes marcados como <strong>safety-critical</strong> requieren atención inmediata. Revisá el plan de mantenimiento preventivo para evitar recurrencias.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
