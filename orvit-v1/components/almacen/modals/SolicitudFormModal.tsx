'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useSolicitudesMutations, useWarehouses } from '../hooks';
import {
  MaterialRequestTypes,
  MaterialRequestTypeLabels,
  Priorities,
  PriorityLabels,
} from '@/lib/almacen/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SolicitudFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal para crear/editar solicitud de material
 */
export function SolicitudFormModal({ open, onClose, onSuccess }: SolicitudFormModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useSolicitudesMutations();

  const [formData, setFormData] = useState({
    tipo: 'INTERNO' as const,
    urgencia: 'MEDIUM' as const,
    warehouseId: '',
    motivo: '',
    notas: '',
    fechaNecesidad: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({ title: 'Error', description: 'Usuario no identificado', variant: 'destructive' });
      return;
    }

    try {
      await create.mutateAsync({
        tipo: formData.tipo,
        urgencia: formData.urgencia,
        warehouseId: formData.warehouseId ? Number(formData.warehouseId) : undefined,
        motivo: formData.motivo || undefined,
        notas: formData.notas || undefined,
        fechaNecesidad: formData.fechaNecesidad || undefined,
        solicitanteId: user.id,
        items: [], // Items se agregan después
      });

      toast({ title: 'Solicitud creada correctamente' });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear solicitud',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Material</DialogTitle>
          <DialogDescription>
            Crea una nueva solicitud de material para despacho desde almacén
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Solicitud</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, tipo: v as any }))}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MaterialRequestTypes.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {MaterialRequestTypeLabels[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgencia */}
            <div className="space-y-2">
              <Label htmlFor="urgencia">Urgencia</Label>
              <Select
                value={formData.urgencia}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, urgencia: v as any }))}
              >
                <SelectTrigger id="urgencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PriorityLabels[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Depósito */}
            <div className="space-y-2">
              <Label htmlFor="warehouse">Depósito</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, warehouseId: v }))}
              >
                <SelectTrigger id="warehouse">
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id.toString()}>
                      {w.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha necesidad */}
            <div className="space-y-2">
              <Label htmlFor="fechaNecesidad">Fecha de Necesidad</Label>
              <Input
                id="fechaNecesidad"
                type="date"
                value={formData.fechaNecesidad}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fechaNecesidad: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Input
              id="motivo"
              value={formData.motivo}
              onChange={(e) => setFormData((prev) => ({ ...prev, motivo: e.target.value }))}
              placeholder="Motivo de la solicitud"
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas adicionales</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Solicitud
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
