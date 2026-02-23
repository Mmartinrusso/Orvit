'use client';

import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { useState, useEffect, useCallback } from 'react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingCart,
  Eye,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  X,
  TrendingUp,
  Search,
  Minus,
  Trash2,
  MapPin,
  FileText,
  Calendar,
  Loader2,
  AlertCircle,
  ArrowRight,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Color preferences interface




interface Pedido {
  id: string;
  numero: string;
  estado: string;
  total: number;
  moneda: string;
  notasCliente: string | null;
  direccionEntrega: string | null;
  createdAt: string;
  processedAt: string | null;
  processNotes: string | null;
  rejectionReason: string | null;
  items: {
    id: string;
    product: { id: string; code: string; name: string } | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    notas: string | null;
  }[];
  cantidadItems: number;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  categoria: { id: number; name: string } | null;
  precio: number | null;
  moneda: string;
}

interface CartItem {
  productId: string;
  producto: Producto;
  cantidad: number;
  notas: string;
}

interface StatusInfo {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  colorKey: keyof UserColorPreferences;
  description: string;
}

const getStatusInfo = (status: string, colors: UserColorPreferences): StatusInfo => {
  const statusMap: Record<string, StatusInfo> = {
    PENDIENTE: {
      label: 'Pendiente',
      variant: 'secondary',
      icon: <Clock className="h-4 w-4" style={{ color: colors.chart4 }} />,
      colorKey: 'chart4',
      description: 'El pedido esta esperando ser revisado'
    },
    EN_REVISION: {
      label: 'En Revision',
      variant: 'default',
      icon: <Package className="h-4 w-4" style={{ color: colors.chart1 }} />,
      colorKey: 'chart1',
      description: 'El equipo esta revisando tu pedido'
    },
    CONFIRMADO: {
      label: 'Confirmado',
      variant: 'default',
      icon: <CheckCircle className="h-4 w-4" style={{ color: colors.kpiPositive }} />,
      colorKey: 'kpiPositive',
      description: 'El pedido ha sido aprobado'
    },
    CONVERTIDO: {
      label: 'Convertido',
      variant: 'default',
      icon: <CheckCircle className="h-4 w-4" style={{ color: colors.kpiPositive }} />,
      colorKey: 'kpiPositive',
      description: 'El pedido se convirtio en orden de venta'
    },
    RECHAZADO: {
      label: 'Rechazado',
      variant: 'destructive',
      icon: <XCircle className="h-4 w-4" style={{ color: colors.kpiNegative }} />,
      colorKey: 'kpiNegative',
      description: 'El pedido fue rechazado'
    },
    CANCELADO: {
      label: 'Cancelado',
      variant: 'outline',
      icon: <XCircle className="h-4 w-4" style={{ color: colors.kpiNeutral }} />,
      colorKey: 'kpiNeutral',
      description: 'El pedido fue cancelado'
    },
  };
  return statusMap[status] || {
    label: status,
    variant: 'outline',
    icon: <Clock className="h-4 w-4" />,
    colorKey: 'kpiNeutral',
    description: ''
  };
};

// Timeline component for order status
function OrderTimeline({ pedido, colors }: { pedido: Pedido; colors: UserColorPreferences }) {
  const steps = [
    { key: 'creado', label: 'Creado', date: pedido.createdAt, completed: true },
    { key: 'revision', label: 'En Revision', date: null, completed: ['EN_REVISION', 'CONFIRMADO', 'CONVERTIDO', 'RECHAZADO'].includes(pedido.estado) },
    { key: 'procesado', label: pedido.estado === 'RECHAZADO' ? 'Rechazado' : pedido.estado === 'CONVERTIDO' ? 'Convertido' : 'Confirmado', date: pedido.processedAt, completed: ['CONFIRMADO', 'CONVERTIDO', 'RECHAZADO'].includes(pedido.estado) },
  ];

  return (
    <div className="flex items-center gap-2 py-4">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
                step.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {step.completed ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <span className="text-xs font-medium">{idx + 1}</span>
              )}
            </div>
            <span className={cn(
              "text-xs text-center",
              step.completed ? "font-medium" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
            {step.date && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(step.date), 'dd/MM HH:mm')}
              </span>
            )}
          </div>
          {idx < steps.length - 1 && (
            <div className={cn(
              "flex-1 h-0.5 mx-2",
              steps[idx + 1].completed ? "bg-primary" : "bg-muted-foreground/30"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PortalPedidosPage() {
  const { user, canCreateOrders } = usePortalAuth();

  // Color preferences
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [estadisticas, setEstadisticas] = useState({
    pendientes: 0,
    enRevision: 0,
    confirmados: 0,
    convertidos: 0,
    rechazados: 0,
    cancelados: 0,
    total: 0,
  });
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Detail sheet
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  // New order modal
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load color preferences
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

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/portal/pedidos?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setPedidos(result.pedidos);
        setEstadisticas(result.estadisticas);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      if (searchProduct) params.set('search', searchProduct);
      params.set('limit', '100');

      const response = await fetch(`/api/portal/precios?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setProductos(result.productos || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, [searchProduct]);

  useEffect(() => {
    if (canCreateOrders) {
      fetchPedidos();
    }
  }, [canCreateOrders, status, page]);

  useEffect(() => {
    if (showNewOrder) {
      fetchProducts();
    }
  }, [showNewOrder, fetchProducts]);

  // Cart functions
  const addToCart = (producto: Producto) => {
    if (producto.precio === null) return;

    const existing = cart.find(item => item.productId === producto.id);
    if (existing) {
      setCart(cart.map(item =>
        item.productId === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      ));
    } else {
      setCart([...cart, { productId: producto.id, producto, cantidad: 1, notas: '' }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.cantidad + delta);
        return { ...item, cantidad: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.producto.precio || 0) * item.cantidad, 0);
  const cartTotalWithIva = cartTotal * 1.21;

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto al pedido');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/portal/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            cantidad: item.cantidad,
            notas: item.notas || undefined,
          })),
          notas: orderNotes || undefined,
          direccionEntrega: orderAddress || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Pedido ${result.pedido.numero} creado correctamente`);
        setShowNewOrder(false);
        setCart([]);
        setOrderNotes('');
        setOrderAddress('');
        fetchPedidos();
      } else {
        toast.error(result.error || 'Error al crear el pedido');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error al crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreateOrders) {
    return (
      <TooltipProvider>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div
              className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.kpiNegative}15` }}
            >
              <ShoppingCart className="h-8 w-8" style={{ color: userColors.kpiNegative }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
            <p className="text-muted-foreground">No tenes permisos para crear pedidos.</p>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-muted-foreground">Crea y sigue tus pedidos</p>
          </div>
          <Button onClick={() => setShowNewOrder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pedido
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Pendientes
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.pendientes}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esperando
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
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    En Revision
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.enRevision}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Procesando
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}15` }}
                >
                  <Package className="h-5 w-5" style={{ color: userColors.chart1 }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Confirmados
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.confirmados}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aprobados
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiPositive}15` }}
                >
                  <CheckCircle className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Convertidos
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.convertidos}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Entregados
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart5}15` }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: userColors.chart5 }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Total
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.total}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pedidos
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart2}15` }}
                >
                  <ShoppingCart className="h-5 w-5" style={{ color: userColors.chart2 }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="EN_REVISION">En Revision</SelectItem>
                  <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
                  <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                  <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              {status !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => { setStatus('all'); setPage(1); }}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar filtro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" style={{ color: userColors.chart1 }} />
              Pedidos
              <Badge variant="secondary" className="font-normal">
                {pagination.total} total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <ShoppingCart className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Cargando pedidos...</p>
                </div>
              </div>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-12">
                <div
                  className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiNeutral}15` }}
                >
                  <ShoppingCart className="h-8 w-8" style={{ color: userColors.kpiNeutral }} />
                </div>
                <h3 className="text-lg font-medium mb-1">No hay pedidos</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {status !== 'all' ? 'No hay pedidos con este estado' : 'Todavia no hay pedidos registrados'}
                </p>
                <Button onClick={() => setShowNewOrder(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer pedido
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidos.map((pedido) => {
                        const statusInfo = getStatusInfo(pedido.estado, userColors);
                        return (
                          <TableRow
                            key={pedido.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setSelectedPedido(pedido)}
                          >
                            <TableCell className="font-mono font-medium">{pedido.numero}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(pedido.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={statusInfo.variant}
                                className="flex items-center gap-1 w-fit"
                              >
                                {statusInfo.icon}
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{pedido.cantidadItems}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-bold text-foreground">
                                {pedido.moneda === 'USD' ? 'US$' : '$'}
                                {pedido.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setSelectedPedido(pedido); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Pagina {page} de {pagination.pages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === pagination.pages}
                        onClick={() => setPage(page + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Sheet */}
        <Sheet open={!!selectedPedido} onOpenChange={(open) => !open && setSelectedPedido(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedPedido && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${userColors[getStatusInfo(selectedPedido.estado, userColors).colorKey]}15` }}
                    >
                      {getStatusInfo(selectedPedido.estado, userColors).icon}
                    </div>
                    <div>
                      <SheetTitle className="flex items-center gap-2">
                        {selectedPedido.numero}
                      </SheetTitle>
                      <SheetDescription>
                        {format(new Date(selectedPedido.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                {/* Status Banner */}
                <div
                  className="mt-4 p-4 rounded-lg"
                  style={{ backgroundColor: `${userColors[getStatusInfo(selectedPedido.estado, userColors).colorKey]}10` }}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={getStatusInfo(selectedPedido.estado, userColors).variant}
                      className="flex items-center gap-1"
                    >
                      {getStatusInfo(selectedPedido.estado, userColors).icon}
                      {getStatusInfo(selectedPedido.estado, userColors).label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {getStatusInfo(selectedPedido.estado, userColors).description}
                  </p>
                </div>

                {/* Timeline */}
                <OrderTimeline pedido={selectedPedido} colors={userColors} />

                <Separator />

                {/* Items */}
                <div className="mt-4 space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" style={{ color: userColors.chart1 }} />
                    Productos ({selectedPedido.items.length})
                  </h4>

                  <div className="space-y-3">
                    {selectedPedido.items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.descripcion}</p>
                          <p className="text-xs text-muted-foreground">{item.product?.code}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="text-muted-foreground">
                              {item.cantidad} x ${item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <p className="font-bold whitespace-nowrap">
                          ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${(selectedPedido.total / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA (21%)</span>
                      <span>${(selectedPedido.total - selectedPedido.total / 1.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold" style={{ color: userColors.chart5 }}>
                        {selectedPedido.moneda === 'USD' ? 'US$' : '$'}
                        {selectedPedido.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                {(selectedPedido.notasCliente || selectedPedido.direccionEntrega) && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-4">
                      {selectedPedido.notasCliente && (
                        <div className="flex gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Notas</p>
                            <p className="text-sm text-muted-foreground">{selectedPedido.notasCliente}</p>
                          </div>
                        </div>
                      )}
                      {selectedPedido.direccionEntrega && (
                        <div className="flex gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Direccion de Entrega</p>
                            <p className="text-sm text-muted-foreground">{selectedPedido.direccionEntrega}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Rejection Reason */}
                {selectedPedido.estado === 'RECHAZADO' && selectedPedido.rejectionReason && (
                  <>
                    <Separator className="my-4" />
                    <div
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: `${userColors.kpiNegative}08`,
                        borderLeft: `3px solid ${userColors.kpiNegative}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4" style={{ color: userColors.kpiNegative }} />
                        <p className="font-medium text-sm" style={{ color: userColors.kpiNegative }}>
                          Motivo del Rechazo
                        </p>
                      </div>
                      <p className="text-sm">{selectedPedido.rejectionReason}</p>
                    </div>
                  </>
                )}

                {/* Process Notes */}
                {selectedPedido.processNotes && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Notas del Proceso</p>
                        <p className="text-sm text-muted-foreground">{selectedPedido.processNotes}</p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* New Order Dialog */}
        <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
          <DialogContent className="sm:max-w-6xl w-[95vw] h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" style={{ color: userColors.chart1 }} />
                Nuevo Pedido
              </DialogTitle>
              <DialogDescription>
                Selecciona productos y cantidades para crear tu pedido
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product List */}
              <div className="flex flex-col overflow-hidden border rounded-lg">
                <div className="p-3 border-b bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {loadingProducts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : productos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No se encontraron productos</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {productos.filter(p => p.precio !== null).map((producto) => {
                        const inCart = cart.find(item => item.productId === producto.id);
                        return (
                          <div
                            key={producto.id}
                            className={cn(
                              "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                              inCart && "bg-primary/5"
                            )}
                            onClick={() => addToCart(producto)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{producto.nombre}</p>
                                <p className="text-xs text-muted-foreground">{producto.codigo}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-sm">
                                  ${producto.precio?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-muted-foreground">/{producto.unidad}</p>
                              </div>
                            </div>
                            {inCart && (
                              <Badge variant="secondary" className="mt-2 text-xs">
                                {inCart.cantidad} en el carrito
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Cart */}
              <div className="flex flex-col overflow-hidden border rounded-lg">
                <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Carrito
                  </h4>
                  {cart.length > 0 && (
                    <Badge>{cart.length} items</Badge>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">El carrito esta vacio</p>
                      <p className="text-xs">Haz clic en un producto para agregarlo</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {cart.map((item) => (
                        <div key={item.productId} className="p-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.producto.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                ${item.producto.precio?.toLocaleString('es-AR', { minimumFractionDigits: 2 })} x {item.cantidad}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.productId, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">{item.cantidad}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.productId, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeFromCart(item.productId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-right font-bold text-sm mt-1">
                            ${((item.producto.precio || 0) * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Cart Totals & Form */}
                {cart.length > 0 && (
                  <div className="p-3 border-t space-y-3 bg-muted/30">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>${cartTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IVA (21%)</span>
                        <span>${(cartTotal * 0.21).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span style={{ color: userColors.chart5 }}>
                          ${cartTotalWithIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="orderNotes" className="text-xs">Notas (opcional)</Label>
                        <Textarea
                          id="orderNotes"
                          placeholder="Instrucciones especiales..."
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="orderAddress" className="text-xs">Direccion de entrega (opcional)</Label>
                        <Input
                          id="orderAddress"
                          placeholder="Direccion de entrega"
                          value={orderAddress}
                          onChange={(e) => setOrderAddress(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowNewOrder(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitOrder}
                disabled={cart.length === 0 || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Pedido
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
