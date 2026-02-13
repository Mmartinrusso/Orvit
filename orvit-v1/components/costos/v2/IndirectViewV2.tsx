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
  Building2,
  DollarSign,
  Layers,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Info,
  FileText,
  Zap,
  Droplets,
  Wifi,
  Shield,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface IndirectViewV2Props {
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

const formatPercent = (value: number): string => {
  return value.toFixed(1) + '%';
};

// Icons for categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'SERVICIOS': <Zap className="h-4 w-4" />,
  'UTILITIES': <Zap className="h-4 w-4" />,
  'AGUA': <Droplets className="h-4 w-4" />,
  'INTERNET': <Wifi className="h-4 w-4" />,
  'SEGUROS': <Shield className="h-4 w-4" />,
  'DEFAULT': <Building2 className="h-4 w-4" />,
};

export function IndirectViewV2({ companyId, selectedMonth, onMonthChange }: IndirectViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-indirect-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/indirect?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching indirect data');
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
    return <IndirectSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar datos de costos indirectos.{' '}
            <Button variant="link" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const indirectData = data?.data;
  const hasData = indirectData && indirectData.total > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Costos Indirectos V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde registros mensuales de indirectos
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
                <Link href="/administracion/costos">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Gestionar
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar costos indirectos</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de costos indirectos</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay costos indirectos registrados para el período {currentMonth}.
                  Primero debes crear items de costos indirectos y luego registrar sus valores mensuales.
                </p>
                <Link href="/administracion/costos">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Configurar Indirectos
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
                  <CardTitle className="text-sm font-medium">Total Indirectos</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    ${formatCurrency(indirectData.total || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Período {currentMonth}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Items</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {indirectData.itemCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conceptos registrados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Categorías</CardTitle>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {indirectData.categoryCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tipos de costos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promedio por Item</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(
                      indirectData.itemCount > 0
                        ? indirectData.total / indirectData.itemCount
                        : 0
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por concepto
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Por Categoría */}
            {indirectData.byCategory && Object.keys(indirectData.byCategory).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribución por Categoría</CardTitle>
                  <CardDescription>
                    Costos indirectos agrupados por tipo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(indirectData.byCategory)
                      .sort((a: any, b: any) => b[1].total - a[1].total)
                      .map(([categoryName, catData]: [string, any]) => {
                        const percent = indirectData.total > 0
                          ? (catData.total / indirectData.total) * 100
                          : 0;
                        const icon = CATEGORY_ICONS[categoryName.toUpperCase()] || CATEGORY_ICONS['DEFAULT'];

                        return (
                          <div key={categoryName} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                {icon}
                                <span className="font-medium">{categoryName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {catData.itemCount || 0} items
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-amber-600">
                                  ${formatCurrency(catData.total)}
                                </span>
                                <span className="text-muted-foreground w-12 text-right">
                                  {formatPercent(percent)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detalle de Items */}
            {indirectData.details && indirectData.details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle de Items</CardTitle>
                  <CardDescription>
                    Todos los conceptos de costos indirectos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">% del Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indirectData.details
                        .sort((a: any, b: any) => b.amount - a.amount)
                        .map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.category || 'General'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-amber-600">
                              ${formatCurrency(item.amount || 0)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatPercent(
                                indirectData.total > 0
                                  ? (item.amount / indirectData.total) * 100
                                  : 0
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 mb-1">
                      Datos V2 - Importación Automática
                    </p>
                    <p className="text-amber-700">
                      Los costos indirectos se importan desde MonthlyIndirect, que registra los valores
                      mensuales de cada IndirectItem (servicios, alquileres, seguros, etc.).
                      Para agregar nuevos conceptos o modificar valores, usa la pestaña de Costos Indirectos
                      en modo V1 o gestiona desde el módulo dedicado.
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

function IndirectSkeleton() {
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
