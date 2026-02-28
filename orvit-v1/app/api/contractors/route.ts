import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: List contractors
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('contractors.view');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const statusCondition = status && status !== 'all'
      ? Prisma.sql`AND c.status = ${status}`
      : Prisma.sql``;
    const typeCondition = type && type !== 'all'
      ? Prisma.sql`AND c.type = ${type}`
      : Prisma.sql``;

    const contractors = await prisma.$queryRaw`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM "ContractorService" cs WHERE cs."contractorId" = c.id) as service_count,
        (SELECT COUNT(*) FROM "ContractorQualification" cq WHERE cq."contractorId" = c.id AND cq.status = 'VALID') as valid_qualifications,
        (SELECT COUNT(*) FROM "ContractorAssignment" ca WHERE ca."contractorId" = c.id) as assignment_count
      FROM "Contractor" c
      WHERE c."companyId" = ${companyId}
      ${statusCondition}
      ${typeCondition}
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
    const { user, error } = await requirePermission('contractors.create');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
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

    if (!name) {
      return NextResponse.json(
        { error: 'name es requerido' },
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

// PUT: Update contractor (edit, assign, rate)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Determine required permission based on action
    let permissionName = 'contractors.edit';
    if (action === 'assign') permissionName = 'contractors.assign';
    else if (action === 'rate') permissionName = 'contractors.rate';

    const { user, error } = await requirePermission(permissionName);
    if (error) return error;

    const companyId = user!.companyId;

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Contractor" WHERE id = ${id} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Contratista no encontrado' }, { status: 404 });
    }

    if (action === 'assign') {
      const { workOrderId, serviceType, startDate, endDate, notes: assignNotes } = body;

      if (!workOrderId) {
        return NextResponse.json({ error: 'workOrderId es requerido para asignar' }, { status: 400 });
      }

      await prisma.$executeRaw`
        INSERT INTO "ContractorAssignment" (
          "contractorId", "workOrderId", "serviceType", "startDate", "endDate",
          "assignedById", "notes", "createdAt"
        ) VALUES (
          ${id}, ${workOrderId}, ${serviceType || null}, ${startDate ? new Date(startDate) : new Date()},
          ${endDate ? new Date(endDate) : null}, ${user!.id}, ${assignNotes || null}, NOW()
        )
      `;

      return NextResponse.json({ success: true });
    }

    if (action === 'rate') {
      const { rating, ratingNotes } = body;

      if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'rating debe ser entre 1 y 5' }, { status: 400 });
      }

      await prisma.$executeRaw`
        UPDATE "Contractor" SET
          rating = ${rating},
          "ratingNotes" = ${ratingNotes || null},
          "ratedById" = ${user!.id},
          "ratedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = ${id} AND "companyId" = ${companyId}
      `;

      return NextResponse.json({ success: true });
    }

    // Default: edit
    const {
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
      status,
    } = body;

    await prisma.$executeRaw`
      UPDATE "Contractor" SET
        name = COALESCE(${name || null}, name),
        "legalName" = ${legalName || null},
        "taxId" = ${taxId || null},
        "contactName" = ${contactName || null},
        "contactEmail" = ${contactEmail || null},
        "contactPhone" = ${contactPhone || null},
        address = ${address || null},
        website = ${website || null},
        type = COALESCE(${type || null}, type),
        notes = ${notes || null},
        status = COALESCE(${status || null}, status),
        "updatedAt" = NOW()
      WHERE id = ${id} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating contractor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Delete contractor
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('contractors.delete');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Contractor" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Contratista no encontrado' }, { status: 404 });
    }

    // Delete related records
    await prisma.$executeRaw`
      DELETE FROM "ContractorAssignment" WHERE "contractorId" = ${parseInt(id)}
    `;
    await prisma.$executeRaw`
      DELETE FROM "ContractorQualification" WHERE "contractorId" = ${parseInt(id)}
    `;
    await prisma.$executeRaw`
      DELETE FROM "ContractorService" WHERE "contractorId" = ${parseInt(id)}
    `;
    // Delete the contractor
    await prisma.$executeRaw`
      DELETE FROM "Contractor" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contractor:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
