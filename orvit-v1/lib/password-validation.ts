import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEsEsPackage from '@zxcvbn-ts/language-es-es';

// ─── Configurar zxcvbn con diccionarios en español ──────────────────────────

const options = {
  translations: zxcvbnEsEsPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEsEsPackage.dictionary,
  },
};

zxcvbnOptions.setOptions(options);

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export interface PasswordStrengthResult {
  /** Cumple todos los requisitos mínimos */
  valid: boolean;
  /** Score de zxcvbn (0-4): 0=muy débil, 1=débil, 2=regular, 3=buena, 4=muy fuerte */
  score: 0 | 1 | 2 | 3 | 4;
  /** Etiqueta legible del score */
  scoreLabel: string;
  /** Requisitos individuales */
  requirements: PasswordRequirements;
  /** Mensajes de error para requisitos no cumplidos */
  errors: string[];
  /** Sugerencias de mejora de zxcvbn */
  suggestions: string[];
  /** Advertencia de zxcvbn (ej: "Esta es una contraseña muy común") */
  warning: string;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const SCORE_LABELS: Record<number, string> = {
  0: 'Muy débil',
  1: 'Débil',
  2: 'Regular',
  3: 'Buena',
  4: 'Muy fuerte',
};

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Valida la fortaleza de una contraseña.
 * Verifica requisitos mínimos (longitud, mayúscula, minúscula, número)
 * y usa zxcvbn para scoring avanzado y detección de contraseñas comunes.
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements: PasswordRequirements = {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const errors: string[] = [];

  if (!requirements.minLength) {
    errors.push(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (!requirements.hasUppercase) {
    errors.push('La contraseña debe tener al menos una mayúscula');
  }
  if (!requirements.hasLowercase) {
    errors.push('La contraseña debe tener al menos una minúscula');
  }
  if (!requirements.hasNumber) {
    errors.push('La contraseña debe tener al menos un número');
  }

  const valid = errors.length === 0;

  // Solo correr zxcvbn si la contraseña tiene contenido
  if (password.length === 0) {
    return {
      valid: false,
      score: 0,
      scoreLabel: SCORE_LABELS[0],
      requirements,
      errors,
      suggestions: [],
      warning: '',
    };
  }

  const result = zxcvbn(password);

  return {
    valid,
    score: result.score as 0 | 1 | 2 | 3 | 4,
    scoreLabel: SCORE_LABELS[result.score],
    requirements,
    errors,
    suggestions: result.feedback.suggestions || [],
    warning: result.feedback.warning || '',
  };
}

// ─── Helpers para uso en API routes ─────────────────────────────────────────

/**
 * Validación simple para API routes (sin scoring).
 * Retorna { valid, errors } compatible con validatePasswordPolicy de portal/auth.ts.
 */
export function validatePasswordPolicy(password: string): {
  valid: boolean;
  errors: string[];
} {
  const result = validatePasswordStrength(password);
  return { valid: result.valid, errors: result.errors };
}

export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH };
