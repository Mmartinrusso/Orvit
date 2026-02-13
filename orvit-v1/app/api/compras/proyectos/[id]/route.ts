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

// GET - Obtener proyecto por ID
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const proyecto = await prisma.project.findFirst({
      where: { id, companyId },
      include: {
        purchaseOrders: {
          select: {
            id: true,
            numero: true,
            estado: true,
            total: true,
            fechaEmision: true,
            proveedor: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        receipts: {
          select: {
            id: true,
            numero_factura: true,
            fecha: true,
            monto_total: true,
            estado: true
          },
          orderBy: { fecha: 'desc' },
          take: 10
        },
        _count: {
          select: { purchaseOrders: true, receipts: true }
        }
      }
    });

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Calcular totales
    const totalGastado = await prisma.purchaseOrder.aggregate({
      where: {
        projectId: id,
        estado: { in: ['COMPLETADA', 'PARCIALMENTE_RECIBIDA', 'CONFIRMADA'] }
      },
      _sum: { total: true }
    });

    const presupuesto = proyecto.presupuesto ? parseFloat(proyecto.presupuesto.toString()) : null;
    const gastado = totalGastado._sum.total ? parseFloat(totalGastado._sum.total.toString()) : 0;

    return NextResponse.json({
      ...proyecto,
      totalGastado: gastado,
      presupuestoRestante: presupuesto ? presupuesto - gastado : null,
      porcentajeEjecutado: presupuesto && presupuesto > 0 ? (gastado / presupuesto) * 100 : null
    });
  } catch (error) {
    console.error('Error fetching proyecto:', error);
    return NextResponse.json(
      { error: 'Error al obtener el proyecto' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar proyecto
export async function PUT(
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existente = await prisma.project.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { codigo, nombre, descripcion, estado, fechaInicio, fechaFin, presupuesto, clienteId } = body;

    // Si cambia el código, verificar que no exista otro
    if (codigo && codigo.trim().toUpperCase() !== existente.codigo) {
      const duplicado = await prisma.project.findUnique({
        where: {
          companyId_codigo: {
            companyId,
            codigo: codigo.trim().toUpperCase()
          }
        }
      });

      if (duplicado) {
        return NextResponse.json(
          { error: 'Ya existe un proyecto con ese código' },
          { status: 400 }
        );
      }
    }

    const proyectoActualizado = await prisma.project.update({
      where: { id },
      data: {
        ...(codigo && { codigo: codigo.trim().toUpperCase() }),
        ...(nombre && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
        ...(estado && { estado: estado as any }),
        ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio) : null }),
        ...(fechaFin !== undefined && { fechaFin: fechaFin ? new Date(fechaFin) : null }),
        ...(presupuesto !== undefined && { presupuesto: presupuesto ? parseFloat(presupuesto) : null }),
        ...(clienteId !== undefined && { clienteId: clienteId ? parseInt(clienteId) : null }),
      }
    });

    return NextResponse.json(proyectoActualizado);
  } catch (error) {
    console.error('Error updating proyecto:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el proyecto' },
      { status: 500 }
    );
  }
}

// DELETE - Cerrar/archivar proyecto
export async function DELETE(
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

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existente = await prisma.project.findFirst({
      where: { id, companyId }
    });

    if (!existente) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Cambiar estado a CERRADO
    await prisma.project.update({
      where: { id },
      data: { estado: 'CERRADO' }
    });

    return NextResponse.json({ message: 'Proyecto cerrado' });
  } catch (error) {
    console.error('Error deleting proyecto:', error);
    return NextResponse.json(
      { error: 'Error al cerrar el proyecto' },
      { status: 500 }
    );
  }
}
