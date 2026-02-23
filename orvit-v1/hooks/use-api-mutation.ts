'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────

interface UseApiMutationOptions<TData, TVariables> {
  /** Función que ejecuta el fetch (POST/PUT/DELETE). */
  mutationFn: (vars: TVariables) => Promise<TData>;
  /** Query keys a invalidar en onSuccess. */
  invalidateKeys?: QueryKey[];
  /** Toast de éxito. `null` = sin toast. Default: 'Operación exitosa'. */
  successMessage?: string | null;
  /** Toast de error fallback si el error no trae mensaje. */
  errorMessage?: string;
  /** Callback adicional en onSuccess. */
  onSuccess?: (data: TData, vars: TVariables) => void;
  /** Callback adicional en onError. */
  onError?: (error: Error, vars: TVariables) => void;
  /** Optimistic update: actualiza cache antes de que el server responda. */
  optimistic?: {
    queryKey: QueryKey;
    updater: (old: unknown, vars: TVariables) => unknown;
  };
}

// ── Hook ──────────────────────────────────────────────

export function useApiMutation<TData = unknown, TVariables = void>(
  options: UseApiMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, { previousData?: unknown }>({
    mutationFn: options.mutationFn,

    onMutate: options.optimistic
      ? async (vars) => {
          // Cancel running queries to avoid overwriting optimistic update
          await queryClient.cancelQueries({ queryKey: options.optimistic!.queryKey });
          const previousData = queryClient.getQueryData(options.optimistic!.queryKey);
          queryClient.setQueryData(
            options.optimistic!.queryKey,
            (old: unknown) => options.optimistic!.updater(old, vars)
          );
          return { previousData };
        }
      : undefined,

    onSuccess: (data, vars) => {
      // Toast
      if (options.successMessage !== null) {
        toast.success(options.successMessage ?? 'Operación exitosa');
      }
      // Invalidate
      if (options.invalidateKeys?.length) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
      // Custom callback
      options.onSuccess?.(data, vars);
    },

    onError: (error, vars, context) => {
      // Rollback optimistic update
      if (options.optimistic && context?.previousData !== undefined) {
        queryClient.setQueryData(options.optimistic.queryKey, context.previousData);
      }
      // Toast
      toast.error(error.message || options.errorMessage || 'Error en la operación');
      // Custom callback
      options.onError?.(error, vars);
    },
  });
}

// ── Helper para mutationFn con fetch ──────────────────

interface FetchMutationOptions {
  url: string | ((vars: Record<string, unknown>) => string);
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export function createFetchMutation<TData = unknown, TVariables = Record<string, unknown>>(
  opts: FetchMutationOptions
): (vars: TVariables) => Promise<TData> {
  return async (vars: TVariables) => {
    const url = typeof opts.url === 'function' ? opts.url(vars as Record<string, unknown>) : opts.url;
    const method = opts.method ?? 'POST';

    const fetchOpts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    // DELETE con body vacío no necesita body
    if (method !== 'DELETE' || (vars && Object.keys(vars as Record<string, unknown>).length > 0)) {
      fetchOpts.body = JSON.stringify(vars);
    }

    const response = await fetch(url, fetchOpts);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
    }

    return response.json();
  };
}
