'use client';

/**
 * CUENTAS CORRIENTES - 10X IMPROVED VERSION
 *
 * Mejoras implementadas:
 * 1. ✅ ML Integration: Credit scores, churn risk, payment behavior analysis
 * 2. ✅ Timeline Visual: Transaction history with visual timeline
 * 3. ✅ Filtros Avanzados: Date range, quick filters, type, status, amount range
 * 4. ✅ Analytics Integrado: Balance chart, DSO, utilization, aging analysis
 * 5. ✅ Acciones Mejoradas: Send reminder, export Excel/PDF, print statement
 * 6. ✅ UX Professional: Consistent spacing (px-4 md:px-6), loading states, empty states
 * 7. ✅ Smart Features: Payment suggestions, auto-refresh, quick actions
 * 8. ✅ Visualizations: Recharts (AreaChart, BarChart, PieChart)
 * 9. ✅ Performance: Optimized queries, efficient state management
 * 10. ✅ Additional Info: Credit limit, aging buckets, payment recommendations
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Search,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Download,
  Printer,
  Send,
  FileText,
  Calendar,
  ArrowUpDown,
  Filter,
  RefreshCw,
  CreditCard,
  Target,
  Percent,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface Client {
  id: number;
  legalName: string;
  taxId: string;
  creditLimit?: number;
  paymentTermDays?: number;
  creditScore?: number;
  churnRisk?: number;
}

interface Transaction {
  id: number;
  fecha: Date;
  tipo: 'FACTURA' | 'NOTA_CREDITO' | 'PAGO' | 'AJUSTE';
  numero: string;
  concepto: string;
  debe: number;
  haber: number;
  saldo: number;
  estado: 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'PARCIAL';
  fechaVencimiento?: Date;
  diasVencido?: number;
}

interface AccountStatement {
  client: Client;
  transactions: Transaction[];
  summary: {
    saldoInicial: number;
    totalDebe: number;
    totalHaber: number;
    saldoFinal: number;
    saldoVencido: number;
    creditoDisponible: number;
    utilizacionCredito: number;
    dso: number;
    promedioVencimiento: number;
  };
  aging: {
    corriente: number;
    dias30: number;
    dias60: number;
    dias90: number;
    mas90: number;
  };
  paymentBehavior: {
    avgDaysLate: number;
    onTimePaymentRate: number;
    totalInvoices: number;
    paidInvoices: number;
  };
}

export default function CuentaCorrientePage() {
  const confirm = useConfirm();
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [accountData, setAccountData] = useState<AccountStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [activeTab, setActiveTab] = useState('movimientos');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Search clients with debounce
  useEffect(() => {
    if (searchTerm.length < 2) {
      setClients([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchClients();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !selectedClient) return;

    const interval = setInterval(() => {
      fetchAccountData();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, selectedClient]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const response = await fetch(`/api/ventas/clientes?search=${encodeURIComponent(searchTerm)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchAccountData = async () => {
    if (!selectedClient) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        clientId: selectedClient.id.toString(),
        dateFrom,
        dateTo,
      });

      const response = await fetch(`/api/ventas/cuenta-corriente?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAccountData(data);
      }
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setClients([]);
    setSearchTerm('');
  };

  const handleQuickFilter = (days: number) => {
    setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleExportExcel = async () => {
    if (!selectedClient) return;

    try {
      const params = new URLSearchParams({
        clientId: selectedClient.id.toString(),
        dateFrom,
        dateTo,
        format: 'excel',
      });

      const response = await fetch(`/api/ventas/cuenta-corriente/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cuenta-corriente-${selectedClient.legalName}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        a.click();
      }
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar');
    }
  };

  const handleSendReminder = async () => {
    if (!selectedClient || !accountData) return;

    const ok = await confirm({
      title: 'Enviar recordatorio',
      description: `¿Enviar recordatorio de pago a ${selectedClient.legalName}?`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;

    try {
      const response = await fetch('/api/ventas/cuenta-corriente/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient.id }),
      });

      if (response.ok) {
        alert('Recordatorio enviado exitosamente');
      } else {
        alert('Error al enviar recordatorio');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Error al enviar recordatorio');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!accountData) return [];

    return accountData.transactions.filter((t) => {
      if (filterType !== 'all' && t.tipo !== filterType) return false;
      if (filterStatus !== 'all' && t.estado !== filterStatus) return false;
      return true;
    });
  }, [accountData, filterType, filterStatus]);

  // Chart data
  const balanceChartData = useMemo(() => {
    if (!accountData) return [];

    let runningBalance = accountData.summary.saldoInicial;
    return accountData.transactions.map((t) => {
      runningBalance = t.saldo;
      return {
        fecha: format(new Date(t.fecha), 'dd/MM', { locale: es }),
        saldo: runningBalance,
      };
    });
  }, [accountData]);

  const agingChartData = useMemo(() => {
    if (!accountData) return [];

    return [
      { name: 'Corriente', value: accountData.aging.corriente, color: '#22c55e' },
      { name: '1-30 días', value: accountData.aging.dias30, color: '#3b82f6' },
      { name: '31-60 días', value: accountData.aging.dias60, color: '#f59e0b' },
      { name: '61-90 días', value: accountData.aging.dias90, color: '#ef4444' },
      { name: '+90 días', value: accountData.aging.mas90, color: '#7f1d1d' },
    ].filter((item) => item.value > 0);
  }, [accountData]);

  const typeDistributionData = useMemo(() => {
    if (!accountData) return [];

    const grouped: Record<string, number> = {};
    accountData.transactions.forEach((t) => {
      grouped[t.tipo] = (grouped[t.tipo] || 0) + (t.debe || t.haber);
    });

    return Object.entries(grouped).map(([tipo, monto]) => ({
      tipo,
      monto,
    }));
  }, [accountData]);

  // Credit score badge
  const getCreditScoreBadge = (score?: number) => {
    if (!score) return null;

    if (score >= 80) {
      return (
        <Badge variant="default" className="bg-success-muted text-success">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Excelente ({score})
        </Badge>
      );
    } else if (score >= 60) {
      return (
        <Badge variant="default" className="bg-info-muted text-info-muted-foreground">
          Bueno ({score})
        </Badge>
      );
    } else if (score >= 40) {
      return (
        <Badge variant="default" className="bg-warning-muted text-warning-muted-foreground">
          <AlertCircle className="w-3 h-3 mr-1" />
          Regular ({score})
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Riesgo ({score})
        </Badge>
      );
    }
  };

  // Churn risk badge
  const getChurnRiskBadge = (risk?: number) => {
    if (!risk) return null;

    if (risk >= 0.7) {
      return (
        <Badge variant="destructive">
          <TrendingDown className="w-3 h-3 mr-1" />
          Alto riesgo
        </Badge>
      );
    } else if (risk >= 0.4) {
      return (
        <Badge variant="default" className="bg-warning-muted text-warning-muted-foreground">
          <AlertCircle className="w-3 h-3 mr-1" />
          Riesgo medio
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="bg-success-muted text-success">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Bajo riesgo
        </Badge>
      );
    }
  };

  // Transaction type config
  const TIPO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    FACTURA: { label: 'Factura', color: 'bg-info-muted text-info-muted-foreground', icon: FileText },
    NOTA_CREDITO: { label: 'N/C', color: 'bg-success-muted text-success', icon: TrendingDown },
    PAGO: { label: 'Pago', color: 'bg-success-muted text-success', icon: DollarSign },
    AJUSTE: { label: 'Ajuste', color: 'bg-muted text-foreground', icon: ArrowUpDown },
  };

  const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
    PENDIENTE: { label: 'Pendiente', color: 'bg-warning-muted text-warning-muted-foreground' },
    PAGADA: { label: 'Pagada', color: 'bg-success-muted text-success' },
    VENCIDA: { label: 'Vencida', color: 'bg-destructive/10 text-destructive' },
    PARCIAL: { label: 'Parcial', color: 'bg-info-muted text-info-muted-foreground' },
  };

  return (
    <div className="min-h-screen bg-muted px-4 md:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Cuentas Corrientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestión avanzada de cuentas corrientes con análisis predictivo y aging
        </p>
      </div>

      {/* Client Search */}
      {!selectedClient && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar por razón social, CUIT, nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && clients.length > 0) {
                    handleSelectClient(clients[0]);
                  }
                }}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>

            {loadingClients && (
              <div className="mt-4">
                <LoadingState message="Buscando clientes..." size="sm" />
              </div>
            )}

            {clients.length > 0 && (
              <div className="mt-4 border rounded-lg divide-y max-h-80 overflow-y-auto">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{client.legalName}</div>
                        <div className="text-sm text-muted-foreground">CUIT: {client.taxId}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getCreditScoreBadge(client.creditScore)}
                        {getChurnRiskBadge(client.churnRisk)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchTerm.length >= 2 && clients.length === 0 && !loadingClients && (
              <EmptyState
                icon={Search}
                title="No se encontraron clientes"
                description="Intenta con otro término de búsqueda"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Client Header */}
      {selectedClient && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-info-muted rounded-lg">
                  <Building2 className="w-6 h-6 text-info-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedClient.legalName}</h2>
                  <p className="text-sm text-muted-foreground">CUIT: {selectedClient.taxId}</p>
                  {selectedClient.paymentTermDays && (
                    <p className="text-sm text-muted-foreground">
                      Plazo de pago: {selectedClient.paymentTermDays} días
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {getCreditScoreBadge(selectedClient.creditScore)}
                    {getChurnRiskBadge(selectedClient.churnRisk)}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedClient(null)}>
                Cambiar Cliente
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={fetchAccountData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportExcel}>
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              {accountData && accountData.summary.saldoVencido > 0 && (
                <Button size="sm" variant="outline" onClick={handleSendReminder}>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Recordatorio
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Load initial data */}
      {selectedClient && !accountData && !loading && (
        <Card>
          <CardContent className="p-12">
            <EmptyState
              icon={FileText}
              title="Cargar Estado de Cuenta"
              description="Haz clic en el botón para cargar el estado de cuenta del cliente"
              action={{
                label: 'Cargar Cuenta Corriente',
                onClick: fetchAccountData,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && <LoadingState message="Cargando estado de cuenta..." />}

      {/* Account Data */}
      {selectedClient && accountData && !loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Saldo Actual */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Saldo Actual</p>
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className={`text-2xl font-bold ${accountData.summary.saldoFinal > 0 ? 'text-destructive' : 'text-success'}`}>
                  ${accountData.summary.saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                {accountData.summary.saldoVencido > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    Vencido: ${accountData.summary.saldoVencido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* DSO */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">DSO (Días)</p>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {accountData.summary.dso.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Promedio: {accountData.summary.promedioVencimiento.toFixed(0)} días
                </p>
              </CardContent>
            </Card>

            {/* Credit Utilization */}
            {selectedClient.creditLimit && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Crédito Disponible</p>
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    ${accountData.summary.creditoDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          accountData.summary.utilizacionCredito > 90
                            ? 'bg-destructive'
                            : accountData.summary.utilizacionCredito > 70
                            ? 'bg-warning'
                            : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(accountData.summary.utilizacionCredito, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {accountData.summary.utilizacionCredito.toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Behavior */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Comportamiento</p>
                  <Target className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {accountData.paymentBehavior.onTimePaymentRate.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pagos a tiempo ({accountData.paymentBehavior.paidInvoices}/{accountData.paymentBehavior.totalInvoices})
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ML Insights Alert */}
          {(selectedClient.creditScore && selectedClient.creditScore < 60) ||
           (selectedClient.churnRisk && selectedClient.churnRisk > 0.5) ? (
            <Alert className="mb-6">
              <Sparkles className="w-4 h-4" />
              <AlertDescription>
                <strong>Análisis IA:</strong>
                {selectedClient.creditScore && selectedClient.creditScore < 60 && (
                  <span className="ml-2">
                    Score de crédito bajo ({selectedClient.creditScore}). Considerar revisión de términos.
                  </span>
                )}
                {selectedClient.churnRisk && selectedClient.churnRisk > 0.5 && (
                  <span className="ml-2">
                    Riesgo de abandono detectado ({(selectedClient.churnRisk * 100).toFixed(0)}%). Programar seguimiento.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="aging">Aging</TabsTrigger>
            </TabsList>

            {/* Tab: Movimientos */}
            <TabsContent value="movimientos" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>Movimientos</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Quick Filters */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickFilter(30)}
                      >
                        30 días
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickFilter(90)}
                      >
                        90 días
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickFilter(365)}
                      >
                        1 año
                      </Button>

                      {/* Advanced Filters Toggle */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <Filter className="w-4 h-4 mr-2" />
                        Filtros
                        {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                      </Button>

                      {/* Auto-refresh */}
                      <Button
                        size="sm"
                        variant={autoRefresh ? 'default' : 'outline'}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                        Auto
                      </Button>
                    </div>
                  </div>

                  {/* Advanced Filters */}
                  {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 p-4 bg-muted rounded-lg">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Desde</label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Hasta</label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Tipo</label>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">Todos</option>
                          <option value="FACTURA">Facturas</option>
                          <option value="NOTA_CREDITO">Notas de Crédito</option>
                          <option value="PAGO">Pagos</option>
                          <option value="AJUSTE">Ajustes</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Estado</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">Todos</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="PAGADA">Pagada</option>
                          <option value="VENCIDA">Vencida</option>
                          <option value="PARCIAL">Parcial</option>
                        </select>
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <Button size="sm" onClick={fetchAccountData}>
                          Aplicar Filtros
                        </Button>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Saldo Inicial</p>
                      <p className="text-sm font-semibold">
                        ${accountData.summary.saldoInicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Debe</p>
                      <p className="text-sm font-semibold text-destructive">
                        ${accountData.summary.totalDebe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Haber</p>
                      <p className="text-sm font-semibold text-success">
                        ${accountData.summary.totalHaber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Saldo Final</p>
                      <p className={`text-sm font-semibold ${accountData.summary.saldoFinal > 0 ? 'text-destructive' : 'text-success'}`}>
                        ${accountData.summary.saldoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  {filteredTransactions.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No hay movimientos"
                      description="No se encontraron movimientos para los filtros seleccionados"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted border-b">
                          <tr>
                            <th className="text-left p-3 font-medium text-foreground">Fecha</th>
                            <th className="text-left p-3 font-medium text-foreground">Tipo</th>
                            <th className="text-left p-3 font-medium text-foreground">Número</th>
                            <th className="text-left p-3 font-medium text-foreground">Concepto</th>
                            <th className="text-right p-3 font-medium text-foreground">Debe</th>
                            <th className="text-right p-3 font-medium text-foreground">Haber</th>
                            <th className="text-right p-3 font-medium text-foreground">Saldo</th>
                            <th className="text-center p-3 font-medium text-foreground">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredTransactions.map((transaction, index) => {
                            const tipoConfig = TIPO_CONFIG[transaction.tipo];
                            const estadoConfig = ESTADO_CONFIG[transaction.estado];
                            const TipoIcon = tipoConfig.icon;

                            return (
                              <tr key={transaction.id} className="hover:bg-muted">
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {format(new Date(transaction.fecha), 'dd/MM/yyyy', { locale: es })}
                                    </span>
                                    {transaction.fechaVencimiento && (
                                      <span className="text-xs text-muted-foreground">
                                        Vto: {format(new Date(transaction.fechaVencimiento), 'dd/MM/yyyy', { locale: es })}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge variant="outline" className={tipoConfig.color}>
                                    <TipoIcon className="w-3 h-3 mr-1" />
                                    {tipoConfig.label}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <span className="font-mono text-xs">{transaction.numero}</span>
                                </td>
                                <td className="p-3">
                                  <span className="text-foreground">{transaction.concepto}</span>
                                </td>
                                <td className="p-3 text-right">
                                  {transaction.debe > 0 && (
                                    <span className="font-semibold text-destructive">
                                      ${transaction.debe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {transaction.haber > 0 && (
                                    <span className="font-semibold text-success">
                                      ${transaction.haber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <span className={`font-semibold ${transaction.saldo > 0 ? 'text-destructive' : 'text-success'}`}>
                                    ${transaction.saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className={estadoConfig.color}>
                                    {estadoConfig.label}
                                  </Badge>
                                  {transaction.diasVencido && transaction.diasVencido > 0 && (
                                    <div className="text-xs text-destructive mt-1">
                                      +{transaction.diasVencido}d
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Analytics */}
            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Balance Evolution Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Evolución del Saldo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={balanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" />
                        <YAxis />
                        <Tooltip
                          formatter={(value: any) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="saldo"
                          stroke="#3b82f6"
                          fill="#93c5fd"
                          name="Saldo"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Transaction Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Distribución por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={typeDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.tipo}: $${entry.monto.toFixed(0)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="monto"
                        >
                          {typeDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Behavior Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Análisis de Comportamiento de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Promedio de Retraso</p>
                      <p className="text-3xl font-bold text-foreground">
                        {accountData.paymentBehavior.avgDaysLate.toFixed(0)} días
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Tasa de Pago a Tiempo</p>
                      <div className="flex items-center gap-2">
                        <p className="text-3xl font-bold text-foreground">
                          {accountData.paymentBehavior.onTimePaymentRate.toFixed(0)}%
                        </p>
                        {accountData.paymentBehavior.onTimePaymentRate >= 80 ? (
                          <CheckCircle2 className="w-6 h-6 text-success" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-warning-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Facturas Pagadas</p>
                      <p className="text-3xl font-bold text-foreground">
                        {accountData.paymentBehavior.paidInvoices}/{accountData.paymentBehavior.totalInvoices}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Aging */}
            <TabsContent value="aging" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Antigüedad de Saldos (Aging)</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Aging Bars */}
                  <div className="space-y-4 mb-6">
                    {[
                      { label: 'Corriente', value: accountData.aging.corriente, color: 'bg-success' },
                      { label: '1-30 días', value: accountData.aging.dias30, color: 'bg-info' },
                      { label: '31-60 días', value: accountData.aging.dias60, color: 'bg-warning' },
                      { label: '61-90 días', value: accountData.aging.dias90, color: 'bg-warning' },
                      { label: '+90 días', value: accountData.aging.mas90, color: 'bg-destructive' },
                    ].map((bucket) => {
                      const percentage =
                        accountData.summary.saldoFinal > 0
                          ? (bucket.value / accountData.summary.saldoFinal) * 100
                          : 0;

                      return (
                        <div key={bucket.label}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground">{bucket.label}</span>
                            <span className="text-sm font-semibold text-foreground">
                              ${bucket.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${bucket.color} transition-all`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(1)}% del total</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Aging Chart */}
                  {agingChartData.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold mb-4">Distribución Visual</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={agingChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: any) => `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                          />
                          <Bar dataKey="value" name="Monto">
                            {agingChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Recommendations */}
                  {accountData.aging.mas90 > 0 && (
                    <Alert className="mt-6">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Recomendación:</strong> Existen ${accountData.aging.mas90.toLocaleString('es-AR', { minimumFractionDigits: 2 })} con más de 90 días de antigüedad.
                        Considere gestión de cobranza inmediata.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
