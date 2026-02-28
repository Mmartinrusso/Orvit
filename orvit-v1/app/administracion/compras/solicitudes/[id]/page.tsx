'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  User,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  History,
  MoreHorizontal,
  Mail,
  Phone,
  Hash,
  CreditCard
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface Comprobante {
  id: number;
  receiptId: number;
  montoSolicitado: number;
  receipt: {
    id: number;
    tipo: string;
    numeroSerie: string;
    numeroFactura: string;
    total: number;
    estado: string;
    fechaEmision: string | null;
    fechaVencimiento: string | null;
  } | null;
}

interface HistorialItem {
  id: number;
  accion: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  prioridadAnterior: string | null;
  prioridadNueva: string | null;
  detalles: any;
  usuario: string;
  fecha: string;
}

interface Solicitud {
  id: number;
  numero: string;
  estado: string;
  estadoRaw: string;
  prioridad: string;
  prioridadRaw: string;
  esUrgente: boolean;
  fechaSolicitud: string;
  fechaObjetivo: string | null;
  fechaAprobacion: string | null;
  fechaPago: string | null;
  montoTotal: number;
  motivo: string | null;
  comentarios: string | null;
  motivoRechazo: string | null;
  proveedor: {
    id: number;
    nombre: string;
    razonSocial: string | null;
    cuit: string | null;
    email: string | null;
    telefono: string | null;
  };
  solicitante: {
    id: number;
    nombre: string;
    email: string;
  };
  aprobadoPor: {
    id: number;
    nombre: string;
  } | null;
  rechazadoPor: {
    id: number;
    nombre: string;
  } | null;
  comprobantes: Comprobante[];
  historial: HistorialItem[];
  createdAt: string;
  updatedAt: string;
  disponibleParaPagar: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}

const getEstadoBadge = (estado: string) => {
  const estados: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    borrador: { color: 'bg-muted text-foreground border-border', label: 'Borrador', icon: <FileText className="w-3 h-3" /> },
    pendiente: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'Pendiente', icon: <Clock className="w-3 h-3" /> },
    en_revision: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'En Revisión', icon: <AlertTriangle className="w-3 h-3" /> },
    aprobada: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Pendiente de Pago', icon: <CreditCard className="w-3 h-3" /> },
    rechazada: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Rechazada', icon: <XCircle className="w-3 h-3" /> },
    convertida: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Convertida', icon: <DollarSign className="w-3 h-3" /> },
    pagada: { color: 'bg-success-muted text-success-muted-foreground border-success-muted', label: 'Pagada', icon: <CheckCircle className="w-3 h-3" /> },
    cancelada: { color: 'bg-muted text-foreground border-border', label: 'Cancelada', icon: <XCircle className="w-3 h-3" /> }
  };
  return estados[estado] || estados.pendiente;
};

const getPrioridadBadge = (prioridad: string) => {
  const prioridades: Record<string, { color: string; label: string }> = {
    baja: { color: 'bg-muted text-muted-foreground border-border', label: 'Baja' },
    media: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Media' },
    alta: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'Alta' },
    urgente: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Urgente' }
  };
  return prioridades[prioridad] || prioridades.media;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return format(new Date(dateStr), 'dd/MM/yyyy', { locale: es });
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return format(new Date(dateStr), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
};

export default function SolicitudDetallePage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();

  // Permission checks
  const canEditSolicitud = hasPermission('compras.solicitudes.edit');
  const canDeleteSolicitud = hasPermission('compras.solicitudes.delete');
  const canApproveSolicitud = hasPermission('compras.solicitudes.approve');
  const canRejectSolicitud = hasPermission('compras.solicitudes.reject');

  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const solicitudId = params.id as string;

  useEffect(() => {
    if (solicitudId) {
      loadSolicitud();
    }
  }, [solicitudId]);

  const loadSolicitud = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/compras/solicitudes/${solicitudId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Solicitud no encontrada');
          router.push('/administracion/compras/solicitudes');
          return;
        }
        throw new Error('Error al cargar solicitud');
      }
      const data = await response.json();
      setSolicitud(data.solicitud);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!solicitud) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/compras/solicitudes/${solicitud.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Solicitud eliminada exitosamente');
      router.push('/administracion/compras/solicitudes');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const handleAprobar = async () => {
    if (!solicitud) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/compras/solicitudes/${solicitud.id}/aprobar`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al aprobar');
      }

      toast.success('Solicitud aprobada exitosamente');
      loadSolicitud();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRechazar = async () => {
    if (!solicitud || !motivoRechazo.trim()) {
      toast.error('Debe ingresar un motivo de rechazo');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/compras/solicitudes/${solicitud.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoRechazo })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al rechazar');
      }

      toast.success('Solicitud rechazada');
      setShowRejectDialog(false);
      setMotivoRechazo('');
      loadSolicitud();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full p-6 overflow-y-auto" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="w-full p-6 text-center">
        <p className="text-muted-foreground">Solicitud no encontrada</p>
        <Button variant="outline" onClick={() => router.push('/administracion/compras/solicitudes')} className="mt-4">
          Volver al listado
        </Button>
      </div>
    );
  }

  const estadoInfo = getEstadoBadge(solicitud.estado);
  const prioridadInfo = getPrioridadBadge(solicitud.prioridad);

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/administracion/compras/solicitudes')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{solicitud.numero}</h1>
            <Badge className={`${estadoInfo.color} border text-xs px-2 py-0.5 flex items-center gap-1`}>
              {estadoInfo.icon}
              {estadoInfo.label}
            </Badge>
            <Badge className={`${prioridadInfo.color} border text-xs px-2 py-0.5`}>
              {prioridadInfo.label}
            </Badge>
            {solicitud.esUrgente && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                URGENTE
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditSolicitud && solicitud.puedeEditar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/administracion/compras/solicitudes/${solicitud.id}/editar`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {solicitud.estado === 'pendiente' && (canApproveSolicitud || canRejectSolicitud) && (
                <>
                  {canApproveSolicitud && (
                    <DropdownMenuItem
                      onClick={handleAprobar}
                      className="text-success focus:text-success"
                      disabled={actionLoading}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Aprobar
                    </DropdownMenuItem>
                  )}
                  {canRejectSolicitud && (
                    <DropdownMenuItem
                      onClick={() => setShowRejectDialog(true)}
                      className="text-destructive focus:text-destructive"
                      disabled={actionLoading}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Rechazar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {canDeleteSolicitud && solicitud.puedeEliminar && (
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                  disabled={actionLoading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Proveedor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Proveedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">{solicitud.proveedor.nombre}</p>
                    {solicitud.proveedor.razonSocial && solicitud.proveedor.razonSocial !== solicitud.proveedor.nombre && (
                      <p className="text-xs text-muted-foreground">{solicitud.proveedor.razonSocial}</p>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {solicitud.proveedor.cuit && (
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3 h-3" />
                        CUIT: {solicitud.proveedor.cuit}
                      </div>
                    )}
                    {solicitud.proveedor.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        {solicitud.proveedor.email}
                      </div>
                    )}
                    {solicitud.proveedor.telefono && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        {solicitud.proveedor.telefono}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comprobantes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Comprobantes Incluidos ({solicitud.comprobantes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-medium">Tipo</TableHead>
                      <TableHead className="text-xs font-medium">Número</TableHead>
                      <TableHead className="text-xs font-medium">Emisión</TableHead>
                      <TableHead className="text-xs font-medium">Vencimiento</TableHead>
                      <TableHead className="text-xs font-medium text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitud.comprobantes.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-xs px-1.5">
                            {comp.receipt?.tipo || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {comp.receipt ? `${comp.receipt.numeroSerie}-${comp.receipt.numeroFactura}` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(comp.receipt?.fechaEmision || null)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(comp.receipt?.fechaVencimiento || null)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-right">
                          {formatCurrency(comp.montoSolicitado)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {solicitud.comprobantes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                          No hay comprobantes asociados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {solicitud.comprobantes.length > 0 && (
                  <div className="flex justify-end px-4 py-3 border-t bg-muted/20">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-semibold ml-2">{formatCurrency(solicitud.montoTotal)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Observaciones */}
            {solicitud.motivo && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Observaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{solicitud.motivo}</p>
                </CardContent>
              </Card>
            )}

            {/* Motivo de rechazo */}
            {solicitud.motivoRechazo && (
              <Card className="border-destructive/30 bg-destructive/10/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Motivo de Rechazo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-destructive">{solicitud.motivoRechazo}</p>
                  {solicitud.rechazadoPor && (
                    <p className="text-xs text-destructive mt-2">
                      Rechazado por: {solicitud.rechazadoPor.nombre}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Columna lateral */}
          <div className="space-y-6">
            {/* Información */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    Solicitante
                  </span>
                  <span className="text-xs font-medium">{solicitud.solicitante.nombre}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    Fecha Solicitud
                  </span>
                  <span className="text-xs font-medium">{formatDate(solicitud.fechaSolicitud)}</span>
                </div>
                {solicitud.fechaObjetivo && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        Fecha Objetivo
                      </span>
                      <span className="text-xs font-medium">{formatDate(solicitud.fechaObjetivo)}</span>
                    </div>
                  </>
                )}
                {solicitud.fechaAprobacion && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3" />
                        Aprobación
                      </span>
                      <span className="text-xs font-medium">{formatDate(solicitud.fechaAprobacion)}</span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" />
                    Monto Total
                  </span>
                  <span className="text-sm font-semibold">{formatCurrency(solicitud.montoTotal)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Historial */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Historial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {solicitud.historial.slice(0, 10).map((item) => (
                    <div key={item.id} className="flex gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.accion}</p>
                        <p className="text-muted-foreground truncate">
                          {item.usuario} - {formatDateTime(item.fecha)}
                        </p>
                        {item.estadoAnterior && item.estadoNuevo && item.estadoAnterior !== item.estadoNuevo && (
                          <p className="text-muted-foreground">
                            Estado: {item.estadoAnterior} → {item.estadoNuevo}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {solicitud.historial.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sin historial de cambios
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog de confirmación de eliminación */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Solicitud</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea eliminar la solicitud {solicitud.numero}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
            <DialogDescription>
              Ingrese el motivo del rechazo para la solicitud {solicitud.numero}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo del rechazo..."
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRechazar}
              disabled={actionLoading || !motivoRechazo.trim()}
            >
              {actionLoading ? 'Rechazando...' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
