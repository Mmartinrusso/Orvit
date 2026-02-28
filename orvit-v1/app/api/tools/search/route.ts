import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/tools/search?q=texto&itemType=SPARE_PART&limit=20
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.view');
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const itemType = searchParams.get('itemType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const where: any = { companyId };
    if (itemType) where.itemType = itemType;
    if (q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { code: { contains: q.trim(), mode: 'insensitive' } },
        { category: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    const tools = await prisma.tool.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        itemType: true,
        stockQuantity: true,
        minStockLevel: true,
        category: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json(tools);
  } catch (error) {
    console.error('[GET /api/tools/search]', error);
    return NextResponse.json({ error: 'Error al buscar tools' }, { status: 500 });
  }
}
