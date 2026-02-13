/**
 * API para aprobar/rechazar solicitudes de cambio de proveedor
 */

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
        role: true,
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
 * GET - Obtener detalle de solicitud de cambio
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const cambioId = parseInt(id);

    const cambio = await prisma.supplierChangeRequest.findFirst({
      where: { id: cambioId, companyId },
      include: {
        supplier: {
          select: { id: true, name: true, cuit: true, cbu: true, alias_cbu: true, banco: true }
        },
        solicitante: { select: { id: true, name: true } },
        aprobador: { select: { id: true, name: true } },
        rechazador: { select: { id: true, name: true } },
        segundoAprobador: { select: { id: true, name: true } },
      },
    });

    if (!cambio) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json(cambio);
  } catch (error) {
    console.error('Error fetching change request:', error);
    return NextResponse.json(
      { error: 'Error al obtener solicitud' },
      { status: 500 }
    );
  }
}

/**
 * POST - Aprobar o rechazar solicitud de cambio
 * Body: { accion: 'aprobar' | 'rechazar', motivo?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Verificar permisos - solo roles con permisos de aprobación
    if (!['SUPERADMIN', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERVISOR'].includes(user.role)) {
      return NextResponse.json({ error: 'No tiene permisos para aprobar cambios' }, { status: 403 });
    }

    const { id } = await params;
    const cambioId = parseInt(id);
    const body = await request.json();
    const { accion, motivo } = body;

    if (!['aprobar', 'rechazar'].includes(accion)) {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const cambio = await prisma.supplierChangeRequest.findFirst({
      where: { id: cambioId, companyId },
      include: {
        supplier: true,
      },
    });

    if (!cambio) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (cambio.estado !== 'PENDIENTE_APROBACION') {
      return NextResponse.json(
        { error: `No se puede ${accion} una solicitud en estado ${cambio.estado}` },
        { status: 400 }
      );
    }

    // ENFORCEMENT: SoD - El solicitante no puede aprobar su propia solicitud
    if (cambio.solicitadoPor === user.id) {
      return NextResponse.json(
        {
          error: 'No puede aprobar una solicitud que usted mismo creó (SoD)',
          code: 'SOD_VIOLATION'
        },
        { status: 403 }
      );
    }

    if (accion === 'aprobar') {
      // Aplicar cambios al proveedor
      const datosNuevos = cambio.datosNuevos as any;

      await prisma.$transaction(async (tx) => {
        // Actualizar proveedor con datos bancarios
        await tx.suppliers.update({
          where: { id: cambio.supplierId },
          data: {
            cbu: datosNuevos.cbu,
            alias_cbu: datosNuevos.alias_cbu,
            banco: datosNuevos.banco,
            tipo_cuenta: datosNuevos.tipo_cuenta,
            numero_cuenta: datosNuevos.numero_cuenta,
          },
        });

        // Marcar solicitud como aprobada
        await tx.supplierChangeRequest.update({
          where: { id: cambioId },
          data: {
            estado: 'APROBADO',
            aprobadoPor: user.id,
            aprobadoAt: new Date(),
          },
        });

        // Registrar en auditoría
        await tx.purchaseAuditLog.create({
          data: {
            entidad: 'supplier',
            entidadId: cambio.supplierId,
            accion: 'APROBAR_CAMBIO_BANCARIO',
            datosAnteriores: cambio.datosAnteriores as any,
            datosNuevos: datosNuevos,
            companyId,
            userId: user.id,
          },
        });
      });

      console.log(`[CAMBIOS PROVEEDOR] ✅ Cambio bancario aprobado para proveedor ${cambio.supplierId}`);

      return NextResponse.json({
        success: true,
        message: 'Cambio bancario aprobado y aplicado',
        supplierId: cambio.supplierId,
      });

    } else {
      // Rechazar
      if (!motivo) {
        return NextResponse.json(
          { error: 'Debe proporcionar un motivo de rechazo' },
          { status: 400 }
        );
      }

      await prisma.supplierChangeRequest.update({
        where: { id: cambioId },
        data: {
          estado: 'RECHAZADO',
          rechazadoPor: user.id,
          rechazadoAt: new Date(),
          motivoRechazo: motivo,
        },
      });

      console.log(`[CAMBIOS PROVEEDOR] ❌ Cambio bancario rechazado para proveedor ${cambio.supplierId}: ${motivo}`);

      return NextResponse.json({
        success: true,
        message: 'Solicitud de cambio rechazada',
        supplierId: cambio.supplierId,
      });
    }
  } catch (error) {
    console.error('Error processing change request:', error);
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
