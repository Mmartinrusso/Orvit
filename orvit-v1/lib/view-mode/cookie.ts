/**
 * ViewMode Cookie Management
 * Signs and verifies JWT cookies for view mode state
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ViewModeCookiePayload, ViewMode, MODE } from './types';
import { JWT_SECRET } from '@/lib/auth';

// Cookie name (obfuscated)
export const VM_COOKIE_NAME = '_vm';

// Cookie max age (matches session timeout, default 30 min)
const DEFAULT_MAX_AGE = 30 * 60; // 30 minutes in seconds

// Pre-encoded secret for JWT operations
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

/**
 * Get JWT secret as Uint8Array
 */
function getSecret(): Uint8Array {
  return JWT_SECRET_KEY;
}

/**
 * Create signed JWT cookie for view mode
 */
export async function createViewModeCookie(
  userId: number,
  companyId: number,
  mode: ViewMode,
  timeoutMinutes: number = 30
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (timeoutMinutes * 60);

  const payload: ViewModeCookiePayload = {
    m: mode,
    u: userId,
    c: companyId,
    a: now,
    x: expiresAt,
  };

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode view mode cookie
 * Returns null if invalid, expired, or tampered
 */
export async function verifyViewModeCookie(
  token: string
): Promise<ViewModeCookiePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const data = payload as unknown as ViewModeCookiePayload;

    // Verify required fields exist
    if (!data.m || !data.u || !data.c || !data.x) {
      return null;
    }

    // Verify not expired
    const now = Math.floor(Date.now() / 1000);
    if (data.x < now) {
      return null;
    }

    // Verify mode is valid
    if (data.m !== MODE.STANDARD && data.m !== MODE.EXTENDED) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Set view mode cookie in response
 */
export async function setViewModeCookie(
  userId: number,
  companyId: number,
  mode: ViewMode,
  timeoutMinutes: number = 30
): Promise<void> {
  const token = await createViewModeCookie(userId, companyId, mode, timeoutMinutes);
  const cookieStore = await cookies();

  cookieStore.set(VM_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: timeoutMinutes * 60,
    path: '/',
  });
}

/**
 * Clear view mode cookie (revert to Standard)
 */
export async function clearViewModeCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(VM_COOKIE_NAME);
}

/**
 * Get current view mode from cookie (server component/action)
 * Returns Standard if no valid cookie
 */
export async function getViewModeFromCookie(): Promise<{
  mode: ViewMode;
  payload: ViewModeCookiePayload | null;
}> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(VM_COOKIE_NAME)?.value;

    if (!token) {
      return { mode: MODE.STANDARD, payload: null };
    }

    const payload = await verifyViewModeCookie(token);

    if (!payload) {
      return { mode: MODE.STANDARD, payload: null };
    }

    return { mode: payload.m, payload };
  } catch {
    return { mode: MODE.STANDARD, payload: null };
  }
}
