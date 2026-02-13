/**
 * POST /api/ventas/ordenes-carga/[id]/confirmar-entrega
 *
 * Confirms delivery with proof of delivery (POD).
 * Records signatures, photos, and GPS location.
 *
 * Request body:
 * - firmaChofer: string (base64 signature image)
 * - firmaCliente?: string (base64 signature image)
 * - fotosEntrega?: string[] (array of base64 or URLs)
 * - receptorNombre: string
 * - receptorDNI: string
 * - receptorRelacion?: string (e.g., "Dueño", "Encargado", "Portero")
 * - observaciones?: string
 * - gps?: { latitud: number, longitud: number }
 * - timestamp?: string (defaults to now)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, LoadOrderStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

interface ConfirmDeliveryRequest {
  firmaChofer: string;
  firmaCliente?: string;
  fotosEntrega?: string[];
  receptorNombre: string;
  receptorDNI: string;
  receptorRelacion?: string;
  observaciones?: string;
  gps?: {
    latitud: number;
    longitud: number;
  };
  timestamp?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ENTREGAS_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    const viewMode = getViewMode(request);
    const body: ConfirmDeliveryRequest = await request.json();

    // Validate required fields
    if (!body.firmaChofer || body.firmaChofer.trim() === '') {
      return NextResponse.json(
        { error: 'Firma del chofer es requerida' },
        { status: 400 }
      );
    }

    if (!body.receptorNombre || body.receptorNombre.trim() === '') {
      return NextResponse.json(
        { error: 'Nombre del receptor es requerido' },
        { status: 400 }
      );
    }

    if (!body.receptorDNI || body.receptorDNI.trim() === '') {
      return NextResponse.json(
        { error: 'DNI del receptor es requerido' },
        { status: 400 }
      );
    }

    // Get load order
    const loadOrder = await prisma.loadOrder.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        delivery: true,
      },
    });

    if (!loadOrder) {
      return NextResponse.json({ error: 'Orden de carga no encontrada' }, { status: 404 });
    }

    // Validate state transition
    const validation = validateTransition({
      documentType: 'loadorder',
      documentId: id,
      fromState: loadOrder.estado,
      toState: LoadOrderStatus.DESPACHADA,
      userId: user!.id,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const confirmTimestamp = body.timestamp ? new Date(body.timestamp) : new Date();

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update LoadOrder
      const updated = await tx.loadOrder.update({
        where: { id },
        data: {
          estado: LoadOrderStatus.DESPACHADA,
          confirmadoAt: confirmTimestamp,
          receptorNombre: body.receptorNombre,
          receptorDNI: body.receptorDNI,
          receptorRelacion: body.receptorRelacion,
          observaciones: body.observaciones
            ? `${loadOrder.observaciones || ''}\n\n[Entrega] ${body.observaciones}`.trim()
            : loadOrder.observaciones,
        },
      });

      // Store signatures
      if (body.firmaChofer) {
        await tx.deliveryEvidence.create({
          data: {
            loadOrderId: id,
            deliveryId: loadOrder.deliveryId,
            tipo: 'FIRMA_CHOFER',
            url: body.firmaChofer, // Store base64 or upload to S3
            descripcion: 'Firma del chofer',
            capturedAt: confirmTimestamp,
          },
        });
      }

      if (body.firmaCliente) {
        await tx.deliveryEvidence.create({
          data: {
            loadOrderId: id,
            deliveryId: loadOrder.deliveryId,
            tipo: 'FIRMA_CLIENTE',
            url: body.firmaCliente,
            descripcion: `Firma de ${body.receptorNombre} (${body.receptorRelacion || 'Receptor'})`,
            capturedAt: confirmTimestamp,
          },
        });
      }

      // Store photos
      if (body.fotosEntrega && body.fotosEntrega.length > 0) {
        for (const [index, foto] of body.fotosEntrega.entries()) {
          await tx.deliveryEvidence.create({
            data: {
              loadOrderId: id,
              deliveryId: loadOrder.deliveryId,
              tipo: 'FOTO',
              url: foto,
              descripcion: `Foto de entrega ${index + 1}`,
              capturedAt: confirmTimestamp,
            },
          });
        }
      }

      // Store GPS location
      if (body.gps) {
        await tx.deliveryGPSLog.create({
          data: {
            loadOrderId: id,
            deliveryId: loadOrder.deliveryId,
            latitud: body.gps.latitud,
            longitud: body.gps.longitud,
            evento: 'ENTREGA_CONFIRMADA',
            timestamp: confirmTimestamp,
          },
        });
      }

      // Update associated delivery if exists
      if (loadOrder.deliveryId) {
        await tx.saleDelivery.update({
          where: { id: loadOrder.deliveryId },
          data: {
            estado: 'ENTREGADA',
            fechaEntrega: confirmTimestamp,
          },
        });
      }

      return updated;
    });

    // Audit log
    await logSalesStatusChange({
      entidad: 'loadorder',
      entidadId: id,
      estadoAnterior: loadOrder.estado,
      estadoNuevo: LoadOrderStatus.DESPACHADA,
      companyId: user!.companyId,
      userId: user!.id,
      notas: `Entrega confirmada por ${body.receptorNombre} (DNI: ${body.receptorDNI})`,
    });

    return NextResponse.json({
      message: 'Entrega confirmada exitosamente',
      loadOrder: {
        id: result.id,
        numero: result.numero,
        estado: result.estado,
      },
      receptor: {
        nombre: body.receptorNombre,
        dni: body.receptorDNI,
        relacion: body.receptorRelacion,
      },
      evidencias: {
        firmaChofer: !!body.firmaChofer,
        firmaCliente: !!body.firmaCliente,
        fotos: body.fotosEntrega?.length || 0,
        gps: !!body.gps,
      },
    });
  } catch (error) {
    console.error('Error confirming delivery:', error);
    return NextResponse.json(
      { error: 'Error al confirmar entrega' },
      { status: 500 }
    );
  }
}
