import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: { select: { companyId: true }, take: 1 },
      },
    });
    return user;
  } catch {
    return null;
  }
}

// GET /api/compras/proveedores/[id]/conceptos
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Sin empresa' }, { status: 400 });

    const supplierId = Number(params.id);
    if (!supplierId || isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const conceptos = await prisma.supplierExpenseConcept.findMany({
      where: { supplierId, companyId },
      orderBy: { orden: 'asc' },
      select: { id: true, descripcion: true, monto: true, orden: true },
    });

    return NextResponse.json(conceptos);
  } catch (error) {
    console.error('Error GET conceptos proveedor:', error);
    return NextResponse.json({ error: 'Error al obtener conceptos' }, { status: 500 });
  }
}

// POST /api/compras/proveedores/[id]/conceptos
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Sin empresa' }, { status: 400 });

    const supplierId = Number(params.id);
    if (!supplierId || isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID de proveedor inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { descripcion, monto, orden } = body;

    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 });
    }

    const concepto = await prisma.supplierExpenseConcept.create({
      data: {
        supplierId,
        companyId,
        descripcion: descripcion.trim(),
        monto: monto != null && monto !== '' ? Number(monto) : null,
        orden: orden ?? 0,
      },
    });

    return NextResponse.json(concepto, { status: 201 });
  } catch (error) {
    console.error('Error POST concepto proveedor:', error);
    return NextResponse.json({ error: 'Error al crear concepto' }, { status: 500 });
  }
}

// PUT /api/compras/proveedores/[id]/conceptos?conceptoId=N
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Sin empresa' }, { status: 400 });

    const conceptoId = Number(new URL(request.url).searchParams.get('conceptoId'));
    if (!conceptoId || isNaN(conceptoId)) {
      return NextResponse.json({ error: 'conceptoId requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { descripcion, monto, orden } = body;

    const concepto = await prisma.supplierExpenseConcept.updateMany({
      where: { id: conceptoId, companyId },
      data: {
        ...(descripcion != null && { descripcion: String(descripcion).trim() }),
        ...(monto !== undefined && { monto: monto != null && monto !== '' ? Number(monto) : null }),
        ...(orden != null && { orden: Number(orden) }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(concepto);
  } catch (error) {
    console.error('Error PUT concepto proveedor:', error);
    return NextResponse.json({ error: 'Error al actualizar concepto' }, { status: 500 });
  }
}

// DELETE /api/compras/proveedores/[id]/conceptos?conceptoId=N
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) return NextResponse.json({ error: 'Sin empresa' }, { status: 400 });

    const conceptoId = Number(new URL(request.url).searchParams.get('conceptoId'));
    if (!conceptoId || isNaN(conceptoId)) {
      return NextResponse.json({ error: 'conceptoId requerido' }, { status: 400 });
    }

    await prisma.supplierExpenseConcept.deleteMany({
      where: { id: conceptoId, companyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error DELETE concepto proveedor:', error);
    return NextResponse.json({ error: 'Error al eliminar concepto' }, { status: 500 });
  }
}
