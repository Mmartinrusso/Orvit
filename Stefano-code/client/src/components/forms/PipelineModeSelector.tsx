import type { PipelineMode } from '@/api';
import { cn } from '@/utils';

const modes: Array<{
  value: PipelineMode;
  label: string;
  description: string;
}> = [
  {
    value: 'simple',
    label: 'Simple',
    description: 'Un solo agente hace todo en una sesion (mas directo)',
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'La IA decide el mejor modo segun la complejidad',
  },
  {
    value: 'fast',
    label: 'Fast',
    description: 'Rapido para cambios simples (2 etapas)',
  },
  {
    value: 'full',
    label: 'Full',
    description: 'Pipeline completo con verificacion y tests (7 etapas)',
  },
];

interface PipelineModeSelectorProps {
  value: PipelineMode;
  onChange: (value: PipelineMode) => void;
  disabled?: boolean;
}

export function PipelineModeSelector({ value, onChange, disabled }: PipelineModeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
        Modo de Pipeline
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(mode.value)}
            className={cn(
              'p-3 rounded-lg border text-left transition-all',
              'hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              value === mode.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                : 'border-gray-200 bg-white dark:border-dark-border dark:bg-dark-surface'
            )}
          >
            <div className="font-medium text-sm text-gray-900 dark:text-dark-text">{mode.label}</div>
            <div className="text-xs text-gray-500 dark:text-dark-text-secondary mt-1">{mode.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
