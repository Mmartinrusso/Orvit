/**
 * POST /api/loads/optimize
 *
 * Optimiza la distribución de una carga usando GPT-4o-mini.
 * Recibe items y especificaciones del camión, devuelve posiciones óptimas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { optimizeLoadWithAI, AIOptimizationResult } from '@/lib/openai';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const legacyToken = cookieStore.get('token')?.value;
  const token = accessToken || legacyToken;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

interface OptimizeRequestBody {
  items: Array<{
    productName: string;
    quantity: number;
    length?: number | null;
    weight?: number | null;
  }>;
  truckId: number;
  preferences?: {
    prioritize?: 'weight_balance' | 'space_utilization' | 'delivery_order';
  };
}

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await getUserFromToken();

    const body: OptimizeRequestBody = await request.json();
    const { items, truckId, preferences } = body;

    // Validaciones básicas
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un item para optimizar' },
        { status: 400 }
      );
    }

    if (!truckId) {
      return NextResponse.json(
        { error: 'Se requiere el ID del camión' },
        { status: 400 }
      );
    }

    // Obtener datos del camión
    const truck = await prisma.truck.findFirst({
      where: {
        id: truckId,
        companyId,
        isActive: true,
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Camión no encontrado o no pertenece a esta empresa' },
        { status: 404 }
      );
    }

    // Preparar items con datos completos
    const loadItems = items.map((item, index) => ({
      productId: `item-${index}`,
      productName: item.productName,
      quantity: item.quantity,
      length: item.length ?? 0,
      weight: item.weight ?? 0,
      position: index,
    }));

    // Preparar datos del camión
    const truckData = {
      id: truck.id,
      name: truck.name,
      type: truck.type as 'CHASIS' | 'EQUIPO' | 'SEMI',
      length: truck.length,
      chasisLength: truck.chasisLength,
      acopladoLength: truck.acopladoLength,
      chasisWeight: truck.chasisWeight,
      acopladoWeight: truck.acopladoWeight,
      maxWeight: truck.maxWeight,
    };

    console.log(`[optimize] Optimizando carga con ${loadItems.length} items para camión ${truck.name}`);

    // Llamar a la IA
    const result = await optimizeLoadWithAI({
      items: loadItems,
      truck: truckData,
      preferences,
    });

    console.log(`[optimize] Resultado: balance=${result.stats.balanceScore}%, utilización=${result.stats.utilizationPercent}%`);

    return NextResponse.json({
      success: true,
      data: result,
      truck: {
        id: truck.id,
        name: truck.name,
        type: truck.type,
      },
    });
  } catch (error) {
    console.error('[optimize] Error optimizando carga:', error);

    if (error instanceof Error) {
      if (error.message === 'Invalid token' || error.message === 'No token provided') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }

      if (error.message.includes('OPENAI_API_KEY')) {
        return NextResponse.json(
          { error: 'Servicio de IA no configurado. Contacte al administrador.' },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error al optimizar la carga' },
      { status: 500 }
    );
  }
}
