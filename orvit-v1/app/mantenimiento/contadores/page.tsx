'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { CounterPanel } from '@/components/machines';
import {
  Gauge,
  AlertTriangle,
  Clock,
  TrendingUp,
  Wrench,
} from 'lucide-react';

interface Machine {
  id: number;
  name: string;
  counters?: Array<{
    id: number;
    name: string;
    unit: string;
    currentValue: number;
    lastReadingAt: string | null;
    triggers?: Array<{
      id: number;
      triggerEvery: number;
      nextTriggerValue: number;
      checklist: { id: number; title: string };
    }>;
  }>;
}

export default function ContadoresPage() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch all machines with counters
  const { data: machinesData, isLoading } = useQuery({
    queryKey: ['machines-with-counters', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { machines: [] };
      const res = await fetch(`/api/machines?companyId=${currentCompany.id}&includeCounters=true`);
      if (!res.ok) throw new Error('Error fetching machines');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const machines: Machine[] = machinesData?.machines || [];

  // Calculate summary
  const summary = useMemo(() => {
    let totalCounters = 0;
    let nearTriggerCount = 0;
    let overdueCount = 0;
    const machinesWithCounters: Machine[] = [];

    machines.forEach((machine) => {
      if (machine.counters && machine.counters.length > 0) {
        machinesWithCounters.push(machine);
        totalCounters += machine.counters.length;

        machine.counters.forEach((counter) => {
          counter.triggers?.forEach((trigger) => {
            const currentValue = Number(counter.currentValue);
            const nextTrigger = Number(trigger.nextTriggerValue);
            const interval = Number(trigger.triggerEvery);
            const progress = ((currentValue - (nextTrigger - interval)) / interval) * 100;

            if (progress >= 100) {
              overdueCount++;
            } else if (progress >= 90) {
              nearTriggerCount++;
            }
          });
        });
      }
    });

    return {
      totalCounters,
      nearTriggerCount,
      overdueCount,
      machinesWithCounters,
    };
  }, [machines]);

  if (!currentCompany) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Seleccione una empresa para ver los contadores
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" />
            Contadores de Uso
          </h1>
          <p className="text-muted-foreground">
            Mantenimiento preventivo basado en uso (horas, ciclos, km, etc.)
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contadores</p>
                  <p className="text-2xl font-bold">{summary.totalCounters}</p>
                </div>
                <Gauge className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Máquinas con Contadores</p>
                  <p className="text-2xl font-bold">{summary.machinesWithCounters.length}</p>
                </div>
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className={summary.nearTriggerCount > 0 ? 'border-amber-200 bg-amber-50' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">Cerca del PM</p>
                  <p className="text-2xl font-bold text-amber-700">{summary.nearTriggerCount}</p>
                  <p className="text-xs text-amber-500">&ge; 90% del intervalo</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={summary.overdueCount > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">PM Vencidos</p>
                  <p className="text-2xl font-bold text-red-700">{summary.overdueCount}</p>
                  <p className="text-xs text-red-500">Requieren atención</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="by-machine">Por Máquina</TabsTrigger>
            <TabsTrigger value="upcoming">Próximos PM</TabsTrigger>
          </TabsList>

          {activeTab === 'by-machine' && (
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar máquina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las máquinas</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="overview" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : summary.machinesWithCounters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Gauge className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No hay contadores configurados</p>
                <p className="text-sm">
                  Seleccione una máquina y agregue contadores para habilitar el mantenimiento basado en uso
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.machinesWithCounters.map((machine) => (
                <Card key={machine.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{machine.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {machine.counters?.map((counter) => {
                        const trigger = counter.triggers?.[0];
                        const progressPercent = trigger
                          ? Math.min(100, ((Number(counter.currentValue) - (Number(trigger.nextTriggerValue) - Number(trigger.triggerEvery))) / Number(trigger.triggerEvery)) * 100)
                          : 0;

                        return (
                          <div key={counter.id} className="space-y-1">
                            <div className="flex justify-between items-center text-sm">
                              <span>{counter.name}</span>
                              <span className="font-medium">
                                {Number(counter.currentValue).toLocaleString()} {counter.unit}
                              </span>
                            </div>
                            {trigger && (
                              <>
                                <Progress
                                  value={progressPercent}
                                  className={progressPercent >= 90 ? 'bg-amber-200' : ''}
                                />
                                <p className="text-xs text-muted-foreground">
                                  PM cada {Number(trigger.triggerEvery).toLocaleString()} {counter.unit}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="by-machine" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : selectedMachine === 'all' ? (
            <div className="space-y-6">
              {machines.map((machine) => (
                <CounterPanel
                  key={machine.id}
                  machineId={machine.id}
                  machineName={machine.name}
                />
              ))}
            </div>
          ) : (
            <CounterPanel
              machineId={parseInt(selectedMachine)}
              machineName={machines.find(m => m.id === parseInt(selectedMachine))?.name}
            />
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Próximos Mantenimientos por Uso
              </CardTitle>
              <CardDescription>
                Contadores que están cerca de activar un mantenimiento preventivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <UpcomingMaintenanceList machines={machines} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UpcomingMaintenanceList({ machines }: { machines: Machine[] }) {
  const upcomingItems: Array<{
    machineId: number;
    machineName: string;
    counterName: string;
    unit: string;
    currentValue: number;
    nextTriggerValue: number;
    triggerEvery: number;
    checklistTitle: string;
    progressPercent: number;
    unitsRemaining: number;
  }> = [];

  machines.forEach((machine) => {
    machine.counters?.forEach((counter) => {
      counter.triggers?.forEach((trigger) => {
        const currentValue = Number(counter.currentValue);
        const nextTrigger = Number(trigger.nextTriggerValue);
        const interval = Number(trigger.triggerEvery);
        const progress = ((currentValue - (nextTrigger - interval)) / interval) * 100;
        const remaining = nextTrigger - currentValue;

        if (progress >= 70) {
          upcomingItems.push({
            machineId: machine.id,
            machineName: machine.name,
            counterName: counter.name,
            unit: counter.unit,
            currentValue,
            nextTriggerValue: nextTrigger,
            triggerEvery: interval,
            checklistTitle: trigger.checklist.title,
            progressPercent: Math.min(100, progress),
            unitsRemaining: remaining,
          });
        }
      });
    });
  });

  upcomingItems.sort((a, b) => b.progressPercent - a.progressPercent);

  if (upcomingItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No hay mantenimientos próximos</p>
        <p className="text-sm">Los contadores están lejos de sus próximos triggers</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {upcomingItems.map((item, index) => (
        <div
          key={`${item.machineId}-${item.counterName}-${index}`}
          className={`p-4 border rounded-lg ${
            item.progressPercent >= 100
              ? 'border-red-300 bg-red-50'
              : item.progressPercent >= 90
              ? 'border-amber-300 bg-amber-50'
              : ''
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium">{item.machineName}</p>
              <p className="text-sm text-muted-foreground">{item.counterName}</p>
              <p className="text-xs mt-1">PM: {item.checklistTitle}</p>
            </div>
            <Badge
              variant={item.progressPercent >= 100 ? 'destructive' : 'secondary'}
            >
              {item.progressPercent >= 100
                ? 'Vencido'
                : `${Math.round(item.progressPercent)}%`}
            </Badge>
          </div>
          <Progress
            value={item.progressPercent}
            className={item.progressPercent >= 90 ? 'bg-amber-200' : ''}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>
              Actual: {item.currentValue.toLocaleString()} {item.unit}
            </span>
            <span>
              {item.unitsRemaining > 0
                ? `Faltan ${item.unitsRemaining.toLocaleString()} ${item.unit}`
                : `Excedido por ${Math.abs(item.unitsRemaining).toLocaleString()} ${item.unit}`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
