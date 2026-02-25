import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserCompanyId } from '@/lib/admin-auth';

// GET /api/companies/[id]/machine-tab-order
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
    }

    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userCompanyId = getUserCompanyId(user);
    if (userCompanyId !== companyId && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso a esta empresa' }, { status: 403 });
    }

    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { sidebarConfig: true },
    });

    const config = settings?.sidebarConfig as Record<string, unknown> | null;
    const order = (config?.machineTabOrder as string[]) ?? [];

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[machine-tab-order GET]', error);
    return NextResponse.json({ error: 'Error al obtener orden de tabs' }, { status: 500 });
  }
}

// PUT /api/companies/[id]/machine-tab-order
// Body: { order: string[] }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
    }

    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userCompanyId = getUserCompanyId(user);
    if (userCompanyId !== companyId && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso a esta empresa' }, { status: 403 });
    }

    const body = await request.json();
    const order: string[] = body.order;

    if (!Array.isArray(order) || !order.every(k => typeof k === 'string')) {
      return NextResponse.json({ error: 'order debe ser un array de strings' }, { status: 400 });
    }

    const currentSettings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { sidebarConfig: true },
    });
    const currentConfig = (currentSettings?.sidebarConfig as Record<string, unknown>) ?? {};
    const updatedConfig = { ...currentConfig, machineTabOrder: order };

    await prisma.companySettings.upsert({
      where: { companyId },
      update: { sidebarConfig: updatedConfig },
      create: { companyId, sidebarConfig: updatedConfig },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[machine-tab-order PUT]', error);
    return NextResponse.json({ error: 'Error al guardar orden de tabs' }, { status: 500 });
  }
}
