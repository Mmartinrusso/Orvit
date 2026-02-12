import { Sparkles, X, Check, Edit3 } from 'lucide-react';
import { Button, Badge } from '@/components/common';
import { cn } from '@/utils';

interface PromptEnhancementPreviewProps {
  original: string;
  enhanced: string;
  improvements: string[];
  complexity: 'simple' | 'medium' | 'complex';
  onAccept: (prompt: string) => void;
  onEdit: (prompt: string) => void;
  onDismiss: () => void;
}

const complexityColors = {
  simple: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  complex: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

export function PromptEnhancementPreview({
  original,
  enhanced,
  improvements,
  complexity,
  onAccept,
  onEdit,
  onDismiss,
}: PromptEnhancementPreviewProps) {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/5 p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Prompt Mejorado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', complexityColors[complexity])}>
            {complexity}
          </span>
          <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Original - dimmed */}
      <div className="text-xs text-slate-400 dark:text-slate-500 line-through">
        {original}
      </div>

      {/* Enhanced */}
      <div className="text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-dark-surface rounded-md p-3 border border-slate-200 dark:border-slate-700">
        {enhanced}
      </div>

      {/* Improvements */}
      {improvements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {improvements.map((imp, i) => (
            <Badge key={i} variant="neutral" className="text-xs">
              {imp}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={() => onAccept(enhanced)}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Ejecutar mejorado
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onEdit(enhanced)}>
          <Edit3 className="h-3.5 w-3.5 mr-1" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAccept(original)}>
          Usar original
        </Button>
      </div>
    </div>
  );
}
