import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/compras/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';

export const dynamic = 'force-dynamic';

// Generar numero de OC automatico (acepta tx o prisma)
async function generarNumeroOC(companyId: number, db: typeof prisma = prisma): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OC-${year}-`;

  const ultimaOC = await db.purchaseOrder.findFirst({
    where: {
      companyId,
      numero: { startsWith: prefix }
    },
    orderBy: { numero: 'desc' },
    select: { numero: true }
  });

  if (ultimaOC) {
    const ultimoNumero = parseInt(ultimaOC.numero.replace(prefix, '')) || 0;
    return `${prefix}${String(ultimoNumero + 1).padStart(5, '0')}`;
  }

  return `${prefix}00001`;
}

// POST - Convertir cotizacion a OC
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission('compras.cotizaciones.convertir_oc');
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const cotizacionId = parseInt(id);

    // Obtener datos del body (opcionales - para override)
    let bodyData: any = {};
    try {
      bodyData = await request.json();
    } catch {
      // Body vacio es OK
    }

    // Determinar docType: usar del body si se proporciona, sino del viewMode
    let docType: 'T1' | 'T2' = 'T1';
    if (bodyData.docType && ['T1', 'T2'].includes(bodyData.docType)) {
      docType = bodyData.docType;
    } else {
      const viewMode = getViewMode(request);
      docType = viewMode === 'E' ? 'T2' : 'T1';
    }

    // Usar select para evitar columnas que no existen en la BD
    const cotizacion = await prisma.purchaseQuotation.findFirst({
      where: { id: cotizacionId, companyId },
      select: {
        id: true,
        numero: true,
        requestId: true,
        supplierId: true,
        estado: true,
        esSeleccionada: true,
        fechaCotizacion: true,
        validezHasta: true,
        plazoEntrega: true,
        fechaEntregaEstimada: true,
        condicionesPago: true,
        formaPago: true,
        subtotal: true,
        descuento: true,
        impuestos: true,
        total: true,
        moneda: true,
        observaciones: true,
        request: {
          select: {
            id: true,
            numero: true,
            estado: true,
            titulo: true
          }
        },
        supplier: {
          select: { id: true, name: true }
        },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            precioUnitario: true,
            descuento: true,
            subtotal: true,
            supplierItemId: true,
            notas: true
          }
        }
      }
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 });
    }

    // Validar que la cotizacion esta en estado correcto
    if (!['SELECCIONADA', 'RECIBIDA', 'EN_REVISION'].includes(cotizacion.estado)) {
      return NextResponse.json(
        { error: 'Solo se pueden convertir cotizaciones seleccionadas o en revision' },
        { status: 400 }
      );
    }

    // Validar que el pedido esta aprobado
    if (!['APROBADA', 'EN_PROCESO'].includes(cotizacion.request.estado)) {
      return NextResponse.json(
        { error: 'El pedido debe estar aprobado para crear la OC' },
        { status: 400 }
      );
    }

    // Determinar qué items usar: los del body (modal) o los de la cotización (DB)
    const itemsToUse = bodyData.items && Array.isArray(bodyData.items) && bodyData.items.length > 0
      ? bodyData.items
      : cotizacion.items;

    // Validar que hay items
    if (!itemsToUse || itemsToUse.length === 0) {
      return NextResponse.json(
        { error: 'Debe agregar al menos un item' },
        { status: 400 }
      );
    }

    // Validar que todos los items tengan datos válidos
    for (const item of itemsToUse) {
      if (!item.descripcion) {
        return NextResponse.json(
          { error: 'Todos los items deben tener descripción' },
          { status: 400 }
        );
      }
      if (Number(item.cantidad) <= 0) {
        return NextResponse.json(
          { error: 'La cantidad debe ser mayor a 0' },
          { status: 400 }
        );
      }
      if (Number(item.precioUnitario) <= 0) {
        return NextResponse.json(
          { error: 'El precio debe ser mayor a 0' },
          { status: 400 }
        );
      }
    }

    // Usar totales del body si se proporcionan, sino los de la cotización
    const subtotalFinal = bodyData.subtotal ?? cotizacion.subtotal;
    const impuestosFinal = bodyData.impuestos ?? cotizacion.impuestos;
    const totalFinal = bodyData.total ?? cotizacion.total;

    // Crear OC en transaccion
    const result = await prisma.$transaction(async (tx) => {
      // Generar numero de OC (usar tx para evitar conflictos)
      const numeroOC = await generarNumeroOC(companyId, tx);

      // Calcular fecha de entrega esperada
      let fechaEntrega = cotizacion.fechaEntregaEstimada;
      if (!fechaEntrega && cotizacion.plazoEntrega) {
        fechaEntrega = new Date();
        fechaEntrega.setDate(fechaEntrega.getDate() + cotizacion.plazoEntrega);
      }

      // Crear la OC - como APROBADA porque viene de un pedido ya aprobado
      const baseOcData = {
        numero: numeroOC,
        proveedorId: cotizacion.supplierId,
        estado: 'APROBADA' as const,
        fechaEmision: new Date(),
        fechaEntregaEsperada: fechaEntrega,
        condicionesPago: cotizacion.condicionesPago || bodyData.condicionesPago || null,
        moneda: cotizacion.moneda,
        subtotal: subtotalFinal,
        tasaIva: 21,
        impuestos: impuestosFinal,
        total: totalFinal,
        notas: `Generada desde cotizacion ${cotizacion.numero}. ${cotizacion.observaciones || bodyData.notas || ''}`.trim(),
        notasInternas: `Cotizacion: ${cotizacion.numero} | Pedido: ${cotizacion.request.numero}`,
        esEmergencia: false,
        requiereAprobacion: false,
        docType: docType as 'T1' | 'T2',
        companyId,
        createdBy: user!.id,
        costCenterId: bodyData.costCenterId ? parseInt(bodyData.costCenterId) : null,
        projectId: bodyData.projectId ? parseInt(bodyData.projectId) : null
      };

      let nuevaOC;
      try {
        // Intentar con campos de vinculacion
        nuevaOC = await tx.purchaseOrder.create({
          data: {
            ...baseOcData,
            purchaseRequestId: cotizacion.requestId,
            purchaseQuotationId: cotizacion.id
          }
        });
      } catch (createError: any) {
        // Si falla por columnas que no existen, crear sin ellas
        if (createError.message?.includes('does not exist') || createError.code === 'P2009') {
          console.warn('Creando OC sin purchaseRequestId/purchaseQuotationId');
          nuevaOC = await tx.purchaseOrder.create({
            data: baseOcData
          });
        } else {
          throw createError;
        }
      }

      // Insertar items de la OC (crear producto si no existe)
      for (const item of itemsToUse) {
        let supplierItemId = item.supplierItemId;

        // Si el item no tiene supplierItemId, crear Supply y SupplierItem automáticamente
        if (!supplierItemId) {
          // 1. Crear Supply (producto maestro) usando SQL raw para evitar columnas faltantes
          const supplyResult = await tx.$queryRaw<{ id: number }[]>`
            INSERT INTO supplies (name, unit_measure, company_id, supplier_id, is_active, created_at, updated_at)
            VALUES (${item.descripcion}, ${item.unidad || 'UN'}, ${companyId}, ${cotizacion.supplierId}, true, NOW(), NOW())
            RETURNING id
          `;
          const newSupplyId = supplyResult[0].id;

          // 2. Crear SupplierItem (producto del proveedor)
          const newSupplierItem = await tx.supplierItem.create({
            data: {
              supplierId: cotizacion.supplierId,
              supplyId: newSupplyId,
              nombre: item.descripcion,
              descripcion: item.descripcion,
              codigoProveedor: item.codigoProveedor || null,
              unidad: item.unidad || 'UN',
              precioUnitario: Number(item.precioUnitario) || null,
              activo: true,
              companyId: companyId,
            }
          });

          supplierItemId = newSupplierItem.id;
          console.log(`[convertir-oc] Creado producto: ${item.descripcion} (SupplierItem ID: ${supplierItemId})`);
        }

        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: nuevaOC.id,
            supplierItemId: supplierItemId,
            codigoPropio: item.codigoPropio || null,
            codigoProveedor: item.codigoProveedor || null,
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            cantidadRecibida: 0,
            cantidadPendiente: Number(item.cantidad),
            unidad: item.unidad,
            precioUnitario: Number(item.precioUnitario),
            descuento: Number(item.descuento || 0),
            subtotal: Number(item.subtotal),
            notas: item.notas || null
          }
        });
      }

      // Actualizar estado de la cotizacion usando SQL directo para evitar columnas que no existen
      await tx.$executeRawUnsafe(
        `UPDATE purchase_quotations SET estado = 'CONVERTIDA_OC', "updatedAt" = NOW() WHERE id = $1`,
        cotizacionId
      );

      // Actualizar estado del pedido a EN_PROCESO
      await tx.$executeRawUnsafe(
        `UPDATE purchase_requests SET estado = 'EN_PROCESO', "updatedAt" = NOW() WHERE id = $1`,
        cotizacion.requestId
      );

      return nuevaOC;
    });

    // Crear comentario de sistema (fuera de transaccion - no critico)
    try {
      await prisma.purchaseComment.create({
        data: {
          entidad: 'request',
          entidadId: cotizacion.requestId,
          tipo: 'SISTEMA',
          contenido: `OC ${result.numero} creada desde cotizacion ${cotizacion.numero} por ${user!.name}`,
          companyId,
          userId: user!.id
        }
      });
    } catch (commentError) {
      console.warn('No se pudo crear comentario de sistema:', commentError);
    }

    // Obtener OC completa para retornar
    const ocCompleta = await prisma.purchaseOrder.findUnique({
      where: { id: result.id },
      include: {
        proveedor: { select: { id: true, name: true } },
        items: {
          include: {
            supplierItem: { select: { id: true, nombre: true, unidad: true } }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: ocCompleta,
      orden: ocCompleta, // Backward compatibility
      message: `OC ${result.numero} creada exitosamente`
    });
  } catch (error: any) {
    console.error('='.repeat(60));
    console.error('[cotizaciones/convertir-oc] ERROR:');
    console.error('Error:', error);
    console.error('Message:', error?.message);
    console.error('Code:', error?.code);
    console.error('='.repeat(60));

    return NextResponse.json(
      { error: error.message || 'Error al crear la orden de compra' },
      { status: 500 }
    );
  }
}
