'use client';

import { useEffect, useState } from 'react';
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
  Package,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Warehouse,
  MoreHorizontal,
  Edit,
  Trash2,
  FileCheck
} from 'lucide-react';
import { ConfirmarRecepcionModal } from '@/components/compras/confirmar-recepcion-modal';
import { RecepcionDetalleModal } from '@/components/compras/recepcion-detalle-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApiMutation, createFetchMutation } from '@/hooks/use-api-mutation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useViewMode } from '@/contexts/ViewModeContext';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { useAuth } from '@/contexts/AuthContext';

interface Recepcion {
  id: number;
  numero: string;
  fechaRecepcion: string;
  numeroRemito?: string;
  estado: string;
  estadoCalidad: string;
  esEmergencia: boolean;
  requiereRegularizacion: boolean;
  regularizada: boolean;
  proveedor: { id: number; name: string };
  purchaseOrder?: { id: number; numero: string };
  warehouse: { id: number; codigo: string; nombre: string };
  createdByUser: { id: number; name: string };
  _count: { items: number; stockMovements: number };
}

const getEstadoBadge = (estado: string) => {
  const estados: Record<string, { variant: 'secondary' | 'default' | 'destructive'; label: string }> = {
    'BORRADOR': { variant: 'secondary', label: 'Borrador' },
    'CONFIRMADA': { variant: 'default', label: 'Confirmada' },
    'ANULADA': { variant: 'destructive', label: 'Anulada' }
  };
  return estados[estado] || estados.BORRADOR;
};

export default function RecepcionesPage() {
  const router = useRouter();
  const { mode: viewMode } = useViewMode();
  const { hasPermission } = useAuth();
  const canEditOrden = hasPermission('compras.ordenes.edit');
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // Modal de confirmación con evidencia
  const [confirmarModalOpen, setConfirmarModalOpen] = useState(false);
  const [recepcionAConfirmar, setRecepcionAConfirmar] = useState<Recepcion | null>(null);

  // Modal de detalle
  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  const [recepcionDetalleId, setRecepcionDetalleId] = useState<number | null>(null);

  // Modal de eliminar
  const [recepcionAEliminar, setRecepcionAEliminar] = useState<Recepcion | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Mutation: eliminar recepción
  const deleteRecepcion = useApiMutation<unknown, { id: number }>({
    mutationFn: createFetchMutation({
      url: (vars) => `/api/compras/recepciones/${vars.id}`,
      method: 'DELETE',
    }),
    successMessage: 'Recepción eliminada correctamente',
    errorMessage: 'Error al eliminar la recepción',
    onSuccess: () => {
      setIsDeleteOpen(false);
      setRecepcionAEliminar(null);
      loadRecepciones();
    },
    onError: () => {
      setIsDeleteOpen(false);
      setRecepcionAEliminar(null);
    },
  });

  const loadRecepciones = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(estadoFilter !== 'all' && { estado: estadoFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/compras/recepciones?${params}`);
      if (!response.ok) throw new Error('Error al obtener recepciones');

      const data = await response.json();
      setRecepciones(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar recepciones');
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando cambia el filtro de estado o el ViewMode (juego de tecla)
  useEffect(() => {
    loadRecepciones();
  }, [estadoFilter, viewMode]);

  const handleSearch = () => {
    loadRecepciones(1);
  };

  const handleAbrirConfirmar = (recepcion: Recepcion) => {
    setRecepcionAConfirmar(recepcion);
    setConfirmarModalOpen(true);
  };

  const handleVerDetalle = (recepcionId: number) => {
    setRecepcionDetalleId(recepcionId);
    setDetalleModalOpen(true);
  };

  const handleConfirmado = () => {
    loadRecepciones();
  };

  const handleEliminar = (recepcion: Recepcion) => {
    setRecepcionAEliminar(recepcion);
    setIsDeleteOpen(true);
  };

  const confirmarEliminar = () => {
    if (!recepcionAEliminar) return;
    deleteRecepcion.mutate({ id: recepcionAEliminar.id });
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: es });
  };

  // Counts for inline KPIs
  const borradores = recepciones.filter(r => r.estado === 'BORRADOR').length;
  const confirmadas = recepciones.filter(r => r.estado === 'CONFIRMADA').length;
  const emergencias = recepciones.filter(r => r.esEmergencia).length;
  const pendRegularizar = recepciones.filter(r => r.requiereRegularizacion && !r.regularizada).length;

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Recepciones</h1>
          <span className="text-xs text-muted-foreground">
            {pagination.total} registro(s)
          </span>
        </div>
        {canEditOrden && (
          <Button size="sm" onClick={() => router.push('/administracion/compras/recepciones/nueva')}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Recepción
          </Button>
        )}
      </div>

      {/* KPIs inline + Filtros */}
      <div className="px-6 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar número, remito..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos</SelectItem>
                <SelectItem value="BORRADOR" className="text-xs">Borrador</SelectItem>
                <SelectItem value="CONFIRMADA" className="text-xs">Confirmada</SelectItem>
                <SelectItem value="ANULADA" className="text-xs">Anulada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KPIs compactos */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Borr:</span>
              <span className="font-medium">{borradores}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              <span className="text-muted-foreground">Conf:</span>
              <span className="font-medium">{confirmadas}</span>
            </div>
            {emergencias > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-warning-muted-foreground" />
                <span className="text-muted-foreground">Emerg:</span>
                <span className="font-medium text-warning-muted-foreground">{emergencias}</span>
              </div>
            )}
            {pendRegularizar > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Pend. Reg:</span>
                <span className="font-medium text-warning-muted-foreground">{pendRegularizar}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="px-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-xs text-muted-foreground">Cargando recepciones...</p>
          </div>
        ) : recepciones.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-xs text-muted-foreground">No se encontraron recepciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-medium">Número</TableHead>
                  <TableHead className="text-xs font-medium w-[90px]">Fecha</TableHead>
                  <TableHead className="text-xs font-medium">Proveedor</TableHead>
                  <TableHead className="text-xs font-medium w-[80px]">OC</TableHead>
                  <TableHead className="text-xs font-medium w-[80px]">Depósito</TableHead>
                  <TableHead className="text-xs font-medium w-[50px]">Items</TableHead>
                  <TableHead className="text-xs font-medium w-[90px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recepciones.map((recepcion) => {
                  const estadoInfo = getEstadoBadge(recepcion.estado);
                  return (
                    <TableRow key={recepcion.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{recepcion.numero}</span>
                          {recepcion.esEmergencia && (
                            <Badge variant="destructive" className="text-xs px-1 py-0">
                              Emerg
                            </Badge>
                          )}
                          {recepcion.requiereRegularizacion && !recepcion.regularizada && (
                            <Badge variant="outline" className="text-xs px-1 py-0 text-warning-muted-foreground">
                              Reg
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(recepcion.fechaRecepcion), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs">{recepcion.proveedor.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {recepcion.purchaseOrder ? recepcion.purchaseOrder.numero : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Warehouse className="w-3 h-3" />
                          {recepcion.warehouse.codigo}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center">{recepcion._count.items}</TableCell>
                      <TableCell>
                        <Badge variant={estadoInfo.variant} className="text-xs px-1.5 py-0">
                          {estadoInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => handleVerDetalle(recepcion.id)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            {recepcion.estado === 'BORRADOR' && canEditOrden && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleAbrirConfirmar(recepcion)}
                                  className="text-success focus:text-success"
                                >
                                  <FileCheck className="w-3.5 h-3.5 mr-2" />
                                  Confirmar con evidencia
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/administracion/compras/recepciones/${recepcion.id}/editar`)}
                                >
                                  <Edit className="w-3.5 h-3.5 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              </>
                            )}
                            {canEditOrden && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleEliminar(recepcion)}
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

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={pagination.page === 1}
            onClick={() => loadRecepciones(pagination.page - 1)}
          >
            Anterior
          </Button>
          <span className="flex items-center px-3 text-xs text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => loadRecepciones(pagination.page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Modal de confirmación con evidencia */}
      {recepcionAConfirmar && (
        <ConfirmarRecepcionModal
          open={confirmarModalOpen}
          onOpenChange={setConfirmarModalOpen}
          recepcion={recepcionAConfirmar}
          onConfirmed={handleConfirmado}
        />
      )}

      {/* Modal de detalle */}
      <RecepcionDetalleModal
        open={detalleModalOpen}
        onOpenChange={setDetalleModalOpen}
        recepcionId={recepcionDetalleId}
      />

      {/* Modal confirmar eliminar */}
      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Eliminar Recepción"
        description={`¿Estás seguro de que querés eliminar la recepción ${recepcionAEliminar?.numero}?${recepcionAEliminar?.estado === 'CONFIRMADA' ? ' Se revertirá el stock y la factura vinculada volverá a estado "sin ingreso".' : ''} Esta acción no se puede deshacer.`}
        onConfirm={confirmarEliminar}
        loading={deleteRecepcion.isPending}
      />
    </div>
  );
}
