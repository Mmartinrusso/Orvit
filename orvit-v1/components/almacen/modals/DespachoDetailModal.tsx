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
import { PackageCheck, Truck, CheckCircle, X } from 'lucide-react';
import { useDespacho, useDespachosMutations } from '../hooks';
import { DespachoStatusBadge } from '../shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface DespachoDetailModalProps {
  open: boolean;
  despachoId: number | null;
  onClose: () => void;
}

/**
 * Modal para ver detalle de despacho
 */
export function DespachoDetailModal({
  open,
  despachoId,
  onClose,
}: DespachoDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: despacho, isLoading } = useDespacho(open ? despachoId : null);
  const { prepare, markReady, dispatch, receive, cancel } = useDespachosMutations();

  const handlePrepare = async () => {
    if (!despachoId) return;
    try {
      await prepare.mutateAsync(despachoId);
      toast({ title: 'Despacho en preparación' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReady = async () => {
    if (!despachoId) return;
    try {
      await markReady.mutateAsync(despachoId);
      toast({ title: 'Despacho listo' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDispatch = async () => {
    if (!despachoId || !user?.id) return;
    try {
      await dispatch.mutateAsync({ id: despachoId, userId: user.id });
      toast({ title: 'Despachado correctamente' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReceive = async () => {
    if (!despachoId || !user?.id) return;
    try {
      await receive.mutateAsync({ id: despachoId, userId: user.id });
      toast({ title: 'Recepción confirmada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    if (!despachoId) return;
    try {
      await cancel.mutateAsync({ id: despachoId });
      toast({ title: 'Despacho cancelado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <DetailSkeleton />
        ) : despacho ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">
                    Despacho {despacho.numero}
                  </DialogTitle>
                  <DialogDescription>
                    Creado el{' '}
                    {format(new Date(despacho.createdAt), "dd 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </DialogDescription>
                </div>
                <DespachoStatusBadge status={despacho.estado} />
              </div>
            </DialogHeader>

            <Separator />

            {/* Información general */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <span className="ml-2 font-medium">{despacho.tipo}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Depósito:</span>
                <span className="ml-2 font-medium">{despacho.warehouse?.nombre || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Despachador:</span>
                <span className="ml-2 font-medium">{despacho.despachador?.name || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Destinatario:</span>
                <span className="ml-2 font-medium">
                  {despacho.receptor?.name || despacho.destinatario || '-'}
                </span>
              </div>
              {despacho.materialRequest && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Solicitud:</span>
                  <span className="ml-2 font-medium">{despacho.materialRequest.numero}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h4 className="font-medium mb-2">Items Despachados</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Ubicación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despacho.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">
                              {item.supplierItem?.nombre || '-'}
                            </span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {item.supplierItem?.codigoProveedor}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.cantidadDespachada}
                        </TableCell>
                        <TableCell>{item.lote || '-'}</TableCell>
                        <TableCell>{item.ubicacion || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Notas */}
            {despacho.notas && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Notas</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {despacho.notas}
                  </p>
                </div>
              </>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>

              {despacho.estado === 'BORRADOR' && (
                <Button onClick={handlePrepare} disabled={prepare.isPending}>
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Preparar
                </Button>
              )}

              {despacho.estado === 'EN_PREPARACION' && (
                <Button onClick={handleReady} disabled={markReady.isPending}>
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Marcar Listo
                </Button>
              )}

              {despacho.estado === 'LISTO_DESPACHO' && (
                <Button onClick={handleDispatch} disabled={dispatch.isPending}>
                  <Truck className="h-4 w-4 mr-2" />
                  Despachar
                </Button>
              )}

              {despacho.estado === 'DESPACHADO' && (
                <Button onClick={handleReceive} disabled={receive.isPending}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Recepción
                </Button>
              )}

              {!['DESPACHADO', 'RECIBIDO', 'CANCELADO'].includes(despacho.estado) && (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancel.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Despacho no encontrado
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
