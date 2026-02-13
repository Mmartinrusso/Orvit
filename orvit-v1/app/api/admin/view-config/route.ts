/**
 * ViewMode Configuration API
 * For SUPERADMIN/ADMIN to configure company ViewMode settings
 *
 * GET: Get current config
 * POST: Create/Update config (set hotkey and PIN)
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { canConfigureViewMode } from '@/lib/view-mode';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Roles that can configure ViewMode
const ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE'];

interface AuthPayload {
  userId: number;
  companyId: number;
  role: string;
}

async function getAuthPayload(request: NextRequest): Promise<AuthPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
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
 * GET /api/admin/view-config
 * Get current ViewMode configuration for company
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission - ALLOWED_ROLES can always configure
    const canConfigure = await canConfigureViewMode(auth.userId, auth.companyId);
    if (!canConfigure && !ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const config = await prisma.companyViewConfig.findUnique({
      where: { companyId: auth.companyId },
      select: {
        id: true,
        enabled: true,
        hotkey: true,
        pinHash: true,
        sessionTimeout: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform response: don't expose pinHash, just indicate if PIN is set
    const responseConfig = config ? {
      id: config.id,
      enabled: config.enabled,
      hotkey: config.hotkey,
      hasPin: !!config.pinHash,
      sessionTimeout: config.sessionTimeout,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    } : {
      enabled: false,
      hotkey: null,
      hasPin: false,
      sessionTimeout: 30,
    };

    return NextResponse.json({ config: responseConfig });
  } catch (error) {
    console.error('[view-config] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/view-config
 * Create or update ViewMode configuration
 * Body: { enabled: boolean, hotkey: string, pin: string, sessionTimeout: number }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission (ALLOWED_ROLES always allowed)
    const canConfigure = await canConfigureViewMode(auth.userId, auth.companyId);
    if (!canConfigure && !ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, hotkey, pin, clearPin, sessionTimeout } = body;

    // Validate hotkey format (e.g., "ctrl+shift+v")
    if (hotkey && typeof hotkey === 'string') {
      const validPattern = /^(ctrl\+)?(alt\+)?(shift\+)?[a-z0-9]$/i;
      if (!validPattern.test(hotkey.toLowerCase())) {
        return NextResponse.json(
          { error: 'Invalid hotkey format. Use format like: ctrl+shift+v' },
          { status: 400 }
        );
      }
    }

    // Validate PIN (min 2 characters) - only if provided and not clearing
    if (pin && !clearPin && (typeof pin !== 'string' || pin.length < 2)) {
      return NextResponse.json(
        { error: 'PIN must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Hash PIN if provided, or set to null if clearing
    let pinHash: string | null | undefined;
    if (clearPin) {
      pinHash = null; // Explicitly clear the PIN
    } else if (pin) {
      pinHash = await bcrypt.hash(pin, 10);
    }

    // Upsert config
    const config = await prisma.companyViewConfig.upsert({
      where: { companyId: auth.companyId },
      create: {
        companyId: auth.companyId,
        enabled: enabled ?? false,
        hotkey: hotkey?.toLowerCase() || null,
        pinHash: pinHash ?? null,
        sessionTimeout: sessionTimeout || 30,
      },
      update: {
        enabled: enabled ?? undefined,
        hotkey: hotkey !== undefined ? (hotkey?.toLowerCase() || null) : undefined,
        // Handle PIN: set to null if clearing, hash if new value, undefined to keep existing
        ...(clearPin ? { pinHash: null } : pinHash !== undefined ? { pinHash } : {}),
        sessionTimeout: sessionTimeout ?? undefined,
      },
      select: {
        id: true,
        enabled: true,
        hotkey: true,
        sessionTimeout: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      config,
      message: enabled
        ? `ViewMode habilitado. Hotkey: ${hotkey || 'no configurado'}`
        : 'ViewMode deshabilitado',
    });
  } catch (error) {
    console.error('[view-config] POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/view-config
 * Disable ViewMode for company
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission - ALLOWED_ROLES can always configure
    const canConfigure = await canConfigureViewMode(auth.userId, auth.companyId);
    if (!canConfigure && !ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    await prisma.companyViewConfig.updateMany({
      where: { companyId: auth.companyId },
      data: { enabled: false },
    });

    return NextResponse.json({ success: true, message: 'ViewMode deshabilitado' });
  } catch (error) {
    console.error('[view-config] DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
