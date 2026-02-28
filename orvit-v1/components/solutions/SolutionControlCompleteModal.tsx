'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

interface ControlInstance {
  id: number;
  order: number;
  description: string;
  solutionAppliedId: number;
}

interface Props {
  instance: ControlInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Outcome = 'OK' | 'NOK' | 'PARCIAL';

const OUTCOME_OPTIONS: { value: Outcome; label: string; emoji: string }[] = [
  { value: 'OK', label: 'OK — Todo en orden', emoji: '✅' },
  { value: 'PARCIAL', label: 'Parcial — Requiere atención', emoji: '⚠️' },
  { value: 'NOK', label: 'No OK — Requiere intervención', emoji: '❌' },
];

export function SolutionControlCompleteModal({ instance, open, onOpenChange, onSuccess }: Props) {
  const [outcome, setOutcome] = useState<Outcome>('OK');
  const [notes, setNotes] = useState('');
  const [requiresFollowup, setRequiresFollowup] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/solutions-applied/${instance.solutionAppliedId}/controls/${instance.id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome, notes: notes || null, requiresFollowup }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al completar control');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Control #${instance.order} completado`);
      onSuccess();
      onOpenChange(false);
      setNotes('');
      setRequiresFollowup(false);
      setOutcome('OK');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b">
          <DialogTitle className="text-base">
            Completar Control #{instance.order}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">{instance.description}</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Resultado */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Resultado</Label>
            <RadioGroup value={outcome} onValueChange={v => setOutcome(v as Outcome)}>
              {OUTCOME_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`outcome-${opt.value}`} />
                  <Label htmlFor={`outcome-${opt.value}`} className="text-sm cursor-pointer font-normal">
                    {opt.emoji} {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Observaciones</Label>
            <Textarea
              placeholder="Detalle de lo observado…"
              rows={3}
              className="text-sm resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Requiere seguimiento */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="requires-followup"
              checked={requiresFollowup}
              onCheckedChange={v => setRequiresFollowup(!!v)}
            />
            <Label htmlFor="requires-followup" className="text-sm font-normal cursor-pointer">
              Requiere seguimiento adicional
            </Label>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar control
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
