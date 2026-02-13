/**
 * Input Sanitization Helpers
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Función pura para sanitizar texto con DOMPurify.
 * Elimina HTML/scripts peligrosos, preserva caracteres Unicode (ñ, acentos, símbolos).
 * Usar en endpoints que no pasan por validación Zod.
 */
export function purifyText(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
}

// Sanitized string schema
export const sanitizedString = z.string().transform(val => DOMPurify.sanitize(val));

// Safe HTML (allows basic tags)
export const safeHTML = z.string().transform(val => 
  DOMPurify.sanitize(val, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'] })
);

// SQL-safe string (basic protection)
export const sqlSafeString = z.string().refine(
  val => !/[;'"\\]/.test(val),
  { message: 'Invalid characters detected' }
);

// User-friendly error messages
export const errorMessages: Record<string, string> = {
  AFIP_AUTH_FAILED: 'No se pudo conectar con AFIP. Verifique su certificado.',
  OCR_LOW_CONFIDENCE: 'La calidad de la imagen es baja. Suba un PDF más nítido.',
  INSUFFICIENT_STOCK: 'Stock insuficiente para completar la operación.',
  RATE_LIMIT_EXCEEDED: 'Demasiadas solicitudes. Intente nuevamente en unos minutos.',
  INVALID_INPUT: 'Los datos ingresados no son válidos.',
  UNAUTHORIZED: 'No tiene permisos para realizar esta acción.',
};

export function getUserFriendlyError(code: string, fallback?: string): string {
  return errorMessages[code] || fallback || 'Ocurrió un error inesperado';
}
