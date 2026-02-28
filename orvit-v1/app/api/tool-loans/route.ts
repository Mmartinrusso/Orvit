import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tool-loans
 * Get tool loans (Tool Crib)
 */
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const toolId = searchParams.get('toolId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Raw query since table may not exist in Prisma schema yet
    const loans = await prisma.$queryRaw`
      SELECT
        tl.*,
        t."name" as "toolName",
        t."sku" as "toolSku",
        u."name" as "borrowerName",
        u."email" as "borrowerEmail",
        apr."name" as "approverName"
      FROM "ToolLoan" tl
      LEFT JOIN "Tool" t ON tl."toolId" = t."id"
      LEFT JOIN "User" u ON tl."requestedById" = u."id"
      LEFT JOIN "User" apr ON tl."approvedById" = apr."id"
      WHERE tl."companyId" = ${companyId}
      ${userId ? prisma.$queryRaw`AND tl."requestedById" = ${parseInt(userId)}` : prisma.$queryRaw``}
      ${status ? prisma.$queryRaw`AND tl."status" = ${status}` : prisma.$queryRaw``}
      ${toolId ? prisma.$queryRaw`AND tl."toolId" = ${parseInt(toolId)}` : prisma.$queryRaw``}
      ORDER BY tl."requestedAt" DESC
      LIMIT 100
    `;

    // Get summary
    const summary = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE status = 'BORROWED') as "activeBorrows",
        COUNT(*) FILTER (WHERE status = 'REQUESTED') as "pendingRequests",
        COUNT(*) FILTER (WHERE status = 'OVERDUE') as "overdueCount",
        COUNT(*) FILTER (WHERE status = 'RETURNED' AND DATE("returnedAt") = CURRENT_DATE) as "returnedToday"
      FROM "ToolLoan"
      WHERE "companyId" = ${companyId}
    `;

    return NextResponse.json({
      loans,
      summary: (summary as any[])[0] || {},
    });
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json({ loans: [], summary: {}, message: 'Table not yet created' });
    }
    console.error('Error fetching tool loans:', error);
    return NextResponse.json({ error: 'Error fetching tool loans' }, { status: 500 });
  }
}

/**
 * POST /api/tool-loans
 * Request a tool loan
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const {
      companyId,
      toolId,
      requestedById,
      workOrderId,
      purpose,
      expectedReturnAt,
      quantity,
    } = body;

    if (!companyId || !toolId || !requestedById) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await prisma.$executeRaw`
      INSERT INTO "ToolLoan" (
        "companyId", "toolId", "requestedById", "workOrderId",
        "purpose", "expectedReturnAt", "quantity", "status", "requestedAt"
      ) VALUES (
        ${companyId}, ${toolId}, ${requestedById}, ${workOrderId || null},
        ${purpose || null}, ${expectedReturnAt ? new Date(expectedReturnAt) : null},
        ${quantity || 1}, 'REQUESTED', NOW()
      )
    `;

    return NextResponse.json({ success: true, message: 'Loan request created' });
  } catch (error: any) {
    console.error('Error creating tool loan:', error);
    return NextResponse.json({ error: 'Error creating tool loan' }, { status: 500 });
  }
}

/**
 * PATCH /api/tool-loans
 * Update loan status (approve, borrow, return)
 */
export async function PATCH(request: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { loanId, action, userId, returnCondition, notes } = body;

    if (!loanId || !action) {
      return NextResponse.json({ error: 'Loan ID and action required' }, { status: 400 });
    }

    switch (action) {
      case 'APPROVE':
        await prisma.$executeRaw`
          UPDATE "ToolLoan"
          SET "status" = 'APPROVED', "approvedById" = ${userId}, "approvedAt" = NOW()
          WHERE "id" = ${loanId}
        `;
        break;

      case 'BORROW':
        await prisma.$executeRaw`
          UPDATE "ToolLoan"
          SET "status" = 'BORROWED', "borrowedAt" = NOW()
          WHERE "id" = ${loanId}
        `;
        break;

      case 'RETURN':
        await prisma.$executeRaw`
          UPDATE "ToolLoan"
          SET "status" = 'RETURNED',
              "returnedAt" = NOW(),
              "returnedToId" = ${userId || null},
              "returnCondition" = ${returnCondition || 'OK'},
              "notes" = COALESCE("notes", '') || ${notes ? '\n' + notes : ''}
          WHERE "id" = ${loanId}
        `;
        break;

      case 'REJECT':
        await prisma.$executeRaw`
          UPDATE "ToolLoan"
          SET "status" = 'REJECTED', "notes" = ${notes || null}
          WHERE "id" = ${loanId}
        `;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Loan ${action.toLowerCase()}ed` });
  } catch (error: any) {
    console.error('Error updating tool loan:', error);
    return NextResponse.json({ error: 'Error updating tool loan' }, { status: 500 });
  }
}
