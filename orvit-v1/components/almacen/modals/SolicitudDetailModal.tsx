'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, X, Send, Truck } from 'lucide-react';
import { useSolicitud, useSolicitudesMutations } from '../hooks';
import { SolicitudStatusBadge, PriorityBadge } from '../shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SolicitudDetailModalProps {
  open: boolean;
  solicitudId: number | null;
  onClose: () => void;
}

/**
 * Modal para ver detalle de solicitud
 */
export function SolicitudDetailModal({
  open,
  solicitudId,
  onClose,
}: SolicitudDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: solicitud, isLoading } = useSolicitud(open ? solicitudId : null);
  const { submit, approve, reject, cancel } = useSolicitudesMutations();

  const handleSubmit = async () => {
    if (!solicitudId) return;
    try {
      await submit.mutateAsync(solicitudId);
      toast({ title: 'Solicitud enviada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    if (!solicitudId || !user?.id) return;
    try {
      await approve.mutateAsync({ id: solicitudId, userId: user.id });
      toast({ title: 'Solicitud aprobada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!solicitudId || !user?.id) return;
    try {
      await reject.mutateAsync({ id: solicitudId, userId: user.id });
      toast({ title: 'Solicitud rechazada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    if (!solicitudId) return;
    try {
      await cancel.mutateAsync({ id: solicitudId });
      toast({ title: 'Solicitud cancelada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <DetailSkeleton />
        ) : solicitud ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">
                    Solicitud {solicitud.numero}
                  </DialogTitle>
                  <DialogDescription>
                    Creada el{' '}
                    {format(new Date(solicitud.createdAt), "dd 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <SolicitudStatusBadge status={solicitud.estado} />
                  <PriorityBadge priority={solicitud.urgencia} />
                </div>
              </div>
            </DialogHeader>

            <Separator />

            {/* Información general */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <span className="ml-2 font-medium">{solicitud.tipo}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Solicitante:</span>
                <span className="ml-2 font-medium">{solicitud.solicitante?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Depósito:</span>
                <span className="ml-2 font-medium">{solicitud.warehouse?.nombre || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha necesidad:</span>
                <span className="ml-2 font-medium">
                  {solicitud.fechaNecesidad
                    ? format(new Date(solicitud.fechaNecesidad), 'dd/MM/yyyy')
                    : '-'}
                </span>
              </div>
              {solicitud.motivo && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="ml-2">{solicitud.motivo}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h4 className="font-medium mb-2">Items Solicitados</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Aprobado</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead className="text-right">Despachado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitud.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">
                              {item.supplierItem?.nombre || item.tool?.name || '-'}
                            </span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {item.supplierItem?.codigoProveedor || item.tool?.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.cantidadSolicitada} {item.unidad}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.cantidadAprobada || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.cantidadReservada || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.cantidadDespachada || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Notas */}
            {solicitud.notas && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Notas</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {solicitud.notas}
                  </p>
                </div>
              </>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>

              {solicitud.estado === 'BORRADOR' && (
                <Button onClick={handleSubmit} disabled={submit.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
              )}

              {solicitud.estado === 'PENDIENTE_APROBACION' && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={reject.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                  <Button onClick={handleApprove} disabled={approve.isPending}>
                    <Check className="h-4 w-4 mr-2" />
                    Aprobar
                  </Button>
                </>
              )}

              {solicitud.estado === 'APROBADA' && (
                <Button>
                  <Truck className="h-4 w-4 mr-2" />
                  Crear Despacho
                </Button>
              )}

              {!['DESPACHADA', 'CANCELADA', 'RECHAZADA'].includes(solicitud.estado) && (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancel.isPending}
                >
                  Cancelar
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Solicitud no encontrada
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-32" />
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Separator />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
