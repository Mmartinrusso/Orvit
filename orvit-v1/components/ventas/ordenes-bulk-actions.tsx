'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkActionsProps {
  selectedIds: number[];
  onActionComplete: () => void;
}

export function OrdenesBulkActions({ selectedIds, onActionComplete }: BulkActionsProps) {
  const { toast } = useToast();
  const [action, setAction] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Form data para diferentes acciones
  const [sellerId, setSellerId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const handleActionSelect = (value: string) => {
    setAction(value);
    setShowDialog(true);
    setResult(null);
  };

  const executeBulkAction = async () => {
    setLoading(true);
    try {
      let body: any = {
        operation: action,
        ids: selectedIds,
      };

      // Agregar datos específicos según la acción
      switch (action) {
        case 'CHANGE_SELLER':
          body.sellerId = parseInt(sellerId);
          break;
        case 'UPDATE_DELIVERY_DATE':
          body.fechaEntregaEstimada = deliveryDate;
          break;
        case 'UPDATE_NOTES':
          body.notas = notes;
          break;
        case 'CANCEL':
          body.motivo = cancelReason;
          break;
      }

      const response = await fetch('/api/ventas/ordenes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Error en operación masiva');
      }

      const data = await response.json();
      setResult(data.results);

      toast({
        title: 'Operación completada',
        description: `${data.results.successCount} de ${data.results.totalProcessed} órdenes procesadas exitosamente`,
      });

      if (data.results.successCount > 0) {
        onActionComplete();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error en operación masiva',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setShowDialog(false);
    setAction('');
    setSellerId('');
    setDeliveryDate('');
    setNotes('');
    setCancelReason('');
    setResult(null);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={action} onValueChange={handleActionSelect}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Acción masiva..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CONFIRM">Confirmar todas</SelectItem>
            <SelectItem value="CANCEL">Cancelar todas</SelectItem>
            <SelectItem value="CHANGE_SELLER">Cambiar vendedor</SelectItem>
            <SelectItem value="UPDATE_DELIVERY_DATE">Actualizar fecha entrega</SelectItem>
            <SelectItem value="UPDATE_NOTES">Actualizar notas</SelectItem>
            <SelectItem value="DELETE">Eliminar</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {selectedIds.length} órdenes seleccionadas
        </span>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Operación Masiva</DialogTitle>
            <DialogDescription>
              Esta acción afectará a {selectedIds.length} órdenes seleccionadas.
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="space-y-4">
              {action === 'CONFIRM' && (
                <Alert>
                  <AlertDescription>
                    Se confirmarán {selectedIds.length} órdenes. Se validará stock y crédito para cada una.
                  </AlertDescription>
                </Alert>
              )}

              {action === 'CANCEL' && (
                <div className="space-y-2">
                  <Label>Motivo de Cancelación *</Label>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ingrese el motivo de cancelación..."
                    rows={3}
                  />
                </div>
              )}

              {action === 'CHANGE_SELLER' && (
                <div className="space-y-2">
                  <Label>Nuevo Vendedor *</Label>
                  <Input
                    type="number"
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                    placeholder="ID del vendedor"
                  />
                </div>
              )}

              {action === 'UPDATE_DELIVERY_DATE' && (
                <div className="space-y-2">
                  <Label>Nueva Fecha de Entrega *</Label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              )}

              {action === 'UPDATE_NOTES' && (
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas para agregar a todas las órdenes..."
                    rows={3}
                  />
                </div>
              )}

              {action === 'DELETE' && (
                <Alert variant="destructive">
                  <AlertDescription>
                    ⚠️ Solo se eliminarán las órdenes en estado BORRADOR sin documentos asociados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Alert className={result.failedCount > 0 ? 'border-amber-500' : 'border-green-500'}>
                <AlertDescription>
                  <p className="font-semibold mb-2">Resultado de la operación:</p>
                  <p>✓ Exitosas: {result.successCount}</p>
                  <p>✗ Fallidas: {result.failedCount}</p>
                  <p>Total: {result.totalProcessed}</p>
                </AlertDescription>
              </Alert>

              {result.failed && result.failed.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Errores:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.failed.map((f: any, idx: number) => (
                      <p key={idx} className="text-xs text-red-600">
                        Orden {f.id}: {f.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetDialog} disabled={loading}>
              {result ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!result && (
              <Button onClick={executeBulkAction} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ejecutar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
