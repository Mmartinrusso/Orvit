'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Gauge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Counter {
  id: number;
  name: string;
  unit: string;
  currentValue: number;
  source: string;
}

interface CounterFormDialogProps {
  machineId: number;
  counter?: Counter | null;
  open: boolean;
  onClose: () => void;
}

const COMMON_UNITS = [
  { value: 'horas', label: 'Horas' },
  { value: 'ciclos', label: 'Ciclos' },
  { value: 'km', label: 'Kilómetros' },
  { value: 'unidades', label: 'Unidades producidas' },
  { value: 'm3', label: 'Metros cúbicos' },
  { value: 'ton', label: 'Toneladas' },
  { value: 'litros', label: 'Litros' },
  { value: 'arranques', label: 'Arranques' },
];

export function CounterFormDialog({ machineId, counter, open, onClose }: CounterFormDialogProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [initialValue, setInitialValue] = useState('0');
  const [source, setSource] = useState('MANUAL');

  const queryClient = useQueryClient();
  const isEditing = !!counter;

  useEffect(() => {
    if (counter) {
      setName(counter.name);
      const predefined = COMMON_UNITS.find(u => u.value === counter.unit);
      if (predefined) {
        setUnit(counter.unit);
        setCustomUnit('');
      } else {
        setUnit('custom');
        setCustomUnit(counter.unit);
      }
      setSource(counter.source);
    } else {
      setName('');
      setUnit('');
      setCustomUnit('');
      setInitialValue('0');
      setSource('MANUAL');
    }
  }, [counter, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const finalUnit = unit === 'custom' ? customUnit : unit;
      const res = await fetch(`/api/machines/${machineId}/counters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          unit: finalUnit,
          initialValue: parseFloat(initialValue) || 0,
          source,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear contador');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contador creado');
      queryClient.invalidateQueries({ queryKey: ['machine-counters', machineId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const finalUnit = unit === 'custom' ? customUnit : unit;
      const res = await fetch(`/api/counters/${counter!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, unit: finalUnit, source }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar contador');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contador actualizado');
      queryClient.invalidateQueries({ queryKey: ['machine-counters', machineId] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUnit = unit === 'custom' ? customUnit : unit;
    if (!name || !finalUnit) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            {isEditing ? 'Editar Contador' : 'Nuevo Contador'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Contador *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Horas de operación, Ciclos de prensa..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unidad de Medida *</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Otra (personalizada)</SelectItem>
                </SelectContent>
              </Select>
              {unit === 'custom' && (
                <Input
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Ingrese la unidad"
                  className="mt-2"
                  required
                />
              )}
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="initialValue">Valor Inicial</Label>
                <Input
                  id="initialValue"
                  type="number"
                  step="0.01"
                  value={initialValue}
                  onChange={(e) => setInitialValue(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Valor actual del contador (ej: horómetro actual de la máquina)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="source">Fuente de Datos</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual (registro manual)</SelectItem>
                  <SelectItem value="IOT">IoT / Sensor automático</SelectItem>
                  <SelectItem value="PLC">PLC / Sistema SCADA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CounterFormDialog;
