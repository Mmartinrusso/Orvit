'use client';

import { useState, useEffect } from 'react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import {
  DollarSign,
  FileText,
  ShoppingCart,
  History,
  FileArchive,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  Loader2,
} from 'lucide-react';

// Color preferences interface
interface UserColorPreferences {
  themeName: string;
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

const DEFAULT_COLORS: UserColorPreferences = {
  themeName: 'Predeterminado',
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

type PermissionKey = 'canViewPrices' | 'canViewQuotes' | 'canAcceptQuotes' | 'canCreateOrders' | 'canViewHistory' | 'canViewDocuments';

interface QuickAccessCard {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  permission?: PermissionKey;
  colorKey: keyof UserColorPreferences;
}

const quickAccessCards: QuickAccessCard[] = [
  {
    href: '/portal/precios',
    title: 'Lista de Precios',
    description: 'Consulta precios actualizados de productos',
    icon: DollarSign,
    permission: 'canViewPrices',
    colorKey: 'chart1',
  },
  {
    href: '/portal/cotizaciones',
    title: 'Cotizaciones',
    description: 'Mira y acepta cotizaciones pendientes',
    icon: FileText,
    permission: 'canViewQuotes',
    colorKey: 'chart2',
  },
  {
    href: '/portal/pedidos',
    title: 'Pedidos',
    description: 'Crea y sigue tus pedidos',
    icon: ShoppingCart,
    permission: 'canCreateOrders',
    colorKey: 'chart5',
  },
  {
    href: '/portal/historial',
    title: 'Historial',
    description: 'Revisa compras y transacciones anteriores',
    icon: History,
    permission: 'canViewHistory',
    colorKey: 'chart6',
  },
  {
    href: '/portal/documentos',
    title: 'Documentos',
    description: 'Accede a facturas y comprobantes',
    icon: FileArchive,
    permission: 'canViewDocuments',
    colorKey: 'chart3',
  },
];

interface DashboardStats {
  cotizacionesPendientes: number;
  pedidosEnProceso: number;
  ultimoPedido: string | null;
}

export default function PortalHomePage() {
  const { user, canViewPrices, canViewQuotes, canCreateOrders, canViewHistory, canViewDocuments } = usePortalAuth();

  // Color preferences
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load color preferences from company config
  useEffect(() => {
    const loadColorPreferences = async () => {
      if (!user?.companyId) return;
      try {
        const response = await fetch(`/api/costos/color-preferences?companyId=${user.companyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.colors) {
            setUserColors(data.colors);
          }
        }
      } catch (error) {
        console.error('Error loading color preferences:', error);
      }
    };
    loadColorPreferences();
  }, [user?.companyId]);

  // Load dashboard stats
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        // These would come from actual APIs
        // For now, set placeholder stats
        setStats({
          cotizacionesPendientes: 0,
          pedidosEnProceso: 0,
          ultimoPedido: null,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const permissionMap: Record<string, boolean> = {
    canViewPrices,
    canViewQuotes,
    canCreateOrders,
    canViewHistory,
    canViewDocuments,
  };

  const availableCards = quickAccessCards.filter(card => {
    if (!card.permission) return true;
    return permissionMap[card.permission];
  });

  if (!user) return null;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Welcome Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {user.company.logo ? (
                <img
                  src={user.company.logo}
                  alt={user.company.name}
                  className="h-16 w-16 rounded-lg object-contain bg-muted p-1"
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}15` }}
                >
                  <Building2 className="h-8 w-8" style={{ color: userColors.chart1 }} />
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  Hola, {user.contact.firstName}
                </h1>
                <p className="text-muted-foreground mt-1">
                  Bienvenido al portal de clientes de <strong>{user.company.name}</strong>
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {user.client.legalName}
                  </Badge>
                  {user.contact.position && (
                    <span className="text-xs text-muted-foreground">
                      {user.contact.position}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {(canViewQuotes || canCreateOrders) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {canViewQuotes && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Cotizaciones
                      </p>
                      <p className="text-2xl font-bold">
                        {loading ? '-' : stats?.cotizacionesPendientes || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pendientes de respuesta
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
            )}
            {canCreateOrders && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Pedidos
                      </p>
                      <p className="text-2xl font-bold">
                        {loading ? '-' : stats?.pedidosEnProceso || 0}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        En proceso
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart5}15` }}
                    >
                      <Package className="h-5 w-5" style={{ color: userColors.chart5 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {user.limits.maxOrderAmount && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Limite Pedido
                      </p>
                      <p className="text-2xl font-bold">
                        ${user.limits.maxOrderAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Monto maximo
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart1}15` }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: userColors.chart1 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {user.limits.requiresApprovalAbove && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        Aprobacion
                      </p>
                      <p className="text-2xl font-bold">
                        ${user.limits.requiresApprovalAbove.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requiere desde
                      </p>
                    </div>
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors.chart3}15` }}
                    >
                      <AlertCircle className="h-5 w-5" style={{ color: userColors.chart3 }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick Access */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Acceso Rapido</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCards.map((card) => {
              const color = userColors[card.colorKey] as string;
              return (
                <Card
                  key={card.href}
                  className="group relative overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer border"
                >
                  {/* Left border accent */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: color }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <card.icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <CardTitle className="text-base">{card.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">
                      {card.description}
                    </CardDescription>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={card.href}>
                        Ir a {card.title.toLowerCase()}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Account Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: userColors.chart1 }} />
                Tu Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">Cliente</span>
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {user.client.name || user.client.legalName}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-sm text-muted-foreground">Empresa</span>
                  <span className="text-sm font-medium">{user.company.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                Tus Permisos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {[
                  { perm: canViewPrices, label: 'Ver precios', icon: DollarSign },
                  { perm: canViewQuotes, label: 'Ver cotizaciones', icon: FileText },
                  { perm: canCreateOrders, label: 'Crear pedidos', icon: ShoppingCart },
                  { perm: canViewHistory, label: 'Ver historial', icon: History },
                  { perm: canViewDocuments, label: 'Ver documentos', icon: FileArchive },
                ].map(({ perm, label, icon: Icon }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{label}</span>
                    </div>
                    {perm ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: userColors.kpiPositive }} />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
