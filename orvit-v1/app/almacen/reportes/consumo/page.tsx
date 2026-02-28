'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Download,
  RefreshCw,
  Building2,
  Wrench,
  Package,
  TrendingDown,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConsumoData {
  id: number;
  nombre: string;
  totalDespachos: number;
  totalItems: number;
  costoTotal: number;
}

interface ConsumoItem {
  supplierItemId: number;
  supplierItemName: string;
  supplierItemCode: string;
  unidad: string;
  totalCantidad: number;
  costoTotal: number;
  despachos: number;
}

export default function ReporteConsumoPage() {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sector');

  // Permission guard: almacen.view_costs
  if (!hasPermission('almacen.view_costs')) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">Sin acceso</p>
          <p className="text-sm text-muted-foreground mt-1">No tiene permisos para ver costos de almacen.</p>
        </div>
      </div>
    );
  }

  // Date filters
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Data
  const [consumoBySector, setConsumoBySector] = useState<ConsumoData[]>([]);
  const [consumoByOT, setConsumoByOT] = useState<ConsumoData[]>([]);
  const [topItems, setTopItems] = useState<ConsumoItem[]>([]);
  const [totals, setTotals] = useState({
    totalDespachos: 0,
    totalItems: 0,
    costoTotal: 0,
  });

  const fetchReportes = useCallback(async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(currentCompany.id),
        fechaDesde: dateFrom,
        fechaHasta: dateTo,
      });

      const res = await fetch(`/api/almacen/reportes/consumo?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConsumoBySector(data.bySector || []);
        setConsumoByOT(data.byWorkOrder || []);
        setTopItems(data.topItems || []);
        setTotals(data.totals || { totalDespachos: 0, totalItems: 0, costoTotal: 0 });
      }
    } catch (error) {
      console.error('Error fetching consumption reports:', error);
      toast.error('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }, [currentCompany, dateFrom, dateTo]);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleExportCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers.map((h) => item[h]));

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    toast.success('Archivo CSV descargado');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reportes de Consumo</h1>
            <p className="text-sm text-muted-foreground">
              Análisis de consumo de materiales
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReportes}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Date Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Período:</span>
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px]"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px]"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                }}
              >
                7 días
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                }}
              >
                30 días
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
                  setDateTo(format(new Date(), 'yyyy-MM-dd'));
                }}
              >
                90 días
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total Despachos
                </p>
                <p className="text-2xl font-bold">{totals.totalDespachos}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-info-muted flex items-center justify-center">
                <Package className="h-5 w-5 text-info-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Items Despachados
                </p>
                <p className="text-2xl font-bold">{totals.totalItems}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-success-muted flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Costo Total
                </p>
                <p className="text-2xl font-bold">{formatCurrency(totals.costoTotal)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-warning-muted flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-warning-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sector" className="gap-2">
            <Building2 className="h-4 w-4" />
            Por Sector
          </TabsTrigger>
          <TabsTrigger value="ot" className="gap-2">
            <Wrench className="h-4 w-4" />
            Por OT
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <Package className="h-4 w-4" />
            Top Items
          </TabsTrigger>
        </TabsList>

        {/* Por Sector */}
        <TabsContent value="sector">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Consumo por Sector</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleExportCSV(
                    consumoBySector.map((s) => ({
                      Sector: s.nombre,
                      Despachos: s.totalDespachos,
                      Items: s.totalItems,
                      Costo: s.costoTotal,
                    })),
                    'consumo_por_sector'
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {consumoBySector.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-right">Despachos</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoBySector.map((sector) => (
                      <TableRow key={sector.id}>
                        <TableCell className="font-medium">{sector.nombre}</TableCell>
                        <TableCell className="text-right">{sector.totalDespachos}</TableCell>
                        <TableCell className="text-right">{sector.totalItems}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(sector.costoTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Por OT */}
        <TabsContent value="ot">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Consumo por Orden de Trabajo</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleExportCSV(
                    consumoByOT.map((ot) => ({
                      OT: ot.nombre,
                      Despachos: ot.totalDespachos,
                      Items: ot.totalItems,
                      Costo: ot.costoTotal,
                    })),
                    'consumo_por_ot'
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {consumoByOT.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Wrench className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden de Trabajo</TableHead>
                      <TableHead className="text-right">Despachos</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumoByOT.map((ot) => (
                      <TableRow key={ot.id}>
                        <TableCell className="font-medium">{ot.nombre}</TableCell>
                        <TableCell className="text-right">{ot.totalDespachos}</TableCell>
                        <TableCell className="text-right">{ot.totalItems}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(ot.costoTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Items */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Top Items Consumidos</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleExportCSV(
                    topItems.map((item) => ({
                      Item: item.supplierItemName,
                      Codigo: item.supplierItemCode,
                      Unidad: item.unidad,
                      Cantidad: item.totalCantidad,
                      Despachos: item.despachos,
                      Costo: item.costoTotal,
                    })),
                    'top_items_consumidos'
                  )
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {topItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Despachos</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topItems.map((item, index) => (
                      <TableRow key={item.supplierItemId}>
                        <TableCell className="font-bold text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.supplierItemName}</TableCell>
                        <TableCell className="text-muted-foreground">{item.supplierItemCode}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.totalCantidad, 2)} {item.unidad}
                        </TableCell>
                        <TableCell className="text-right">{item.despachos}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.costoTotal)}
                        </TableCell>
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
