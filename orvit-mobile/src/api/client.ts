import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/lib/storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// In-memory token cache to avoid 100-300ms SecureStore reads per API call
let _cachedToken: string | null = null;
let _cachedTokenTime = 0;
const TOKEN_CACHE_TTL = 10 * 60_000; // 10 minutes

async function getCachedToken(): Promise<string | null> {
  if (_cachedToken && Date.now() - _cachedTokenTime < TOKEN_CACHE_TTL) {
    return _cachedToken;
  }
  const token = await getAccessToken();
  if (token) {
    _cachedToken = token;
    _cachedTokenTime = Date.now();
  }
  return token;
}

export function clearTokenCache() {
  _cachedToken = null;
  _cachedTokenTime = 0;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return false;

    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      await setTokens(data.accessToken, data.refreshToken);
      _cachedToken = data.accessToken;
      _cachedTokenTime = Date.now();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getCachedToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
    _cachedToken = null; // Invalidate cache
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await refreshPromise;
    if (refreshed) {
      const newToken = await getCachedToken();
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } else {
      clearTokenCache();
      await clearTokens();
      throw new AuthError("Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || "Request failed", body);
  }

  return res.json();
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export { API_URL };
