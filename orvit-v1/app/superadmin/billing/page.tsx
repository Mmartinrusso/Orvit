'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Search,
  Loader2,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  MoreVertical,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Plus,
  Coins,
  FileText,
  Users,
  Zap,
  Pause,
  Play,
  Ban,
  BarChart3,
  Activity,
  Edit,
  Puzzle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Gift,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

// ============================================
// TYPES
// ============================================
interface Module {
  key: string;
  name: string;
  category: string;
  icon: string | null;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number | null;
  maxCompanies: number | null;
  maxUsersPerCompany: number | null;
  includedTokensMonthly: number;
  moduleKeys: string[];
  features: string[];
  isActive: boolean;
  color: string;
  activeSubscriptions: number;
}

interface Subscription {
  id: string;
  userId: number;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED';
  billingCycle: 'MONTHLY' | 'ANNUAL';
  startDate: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  cancelAtPeriodEnd: boolean;
  tokens: {
    included: number;
    purchased: number;
    usedThisPeriod: number;
    available: number;
  };
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
  };
  plan: {
    id: string;
    name: string;
    displayName: string;
    monthlyPrice: number;
    annualPrice: number | null;
    maxCompanies: number | null;
  };
  companiesCount: number;
  invoicesCount: number;
  createdAt: string;
}

interface Invoice {
  id: string;
  number: string;
  subscriptionId: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  docType: 'T1' | 'T2';
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  plan: {
    id: string;
    displayName: string;
  };
}

interface BillingMetrics {
  period: string;
  generatedAt: string;
  mrr: number;
  arr: number;
  totalRevenue: number;
  pendingRevenue: number;
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
    paused: number;
    canceled: number;
  };
  newSubscriptions: number;
  canceledSubscriptions: number;
  churnRate: number;
  growthRate: number;
  tokensConsumed: number;
  tokenTransactions: number;
  tokenUsageByType: Array<{
    type: string;
    amount: number;
    count: number;
  }>;
  invoices: Array<{
    status: string;
    count: number;
    total: number;
  }>;
  paidInvoices: number;
  planDistribution: Array<{
    planId: string;
    planName: string;
    color: string;
    count: number;
  }>;
  revenueChart: Array<{
    month: string;
    revenue: number;
    count: number;
  }>;
  recentActivity: Array<{
    type: 'payment' | 'subscription';
    id: string;
    userName: string;
    userEmail: string;
    amount?: number;
    planName?: string;
    method?: string;
    date: string;
  }>;
}

// ============================================
// STATUS CONFIGS
// ============================================
const subscriptionStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  TRIALING: {
    label: 'En prueba',
    color: 'bg-info/10 text-info-muted-foreground border-info-muted/20',
    icon: Clock,
  },
  ACTIVE: {
    label: 'Activa',
    color: 'bg-success/10 text-success border-success-muted/20',
    icon: CheckCircle,
  },
  PAST_DUE: {
    label: 'Pago vencido',
    color: 'bg-destructive/10 text-destructive border-destructive/30/20',
    icon: AlertCircle,
  },
  CANCELED: {
    label: 'Cancelada',
    color: 'bg-muted text-muted-foreground border-border',
    icon: XCircle,
  },
  PAUSED: {
    label: 'Pausada',
    color: 'bg-warning/10 text-warning-muted-foreground border-warning-muted/20',
    icon: Pause,
  },
};

const invoiceStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: {
    label: 'Borrador',
    color: 'bg-muted text-muted-foreground border-border',
    icon: FileText,
  },
  OPEN: {
    label: 'Abierta',
    color: 'bg-info/10 text-info-muted-foreground border-info-muted/20',
    icon: Clock,
  },
  PAID: {
    label: 'Pagada',
    color: 'bg-success/10 text-success border-success-muted/20',
    icon: CheckCircle,
  },
  VOID: {
    label: 'Anulada',
    color: 'bg-destructive/10 text-destructive border-destructive/30/20',
    icon: XCircle,
  },
  UNCOLLECTIBLE: {
    label: 'Incobrable',
    color: 'bg-warning/10 text-warning-muted-foreground border-warning-muted/20',
    icon: AlertCircle,
  },
};

// ============================================
// FETCHERS
// ============================================
async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch('/api/superadmin/plans');
  if (!res.ok) throw new Error('Error al obtener planes');
  const data = await res.json();
  return data.plans;
}

async function fetchSubscriptions(): Promise<{ subscriptions: Subscription[]; total: number }> {
  const res = await fetch('/api/superadmin/subscriptions');
  if (!res.ok) throw new Error('Error al obtener suscripciones');
  return res.json();
}

async function fetchInvoices(): Promise<{ invoices: Invoice[]; total: number }> {
  const res = await fetch('/api/superadmin/invoices');
  if (!res.ok) throw new Error('Error al obtener facturas');
  return res.json();
}

async function fetchSummary() {
  const res = await fetch('/api/superadmin/invoices?summary=true');
  if (!res.ok) throw new Error('Error al obtener resumen');
  const data = await res.json();
  return data.summary;
}

async function fetchMetrics(period: string = '30d'): Promise<BillingMetrics> {
  const res = await fetch(`/api/superadmin/billing/metrics?period=${period}`);
  if (!res.ok) throw new Error('Error al obtener métricas');
  return res.json();
}

async function fetchModules(): Promise<Module[]> {
  const res = await fetch('/api/superadmin/templates');
  if (!res.ok) return [];
  const data = await res.json();
  return data.modules || [];
}

// Category colors for modules
const categoryColors: Record<string, string> = {
  VENTAS: 'bg-info/10 text-info-muted-foreground border-info-muted/20',
  COMPRAS: 'bg-success/10 text-success border-success-muted/20',
  MANTENIMIENTO: 'bg-warning/10 text-warning-muted-foreground border-warning-muted/20',
  COSTOS: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ADMINISTRACION: 'bg-muted text-muted-foreground border-border',
  GENERAL: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatCurrency(amount: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function BillingPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('metrics');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [metricsPeriod, setMetricsPeriod] = useState('30d');

  // Dialog states
  const [addTokensDialog, setAddTokensDialog] = useState<{ open: boolean; subscription: Subscription | null }>({
    open: false,
    subscription: null,
  });
  const [registerPaymentDialog, setRegisterPaymentDialog] = useState<{ open: boolean; invoice: Invoice | null }>({
    open: false,
    invoice: null,
  });
  const [createPlanDialog, setCreatePlanDialog] = useState(false);
  const [createSubscriptionDialog, setCreateSubscriptionDialog] = useState(false);
  const [editPlanDialog, setEditPlanDialog] = useState<{ open: boolean; plan: Plan | null }>({
    open: false,
    plan: null,
  });

  // Queries
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: fetchPlans,
  });

  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['billing', 'subscriptions'],
    queryFn: fetchSubscriptions,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: fetchInvoices,
  });

  const { data: summary } = useQuery({
    queryKey: ['billing', 'summary'],
    queryFn: fetchSummary,
  });

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['billing', 'metrics', metricsPeriod],
    queryFn: () => fetchMetrics(metricsPeriod),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: fetchModules,
  });

  const subscriptions = subscriptionsData?.subscriptions || [];
  const invoices = invoicesData?.invoices || [];

  // Stats
  const stats = {
    totalRevenue: summary?.totalRevenue || 0,
    pendingRevenue: summary?.pendingRevenue || 0,
    activeSubscriptions: subscriptions.filter(s => s.status === 'ACTIVE').length,
    totalSubscriptions: subscriptions.length,
  };

  // Mutations
  const addTokensMutation = useMutation({
    mutationFn: async ({ subscriptionId, amount, unitPrice }: {
      subscriptionId: string;
      amount: number;
      unitPrice: number;
    }) => {
      const res = await fetch(`/api/superadmin/subscriptions/${subscriptionId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          amount,
          unitPrice,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Tokens agregados correctamente');
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscriptions'] });
      setAddTokensDialog({ open: false, subscription: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const registerPaymentMutation = useMutation({
    mutationFn: async ({ invoiceId, amount, method, docType }: {
      invoiceId: string;
      amount: number;
      method: string;
      docType: string;
    }) => {
      const res = await fetch(`/api/superadmin/invoices/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, docType }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Pago registrado correctamente');
      queryClient.invalidateQueries({ queryKey: ['billing', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'summary'] });
      setRegisterPaymentDialog({ open: false, invoice: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/superadmin/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Suscripción actualizada');
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscriptions'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (planData: any) => {
      const res = await fetch('/api/superadmin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Plan creado correctamente');
      queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
      setCreatePlanDialog(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: { userId: number; planId: string; billingCycle: string; startTrial: boolean }) => {
      const res = await fetch('/api/superadmin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Suscripcion creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing', 'metrics'] });
      setCreateSubscriptionDialog(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/superadmin/plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Plan actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
      setEditPlanDialog({ open: false, plan: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch =
      sub.user.name.toLowerCase().includes(search.toLowerCase()) ||
      sub.user.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.user.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (plansLoading || subscriptionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturación</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestión de suscripciones, facturas y tokens
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">Ingresos Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.pendingRevenue)}</p>
                <p className="text-sm text-muted-foreground">Pendiente de Cobro</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-info-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
                <p className="text-sm text-muted-foreground">Suscripciones Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{plans.filter(p => p.isActive).length}</p>
                <p className="text-sm text-muted-foreground">Planes Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="metrics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Users className="h-4 w-4 mr-2" />
            Suscripciones
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Facturas
          </TabsTrigger>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Planes
          </TabsTrigger>
        </TabsList>

        {/* Search & Filters - only for non-metrics tabs */}
        {activeTab !== 'metrics' && (
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-9"
              />
            </div>
            {activeTab !== 'plans' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {activeTab === 'subscriptions' ? (
                    <>
                      <SelectItem value="ACTIVE">Activas</SelectItem>
                      <SelectItem value="TRIALING">En prueba</SelectItem>
                      <SelectItem value="PAST_DUE">Pago vencido</SelectItem>
                      <SelectItem value="PAUSED">Pausadas</SelectItem>
                      <SelectItem value="CANCELED">Canceladas</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="DRAFT">Borrador</SelectItem>
                      <SelectItem value="OPEN">Abiertas</SelectItem>
                      <SelectItem value="PAID">Pagadas</SelectItem>
                      <SelectItem value="VOID">Anuladas</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="mt-4 space-y-6">
          {/* Period selector and refresh */}
          <div className="flex items-center justify-between">
            <Select value={metricsPeriod} onValueChange={setMetricsPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="90d">Últimos 90 días</SelectItem>
                <SelectItem value="1y">Último año</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchMetrics()}
              disabled={metricsLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", metricsLoading && "animate-spin")} />
              Actualizar
            </Button>
          </div>

          {metricsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : metrics ? (
            <>
              {/* Alert Cards - Important items requiring attention */}
              {(metrics.subscriptions.pastDue > 0 || metrics.pendingRevenue > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {metrics.subscriptions.pastDue > 0 && (
                    <Card className="border-destructive/30/50 bg-destructive/5">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-destructive">
                              {metrics.subscriptions.pastDue} suscripciones con pago vencido
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Requieren atención inmediata
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30/50 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setStatusFilter('PAST_DUE');
                              setActiveTab('subscriptions');
                            }}
                          >
                            Ver
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {metrics.pendingRevenue > 0 && (
                    <Card className="border-warning-muted/50 bg-warning/5">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-warning-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-warning-muted-foreground">
                              {formatCurrency(metrics.pendingRevenue)} pendiente de cobro
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Facturas abiertas sin pagar
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-warning-muted/50 text-warning-muted-foreground hover:bg-warning/10"
                            onClick={() => {
                              setStatusFilter('OPEN');
                              setActiveTab('invoices');
                            }}
                          >
                            Ver
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Key Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="lg:col-span-1">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">MRR</p>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ARR: {formatCurrency(metrics.arr)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-success" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-1">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Ingresos del Período</p>
                        <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pendiente: {formatCurrency(metrics.pendingRevenue)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-info-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-1">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">ARPU</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(
                            metrics.subscriptions.active > 0
                              ? metrics.mrr / metrics.subscriptions.active
                              : 0
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ingreso promedio por usuario
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-indigo-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-1">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Crecimiento</p>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold">{metrics.growthRate}%</p>
                          {metrics.growthRate >= 0 ? (
                            <ArrowUpRight className="h-5 w-5 text-success" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5 text-destructive" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          +{metrics.newSubscriptions} / -{metrics.canceledSubscriptions}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-1">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Churn Rate</p>
                        <p className="text-2xl font-bold">{metrics.churnRate}%</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metrics.canceledSubscriptions} canceladas
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center",
                        metrics.churnRate > 5 ? "bg-destructive/10" : "bg-success/10"
                      )}>
                        <TrendingDown className={cn(
                          "h-6 w-6",
                          metrics.churnRate > 5 ? "text-destructive" : "text-success"
                        )} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Chart */}
              {metrics.revenueChart && metrics.revenueChart.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5" />
                      Ingresos por Mes
                    </CardTitle>
                    <CardDescription>
                      Últimos 6 meses de facturación pagada
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(() => {
                        const maxRevenue = Math.max(...metrics.revenueChart.map((r: any) => r.revenue || 0), 1);
                        return metrics.revenueChart.map((item: any, idx: number) => {
                          const monthDate = new Date(item.month);
                          const monthName = format(monthDate, 'MMM yyyy', { locale: es });
                          const percentage = (item.revenue / maxRevenue) * 100;
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize">{monthName}</span>
                                <span className="font-medium">{formatCurrency(item.revenue)}</span>
                              </div>
                              <div className="h-6 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                  style={{ width: `${Math.max(percentage, 5)}%` }}
                                >
                                  {percentage > 20 && (
                                    <span className="text-xs font-medium text-white">
                                      {item.count} fact.
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Subscriptions & Tokens Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subscription Status Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-5 w-5" />
                      Estado de Suscripciones
                    </CardTitle>
                    <CardDescription>
                      {metrics.subscriptions.total} suscripciones totales
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-success" />
                            Activas
                          </span>
                          <span className="font-medium">{metrics.subscriptions.active}</span>
                        </div>
                        <Progress
                          value={(metrics.subscriptions.active / metrics.subscriptions.total) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-info" />
                            En Prueba
                          </span>
                          <span className="font-medium">{metrics.subscriptions.trialing}</span>
                        </div>
                        <Progress
                          value={(metrics.subscriptions.trialing / metrics.subscriptions.total) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-destructive" />
                            Pago Vencido
                          </span>
                          <span className="font-medium">{metrics.subscriptions.pastDue}</span>
                        </div>
                        <Progress
                          value={(metrics.subscriptions.pastDue / metrics.subscriptions.total) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-warning" />
                            Pausadas
                          </span>
                          <span className="font-medium">{metrics.subscriptions.paused}</span>
                        </div>
                        <Progress
                          value={(metrics.subscriptions.paused / metrics.subscriptions.total) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Plan Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="h-5 w-5" />
                      Distribución por Plan
                    </CardTitle>
                    <CardDescription>
                      Suscripciones activas por plan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {metrics.planDistribution.map((plan) => (
                        <div key={plan.planId}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: plan.color }}
                              />
                              {plan.planName}
                            </span>
                            <span className="font-medium">{plan.count}</span>
                          </div>
                          <Progress
                            value={(plan.count / metrics.subscriptions.total) * 100}
                            className="h-2"
                            style={{
                              '--progress-background': plan.color
                            } as React.CSSProperties}
                          />
                        </div>
                      ))}
                      {metrics.planDistribution.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No hay datos de distribución
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tokens & Invoices Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Token Usage */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-5 w-5 text-warning-muted-foreground" />
                      Consumo de Tokens
                    </CardTitle>
                    <CardDescription>
                      {metrics.tokensConsumed.toLocaleString()} tokens consumidos en el período
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.tokenUsageByType.map((usage) => (
                        <div key={usage.type} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{usage.type || 'General'}</p>
                            <p className="text-xs text-muted-foreground">{usage.count} transacciones</p>
                          </div>
                          <Badge variant="secondary">
                            {usage.amount.toLocaleString()} tokens
                          </Badge>
                        </div>
                      ))}
                      {metrics.tokenUsageByType.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No hay consumo de tokens en el período
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Invoice Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5" />
                      Resumen de Facturas
                    </CardTitle>
                    <CardDescription>
                      {metrics.paidInvoices} facturas pagadas en el período
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.invoices.map((inv) => {
                        const config = invoiceStatusConfig[inv.status];
                        return (
                          <div key={inv.status} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <Badge className={cn('text-xs', config?.color)}>
                                {config?.label || inv.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {inv.count} facturas
                              </span>
                            </div>
                            <span className="font-medium">{formatCurrency(inv.total)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>
                    Últimos pagos y suscripciones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            activity.type === 'payment' ? "bg-success/10" : "bg-info/10"
                          )}>
                            {activity.type === 'payment' ? (
                              <DollarSign className="h-5 w-5 text-success" />
                            ) : (
                              <Users className="h-5 w-5 text-info-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{activity.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {activity.type === 'payment'
                                ? `Pago recibido - ${activity.method}`
                                : `Nueva suscripción - ${activity.planName}`
                              }
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {activity.type === 'payment' && activity.amount && (
                            <p className="font-medium text-success">
                              +{formatCurrency(activity.amount)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(activity.date), "d MMM, HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {metrics.recentActivity.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No hay actividad reciente
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Error al cargar métricas
            </div>
          )}
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateSubscriptionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Suscripcion
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-center">Empresas</TableHead>
                  <TableHead className="text-center">Tokens</TableHead>
                  <TableHead>Próximo Cobro</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((sub) => {
                  const statusInfo = subscriptionStatusConfig[sub.status];
                  const StatusIcon = statusInfo?.icon || CheckCircle;

                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.user.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.user.email}</p>
                          {sub.user.phone && (
                            <p className="text-xs text-muted-foreground">{sub.user.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.plan.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(sub.plan.monthlyPrice)}/mes
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          <Building2 className="h-3 w-3 mr-1" />
                          {sub.companiesCount}
                          {sub.plan.maxCompanies && ` / ${sub.plan.maxCompanies}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="outline">
                            <Zap className="h-3 w-3 mr-1" />
                            {sub.tokens.available}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {sub.tokens.included} inc + {sub.tokens.purchased} comp
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(sub.nextBillingDate), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs', statusInfo?.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setAddTokensDialog({ open: true, subscription: sub })}
                            >
                              <Coins className="h-4 w-4 mr-2" />
                              Agregar Tokens
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {sub.status === 'ACTIVE' && (
                              <DropdownMenuItem
                                onClick={() => updateSubscriptionMutation.mutate({
                                  id: sub.id,
                                  status: 'PAUSED',
                                })}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </DropdownMenuItem>
                            )}
                            {sub.status === 'PAUSED' && (
                              <DropdownMenuItem
                                onClick={() => updateSubscriptionMutation.mutate({
                                  id: sub.id,
                                  status: 'ACTIVE',
                                })}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Reactivar
                              </DropdownMenuItem>
                            )}
                            {sub.status !== 'CANCELED' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Cancelar suscripción',
                                    description: '¿Cancelar esta suscripción?',
                                    confirmText: 'Eliminar',
                                    variant: 'destructive',
                                  });
                                  if (ok) {
                                    updateSubscriptionMutation.mutate({
                                      id: sub.id,
                                      status: 'CANCELED',
                                    });
                                  }
                                }}
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredSubscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No se encontraron suscripciones
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => {
                  const statusInfo = invoiceStatusConfig[inv.status];
                  const StatusIcon = statusInfo?.icon || FileText;

                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <p className="font-medium font-mono text-sm">{inv.number}</p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{inv.user.name}</p>
                          <p className="text-xs text-muted-foreground">{inv.plan.displayName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(inv.periodStart), 'dd/MM')} -{' '}
                        {format(new Date(inv.periodEnd), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(inv.total)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(inv.dueDate), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={inv.docType === 'T1' ? 'default' : 'secondary'}>
                          {inv.docType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs', statusInfo?.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalle
                            </DropdownMenuItem>
                            {inv.status === 'OPEN' && (
                              <DropdownMenuItem
                                onClick={() => setRegisterPaymentDialog({ open: true, invoice: inv })}
                              >
                                <DollarSign className="h-4 w-4 mr-2" />
                                Registrar Pago
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No se encontraron facturas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreatePlanDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Plan
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.filter(p => p.isActive).map((plan) => (
              <Card key={plan.id} className="relative overflow-hidden group">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: plan.color }}
                />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{plan.activeSubscriptions} subs</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditPlanDialog({ open: true, plan })}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold">
                      {formatCurrency(plan.monthlyPrice)}
                      <span className="text-sm font-normal text-muted-foreground">/mes</span>
                    </p>
                    {plan.annualPrice && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(plan.annualPrice)}/año
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {plan.maxCompanies === null ? 'Empresas ilimitadas' : `${plan.maxCompanies} empresa(s)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {plan.maxUsersPerCompany === null
                          ? 'Usuarios ilimitados'
                          : `${plan.maxUsersPerCompany} usuarios/empresa`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>{plan.includedTokensMonthly} tokens/mes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Puzzle className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {plan.moduleKeys.length === 0
                          ? 'Todos los módulos'
                          : `${plan.moduleKeys.length} módulos`}
                      </span>
                    </div>
                  </div>

                  {plan.moduleKeys.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-medium mb-2">Módulos incluidos:</p>
                      <div className="flex flex-wrap gap-1">
                        {plan.moduleKeys.slice(0, 5).map((key) => (
                          <Badge key={key} variant="outline" className="text-[10px]">
                            {key}
                          </Badge>
                        ))}
                        {plan.moduleKeys.length > 5 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{plan.moduleKeys.length - 5} más
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {plan.features.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-medium mb-2">Características:</p>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {plan.features.slice(0, 4).map((feature, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-success" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Tokens Dialog */}
      <AddTokensDialog
        open={addTokensDialog.open}
        subscription={addTokensDialog.subscription}
        onClose={() => setAddTokensDialog({ open: false, subscription: null })}
        onSubmit={(amount, unitPrice) => {
          if (addTokensDialog.subscription) {
            addTokensMutation.mutate({
              subscriptionId: addTokensDialog.subscription.id,
              amount,
              unitPrice,
            });
          }
        }}
        loading={addTokensMutation.isPending}
      />

      {/* Register Payment Dialog */}
      <RegisterPaymentDialog
        open={registerPaymentDialog.open}
        invoice={registerPaymentDialog.invoice}
        onClose={() => setRegisterPaymentDialog({ open: false, invoice: null })}
        onSubmit={(amount, method, docType) => {
          if (registerPaymentDialog.invoice) {
            registerPaymentMutation.mutate({
              invoiceId: registerPaymentDialog.invoice.id,
              amount,
              method,
              docType,
            });
          }
        }}
        loading={registerPaymentMutation.isPending}
      />

      {/* Create Plan Dialog */}
      <CreatePlanDialog
        open={createPlanDialog}
        onClose={() => setCreatePlanDialog(false)}
        onSubmit={(planData) => createPlanMutation.mutate(planData)}
        loading={createPlanMutation.isPending}
      />

      {/* Create Subscription Dialog */}
      <CreateSubscriptionDialog
        open={createSubscriptionDialog}
        onClose={() => setCreateSubscriptionDialog(false)}
        plans={plans}
        onSubmit={(data) => createSubscriptionMutation.mutate(data)}
        loading={createSubscriptionMutation.isPending}
      />

      {/* Edit Plan Dialog */}
      <EditPlanDialog
        open={editPlanDialog.open}
        plan={editPlanDialog.plan}
        modules={modules}
        onClose={() => setEditPlanDialog({ open: false, plan: null })}
        onSubmit={(data) => {
          if (editPlanDialog.plan) {
            updatePlanMutation.mutate({ id: editPlanDialog.plan.id, ...data });
          }
        }}
        loading={updatePlanMutation.isPending}
      />
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================
function AddTokensDialog({
  open,
  subscription,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onSubmit: (amount: number, unitPrice: number) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState('100');
  const [unitPrice, setUnitPrice] = useState('10');

  const handleSubmit = () => {
    const amountNum = parseInt(amount, 10);
    const priceNum = parseFloat(unitPrice);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Cantidad inválida');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Precio inválido');
      return;
    }

    onSubmit(amountNum, priceNum);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Tokens</DialogTitle>
          <DialogDescription>
            Agregar tokens comprados a la suscripción de {subscription?.user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cantidad de tokens</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="space-y-2">
            <Label>Precio por token (ARS)</Label>
            <Input
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="10"
            />
          </div>
          {amount && unitPrice && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Total: <span className="font-bold">{formatCurrency(parseInt(amount) * parseFloat(unitPrice))}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar Tokens
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RegisterPaymentDialog({
  open,
  invoice,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSubmit: (amount: number, method: string, docType: string) => void;
  loading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [docType, setDocType] = useState('T1');

  // Reset form when invoice changes
  useState(() => {
    if (invoice) {
      setAmount(invoice.total.toString());
    }
  });

  const handleSubmit = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Monto inválido');
      return;
    }
    onSubmit(amountNum, method, docType);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Factura {invoice?.number} - Total: {invoice && formatCurrency(invoice.total)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={invoice?.total.toString()}
            />
          </div>
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="TRANSFER">Transferencia</SelectItem>
                <SelectItem value="CARD">Tarjeta</SelectItem>
                <SelectItem value="MERCADOPAGO">MercadoPago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de comprobante</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="T1">T1 - Fiscal</SelectItem>
                <SelectItem value="T2">T2 - No Fiscal</SelectItem>
              </SelectContent>
            </Select>
            {docType === 'T2' && (
              <p className="text-xs text-muted-foreground">
                T2 = Pago en efectivo sin comprobante fiscal
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePlanDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [annualPrice, setAnnualPrice] = useState('');
  const [maxCompanies, setMaxCompanies] = useState('1');
  const [maxUsersPerCompany, setMaxUsersPerCompany] = useState('5');
  const [includedTokensMonthly, setIncludedTokensMonthly] = useState('100');
  const [color, setColor] = useState('#8B5CF6');

  const resetForm = () => {
    setName('');
    setDisplayName('');
    setDescription('');
    setMonthlyPrice('');
    setAnnualPrice('');
    setMaxCompanies('1');
    setMaxUsersPerCompany('5');
    setIncludedTokensMonthly('100');
    setColor('#8B5CF6');
  };

  const handleSubmit = () => {
    if (!name || !displayName) {
      toast.error('Nombre y nombre de display son requeridos');
      return;
    }
    if (!monthlyPrice || parseFloat(monthlyPrice) < 0) {
      toast.error('El precio mensual es requerido');
      return;
    }

    onSubmit({
      name,
      displayName,
      description: description || null,
      monthlyPrice: parseFloat(monthlyPrice),
      annualPrice: annualPrice ? parseFloat(annualPrice) : null,
      maxCompanies: maxCompanies ? parseInt(maxCompanies) : null,
      maxUsersPerCompany: maxUsersPerCompany ? parseInt(maxUsersPerCompany) : null,
      includedTokensMonthly: parseInt(includedTokensMonthly) || 0,
      color,
      features: [],
      moduleKeys: [],
    });
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Plan</DialogTitle>
          <DialogDescription>
            Define un nuevo plan de suscripcion para tus clientes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre interno *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="PREMIUM"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre display *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Premium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripcion</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Plan para empresas medianas..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Precio mensual (ARS) *</Label>
              <Input
                type="number"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                placeholder="15000"
              />
            </div>
            <div className="space-y-2">
              <Label>Precio anual (ARS)</Label>
              <Input
                type="number"
                value={annualPrice}
                onChange={(e) => setAnnualPrice(e.target.value)}
                placeholder="150000"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max empresas</Label>
              <Input
                type="number"
                value={maxCompanies}
                onChange={(e) => setMaxCompanies(e.target.value)}
                placeholder="Ilimitado"
              />
              <p className="text-xs text-muted-foreground">Vacio = ilimitado</p>
            </div>
            <div className="space-y-2">
              <Label>Max usuarios/emp</Label>
              <Input
                type="number"
                value={maxUsersPerCompany}
                onChange={(e) => setMaxUsersPerCompany(e.target.value)}
                placeholder="Ilimitado"
              />
            </div>
            <div className="space-y-2">
              <Label>Tokens/mes</Label>
              <Input
                type="number"
                value={includedTokensMonthly}
                onChange={(e) => setIncludedTokensMonthly(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Crear Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSubscriptionDialog({
  open,
  onClose,
  plans,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  plans: Plan[];
  onSubmit: (data: { userId: number; planId: string; billingCycle: string; startTrial: boolean }) => void;
  loading: boolean;
}) {
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [startTrial, setStartTrial] = useState(false);

  // Fetch ADMIN_ENTERPRISE users without subscription
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/superadmin/users?role=ADMIN_ENTERPRISE&noSubscription=true');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch users when dialog opens
  useState(() => {
    if (open) {
      fetchUsers();
    }
  });

  const handleSubmit = () => {
    if (!selectedUserId) {
      toast.error('Selecciona un usuario');
      return;
    }
    if (!selectedPlanId) {
      toast.error('Selecciona un plan');
      return;
    }

    onSubmit({
      userId: parseInt(selectedUserId),
      planId: selectedPlanId,
      billingCycle,
      startTrial,
    });
  };

  const resetForm = () => {
    setSelectedUserId('');
    setSelectedPlanId('');
    setBillingCycle('MONTHLY');
    setStartTrial(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose(); resetForm(); } else { fetchUsers(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Suscripcion</DialogTitle>
          <DialogDescription>
            Asigna un plan a un usuario ADMIN_ENTERPRISE
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Usuario *</Label>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay usuarios ADMIN_ENTERPRISE sin suscripcion
              </p>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Plan *</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.filter(p => p.isActive).map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.displayName} - {formatCurrency(plan.monthlyPrice)}/mes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ciclo de facturacion</Label>
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
                <SelectItem value="ANNUAL">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="startTrial"
              checked={startTrial}
              onChange={(e) => setStartTrial(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="startTrial" className="cursor-pointer">
              Iniciar con periodo de prueba (14 dias)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || users.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Crear Suscripcion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({
  open,
  plan,
  modules,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  plan: Plan | null;
  modules: Module[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [annualPrice, setAnnualPrice] = useState('');
  const [maxCompanies, setMaxCompanies] = useState('');
  const [maxUsersPerCompany, setMaxUsersPerCompany] = useState('');
  const [includedTokensMonthly, setIncludedTokensMonthly] = useState('');
  const [color, setColor] = useState('#8B5CF6');
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);

  // Initialize form when plan changes
  useEffect(() => {
    if (plan) {
      setDisplayName(plan.displayName);
      setDescription(plan.description || '');
      setMonthlyPrice(plan.monthlyPrice.toString());
      setAnnualPrice(plan.annualPrice?.toString() || '');
      setMaxCompanies(plan.maxCompanies?.toString() || '');
      setMaxUsersPerCompany(plan.maxUsersPerCompany?.toString() || '');
      setIncludedTokensMonthly(plan.includedTokensMonthly.toString());
      setColor(plan.color);
      setModuleKeys(plan.moduleKeys || []);
    }
  }, [plan]);

  const handleSubmit = () => {
    if (!displayName) {
      toast.error('El nombre es requerido');
      return;
    }
    if (!monthlyPrice || parseFloat(monthlyPrice) < 0) {
      toast.error('El precio mensual es requerido');
      return;
    }

    onSubmit({
      displayName,
      description: description || null,
      monthlyPrice: parseFloat(monthlyPrice),
      annualPrice: annualPrice ? parseFloat(annualPrice) : null,
      maxCompanies: maxCompanies ? parseInt(maxCompanies) : null,
      maxUsersPerCompany: maxUsersPerCompany ? parseInt(maxUsersPerCompany) : null,
      includedTokensMonthly: parseInt(includedTokensMonthly) || 0,
      color,
      moduleKeys,
    });
  };

  const toggleModule = (key: string) => {
    setModuleKeys(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const selectAllModules = () => {
    setModuleKeys(modules.map(m => m.key));
  };

  const clearAllModules = () => {
    setModuleKeys([]);
  };

  // Group modules by category
  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Plan - {plan?.displayName}</DialogTitle>
          <DialogDescription>
            Modifica los detalles y módulos del plan
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="modules">
              <Puzzle className="h-4 w-4 mr-2" />
              Módulos ({moduleKeys.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="flex-1 overflow-auto space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre display *</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Profesional"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del plan..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio mensual (ARS) *</Label>
                <Input
                  type="number"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  placeholder="15000"
                />
              </div>
              <div className="space-y-2">
                <Label>Precio anual (ARS)</Label>
                <Input
                  type="number"
                  value={annualPrice}
                  onChange={(e) => setAnnualPrice(e.target.value)}
                  placeholder="150000"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max empresas</Label>
                <Input
                  type="number"
                  value={maxCompanies}
                  onChange={(e) => setMaxCompanies(e.target.value)}
                  placeholder="Ilimitado"
                />
                <p className="text-xs text-muted-foreground">Vacío = ilimitado</p>
              </div>
              <div className="space-y-2">
                <Label>Max usuarios/emp</Label>
                <Input
                  type="number"
                  value={maxUsersPerCompany}
                  onChange={(e) => setMaxUsersPerCompany(e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label>Tokens/mes</Label>
                <Input
                  type="number"
                  value={includedTokensMonthly}
                  onChange={(e) => setIncludedTokensMonthly(e.target.value)}
                  placeholder="100"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modules" className="flex-1 overflow-hidden mt-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {moduleKeys.length === 0
                  ? 'Sin módulos = Todos los módulos permitidos'
                  : `${moduleKeys.length} módulos seleccionados`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllModules}>
                  Seleccionar todos
                </Button>
                <Button variant="outline" size="sm" onClick={clearAllModules}>
                  Limpiar
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {Object.entries(modulesByCategory).map(([category, categoryModules]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <Badge className={cn("text-xs", categoryColors[category])}>
                        {category}
                      </Badge>
                      <span className="text-muted-foreground/60">
                        ({categoryModules.filter(m => moduleKeys.includes(m.key)).length}/{categoryModules.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryModules.map((module) => (
                        <div
                          key={module.key}
                          onClick={() => toggleModule(module.key)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            moduleKeys.includes(module.key)
                              ? "bg-primary/10 border-primary/30"
                              : "bg-muted/50 border-border hover:border-primary/30"
                          )}
                        >
                          <Checkbox checked={moduleKeys.includes(module.key)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{module.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{module.key}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {modules.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No hay módulos disponibles
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
