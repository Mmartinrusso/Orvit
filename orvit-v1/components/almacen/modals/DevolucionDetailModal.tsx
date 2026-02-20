'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
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
import { Send, Check, X } from 'lucide-react';
import { useDevolucion, useDevolucionesMutations } from '../hooks';
import { DevolucionStatusBadge } from '../shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface DevolucionDetailModalProps {
  open: boolean;
  devolucionId: number | null;
  onClose: () => void;
}

/**
 * Modal para ver detalle de devolución
 */
export function DevolucionDetailModal({
  open,
  devolucionId,
  onClose,
}: DevolucionDetailModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: devolucion, isLoading } = useDevolucion(open ? devolucionId : null);
  const { submit, accept, reject } = useDevolucionesMutations();

  const handleSubmit = async () => {
    if (!devolucionId) return;
    try {
      await submit.mutateAsync(devolucionId);
      toast({ title: 'Devolución enviada para revisión' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAccept = async () => {
    if (!devolucionId || !user?.id) return;
    try {
      await accept.mutateAsync({ id: devolucionId, userId: user.id });
      toast({ title: 'Devolución aceptada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!devolucionId || !user?.id) return;
    try {
      await reject.mutateAsync({ id: devolucionId, userId: user.id });
      toast({ title: 'Devolución rechazada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        {isLoading ? (
          <DetailSkeleton />
        ) : devolucion ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">
                    Devolución {devolucion.numero}
                  </DialogTitle>
                  <DialogDescription>
                    Creada el{' '}
                    {format(new Date(devolucion.createdAt), "dd 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </DialogDescription>
                </div>
                <DevolucionStatusBadge status={devolucion.estado} />
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4">
            <Separator />

            {/* Información general */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Depósito:</span>
                <span className="ml-2 font-medium">{devolucion.warehouse?.nombre || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Solicitante:</span>
                <span className="ml-2 font-medium">{devolucion.solicitante?.name || '-'}</span>
              </div>
              {devolucion.despacho && (
                <div>
                  <span className="text-muted-foreground">Despacho Origen:</span>
                  <span className="ml-2 font-medium">{devolucion.despacho.numero}</span>
                </div>
              )}
              {devolucion.revisor && (
                <div>
                  <span className="text-muted-foreground">Revisor:</span>
                  <span className="ml-2 font-medium">{devolucion.revisor.name}</span>
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="bg-muted/50 p-3 rounded-md">
              <h4 className="font-medium mb-1">Motivo</h4>
              <p className="text-sm">{devolucion.motivo}</p>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h4 className="font-medium mb-2">Items Devueltos</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devolucion.items?.map((item: any) => (
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
                        <TableCell className="text-right">{item.cantidadDevuelta}</TableCell>
                        <TableCell>{item.estado || 'Bueno'}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {item.notas || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Notas */}
            {devolucion.notas && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Notas adicionales</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {devolucion.notas}
                  </p>
                </div>
              </>
            )}

            </DialogBody>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>

              {devolucion.estado === 'BORRADOR' && (
                <Button onClick={handleSubmit} disabled={submit.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
              )}

              {devolucion.estado === 'PENDIENTE_REVISION' && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={reject.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                  <Button onClick={handleAccept} disabled={accept.isPending}>
                    <Check className="h-4 w-4 mr-2" />
                    Aceptar
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Devolución no encontrada
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
      </div>
      <Skeleton className="h-20 w-full" />
      <Separator />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
