/**
 * API: /api/mantenimiento/unidades-moviles
 *
 * GET - Lista de unidades móviles con filtros y paginación
 * POST - Crear nueva unidad móvil
 *
 * ✅ OPTIMIZADO:
 * - Validación con Zod
 * - Autenticación con verifyToken
 * - Índices de BD aplicados
 * - Work orders count incluido en una sola query
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  createUnidadMovilSchema,
  listUnidadesMovilesSchema,
  validateSafe
} from '@/lib/unidades-moviles/validations';

export const dynamic = 'force-dynamic';

// GET - Obtener todas las unidades móviles con work orders count
export async function GET(request: NextRequest) {
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

    // 2. Parsear y validar query params
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validation = validateSafe(listUnidadesMovilesSchema, params);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    const { companyId, sectorId, estado, tipo, search, limit = 100, offset = 0 } = validation.data;

    // 3. Construir filtro WHERE
    const where: any = { companyId };

    if (sectorId) {
      where.sectorId = sectorId;
    }

    if (estado) {
      where.estado = estado;
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { patente: { contains: search, mode: 'insensitive' } },
        { marca: { contains: search, mode: 'insensitive' } },
        { modelo: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 4. ✅ OPTIMIZADO: Query con _count de work orders incluido
    const [unidades, totalCount] = await Promise.all([
      prisma.unidadMovil.findMany({
        where,
        include: {
          sector: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              workOrders: {
                where: {
                  status: { in: ['PENDING', 'IN_PROGRESS'] }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.unidadMovil.count({ where })
    ]);

    // 5. Transformar respuesta para incluir workOrdersCount
    const unidadesConCount = unidades.map(u => ({
      ...u,
      workOrdersCount: u._count.workOrders,
      _count: undefined // Remover campo interno
    }));

    return NextResponse.json({
      success: true,
      unidades: unidadesConCount,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('❌ Error en GET /api/mantenimiento/unidades-moviles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear una nueva unidad móvil
export async function POST(request: NextRequest) {
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

    // 2. Parsear y validar body
    const body = await request.json();
    const validation = validateSafe(createUnidadMovilSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 3. Verificar patente duplicada (solo si tiene patente)
    if (data.patente) {
      const existingUnidad = await prisma.unidadMovil.findFirst({
        where: {
          patente: data.patente,
          companyId: data.companyId
        },
        select: { id: true }
      });

      if (existingUnidad) {
        return NextResponse.json(
          { error: 'Ya existe una unidad móvil con esta patente' },
          { status: 400 }
        );
      }
    }

    // 4. Crear la unidad móvil
    const unidad = await prisma.unidadMovil.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        marca: data.marca || '',
        modelo: data.modelo || '',
        año: data.año || new Date().getFullYear(),
        patente: data.patente || '',
        numeroChasis: data.numeroChasis || '',
        numeroMotor: data.numeroMotor || '',
        kilometraje: data.kilometraje || 0,
        estado: data.estado || 'ACTIVO',
        sectorId: data.sectorId || null,
        companyId: data.companyId,
        descripcion: data.descripcion || '',
        fechaAdquisicion: data.fechaAdquisicion ? new Date(data.fechaAdquisicion) : null,
        valorAdquisicion: data.valorAdquisicion || null,
        proveedor: data.proveedor || '',
        garantiaHasta: data.garantiaHasta ? new Date(data.garantiaHasta) : null,
        combustible: data.combustible || '',
        capacidadCombustible: data.capacidadCombustible || null,
        consumoPromedio: data.consumoPromedio || null,
        kmUpdateFrequencyDays: data.kmUpdateFrequencyDays || null
      },
      include: {
        sector: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      unidad: {
        ...unidad,
        workOrdersCount: 0
      },
      message: 'Unidad móvil creada correctamente'
    });

  } catch (error) {
    console.error('❌ Error en POST /api/mantenimiento/unidades-moviles:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
