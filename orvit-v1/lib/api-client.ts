/**
 * Intenta refrescar el access token. Devuelve true si tuvo éxito.
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  // Si ya hay un refresh en curso, esperar ese mismo (evitar múltiples refreshes)
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Función base para requests API (soporta FormData y JSON)
 * Auto-retry: si recibe 401, intenta refresh y reintenta 1 vez.
 */
export async function apiRequest<T = any>(
  url: string,
  init?: RequestInit
): Promise<{ data: T | null; error: { message: string } | null }> {
  const doRequest = async (): Promise<Response> => {
    const isFormData = init?.body instanceof FormData;
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  };

  try {
    let res = await doRequest();

    // Auto-retry en 401: intentar refresh y reintentar
    if (res.status === 401 && !url.includes('/api/auth/')) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await doRequest();
      }
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = json?.error || json?.message || `Error ${res.status}`;
      return { data: null, error: { message: errorMsg } };
    }

    return { data: json, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Error de conexión' } };
  }
}
