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
import { Badge } from '@/components/ui/badge';
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
import { Check, X } from 'lucide-react';
import { useAjuste, useAjustesMutations } from '../hooks';
import { AjusteStatusBadge } from '../shared/StatusBadge';
import { AdjustmentTypeLabels, type AdjustmentType } from '@/lib/almacen/types';
import { useToast } from '@/hooks/use-toast';
import { cn, formatNumber } from '@/lib/utils';

interface AjusteDetailModalProps {
  open: boolean;
  ajusteId: number | null;
  onClose: () => void;
}

/**
 * Modal para ver detalle de ajuste de inventario
 */
export function AjusteDetailModal({
  open,
  ajusteId,
  onClose,
}: AjusteDetailModalProps) {
  const { toast } = useToast();
  const { data: ajuste, isLoading } = useAjuste(open ? ajusteId : null);
  const { confirm, approve, reject } = useAjustesMutations();

  const handleConfirm = async () => {
    if (!ajusteId) return;
    try {
      await confirm.mutateAsync(ajusteId);
      toast({ title: 'Ajuste confirmado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    if (!ajusteId) return;
    try {
      await approve.mutateAsync(ajusteId);
      toast({ title: 'Ajuste aprobado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!ajusteId) return;
    try {
      await reject.mutateAsync(ajusteId);
      toast({ title: 'Ajuste rechazado' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {isLoading ? (
          <DetailSkeleton />
        ) : ajuste ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">
                    {ajuste.numero}
                  </DialogTitle>
                  <DialogDescription>
                    Ajuste de inventario
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <AjusteStatusBadge status={ajuste.estado} size="default" />
                  <Badge variant="outline">
                    {AdjustmentTypeLabels[ajuste.tipo as AdjustmentType] || ajuste.tipo}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <Separator />

              {/* Información general */}
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Depósito:</span>
                  <span className="ml-2 font-medium">
                    {ajuste.warehouse?.nombre}{' '}
                    <span className="text-muted-foreground">
                      ({ajuste.warehouse?.codigo})
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Creado por:</span>
                  <span className="ml-2 font-medium">
                    {ajuste.createdByUser?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(ajuste.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="ml-2 font-medium">
                    {ajuste.motivo}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reason Code:</span>
                  <span className="ml-2 font-medium">
                    {ajuste.reasonCode || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Motivo Detalle:</span>
                  <span className="ml-2 font-medium">
                    {ajuste.motivoDetalle || '-'}
                  </span>
                </div>
                {ajuste.aprobadoByUser && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Aprobado por:</span>
                      <span className="ml-2 font-medium">
                        {ajuste.aprobadoByUser.name || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fecha Aprobación:</span>
                      <span className="ml-2 font-medium">
                        {ajuste.aprobadoAt
                          ? format(new Date(ajuste.aprobadoAt), 'dd/MM/yyyy HH:mm', { locale: es })
                          : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <Separator />

              {/* Items */}
              <div>
                <h4 className="font-medium mb-2">Items ({ajuste.items?.length || 0})</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Cant. Anterior</TableHead>
                        <TableHead className="text-right">Cant. Nueva</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ajuste.items?.map((item: any) => {
                        const diferencia = item.diferencia;

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
                              {formatNumber(item.cantidadAnterior)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(item.cantidadNueva)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-medium',
                                diferencia > 0 && 'text-green-600',
                                diferencia < 0 && 'text-red-600',
                                diferencia === 0 && 'text-muted-foreground'
                              )}
                            >
                              {diferencia > 0 ? '+' : ''}
                              {formatNumber(diferencia)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Notas */}
              {ajuste.notas && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Notas</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {ajuste.notas}
                    </p>
                  </div>
                </>
              )}
            </DialogBody>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>

              {ajuste.estado === 'BORRADOR' && (
                <Button onClick={handleConfirm} disabled={confirm.isPending}>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              )}

              {ajuste.estado === 'PENDIENTE_APROBACION' && (
                <>
                  <Button
                    variant="outline"
                    className="text-destructive border-destructive hover:bg-destructive/10"
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
            </DialogFooter>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Ajuste no encontrado
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
