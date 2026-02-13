'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  ExternalLink,
  RefreshCw,
  Info,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface UserColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  kpiPositive: string;
  kpiNegative: string;
  kpiNeutral: string;
}

const DEFAULT_COLORS: UserColors = {
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};

interface PayrollViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  userColors?: UserColors;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

export function PayrollViewV2({ companyId, selectedMonth, onMonthChange, userColors = DEFAULT_COLORS }: PayrollViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-payroll-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/payroll?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching payroll data');
      return response.json();
    },
    enabled: !!companyId && !!currentMonth,
  });

  const handleMonthChange = (month: string) => {
    setCurrentMonth(month);
    onMonthChange?.(month);
  };

  // Generate month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    };
  });

  if (isLoading) {
    return <PayrollSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar datos de nóminas.{' '}
            <Button variant="link" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const payrollData = data?.data;
  const hasData = payrollData && payrollData.totalEmployerCost > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Costos de Nómina V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde el módulo de Nóminas
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={currentMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/nominas">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Nóminas
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar nóminas en el módulo dedicado</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de nómina</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay nóminas cerradas (APPROVED/PAID) para el período {currentMonth}.
                  Los costos de nómina se importan automáticamente cuando se cierran las liquidaciones.
                </p>
                <Link href="/nominas">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Crear Nómina
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Costo Empleador Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart1 }}>
                    ${formatCurrency(payrollData.totalEmployerCost || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Costo total para la empresa
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sueldos Brutos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart2 }}>
                    ${formatCurrency(payrollData.totalGross || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payrollData.employeeCount || 0} empleados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cargas Sociales</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart4 }}>
                    ${formatCurrency((payrollData.totalEmployerCost || 0) - (payrollData.totalGross || 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aportes patronales
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nóminas</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {payrollData.payrollCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Liquidaciones cerradas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detalle de Nóminas */}
            {payrollData.details && payrollData.details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle de Liquidaciones</CardTitle>
                  <CardDescription>
                    Nóminas cerradas incluidas en el cálculo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Empleados</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">Costo Empleador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.details.map((run: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">
                              {run.periodType === 'MENSUAL' ? 'Mensual' : run.periodType}
                            </Badge>
                          </TableCell>
                          <TableCell>{run.period}</TableCell>
                          <TableCell>
                            <Badge
                              variant={run.status === 'PAID' ? 'default' : 'secondary'}
                              className="flex items-center gap-1 w-fit"
                            >
                              {run.status === 'PAID' ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {run.status === 'PAID' ? 'Pagado' : 'Aprobado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{run.employeeCount}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${formatCurrency(run.totalGross)}
                          </TableCell>
                          <TableCell className="text-right font-bold" style={{ color: userColors.chart1 }}>
                            ${formatCurrency(run.totalEmployerCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card style={{ backgroundColor: `${userColors.chart1}08`, borderColor: `${userColors.chart1}30` }}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5" style={{ color: userColors.chart1 }} />
                  <div className="text-sm">
                    <p className="font-medium mb-1" style={{ color: userColors.chart1 }}>
                      Datos V2 - Importación Automática
                    </p>
                    <p className="text-muted-foreground">
                      Los costos de nómina se importan automáticamente desde las liquidaciones
                      cerradas (APPROVED o PAID) del módulo de Nóminas. Para agregar o modificar
                      datos, gestiona las nóminas desde el módulo dedicado.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function PayrollSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
