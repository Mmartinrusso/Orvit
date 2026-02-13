'use client';

import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validatePasswordStrength, type PasswordStrengthResult } from '@/lib/password-validation';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-red-500',
  1: 'bg-red-400',
  2: 'bg-amber-500',
  3: 'bg-green-400',
  4: 'bg-green-600',
};

const SCORE_TEXT_COLORS: Record<number, string> = {
  0: 'text-red-600',
  1: 'text-red-500',
  2: 'text-amber-600',
  3: 'text-green-500',
  4: 'text-green-700',
};

function RequirementLine({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs', met ? 'text-green-600' : 'text-muted-foreground')}>
      {met ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      <span>{label}</span>
    </div>
  );
}

export default function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const result: PasswordStrengthResult = useMemo(
    () => validatePasswordStrength(password),
    [password]
  );

  if (!password) return null;

  return (
    <div className={cn('space-y-2 mt-2', className)}>
      {/* Barra de fortaleza */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Fortaleza</span>
          <span className={cn('text-xs font-medium', SCORE_TEXT_COLORS[result.score])}>
            {result.scoreLabel}
          </span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all',
                i <= result.score ? SCORE_COLORS[result.score] : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Requisitos */}
      <div className="grid grid-cols-2 gap-1">
        <RequirementLine met={result.requirements.minLength} label="Mínimo 8 caracteres" />
        <RequirementLine met={result.requirements.hasUppercase} label="Una mayúscula" />
        <RequirementLine met={result.requirements.hasLowercase} label="Una minúscula" />
        <RequirementLine met={result.requirements.hasNumber} label="Un número" />
      </div>

      {/* Warning de zxcvbn */}
      {result.warning && (
        <p className="text-xs text-amber-600">{result.warning}</p>
      )}

      {/* Sugerencias de zxcvbn */}
      {result.suggestions.length > 0 && (
        <div className="space-y-0.5">
          {result.suggestions.slice(0, 2).map((suggestion, i) => (
            <p key={i} className="text-xs text-muted-foreground">{suggestion}</p>
          ))}
        </div>
      )}
    </div>
  );
}
