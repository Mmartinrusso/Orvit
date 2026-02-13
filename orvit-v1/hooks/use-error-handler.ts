'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';

/**
 * Normaliza cualquier tipo de error a un mensaje legible.
 * Soporta: Error objects, strings, Axios errors, fetch responses, objetos con message.
 */
function normalizeError(error: unknown): { message: string; original: unknown } {
  // String directo
  if (typeof error === 'string') {
    return { message: error, original: error };
  }

  // Error estándar o subclases
  if (error instanceof Error) {
    // Axios-style errors con response.data
    const axiosError = error as any;
    if (axiosError.response?.data?.message) {
      return { message: axiosError.response.data.message, original: error };
    }
    if (axiosError.response?.data?.error) {
      return { message: axiosError.response.data.error, original: error };
    }
    return { message: error.message, original: error };
  }

  // Objetos con propiedad message o error
  if (error && typeof error === 'object') {
    const obj = error as Record<string, any>;
    if (typeof obj.message === 'string') {
      return { message: obj.message, original: error };
    }
    if (typeof obj.error === 'string') {
      return { message: obj.error, original: error };
    }
  }

  return { message: 'Error desconocido', original: error };
}

interface UseErrorHandlerOptions {
  /** Si es true, no muestra toast (útil para errores silenciosos) */
  silent?: boolean;
}

/**
 * Hook centralizado para manejo de errores.
 * Normaliza el error, muestra toast, loguea en consola y reporta a Sentry.
 *
 * @example
 * const handleError = useErrorHandler();
 * try { ... } catch (e) { handleError(e, 'Error al crear orden'); }
 */
export function useErrorHandler(options?: UseErrorHandlerOptions) {
  const silent = options?.silent ?? false;

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const { message, original } = normalizeError(error);
      const displayMessage = context || message;

      // 1. Console log para debugging
      console.error(`[ErrorHandler] ${context || 'Error'}:`, original);

      // 2. Toast para feedback visual al usuario
      if (!silent) {
        toast.error(displayMessage);
      }

      // 3. Sentry para tracking en producción
      Sentry.captureException(original instanceof Error ? original : new Error(message), {
        extra: {
          context,
          normalizedMessage: message,
        },
      });
    },
    [silent]
  );

  return handleError;
}
