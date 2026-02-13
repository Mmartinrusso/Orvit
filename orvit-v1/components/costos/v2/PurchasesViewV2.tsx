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
  ShoppingCart,
  DollarSign,
  Package,
  Truck,
  ExternalLink,
  RefreshCw,
  Info,
  Building2,
  FileText,
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

interface PurchasesViewV2Props {
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

export function PurchasesViewV2({ companyId, selectedMonth, onMonthChange, userColors = DEFAULT_COLORS }: PurchasesViewV2Props) {
  const [currentMonth, setCurrentMonth] = useState(selectedMonth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['costos-purchases-v2', companyId, currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/costos/purchases?month=${currentMonth}`);
      if (!response.ok) throw new Error('Error fetching purchases data');
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
    return <PurchasesSkeleton />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-500">
            Error al cargar datos de compras.{' '}
            <Button variant="link" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const purchasesData = data?.data;
  const hasData = purchasesData && purchasesData.totalPurchases > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Compras V2
              <Badge variant="secondary" className="ml-2 text-xs">Automático</Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Datos importados automáticamente desde recepciones confirmadas
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
                <Link href="/compras">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ir a Compras
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Gestionar compras en el módulo dedicado</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin datos de compras</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  No hay recepciones confirmadas para el período {currentMonth}.
                  Los costos de compras se importan automáticamente cuando se confirman las recepciones.
                </p>
                <Link href="/compras/recepciones">
                  <Button>
                    <Truck className="h-4 w-4 mr-2" />
                    Ver Recepciones
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
                  <CardTitle className="text-sm font-medium">Total Compras</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart1 }}>
                    ${formatCurrency(purchasesData.totalPurchases || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Período {currentMonth}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recepciones</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart2 }}>
                    {purchasesData.receiptCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confirmadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Items</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart3 }}>
                    {purchasesData.itemCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Productos recibidos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: userColors.chart4 }}>
                    {purchasesData.supplierCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Distintos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Por Proveedor */}
            {purchasesData.bySupplier && Object.keys(purchasesData.bySupplier).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Compras por Proveedor</CardTitle>
                  <CardDescription>
                    Desglose de compras por proveedor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Recepciones</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(purchasesData.bySupplier)
                        .sort((a: any, b: any) => b[1].total - a[1].total)
                        .map(([supplierId, supplierData]: [string, any]) => (
                          <TableRow key={supplierId}>
                            <TableCell className="font-medium">
                              {supplierData.name || `Proveedor #${supplierId}`}
                            </TableCell>
                            <TableCell className="text-right">
                              {supplierData.receiptCount || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {supplierData.itemCount || 0}
                            </TableCell>
                            <TableCell className="text-right font-bold" style={{ color: userColors.chart1 }}>
                              ${formatCurrency(supplierData.total || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Items Recientes */}
            {purchasesData.details && purchasesData.details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalle de Items</CardTitle>
                  <CardDescription>
                    Últimos items recibidos (mostrando {Math.min(10, purchasesData.details.length)} de {purchasesData.details.length})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recepción</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">P. Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasesData.details.slice(0, 10).map((item: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">#{item.receiptNumber}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.supplier || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {item.itemDescription}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            ${formatCurrency(item.unitCost || 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${formatCurrency(item.totalCost || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Info Banner */}
            <Card style={{ backgroundColor: `${userColors.chart5}08`, borderColor: `${userColors.chart5}30` }}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5" style={{ color: userColors.chart5 }} />
                  <div className="text-sm">
                    <p className="font-medium mb-1" style={{ color: userColors.chart5 }}>
                      Datos V2 - Importación Automática
                    </p>
                    <p className="text-muted-foreground">
                      Los costos de compras se calculan desde las recepciones CONFIRMADAS.
                      El cálculo es por item recibido (cantidad x precio unitario) para evitar
                      duplicaciones en recepciones parciales. Para gestionar compras, usa el módulo dedicado.
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

function PurchasesSkeleton() {
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
