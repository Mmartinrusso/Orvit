import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: { select: { companyId: true }, take: 1 },
        ownedCompanies: { select: { id: true }, take: 1 },
      },
    });

    return user;
  } catch {
    return null;
  }
}

function getUserCompanyId(user: any): number | null {
  if (user.ownedCompanies?.length > 0) return user.ownedCompanies[0].id;
  if (user.companies?.length > 0) return user.companies[0].companyId;
  return null;
}

// GET /api/notifications/preferences - Get user notification preferences
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario sin empresa' }, { status: 401 });
    }

    let preferences = await prisma.notificationPreferences.findUnique({
      where: {
        userId_companyId: { userId: user.id, companyId },
      },
    });

    // Return defaults if no preferences exist
    if (!preferences) {
      preferences = {
        id: 0,
        userId: user.id,
        companyId,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        invoiceDueSoon: true,
        invoiceOverdue: true,
        chequeDueSoon: true,
        chequeOverdue: true,
        quoteExpiring: true,
        paymentReceived: true,
        stockAlerts: true,
        taskAlerts: true,
        maintenanceAlerts: true,
        invoiceDaysBefore: 3,
        chequeDaysBefore: 1,
        quoteDaysBefore: 7,
        quietHoursStart: null,
        quietHoursEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('[NotificationPreferences] GET error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/notifications/preferences - Update user notification preferences
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario sin empresa' }, { status: 401 });
    }

    const body = await request.json();

    // Whitelist of allowed fields
    const allowedFields = [
      'emailEnabled', 'pushEnabled', 'inAppEnabled',
      'invoiceDueSoon', 'invoiceOverdue', 'chequeDueSoon', 'chequeOverdue',
      'quoteExpiring', 'paymentReceived', 'stockAlerts', 'taskAlerts', 'maintenanceAlerts',
      'invoiceDaysBefore', 'chequeDaysBefore', 'quoteDaysBefore',
      'quietHoursStart', 'quietHoursEnd',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const preferences = await prisma.notificationPreferences.upsert({
      where: {
        userId_companyId: { userId: user.id, companyId },
      },
      create: {
        userId: user.id,
        companyId,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('[NotificationPreferences] PUT error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
