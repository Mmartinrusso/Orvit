'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Warehouse,
  FileText,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AdjustmentItem {
  id: number;
  supplierItemId: number;
  cantidadAnterior: number;
  cantidadNueva: number;
  diferencia: number;
  supplierItem?: {
    id: number;
    nombre: string;
    unidad: string;
    codigoProveedor?: string;
  };
}

interface Adjustment {
  id: number;
  numero: string;
  tipo: string;
  estado: string;
  motivo: string;
  motivoDetalle?: string;
  reasonCode?: string;
  notas?: string;
  createdAt: string;
  aprobadoAt?: string;
  warehouse?: {
    id: number;
    codigo: string;
    nombre: string;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
  aprobadoByUser?: {
    id: number;
    name: string;
  };
  items: AdjustmentItem[];
}

interface AdjustmentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjustmentId: number | null;
  onUpdated?: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  INVENTARIO_FISICO: 'Inventario Físico',
  ROTURA: 'Rotura',
  VENCIMIENTO: 'Vencimiento',
  MERMA: 'Merma',
  CORRECCION: 'Corrección',
  DEVOLUCION_INTERNA: 'Devolución Interna',
};

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  PENDIENTE_APROBACION: { label: 'Pend. Aprobación', color: 'bg-amber-100 text-amber-700', icon: Clock },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export function AdjustmentDetailModal({
  open,
  onOpenChange,
  adjustmentId,
  onUpdated,
}: AdjustmentDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Cargar detalle
  useEffect(() => {
    async function loadAdjustment() {
      if (!adjustmentId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/compras/stock/ajustes/${adjustmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAdjustment(data);
        } else {
          toast.error('Error al cargar el ajuste');
        }
      } catch (error) {
        console.error('Error loading adjustment:', error);
        toast.error('Error al cargar el ajuste');
      } finally {
        setLoading(false);
      }
    }

    if (open && adjustmentId) {
      loadAdjustment();
    } else {
      setAdjustment(null);
    }
  }, [open, adjustmentId]);

  // Aprobar y confirmar
  const handleAprobar = async () => {
    if (!adjustment) return;
    setActionLoading('aprobar');
    try {
      const res = await fetch(`/api/compras/stock/ajustes/${adjustment.id}/aprobar`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Ajuste aprobado y confirmado');
        onUpdated?.();
        onOpenChange(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al aprobar');
      }
    } catch (error) {
      toast.error('Error al aprobar el ajuste');
    } finally {
      setActionLoading(null);
    }
  };

  // Rechazar
  const handleRechazar = async () => {
    if (!adjustment) return;
    setActionLoading('rechazar');
    try {
      const res = await fetch(`/api/compras/stock/ajustes/${adjustment.id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: rejectReason }),
      });
      if (res.ok) {
        toast.success('Ajuste rechazado');
        setShowRejectDialog(false);
        setRejectReason('');
        onUpdated?.();
        onOpenChange(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al rechazar');
      }
    } catch (error) {
      toast.error('Error al rechazar el ajuste');
    } finally {
      setActionLoading(null);
    }
  };

  // Confirmar (para BORRADOR)
  const handleConfirmar = async () => {
    if (!adjustment) return;
    setActionLoading('confirmar');
    try {
      const res = await fetch(`/api/compras/stock/ajustes/${adjustment.id}/confirmar`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Ajuste confirmado y stock actualizado');
        onUpdated?.();
        onOpenChange(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al confirmar');
      }
    } catch (error) {
      toast.error('Error al confirmar el ajuste');
    } finally {
      setActionLoading(null);
    }
  };

  // Calcular totales
  const totales = adjustment?.items.reduce(
    (acc, item) => {
      if (item.diferencia > 0) {
        acc.positivo += item.diferencia;
      } else {
        acc.negativo += Math.abs(item.diferencia);
      }
      return acc;
    },
    { positivo: 0, negativo: 0 }
  ) || { positivo: 0, negativo: 0 };

  const estadoConfig = adjustment ? ESTADO_CONFIG[adjustment.estado] || ESTADO_CONFIG.BORRADOR : ESTADO_CONFIG.BORRADOR;
  const EstadoIcon = estadoConfig.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalle de Ajuste
              {adjustment && (
                <Badge className={estadoConfig.color}>
                  <EstadoIcon className="h-3 w-3 mr-1" />
                  {estadoConfig.label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {adjustment?.numero}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : adjustment ? (
            <div className="space-y-6">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Tipo:</span>
                    <span className="text-foreground">{TIPO_LABELS[adjustment.tipo] || adjustment.tipo}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Warehouse className="h-4 w-4" />
                    <span className="font-medium">Depósito:</span>
                    <span className="text-foreground">
                      {adjustment.warehouse?.codigo} - {adjustment.warehouse?.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Creado por:</span>
                    <span className="text-foreground">{adjustment.createdByUser?.name}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Fecha:</span>
                    <span className="text-foreground">
                      {format(new Date(adjustment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                  </div>
                  {adjustment.reasonCode && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">Motivo:</span>
                      <span className="text-foreground">{adjustment.reasonCode}</span>
                    </div>
                  )}
                  {adjustment.aprobadoByUser && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Aprobado por:</span>
                      <span className="text-foreground">{adjustment.aprobadoByUser.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Motivo detallado */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Motivo detallado</p>
                <p className="text-sm">{adjustment.motivo}</p>
                {adjustment.motivoDetalle && (
                  <p className="text-sm text-muted-foreground mt-1">{adjustment.motivoDetalle}</p>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Items ({adjustment.items.length})
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right w-24">Anterior</TableHead>
                        <TableHead className="text-right w-24">Nueva</TableHead>
                        <TableHead className="text-right w-24">Diferencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustment.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">
                              {item.supplierItem?.nombre || `Item #${item.supplierItemId}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.supplierItem?.unidad || 'UN'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.cantidadAnterior).toLocaleString('es-AR')}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.cantidadNueva).toLocaleString('es-AR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                item.diferencia > 0
                                  ? 'text-green-600 font-medium'
                                  : item.diferencia < 0
                                  ? 'text-red-600 font-medium'
                                  : 'text-muted-foreground'
                              }
                            >
                              {item.diferencia > 0 ? '+' : ''}
                              {Number(item.diferencia).toLocaleString('es-AR')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totales */}
                  <div className="border-t bg-muted/50 px-4 py-3 flex justify-end gap-6">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">Entradas:</span>
                      <span className="text-green-600 font-medium">+{totales.positivo.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <span className="text-muted-foreground">Salidas:</span>
                      <span className="text-red-600 font-medium">-{totales.negativo.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {adjustment.notas && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{adjustment.notas}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No se encontró el ajuste
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>

            {adjustment?.estado === 'PENDIENTE_APROBACION' && (
              <>
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={!!actionLoading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={handleAprobar}
                  disabled={!!actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading === 'aprobar' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Aprobar y Confirmar
                </Button>
              </>
            )}

            {adjustment?.estado === 'BORRADOR' && (
              <Button
                onClick={handleConfirmar}
                disabled={!!actionLoading}
              >
                {actionLoading === 'confirmar' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmar Ajuste
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Ajuste</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro que desea rechazar este ajuste? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectReason">Motivo del rechazo (opcional)</Label>
            <Textarea
              id="rejectReason"
              placeholder="Ingrese el motivo del rechazo..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRechazar}
              disabled={!!actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading === 'rechazar' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
