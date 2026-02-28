'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  Send,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  MoreVertical,
  Eye,
  Clock,
  PackageX,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { DevolucionFormModal } from '@/components/compras/devolucion-form-modal';
import { DevolucionDetalleModal } from '@/components/compras/devolucion-detalle-modal';
import { NcaFromDevolucionModal } from '@/components/compras/nca-from-devolucion-modal';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useViewMode } from '@/contexts/ViewModeContext';

interface Devolucion {
  id: number;
  numero: string;
  proveedorId: number;
  proveedor: { id: number; name: string; cuit?: string };
  warehouse?: { id: number; codigo: string; nombre: string };
  goodsReceipt?: { id: number; numero: string };
  factura?: { id: number; numeroSerie: string; numeroFactura: string };
  estado: string;
  tipo: string;
  motivo: string;
  descripcion?: string;
  fechaSolicitud: string;
  fechaEnvio?: string;
  fechaResolucion?: string;
  stockMovementCreated: boolean;
  carrier?: string;
  trackingNumber?: string;
  docType?: string;
  items: any[];
  _count: {
    items: number;
    creditNotes: number;
    stockMovements: number;
  };
}

const estadoLabels: Record<string, string> = {
  BORRADOR: 'Borrador',
  SOLICITADA: 'Solicitada',
  APROBADA_PROVEEDOR: 'Aprobada',
  ENVIADA: 'Enviada',
  RECIBIDA_PROVEEDOR: 'Recibida',
  EN_EVALUACION: 'En Evaluación',
  RESUELTA: 'Resuelta',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};

const estadoColors: Record<string, string> = {
  BORRADOR: 'bg-muted text-foreground',
  SOLICITADA: 'bg-info-muted text-info-muted-foreground',
  APROBADA_PROVEEDOR: 'bg-accent-purple-muted text-accent-purple-muted-foreground',
  ENVIADA: 'bg-warning-muted text-warning-muted-foreground',
  RECIBIDA_PROVEEDOR: 'bg-accent-cyan-muted text-accent-cyan-muted-foreground',
  EN_EVALUACION: 'bg-warning-muted text-warning-muted-foreground',
  RESUELTA: 'bg-success-muted text-success',
  RECHAZADA: 'bg-destructive/10 text-destructive',
  CANCELADA: 'bg-muted text-muted-foreground',
};

const tipoLabels: Record<string, string> = {
  DEFECTO: 'Defecto',
  EXCESO: 'Exceso',
  ERROR_PEDIDO: 'Error Pedido',
  GARANTIA: 'Garantía',
  OTRO: 'Otro',
};

export default function DevolucionesPage() {
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const { mode: viewMode } = useViewMode();
  const { hasPermission } = useAuth();
  const canCreateDevolucion = hasPermission('compras.devoluciones.create');
  const canEditDevolucion = hasPermission('compras.devoluciones.edit');
  const canDeleteDevolucion = hasPermission('compras.devoluciones.delete');
  const canApproveDevolucion = hasPermission('compras.devoluciones.approve');
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState(searchParams.get('estado') || 'all');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState<Devolucion | null>(null);
  const [showNcaModal, setShowNcaModal] = useState<Devolucion | null>(null);
  const [devolucionAEliminar, setDevolucionAEliminar] = useState<Devolucion | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const fetchDevoluciones = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (estadoFilter !== 'all') {
        params.set('estado', estadoFilter);
      }
      if (searchTerm) {
        params.set('search', searchTerm);
      }

      const response = await fetch(`/api/compras/devoluciones?${params}`);
      if (!response.ok) throw new Error('Error al cargar devoluciones');
      const result = await response.json();
      setDevoluciones(result.data);
      setPagination(prev => ({
        ...prev,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages
      }));
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar devoluciones');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, estadoFilter, searchTerm, viewMode]);

  useEffect(() => {
    fetchDevoluciones();
  }, [fetchDevoluciones]);

  const handleSolicitar = async (devolucion: Devolucion) => {
    const ok = await confirm({
      title: 'Enviar solicitud',
      description: `¿Enviar solicitud ${devolucion.numero} al proveedor?`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/compras/devoluciones/${devolucion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'solicitar' })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al solicitar');
      }
      toast.success('Devolución solicitada');
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al solicitar');
    }
  };

  const handleAprobarProveedor = async (devolucion: Devolucion) => {
    const ok = await confirm({
      title: 'Aprobar devolución',
      description: `¿Marcar ${devolucion.numero} como aprobada por el proveedor?`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/compras/devoluciones/${devolucion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'aprobar_proveedor' })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al aprobar');
      }
      toast.success('Devolución aprobada por el proveedor');
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al aprobar');
    }
  };

  const handleEnviar = async (devolucion: Devolucion) => {
    const carrier = prompt('Transportista (opcional):');
    const trackingNumber = prompt('Número de seguimiento (opcional):');

    const okEnviar = await confirm({
      title: 'Confirmar envío',
      description: `¿Confirmar envío de ${devolucion.numero}? Esto descontará el stock.`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!okEnviar) return;

    try {
      toast.loading('Enviando devolución...', { id: 'enviar' });
      const response = await fetch(`/api/compras/devoluciones/${devolucion.id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: carrier || undefined,
          trackingNumber: trackingNumber || undefined,
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar');
      }

      toast.success(result.message, { id: 'enviar' });
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al enviar', { id: 'enviar' });
    }
  };

  const handleConfirmarRecepcion = async (devolucion: Devolucion) => {
    const ok = await confirm({
      title: 'Confirmar recepción',
      description: `¿Confirmar que el proveedor recibió ${devolucion.numero}?`,
      confirmText: 'Confirmar',
      variant: 'default',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/compras/devoluciones/${devolucion.id}/confirmar-recepcion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: 'Confirmado desde UI' })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al confirmar');
      }

      toast.success(result.message);
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al confirmar');
    }
  };

  const handleCancelar = async (devolucion: Devolucion) => {
    const motivo = prompt('Motivo de cancelación:');
    if (!motivo) {
      toast.error('Debe proporcionar un motivo');
      return;
    }

    const okCancelar = await confirm({
      title: 'Cancelar devolución',
      description: `¿Cancelar ${devolucion.numero}? ${devolucion.stockMovementCreated ? 'El stock será reingresado.' : ''}`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!okCancelar) return;

    try {
      toast.loading('Cancelando devolución...', { id: 'cancelar' });
      const response = await fetch(`/api/compras/devoluciones/${devolucion.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al cancelar');
      }

      toast.success(result.message, { id: 'cancelar' });
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al cancelar', { id: 'cancelar' });
    }
  };

  const handleRechazar = async (devolucion: Devolucion) => {
    const motivo = prompt('Motivo del rechazo:');
    if (!motivo) {
      toast.error('Debe proporcionar un motivo');
      return;
    }

    try {
      const response = await fetch(`/api/compras/devoluciones/${devolucion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'rechazar', motivo })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al rechazar');
      }

      toast.success('Devolución rechazada');
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al rechazar');
    }
  };

  const abrirEliminarDevolucion = (devolucion: Devolucion) => {
    setDevolucionAEliminar(devolucion);
    setIsDeleteOpen(true);
  };

  const confirmarEliminarDevolucion = async () => {
    if (!devolucionAEliminar) return;
    setDeleteLoading(true);

    try {
      toast.loading('Eliminando...', { id: 'delete-devolucion' });
      const response = await fetch(`/api/compras/devoluciones/${devolucionAEliminar.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar');
      }

      // Show appropriate message based on cascade deletion
      if (data.ncsEliminadas && data.ncsEliminadas.length > 0) {
        toast.success(`Devolución y ${data.ncsEliminadas.length} NC eliminadas correctamente`, { id: 'delete-devolucion' });
      } else {
        toast.success('Devolución eliminada correctamente', { id: 'delete-devolucion' });
      }
      fetchDevoluciones();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar', { id: 'delete-devolucion' });
    } finally {
      setDeleteLoading(false);
      setIsDeleteOpen(false);
      setDevolucionAEliminar(null);
    }
  };

  const getAccionesDisponibles = (devolucion: Devolucion) => {
    const acciones: JSX.Element[] = [];

    // Ver detalle siempre
    acciones.push(
      <DropdownMenuItem key="ver" onClick={() => setShowDetalleModal(devolucion)}>
        <Eye className="h-4 w-4 mr-2" />
        Ver detalle
      </DropdownMenuItem>
    );

    switch (devolucion.estado) {
      case 'BORRADOR':
        if (canEditDevolucion) {
          acciones.push(
            <DropdownMenuItem key="solicitar" onClick={() => handleSolicitar(devolucion)}>
              <Send className="h-4 w-4 mr-2" />
              Enviar solicitud
            </DropdownMenuItem>
          );
        }
        if (canDeleteDevolucion) {
          acciones.push(
            <DropdownMenuItem key="delete" onClick={() => abrirEliminarDevolucion(devolucion)} className="text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          );
        }
        break;

      case 'SOLICITADA':
        if (canApproveDevolucion) {
          acciones.push(
            <DropdownMenuItem key="aprobar" onClick={() => handleAprobarProveedor(devolucion)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar aprobada (proveedor)
            </DropdownMenuItem>
          );
          acciones.push(
            <DropdownMenuItem key="rechazar" onClick={() => handleRechazar(devolucion)} className="text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Marcar rechazada
            </DropdownMenuItem>
          );
        }
        break;

      case 'APROBADA_PROVEEDOR':
        if (canEditDevolucion) {
          acciones.push(
            <DropdownMenuItem key="enviar" onClick={() => handleEnviar(devolucion)}>
              <Truck className="h-4 w-4 mr-2" />
              Enviar mercadería
            </DropdownMenuItem>
          );
        }
        if (canEditDevolucion) {
          acciones.push(
            <DropdownMenuSeparator key="sep1" />
          );
          acciones.push(
            <DropdownMenuItem key="cancelar" onClick={() => handleCancelar(devolucion)} className="text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </DropdownMenuItem>
          );
        }
        break;

      case 'ENVIADA':
        // Cargar NCA si no tiene una asociada
        if (devolucion._count.creditNotes === 0 && canEditDevolucion) {
          acciones.push(
            <DropdownMenuItem key="nca" onClick={() => setShowNcaModal(devolucion)} className="text-success">
              <FileText className="h-4 w-4 mr-2" />
              Cargar NCA
            </DropdownMenuItem>
          );
        }
        if (canEditDevolucion) {
          acciones.push(
            <DropdownMenuSeparator key="sep2" />
          );
          acciones.push(
            <DropdownMenuItem key="cancelar" onClick={() => handleCancelar(devolucion)} className="text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar (revertir stock)
            </DropdownMenuItem>
          );
        }
        break;

      case 'RECIBIDA_PROVEEDOR':
        // Cargar NCA si no tiene una asociada
        if (devolucion._count.creditNotes === 0 && canEditDevolucion) {
          acciones.push(
            <DropdownMenuItem key="nca" onClick={() => setShowNcaModal(devolucion)} className="text-success">
              <FileText className="h-4 w-4 mr-2" />
              Cargar NCA
            </DropdownMenuItem>
          );
        }
        if (canEditDevolucion) {
          acciones.push(
            <DropdownMenuSeparator key="sep3" />
          );
          acciones.push(
            <DropdownMenuItem key="cancelar" onClick={() => handleCancelar(devolucion)} className="text-destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar (revertir stock)
            </DropdownMenuItem>
          );
        }
        break;
    }

    return acciones;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Devoluciones</h1>
          <p className="text-muted-foreground">
            Gestión de devoluciones de mercadería a proveedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDevoluciones} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {canCreateDevolucion && (
            <Button onClick={() => setShowFormModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Devolución
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-info-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Pendientes envío</p>
                <p className="text-xl font-bold">
                  {devoluciones.filter(d => d.estado === 'APROBADA_PROVEEDOR').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-warning-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">En tránsito</p>
                <p className="text-xl font-bold">
                  {devoluciones.filter(d => d.estado === 'ENVIADA').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Sin NCA</p>
                <p className="text-xl font-bold">
                  {devoluciones.filter(d =>
                    ['ENVIADA', 'RECIBIDA_PROVEEDOR'].includes(d.estado) &&
                    d._count.creditNotes === 0
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Resueltas</p>
                <p className="text-xl font-bold">
                  {devoluciones.filter(d => d.estado === 'RESUELTA').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PackageX className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{pagination.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(estadoLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>NCA</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : devoluciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No hay devoluciones
                  </TableCell>
                </TableRow>
              ) : (
                devoluciones.map((devolucion) => (
                  <TableRow key={devolucion.id}>
                    <TableCell className="font-mono font-medium">{devolucion.numero}</TableCell>
                    <TableCell>{devolucion.proveedor?.name}</TableCell>
                    <TableCell>
                      {devolucion.factura ? (
                        <span className="text-sm font-mono">
                          {devolucion.factura.numeroSerie}-{devolucion.factura.numeroFactura}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tipoLabels[devolucion.tipo] || devolucion.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={estadoColors[devolucion.estado]}>
                        {estadoLabels[devolucion.estado] || devolucion.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{devolucion._count.items}</TableCell>
                    <TableCell>
                      {devolucion.warehouse ? (
                        <span className="text-sm">{devolucion.warehouse.codigo}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(devolucion.fechaSolicitud), 'dd/MM/yy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {devolucion._count.creditNotes > 0 ? (
                        <Badge variant="secondary" className="bg-success-muted text-success">
                          <FileText className="h-3 w-3 mr-1" />
                          {devolucion._count.creditNotes}
                        </Badge>
                      ) : ['CANCELADA', 'RECHAZADA'].includes(devolucion.estado) ? (
                        <span className="text-muted-foreground">-</span>
                      ) : devolucion.stockMovementCreated ? (
                        <Badge variant="outline" className="text-warning-muted-foreground border-warning-muted">
                          Pendiente
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {getAccionesDisponibles(devolucion)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {devoluciones.length} de {pagination.total} devoluciones
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showFormModal && (
        <DevolucionFormModal
          open={showFormModal}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            fetchDevoluciones();
          }}
        />
      )}
      {showDetalleModal && (
        <DevolucionDetalleModal
          devolucion={showDetalleModal}
          open={!!showDetalleModal}
          onClose={() => setShowDetalleModal(null)}
          onUpdate={fetchDevoluciones}
        />
      )}
      {showNcaModal && (
        <NcaFromDevolucionModal
          devolucion={showNcaModal}
          open={!!showNcaModal}
          onClose={() => setShowNcaModal(null)}
          onSuccess={() => {
            setShowNcaModal(null);
            fetchDevoluciones();
          }}
        />
      )}

      {/* Modal confirmar eliminar devolución */}
      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Eliminar Devolución"
        description={
          devolucionAEliminar && devolucionAEliminar._count?.creditNotes > 0
            ? `¿Estás seguro de que querés eliminar la devolución ${devolucionAEliminar.numero}?\n\n⚠️ Esta devolución tiene ${devolucionAEliminar._count.creditNotes} NC vinculada(s). Al eliminar la devolución también se eliminarán las NC asociadas.\n\nEsta acción no se puede deshacer.`
            : `¿Estás seguro de que querés eliminar la devolución ${devolucionAEliminar?.numero}? Esta acción no se puede deshacer.`
        }
        onConfirm={confirmarEliminarDevolucion}
        loading={deleteLoading}
      />
    </div>
  );
}
