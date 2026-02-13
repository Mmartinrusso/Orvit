'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';

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
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
        ...init,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = json?.error || json?.message || `Error ${res.status}`;
        if (!silent) {
          toast.error(errorMsg);
        }
        Sentry.captureException(new Error(errorMsg), {
          extra: { url, status: res.status, method: init?.method },
        });
        return { data: null, error: errorMsg };
      }

      return { data: json, error: null };
    } catch (err: any) {
      const errorMsg = err?.message || 'Error de conexión';
      if (!silent) {
        toast.error(errorMsg);
      }
      Sentry.captureException(err, {
        extra: { url, method: init?.method },
      });
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
