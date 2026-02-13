import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Caché
const proyectosCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
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

// GET - Listar proyectos/obras
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const estado = searchParams.get('estado');
    const search = searchParams.get('search');

    const where: Prisma.ProjectWhereInput = {
      companyId,
      ...(estado && { estado: estado as any }),
      ...(search && {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
        ]
      }),
    };

    // Verificar caché
    const cacheKey = `proyectos-${companyId}-${estado || 'all'}-${page}`;
    if (!search) {
      const cached = proyectosCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data, { headers: { 'X-Cache': 'HIT' } });
      }
    }

    const [proyectos, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          _count: {
            select: { purchaseOrders: true, receipts: true }
          }
        },
        orderBy: [
          { estado: 'asc' },
          { codigo: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where })
    ]);

    // Calcular totales gastados por proyecto
    const proyectosConTotales = await Promise.all(
      proyectos.map(async (proyecto) => {
        const totalGastado = await prisma.purchaseOrder.aggregate({
          where: {
            projectId: proyecto.id,
            estado: { in: ['COMPLETADA', 'PARCIALMENTE_RECIBIDA', 'CONFIRMADA'] }
          },
          _sum: { total: true }
        });

        const presupuesto = proyecto.presupuesto ? parseFloat(proyecto.presupuesto.toString()) : null;
        const gastado = totalGastado._sum.total ? parseFloat(totalGastado._sum.total.toString()) : 0;

        return {
          ...proyecto,
          totalGastado: gastado,
          presupuestoRestante: presupuesto ? presupuesto - gastado : null,
          porcentajeEjecutado: presupuesto && presupuesto > 0 ? (gastado / presupuesto) * 100 : null
        };
      })
    );

    const result = {
      data: proyectosConTotales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Guardar en caché
    if (!search) {
      proyectosCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching proyectos:', error);
    return NextResponse.json(
      { error: 'Error al obtener los proyectos' },
      { status: 500 }
    );
  }
}

// POST - Crear proyecto/obra
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
    const { codigo, nombre, descripcion, fechaInicio, fechaFin, presupuesto, clienteId } = body;

    // Validaciones
    if (!codigo?.trim()) {
      return NextResponse.json({ error: 'El código es requerido' }, { status: 400 });
    }
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Verificar código único
    const existente = await prisma.project.findUnique({
      where: {
        companyId_codigo: {
          companyId,
          codigo: codigo.trim().toUpperCase()
        }
      }
    });

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe un proyecto con ese código' },
        { status: 400 }
      );
    }

    const nuevoProyecto = await prisma.project.create({
      data: {
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        estado: 'ACTIVO',
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        presupuesto: presupuesto ? parseFloat(presupuesto) : null,
        clienteId: clienteId ? parseInt(clienteId) : null,
        companyId,
      }
    });

    // Invalidar caché
    for (const key of proyectosCache.keys()) {
      if (key.startsWith(`proyectos-${companyId}`)) {
        proyectosCache.delete(key);
      }
    }

    return NextResponse.json(nuevoProyecto, { status: 201 });
  } catch (error) {
    console.error('Error creating proyecto:', error);
    return NextResponse.json(
      { error: 'Error al crear el proyecto' },
      { status: 500 }
    );
  }
}
