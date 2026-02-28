import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/escalation
 * Get escalation rules
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const companyId = user!.companyId;

    const rules = await prisma.$queryRaw<any[]>`
      SELECT
        er.*,
        u."name" as "escalateToUserName",
        r."name" as "escalateToRoleName"
      FROM "EscalationRule" er
      LEFT JOIN "User" u ON er."escalateToUserId" = u."id"
      LEFT JOIN "Role" r ON er."escalateToRoleId" = r."id"
      WHERE er."companyId" = ${companyId}
      ORDER BY er."priority" ASC, er."name"
    `;

    return NextResponse.json({ rules });
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json({ rules: [], message: 'Table not yet created' });
    }
    console.error('Error fetching escalation rules:', error);
    return NextResponse.json({ error: 'Error fetching escalation rules' }, { status: 500 });
  }
}

/**
 * POST /api/escalation
 * Create a new escalation rule
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const {
      name,
      description,
      entityType, // WorkOrder, FailureOccurrence
      condition, // JSON: {field, operator, value, timeMinutes}
      escalateToUserId,
      escalateToRoleId,
      notificationChannel, // EMAIL, PUSH, WHATSAPP
      priority,
      isActive,
    } = body;

    const companyId = user!.companyId;

    if (!name || !entityType || !condition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await prisma.$executeRaw`
      INSERT INTO "EscalationRule" (
        "companyId", "name", "description", "entityType", "condition",
        "escalateToUserId", "escalateToRoleId", "notificationChannel",
        "priority", "isActive", "createdAt"
      ) VALUES (
        ${companyId}, ${name}, ${description || null}, ${entityType},
        ${JSON.stringify(condition)}::jsonb, ${escalateToUserId || null},
        ${escalateToRoleId || null}, ${notificationChannel || 'EMAIL'},
        ${priority || 1}, ${isActive !== false}, NOW()
      )
    `;

    return NextResponse.json({ success: true, message: 'Escalation rule created' });
  } catch (error: any) {
    console.error('Error creating escalation rule:', error);
    return NextResponse.json({ error: 'Error creating escalation rule' }, { status: 500 });
  }
}

/**
 * DELETE /api/escalation
 * Delete an escalation rule
 */
export async function DELETE(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const ruleId = parseInt(searchParams.get('ruleId') || '0');

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM "EscalationRule" WHERE "id" = ${ruleId}
    `;

    return NextResponse.json({ success: true, message: 'Rule deleted' });
  } catch (error: any) {
    console.error('Error deleting escalation rule:', error);
    return NextResponse.json({ error: 'Error deleting escalation rule' }, { status: 500 });
  }
}
