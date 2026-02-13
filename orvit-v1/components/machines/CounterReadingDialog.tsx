'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Gauge, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Counter {
  id: number;
  name: string;
  unit: string;
  currentValue: number;
}

interface CounterReadingDialogProps {
  counter: Counter;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CounterReadingDialog({ counter, open, onClose, onSuccess }: CounterReadingDialogProps) {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('MANUAL');

  const numericValue = parseFloat(value);
  const currentValue = Number(counter.currentValue);
  const isValidValue = !isNaN(numericValue) && numericValue >= currentValue;
  const delta = isValidValue ? numericValue - currentValue : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/counters/${counter.id}/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: numericValue, notes, source }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al registrar lectura');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Lectura registrada: ${numericValue.toLocaleString()} ${counter.unit} (+${data.delta})`);
      onSuccess();
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setValue('');
    setNotes('');
    setSource('MANUAL');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidValue) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Registrar Lectura
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Contador</p>
              <p className="font-medium">{counter.name}</p>
              <p className="text-lg">
                Valor actual: <span className="font-bold">{currentValue.toLocaleString()}</span> {counter.unit}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Nueva Lectura *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`Ej: ${(currentValue + 100).toLocaleString()}`}
                  className="flex-1"
                  required
                  min={currentValue}
                />
                <span className="text-sm text-muted-foreground">{counter.unit}</span>
              </div>
              {value && !isValidValue && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  El valor no puede ser menor al actual
                </p>
              )}
              {isValidValue && delta > 0 && (
                <p className="text-sm text-green-600">
                  Incremento: +{delta.toLocaleString()} {counter.unit}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Fuente</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="IOT">IoT / Sensor</SelectItem>
                  <SelectItem value="PLC">PLC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones sobre esta lectura..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValidValue || mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CounterReadingDialog;
