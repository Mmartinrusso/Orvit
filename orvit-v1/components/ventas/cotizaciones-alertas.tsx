'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  AlertTriangle,
  Clock,
  X,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlertaItem {
  id: number;
  numero: string;
  cliente: string;
  fechaValidez: string;
  diasRestantes: number;
  total: number;
}

interface AlertasData {
  cantidad: number;
  items: AlertaItem[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Auto-refresh interval (5 minutes)
const REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Popover de alertas para el header/sidebar
 */
export function CotizacionesAlertasPopover() {
  const router = useRouter();
  const [alertas, setAlertas] = useState<AlertasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchAlertas = useCallback(async () => {
    try {
      const response = await fetch('/api/ventas/cotizaciones/stats?periodo=30d');
      if (!response.ok) return;
      const data = await response.json();
      setAlertas(data.porVencer);
    } catch (error) {
      console.error('Error fetching alertas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertas();

    // Auto-refresh
    const interval = setInterval(fetchAlertas, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAlertas]);

  const handleClick = (id: number) => {
    setOpen(false);
    router.push(`/administracion/ventas/cotizaciones/${id}`);
  };

  const urgentes = alertas?.items.filter(a => a.diasRestantes <= 1).length || 0;
  const proximas = alertas?.items.filter(a => a.diasRestantes > 1 && a.diasRestantes <= 3).length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {alertas && alertas.cantidad > 0 && (
            <Badge
              variant={urgentes > 0 ? 'destructive' : 'secondary'}
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {alertas.cantidad}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-muted-foreground" />
            <span className="font-medium">Cotizaciones por Vencer</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => fetchAlertas()}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
        </div>

        {loading && !alertas ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : alertas && alertas.cantidad > 0 ? (
          <>
            <ScrollArea className="max-h-72">
              <div className="p-2">
                {alertas.items.map(item => (
                  <button
                    key={item.id}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                    onClick={() => handleClick(item.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.numero}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.cliente}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge
                          variant={item.diasRestantes <= 1 ? 'destructive' : item.diasRestantes <= 3 ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {item.diasRestantes === 0
                            ? 'Hoy'
                            : item.diasRestantes === 1
                            ? 'Mañana'
                            : `${item.diasRestantes}d`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => {
                  setOpen(false);
                  router.push('/administracion/ventas/cotizaciones?estado=ENVIADA');
                }}
              >
                Ver todas las cotizaciones
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay cotizaciones por vencer</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Banner de alerta para mostrar en la parte superior de la página
 */
export function CotizacionesAlertaBanner({ onDismiss }: { onDismiss?: () => void }) {
  const router = useRouter();
  const [alertas, setAlertas] = useState<AlertasData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlertas() {
      try {
        const response = await fetch('/api/ventas/cotizaciones/stats?periodo=7d');
        if (!response.ok) return;
        const data = await response.json();
        setAlertas(data.porVencer);
      } catch (error) {
        console.error('Error fetching alertas:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlertas();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // No mostrar si está cargando, dismissed, o no hay alertas urgentes
  if (loading || dismissed || !alertas) return null;

  const urgentes = alertas.items.filter(a => a.diasRestantes <= 1);
  if (urgentes.length === 0) return null;

  const montoTotal = urgentes.reduce((sum, a) => sum + a.total, 0);

  return (
    <div className="bg-warning-muted border border-warning-muted rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning-muted-foreground" />
          <div>
            <p className="font-medium text-warning-muted-foreground">
              {urgentes.length === 1
                ? '1 cotización vence hoy'
                : `${urgentes.length} cotizaciones vencen hoy`}
            </p>
            <p className="text-sm text-warning-muted-foreground">
              Total: {formatCurrency(montoTotal)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-warning-muted text-warning-muted-foreground hover:bg-warning-muted"
            onClick={() => router.push('/administracion/ventas/cotizaciones?estado=ENVIADA')}
          >
            Ver cotizaciones
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Widget de alertas compacto para sidebar
 */
export function CotizacionesAlertasWidget() {
  const router = useRouter();
  const [alertas, setAlertas] = useState<AlertasData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlertas() {
      try {
        const response = await fetch('/api/ventas/cotizaciones/stats?periodo=7d');
        if (!response.ok) return;
        const data = await response.json();
        setAlertas(data.porVencer);
      } catch (error) {
        console.error('Error fetching alertas:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlertas();

    // Auto-refresh
    const interval = setInterval(fetchAlertas, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (loading || !alertas || alertas.cantidad === 0) return null;

  const urgentes = alertas.items.filter(a => a.diasRestantes <= 1).length;

  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-warning-muted border border-warning-muted hover:bg-warning-muted/80 transition-colors text-left"
      onClick={() => router.push('/administracion/ventas/cotizaciones?estado=ENVIADA')}
    >
      <AlertTriangle className="w-4 h-4 text-warning-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-warning-muted-foreground truncate">
          {alertas.cantidad} por vencer
        </p>
        {urgentes > 0 && (
          <p className="text-xs text-warning-muted-foreground">
            {urgentes} urgente{urgentes > 1 ? 's' : ''}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-warning-muted-foreground shrink-0" />
    </button>
  );
}
