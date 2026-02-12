import type { ModelType } from '@/api';
import { Select, type SelectOption } from '@/components/common';

const modelOptions: SelectOption[] = [
  { value: 'sonnet', label: 'Sonnet (Recomendado)' },
  { value: 'opus', label: 'Opus (Mas potente)' },
  { value: 'haiku', label: 'Haiku (Mas rapido)' },
];

interface ModelSelectorProps {
  value: ModelType;
  onChange: (value: ModelType) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <Select
      label="Modelo"
      options={modelOptions}
      value={value}
      onChange={(e) => onChange(e.target.value as ModelType)}
      disabled={disabled}
    />
  );
}
