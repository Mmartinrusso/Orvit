'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  MoreVertical,
  FileText,
  Send,
  Copy,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  User,
  Building,
  Calendar,
  Clock,
  DollarSign,
  Package,
  FileCheck,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface CotizacionDetailSheetProps {
  quoteId: number;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface Quote {
  id: number;
  numero: string;
  estado: string;
  titulo?: string;
  descripcion?: string;
  fechaEmision: string;
  fechaValidez: string;
  fechaEnvio?: string;
  fechaCierre?: string;
  aprobadoAt?: string;
  convertidaAt?: string;
  subtotal: number;
  descuentoGlobal: number;
  descuentoMonto: number;
  tasaIva: number;
  impuestos: number;
  total: number;
  moneda: string;
  condicionesPago?: string;
  diasPlazo?: number;
  condicionesEntrega?: string;
  tiempoEntrega?: string;
  lugarEntrega?: string;
  notas?: string;
  notasInternas?: string;
  motivoPerdida?: string;
  client: {
    id: string;
    legalName?: string;
    name?: string;
    cuit?: string;
    email?: string;
    phone?: string;
  };
  seller?: {
    id: number;
    name: string;
    email?: string;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
  aprobadoByUser?: {
    id: number;
    name: string;
  };
  items: Array<{
    id: number;
    codigo?: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
    notas?: string;
    product?: {
      id: string;
      name: string;
      sku?: string;
    };
  }>;
  versions?: Array<{
    id: number;
    version: number;
    datos: any;
    motivo?: string;
    createdAt: string;
    createdByUser?: {
      name: string;
    };
  }>;
  _count?: {
    items: number;
    versions: number;
  };
}

const estadoConfig: Record<string, { label: string; color: string; icon: any }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  ENVIADA: { label: 'Enviada', color: 'bg-blue-100 text-blue-700', icon: Send },
  EN_NEGOCIACION: { label: 'En Negociación', color: 'bg-amber-100 text-amber-700', icon: Clock },
  ACEPTADA: { label: 'Aceptada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CONVERTIDA: { label: 'Convertida', color: 'bg-indigo-100 text-indigo-700', icon: ArrowRightCircle },
  PERDIDA: { label: 'Perdida', color: 'bg-red-100 text-red-700', icon: XCircle },
  VENCIDA: { label: 'Vencida', color: 'bg-gray-100 text-gray-500', icon: AlertTriangle },
};

function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

export function CotizacionDetailSheet({ quoteId, open, onClose, onUpdate }: CotizacionDetailSheetProps) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: '', description: '', action: () => {} });

  useEffect(() => {
    if (open && quoteId) {
      fetchQuote();
    }
  }, [open, quoteId]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/cotizaciones/${quoteId}`);
      if (!response.ok) throw new Error('Error al cargar cotización');
      const data = await response.json();
      setQuote(data);
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('Error al cargar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!quote) return;

    switch (action) {
      case 'pdf':
        window.open(`/api/ventas/cotizaciones/${quote.id}/pdf`, '_blank');
        break;

      case 'duplicar':
        setConfirmDialog({
          open: true,
          title: 'Duplicar cotización',
          description: `¿Desea crear una copia de la cotización ${quote.numero}? Se creará una nueva cotización en estado Borrador con los mismos items y condiciones.`,
          action: async () => {
            setActionLoading(true);
            try {
              const response = await fetch(`/api/ventas/cotizaciones/${quote.id}/duplicar`, {
                method: 'POST'
              });
              if (!response.ok) throw new Error('Error al duplicar');
              const data = await response.json();
              toast.success(`Cotización duplicada: ${data.cotizacion.numero}`);
              onUpdate?.();
              router.push(`/administracion/ventas/cotizaciones/${data.cotizacion.id}`);
            } catch (error) {
              toast.error('Error al duplicar la cotización');
            } finally {
              setActionLoading(false);
            }
          }
        });
        break;

      case 'enviar':
        setConfirmDialog({
          open: true,
          title: 'Enviar cotización',
          description: `¿Desea enviar la cotización ${quote.numero} al cliente? El estado cambiará a "Enviada".`,
          action: async () => {
            setActionLoading(true);
            try {
              const response = await fetch(`/api/ventas/cotizaciones/${quote.id}/enviar`, {
                method: 'POST'
              });
              if (!response.ok) throw new Error('Error al enviar');
              toast.success('Cotización enviada');
              fetchQuote();
              onUpdate?.();
            } catch (error) {
              toast.error('Error al enviar la cotización');
            } finally {
              setActionLoading(false);
            }
          }
        });
        break;

      case 'eliminar':
        setConfirmDialog({
          open: true,
          title: 'Eliminar cotización',
          description: `¿Está seguro de eliminar la cotización ${quote.numero}? Esta acción no se puede deshacer.`,
          action: async () => {
            setActionLoading(true);
            try {
              const response = await fetch(`/api/ventas/cotizaciones/${quote.id}`, {
                method: 'DELETE'
              });
              if (!response.ok) throw new Error('Error al eliminar');
              toast.success('Cotización eliminada');
              onUpdate?.();
              onClose();
            } catch (error) {
              toast.error('Error al eliminar la cotización');
            } finally {
              setActionLoading(false);
            }
          }
        });
        break;
    }
  };

  // Generar timeline derivado de timestamps
  const getTimeline = () => {
    if (!quote) return [];

    const timeline: Array<{
      evento: string;
      fecha: string;
      actor?: string;
      descripcion?: string;
      completado: boolean;
    }> = [];

    // Creación
    timeline.push({
      evento: 'Creada',
      fecha: quote.fechaEmision,
      actor: quote.createdByUser?.name,
      completado: true
    });

    // Enviada
    if (quote.fechaEnvio) {
      timeline.push({
        evento: 'Enviada',
        fecha: quote.fechaEnvio,
        completado: true
      });
    } else if (['BORRADOR'].includes(quote.estado)) {
      timeline.push({
        evento: 'Enviar al cliente',
        fecha: '',
        completado: false
      });
    }

    // Aceptada
    if (quote.aprobadoAt) {
      timeline.push({
        evento: 'Aceptada',
        fecha: quote.aprobadoAt,
        actor: quote.aprobadoByUser?.name,
        completado: true
      });
    }

    // Convertida
    if (quote.convertidaAt) {
      timeline.push({
        evento: 'Convertida a Venta',
        fecha: quote.convertidaAt,
        completado: true
      });
    }

    // Cerrada/Perdida
    if (quote.fechaCierre && quote.estado === 'PERDIDA') {
      timeline.push({
        evento: 'Perdida',
        fecha: quote.fechaCierre,
        descripcion: quote.motivoPerdida,
        completado: true
      });
    }

    return timeline;
  };

  // Calcular días hasta vencimiento
  const getDiasVencimiento = () => {
    if (!quote) return null;
    const dias = differenceInDays(new Date(quote.fechaValidez), new Date());
    return dias;
  };

  const canEdit = quote?.estado === 'BORRADOR' || quote?.estado === 'EN_NEGOCIACION';
  const canDelete = quote?.estado === 'BORRADOR';
  const canSend = quote?.estado === 'BORRADOR';
  const canConvert = quote?.estado === 'ENVIADA' || quote?.estado === 'ACEPTADA';
  const diasVencimiento = getDiasVencimiento();

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={() => onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!quote) {
    return (
      <Sheet open={open} onOpenChange={() => onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-4xl">
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Cotización no encontrada</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const estadoInfo = estadoConfig[quote.estado] || estadoConfig.BORRADOR;
  const EstadoIcon = estadoInfo.icon;

  return (
    <>
      <Sheet open={open} onOpenChange={() => onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{quote.numero}</h2>
                    <Badge className={estadoInfo.color}>
                      <EstadoIcon className="w-3 h-3 mr-1" />
                      {estadoInfo.label}
                    </Badge>
                  </div>
                  {quote.titulo && (
                    <p className="text-sm text-muted-foreground">{quote.titulo}</p>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAction('pdf')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Ver PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('duplicar')}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                  {canSend && (
                    <DropdownMenuItem onClick={() => handleAction('enviar')}>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={() => handleAction('eliminar')}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats Bar */}
            <div className="px-4 pb-4 grid grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="font-semibold">{formatCurrency(Number(quote.total), quote.moneda)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Items</p>
                  <p className="font-semibold">{quote.items.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Validez</p>
                  <p className="font-semibold">{format(new Date(quote.fechaValidez), 'dd/MM/yy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {diasVencimiento !== null && (
                  <Badge variant={diasVencimiento < 0 ? 'destructive' : diasVencimiento <= 7 ? 'secondary' : 'outline'}>
                    {diasVencimiento < 0 ? 'Vencida' : diasVencimiento === 0 ? 'Vence hoy' : `${diasVencimiento}d`}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col lg:flex-row">
            {/* Main Content */}
            <div className="flex-1 p-4">
              <Tabs defaultValue="items">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="items">Items</TabsTrigger>
                  <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
                  <TabsTrigger value="versiones">Versiones</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-4">
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Código</th>
                          <th className="px-3 py-2 text-left font-medium">Descripción</th>
                          <th className="px-3 py-2 text-right font-medium">Cant.</th>
                          <th className="px-3 py-2 text-right font-medium">P.Unit.</th>
                          <th className="px-3 py-2 text-right font-medium">Dto.</th>
                          <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items.map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {item.codigo || '-'}
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium">{item.descripcion}</p>
                              {item.notas && (
                                <p className="text-xs text-muted-foreground">{item.notas}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {Number(item.cantidad).toLocaleString('es-AR')} {item.unidad}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatCurrency(Number(item.precioUnitario), quote.moneda)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {Number(item.descuento) > 0 ? `${Number(item.descuento)}%` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(Number(item.subtotal), quote.moneda)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totales */}
                  <div className="mt-4 flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(Number(quote.subtotal), quote.moneda)}</span>
                      </div>
                      {Number(quote.descuentoGlobal) > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Descuento ({Number(quote.descuentoGlobal)}%):</span>
                          <span>-{formatCurrency(Number(quote.descuentoMonto), quote.moneda)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span>IVA ({Number(quote.tasaIva)}%):</span>
                        <span>{formatCurrency(Number(quote.impuestos), quote.moneda)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(Number(quote.total), quote.moneda)}</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="condiciones" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {quote.condicionesPago && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Condiciones de Pago</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p>{quote.condicionesPago}</p>
                          {quote.diasPlazo && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Plazo: {quote.diasPlazo} días
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                    {quote.condicionesEntrega && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Condiciones de Entrega</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p>{quote.condicionesEntrega}</p>
                        </CardContent>
                      </Card>
                    )}
                    {quote.tiempoEntrega && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Tiempo de Entrega</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p>{quote.tiempoEntrega}</p>
                        </CardContent>
                      </Card>
                    )}
                    {quote.lugarEntrega && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Lugar de Entrega</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p>{quote.lugarEntrega}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {quote.notas && (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-amber-800">Notas Públicas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-amber-900 whitespace-pre-wrap">{quote.notas}</p>
                      </CardContent>
                    </Card>
                  )}

                  {quote.notasInternas && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800">Notas Internas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-blue-900 whitespace-pre-wrap">{quote.notasInternas}</p>
                      </CardContent>
                    </Card>
                  )}

                  {!quote.condicionesPago && !quote.condicionesEntrega && !quote.notas && (
                    <p className="text-center text-muted-foreground py-8">
                      No hay condiciones definidas para esta cotización
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="versiones" className="mt-4">
                  {quote.versions && quote.versions.length > 0 ? (
                    <div className="space-y-3">
                      {quote.versions.map((version) => (
                        <Card key={version.id}>
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">v{version.version}</Badge>
                                <div>
                                  <p className="font-medium">{version.motivo || 'Sin descripción'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(version.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                    {version.createdByUser && ` por ${version.createdByUser.name}`}
                                  </p>
                                </div>
                              </div>
                              {version.datos && (
                                <div className="text-right text-sm">
                                  {version.datos.total && (
                                    <p>Total: {formatCurrency(version.datos.total, quote.moneda)}</p>
                                  )}
                                  {version.datos.itemsCount !== undefined && (
                                    <p className="text-muted-foreground">{version.datos.itemsCount} items</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No hay versiones registradas
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="lg:w-80 border-t lg:border-t-0 lg:border-l p-4 space-y-4">
              {/* Cliente */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="font-semibold">{quote.client.legalName || quote.client.name}</p>
                  {quote.client.cuit && (
                    <p className="text-sm text-muted-foreground">CUIT: {quote.client.cuit}</p>
                  )}
                  {quote.client.email && (
                    <p className="text-sm text-muted-foreground">{quote.client.email}</p>
                  )}
                  {quote.client.phone && (
                    <p className="text-sm text-muted-foreground">{quote.client.phone}</p>
                  )}
                </CardContent>
              </Card>

              {/* Vendedor */}
              {quote.seller && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Vendedor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="font-semibold">{quote.seller.name}</p>
                    {quote.seller.email && (
                      <p className="text-sm text-muted-foreground">{quote.seller.email}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getTimeline().map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className={`w-2 h-2 mt-2 rounded-full ${item.completado ? 'bg-primary' : 'bg-muted'}`} />
                        <div className="flex-1">
                          <p className={`font-medium ${!item.completado ? 'text-muted-foreground' : ''}`}>
                            {item.evento}
                          </p>
                          {item.fecha && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                            </p>
                          )}
                          {item.actor && (
                            <p className="text-xs text-muted-foreground">por {item.actor}</p>
                          )}
                          {item.descripcion && (
                            <p className="text-xs text-muted-foreground mt-1">{item.descripcion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Acciones Rápidas */}
              <div className="space-y-2">
                {canEdit && (
                  <Button variant="outline" className="w-full" onClick={() => router.push(`/administracion/ventas/cotizaciones?edit=${quote.id}`)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                )}
                {canSend && (
                  <Button className="w-full" onClick={() => handleAction('enviar')}>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar al Cliente
                  </Button>
                )}
                {canConvert && (
                  <Button variant="secondary" className="w-full">
                    <ArrowRightCircle className="w-4 h-4 mr-2" />
                    Convertir a Venta
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmDialog.action(); setConfirmDialog({ ...confirmDialog, open: false }); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
