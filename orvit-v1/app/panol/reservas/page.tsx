'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { formatDateTime } from '@/lib/date-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  ClipboardCheck,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  MoreHorizontal,
  Search,
  RefreshCw,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';
import { usePanolPermissions } from '@/hooks/use-panol-permissions';

interface Reservation {
  id: number;
  toolId: number;
  workOrderId: number;
  quantity: number;
  status: 'PENDING' | 'PICKED' | 'CANCELLED' | 'RETURNED';
  reservedAt: string;
  pickedAt: string | null;
  pickedById: number | null;
  returnedAt: string | null;
  returnedById: number | null;
  notes: string | null;
  tool: {
    id: number;
    name: string;
    itemType: string;
    category: string;
    stockQuantity: number;
    minStockLevel: number;
    unit: string | null;
  };
  workOrder: {
    id: number;
    title: string;
    status: string;
    type: string;
    priority: string;
    machine?: {
      id: number;
      name: string;
    };
  };
  pickedBy?: { id: number; name: string };
  returnedBy?: { id: number; name: string };
}

interface ReservationStats {
  PENDING: number;
  PICKED: number;
  CANCELLED: number;
  RETURNED: number;
}

interface ReservationsResponse {
  success: boolean;
  data: Reservation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: ReservationStats;
}

async function fetchReservations(status: string): Promise<ReservationsResponse> {
  const params = new URLSearchParams();
  if (status && status !== 'all') {
    params.set('status', status);
  }
  params.set('limit', '100');

  const res = await fetch(`/api/tools/reservations?${params.toString()}`);
  if (!res.ok) throw new Error('Error al cargar reservas');
  return res.json();
}

async function updateReservation(id: number, action: string, quantity?: number, notes?: string) {
  const res = await fetch(`/api/tools/reservations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, quantity, notes })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Error al actualizar reserva');
  }
  return res.json();
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    PENDING: { variant: 'secondary', label: 'Pendiente' },
    PICKED: { variant: 'default', label: 'Retirado' },
    CANCELLED: { variant: 'destructive', label: 'Cancelado' },
    RETURNED: { variant: 'outline', label: 'Devuelto' }
  };
  const config = variants[status] || { variant: 'secondary', label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    URGENT: { variant: 'destructive', label: 'Urgente' },
    HIGH: { variant: 'destructive', label: 'Alta' },
    MEDIUM: { variant: 'secondary', label: 'Media' },
    LOW: { variant: 'outline', label: 'Baja' }
  };
  const config = variants[priority] || { variant: 'secondary', label: priority };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

function formatDateLocal(dateString: string | null): string {
  if (!dateString) return '-';
  return formatDateTime(dateString) || '-';
}

export default function ReservasPage() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { canManageReservations } = usePanolPermissions();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: 'pick' | 'cancel' | 'return' | null; reservation: Reservation | null }>({ type: null, reservation: null });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reservations', statusFilter],
    queryFn: () => fetchReservations(statusFilter),
    enabled: !!selectedCompany
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, quantity, notes }: { id: number; action: string; quantity?: number; notes?: string }) =>
      updateReservation(id, action, quantity, notes),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reservations', statusFilter] });
      setActionDialog({ type: null, reservation: null });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleAction = (action: 'pick' | 'cancel' | 'return', reservation: Reservation) => {
    if (!canManageReservations) {
      toast.error('No tienes permisos para gestionar reservas');
      return;
    }
    setActionDialog({ type: action, reservation });
  };

  const confirmAction = () => {
    if (!canManageReservations) {
      toast.error('No tienes permisos para gestionar reservas');
      return;
    }
    if (!actionDialog.reservation || !actionDialog.type) return;
    mutation.mutate({
      id: actionDialog.reservation.id,
      action: actionDialog.type
    });
  };

  // Filtrar por término de búsqueda
  const filteredReservations = data?.data?.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.tool.name.toLowerCase().includes(term) ||
      r.workOrder.title.toLowerCase().includes(term) ||
      r.workOrder.machine?.name.toLowerCase().includes(term) ||
      r.workOrder.id.toString().includes(term)
    );
  }) || [];

  const stats = data?.stats || { PENDING: 0, PICKED: 0, CANCELLED: 0, RETURNED: 0 };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservas por OT</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">Error al cargar reservas</p>
            <Button variant="outline" className="mt-4 mx-auto block" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reservas por OT</h1>
          <p className="text-muted-foreground">
            Gestión de reservas de repuestos asociadas a órdenes de trabajo
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.PENDING}</div>
            <p className="text-xs text-muted-foreground">Esperando picking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retirados</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.PICKED}</div>
            <p className="text-xs text-muted-foreground">En uso por técnicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devueltos</CardTitle>
            <RotateCcw className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.RETURNED}</div>
            <p className="text-xs text-muted-foreground">Retornados al stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.CANCELLED}</div>
            <p className="text-xs text-muted-foreground">No usados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Lista de Reservas
          </CardTitle>
          <CardDescription>
            Todas las reservas de repuestos para órdenes de trabajo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por repuesto, OT, máquina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING">Pendientes</SelectItem>
                <SelectItem value="PICKED">Retirados</SelectItem>
                <SelectItem value="RETURNED">Devueltos</SelectItem>
                <SelectItem value="CANCELLED">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay reservas para mostrar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repuesto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <div className="font-medium">{reservation.tool.name}</div>
                      <div className="text-xs text-muted-foreground">{reservation.tool.category}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{reservation.quantity}</span>
                      <span className="text-muted-foreground text-xs ml-1">{reservation.tool.unit || 'u.'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">#{reservation.workOrder.id}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {reservation.workOrder.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {reservation.workOrder.machine?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {getPriorityBadge(reservation.workOrder.priority)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(reservation.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateLocal(reservation.reservedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {reservation.status === 'PENDING' && canManageReservations && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction('pick', reservation)}>
                                <ArrowDownToLine className="h-4 w-4 mr-2" />
                                Retirar (Picking)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAction('cancel', reservation)}
                                className="text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            </>
                          )}
                          {reservation.status === 'PICKED' && canManageReservations && (
                            <DropdownMenuItem onClick={() => handleAction('return', reservation)}>
                              <ArrowUpFromLine className="h-4 w-4 mr-2" />
                              Devolver
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setSelectedReservation(reservation)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmación de acción */}
      <Dialog open={!!actionDialog.type} onOpenChange={() => setActionDialog({ type: null, reservation: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'pick' && 'Confirmar Retiro'}
              {actionDialog.type === 'cancel' && 'Cancelar Reserva'}
              {actionDialog.type === 'return' && 'Devolver Repuesto'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'pick' && (
                <>
                  Se marcará como retirado y se descontará del stock:
                  <br />
                  <strong>{actionDialog.reservation?.quantity} {actionDialog.reservation?.tool.unit || 'unidades'}</strong> de <strong>{actionDialog.reservation?.tool.name}</strong>
                </>
              )}
              {actionDialog.type === 'cancel' && (
                <>
                  Se cancelará la reserva. El stock no se modificará.
                  <br />
                  <strong>{actionDialog.reservation?.quantity} {actionDialog.reservation?.tool.unit || 'unidades'}</strong> de <strong>{actionDialog.reservation?.tool.name}</strong>
                </>
              )}
              {actionDialog.type === 'return' && (
                <>
                  Se devolverá al stock:
                  <br />
                  <strong>{actionDialog.reservation?.quantity} {actionDialog.reservation?.tool.unit || 'unidades'}</strong> de <strong>{actionDialog.reservation?.tool.name}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, reservation: null })}>
              Cancelar
            </Button>
            <Button
              onClick={confirmAction}
              disabled={mutation.isPending}
              variant={actionDialog.type === 'cancel' ? 'destructive' : 'default'}
            >
              {mutation.isPending ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalle */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Reserva #{selectedReservation?.id}</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Repuesto</p>
                  <p className="font-medium">{selectedReservation.tool.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cantidad</p>
                  <p className="font-medium">{selectedReservation.quantity} {selectedReservation.tool.unit || 'u.'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Orden de Trabajo</p>
                  <p className="font-medium">#{selectedReservation.workOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getStatusBadge(selectedReservation.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reservado</p>
                  <p className="font-medium">{formatDateLocal(selectedReservation.reservedAt)}</p>
                </div>
                {selectedReservation.pickedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Retirado</p>
                    <p className="font-medium">{formatDateLocal(selectedReservation.pickedAt)}</p>
                    {selectedReservation.pickedBy && (
                      <p className="text-xs text-muted-foreground">por {selectedReservation.pickedBy.name}</p>
                    )}
                  </div>
                )}
                {selectedReservation.returnedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Devuelto</p>
                    <p className="font-medium">{formatDateLocal(selectedReservation.returnedAt)}</p>
                    {selectedReservation.returnedBy && (
                      <p className="text-xs text-muted-foreground">por {selectedReservation.returnedBy.name}</p>
                    )}
                  </div>
                )}
              </div>
              {selectedReservation.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedReservation.notes}</p>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Stock actual del repuesto</p>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedReservation.tool.stockQuantity}</span>
                  <span className="text-muted-foreground text-sm">{selectedReservation.tool.unit || 'unidades'}</span>
                  {selectedReservation.tool.stockQuantity <= selectedReservation.tool.minStockLevel && (
                    <Badge variant="destructive" className="text-xs">Stock bajo</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
