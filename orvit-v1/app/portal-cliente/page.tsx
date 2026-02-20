'use client';

/**
 * Client Portal - Main Dashboard
 *
 * Complete customer self-service portal with:
 * - Account summary
 * - Outstanding invoices
 * - Payment history
 * - Current account statement
 * - Orders & quotations
 * - Support tickets
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  Wallet,
  ShoppingBag,
  AlertCircle,
  Download,
  Eye,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  LogOut,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientSession {
  id: string;
  name: string;
  legalName: string;
  cuit: string;
  email: string;
  currentBalance: number;
  creditLimit: number;
}

interface Invoice {
  id: number;
  numero: string;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  total: number;
  saldoPendiente: number;
  estado: string;
  tipo: string;
  diasVencidos: number;
}

interface Payment {
  id: number;
  numero: string;
  fechaPago: Date;
  totalPago: number;
  estado: string;
}

interface Order {
  id: number;
  numero: string;
  fecha: Date;
  total: number;
  estado: string;
}

export default function ClientPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data states
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadClientSession();
  }, []);

  useEffect(() => {
    if (session) {
      loadDashboardData();
    }
  }, [session]);

  const loadClientSession = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portal-cliente/session', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/portal-cliente/login');
          return;
        }
        throw new Error('Error loading session');
      }

      const data = await response.json();
      setSession(data.client);
    } catch (error) {
      console.error('Error loading session:', error);
      router.push('/portal-cliente/login');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    if (!session) return;

    try {
      // Load outstanding invoices
      const invoicesResp = await fetch(
        `/api/portal-cliente/facturas?estado=EMITIDA,PARCIALMENTE_COBRADA&limit=10`,
        { credentials: 'include' }
      );
      if (invoicesResp.ok) {
        const invoicesData = await invoicesResp.json();
        setInvoices(invoicesData.data || []);
      }

      // Load recent payments
      const paymentsResp = await fetch(
        `/api/portal-cliente/pagos?limit=5`,
        { credentials: 'include' }
      );
      if (paymentsResp.ok) {
        const paymentsData = await paymentsResp.json();
        setPayments(paymentsData.data || []);
      }

      // Load recent orders
      const ordersResp = await fetch(
        `/api/portal-cliente/ordenes?limit=5`,
        { credentials: 'include' }
      );
      if (ordersResp.ok) {
        const ordersData = await ordersResp.json();
        setOrders(ordersData.data || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/portal-cliente/logout', {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/portal-cliente/login');
  };

  const handleDownloadInvoice = async (invoiceId: number) => {
    window.open(`/api/portal-cliente/facturas/${invoiceId}/pdf`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Calculate stats
  const pendingInvoices = invoices.filter(inv => Number(inv.saldoPendiente) > 0);
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + Number(inv.saldoPendiente), 0);
  const overdueInvoices = pendingInvoices.filter(inv => inv.diasVencidos > 0);
  const totalPayments = payments.reduce((sum, pmt) => sum + Number(pmt.totalPago), 0);

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-info-muted flex items-center justify-center">
                <User className="w-6 h-6 text-info-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{session.name || session.legalName}</h1>
                <p className="text-sm text-muted-foreground">CUIT: {session.cuit}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="dashboard">
              <DollarSign className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="facturas">
              <FileText className="w-4 h-4 mr-2" />
              Mis Facturas
            </TabsTrigger>
            <TabsTrigger value="pagos">
              <Wallet className="w-4 h-4 mr-2" />
              Mis Pagos
            </TabsTrigger>
            <TabsTrigger value="ordenes">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Mis Pedidos
            </TabsTrigger>
            <TabsTrigger value="cuenta-corriente">
              <TrendingUp className="w-4 h-4 mr-2" />
              Cta. Cte.
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-info-muted-foreground" />
                    Saldo Pendiente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {formatCurrency(totalPending)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pendingInvoices.length} factura(s) pendiente(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    Facturas Vencidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {overdueInvoices.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(overdueInvoices.reduce((sum, inv) => sum + Number(inv.saldoPendiente), 0))}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-success" />
                    Pagos del Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">
                    {formatCurrency(totalPayments)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payments.length} pago(s) registrado(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    Límite de Crédito
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(session.creditLimit || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponible: {formatCurrency(Math.max(0, (session.creditLimit || 0) - session.currentBalance))}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pending Invoices */}
            <Card>
              <CardHeader>
                <CardTitle>Facturas Pendientes</CardTitle>
                <CardDescription>
                  Facturas con saldo a pagar
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingInvoices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No tienes facturas pendientes</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Vencimiento</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.numero}</TableCell>
                            <TableCell>{format(new Date(invoice.fechaEmision), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {invoice.fechaVencimiento && format(new Date(invoice.fechaVencimiento), 'dd/MM/yyyy')}
                                {invoice.diasVencidos > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    Vencida {invoice.diasVencidos}d
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              {formatCurrency(invoice.saldoPendiente)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={invoice.diasVencidos > 0 ? 'destructive' : 'outline'}>
                                {invoice.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadInvoice(invoice.id)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Pagos Recientes</CardTitle>
                <CardDescription>
                  Últimos pagos registrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay pagos registrados
                  </div>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-success" />
                          </div>
                          <div>
                            <div className="font-medium">{payment.numero}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(payment.fechaPago), 'dd/MM/yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-success">
                            {formatCurrency(payment.totalPago)}
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {payment.estado}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other tabs */}
          <TabsContent value="facturas">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Vista completa de facturas en desarrollo</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('dashboard')}>
                  Volver al Dashboard
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagos">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Vista completa de pagos en desarrollo</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('dashboard')}>
                  Volver al Dashboard
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ordenes">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Vista completa de pedidos en desarrollo</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('dashboard')}>
                  Volver al Dashboard
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cuenta-corriente">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Vista de cuenta corriente en desarrollo</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('dashboard')}>
                  Volver al Dashboard
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
