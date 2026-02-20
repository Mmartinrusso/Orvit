'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileCheck,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  CreditCard,
  MoreHorizontal,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SolicitudPagoModal } from '@/components/compras/SolicitudPagoModal';
import { SolicitudDetalleModal } from '@/components/compras/SolicitudDetalleModal';
import { RegistrarPagoModal } from '@/components/compras/RegistrarPagoModal';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface SolicitudPago {
  id: string;
  numero: string;
  proveedor: string;
  proveedorId?: number | string | null;
  solicitante: string;
  departamento: string;
  fecha: Date;
  fechaRequerida: Date;
  estado: 'borrador' | 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'convertida' | 'pagada' | 'cancelada';
  monto: number;
  items: number;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  esUrgente?: boolean;
  docType?: 'T1' | 'T2' | 'MIXED';  // T1, T2, o MIXED (solo visible en Extended mode)
  facturas?: Array<{
    id: number | string;
    numeroSerie?: string;
    numeroFactura?: string;
    total?: number;
    docType?: string;
  }>;
}

export default function SolicitudesPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const { currentCompany } = useCompany();
  const { mode: viewMode } = useViewMode();
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('activas');
  const [prioridadFilter, setPrioridadFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [selectedSolicitudId, setSelectedSolicitudId] = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudPago[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Estado para modal de pago
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagoModalData, setPagoModalData] = useState<{
    proveedorId: number;
    proveedorNombre: string;
    invoiceIds: number[];
  } | null>(null);

  // Cargar solicitudes cuando cambia la compañía O el viewMode
  // Esto permite que al activar/desactivar el juego de tecla, se recarguen los datos
  useEffect(() => {
    if (currentCompany?.id) {
      loadSolicitudes();
    }
  }, [currentCompany?.id, viewMode]);

  const loadSolicitudes = async () => {
    if (!currentCompany?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/compras/solicitudes?companyId=${currentCompany.id}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (response.ok) {
        const data = await response.json();
        setSolicitudes(data.solicitudes || []);
      } else {
        toast.error('Error al cargar solicitudes');
      }
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      toast.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const filteredSolicitudes = solicitudes.filter(solicitud => {
    const matchesSearch =
      solicitud.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      solicitud.solicitante.toLowerCase().includes(searchTerm.toLowerCase()) ||
      solicitud.departamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      solicitud.proveedor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = estadoFilter === 'all'
      || estadoFilter === 'activas' && !['aprobada', 'pagada', 'cancelada'].includes(solicitud.estado)
      || solicitud.estado === estadoFilter;
    const matchesPrioridad = prioridadFilter === 'all' || solicitud.prioridad === prioridadFilter;

    return matchesSearch && matchesEstado && matchesPrioridad;
  });

  const getEstadoBadge = (estado: string) => {
    const estados: Record<string, { color: string; label: string }> = {
      borrador: { color: 'bg-muted text-muted-foreground border-border', label: 'Borrador' },
      pendiente: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'Pendiente' },
      en_revision: { color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', label: 'En Revisión' },
      aprobada: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Pend. de Pago' },
      rechazada: { color: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Rechazada' },
      convertida: { color: 'bg-info-muted text-info-muted-foreground border-info-muted', label: 'Convertida' },
      pagada: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Pagada' },
      cancelada: { color: 'bg-muted text-muted-foreground border-border', label: 'Cancelada' }
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

  const handleIrACuentaCorriente = (solicitud: SolicitudPago) => {
    if (!solicitud.proveedorId) {
      toast.error('No se puede navegar: falta el ID del proveedor');
      return;
    }

    const params = new URLSearchParams();
    params.set('tab', 'cuenta-corriente');

    if (solicitud.facturas && solicitud.facturas.length > 0) {
      solicitud.facturas.forEach((factura) => {
        if (factura.id) {
          params.append('selectInvoices', String(factura.id));
        }
      });
    }

    router.push(`/administracion/compras/proveedores/${solicitud.proveedorId}?${params.toString()}`);
  };

  const handleSacarPago = (solicitud: SolicitudPago) => {
    if (!solicitud.proveedorId) {
      toast.error('No se puede realizar pago: falta el ID del proveedor');
      return;
    }

    // Abrir modal de pago directamente
    const invoiceIds = solicitud.facturas?.map(f => Number(f.id)).filter(id => !isNaN(id)) || [];

    setPagoModalData({
      proveedorId: Number(solicitud.proveedorId),
      proveedorNombre: solicitud.proveedor,
      invoiceIds,
    });
    setShowPagoModal(true);
  };

  const handleDelete = async (solicitud: SolicitudPago) => {
    const ok = await confirm({
      title: 'Eliminar solicitud',
      description: `¿Está seguro que desea eliminar la solicitud ${solicitud.numero}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/compras/solicitudes/${solicitud.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Solicitud eliminada exitosamente');
      loadSolicitudes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Helper para saber si se puede eliminar
  const canDelete = (estado: string) => ['borrador', 'pendiente'].includes(estado);
  const canEdit = (estado: string) => ['borrador', 'pendiente', 'rechazada'].includes(estado);

  // Bulk selection functions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSolicitudes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSolicitudes.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, estadoFilter, prioridadFilter]);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const selectedSolicitudes = filteredSolicitudes.filter(s => selectedIds.has(s.id));

    // Solo se pueden eliminar solicitudes en estado borrador o pendiente
    const deletableSolicitudes = selectedSolicitudes.filter(s => canDelete(s.estado));
    const nonDeletableCount = selectedSolicitudes.length - deletableSolicitudes.length;

    if (deletableSolicitudes.length === 0) {
      toast.error('Solo se pueden eliminar solicitudes en estado borrador o pendiente');
      return;
    }

    let deleteMessage = `¿Eliminar ${deletableSolicitudes.length} solicitud(es)?`;
    if (nonDeletableCount > 0) {
      deleteMessage = `Se eliminarán ${deletableSolicitudes.length} solicitud(es). ${nonDeletableCount} solicitud(es) no se pueden eliminar por su estado.`;
    }

    const ok = await confirm({
      title: 'Eliminar solicitudes',
      description: deleteMessage,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    setIsBulkDeleting(true);
    let deletedCount = 0;
    let errorCount = 0;

    for (const solicitud of deletableSolicitudes) {
      try {
        const resp = await fetch(`/api/compras/solicitudes/${solicitud.id}`, {
          method: 'DELETE',
        });
        if (resp.ok) {
          deletedCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsBulkDeleting(false);
    setSelectedIds(new Set());

    if (deletedCount > 0) {
      toast.success(`${deletedCount} solicitud(es) eliminada(s)`);
      await loadSolicitudes();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} solicitud(es) no se pudieron eliminar`);
    }
  };

  const handleVerDetalle = (solicitud: SolicitudPago) => {
    setSelectedSolicitudId(solicitud.id);
    setShowDetalleModal(true);
  };

  // KPIs counts
  const borradores = solicitudes.filter(s => s.estado === 'borrador').length;
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;
  const enRevision = solicitudes.filter(s => s.estado === 'en_revision').length;
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobada').length;
  const urgentes = solicitudes.filter(s => s.prioridad === 'urgente' || s.esUrgente).length;

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <FileCheck className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Solicitudes de Pago</h1>
          <span className="text-xs text-muted-foreground">
            {filteredSolicitudes.length} solicitud(es)
          </span>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      {/* KPIs + Filtros inline */}
      <div className="px-6 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar número, proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activas" className="text-xs">Activas</SelectItem>
                <SelectItem value="all" className="text-xs">Todas</SelectItem>
                <SelectItem value="borrador" className="text-xs">Borrador</SelectItem>
                <SelectItem value="pendiente" className="text-xs">Pendiente</SelectItem>
                <SelectItem value="en_revision" className="text-xs">En Revisión</SelectItem>
                <SelectItem value="aprobada" className="text-xs">Pend. de Pago</SelectItem>
                <SelectItem value="rechazada" className="text-xs">Rechazada</SelectItem>
                <SelectItem value="pagada" className="text-xs">Pagada</SelectItem>
                <SelectItem value="cancelada" className="text-xs">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas</SelectItem>
                <SelectItem value="baja" className="text-xs">Baja</SelectItem>
                <SelectItem value="media" className="text-xs">Media</SelectItem>
                <SelectItem value="alta" className="text-xs">Alta</SelectItem>
                <SelectItem value="urgente" className="text-xs">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KPIs compactos */}
          <div className="flex items-center gap-4 text-xs">
            {borradores > 0 && (
              <div className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Borr:</span>
                <span className="font-medium">{borradores}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-warning-muted-foreground" />
              <span className="text-muted-foreground">Pend:</span>
              <span className="font-medium">{pendientes}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning-muted-foreground" />
              <span className="text-muted-foreground">Rev:</span>
              <span className="font-medium">{enRevision}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span className="text-muted-foreground">Aprob:</span>
              <span className="font-medium">{aprobadas}</span>
            </div>
            {urgentes > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-muted-foreground">Urg:</span>
                <span className="font-medium text-destructive">{urgentes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Mass actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-sm font-medium">{selectedIds.size} seleccionada(s)</span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Exportar próximamente')}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isBulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="px-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-xs text-muted-foreground">Cargando solicitudes...</p>
          </div>
        ) : filteredSolicitudes.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">No se encontraron solicitudes de pago</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-8 px-2">
                    <Checkbox
                      checked={filteredSolicitudes.length > 0 && selectedIds.size === filteredSolicitudes.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todas"
                      className="h-3.5 w-3.5"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium w-[130px]">Número</TableHead>
                  <TableHead className="text-xs font-medium max-w-[160px]">Proveedor</TableHead>
                  <TableHead className="text-xs font-medium w-[90px]">Solicitante</TableHead>
                  <TableHead className="text-xs font-medium w-[80px]">Fecha</TableHead>
                  <TableHead className="text-xs font-medium w-[75px]">Prioridad</TableHead>
                  <TableHead className="text-xs font-medium w-[105px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium w-[45px] text-center">Items</TableHead>
                  <TableHead className="text-xs font-medium w-[100px] text-right">Monto</TableHead>
                  <TableHead className="text-xs font-medium w-[60px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSolicitudes.map((solicitud) => {
                  const estadoInfo = getEstadoBadge(solicitud.estado);
                  const prioridadInfo = getPrioridadBadge(solicitud.prioridad);
                  const isT2orMixed = solicitud.docType === 'T2' || solicitud.docType === 'MIXED';
                  return (
                    <TableRow
                      key={solicitud.id}
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer",
                        isT2orMixed && viewMode === 'E' && "border-l-2 border-l-amber-400",
                        selectedIds.has(solicitud.id) && "bg-primary/5"
                      )}
                      onClick={() => handleVerDetalle(solicitud)}
                    >
                      <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(solicitud.id)}
                          onCheckedChange={() => toggleSelect(solicitud.id)}
                          aria-label={`Seleccionar ${solicitud.numero}`}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(isT2orMixed && viewMode === 'E' && "text-warning-muted-foreground")}>
                            {solicitud.numero}
                          </span>
                          {isT2orMixed && viewMode === 'E' && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1 py-0 h-3.5",
                                solicitud.docType === 'T2'
                                  ? "bg-warning-muted text-warning-muted-foreground border-warning-muted"
                                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300"
                              )}
                            >
                              {solicitud.docType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate" title={solicitud.proveedor}>{solicitud.proveedor}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate">{solicitud.solicitante}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(solicitud.fecha), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${prioridadInfo.color} border text-[10px] px-1.5 py-0 whitespace-nowrap`}>
                          {prioridadInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${estadoInfo.color} border text-[10px] px-1.5 py-0 whitespace-nowrap`}>
                          {estadoInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center">{solicitud.items}</TableCell>
                      <TableCell className="text-xs font-medium text-right">{formatCurrency(solicitud.monto)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleVerDetalle(solicitud)}>
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            {canEdit(solicitud.estado) && (
                              <DropdownMenuItem onClick={() => router.push(`/administracion/compras/solicitudes/${solicitud.id}/editar`)}>
                                <Edit className="w-3.5 h-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSacarPago(solicitud)}>
                              <CreditCard className="w-3.5 h-3.5 mr-2" />
                              Sacar Pago
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleIrACuentaCorriente(solicitud)}>
                              <DollarSign className="w-3.5 h-3.5 mr-2" />
                              Ir a Cta. Cte.
                            </DropdownMenuItem>
                            {canDelete(solicitud.estado) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(solicitud)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {showModal && (
        <SolicitudPagoModal
          key="solicitud-pago-modal"
          open={showModal}
          onOpenChange={setShowModal}
          onSolicitudCreated={loadSolicitudes}
        />
      )}

      <SolicitudDetalleModal
        solicitudId={selectedSolicitudId}
        open={showDetalleModal}
        onOpenChange={setShowDetalleModal}
        onSolicitudUpdated={loadSolicitudes}
      />

      {pagoModalData && (
        <RegistrarPagoModal
          open={showPagoModal}
          onOpenChange={(open) => {
            setShowPagoModal(open);
            if (!open) setPagoModalData(null);
          }}
          proveedorId={pagoModalData.proveedorId}
          proveedorNombre={pagoModalData.proveedorNombre}
          preSelectedInvoices={pagoModalData.invoiceIds}
          onPaymentComplete={loadSolicitudes}
        />
      )}
    </div>
  );
}
