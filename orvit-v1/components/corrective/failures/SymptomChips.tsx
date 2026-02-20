'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

interface SymptomChipsProps {
  value: number[];
  onChange: (value: number[]) => void;
  machineId?: number;
  componentId?: number;
}

const commonSymptoms = [
  { id: 1, label: 'Ruido extraño' },
  { id: 2, label: 'Vibración' },
  { id: 3, label: 'Sobrecalentamiento' },
  { id: 4, label: 'Fuga de aceite' },
  { id: 5, label: 'Pérdida de presión' },
  { id: 6, label: 'No arranca' },
  { id: 7, label: 'Se apaga solo' },
  { id: 8, label: 'Humo' },
  { id: 9, label: 'Olor a quemado' },
  { id: 10, label: 'Fuga de agua' },
];

/**
 * Selector de síntomas con chips
 * TODO: Integrar con biblioteca de síntomas (SymptomLibrary)
 */
export function SymptomChips({
  value,
  onChange,
  machineId,
  componentId,
}: SymptomChipsProps) {
  const [customSymptom, setCustomSymptom] = useState('');

  const toggleSymptom = (symptomId: number) => {
    if (value.includes(symptomId)) {
      onChange(value.filter((id) => id !== symptomId));
    } else {
      onChange([...value, symptomId]);
    }
  };

  const addCustomSymptom = () => {
    if (customSymptom.trim()) {
      // TODO: Crear síntoma personalizado y agregarlo
      setCustomSymptom('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Chips de síntomas comunes */}
      <div className="flex flex-wrap gap-2">
        {commonSymptoms.map((symptom) => {
          const isSelected = value.includes(symptom.id);
          return (
            <Badge
              key={symptom.id}
              variant={isSelected ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleSymptom(symptom.id)}
            >
              {symptom.label}
              {isSelected && <X className="ml-1 h-3 w-3" />}
            </Badge>
          );
        })}
      </div>

      {/* Input para síntoma personalizado */}
      <div className="flex gap-2">
        <Input
          placeholder="Otro síntoma..."
          value={customSymptom}
          onChange={(e) => setCustomSymptom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomSymptom();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addCustomSymptom}
          disabled={!customSymptom.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Seleccionados */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} síntoma{value.length > 1 ? 's' : ''} seleccionado
          {value.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
