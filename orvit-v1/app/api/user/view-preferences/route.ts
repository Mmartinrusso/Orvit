/**
 * ViewMode Preferences API
 * Generic endpoint for view mode configuration and toggle
 * POST: Toggle mode (verify PIN)
 * GET: Get current config (if has permission)
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { MODE } from '@/lib/view-mode/types';
import { setViewModeCookie, clearViewModeCookie, getViewModeFromCookie } from '@/lib/view-mode/cookie';
import { canActivateExtended, isPinRequired, verifyViewModePin, logViewModeAction } from '@/lib/view-mode/permissions';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Roles that can use ViewMode (fallback if granular permissions not configured)
const ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'Administrador'];

interface AuthPayload {
  userId: number;
  companyId: number;
  role: string;
}

async function getAuthPayload(request: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return {
      userId: payload.userId as number,
      companyId: payload.companyId as number,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/user/view-preferences
 * Returns view mode config if user has permission
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SUPERADMIN doesn't have companyId
    if (!auth.companyId || auth.role === 'SUPERADMIN') {
      return NextResponse.json({ enabled: false });
    }

    // Check if user has permission
    let hasPermission = false;
    try {
      hasPermission = await canActivateExtended(auth.userId, auth.companyId);
    } catch {
      // Silent fallback
    }
    const hasRoleAccess = ALLOWED_ROLES.includes(auth.role);

    if (!hasPermission && !hasRoleAccess) {
      return NextResponse.json({ enabled: false });
    }

    // Get company config
    const config = await prisma.companyViewConfig.findUnique({
      where: { companyId: auth.companyId },
      select: {
        enabled: true,
        hotkey: true,
        sessionTimeout: true,
        tiposT2: true,
      },
    });

    if (!config || !config.enabled) {
      return NextResponse.json({ enabled: false });
    }

    // Get current mode from cookie
    const { mode } = await getViewModeFromCookie();

    // Check if PIN is required
    const pinReq = await isPinRequired(auth.companyId);

    return NextResponse.json({
      enabled: true,
      hk: config.hotkey,
      t: config.sessionTimeout,
      m: mode,
      p: pinReq,
      ct: config.tiposT2 || [],  // Configured types (renamed from t2)
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/user/view-preferences
 * Toggle view mode after PIN verification
 * Body: { c: string } where c is the PIN code
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SUPERADMIN doesn't have companyId - ViewMode not applicable
    if (!auth.companyId || auth.role === 'SUPERADMIN') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Check permission - ALLOWED_ROLES always have access as fallback
    const hasPermission = await canActivateExtended(auth.userId, auth.companyId);
    const hasRoleAccess = ALLOWED_ROLES.includes(auth.role);
    if (!hasPermission && !hasRoleAccess) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const pin = body.c as string | undefined;  // 'c' for code (obfuscated) - optional if no PIN configured
    const targetMode = body.m as string;  // 'm' for mode: 'S' or 'E'

    // Get IP and user agent for logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Verify PIN (returns true if no PIN is configured for the company)
    const pinValid = await verifyViewModePin(auth.companyId, pin);

    if (!pinValid) {
      // Log failed attempt
      await logViewModeAction(
        auth.userId,
        auth.companyId,
        'FAILED_PIN',
        ipAddress,
        userAgent
      );
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // Get company config for session timeout
    const config = await prisma.companyViewConfig.findUnique({
      where: { companyId: auth.companyId },
      select: { sessionTimeout: true },
    });

    const timeout = config?.sessionTimeout || 30;

    // Determine new mode
    const newMode = targetMode === MODE.EXTENDED ? MODE.EXTENDED : MODE.STANDARD;

    if (newMode === MODE.EXTENDED) {
      // Activate extended mode
      await setViewModeCookie(auth.userId, auth.companyId, MODE.EXTENDED, timeout);
      await logViewModeAction(
        auth.userId,
        auth.companyId,
        'ACTIVATE',
        ipAddress,
        userAgent
      );
    } else {
      // Deactivate (clear cookie)
      await clearViewModeCookie();
      await logViewModeAction(
        auth.userId,
        auth.companyId,
        'DEACTIVATE',
        ipAddress,
        userAgent
      );
    }

    return NextResponse.json({ ok: true, m: newMode });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/view-preferences
 * Clear view mode cookie (revert to Standard)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SUPERADMIN doesn't have companyId - ViewMode not applicable
    if (!auth.companyId || auth.role === 'SUPERADMIN') {
      return NextResponse.json({ ok: true }); // Just return ok
    }

    // Get IP and user agent for logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Clear cookie
    await clearViewModeCookie();

    // Log deactivation
    await logViewModeAction(
      auth.userId,
      auth.companyId,
      'DEACTIVATE',
      ipAddress,
      userAgent
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
