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
  Factory,
  DollarSign,
  Package,
  Boxes,
  ExternalLink,
  RefreshCw,
  Info,
  FileText,
  Beaker,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface ProductionViewV2Props {
  companyId: string;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
}

const formatCurrency = (value: number): string => {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const formatNumber = (value: number): string => {
  return value.toLocaleString('es-AR');
};

export function ProductionViewV2({ companyId, selectedMonth, onMonthChange }: ProductionViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-production-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/production?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching production data');
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
    return <ProductionSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar datos de producción.{' '}
            <Button variant="link" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const productionData = data?.data;
  const hasData = productionData && (productionData.totalProductionCost > 0 || productionData.unitsProduced > 0);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Producción V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde producción mensual y recetas
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
                <Link href="/produccion">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Producción
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar producción en el módulo dedicado</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Factory className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de producción</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay producción mensual registrada para el período {currentMonth}.
                  Los costos de producción se calculan desde los registros de producción y las recetas.
                </p>
                <Link href="/produccion">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Registrar Producción
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
                  <CardTitle className="text-sm font-medium">Costo de Producción</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-violet-600">
                    ${formatCurrency(productionData.totalProductionCost || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Consumo de insumos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unidades Producidas</CardTitle>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(productionData.unitsProduced || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total del período
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Productos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {productionData.productCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Distintos producidos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Costo Unitario Prom.</CardTitle>
                  <Beaker className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(
                      productionData.unitsProduced > 0
                        ? productionData.totalProductionCost / productionData.unitsProduced
                        : 0
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por unidad
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Por Producto */}
            {productionData.byProduct && Object.keys(productionData.byProduct).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Producción por Producto</CardTitle>
                  <CardDescription>
                    Desglose de producción y costos por producto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo Insumos</TableHead>
                        <TableHead className="text-right">Costo Unitario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(productionData.byProduct)
                        .sort((a: any, b: any) => b[1].cost - a[1].cost)
                        .map(([productId, prodData]: [string, any]) => {
                          const unitCost = prodData.quantity > 0 ? prodData.cost / prodData.quantity : 0;
                          return (
                            <TableRow key={productId}>
                              <TableCell className="font-medium">
                                {prodData.name || `Producto #${productId}`}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatNumber(prodData.quantity || 0)}
                              </TableCell>
                              <TableCell className="text-right font-bold text-violet-600">
                                ${formatCurrency(prodData.cost || 0)}
                              </TableCell>
                              <TableCell className="text-right">
                                ${formatCurrency(unitCost)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Consumo de Insumos */}
            {productionData.inputsConsumed && productionData.inputsConsumed.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Consumo de Insumos</CardTitle>
                  <CardDescription>
                    Insumos consumidos según recetas (mostrando top 10)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Cantidad Consumida</TableHead>
                        <TableHead className="text-right">Costo Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionData.inputsConsumed
                        .sort((a: any, b: any) => b.cost - a.cost)
                        .slice(0, 10)
                        .map((input: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {input.name || `Insumo #${input.inputId}`}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(input.quantity || 0)} {input.unit || ''}
                            </TableCell>
                            <TableCell className="text-right font-bold text-violet-600">
                              ${formatCurrency(input.cost || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card className="bg-violet-50 border-violet-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-violet-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-violet-800 mb-1">
                      Datos V2 - Importación Automática
                    </p>
                    <p className="text-violet-700">
                      Los costos de producción se calculan automáticamente desde la producción mensual
                      registrada y las recetas activas. El consumo de insumos se calcula multiplicando
                      la cantidad producida por los items de cada receta. Para gestionar producción, usa el módulo dedicado.
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

function ProductionSkeleton() {
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
