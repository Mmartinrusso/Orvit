'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  Package,
  TrendingUp,
  DollarSign,
  Wrench,
  ClipboardList,
  BarChart3,
  ArrowDownCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';

interface ConsumptionItem {
  tool: {
    id: number;
    name: string;
    category?: string;
    unit?: string;
    cost?: number;
  };
  reserved: number;
  picked: number;
  returned: number;
  consumed: number;
  cost: number;
}

interface WorkOrderConsumption {
  workOrder: {
    id: number;
    title: string;
    type: string;
    status: string;
    machine?: { id: number; name: string; code?: string };
    completedDate?: string;
  };
  items: ConsumptionItem[];
  totalCost: number;
}

interface TopItem {
  tool: { id: number; name: string };
  total: number;
  cost: number;
}

interface TopMachine {
  machine: { id: number; name: string; code?: string };
  total: number;
  cost: number;
  ots: number;
}

async function fetchConsumptionData(from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/panol/consumption?${params}`);
  const data = await res.json();
  if (!data.success) throw new Error('Error al cargar consumo');
  return {
    consumption: data.data.byWorkOrder || [] as WorkOrderConsumption[],
    summary: data.data.summary || { totalConsumed: 0, totalCost: 0, uniqueTools: 0, uniqueOTs: 0 },
    topTools: data.data.topTools || [] as TopItem[],
    topMachines: data.data.topMachines || [] as TopMachine[],
  };
}

export default function ConsumoPage() {
  const permissions = usePanolPermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data, isLoading: loading } = useQuery({
    queryKey: ['panol-consumption', dateRange.from, dateRange.to],
    queryFn: () => fetchConsumptionData(dateRange.from, dateRange.to),
    staleTime: 1000 * 60 * 3,
  });

  const consumption = data?.consumption || [];
  const summary = data?.summary || { totalConsumed: 0, totalCost: 0, uniqueTools: 0, uniqueOTs: 0 };
  const topTools = data?.topTools || [];
  const topMachines = data?.topMachines || [];

  const filteredConsumption = searchTerm
    ? consumption.filter(c =>
        c.workOrder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.workOrder.machine?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.items.some(i => i.tool.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        `OT-${c.workOrder.id}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : consumption;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <BarChart3 className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando consumo...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Consumo por Orden de Trabajo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Análisis de repuestos consumidos por OT y máquina
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-4 md:px-6 pb-6">
          {/* Stats Cards */}
          <div className={cn(
            "grid gap-4",
            permissions.canViewCosts ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"
          )}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Items Consumidos</p>
                    <p className="text-2xl font-bold">{summary.totalConsumed.toLocaleString()}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center">
                    <ArrowDownCircle className="h-5 w-5 text-info-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">OTs Atendidas</p>
                    <p className="text-2xl font-bold">{summary.uniqueOTs}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-accent-purple-muted flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-accent-purple-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Repuestos Únicos</p>
                    <p className="text-2xl font-bold">{summary.uniqueTools}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-warning-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-warning-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {permissions.canViewCosts && (
              <Card className="bg-success-muted border-success-muted">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-success">Costo Total</p>
                      <p className="text-2xl font-bold text-success">
                        {formatCurrency(summary.totalCost)}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por OT, máquina, repuesto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 bg-background"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                    className="h-9 w-[140px]"
                  />
                  <span className="text-muted-foreground">a</span>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                    className="h-9 w-[140px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Lists */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Top Tools */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-info-muted-foreground" />
                  Top 10 Repuestos Más Consumidos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {topTools.slice(0, 10).map((item, idx) => (
                    <div
                      key={item.tool.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                        <span className="text-sm font-medium truncate max-w-[180px]">{item.tool.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{item.total}</span>
                        {permissions.canViewCosts && item.cost > 0 && (
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.cost)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {topTools.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Sin datos</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Machines */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-accent-purple-muted-foreground" />
                  Top 10 Máquinas por Consumo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {topMachines.slice(0, 10).map((item, idx) => (
                    <div
                      key={item.machine.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                        <div>
                          <span className="text-sm font-medium">{item.machine.name}</span>
                          <p className="text-xs text-muted-foreground">{item.ots} OTs</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{item.total}</span>
                        {permissions.canViewCosts && item.cost > 0 && (
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.cost)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {topMachines.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Sin datos</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Consumption by OT */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Detalle por Orden de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredConsumption.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No hay consumo en el período seleccionado</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="space-y-2">
                  {filteredConsumption.map((woc) => (
                    <AccordionItem
                      key={woc.workOrder.id}
                      value={`ot-${woc.workOrder.id}`}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">OT-{woc.workOrder.id}</Badge>
                            <div className="text-left">
                              <p className="font-medium text-sm">{woc.workOrder.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {woc.workOrder.machine && (
                                  <span className="flex items-center gap-1">
                                    <Wrench className="h-3 w-3" />
                                    {woc.workOrder.machine.name}
                                  </span>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  {woc.workOrder.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right mr-4">
                            <p className="font-semibold">{woc.items.reduce((a, i) => a + i.consumed, 0)} items</p>
                            {permissions.canViewCosts && woc.totalCost > 0 && (
                              <p className="text-xs text-success">{formatCurrency(woc.totalCost)}</p>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Repuesto</TableHead>
                              <TableHead className="text-center">Reservado</TableHead>
                              <TableHead className="text-center">Consumido</TableHead>
                              <TableHead className="text-center">Devuelto</TableHead>
                              {permissions.canViewCosts && <TableHead className="text-right">Costo</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {woc.items.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span>{item.tool.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{item.reserved}</TableCell>
                                <TableCell className="text-center font-medium">{item.consumed}</TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                  {item.returned > 0 ? item.returned : '-'}
                                </TableCell>
                                {permissions.canViewCosts && (
                                  <TableCell className="text-right">
                                    {item.cost > 0 ? formatCurrency(item.cost) : '-'}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
