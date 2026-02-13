import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import {
  obtenerComprasRapidasPendientes,
  regularizarCompraRapida,
  QUICK_PURCHASE_REASONS
} from '@/lib/compras/quick-purchase-helper';

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

// GET - Listar compras rápidas pendientes de regularización
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
    const soloVencidas = searchParams.get('soloVencidas') === 'true';
    const usuarioId = searchParams.get('usuarioId');
    const getRazones = searchParams.get('razones') === 'true';

    // Si piden las razones, retornar solo eso
    if (getRazones) {
      return NextResponse.json({ razones: QUICK_PURCHASE_REASONS });
    }

    const resultado = await obtenerComprasRapidasPendientes(companyId, {
      page,
      limit,
      soloVencidas,
      usuarioId: usuarioId ? parseInt(usuarioId) : undefined
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
        total: resultado.total,
        vencidas: resultado.vencidas,
        porVencer: resultado.porVencer
      }
    });
  } catch (error) {
    console.error('Error fetching compras rápidas:', error);
    return NextResponse.json(
      { error: 'Error al obtener compras rápidas' },
      { status: 500 }
    );
  }
}

// POST - Regularizar una compra rápida
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
    const { goodsReceiptId, purchaseOrderId, notas } = body;

    if (!goodsReceiptId) {
      return NextResponse.json({ error: 'goodsReceiptId es requerido' }, { status: 400 });
    }

    const resultado = await regularizarCompraRapida(
      parseInt(goodsReceiptId),
      companyId,
      user.id,
      {
        purchaseOrderId: purchaseOrderId ? parseInt(purchaseOrderId) : undefined,
        notas
      }
    );

    return NextResponse.json({
      message: 'Compra rápida regularizada correctamente',
      recepcion: resultado
    });
  } catch (error: any) {
    console.error('Error regularizando compra rápida:', error);
    return NextResponse.json(
      { error: error.message || 'Error al regularizar compra rápida' },
      { status: 500 }
    );
  }
}
