'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

interface ApiClientOptions {
  silent?: boolean;
}

interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
}

export function useApiClient(options?: ApiClientOptions) {
  const silent = options?.silent ?? false;

  const request = useCallback(async <T = any>(
    url: string,
    init?: RequestInit
  ): Promise<ApiResponse<T>> => {
    const doFetch = () => fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      ...init,
    });

    try {
      let res = await doFetch();

      // Auto-retry en 401: intentar refresh y reintentar (excepto rutas de auth)
      if (res.status === 401 && !url.includes('/api/auth/')) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            res = await doFetch();
          }
        } catch {
          // Refresh falló, continuar con el 401 original
        }
      }

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = json?.error || json?.message || `Error ${res.status}`;
        if (!silent) {
          toast.error(errorMsg);
        }
        return { data: null, error: errorMsg };
      }

      return { data: json, error: null };
    } catch (err: any) {
      // Detectar error de red (offline, DNS, timeout) vs error de server
      const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
      const errorMsg = isNetworkError
        ? 'Sin conexión. Verificá tu internet e intentá de nuevo.'
        : (err?.message || 'Error de conexión');
      if (!silent) {
        if (isNetworkError) {
          toast.error(errorMsg, { id: 'network-error', duration: 5000 });
        } else {
          toast.error(errorMsg);
        }
      }
      return { data: null, error: errorMsg };
    }
  }, [silent]);

  const get = useCallback(<T = any>(url: string) => {
    return request<T>(url, { method: 'GET' });
  }, [request]);

  const post = useCallback(<T = any>(url: string, body?: any) => {
    return request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }, [request]);

  const put = useCallback(<T = any>(url: string, body?: any) => {
    return request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }, [request]);

  const del = useCallback(<T = any>(url: string) => {
    return request<T>(url, { method: 'DELETE' });
  }, [request]);

  return { get, post, put, del, request };
}
