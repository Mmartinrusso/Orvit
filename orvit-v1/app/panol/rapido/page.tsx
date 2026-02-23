'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  Package,
  History,
  ClipboardCheck,
  BarChart3,
  QrCode,
  CheckCircle2,
  Wrench,
  ClipboardList,
  Loader2,
  PackageCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRScanner } from '@/components/panol';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

type QuickAction = 'scan-in' | 'scan-out' | 'scan-view' | 'ot-pick' | null;

interface Reservation {
  id: number;
  toolId: number;
  quantity: number;
  status: string;
  tool: {
    id: number;
    name: string;
    stockQuantity: number;
    unit?: string;
    minStockLevel?: number;
  };
}

interface WorkOrder {
  id: number;
  title: string;
  status: string;
  type: string;
  priority: string;
  machine?: { id: number; name: string };
}

export default function AccionesRapidasPage() {
  const [activeAction, setActiveAction] = useState<QuickAction>(null);
  const [lastScanned, setLastScanned] = useState<{
    name: string;
    action: string;
    time: Date;
  } | null>(null);

  // OT Pick states
  const [otSearch, setOtSearch] = useState('');
  const [loadingOT, setLoadingOT] = useState(false);
  const [selectedOT, setSelectedOT] = useState<WorkOrder | null>(null);
  const [otReservations, setOtReservations] = useState<Reservation[]>([]);
  const [processingIds, setProcessingIds] = useState<number[]>([]);

  const handleScanComplete = (tool: any, action: string) => {
    setLastScanned({
      name: tool.name,
      action,
      time: new Date(),
    });
    setActiveAction(null);
  };

  const searchOT = async () => {
    if (!otSearch.trim()) return;

    setLoadingOT(true);
    try {
      // Buscar OT por número
      const otNumber = otSearch.replace(/[^0-9]/g, '');
      const res = await fetch(`/api/tools/reservations?workOrderId=${otNumber}&status=PENDING`);
      const data = await res.json();

      if (data.success && data.data.length > 0) {
        setOtReservations(data.data);
        setSelectedOT(data.data[0].workOrder);
        toast.success(`Encontradas ${data.data.length} reservas para OT-${otNumber}`);
      } else {
        toast.info('No hay reservas pendientes para esta OT');
        setOtReservations([]);
        setSelectedOT(null);
      }
    } catch (error) {
      toast.error('Error al buscar OT');
    } finally {
      setLoadingOT(false);
    }
  };

  const handlePickSingle = async (reservation: Reservation) => {
    setProcessingIds((prev) => [...prev, reservation.id]);
    try {
      const res = await fetch(`/api/tools/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pick' }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setOtReservations((prev) => prev.filter((r) => r.id !== reservation.id));
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al despachar');
    } finally {
      setProcessingIds((prev) => prev.filter((id) => id !== reservation.id));
    }
  };

  const handlePickAll = async () => {
    if (otReservations.length === 0) return;

    const ids = otReservations.map((r) => r.id);
    setProcessingIds(ids);

    let success = 0;
    let failed = 0;

    for (const reservation of otReservations) {
      try {
        const res = await fetch(`/api/tools/reservations/${reservation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pick' }),
        });

        const data = await res.json();
        if (data.success) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    if (success > 0) {
      toast.success(`Despachados ${success} items`);
    }
    if (failed > 0) {
      toast.error(`${failed} items fallaron`);
    }

    setOtReservations([]);
    setProcessingIds([]);
  };

  const clearOTSearch = () => {
    setOtSearch('');
    setSelectedOT(null);
    setOtReservations([]);
  };

  const quickActions = [
    {
      id: 'scan-in' as QuickAction,
      title: 'Entrada Rápida',
      description: 'Escanear para agregar stock',
      icon: ArrowUpCircle,
      color: 'text-success',
      bgColor: 'bg-success-muted',
    },
    {
      id: 'scan-out' as QuickAction,
      title: 'Salida Rápida',
      description: 'Escanear para retirar stock',
      icon: ArrowDownCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      id: 'scan-view' as QuickAction,
      title: 'Consultar Item',
      description: 'Escanear para ver detalles',
      icon: Search,
      color: 'text-info-muted-foreground',
      bgColor: 'bg-info-muted',
    },
    {
      id: 'ot-pick' as QuickAction,
      title: 'Pick por OT',
      description: 'Despachar por orden de trabajo',
      icon: ClipboardList,
      color: 'text-accent-purple-muted-foreground',
      bgColor: 'bg-accent-purple-muted',
    },
  ];

  const navigationLinks = [
    {
      href: '/panol',
      title: 'Inventario',
      description: 'Ver todos los items',
      icon: Package,
    },
    {
      href: '/panol/movimientos',
      title: 'Movimientos',
      description: 'Historial de entradas y salidas',
      icon: History,
    },
    {
      href: '/panol/reservas',
      title: 'Reservas',
      description: 'Reservas por OT',
      icon: ClipboardCheck,
    },
    {
      href: '/panol/dashboard',
      title: 'Dashboard',
      description: 'Métricas y analytics',
      icon: BarChart3,
    },
  ];

  return (
    <TooltipProvider>
      <div className="w-full p-0">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Acciones Rápidas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Escanea códigos QR o busca por OT para operaciones rápidas
              </p>
            </div>
            <Badge variant="outline" className="flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              Escáner activo
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 px-4 md:px-6 pb-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const isActive = activeAction === action.id;

              return (
                <Card
                  key={action.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    isActive && 'ring-2 ring-primary'
                  )}
                  onClick={() => setActiveAction(isActive ? null : action.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg', action.bgColor)}>
                        <Icon className={cn('h-5 w-5', action.color)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{action.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {action.description}
                        </p>
                      </div>
                      {isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Activo
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Scanner for QR actions */}
          {activeAction && activeAction !== 'ot-pick' && (
            <Card>
              <CardContent className="p-4">
                <QRScanner
                  mode={
                    activeAction === 'scan-in'
                      ? 'stock-in'
                      : activeAction === 'scan-out'
                      ? 'stock-out'
                      : 'view'
                  }
                  onScanComplete={(tool) =>
                    handleScanComplete(
                      tool,
                      activeAction === 'scan-in'
                        ? 'Entrada registrada'
                        : activeAction === 'scan-out'
                        ? 'Salida registrada'
                        : 'Consultado'
                    )
                  }
                  onClose={() => setActiveAction(null)}
                />
              </CardContent>
            </Card>
          )}

          {/* OT Pick Section */}
          {activeAction === 'ot-pick' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-accent-purple-muted-foreground" />
                  Despachar por Orden de Trabajo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Número de OT (ej: 123 o OT-123)"
                      value={otSearch}
                      onChange={(e) => setOtSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchOT()}
                      className="pl-10 h-10"
                    />
                    {otSearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={clearOTSearch}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Button onClick={searchOT} disabled={loadingOT || !otSearch.trim()}>
                    {loadingOT ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Buscar'
                    )}
                  </Button>
                </div>

                {/* Selected OT Info */}
                {selectedOT && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">OT-{selectedOT.id}: {selectedOT.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {selectedOT.machine && (
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              {selectedOT.machine.name}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {selectedOT.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'}
                          </Badge>
                        </div>
                      </div>
                      {otReservations.length > 0 && (
                        <Button size="sm" onClick={handlePickAll} disabled={processingIds.length > 0}>
                          {processingIds.length > 0 ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <PackageCheck className="h-4 w-4 mr-2" />
                          )}
                          Despachar Todo ({otReservations.length})
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Reservations Table */}
                {otReservations.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Repuesto</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otReservations.map((res) => {
                        const isLowStock = res.tool.stockQuantity < res.quantity;
                        const processing = processingIds.includes(res.id);

                        return (
                          <TableRow key={res.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{res.tool.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold">{res.quantity}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                {res.tool.unit || 'u'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className={cn(isLowStock && 'text-destructive font-medium')}>
                                  {res.tool.stockQuantity}
                                </span>
                                {isLowStock && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertTriangle className="h-3.5 w-3.5 text-warning-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>Stock insuficiente</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePickSingle(res)}
                                disabled={processing || isLowStock}
                              >
                                {processing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <ArrowDownCircle className="h-4 w-4 mr-1" />
                                    Despachar
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {selectedOT && otReservations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                    <p>No hay reservas pendientes para esta OT</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Last Scanned */}
          {lastScanned && !activeAction && (
            <Card className="border-success-muted/50 bg-success-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success-muted">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{lastScanned.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {lastScanned.name} - {format(lastScanned.time, 'HH:mm', { locale: es })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLastScanned(null)}
                    className="h-8"
                  >
                    Cerrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Links */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Acceso rápido</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {navigationLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <Card className="h-full hover:bg-muted/30 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="p-2 rounded-lg bg-muted w-fit mb-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-medium">{link.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {link.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
