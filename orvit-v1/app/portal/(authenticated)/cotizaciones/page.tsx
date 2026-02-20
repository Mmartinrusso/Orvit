'use client';

import { DEFAULT_COLORS, type UserColorPreferences } from '@/lib/colors';
import { useState, useEffect } from 'react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Loader2,
  Eye,
  Check,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

// Color preferences interface




interface Cotizacion {
  id: number;
  numero: string;
  fechaEmision: string;
  fechaValidez: string;
  estado: string;
  total: number;
  moneda: string;
  vendedor: { id: number; name: string; email: string };
  cantidadItems: number;
  vencida: boolean;
}

interface CotizacionDetalle extends Cotizacion {
  titulo: string | null;
  descripcion: string | null;
  subtotal: number;
  descuentoGlobal: number | null;
  descuentoMonto: number;
  tasaIva: number | null;
  impuestos: number;
  notas: string | null;
  condicionesPago: string | null;
  condicionesEntrega: string | null;
  tiempoEntrega: string | null;
  items: {
    id: number;
    codigo: string | null;
    descripcion: string;
    cantidad: number;
    unidad: string | null;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
    notas: string | null;
    product: { id: string; code: string; name: string; unit: string } | null;
  }[];
}

const estadoLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ENVIADA: { label: 'Enviada', variant: 'default' },
  EN_NEGOCIACION: { label: 'En Negociacion', variant: 'secondary' },
  ACEPTADA: { label: 'Aceptada', variant: 'default' },
  CONVERTIDA: { label: 'Convertida', variant: 'default' },
  PERDIDA: { label: 'Perdida', variant: 'destructive' },
  VENCIDA: { label: 'Vencida', variant: 'outline' },
};

export default function PortalCotizacionesPage() {
  const { user, canViewQuotes, canAcceptQuotes } = usePortalAuth();

  // Color preferences
  const [userColors, setUserColors] = useState<UserColorPreferences>(DEFAULT_COLORS);

  const [loading, setLoading] = useState(true);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [estadisticas, setEstadisticas] = useState({ pendientes: 0, aceptadas: 0, convertidas: 0, total: 0 });
  const [estado, setEstado] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Modal states
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<CotizacionDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [acceptAction, setAcceptAction] = useState<'accept' | 'reject'>('accept');
  const [acceptComment, setAcceptComment] = useState('');
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

  const fetchCotizaciones = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (estado && estado !== 'all') params.set('estado', estado);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/portal/cotizaciones?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setCotizaciones(result.cotizaciones);
        setEstadisticas(result.estadisticas);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalle = async (id: number) => {
    setLoadingDetalle(true);
    try {
      const response = await fetch(`/api/portal/cotizaciones/${id}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setDetalle(result);
      }
    } catch (error) {
      console.error('Error fetching quote detail:', error);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/portal/cotizaciones/${selectedId}/aceptar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          aceptar: acceptAction === 'accept',
          comentarios: acceptComment || undefined,
        }),
      });

      if (response.ok) {
        toast.success(acceptAction === 'accept' ? 'Cotizacion aceptada' : 'Cotizacion rechazada');
        setShowAcceptDialog(false);
        setSelectedId(null);
        setDetalle(null);
        setAcceptComment('');
        fetchCotizaciones();
      } else {
        toast.error('Error al procesar la cotizacion');
      }
    } catch (error) {
      console.error('Error accepting quote:', error);
      toast.error('Error al procesar la cotizacion');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (canViewQuotes) {
      fetchCotizaciones();
    }
  }, [canViewQuotes, estado, page]);

  useEffect(() => {
    if (selectedId) {
      fetchDetalle(selectedId);
    }
  }, [selectedId]);

  if (!canViewQuotes) {
    return (
      <TooltipProvider>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div
              className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.kpiNegative}15` }}
            >
              <FileText className="h-8 w-8" style={{ color: userColors.kpiNegative }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
            <p className="text-muted-foreground">No tenes permisos para ver cotizaciones.</p>
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
            <h1 className="text-2xl font-bold">Cotizaciones</h1>
            <p className="text-muted-foreground">Revisa y acepta cotizaciones pendientes</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    Por responder
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
                    Aceptadas
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.aceptadas}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    En proceso
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
                    Convertidas
                  </p>
                  <p className="text-2xl font-bold">
                    {estadisticas.convertidas}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A orden
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart1}15` }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: userColors.chart1 }} />
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
                    Cotizaciones
                  </p>
                </div>
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.chart2}15` }}
                >
                  <FileText className="h-5 w-5" style={{ color: userColors.chart2 }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={estado} onValueChange={(v) => { setEstado(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="ENVIADA">Enviada</SelectItem>
                  <SelectItem value="EN_NEGOCIACION">En Negociacion</SelectItem>
                  <SelectItem value="ACEPTADA">Aceptada</SelectItem>
                  <SelectItem value="CONVERTIDA">Convertida</SelectItem>
                  <SelectItem value="PERDIDA">Perdida</SelectItem>
                  <SelectItem value="VENCIDA">Vencida</SelectItem>
                </SelectContent>
              </Select>

              {estado !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => { setEstado('all'); setPage(1); }}>
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
              <FileText className="h-4 w-4" style={{ color: userColors.chart1 }} />
              Cotizaciones
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
                    <FileText className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Cargando cotizaciones...</p>
                </div>
              </div>
            ) : cotizaciones.length === 0 ? (
              <div className="text-center py-12">
                <div
                  className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${userColors.kpiNeutral}15` }}
                >
                  <FileText className="h-8 w-8" style={{ color: userColors.kpiNeutral }} />
                </div>
                <h3 className="text-lg font-medium mb-1">No hay cotizaciones</h3>
                <p className="text-muted-foreground text-sm">
                  {estado !== 'all' ? 'No hay cotizaciones con este estado' : 'Todavia no hay cotizaciones registradas'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Validez</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cotizaciones.map((cot) => (
                        <TableRow
                          key={cot.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedId(cot.id)}
                        >
                          <TableCell className="font-mono">{cot.numero}</TableCell>
                          <TableCell>
                            {format(new Date(cot.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {format(new Date(cot.fechaValidez), 'dd/MM/yyyy', { locale: es })}
                              {cot.vencida && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4" style={{ color: userColors.kpiNegative }} />
                                  </TooltipTrigger>
                                  <TooltipContent>Vencida</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={estadoLabels[cot.estado]?.variant || 'outline'}>
                              {estadoLabels[cot.estado]?.label || cot.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>{cot.cantidadItems}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-foreground">
                              {cot.moneda === 'USD' ? 'US$' : '$'}
                              {cot.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedId(cot.id); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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

        {/* Detail Dialog */}
        <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[85vh] overflow-y-auto">
            {loadingDetalle ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <FileText className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Cargando detalle...</p>
                </div>
              </div>
            ) : detalle ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Cotizacion {detalle.numero}
                    <Badge variant={estadoLabels[detalle.estado]?.variant || 'outline'}>
                      {estadoLabels[detalle.estado]?.label || detalle.estado}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Emitida el {format(new Date(detalle.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                    {' · '}
                    Valida hasta {format(new Date(detalle.fechaValidez), 'dd/MM/yyyy', { locale: es })}
                    {detalle.vencida && (
                      <span style={{ color: userColors.kpiNegative }}> (Vencida)</span>
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Items */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" style={{ color: userColors.chart1 }} />
                      Items
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalle.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product?.name || item.descripcion}</p>
                                {(item.product?.code || item.codigo) && (
                                  <p className="text-xs text-muted-foreground">{item.product?.code || item.codigo}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.cantidad} {item.unidad || item.product?.unit || ''}
                            </TableCell>
                            <TableCell className="text-right">
                              ${item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-1 text-sm">
                      <div className="flex justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                        <span>Subtotal:</span>
                        <span>${detalle.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {detalle.descuentoMonto > 0 && (
                        <div className="flex justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                          <span>Descuento{detalle.descuentoGlobal ? ` (${detalle.descuentoGlobal}%)` : ''}:</span>
                          <span style={{ color: userColors.kpiPositive }}>
                            -${detalle.descuentoMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {detalle.impuestos > 0 && (
                        <div className="flex justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                          <span>IVA{detalle.tasaIva ? ` (${detalle.tasaIva}%)` : ''}:</span>
                          <span>${detalle.impuestos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span className="text-foreground">
                          {detalle.moneda === 'USD' ? 'US$' : '$'}
                          {detalle.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conditions */}
                  {(detalle.condicionesPago || detalle.condicionesEntrega || detalle.tiempoEntrega || detalle.notas) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {detalle.condicionesPago && (
                        <Card>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-1 text-sm">Condiciones de Pago</h4>
                            <p className="text-sm text-muted-foreground">{detalle.condicionesPago}</p>
                          </CardContent>
                        </Card>
                      )}
                      {detalle.condicionesEntrega && (
                        <Card>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-1 text-sm">Condiciones de Entrega</h4>
                            <p className="text-sm text-muted-foreground">{detalle.condicionesEntrega}</p>
                          </CardContent>
                        </Card>
                      )}
                      {detalle.tiempoEntrega && (
                        <Card>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-1 text-sm">Tiempo de Entrega</h4>
                            <p className="text-sm text-muted-foreground">{detalle.tiempoEntrega}</p>
                          </CardContent>
                        </Card>
                      )}
                      {detalle.notas && (
                        <Card className="sm:col-span-2">
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-1 text-sm">Notas</h4>
                            <p className="text-sm text-muted-foreground">{detalle.notas}</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Seller */}
                  <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    Vendedor: <strong>{detalle.vendedor.name}</strong> ({detalle.vendedor.email})
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedId(null)}>
                    Cerrar
                  </Button>
                  {['ENVIADA', 'EN_NEGOCIACION'].includes(detalle.estado) && !detalle.vencida && canAcceptQuotes && (
                    <>
                      <Button
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => { setAcceptAction('reject'); setShowAcceptDialog(true); }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rechazar
                      </Button>
                      <Button
                        onClick={() => { setAcceptAction('accept'); setShowAcceptDialog(true); }}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Aceptar
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Accept/Reject Dialog */}
        <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {acceptAction === 'accept' ? 'Aceptar Cotizacion' : 'Rechazar Cotizacion'}
              </DialogTitle>
              <DialogDescription>
                {acceptAction === 'accept'
                  ? 'Al aceptar esta cotizacion, se procedera con la orden de compra.'
                  : 'Por favor indica el motivo del rechazo.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="comment">Comentarios (opcional)</Label>
                <Textarea
                  id="comment"
                  value={acceptComment}
                  onChange={(e) => setAcceptComment(e.target.value)}
                  placeholder={acceptAction === 'accept' ? 'Comentarios adicionales...' : 'Motivo del rechazo...'}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant={acceptAction === 'accept' ? 'default' : 'destructive'}
                onClick={handleAccept}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : acceptAction === 'accept' ? (
                  'Confirmar Aceptacion'
                ) : (
                  'Confirmar Rechazo'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
