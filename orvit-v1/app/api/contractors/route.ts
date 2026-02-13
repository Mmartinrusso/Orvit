import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List contractors
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    const contractors = await prisma.$queryRaw`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM "ContractorService" cs WHERE cs."contractorId" = c.id) as service_count,
        (SELECT COUNT(*) FROM "ContractorQualification" cq WHERE cq."contractorId" = c.id AND cq.status = 'VALID') as valid_qualifications,
        (SELECT COUNT(*) FROM "ContractorAssignment" ca WHERE ca."contractorId" = c.id) as assignment_count
      FROM "Contractor" c
      WHERE c."companyId" = ${companyId}
      ${status && status !== 'all' ? prisma.$queryRaw`AND c.status = ${status}` : prisma.$queryRaw``}
      ${type && type !== 'all' ? prisma.$queryRaw`AND c.type = ${type}` : prisma.$queryRaw``}
      ORDER BY c.name
    `;

    // Get summary
    const summary = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'INACTIVE') as inactive,
        COUNT(*) FILTER (WHERE status = 'SUSPENDED') as suspended,
        COUNT(*) as total
      FROM "Contractor"
      WHERE "companyId" = ${companyId}
    `;

    return NextResponse.json({ contractors, summary: (summary as any[])[0] || {} });
  } catch (error) {
    console.error('Error fetching contractors:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create contractor
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyId,
      name,
      legalName,
      taxId,
      contactName,
      contactEmail,
      contactPhone,
      address,
      website,
      type,
      notes,
    } = body;

    if (!companyId || !name) {
      return NextResponse.json(
        { error: 'companyId y name son requeridos' },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO "Contractor" (
        "companyId", "name", "legalName", "taxId", "contactName",
        "contactEmail", "contactPhone", "address", "website", "type",
        "notes", "status", "createdAt", "updatedAt"
      ) VALUES (
        ${companyId}, ${name}, ${legalName || null}, ${taxId || null}, ${contactName || null},
        ${contactEmail || null}, ${contactPhone || null}, ${address || null}, ${website || null}, ${type || 'MAINTENANCE'},
        ${notes || null}, 'ACTIVE', NOW(), NOW()
      )
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: result[0]?.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating contractor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
