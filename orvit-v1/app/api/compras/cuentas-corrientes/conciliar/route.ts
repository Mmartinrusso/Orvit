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
        name: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

/**
 * POST - Conciliar movimientos de cuenta corriente
 *
 * Body:
 * - movimientoIds: number[] - IDs de movimientos a conciliar
 * - conciliado: boolean - true para marcar como conciliado, false para desconciliar
 * - referenciaConciliacion?: string - Número de referencia (ej: extracto bancario)
 * - notasConciliacion?: string - Notas adicionales
 */
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
    const {
      movimientoIds,
      conciliado = true,
      nota // Nota opcional para el audit log
    } = body;

    if (!movimientoIds || !Array.isArray(movimientoIds) || movimientoIds.length === 0) {
      return NextResponse.json(
        { error: 'Debe proporcionar al menos un ID de movimiento' },
        { status: 400 }
      );
    }

    // Verificar que todos los movimientos existen y pertenecen a la empresa
    const movimientos = await prisma.supplierAccountMovement.findMany({
      where: {
        id: { in: movimientoIds },
        companyId
      },
      select: {
        id: true,
        conciliado: true,
        supplierId: true,
        tipo: true,
        comprobante: true,
        fecha: true
      }
    });

    if (movimientos.length !== movimientoIds.length) {
      const encontrados = movimientos.map(m => m.id);
      const noEncontrados = movimientoIds.filter((id: number) => !encontrados.includes(id));
      return NextResponse.json(
        { error: `Movimientos no encontrados o sin acceso: ${noEncontrados.join(', ')}` },
        { status: 404 }
      );
    }

    // Filtrar solo los que necesitan cambio
    const movimientosACambiar = movimientos.filter(m => m.conciliado !== conciliado);

    if (movimientosACambiar.length === 0) {
      return NextResponse.json({
        message: `Todos los movimientos ya están ${conciliado ? 'conciliados' : 'sin conciliar'}`,
        actualizados: 0
      });
    }

    // Actualizar movimientos (usar campos existentes en schema)
    const resultado = await prisma.supplierAccountMovement.updateMany({
      where: {
        id: { in: movimientosACambiar.map(m => m.id) },
        companyId
      },
      data: {
        conciliado,
        conciliadoAt: conciliado ? new Date() : null,
        conciliadoBy: conciliado ? user.id : null
      }
    });

    // Registrar en auditoría
    await prisma.purchaseAuditLog.create({
      data: {
        entidad: 'supplier_account_movement',
        entidadId: movimientosACambiar[0].id, // ID del primer movimiento
        accion: conciliado ? 'CONCILIAR' : 'DESCONCILIAR',
        datosAnteriores: {
          movimientos: movimientosACambiar.map(m => ({
            id: m.id,
            conciliado: m.conciliado
          }))
        },
        datosNuevos: {
          movimientos: movimientosACambiar.map(m => m.id),
          conciliado,
          totalMovimientos: resultado.count,
          ...(nota && { nota })
        },
        companyId,
        userId: user.id
      }
    });

    // Agrupar por proveedor para el resumen
    const porProveedor = movimientosACambiar.reduce((acc, m) => {
      acc[m.supplierId] = (acc[m.supplierId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return NextResponse.json({
      success: true,
      message: `${resultado.count} movimiento(s) ${conciliado ? 'conciliado(s)' : 'desconciliado(s)'} correctamente`,
      actualizados: resultado.count,
      porProveedor
    });
  } catch (error) {
    console.error('Error en conciliación:', error);
    return NextResponse.json(
      { error: 'Error al procesar la conciliación' },
      { status: 500 }
    );
  }
}

/**
 * GET - Obtener resumen de conciliación por proveedor
 *
 * Query params:
 * - supplierId?: number - Filtrar por proveedor específico
 * - pendientes?: boolean - Solo movimientos sin conciliar
 */
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
    const supplierId = searchParams.get('supplierId');
    const pendientes = searchParams.get('pendientes') === 'true';

    // Resumen general de conciliación
    const resumen = await prisma.supplierAccountMovement.groupBy({
      by: ['conciliado'],
      where: {
        companyId,
        ...(supplierId && { supplierId: parseInt(supplierId) })
      },
      _count: { id: true },
      _sum: { debe: true, haber: true }
    });

    const conciliados = resumen.find(r => r.conciliado === true);
    const sinConciliar = resumen.find(r => r.conciliado === false);

    // Si piden movimientos pendientes, traerlos
    let movimientosPendientes: any[] = [];
    if (pendientes) {
      movimientosPendientes = await prisma.supplierAccountMovement.findMany({
        where: {
          companyId,
          conciliado: false,
          ...(supplierId && { supplierId: parseInt(supplierId) })
        },
        include: {
          supplier: {
            select: { id: true, name: true }
          }
        },
        orderBy: [
          { fecha: 'desc' },
          { id: 'desc' }
        ],
        take: 100 // Limitar para no sobrecargar
      });
    }

    return NextResponse.json({
      resumen: {
        totalConciliados: conciliados?._count.id || 0,
        totalSinConciliar: sinConciliar?._count.id || 0,
        montoConciliado: {
          debe: Number(conciliados?._sum.debe || 0),
          haber: Number(conciliados?._sum.haber || 0)
        },
        montoSinConciliar: {
          debe: Number(sinConciliar?._sum.debe || 0),
          haber: Number(sinConciliar?._sum.haber || 0)
        }
      },
      ...(pendientes && { movimientosPendientes })
    });
  } catch (error) {
    console.error('Error obteniendo resumen de conciliación:', error);
    return NextResponse.json(
      { error: 'Error al obtener resumen de conciliación' },
      { status: 500 }
    );
  }
}
