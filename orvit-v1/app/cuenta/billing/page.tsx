'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  CreditCard,
  Loader2,
  Building2,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Zap,
  FileText,
  Download,
  Gift,
  CreditCardIcon,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Pause,
  Play,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

// ============================================
// TYPES
// ============================================
interface SubscriptionData {
  hasSubscription: boolean;
  message?: string;
  subscription?: {
    id: string;
    status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED';
    billingCycle: 'MONTHLY' | 'ANNUAL';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingDate: string;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
    plan: {
      id: string;
      name: string;
      monthlyPrice: number;
      annualPrice: number | null;
      features: string[];
      maxCompanies: number | null;
      maxUsersPerCompany: number | null;
      includedTokensMonthly: number;
    };
    companies: Array<{
      id: number;
      name: string;
      isActive: boolean;
    }>;
    companiesCount: number;
  };
  tokens?: {
    included: number;
    purchased: number;
    usedThisPeriod: number;
    available: number;
  };
  autoPayment?: {
    isEnabled: boolean;
    provider: string;
    cardLast4: string | null;
    cardBrand: string | null;
    cardExpMonth: number | null;
    cardExpYear: number | null;
    lastPaymentAt: string | null;
    failedAttempts: number;
  };
  activeCoupon?: {
    id: string;
    couponId: string;
    coupon: {
      code: string;
      name: string;
      discountType: string;
      discountValue: number;
    };
    remainingUses: number | null;
    validUntil: string | null;
  };
  recentInvoices?: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string;
    dueDate: string;
    paidAt: string | null;
    createdAt: string;
  }>;
  tokenHistory?: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

// ============================================
// STATUS CONFIGS
// ============================================
const subscriptionStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  TRIALING: {
    label: 'Período de Prueba',
    color: 'bg-primary/10 text-primary border-primary/20',
    icon: Clock,
  },
  ACTIVE: {
    label: 'Activa',
    color: 'bg-success/10 text-success border-success/20',
    icon: CheckCircle,
  },
  PAST_DUE: {
    label: 'Pago Vencido',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: AlertCircle,
  },
  CANCELED: {
    label: 'Cancelada',
    color: 'bg-muted text-muted-foreground border-border',
    icon: XCircle,
  },
  PAUSED: {
    label: 'Pausada',
    color: 'bg-warning/10 text-warning-muted-foreground border-warning/20',
    icon: Pause,
  },
};

const invoiceStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  OPEN: { label: 'Pendiente', color: 'bg-warning/10 text-warning-muted-foreground' },
  PAID: { label: 'Pagada', color: 'bg-success/10 text-success' },
  VOID: { label: 'Anulada', color: 'bg-destructive/10 text-destructive' },
  UNCOLLECTIBLE: { label: 'Incobrable', color: 'bg-orange-500/10 text-orange-500' },
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
// FETCHERS
// ============================================
async function fetchMySubscription(): Promise<SubscriptionData> {
  const res = await fetch('/api/billing/my-subscription?include=invoices,tokenHistory');
  if (!res.ok) throw new Error('Error al obtener suscripción');
  return res.json();
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function ClientBillingPage() {
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState('');
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: fetchMySubscription,
  });

  // Mutations
  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/billing/my-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate_coupon', code }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: (result) => {
      if (result.isValid) {
        toast.success(`Cupón válido: ${result.discountDisplay}`);
        setShowCouponDialog(false);
        setCouponCode('');
        queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      } else {
        toast.error(result.error || 'Cupón no válido');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/my-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(result.message);
      setShowCancelDialog(false);
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/billing/my-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Error al cargar la información</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['my-subscription'] })}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data.hasSubscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Mi Suscripción</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona tu plan y facturación
          </p>
        </div>

        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground" />
            <h3 className="text-xl font-semibold">No tienes una suscripción activa</h3>
            <p className="text-muted-foreground">
              Contacta al administrador para obtener acceso a la plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription, tokens, autoPayment, activeCoupon, recentInvoices, tokenHistory } = data;
  if (!subscription || !tokens) return null;

  const statusInfo = subscriptionStatusConfig[subscription.status];
  const StatusIcon = statusInfo?.icon || CheckCircle;
  const daysUntilRenewal = differenceInDays(new Date(subscription.nextBillingDate), new Date());
  const tokenUsagePercent = subscription.plan.includedTokensMonthly > 0
    ? Math.min(100, (tokens.usedThisPeriod / subscription.plan.includedTokensMonthly) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mi Suscripción</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona tu plan y facturación
          </p>
        </div>
      </div>

      {/* Alerts */}
      {subscription.status === 'PAST_DUE' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Pago vencido</AlertTitle>
          <AlertDescription>
            Tu suscripción tiene un pago pendiente. Por favor regulariza tu situación para evitar la suspensión del servicio.
          </AlertDescription>
        </Alert>
      )}

      {subscription.cancelAtPeriodEnd && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Suscripción programada para cancelar</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Tu suscripción se cancelará el {format(new Date(subscription.currentPeriodEnd), "d 'de' MMMM, yyyy", { locale: es })}.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
            >
              {reactivateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reactivar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {subscription.trialEndsAt && new Date(subscription.trialEndsAt) > new Date() && (
        <Alert>
          <Gift className="h-4 w-4" />
          <AlertTitle>Período de prueba</AlertTitle>
          <AlertDescription>
            Tu período de prueba finaliza el {format(new Date(subscription.trialEndsAt), "d 'de' MMMM, yyyy", { locale: es })}.
            Luego comenzarás a ser facturado normalmente.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Plan {subscription.plan.name}</CardTitle>
                <CardDescription>
                  {subscription.billingCycle === 'MONTHLY' ? 'Facturación mensual' : 'Facturación anual'}
                </CardDescription>
              </div>
              <Badge className={cn('text-sm px-3 py-1', statusInfo?.color)}>
                <StatusIcon className="h-4 w-4 mr-1" />
                {statusInfo?.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Precio</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    subscription.billingCycle === 'MONTHLY'
                      ? subscription.plan.monthlyPrice
                      : (subscription.plan.annualPrice || subscription.plan.monthlyPrice * 12)
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  /{subscription.billingCycle === 'MONTHLY' ? 'mes' : 'año'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Empresas</p>
                <p className="text-2xl font-bold">
                  {subscription.companiesCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{subscription.plan.maxCompanies ?? '∞'}
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Próximo cobro</p>
                <p className="text-lg font-semibold">
                  {format(new Date(subscription.nextBillingDate), 'dd/MM/yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  en {daysUntilRenewal} días
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Período actual</p>
                <p className="text-sm">
                  {format(new Date(subscription.currentPeriodStart), 'dd/MM')} -{' '}
                  {format(new Date(subscription.currentPeriodEnd), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>

            <Separator />

            {/* Features */}
            {subscription.plan.features.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-3">Incluido en tu plan:</p>
                <div className="grid grid-cols-2 gap-2">
                  {subscription.plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            {!subscription.cancelAtPeriodEnd && subscription.status !== 'CANCELED' && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancelar suscripción
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowCouponDialog(true)}>
              <Gift className="h-4 w-4 mr-2" />
              Aplicar cupón
            </Button>
          </CardFooter>
        </Card>

        {/* Tokens Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning-muted-foreground" />
              Tokens
            </CardTitle>
            <CardDescription>
              Balance y uso de tokens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Token Balance */}
            <div className="text-center">
              <p className="text-4xl font-bold">{tokens.available}</p>
              <p className="text-sm text-muted-foreground">tokens disponibles</p>
            </div>

            {/* Token Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Incluidos (mensuales)</span>
                <span className="font-medium">{tokens.included}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comprados</span>
                <span className="font-medium">{tokens.purchased}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Usados este período</span>
                <span className="font-medium">{tokens.usedThisPeriod}</span>
              </div>
            </div>

            {/* Usage Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uso del período</span>
                <span>{Math.round(tokenUsagePercent)}%</span>
              </div>
              <Progress value={tokenUsagePercent} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto-Payment Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCardIcon className="h-5 w-5" />
                  Pago Automático
                </CardTitle>
                <CardDescription>
                  Configuración de débito automático
                </CardDescription>
              </div>
              {autoPayment?.isEnabled ? (
                <Badge className="bg-success/10 text-success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Activo
                </Badge>
              ) : (
                <Badge variant="outline">
                  Desactivado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {autoPayment?.isEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                  <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold">
                    {autoPayment.cardBrand?.toUpperCase().slice(0, 4) || 'CARD'}
                  </div>
                  <div>
                    <p className="font-medium">
                      •••• •••• •••• {autoPayment.cardLast4 || '****'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vence {autoPayment.cardExpMonth}/{autoPayment.cardExpYear}
                    </p>
                  </div>
                </div>

                {autoPayment.lastPaymentAt && (
                  <p className="text-sm text-muted-foreground">
                    Último pago: {format(new Date(autoPayment.lastPaymentAt), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                )}

                {autoPayment.failedAttempts > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {autoPayment.failedAttempts} intento(s) fallido(s). Por favor verifica tu método de pago.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <CreditCardIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No tienes pago automático configurado
                </p>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar pago automático
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Coupon Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-500" />
              Cupón Activo
            </CardTitle>
            <CardDescription>
              Descuentos aplicados a tu suscripción
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeCoupon ? (
              <div className="p-4 rounded-lg border bg-purple-500/5 border-purple-500/20">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono">
                    {activeCoupon.coupon.code}
                  </Badge>
                  <Badge className="bg-purple-500/10 text-purple-500">
                    {activeCoupon.coupon.discountType === 'PERCENTAGE'
                      ? `${activeCoupon.coupon.discountValue}% OFF`
                      : formatCurrency(activeCoupon.coupon.discountValue) + ' OFF'}
                  </Badge>
                </div>
                <p className="font-medium">{activeCoupon.coupon.name}</p>
                <div className="mt-2 text-sm text-muted-foreground">
                  {activeCoupon.remainingUses !== null && (
                    <p>{activeCoupon.remainingUses} uso(s) restante(s)</p>
                  )}
                  {activeCoupon.validUntil && (
                    <p>Válido hasta {format(new Date(activeCoupon.validUntil), 'dd/MM/yyyy')}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No tienes cupones activos
                </p>
                <Button variant="outline" onClick={() => setShowCouponDialog(true)}>
                  Ingresar código de cupón
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Facturas Recientes
          </CardTitle>
          <CardDescription>
            Historial de facturación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentInvoices && recentInvoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.map((invoice) => {
                  const statusInfo = invoiceStatusConfig[invoice.status];
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.number}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(invoice.createdAt), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-xs', statusInfo?.color)}>
                          {statusInfo?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            window.open(`/api/superadmin/invoices/${invoice.id}/pdf`, '_blank');
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay facturas para mostrar
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token History */}
      {tokenHistory && tokenHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning-muted-foreground" />
              Historial de Tokens
            </CardTitle>
            <CardDescription>
              Últimos movimientos de tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tokenHistory.slice(0, 10).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.createdAt), "d 'de' MMMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                  <Badge
                    variant={tx.amount > 0 ? 'default' : 'secondary'}
                    className={cn(
                      tx.amount > 0
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Companies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Mis Empresas
          </CardTitle>
          <CardDescription>
            Empresas asociadas a tu suscripción ({subscription.companiesCount}
            {subscription.plan.maxCompanies && ` de ${subscription.plan.maxCompanies}`})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscription.companies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscription.companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <Badge
                        variant={company.isActive ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {company.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No tienes empresas asociadas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coupon Dialog */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Cupón</DialogTitle>
            <DialogDescription>
              Ingresa el código de tu cupón de descuento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código de cupón</Label>
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="CODIGO123"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCouponDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => validateCouponMutation.mutate(couponCode)}
              disabled={!couponCode || validateCouponMutation.isPending}
            >
              {validateCouponMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Validar cupón
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Suscripción</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar tu suscripción?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Tu suscripción seguirá activa hasta el final del período actual
                ({format(new Date(subscription.currentPeriodEnd), "d 'de' MMMM, yyyy", { locale: es })}).
                Podrás reactivarla en cualquier momento antes de esa fecha.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCancelDialog(false)}>
              Mantener suscripción
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
