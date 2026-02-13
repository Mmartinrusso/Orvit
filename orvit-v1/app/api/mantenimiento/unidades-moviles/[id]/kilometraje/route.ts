/**
 * API: /api/mantenimiento/unidades-moviles/[id]/kilometraje
 *
 * GET - Obtener historial de kilometraje de una unidad
 * POST - Registrar nueva lectura de kilometraje
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

// Schema de validación para nueva lectura
const createKilometrajeSchema = z.object({
  kilometraje: z.number().int().min(0, 'Kilometraje debe ser positivo'),
  tipo: z.enum(['MANUAL', 'MANTENIMIENTO', 'COMBUSTIBLE', 'VIAJE', 'INSPECCION']).default('MANUAL'),
  notas: z.string().optional(),
  fecha: z.string().datetime().optional(),
  actualizarUnidad: z.boolean().default(true) // Si actualizar el kilometraje de la unidad
});

// Schema para query params del GET
const listKilometrajeSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  tipo: z.enum(['MANUAL', 'MANTENIMIENTO', 'COMBUSTIBLE', 'VIAJE', 'INSPECCION']).optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional()
});

export const dynamic = 'force-dynamic';

// GET - Obtener historial de kilometraje
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const unidadId = parseInt(params.id);
    if (isNaN(unidadId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear query params
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validation = listKilometrajeSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { limit, offset, tipo, desde, hasta } = validation.data;

    // 3. Verificar que la unidad existe
    const unidad = await prisma.unidadMovil.findUnique({
      where: { id: unidadId },
      select: { id: true, nombre: true, kilometraje: true, companyId: true }
    });

    if (!unidad) {
      return NextResponse.json(
        { error: 'Unidad móvil no encontrada' },
        { status: 404 }
      );
    }

    // 4. Construir filtro WHERE
    const where: any = { unidadMovilId: unidadId };

    if (tipo) {
      where.tipo = tipo;
    }

    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }

    // 5. Obtener historial con paginación
    const [logs, totalCount] = await Promise.all([
      prisma.kilometrajeLog.findMany({
        where,
        include: {
          registradoPor: {
            select: { id: true, name: true }
          }
        },
        orderBy: { fecha: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.kilometrajeLog.count({ where })
    ]);

    // 6. Calcular estadísticas básicas
    const stats = logs.length > 1 ? {
      kmRecorridos: logs[0].kilometraje - logs[logs.length - 1].kilometraje,
      promedioEntreLecturas: Math.round(
        (logs[0].kilometraje - logs[logs.length - 1].kilometraje) / (logs.length - 1)
      )
    } : null;

    return NextResponse.json({
      success: true,
      unidad: {
        id: unidad.id,
        nombre: unidad.nombre,
        kilometrajeActual: unidad.kilometraje
      },
      logs: logs.map(log => ({
        id: log.id,
        kilometraje: log.kilometraje,
        fecha: log.fecha,
        tipo: log.tipo,
        notas: log.notas,
        registradoPor: log.registradoPor ? {
          id: log.registradoPor.id,
          name: log.registradoPor.name
        } : null
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      stats
    });

  } catch (error) {
    console.error('❌ Error en GET /api/mantenimiento/unidades-moviles/[id]/kilometraje:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Registrar nueva lectura de kilometraje
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const unidadId = parseInt(params.id);
    if (isNaN(unidadId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear y validar body
    const body = await request.json();
    const validation = createKilometrajeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 3. Verificar que la unidad existe y obtener kilometraje actual
    const unidad = await prisma.unidadMovil.findUnique({
      where: { id: unidadId },
      select: { id: true, nombre: true, kilometraje: true, companyId: true }
    });

    if (!unidad) {
      return NextResponse.json(
        { error: 'Unidad móvil no encontrada' },
        { status: 404 }
      );
    }

    // 4. Validar que el nuevo kilometraje sea mayor o igual al actual
    if (data.kilometraje < unidad.kilometraje) {
      return NextResponse.json(
        {
          error: `El kilometraje (${data.kilometraje}) no puede ser menor al actual (${unidad.kilometraje})`,
          currentKilometraje: unidad.kilometraje
        },
        { status: 400 }
      );
    }

    // 5. Usar transacción para atomicidad
    const result = await prisma.$transaction(async (tx) => {
      // Crear el registro de kilometraje
      const log = await tx.kilometrajeLog.create({
        data: {
          unidadMovilId: unidadId,
          kilometraje: data.kilometraje,
          fecha: data.fecha ? new Date(data.fecha) : new Date(),
          tipo: data.tipo,
          notas: data.notas,
          registradoPorId: payload.userId as number,
          companyId: unidad.companyId
        },
        include: {
          registradoPor: {
            select: { id: true, name: true }
          }
        }
      });

      // Actualizar el kilometraje de la unidad si se solicita
      let updatedUnidad = null;
      if (data.actualizarUnidad && data.kilometraje > unidad.kilometraje) {
        updatedUnidad = await tx.unidadMovil.update({
          where: { id: unidadId },
          data: {
            kilometraje: data.kilometraje,
            updatedAt: new Date()
          },
          select: { id: true, kilometraje: true }
        });
      }

      return { log, updatedUnidad };
    });

    // 6. Calcular km recorridos desde última lectura
    const kmRecorridos = data.kilometraje - unidad.kilometraje;

    return NextResponse.json({
      success: true,
      log: {
        id: result.log.id,
        kilometraje: result.log.kilometraje,
        fecha: result.log.fecha,
        tipo: result.log.tipo,
        notas: result.log.notas,
        registradoPor: result.log.registradoPor ? {
          id: result.log.registradoPor.id,
          name: result.log.registradoPor.name
        } : null
      },
      kmRecorridos,
      unidadActualizada: result.updatedUnidad !== null,
      nuevoKilometraje: result.updatedUnidad?.kilometraje || unidad.kilometraje,
      message: 'Kilometraje registrado correctamente'
    });

  } catch (error) {
    console.error('❌ Error en POST /api/mantenimiento/unidades-moviles/[id]/kilometraje:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
