'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  Truck,
  BarChart3,
  PieChart,
  Building2,
  Wrench
} from 'lucide-react';

interface CostsData {
  kpis: {
    totalCostPeriod: number;
    totalWorkOrders: number;
    avgCostPerOT: number;
    budgetUsedPercent: number;
  };
  distribution: {
    labor: number;
    parts: number;
    thirdParty: number;
    laborPercent: number;
    partsPercent: number;
    thirdPartyPercent: number;
  };
  topMachines: Array<{
    machineId: number;
    machineName: string;
    totalCost: number;
    workOrderCount: number;
  }>;
  costsByMachine: Array<{
    machineId: number;
    machineName: string;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
    workOrderCount: number;
  }>;
  costsBySector: Array<{
    sectorId: number;
    sectorName: string;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
    workOrderCount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    year: number;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
    workOrderCount: number;
  }>;
  budgetComparison: {
    budget: { total: number; labor: number; parts: number; thirdParty: number };
    actual: { total: number; labor: number; parts: number; thirdParty: number };
    variance: { total: number; labor: number; parts: number; thirdParty: number };
    percentUsed: number;
  };
  recentCosts: Array<{
    workOrderId: number;
    workOrderTitle: string;
    machineName: string | null;
    completedDate: string;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
  }>;
}

async function fetchCostsData(period: number): Promise<CostsData> {
  const res = await fetch(`/api/maintenance/costs?period=${period}`);
  if (!res.ok) throw new Error('Error al cargar costos');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
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
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-destructive" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-success" />}
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}

function CostDistributionChart({ data }: { data: CostsData['distribution'] }) {
  const total = data.labor + data.parts + data.thirdParty;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        Sin datos de costos
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-info-muted-foreground" />
              Mano de obra
            </span>
            <span>{data.laborPercent}%</span>
          </div>
          <Progress value={data.laborPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(data.labor)}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-success" />
              Repuestos
            </span>
            <span>{data.partsPercent}%</span>
          </div>
          <Progress value={data.partsPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(data.parts)}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-warning-muted-foreground" />
              Terceros
            </span>
            <span>{data.thirdPartyPercent}%</span>
          </div>
          <Progress value={data.thirdPartyPercent} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(data.thirdParty)}</p>
        </div>
      </div>
    </div>
  );
}

function MonthlyTrendChart({ data }: { data: CostsData['monthlyTrend'] }) {
  if (!data || data.length === 0) return null;

  const maxCost = Math.max(...data.map(d => d.totalCost), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2">
        {data.map((item, idx) => (
          <div key={idx} className="text-center">
            <div className="h-32 flex flex-col justify-end gap-1 mb-2">
              <div
                className="bg-primary/80 rounded-t w-full"
                style={{
                  height: `${item.totalCost ? (item.totalCost / maxCost) * 100 : 0}%`,
                  minHeight: item.totalCost ? '4px' : '0'
                }}
                title={formatCurrency(item.totalCost)}
              />
            </div>
            <div className="text-xs font-medium">{item.month}</div>
            <div className="text-xs text-muted-foreground">{formatCurrency(item.totalCost)}</div>
            <div className="text-xs text-muted-foreground">{item.workOrderCount} OTs</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetComparisonCard({ data }: { data: CostsData['budgetComparison'] }) {
  const isOverBudget = data.variance.total < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Presupuesto vs Real
        </CardTitle>
        <CardDescription>
          Comparación del gasto actual contra el presupuesto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.budget.total === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No hay presupuesto configurado
          </p>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <span>Presupuesto Total</span>
              <span className="font-bold">{formatCurrency(data.budget.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Gasto Actual</span>
              <span className="font-bold">{formatCurrency(data.actual.total)}</span>
            </div>
            <Progress value={Math.min(data.percentUsed, 100)} className="h-3" />
            <div className="flex justify-between items-center text-sm">
              <span>{data.percentUsed}% utilizado</span>
              <Badge variant={isOverBudget ? 'destructive' : 'secondary'}>
                {isOverBudget ? 'Excedido' : 'Dentro del presupuesto'}
              </Badge>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center text-sm">
                <span>Disponible</span>
                <span className={isOverBudget ? 'text-destructive' : 'text-success'}>
                  {formatCurrency(data.variance.total)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CostosPage() {
  const [period, setPeriod] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['maintenance-costs', period],
    queryFn: () => fetchCostsData(period)
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costos de Mantenimiento</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">Error al cargar datos de costos</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Costos de Mantenimiento</h1>
          <p className="text-muted-foreground">
            Análisis de costos por mano de obra, repuestos y servicios externos
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
            <SelectItem value="365">Último año</SelectItem>
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
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KPICard
            title="Costo Total"
            value={formatCurrency(data.kpis.totalCostPeriod)}
            subtitle={`${data.kpis.totalWorkOrders} órdenes de trabajo`}
            icon={DollarSign}
            iconColor="text-success"
          />
          <KPICard
            title="Costo Promedio por OT"
            value={formatCurrency(data.kpis.avgCostPerOT)}
            subtitle="Por orden completada"
            icon={TrendingUp}
            iconColor="text-info-muted-foreground"
          />
          <KPICard
            title="Mano de Obra"
            value={formatCurrency(data.distribution.labor)}
            subtitle={`${data.distribution.laborPercent}% del total`}
            icon={Users}
            iconColor="text-purple-500"
          />
          <KPICard
            title="Repuestos"
            value={formatCurrency(data.distribution.parts)}
            subtitle={`${data.distribution.partsPercent}% del total`}
            icon={Package}
            iconColor="text-warning-muted-foreground"
          />
        </div>
      ) : null}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="by-machine">Por Máquina</TabsTrigger>
          <TabsTrigger value="by-sector">Por Sector</TabsTrigger>
          <TabsTrigger value="recent">Recientes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Distribución */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Distribución de Costos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : data ? (
                  <CostDistributionChart data={data.distribution} />
                ) : null}
              </CardContent>
            </Card>

            {/* Presupuesto */}
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
              <BudgetComparisonCard data={data.budgetComparison} />
            ) : null}
          </div>

          {/* Tendencia mensual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tendencia de Costos (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : data ? (
                <MonthlyTrendChart data={data.monthlyTrend} />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-machine">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Costos por Máquina
              </CardTitle>
              <CardDescription>
                Desglose de costos agrupados por máquina
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : data?.costsByMachine.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay datos de costos por máquina
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Máquina</TableHead>
                      <TableHead className="text-right">OTs</TableHead>
                      <TableHead className="text-right">M. de Obra</TableHead>
                      <TableHead className="text-right">Repuestos</TableHead>
                      <TableHead className="text-right">Terceros</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.costsByMachine.map((machine) => (
                      <TableRow key={machine.machineId}>
                        <TableCell className="font-medium">{machine.machineName}</TableCell>
                        <TableCell className="text-right">{machine.workOrderCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(machine.laborCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(machine.partsCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(machine.thirdPartyCost)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(machine.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-sector">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Costos por Sector
              </CardTitle>
              <CardDescription>
                Desglose de costos agrupados por sector
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : data?.costsBySector.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay datos de costos por sector
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-right">OTs</TableHead>
                      <TableHead className="text-right">M. de Obra</TableHead>
                      <TableHead className="text-right">Repuestos</TableHead>
                      <TableHead className="text-right">Terceros</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.costsBySector.map((sector) => (
                      <TableRow key={sector.sectorId}>
                        <TableCell className="font-medium">{sector.sectorName}</TableCell>
                        <TableCell className="text-right">{sector.workOrderCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sector.laborCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sector.partsCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sector.thirdPartyCost)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(sector.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Últimas OTs con Costos</CardTitle>
              <CardDescription>
                Las 10 órdenes de trabajo más recientes con costos calculados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : data?.recentCosts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay órdenes de trabajo con costos
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OT</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead className="text-right">M. de Obra</TableHead>
                      <TableHead className="text-right">Repuestos</TableHead>
                      <TableHead className="text-right">Terceros</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.recentCosts.map((cost) => (
                      <TableRow key={cost.workOrderId}>
                        <TableCell>
                          <div className="font-medium">#{cost.workOrderId}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {cost.workOrderTitle}
                          </div>
                        </TableCell>
                        <TableCell>{cost.machineName || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cost.laborCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cost.partsCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cost.thirdPartyCost)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(cost.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
