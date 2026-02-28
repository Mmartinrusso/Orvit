import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * MRO (Maintenance, Repair, Operations) Request API
 * Handles procurement requests from maintenance
 */
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const status = searchParams.get('status');
    const workOrderId = searchParams.get('workOrderId');
    const priority = searchParams.get('priority');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const requests = await prisma.$queryRaw`
      SELECT
        mr.*,
        wo.title as "workOrderTitle",
        u.name as "requestedByName",
        ua.name as "approvedByName",
        (
          SELECT json_agg(json_build_object(
            'id', mri.id,
            'itemId', mri."itemId",
            'itemName', t.name,
            'quantityRequested', mri."quantityRequested",
            'quantityApproved', mri."quantityApproved",
            'quantityReceived', mri."quantityReceived",
            'status', mri.status
          ))
          FROM "MRORequestItem" mri
          LEFT JOIN "Tool" t ON mri."itemId" = t.id
          WHERE mri."requestId" = mr.id
        ) as items
      FROM "MRORequest" mr
      LEFT JOIN "WorkOrder" wo ON mr."workOrderId" = wo.id
      LEFT JOIN "User" u ON mr."requestedById" = u.id
      LEFT JOIN "User" ua ON mr."approvedById" = ua.id
      WHERE mr."companyId" = ${companyId}
      ${status ? prisma.$queryRaw`AND mr.status = ${status}` : prisma.$queryRaw``}
      ${workOrderId ? prisma.$queryRaw`AND mr."workOrderId" = ${parseInt(workOrderId)}` : prisma.$queryRaw``}
      ${priority ? prisma.$queryRaw`AND mr.priority = ${priority}` : prisma.$queryRaw``}
      ORDER BY
        CASE mr.priority WHEN 'CRITICAL' THEN 1 WHEN 'URGENT' THEN 2 ELSE 3 END,
        mr."requestedAt" DESC
    `.catch(() => []);

    const summary = {
      total: (requests as any[]).length,
      draft: (requests as any[]).filter((r: any) => r.status === 'DRAFT').length,
      submitted: (requests as any[]).filter((r: any) => r.status === 'SUBMITTED').length,
      approved: (requests as any[]).filter((r: any) => r.status === 'APPROVED').length,
      ordered: (requests as any[]).filter((r: any) => r.status === 'ORDERED').length,
      received: (requests as any[]).filter((r: any) => r.status === 'RECEIVED').length,
      critical: (requests as any[]).filter((r: any) => r.priority === 'CRITICAL').length,
    };

    return NextResponse.json({ requests, summary });
  } catch (error) {
    console.error('Error fetching MRO requests:', error);
    return NextResponse.json(
      { error: 'Error fetching MRO requests' },
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
      workOrderId,
      requestedById,
      priority,
      requiredDate,
      items,
      notes,
    } = body;

    if (!companyId || !requestedById || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'companyId, requestedById, and items required' },
        { status: 400 }
      );
    }

    // Generate request number
    const timestamp = Date.now().toString(36).toUpperCase();
    const requestNumber = `MRO-${new Date().getFullYear()}-${timestamp}`;

    // Create request
    const result = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO "MRORequest" (
        "number", "workOrderId", "requestedById", "requestedAt", "status",
        "priority", "requiredDate", "notes", "companyId"
      ) VALUES (
        ${requestNumber}, ${workOrderId}, ${requestedById}, NOW(), 'DRAFT',
        ${priority || 'NORMAL'}, ${requiredDate ? new Date(requiredDate) : null}, ${notes}, ${companyId}
      )
      RETURNING id
    `;

    const requestId = result[0]?.id;

    // Create items
    for (const item of items) {
      await prisma.$executeRaw`
        INSERT INTO "MRORequestItem" (
          "requestId", "itemId", "quantityRequested", "status", "notes"
        ) VALUES (
          ${requestId}, ${item.itemId}, ${item.quantity}, 'PENDING', ${item.notes}
        )
      `;
    }

    return NextResponse.json({
      success: true,
      requestId,
      requestNumber,
      message: 'Solicitud MRO creada exitosamente',
    });
  } catch (error) {
    console.error('Error creating MRO request:', error);
    return NextResponse.json(
      { error: 'Error creating MRO request' },
      { status: 500 }
    );
  }
}
