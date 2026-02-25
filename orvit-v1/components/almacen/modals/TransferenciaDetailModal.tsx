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
import { Send, PackageCheck, X, ArrowRight } from 'lucide-react';
import { useTransferencia, useTransferenciasMutations } from '../hooks';
import { TransferenciaStatusBadge } from '../shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/utils';

interface TransferenciaDetailModalProps {
  open: boolean;
  transferId: number | null;
  onClose: () => void;
}

/**
 * Modal para ver detalle de transferencia entre depósitos
 */
export function TransferenciaDetailModal({
  open,
  transferId,
  onClose,
}: TransferenciaDetailModalProps) {
  const { toast } = useToast();
  const { data: transfer, isLoading } = useTransferencia(open ? transferId : null);
  const { send, receive, cancel } = useTransferenciasMutations();

  const handleSend = async () => {
    if (!transferId) return;
    try {
      await send.mutateAsync(transferId);
      toast({ title: 'Transferencia enviada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReceive = async () => {
    if (!transferId) return;
    try {
      await receive.mutateAsync({ id: transferId });
      toast({ title: 'Transferencia recibida' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    if (!transferId) return;
    try {
      await cancel.mutateAsync(transferId);
      toast({ title: 'Transferencia cancelada' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {isLoading ? (
          <DetailSkeleton />
        ) : transfer ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">
                    {transfer.numero}
                  </DialogTitle>
                  <DialogDescription>
                    Transferencia entre depósitos
                  </DialogDescription>
                </div>
                <TransferenciaStatusBadge status={transfer.estado} size="default" />
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <Separator />

              {/* Información general */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Origen:</span>
                  <span className="ml-2 font-medium">
                    {transfer.warehouseOrigen?.nombre}{' '}
                    <span className="text-muted-foreground">
                      ({transfer.warehouseOrigen?.codigo})
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="ml-2 font-medium">
                    {transfer.warehouseDestino?.nombre}{' '}
                    <span className="text-muted-foreground">
                      ({transfer.warehouseDestino?.codigo})
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Creado por:</span>
                  <span className="ml-2 font-medium">
                    {transfer.createdByUser?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(transfer.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha Envío:</span>
                  <span className="ml-2 font-medium">
                    {transfer.fechaEnvio
                      ? format(new Date(transfer.fechaEnvio), 'dd/MM/yyyy HH:mm', { locale: es })
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha Recepción:</span>
                  <span className="ml-2 font-medium">
                    {transfer.fechaRecepcion
                      ? format(new Date(transfer.fechaRecepcion), 'dd/MM/yyyy HH:mm', { locale: es })
                      : '-'}
                  </span>
                </div>
              </div>

              {transfer.motivo && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="ml-2 font-medium">{transfer.motivo}</span>
                </div>
              )}

              <Separator />

              {/* Items */}
              <div>
                <h4 className="font-medium mb-2">Items ({transfer.items?.length || 0})</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Solicitada</TableHead>
                        <TableHead className="text-right">Enviada</TableHead>
                        <TableHead className="text-right">Recibida</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfer.items?.map((item: any) => {
                        const isFullyReceived =
                          item.cantidadRecibida != null &&
                          item.cantidadRecibida === item.cantidadSolicitada;
                        const isPartiallyReceived =
                          item.cantidadRecibida != null &&
                          item.cantidadRecibida > 0 &&
                          item.cantidadRecibida < item.cantidadSolicitada;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {item.supplierItem?.codigoProveedor || '-'}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {item.supplierItem?.nombre || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.supplierItem?.unidad || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(item.cantidadSolicitada)}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.cantidadEnviada != null
                                ? formatNumber(item.cantidadEnviada)
                                : '-'}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                isFullyReceived
                                  ? 'text-green-600'
                                  : isPartiallyReceived
                                    ? 'text-yellow-600'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {item.cantidadRecibida != null
                                ? formatNumber(item.cantidadRecibida)
                                : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Notas */}
              {transfer.notas && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Notas</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {transfer.notas}
                    </p>
                  </div>
                </>
              )}
            </DialogBody>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>

              {transfer.estado === 'BORRADOR' && (
                <Button onClick={handleSend} disabled={send.isPending}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
              )}

              {transfer.estado === 'EN_TRANSITO' && (
                <Button onClick={handleReceive} disabled={receive.isPending}>
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Recibir
                </Button>
              )}

              {!['COMPLETADO', 'CANCELADO'].includes(transfer.estado) && (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive hover:bg-destructive/10"
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
            Transferencia no encontrada
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
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Separator />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
