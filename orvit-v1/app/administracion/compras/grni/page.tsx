'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  BarChart3,
  TrendingUp,
  Eye,
  ExternalLink,
  Loader2,
  Filter,
  Download,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useViewMode } from '@/contexts/ViewModeContext';

interface GRNIAccrual {
  id: number;
  companyId: number;
  goodsReceiptId: number;
  goodsReceiptItemId?: number;
  supplierId: number;
  montoEstimado: number;
  montoFacturado?: number;
  varianza?: number;
  estado: 'PENDIENTE' | 'FACTURADO' | 'REVERSADO' | 'ANULADO';
  facturaId?: number;
  periodoCreacion: string;
  periodoFacturacion?: string;
  docType: string;
  createdAt: string;
  ownerId?: number;
  notas?: string;
  // Relations
  goodsReceipt?: {
    id: number;
    numero: string;
    fechaRecepcion: string;
    purchaseOrder?: {
      id: number;
      numero: string;
    };
  };
  supplier?: {
    id: number;
    name: string;
  };
  factura?: {
    id: number;
    numeroFactura: string;
  };
}

interface GRNIStats {
  totalPendiente: number;
  cantidadRecepciones: number;
  aging: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  bySupplier: Array<{
    supplierId: number;
    supplierName: string;
    monto: number;
    count: number;
  }>;
}


function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function GRNIPage() {
  const router = useRouter();
  const { mode } = useViewMode();
  const userColors = useUserColors();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accruals, setAccruals] = useState<GRNIAccrual[]>([]);
  const [stats, setStats] = useState<GRNIStats | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'pendiente' | 'historial'>('pendiente');

  useEffect(() => {
    loadData();
  }, [mode, activeTab]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Cargar stats y accruals en paralelo
      const [statsRes, accrualsRes] = await Promise.all([
        fetch('/api/compras/grni?view=stats'),
        fetch(`/api/compras/grni?view=detalle&estado=${activeTab === 'pendiente' ? 'PENDIENTE' : ''}`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (accrualsRes.ok) {
        const accrualsData = await accrualsRes.json();
        setAccruals(accrualsData.data || []);
      }
    } catch (error) {
      console.error('Error loading GRNI data:', error);
      toast.error('Error al cargar datos de GRNI');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtrar accruals
  const filteredAccruals = useMemo(() => {
    return accruals.filter((accrual) => {
      // Search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matches =
          accrual.supplier?.name.toLowerCase().includes(search) ||
          accrual.goodsReceipt?.numero.toLowerCase().includes(search) ||
          accrual.goodsReceipt?.purchaseOrder?.numero.toLowerCase().includes(search);
        if (!matches) return false;
      }

      // Aging filter
      if (agingFilter !== 'all') {
        const dias = differenceInDays(new Date(), new Date(accrual.createdAt));
        switch (agingFilter) {
          case '0-30':
            if (dias > 30) return false;
            break;
          case '31-60':
            if (dias <= 30 || dias > 60) return false;
            break;
          case '61-90':
            if (dias <= 60 || dias > 90) return false;
            break;
          case '90+':
            if (dias <= 90) return false;
            break;
        }
      }

      // Supplier filter
      if (supplierFilter !== 'all' && accrual.supplierId.toString() !== supplierFilter) {
        return false;
      }

      return true;
    });
  }, [accruals, searchTerm, agingFilter, supplierFilter]);

  const getAgingBadge = (createdAt: string) => {
    const dias = differenceInDays(new Date(), new Date(createdAt));
    if (dias <= 30) {
      return <Badge variant="secondary" className="bg-success-muted text-success">{dias}d</Badge>;
    } else if (dias <= 60) {
      return <Badge variant="secondary" className="bg-warning-muted text-warning-muted-foreground">{dias}d</Badge>;
    } else if (dias <= 90) {
      return <Badge variant="secondary" className="bg-warning-muted text-warning-muted-foreground">{dias}d</Badge>;
    } else {
      return <Badge variant="destructive">{dias}d</Badge>;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Recepción', 'Proveedor', 'OC', 'Monto Estimado', 'Días Pendiente', 'Período'];
    const rows = filteredAccruals.map((a) => [
      a.goodsReceipt?.numero || '',
      a.supplier?.name || '',
      a.goodsReceipt?.purchaseOrder?.numero || '',
      a.montoEstimado,
      differenceInDays(new Date(), new Date(a.createdAt)),
      a.periodoCreacion,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grni_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('CSV descargado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Package className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando GRNI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" style={{ color: userColors.chart4 }} />
            GRNI - Recepciones sin Facturar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Goods Received Not Invoiced - Control de accruals pendientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Total Pendiente
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: stats.totalPendiente > 0 ? userColors.chart4 : undefined }}
                  >
                    {formatCurrency(stats.totalPendiente)}
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart4}15` }}
                >
                  <DollarSign className="h-5 w-5" style={{ color: userColors.chart4 }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Recepciones
                  </p>
                  <p className="text-2xl font-bold">{stats.cantidadRecepciones}</p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}15` }}
                >
                  <Package className="h-5 w-5" style={{ color: userColors.chart1 }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.aging['61-90'] + stats.aging['90+'] > 0 ? 'border-warning-muted' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    31-60 días
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: stats.aging['31-60'] > 0 ? userColors.chart4 : undefined }}
                  >
                    {formatCurrency(stats.aging['31-60'])}
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart4}15` }}
                >
                  <Clock className="h-5 w-5" style={{ color: userColors.chart4 }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.aging['61-90'] > 0 ? 'border-warning-muted' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    61-90 días
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: stats.aging['61-90'] > 0 ? userColors.kpiNegative : undefined }}
                  >
                    {formatCurrency(stats.aging['61-90'])}
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiNegative}15` }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.aging['90+'] > 0 ? 'border-destructive/30' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    +90 días
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: stats.aging['90+'] > 0 ? userColors.kpiNegative : undefined }}
                  >
                    {formatCurrency(stats.aging['90+'])}
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiNegative}15` }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aging Chart */}
      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: userColors.chart1 }} />
              Distribución por Antigüedad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted rounded-full overflow-hidden flex">
              {Object.entries(stats.aging).map(([bucket, monto], idx) => {
                const total = Object.values(stats.aging).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (monto / total) * 100 : 0;
                const colors = [
                  userColors.kpiPositive,
                  userColors.chart4,
                  userColors.chart3,
                  userColors.kpiNegative,
                ];
                if (pct <= 0) return null;
                return (
                  <div
                    key={bucket}
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: colors[idx] }}
                    title={`${bucket}: ${formatCurrency(monto)}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs">
              {Object.entries(stats.aging).map(([bucket, monto], idx) => {
                const colors = [
                  userColors.kpiPositive,
                  userColors.chart4,
                  userColors.chart3,
                  userColors.kpiNegative,
                ];
                return (
                  <div key={bucket} className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors[idx] }}
                    />
                    <span className="text-muted-foreground">{bucket}:</span>
                    <span className="font-medium">{formatCurrency(monto)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs and Table */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="pendiente">
              Pendientes
              {stats && (
                <Badge variant="secondary" className="ml-2">
                  {stats.cantidadRecepciones}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>

            <Select value={agingFilter} onValueChange={setAgingFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Antigüedad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="0-30">0-30 días</SelectItem>
                <SelectItem value="31-60">31-60 días</SelectItem>
                <SelectItem value="61-90">61-90 días</SelectItem>
                <SelectItem value="90+">+90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="pendiente" className="mt-0">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recepción</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>OC</TableHead>
                    <TableHead className="text-right">Monto Estimado</TableHead>
                    <TableHead>Antigüedad</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="w-20">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccruals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay recepciones pendientes de facturar
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccruals.map((accrual) => (
                      <TableRow key={accrual.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {accrual.goodsReceipt?.numero || `GR-${accrual.goodsReceiptId}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">
                              {accrual.supplier?.name || 'Sin proveedor'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {accrual.goodsReceipt?.purchaseOrder?.numero ? (
                            <Badge variant="outline" className="text-xs">
                              {accrual.goodsReceipt.purchaseOrder.numero}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin OC</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(accrual.montoEstimado)}
                        </TableCell>
                        <TableCell>{getAgingBadge(accrual.createdAt)}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {accrual.periodoCreacion}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              router.push(
                                `/administracion/compras/recepciones/${accrual.goodsReceiptId}`
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-0">
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Historial de GRNI facturados y reversados</p>
              <p className="text-sm">Próximamente...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Suppliers */}
      {stats && stats.bySupplier.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: userColors.chart5 }} />
              Top Proveedores con GRNI Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.bySupplier.slice(0, 5).map((supplier, idx) => (
                <div
                  key={supplier.supplierId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {supplier.supplierName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {supplier.count} {supplier.count === 1 ? 'recepción' : 'recepciones'}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold" style={{ color: userColors.chart4 }}>
                    {formatCurrency(supplier.monto)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
