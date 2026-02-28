// GET /api/certifications — Company-wide certifications view
// Used by CertificationTracker when no userId is provided

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('certifications.view');
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const expiringSoon = searchParams.get('expiringSoon') === 'true';
    const status = searchParams.get('status');

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const where: Record<string, unknown> = { companyId };

    if (status) {
      where.status = status;
    }

    if (expiringSoon) {
      where.expiresAt = { gte: now, lte: thirtyDaysFromNow };
      where.status = 'ACTIVE';
    }

    const rawCertifications = await prisma.userCertification.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ expiresAt: 'asc' }, { status: 'asc' }],
    });

    // Map schema fields to shape expected by CertificationTracker
    const certifications = rawCertifications.map((c) => ({
      id: c.id,
      certificationName: c.name,
      certificationNumber: c.code ?? undefined,
      issuingOrganization: c.issuedBy,
      issuedAt: c.issuedAt?.toISOString() ?? undefined,
      expiresAt: c.expiresAt?.toISOString() ?? undefined,
      documentUrl: c.documentUrl ?? undefined,
      // Normalize PENDING_RENEWAL → PENDING for the UI
      status: (c.status === 'PENDING_RENEWAL' ? 'PENDING' : c.status) as
        | 'ACTIVE'
        | 'EXPIRED'
        | 'PENDING'
        | 'REVOKED',
      skill: {
        id: 0,
        name: c.category || 'General',
        category: c.category ?? undefined,
      },
      user: c.user,
    }));

    // Summary
    const allForSummary =
      expiringSoon || status
        ? await prisma.userCertification.findMany({
            where: { companyId },
            select: { status: true, expiresAt: true },
          })
        : rawCertifications.map((c) => ({ status: c.status, expiresAt: c.expiresAt }));

    const summary = {
      total: allForSummary.length,
      active: allForSummary.filter((c) => c.status === 'ACTIVE').length,
      expired: allForSummary.filter((c) => c.status === 'EXPIRED').length,
      pending: allForSummary.filter(
        (c) => c.status === 'PENDING_RENEWAL'
      ).length,
      revoked: allForSummary.filter((c) => c.status === 'REVOKED').length,
      expiringSoon: allForSummary.filter(
        (c) =>
          c.status === 'ACTIVE' &&
          c.expiresAt != null &&
          c.expiresAt <= thirtyDaysFromNow &&
          c.expiresAt > now
      ).length,
    };

    return NextResponse.json({ certifications, summary });
  } catch (error) {
    console.error('Error fetching company certifications:', error);
    return NextResponse.json(
      { error: 'Error al obtener certificaciones' },
      { status: 500 }
    );
  }
}
