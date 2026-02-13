import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import {
  calcularProntoPago,
  aplicarProntoPago,
  obtenerFacturasConProntoPago
} from '@/lib/compras/pronto-pago-helper';

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
        name: true,
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

// GET - Listar facturas con pronto pago disponible
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const diasRestantes = searchParams.get('diasRestantes');
    const soloDisponibles = searchParams.get('soloDisponibles') !== 'false';
    const facturaId = searchParams.get('facturaId');

    // Si piden calcular para una factura específica
    if (facturaId) {
      const calculo = await calcularProntoPago(parseInt(facturaId), companyId);
      return NextResponse.json(calculo);
    }

    // Listar facturas con pronto pago
    const resultado = await obtenerFacturasConProntoPago(companyId, {
      page,
      limit,
      diasRestantes: diasRestantes ? parseInt(diasRestantes) : undefined,
      soloDisponibles
    });

    return NextResponse.json({
      data: resultado.data,
      pagination: {
        page,
        limit,
        total: resultado.total,
        totalPages: Math.ceil(resultado.total / limit)
      },
      resumen: {
        disponibleHoy: resultado.disponibleHoy,
        venceEn3Dias: resultado.venceEn3Dias,
        venceEn7Dias: resultado.venceEn7Dias,
        vencidas: resultado.vencidas
      }
    });
  } catch (error) {
    console.error('Error fetching pronto pago:', error);
    return NextResponse.json(
      { error: 'Error al obtener información de pronto pago' },
      { status: 500 }
    );
  }
}

// POST - Aplicar pronto pago a una factura
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { facturaId } = body;

    if (!facturaId) {
      return NextResponse.json({ error: 'facturaId es requerido' }, { status: 400 });
    }

    const resultado = await aplicarProntoPago(parseInt(facturaId), companyId, user.id);

    if (!resultado.success) {
      return NextResponse.json({
        error: resultado.mensaje,
        montoOriginal: resultado.montoFinal
      }, { status: 400 });
    }

    return NextResponse.json({
      message: resultado.mensaje,
      montoDescuento: resultado.montoDescuento,
      montoFinal: resultado.montoFinal
    });
  } catch (error: any) {
    console.error('Error aplicando pronto pago:', error);
    return NextResponse.json(
      { error: error.message || 'Error al aplicar pronto pago' },
      { status: 500 }
    );
  }
}
