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
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  ExternalLink,
  RefreshCw,
  Info,
  FileText,
  Percent,
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

interface SalesViewV2Props {
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

const formatPercent = (value: number): string => {
  return value.toFixed(1) + '%';
};

export function SalesViewV2({ companyId, selectedMonth, onMonthChange, userColors = DEFAULT_COLORS }: SalesViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-sales-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/sales?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching sales data');
      return response.json();
    },
    enabled: !!companyId && !!currentMonth,
  });

  const handleMonthChange = (month: string) => {
    setCurrentMonth(month);
    onMonthChange?.(month);
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
    };
  });

  if (isLoading) {
    return <SalesSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar datos de ventas.{' '}
            <Button variant="link" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const salesData = data?.data;
  const hasData = salesData && salesData.totalRevenue > 0;
  const marginPercent = salesData?.marginPercent || 0;
  const isPositiveMargin = marginPercent >= 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Ventas V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde facturas confirmadas
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
                <Link href="/ventas">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Ventas
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar ventas en el módulo dedicado</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de ventas</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay facturas confirmadas para el período {currentMonth}.
                  Los ingresos se importan automáticamente cuando se confirman las facturas.
                </p>
                <Link href="/ventas/facturas">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver Facturas
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
                  <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.kpiPositive }}>
                    ${formatCurrency(salesData.totalRevenue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {salesData.invoiceCount || 0} facturas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Costo de Ventas (COGS)</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.kpiNegative }}>
                    ${formatCurrency(salesData.totalCost || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Costo de productos vendidos
                  </p>
                </CardContent>
              </Card>

              <Card style={{
                borderColor: isPositiveMargin ? `${userColors.kpiPositive}40` : `${userColors.kpiNegative}40`,
                backgroundColor: isPositiveMargin ? `${userColors.kpiPositive}08` : `${userColors.kpiNegative}08`
              }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Margen Bruto</CardTitle>
                  {isPositiveMargin ? (
                    <TrendingUp className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                  ) : (
                    <TrendingDown className="h-4 w-4" style={{ color: userColors.kpiNegative }} />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: isPositiveMargin ? userColors.kpiPositive : userColors.kpiNegative }}>
                    ${formatCurrency(salesData.grossMargin || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPercent(marginPercent)} del ingreso
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">% Margen</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: isPositiveMargin ? userColors.kpiPositive : userColors.kpiNegative }}>
                    {formatPercent(marginPercent)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rentabilidad bruta
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Por Cliente */}
            {salesData.byClient && Object.keys(salesData.byClient).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas por Cliente</CardTitle>
                  <CardDescription>
                    Top clientes del período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Facturas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(salesData.byClient)
                        .sort((a: any, b: any) => b[1].total - a[1].total)
                        .slice(0, 10)
                        .map(([clientId, clientData]: [string, any]) => (
                          <TableRow key={clientId}>
                            <TableCell className="font-medium">
                              {clientData.name || `Cliente #${clientId}`}
                            </TableCell>
                            <TableCell className="text-right">
                              {clientData.invoiceCount || 0}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.kpiPositive }}>
                              ${formatCurrency(clientData.total || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent((clientData.total / salesData.totalRevenue) * 100)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Por Producto */}
            {salesData.byProduct && Object.keys(salesData.byProduct).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas por Producto</CardTitle>
                  <CardDescription>
                    Top productos vendidos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Ingreso</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(salesData.byProduct)
                        .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
                        .slice(0, 10)
                        .map(([productId, productData]: [string, any]) => {
                          const margin = (productData.revenue || 0) - (productData.cost || 0);
                          const marginPct = productData.revenue > 0 ? (margin / productData.revenue) * 100 : 0;
                          return (
                            <TableRow key={productId}>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                {productData.name || `Producto #${productId}`}
                              </TableCell>
                              <TableCell className="text-right">
                                {productData.quantity || 0}
                              </TableCell>
                              <TableCell className="text-right" style={{ color: userColors.kpiPositive }}>
                                ${formatCurrency(productData.revenue || 0)}
                              </TableCell>
                              <TableCell className="text-right" style={{ color: userColors.kpiNegative }}>
                                ${formatCurrency(productData.cost || 0)}
                              </TableCell>
                              <TableCell className="text-right font-medium" style={{ color: margin >= 0 ? userColors.kpiPositive : userColors.kpiNegative }}>
                                {formatPercent(marginPct)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card style={{ backgroundColor: `${userColors.chart2}08`, borderColor: `${userColors.chart2}30` }}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5" style={{ color: userColors.chart2 }} />
                  <div className="text-sm">
                    <p className="font-medium mb-1" style={{ color: userColors.chart2 }}>
                      Datos V2 - Importación Automática
                    </p>
                    <p className="text-muted-foreground">
                      Los ingresos y márgenes se calculan desde las facturas CONFIRMADAS o PAGADAS.
                      El COGS (Costo de Ventas) se calcula con fallback: precio de costo del item,
                      último costo de stock, o costo manual del producto. Para gestionar ventas, usa el módulo dedicado.
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

function SalesSkeleton() {
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
