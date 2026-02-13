/**
 * Función base para requests API (soporta FormData y JSON)
 */
export async function apiRequest<T = any>(
  url: string,
  init?: RequestInit
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const isFormData = init?.body instanceof FormData;

    const res = await fetch(url, {
      ...init,
      headers: {
        // No setear Content-Type para FormData (el browser lo pone con boundary)
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

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
