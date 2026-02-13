import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET: Listar notas del cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { id: clientId } = await params;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // Filtro por tipo
    const importante = searchParams.get('importante') === 'true';
    const pendientes = searchParams.get('pendientes') === 'true'; // Solo recordatorios pendientes

    // Verificar que el cliente existe
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Construir where clause
    const where: any = {
      clientId,
      companyId,
    };

    if (tipo) {
      where.tipo = tipo;
    }

    if (importante) {
      where.importante = true;
    }

    if (pendientes) {
      where.completado = false;
      where.recordatorio = { not: null, lte: new Date() };
    }

    // Obtener notas
    const notas = await prisma.clientNote.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        fechaNota: 'desc',
      },
    });

    return NextResponse.json(notas);
  } catch (error) {
    console.error('Error obteniendo notas del cliente:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Crear nueva nota
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const userId = user!.id;
    const { id: clientId } = await params;

    // Verificar que el cliente existe
    const client = await prisma.client.findFirst({
      where: { id: clientId, companyId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const {
      tipo,
      asunto,
      contenido,
      importante,
      fechaNota,
      recordatorio,
    } = body;

    // Validaciones
    if (!tipo || !asunto || !contenido) {
      return NextResponse.json({
        error: 'Campos requeridos: tipo, asunto, contenido'
      }, { status: 400 });
    }

    const validTipos = ['LLAMADA', 'REUNION', 'EMAIL', 'RECLAMO', 'VISITA', 'NOTA', 'SEGUIMIENTO'];
    if (!validTipos.includes(tipo)) {
      return NextResponse.json({
        error: `Tipo inválido. Debe ser uno de: ${validTipos.join(', ')}`
      }, { status: 400 });
    }

    // Crear nota
    const nota = await prisma.clientNote.create({
      data: {
        clientId,
        companyId,
        userId,
        tipo,
        asunto,
        contenido,
        importante: importante || false,
        fechaNota: fechaNota ? new Date(fechaNota) : new Date(),
        recordatorio: recordatorio ? new Date(recordatorio) : null,
        completado: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(nota, { status: 201 });
  } catch (error) {
    console.error('Error creando nota:', error);
    return NextResponse.json({ error: 'Error al crear nota' }, { status: 500 });
  }
}
