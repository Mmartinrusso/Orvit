import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const status = searchParams.get('status');
    const entityType = searchParams.get('entityType');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Query warranties using raw SQL since table might not be in Prisma yet
    const warranties = await prisma.$queryRaw`
      SELECT
        w.*,
        m.name as "machineName"
      FROM "Warranty" w
      LEFT JOIN "Machine" m ON w."entityType" = 'MACHINE' AND w."entityId" = m.id
      WHERE w."companyId" = ${companyId}
      ${status ? prisma.$queryRaw`AND w."isActive" = ${status === 'active'}` : prisma.$queryRaw``}
      ${entityType ? prisma.$queryRaw`AND w."entityType" = ${entityType}` : prisma.$queryRaw``}
      ORDER BY w."endDate" ASC
    `.catch(() => []);

    // Get summary
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const summary = {
      total: (warranties as any[]).length,
      active: (warranties as any[]).filter((w: any) => w.isActive && new Date(w.endDate) > now).length,
      expiringSoon: (warranties as any[]).filter((w: any) => {
        const end = new Date(w.endDate);
        return w.isActive && end > now && end <= thirtyDaysFromNow;
      }).length,
      expired: (warranties as any[]).filter((w: any) => new Date(w.endDate) <= now).length,
    };

    return NextResponse.json({ warranties, summary });
  } catch (error) {
    console.error('Error fetching warranties:', error);
    return NextResponse.json(
      { error: 'Error fetching warranties' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const {
      companyId,
      entityType,
      entityId,
      supplierName,
      startDate,
      endDate,
      coverageType,
      conditions,
      documentUrl,
    } = body;

    if (!companyId || !entityType || !entityId || !supplierName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const warranty = await prisma.$executeRaw`
      INSERT INTO "Warranty" (
        "entityType", "entityId", "supplierName", "startDate", "endDate",
        "coverageType", "conditions", "documentUrl", "isActive", "companyId"
      ) VALUES (
        ${entityType}, ${entityId}, ${supplierName}, ${new Date(startDate)}, ${new Date(endDate)},
        ${coverageType || 'FULL'}, ${conditions}, ${documentUrl}, true, ${companyId}
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Garantía creada exitosamente',
    });
  } catch (error) {
    console.error('Error creating warranty:', error);
    return NextResponse.json(
      { error: 'Error creating warranty' },
      { status: 500 }
    );
  }
}
