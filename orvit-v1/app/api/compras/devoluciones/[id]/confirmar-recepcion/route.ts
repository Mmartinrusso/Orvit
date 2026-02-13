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
 * POST - Confirmar recepción por el proveedor
 *
 * Cambia estado de ENVIADA a RECIBIDA_PROVEEDOR.
 *
 * Estados:
 * - RECIBIDA_PROVEEDOR = Logística OK (el proveedor recibió la mercadería)
 * - RESUELTA = Contable OK (la NCA fue emitida/aplicada, o se cerró sin NCA)
 *
 * Este endpoint NO mueve stock (eso ya se hizo al ENVIAR).
 * Solo registra que el proveedor confirmó recepción.
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

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Leer body con datos de confirmación
    let confirmacionData: {
      evidenciaRecepcion?: string;
      resolucion?: string;
      notas?: string;
    } = {};

    try {
      const body = await request.json();
      confirmacionData = {
        ...(body.evidenciaRecepcion && { evidenciaRecepcion: body.evidenciaRecepcion }),
        ...(body.resolucion && { resolucion: body.resolucion }),
        ...(body.notas && { notas: body.notas }),
      };
    } catch {
      // Body vacío, continuar sin datos adicionales
    }

    // Obtener devolución actual
    const devolucion = await prisma.purchaseReturn.findFirst({
      where: { id, companyId },
      include: {
        proveedor: { select: { id: true, name: true } },
        goodsReceipt: { select: { id: true, numero: true, docType: true } }
      }
    });

    if (!devolucion) {
      return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 });
    }

    // Validar estado
    if (devolucion.estado !== 'ENVIADA') {
      return NextResponse.json(
        {
          error: `Solo se puede confirmar recepción de devoluciones enviadas. Estado actual: ${devolucion.estado}`
        },
        { status: 400 }
      );
    }

    // Actualizar estado
    const devolucionActualizada = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseReturn.update({
        where: { id },
        data: {
          estado: 'RECIBIDA_PROVEEDOR',
          ...(confirmacionData.evidenciaRecepcion && { evidenciaRecepcion: confirmacionData.evidenciaRecepcion }),
          ...(confirmacionData.resolucion && { resolucion: confirmacionData.resolucion }),
          ...(confirmacionData.notas && {
            notas: devolucion.notas
              ? `${devolucion.notas}\n[${new Date().toISOString()}] Recibida: ${confirmacionData.notas}`
              : `[${new Date().toISOString()}] Recibida: ${confirmacionData.notas}`
          }),
        }
      });

      // Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'purchase_return',
          entidadId: id,
          accion: 'CONFIRMAR_RECEPCION',
          datosAnteriores: { estado: 'ENVIADA' },
          datosNuevos: {
            estado: 'RECIBIDA_PROVEEDOR',
            tieneEvidencia: !!confirmacionData.evidenciaRecepcion,
            resolucion: confirmacionData.resolucion
          },
          companyId,
          userId: user.id,
          docType: (devolucion.goodsReceipt?.docType || 'T1') as any
        }
      });

      return updated;
    });

    // Obtener devolución completa para respuesta
    const devolucionCompleta = await prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        proveedor: { select: { id: true, name: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        goodsReceipt: { select: { id: true, numero: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        },
        creditNotes: {
          select: { id: true, numero: true, total: true, estado: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Recepción confirmada por el proveedor',
      devolucion: devolucionCompleta,
      nota: 'La devolución está lista para recibir la NCA del proveedor. ' +
            'Una vez recibida la NCA, vincúlela a esta devolución.'
    });
  } catch (error: any) {
    console.error('Error confirmando recepcion:', error);
    return NextResponse.json(
      { error: error.message || 'Error al confirmar recepción' },
      { status: 500 }
    );
  }
}
