/**
 * Company ViewMode Configuration API
 * GET: Get current view config
 * PUT: Update view config (hotkey, PIN, timeout)
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import bcrypt from 'bcryptjs';

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
 * GET /api/company/[companyId]/view-config
 * Returns view mode configuration for the company
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await params;
    const companyIdNum = parseInt(companyId);

    // Verify user has access to this company
    if (auth.companyId !== companyIdNum && auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check role
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await prisma.companyViewConfig.findUnique({
      where: { companyId: companyIdNum },
      select: {
        enabled: true,
        hotkey: true,
        sessionTimeout: true,
        pinHash: true,
        tiposT2: true,
      },
    });

    if (!config) {
      // Return defaults if no config exists
      return NextResponse.json({
        enabled: false,
        hotkey: 'ctrl+shift+t',
        sessionTimeout: 30,
        pinHash: null,
        tiposT2: [],
      });
    }

    return NextResponse.json({
      enabled: config.enabled,
      hotkey: config.hotkey,
      sessionTimeout: config.sessionTimeout,
      pinHash: config.pinHash ? true : null, // Don't expose actual hash
      tiposT2: config.tiposT2 || [],
    });
  } catch (error) {
    console.error('[view-config] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PUT /api/company/[companyId]/view-config
 * Update view mode configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const auth = await getAuthPayload(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await params;
    const companyIdNum = parseInt(companyId);

    // Verify user has access to this company
    if (auth.companyId !== companyIdNum && auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check role
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, hotkey, pin, pinEnabled, sessionTimeout } = body;

    // Prepare update data
    const updateData: any = {
      enabled: enabled ?? true,
      hotkey: hotkey || 'ctrl+shift+t',
      sessionTimeout: sessionTimeout || 30,
    };

    // Handle PIN
    if (pinEnabled === false) {
      // Disable PIN - remove hash
      updateData.pinHash = null;
    } else if (pin && pin.length > 0) {
      // Set new PIN
      updateData.pinHash = await bcrypt.hash(pin, 10);
    }
    // If pinEnabled is true but no new PIN provided, keep existing PIN

    // Upsert config
    const config = await prisma.companyViewConfig.upsert({
      where: { companyId: companyIdNum },
      update: updateData,
      create: {
        companyId: companyIdNum,
        ...updateData,
      },
    });

    return NextResponse.json({
      ok: true,
      enabled: config.enabled,
      hotkey: config.hotkey,
      sessionTimeout: config.sessionTimeout,
      pinEnabled: !!config.pinHash,
    });
  } catch (error) {
    console.error('[view-config] PUT error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
