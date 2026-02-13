import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch (error) {
    return null;
  }
}

// GET - Listar pagos de un contrato
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const contractId = parseInt(params.id);
    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el contrato existe y pertenece a la empresa
    const contract = await prisma.serviceContract.findFirst({
      where: { id: contractId, companyId }
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const pagos = await prisma.servicePayment.findMany({
      where: { contractId },
      orderBy: { periodoDesde: 'desc' }
    });

    // Calcular totales
    const totals = pagos.reduce((acc, p) => {
      acc.total += Number(p.monto);
      if (p.estado === 'PENDIENTE') acc.pendiente += Number(p.monto);
      if (p.estado === 'PAGADO') acc.pagado += Number(p.monto);
      if (p.estado === 'VENCIDO') acc.vencido += Number(p.monto);
      return acc;
    }, { total: 0, pendiente: 0, pagado: 0, vencido: 0 });

    return NextResponse.json({ pagos, totals });
  } catch (error) {
    console.error('Error fetching service payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo pago
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const contractId = parseInt(params.id);
    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el contrato existe
    const contract = await prisma.serviceContract.findFirst({
      where: { id: contractId, companyId }
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      periodoDesde,
      periodoHasta,
      monto,
      moneda,
      fechaVencimiento,
      estado,
      fechaPago,
      facturaId,
      notas
    } = body;

    if (!periodoDesde || !periodoHasta || !monto || !fechaVencimiento) {
      return NextResponse.json(
        { error: 'Período, monto y fecha de vencimiento son requeridos' },
        { status: 400 }
      );
    }

    const pago = await prisma.servicePayment.create({
      data: {
        contractId,
        periodoDesde: new Date(periodoDesde),
        periodoHasta: new Date(periodoHasta),
        monto,
        moneda: moneda || contract.moneda,
        fechaVencimiento: new Date(fechaVencimiento),
        estado: estado || 'PENDIENTE',
        fechaPago: fechaPago ? new Date(fechaPago) : null,
        facturaId: facturaId || null,
        notas: notas?.trim() || null,
        companyId
      }
    });

    return NextResponse.json({ pago }, { status: 201 });
  } catch (error) {
    console.error('Error creating service payment:', error);
    return NextResponse.json(
      { error: 'Error al crear pago' },
      { status: 500 }
    );
  }
}
