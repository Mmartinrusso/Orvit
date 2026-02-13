'use client';

/**
 * Comprobantes Page - Unified Documents View
 *
 * Unified view for all sales documents:
 * - Facturas (Invoices)
 * - Notas de Crédito (Credit Notes)
 * - Notas de Débito (Debit Notes)
 * - Remitos (Delivery Notes)
 *
 * Replaces separate views with a single, filterable interface
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  TrendingDown,
  TrendingUp,
  Truck,
  Search,
  Filter,
  Download,
  Eye,
  MoreVertical,
  Plus,
  RefreshCw,
  Calendar,
  DollarSign,
  User,
  Hash,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useViewMode } from '@/contexts/ViewModeContext';
import { toast } from 'sonner';

type ComprobanteType = 'FACTURA' | 'NC' | 'ND' | 'REMITO' | 'ALL';

interface Comprobante {
  id: number;
  numero: string;
  tipo: ComprobanteType;
  fecha: Date;
  clientId: string;
  clientName: string;
  total: number;
  saldo?: number;
  estado: string;
  fiscalStatus?: string;
}

const TIPO_CONFIG = {
  FACTURA: {
    label: 'Factura',
    icon: FileText,
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    iconColor: 'text-blue-600',
  },
  NC: {
    label: 'Nota de Crédito',
    icon: TrendingDown,
    color: 'bg-green-100 text-green-700 border-green-300',
    iconColor: 'text-green-600',
  },
  ND: {
    label: 'Nota de Débito',
    icon: TrendingUp,
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    iconColor: 'text-orange-600',
  },
  REMITO: {
    label: 'Remito',
    icon: Truck,
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    iconColor: 'text-purple-600',
  },
};

export default function ComprobantesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode: viewMode } = useViewMode();

  // Filters
  const [tipoFilter, setTipoFilter] = useState<ComprobanteType>(
    (searchParams?.get('tipo') as ComprobanteType) || 'ALL'
  );
  const [estadoFilter, setEstadoFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Data
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFacturas: 0,
    totalNC: 0,
    totalND: 0,
    totalRemitos: 0,
    montoFacturas: 0,
    montoNC: 0,
    saldoPendiente: 0,
  });

  useEffect(() => {
    loadComprobantes();
  }, [tipoFilter, estadoFilter, viewMode]);

  const loadComprobantes = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (tipoFilter !== 'ALL') params.append('tipo', tipoFilter);
      if (estadoFilter) params.append('estado', estadoFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);
      params.append('viewMode', viewMode);

      const response = await fetch(`/api/ventas/comprobantes?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Error loading documents');

      const data = await response.json();
      setComprobantes(data.data || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Error loading comprobantes:', error);
      toast.error('Error al cargar comprobantes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadComprobantes();
  };

  const handleClearFilters = () => {
    setTipoFilter('ALL');
    setEstadoFilter('');
    setSearchTerm('');
    setFechaDesde('');
    setFechaHasta('');
  };

  const handleViewDetail = (comprobante: Comprobante) => {
    switch (comprobante.tipo) {
      case 'FACTURA':
        router.push(`/administracion/ventas/facturas/${comprobante.id}`);
        break;
      case 'NC':
      case 'ND':
        router.push(`/administracion/ventas/notas-credito/${comprobante.id}`);
        break;
      case 'REMITO':
        router.push(`/administracion/ventas/entregas/${comprobante.id}`);
        break;
    }
  };

  const handleDownloadPDF = async (comprobante: Comprobante) => {
    let endpoint = '';
    switch (comprobante.tipo) {
      case 'FACTURA':
        endpoint = `/api/ventas/facturas/${comprobante.id}/pdf`;
        break;
      case 'NC':
      case 'ND':
        endpoint = `/api/ventas/notas-credito/${comprobante.id}/pdf`;
        break;
      case 'REMITO':
        endpoint = `/api/ventas/entregas/${comprobante.id}/remito`;
        break;
    }
    if (endpoint) {
      window.open(endpoint, '_blank');
    }
  };

  const getTipoConfig = (tipo: ComprobanteType) => TIPO_CONFIG[tipo] || TIPO_CONFIG.FACTURA;

  return (
    <PermissionGuard permission="ventas.facturas.view">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Comprobantes</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Vista unificada de facturas, notas de crédito/débito y remitos
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push('/administracion/ventas/facturas/nueva')}>
                <FileText className="w-4 h-4 mr-2" />
                Nueva Factura
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/administracion/ventas/notas-credito')}>
                <TrendingDown className="w-4 h-4 mr-2" />
                Nueva Nota de Crédito
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/administracion/ventas/entregas')}>
                <Truck className="w-4 h-4 mr-2" />
                Nuevo Remito
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTipoFilter('FACTURA')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFacturas}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.montoFacturas)}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTipoFilter('NC')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-600" />
                Notas de Crédito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalNC}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.montoNC)}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTipoFilter('ND')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                Notas de Débito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalND}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Débitos generados
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTipoFilter('REMITO')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600" />
                Remitos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRemitos}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Entregas documentadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Comprobante</Label>
                <Select value={tipoFilter} onValueChange={(value) => setTipoFilter(value as ComprobanteType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="FACTURA">Facturas</SelectItem>
                    <SelectItem value="NC">Notas de Crédito</SelectItem>
                    <SelectItem value="ND">Notas de Débito</SelectItem>
                    <SelectItem value="REMITO">Remitos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="EMITIDA">Emitida</SelectItem>
                    <SelectItem value="COBRADA">Cobrada</SelectItem>
                    <SelectItem value="PARCIALMENTE_COBRADA">Parcial</SelectItem>
                    <SelectItem value="ANULADA">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Número, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-end gap-2 md:col-span-2">
                <Button onClick={handleSearch} className="flex-1">
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
                <Button variant="outline" onClick={handleClearFilters}>
                  Limpiar
                </Button>
                <Button variant="outline" onClick={loadComprobantes}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comprobantes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {tipoFilter === 'ALL' ? 'Todos los Comprobantes' : getTipoConfig(tipoFilter).label + 's'}
              </CardTitle>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : comprobantes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron comprobantes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comprobantes.map((comp) => {
                      const config = getTipoConfig(comp.tipo);
                      const Icon = config.icon;
                      return (
                        <TableRow key={`${comp.tipo}-${comp.id}`}>
                          <TableCell>
                            <Badge variant="outline" className={config.color}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">{comp.numero}</TableCell>
                          <TableCell>{format(new Date(comp.fecha), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{comp.clientName}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(comp.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {comp.saldo !== undefined ? (
                              <span className={comp.saldo > 0 ? 'text-red-600 font-medium' : ''}>
                                {formatCurrency(comp.saldo)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{comp.estado}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetail(comp)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver Detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(comp)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Descargar PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
