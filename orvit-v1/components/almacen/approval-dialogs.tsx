'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Ban,
  AlertTriangle,
  Package,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// APPROVE REQUEST DIALOG
// ============================================
interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number;
  requestNumber: string;
  items: Array<{
    id: number;
    supplierItem?: { nombre: string };
    cantidadSolicitada: number;
    unidad: string;
  }>;
  userId: number;
  onSuccess: () => void;
}

export function ApproveRequestDialog({
  open,
  onOpenChange,
  requestId,
  requestNumber,
  items,
  userId,
  onSuccess,
}: ApproveDialogProps) {
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState('');
  const [adjustedQuantities, setAdjustedQuantities] = useState<Record<number, number>>({});

  const handleApprove = async () => {
    setLoading(true);
    try {
      // First adjust quantities if any were changed
      const adjustedItems = Object.entries(adjustedQuantities);
      if (adjustedItems.length > 0) {
        for (const [itemId, qty] of adjustedItems) {
          await fetch('/api/almacen/requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: requestId,
              action: 'adjustQuantity',
              itemId: Number(itemId),
              cantidadAprobada: qty,
            }),
          });
        }
      }

      // Then approve
      const res = await fetch('/api/almacen/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          action: 'approve',
          userId,
          notas: notas || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Solicitud aprobada correctamente');
        onSuccess();
        onOpenChange(false);
        setNotas('');
        setAdjustedQuantities({});
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al aprobar');
      }
    } catch (error) {
      toast.error('Error al aprobar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (itemId: number, qty: number) => {
    setAdjustedQuantities((prev) => ({ ...prev, [itemId]: qty }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Aprobar Solicitud {requestNumber}
          </DialogTitle>
          <DialogDescription>
            Revise y ajuste las cantidades si es necesario antes de aprobar.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Items Table */}
          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Aprobar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-medium">
                        {item.supplierItem?.nombre || `Item #${item.id}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.cantidadSolicitada).toFixed(2)} {item.unidad}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={Number(item.cantidadSolicitada)}
                        onChange={(e) =>
                          updateQuantity(item.id, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 ml-auto text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas de Aprobación (Opcional)</Label>
            <Textarea
              placeholder="Agregar comentarios o instrucciones..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>

          {/* Warning if quantities adjusted */}
          {Object.keys(adjustedQuantities).length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-warning-muted text-warning-muted-foreground rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Se han ajustado {Object.keys(adjustedQuantities).length} cantidades
              </span>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApprove} disabled={loading} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobar Solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// REJECT REQUEST DIALOG
// ============================================
interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number;
  requestNumber: string;
  userId: number;
  onSuccess: () => void;
}

export function RejectRequestDialog({
  open,
  onOpenChange,
  requestId,
  requestNumber,
  userId,
  onSuccess,
}: RejectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState('');

  const handleReject = async () => {
    if (!motivo.trim()) {
      toast.error('Debe indicar el motivo del rechazo');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/almacen/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          action: 'reject',
          userId,
          motivo,
        }),
      });

      if (res.ok) {
        toast.success('Solicitud rechazada');
        onSuccess();
        onOpenChange(false);
        setMotivo('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al rechazar');
      }
    } catch (error) {
      toast.error('Error al rechazar solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Rechazar Solicitud {requestNumber}
          </DialogTitle>
          <DialogDescription>
            Indique el motivo del rechazo. Esta acción notificará al solicitante.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo del Rechazo *</Label>
            <Textarea
              placeholder="Explique por qué se rechaza la solicitud..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              required
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading || !motivo.trim()}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Rechazar Solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// CANCEL REQUEST DIALOG
// ============================================
interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: number;
  requestNumber: string;
  onSuccess: () => void;
}

export function CancelRequestDialog({
  open,
  onOpenChange,
  requestId,
  requestNumber,
  onSuccess,
}: CancelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState('');

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/almacen/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          action: 'cancel',
          motivo: motivo || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Solicitud cancelada');
        onSuccess();
        onOpenChange(false);
        setMotivo('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al cancelar');
      }
    } catch (error) {
      toast.error('Error al cancelar solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-warning-muted-foreground" />
            Cancelar Solicitud {requestNumber}
          </DialogTitle>
          <DialogDescription>
            Esta acción liberará las reservas asociadas. ¿Está seguro?
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo de Cancelación (Opcional)</Label>
            <Textarea
              placeholder="Motivo de la cancelación..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
          </div>

          <div className="p-3 bg-warning-muted text-warning-muted-foreground rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Atención</span>
            </div>
            <p className="mt-1">
              Si hay reservas de stock activas, serán liberadas automáticamente.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
            className="gap-2"
          >
            <Ban className="h-4 w-4" />
            Cancelar Solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// CONFIRM DISPATCH DIALOG
// ============================================
interface ConfirmDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  despachoId: number;
  despachoNumber: string;
  items: Array<{
    id: number;
    supplierItem?: { nombre: string };
    cantidadDespachada: number;
    unidad: string;
    stockAvailable?: number;
  }>;
  warehouseName: string;
  userId: number;
  onSuccess: () => void;
}

export function ConfirmDispatchDialog({
  open,
  onOpenChange,
  despachoId,
  despachoNumber,
  items,
  warehouseName,
  userId,
  onSuccess,
}: ConfirmDispatchDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDispatch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/almacen/despachos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: despachoId,
          action: 'dispatch',
          userId,
        }),
      });

      if (res.ok) {
        toast.success('Despacho confirmado - Stock actualizado');
        onSuccess();
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al despachar');
      }
    } catch (error) {
      toast.error('Error al procesar despacho');
    } finally {
      setLoading(false);
    }
  };

  const hasInsufficientStock = items.some(
    (item) =>
      item.stockAvailable !== undefined &&
      item.cantidadDespachada > item.stockAvailable
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Confirmar Despacho {despachoNumber}
          </DialogTitle>
          <DialogDescription>
            Esta acción generará movimientos de stock y actualizará el inventario.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Warehouse info */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Depósito: <strong>{warehouseName}</strong></span>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">A Despachar</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const insufficient =
                    item.stockAvailable !== undefined &&
                    item.cantidadDespachada > item.stockAvailable;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">
                          {item.supplierItem?.nombre || `Item #${item.id}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(item.cantidadDespachada).toFixed(2)} {item.unidad}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.stockAvailable !== undefined
                          ? `${item.stockAvailable.toFixed(2)}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {insufficient ? (
                          <Badge className="bg-destructive/10 text-destructive">
                            Insuficiente
                          </Badge>
                        ) : (
                          <Badge className="bg-success-muted text-success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Warning */}
          {hasInsufficientStock && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Stock Insuficiente</p>
                <p>
                  Algunos items tienen stock insuficiente. El despacho generará
                  stock negativo.
                </p>
              </div>
            </div>
          )}

          <div className="p-3 bg-info-muted text-info-muted-foreground rounded-lg text-sm">
            <p>
              <strong>Al confirmar se realizarán las siguientes acciones:</strong>
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Se descontará el stock del depósito {warehouseName}</li>
              <li>Se generarán los movimientos de stock correspondientes</li>
              <li>Se actualizará el estado del despacho a "Despachado"</li>
            </ul>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDispatch}
            disabled={loading}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            Confirmar Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// CANCEL DISPATCH DIALOG
// ============================================
interface CancelDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  despachoId: number;
  despachoNumber: string;
  onSuccess: () => void;
}

export function CancelDispatchDialog({
  open,
  onOpenChange,
  despachoId,
  despachoNumber,
  onSuccess,
}: CancelDispatchDialogProps) {
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState('');

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/almacen/despachos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: despachoId,
          action: 'cancel',
          motivo: motivo || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Despacho cancelado');
        onSuccess();
        onOpenChange(false);
        setMotivo('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al cancelar');
      }
    } catch (error) {
      toast.error('Error al cancelar despacho');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Cancelar Despacho {despachoNumber}
          </DialogTitle>
          <DialogDescription>
            Esta acción cancelará el despacho. Si ya fue despachado, deberá
            crear una devolución para restaurar el stock.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo de Cancelación (Opcional)</Label>
            <Textarea
              placeholder="Motivo de la cancelación..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={loading}
            className="gap-2"
          >
            <Ban className="h-4 w-4" />
            Cancelar Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
