'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  DollarSign,
  Package,
  Truck,
  RefreshCw,
  Loader2,
  MailOpen,
  Eye,
  ExternalLink,
  X,
  Settings,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Notification {
  id: number;
  type: string;
  priority: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  entityType?: string;
  entityId?: number;
  subject: string;
  body: string;
  metadata?: any;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'EXPIRED';
  createdAt: string;
  sentAt?: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  PEDIDO_APROBACION_REQUERIDA: FileText,
  PEDIDO_APROBADO: CheckCircle2,
  PEDIDO_RECHAZADO: AlertTriangle,
  OC_APROBACION_REQUERIDA: FileText,
  OC_APROBADA: CheckCircle2,
  RECEPCION_CONFIRMADA: Package,
  FACTURA_REGISTRADA: FileText,
  MATCH_EXCEPTION: AlertTriangle,
  MATCH_RESOLVED: CheckCircle2,
  PAGO_APROBACION_REQUERIDA: DollarSign,
  PAGO_APROBADO: DollarSign,
  PAGO_EJECUTADO: CheckCircle2,
  CAMBIO_BANCARIO_PENDIENTE: AlertTriangle,
  GRNI_AGING_ALERT: Clock,
  SLA_BREACH: AlertTriangle,
  EXCEPTION_ESCALATED: AlertTriangle,
  SYSTEM_ALERT: Bell,
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  URGENTE: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  ALTA: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  NORMAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  BAJA: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

const DEFAULT_COLORS = {
  chart1: '#6366f1',
  kpiNegative: '#ef4444',
};

interface NotificationCenterProps {
  showTrigger?: boolean;
  className?: string;
}

export function NotificationCenter({ showTrigger = true, className }: NotificationCenterProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const userColors = DEFAULT_COLORS;

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compras/notifications?limit=50&unreadOnly=false');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar al abrir
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  // Polling para el badge (cada 2 minutos)
  useEffect(() => {
    const checkUnread = async () => {
      try {
        const response = await fetch('/api/compras/notifications?limit=1&unreadOnly=true');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // Silent fail
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await fetch(`/api/compras/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, status: 'SENT' as const } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/compras/notifications/mark-all-read', {
        method: 'POST',
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'SENT' as const }))
      );
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  const handleNavigate = (notification: Notification) => {
    // Marcar como leída
    if (notification.status !== 'SENT') {
      handleMarkAsRead(notification.id);
    }

    // Navegar a la entidad
    if (notification.entityType && notification.entityId) {
      const routes: Record<string, string> = {
        PEDIDO: `/administracion/compras/pedidos`,
        OC: `/administracion/compras/ordenes/${notification.entityId}`,
        RECEPCION: `/administracion/compras/recepciones/${notification.entityId}`,
        FACTURA: `/administracion/compras/comprobantes/${notification.entityId}`,
        PAGO: `/administracion/compras/ordenes-pago`,
        PROVEEDOR: `/administracion/compras/proveedores/${notification.entityId}`,
        MATCH: `/administracion/compras/match`,
        GRNI: `/administracion/compras/grni`,
      };

      const route = routes[notification.entityType];
      if (route) {
        setOpen(false);
        router.push(route);
      }
    }
  };

  const getTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return '';
    }
  };

  const trigger = showTrigger ? (
    <Button
      variant="ghost"
      size="sm"
      className={cn("relative", className)}
      aria-label="Notificaciones"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}

      <SheetContent className="w-[400px] sm:w-[540px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" style={{ color: userColors.chart1 }} />
              Notificaciones
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} sin leer</Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={loadNotifications}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleMarkAllRead}
                >
                  <MailOpen className="h-4 w-4 mr-1" />
                  Marcar todas
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${userColors.chart1}15` }}
              >
                <Bell className="h-8 w-8" style={{ color: userColors.chart1 }} />
              </div>
              <p className="font-medium">No hay notificaciones</p>
              <p className="text-sm text-muted-foreground mt-1">
                Las notificaciones aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Bell;
                const priorityColors = PRIORITY_COLORS[notification.priority] || PRIORITY_COLORS.NORMAL;
                const isUnread = notification.status !== 'SENT';

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 cursor-pointer transition-colors hover:bg-muted/50",
                      isUnread && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                    onClick={() => handleNavigate(notification)}
                  >
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                          priorityColors.bg
                        )}
                      >
                        <Icon className={cn("h-5 w-5", priorityColors.text)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isUnread && "font-semibold"
                            )}
                          >
                            {notification.subject}
                          </p>
                          {isUnread && (
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                              style={{ backgroundColor: userColors.chart1 }}
                            />
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.body}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(notification.createdAt)}
                          </span>
                          {notification.priority !== 'NORMAL' && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5",
                                priorityColors.border,
                                priorityColors.text
                              )}
                            >
                              {notification.priority}
                            </Badge>
                          )}
                          {notification.entityType && (
                            <Badge variant="secondary" className="text-[10px]">
                              {notification.entityType}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notification.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Badge para mostrar en header
export function NotificationBadge({ className }: { className?: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkUnread = async () => {
      try {
        const response = await fetch('/api/compras/notifications?limit=1&unreadOnly=true');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // Silent fail
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (unreadCount === 0) return null;

  return (
    <Badge
      variant="destructive"
      className={cn("h-5 min-w-[20px] px-1 text-xs", className)}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}
