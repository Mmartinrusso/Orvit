'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  TableRow
} from '@/components/ui/table';
import {
  FileText,
  Search,
  Download,
  User,
  AlertTriangle,
  Shield,
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface PriceChangeLog {
  id: string;
  productName: string;
  productCode: string;
  previousPrice: number | null;
  newPrice: number;
  changePercentage: number;
  changeSource: string;
  reason: string | null;
  salesPriceListName: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface PriceChangeSummary {
  totalChanges: number;
  averageChangePercent: number;
  increases: number;
  decreases: number;
  significantChanges: number;
}

export default function AuditoriaPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'general' | 'price-changes'>('general');

  // Price changes state
  const [priceChangeLogs, setPriceChangeLogs] = useState<PriceChangeLog[]>([]);
  const [priceChangeSummary, setPriceChangeSummary] = useState<PriceChangeSummary | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [minChangeFilter, setMinChangeFilter] = useState('');

  const loadPriceChanges = useCallback(async () => {
    setPriceLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (sourceFilter !== 'all') params.set('changeSource', sourceFilter);
      if (minChangeFilter) params.set('minChangePercent', minChangeFilter);

      const response = await fetch(`/api/reportes/auditoria/price-changes?${params}`);
      if (!response.ok) throw new Error('Error cargando datos');
      const data = await response.json();
      setPriceChangeLogs(data.logs || []);
      setPriceChangeSummary(data.summary || null);
    } catch (error) {
      console.error('Error loading price changes:', error);
      toast.error('Error al cargar cambios de precios');
    } finally {
      setPriceLoading(false);
    }
  }, [dateFrom, dateTo, sourceFilter, minChangeFilter]);

  useEffect(() => {
    if (activeSection === 'price-changes') {
      loadPriceChanges();
    }
  }, [activeSection, loadPriceChanges]);

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (sourceFilter !== 'all') params.set('changeSource', sourceFilter);
    if (minChangeFilter) params.set('minChangePercent', minChangeFilter);
    window.open(`/api/reportes/auditoria/price-changes?${params}`, '_blank');
    toast.success('Exportando CSV...');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'PRICE_LIST': return 'Lista de Precios';
      case 'PRODUCT_DIRECT': return 'Directo';
      case 'BULK_UPDATE': return 'Masivo';
      case 'IMPORT': return 'Importacion';
      default: return source;
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'PRICE_LIST': return 'bg-blue-100 text-blue-700';
      case 'PRODUCT_DIRECT': return 'bg-purple-100 text-purple-700';
      case 'BULK_UPDATE': return 'bg-amber-100 text-amber-700';
      case 'IMPORT': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredPriceLogs = priceChangeLogs.filter(log =>
    !searchTerm ||
    log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.createdByName && log.createdByName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const mockLogs = [
    {
      id: '1',
      timestamp: '2024-01-26 10:30:00',
      userName: 'Juan Pérez',
      action: 'LOGIN',
      resource: 'SISTEMA',
      details: 'Inicio de sesión exitoso',
      level: 'INFO',
      success: true,
    },
    {
      id: '2',
      timestamp: '2024-01-26 10:25:00',
      userName: 'Ana García',
      action: 'CREATE',
      resource: 'USUARIO',
      details: 'Creación de usuario: Carlos López',
      level: 'INFO',
      success: true,
    },
    {
      id: '3',
      timestamp: '2024-01-26 10:20:00',
      userName: 'Admin Sistema',
      action: 'UPDATE',
      resource: 'CONFIGURACION',
      details: 'Modificación de configuración de notificaciones',
      level: 'WARNING',
      success: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Auditoria</h1>
          <p className="text-muted-foreground">
            Registro de actividades y cambios del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeSection === 'general' ? 'default' : 'outline'}
            onClick={() => setActiveSection('general')}
          >
            <Activity className="h-4 w-4 mr-2" />
            General
          </Button>
          <Button
            variant={activeSection === 'price-changes' ? 'default' : 'outline'}
            onClick={() => setActiveSection('price-changes')}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Cambios de Precios
          </Button>
        </div>
      </div>

      {activeSection === 'general' && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,247</div>
                <p className="text-xs text-muted-foreground">Ultimas 24 horas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">24</div>
                <p className="text-xs text-muted-foreground">Usuarios con actividad</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eventos Criticos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">Requieren atencion</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Intentos Fallidos</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">Eventos no exitosos</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle>Buscar en Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en logs de auditoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Accion</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Detalles</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {log.timestamp}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          {log.userName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-3 w-3" />
                          {log.action}
                        </div>
                      </TableCell>
                      <TableCell>{log.resource}</TableCell>
                      <TableCell className="max-w-xs truncate" title={log.details}>
                        {log.details}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.level === 'INFO' ? 'default' : 'secondary'}>
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.success ? 'default' : 'destructive'}>
                          {log.success ? 'Exitoso' : 'Fallido'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {activeSection === 'price-changes' && (
        <>
          {/* Price Change Stats */}
          {priceChangeSummary && (
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cambios</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{priceChangeSummary.totalChanges}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aumentos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{priceChangeSummary.increases}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disminuciones</CardTitle>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{priceChangeSummary.decreases}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cambio Promedio</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {priceChangeSummary.averageChangePercent.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Significativos</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{priceChangeSummary.significantChanges}</div>
                  <p className="text-xs text-muted-foreground">Cambios &gt;20%</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadPriceChanges} disabled={priceLoading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${priceLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-1" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por producto o usuario..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setSearchTerm('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[150px]"
                    placeholder="Desde"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[150px]"
                    placeholder="Hasta"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Origen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los origenes</SelectItem>
                    <SelectItem value="PRICE_LIST">Lista de Precios</SelectItem>
                    <SelectItem value="PRODUCT_DIRECT">Producto Directo</SelectItem>
                    <SelectItem value="BULK_UPDATE">Masivo</SelectItem>
                    <SelectItem value="IMPORT">Importacion</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Cambio min %"
                  value={minChangeFilter}
                  onChange={(e) => setMinChangeFilter(e.target.value)}
                  className="w-[130px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Price Changes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Cambios de Precios de Venta</CardTitle>
            </CardHeader>
            <CardContent>
              {priceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPriceLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay cambios de precios registrados</p>
                  <p className="text-sm mt-1">Los cambios se registraran automaticamente al modificar precios</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Precio Anterior</TableHead>
                      <TableHead className="text-right">Precio Nuevo</TableHead>
                      <TableHead className="text-right">Cambio</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Lista</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPriceLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(log.createdAt).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[200px]">{log.productName}</p>
                            <p className="text-xs text-muted-foreground">{log.productCode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {log.previousPrice != null ? formatCurrency(log.previousPrice) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(log.newPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              log.changePercentage > 0
                                ? 'text-red-600 border-red-200'
                                : log.changePercentage < 0
                                ? 'text-green-600 border-green-200'
                                : ''
                            }`}
                          >
                            {log.changePercentage > 0 ? '+' : ''}
                            {log.changePercentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getSourceBadgeColor(log.changeSource)}`}>
                            {getSourceLabel(log.changeSource)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.salesPriceListName || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-3 w-3" />
                            {log.createdByName || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
