import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const entityType = searchParams.get('entityType');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Get all machines with QR codes for the company
    const machines = await prisma.machine.findMany({
      where: {
        companyId,
        qrCode: { not: null },
      },
      select: {
        id: true,
        name: true,
        qrCode: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to QR code format
    const qrCodes = machines.map(m => ({
      id: m.id,
      code: m.qrCode,
      entityType: 'MACHINE',
      entityId: m.id,
      entityName: m.name,
      createdAt: m.createdAt.toISOString(),
      scannedCount: 0, // This would come from a scan tracking table
      lastScannedAt: null,
    }));

    // Filter by entity type if specified
    const filteredCodes = entityType && entityType !== 'all'
      ? qrCodes.filter(qr => qr.entityType === entityType)
      : qrCodes;

    // Get summary counts
    const summary = {
      total: qrCodes.length,
      machines: qrCodes.filter(qr => qr.entityType === 'MACHINE').length,
      tools: qrCodes.filter(qr => qr.entityType === 'TOOL').length,
      components: qrCodes.filter(qr => qr.entityType === 'COMPONENT').length,
      scansToday: 0, // This would come from a scan tracking table
    };

    return NextResponse.json({
      qrCodes: filteredCodes,
      summary,
    });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    return NextResponse.json(
      { error: 'Error fetching QR codes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, entityType, entityId } = body;

    if (!companyId || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Company ID, entity type, and entity ID are required' },
        { status: 400 }
      );
    }

    // Generate unique QR code
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const qrCode = `QR-${entityType.substring(0, 3).toUpperCase()}-${timestamp}-${random}`.toUpperCase();

    // Update the entity with the QR code based on entity type
    if (entityType === 'MACHINE') {
      await prisma.machine.update({
        where: { id: entityId },
        data: { qrCode },
      });
    }

    return NextResponse.json({
      success: true,
      qrCode,
      entityType,
      entityId,
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json(
      { error: 'Error generating QR code' },
      { status: 500 }
    );
  }
}
