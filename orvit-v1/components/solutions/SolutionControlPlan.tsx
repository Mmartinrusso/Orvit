'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ControlStep {
  order: number;
  delayMinutes: number;
  description: string;
}

interface SolutionControlPlanProps {
  value: ControlStep[];
  onChange: (steps: ControlStep[]) => void;
  className?: string;
  inherited?: boolean;
  /** si viene de sourceSolution, cuántos pasos tenía */
  inheritedFromId?: number;
}

const TIME_UNIT_OPTIONS = [
  { label: 'minutos', value: 'min', multiplier: 1 },
  { label: 'horas', value: 'hs', multiplier: 60 },
  { label: 'días', value: 'dias', multiplier: 1440 },
];

/** Devuelve la mejor unidad y valor para mostrar delayMinutes */
function toDisplay(delayMinutes: number): { value: number; unit: string } {
  if (delayMinutes % 1440 === 0) return { value: delayMinutes / 1440, unit: 'dias' };
  if (delayMinutes % 60 === 0) return { value: delayMinutes / 60, unit: 'hs' };
  return { value: delayMinutes, unit: 'min' };
}

export function SolutionControlPlan({
  value,
  onChange,
  className,
  inherited = false,
  inheritedFromId,
}: SolutionControlPlanProps) {
  // Local UI state: time value + unit per row (derived from value)
  const [timeInputs, setTimeInputs] = useState<{ value: string; unit: string }[]>(() =>
    value.map(s => {
      const d = toDisplay(s.delayMinutes);
      return { value: String(d.value), unit: d.unit };
    })
  );

  const addStep = () => {
    const newOrder = value.length + 1;
    onChange([...value, { order: newOrder, delayMinutes: 60, description: '' }]);
    setTimeInputs([...timeInputs, { value: '1', unit: 'hs' }]);
  };

  const removeStep = (idx: number) => {
    const updated = value
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, order: i + 1 }));
    onChange(updated);
    setTimeInputs(timeInputs.filter((_, i) => i !== idx));
  };

  const updateDescription = (idx: number, description: string) => {
    const updated = value.map((s, i) => (i === idx ? { ...s, description } : s));
    onChange(updated);
  };

  const updateTime = (idx: number, rawValue: string, unit: string) => {
    const nums = parseFloat(rawValue) || 0;
    const multiplier = TIME_UNIT_OPTIONS.find(o => o.value === unit)?.multiplier ?? 1;
    const delayMinutes = Math.round(nums * multiplier);
    const updated = value.map((s, i) => (i === idx ? { ...s, delayMinutes } : s));
    onChange(updated);
    const newInputs = timeInputs.map((t, i) =>
      i === idx ? { value: rawValue, unit } : t
    );
    setTimeInputs(newInputs);
  };

  const clearPlan = () => {
    onChange([]);
    setTimeInputs([]);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Plan de control de seguimiento</span>
          {value.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {value.length} {value.length === 1 ? 'paso' : 'pasos'}
            </Badge>
          )}
          {inherited && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Heredado de sol. #{inheritedFromId}
            </Badge>
          )}
        </div>
        {inherited && value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-7"
            onClick={clearPlan}
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Steps */}
      {value.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-8">#</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-32">Esperar</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Descripción</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {value.map((step, idx) => {
                const ti = timeInputs[idx] ?? { value: '1', unit: 'hs' };
                return (
                  <tr key={idx} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-muted-foreground font-medium">{step.order}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={1}
                          className="h-7 w-16 text-xs px-2"
                          value={ti.value}
                          onChange={e => updateTime(idx, e.target.value, ti.unit)}
                        />
                        <Select
                          value={ti.unit}
                          onValueChange={unit => updateTime(idx, ti.value, unit)}
                        >
                          <SelectTrigger className="h-7 w-20 text-xs px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_UNIT_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        className="h-7 text-xs"
                        placeholder={`Ej. Verificar ajuste del bulón`}
                        value={step.description}
                        onChange={e => updateDescription(idx, e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeStep(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add step */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={addStep}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar paso de control
      </Button>
    </div>
  );
}
