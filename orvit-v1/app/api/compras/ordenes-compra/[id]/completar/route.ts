import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
import { JWT_SECRET } from '@/lib/auth';
import { getViewMode } from '@/lib/view-mode/get-mode';
import { enrichT2Receipts } from '@/lib/view-mode';

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

// POST - Completar OC con datos de factura
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

    const { id } = await params;
    const ordenId = parseInt(id);

    const body = await request.json();
    console.log('[Completar OC] Body recibido:', {
      docType: body.docType,
      tipo: body.tipo,
      numeroFactura: body.numeroFactura,
      total: body.total
    });

    const {
      docType = 'T1',
      tipo,
      numeroSerie = '',
      numeroFactura,
      fechaEmision,
      fechaVencimiento,
      fechaImputacion,
      tipoPago = 'cta_cte',
      proveedorId,
      // Totales
      neto = 0,
      iva21 = 0,
      noGravado = 0,
      impInter = 0,
      percepcionIVA = 0,
      percepcionIIBB = 0,
      otrosConceptos = 0,
      iva105 = 0,
      iva27 = 0,
      exento = 0,
      iibb = 0,
      total,
      tipoCuentaId,
      observaciones,
      moneda = 'ARS',
      // Items modificados (si hubo cambios)
      itemsModificados,
      itemChanges,
    } = body;

    // Validar datos requeridos
    if (!numeroFactura) {
      return NextResponse.json({ error: 'Número de factura es requerido' }, { status: 400 });
    }

    if (!tipoCuentaId) {
      return NextResponse.json({ error: 'Tipo de cuenta es requerido' }, { status: 400 });
    }

    // Buscar la OC
    const orden = await prisma.purchaseOrder.findFirst({
      where: { id: ordenId, companyId },
      include: {
        items: {
          include: {
            supplierItem: true
          }
        }
      }
    });

    if (!orden) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 });
    }

    // Validar que la OC está en estado válido para completar
    const estadosValidos = ['APROBADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'];
    if (!estadosValidos.includes(orden.estado)) {
      return NextResponse.json(
        { error: `No se puede completar una OC en estado ${orden.estado}` },
        { status: 400 }
      );
    }

    // Obtener ViewMode para verificar si T2 está disponible
    const viewMode = getViewMode(request);
    const isT2 = docType === 'T2';

    console.log('[Completar OC] Decisión de ruta:', { docType, isT2, viewMode });

    // =================================================================
    // SI ES T2: Crear comprobante en BD T2
    // =================================================================
    if (isT2) {
      console.log('[Completar OC] ➡️ Entrando a flujo T2');
      // Verificar que T2 está configurado
      if (!isT2DatabaseConfigured()) {
        console.error('[Completar OC] T2 DB no configurada (DATABASE_URL_T2 no existe)');
        return NextResponse.json(
          { error: 'Base de datos T2 no disponible' },
          { status: 503 }
        );
      }

      try {
        const prismaT2 = getT2Client();

        // Crear comprobante en BD T2
        const comprobanteT2 = await prismaT2.t2PurchaseReceipt.create({
          data: {
            companyId,
            supplierId: proveedorId || orden.proveedorId,
            tipoCuentaId: Number(tipoCuentaId),
            createdBy: user.id,
            numeroSerie: numeroSerie || '0000',
            numeroFactura,
            tipo: tipo || 'X', // Usar tipo del frontend, fallback 'X'
            fechaEmision: new Date(fechaEmision || new Date()),
            fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
            fechaImputacion: fechaImputacion ? new Date(fechaImputacion) : new Date(),
            tipoPago: tipoPago || 'contado',
            neto: Number(neto) || 0,
            total: Number(total) || 0,
            estado: 'pendiente',
            observaciones: observaciones || null,
          },
        });

        // Crear items en BD T2
        // Si hay itemsModificados del frontend, usarlos en lugar de los items originales de la OC
        const itemsParaCrear = itemsModificados && itemsModificados.length > 0
          ? itemsModificados.map((modItem: any) => {
              // Buscar el item original de la OC para obtener supplierItemId
              const ocItem = orden.items.find((oi: any) => String(oi.id) === String(modItem.id));
              return {
                supplierItemId: ocItem?.supplierItemId || 0,
                descripcion: modItem.descripcion || ocItem?.descripcion || '',
                cantidad: Number(modItem.cantidad) || Number(ocItem?.cantidad) || 0,
                precioUnitario: Number(modItem.precioUnitario) || Number(ocItem?.precioUnitario) || 0,
                subtotal: Number(modItem.subtotal) || 0,
              };
            })
          : orden.items.map((item: any) => ({
              supplierItemId: item.supplierItemId || 0,
              descripcion: item.descripcion || '',
              cantidad: Number(item.cantidad) || 0,
              precioUnitario: Number(item.precioUnitario) || 0,
              subtotal: Number(item.subtotal) || 0,
            }));

        console.log('[Completar OC T2] Items a crear:', itemsParaCrear.length);

        for (const item of itemsParaCrear) {
          await prismaT2.t2PurchaseReceiptItem.create({
            data: {
              receiptId: comprobanteT2.id,
              supplierItemId: item.supplierItemId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              descripcion: item.descripcion || null,
            },
          });
        }

        // Crear MatchResult en BD principal para vincular OC con factura T2
        await prisma.matchResult.create({
          data: {
            purchaseOrderId: ordenId,
            facturaId: comprobanteT2.id,
            estado: 'MATCH_OK',
            matchOcFactura: true,
            matchCompleto: true,
            resuelto: true,
            resueltoPor: user.id,
            resueltoAt: new Date(),
            accionTomada: 'COMPLETADA_MANUAL',
            notas: `OC completada con factura T2 ${numeroSerie || '0000'}-${numeroFactura}`,
            companyId,
          },
        });

        // Marcar la OC como COMPLETADA en BD principal
        await prisma.purchaseOrder.update({
          where: { id: ordenId },
          data: {
            estado: 'COMPLETADA',
          },
        });

        // Registrar comentario de auditoría en la OC (igual que T1)
        const facturaNro = `${numeroSerie || '0000'}-${numeroFactura}`;
        await prisma.purchaseComment.create({
          data: {
            entidad: 'order',
            entidadId: ordenId,
            tipo: 'SISTEMA',
            contenido: `Factura T2 ${facturaNro} cargada por ${user.name || 'usuario'}`,
            companyId,
            userId: user.id,
          },
        });

        // Si hubo cambios en items, registrarlos
        if (itemChanges && itemChanges.length > 0) {
          await prisma.purchaseComment.create({
            data: {
              entidad: 'order',
              entidadId: ordenId,
              tipo: 'SISTEMA',
              contenido: `⚠️ Items modificados al completar OC (T2):\n${itemChanges.map((c: any) => `- ${c.campo}: ${c.valorAnterior} → ${c.valorNuevo}`).join('\n')}`,
              companyId,
              userId: user.id,
            },
          });
        }

        // Enriquecer con datos del proveedor
        const [enriched] = await enrichT2Receipts([comprobanteT2]);

        console.log('[Completar OC] ✅ Comprobante T2 creado en BD secundaria:', comprobanteT2.id);

        return NextResponse.json({
          success: true,
          comprobante: {
            ...enriched,
            numero: facturaNro,
            docType: 'T2',
            _fromT2: true,
          },
          message: 'Factura T2 cargada exitosamente desde la OC'
        });
      } catch (t2Error: any) {
        console.error('[Completar OC] ❌ Error creando comprobante T2:', t2Error?.message);
        return NextResponse.json(
          { error: 'Error al crear comprobante T2', details: t2Error?.message },
          { status: 500 }
        );
      }
    }

    // =================================================================
    // SI ES T1: Crear comprobante en BD PRINCIPAL
    // =================================================================
    console.log('[Completar OC] ➡️ Entrando a flujo T1');
    console.log('[Completar OC T1] Items de la OC:', orden.items.length, orden.items.map(i => ({
      id: i.id,
      supplierItemId: i.supplierItemId,
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad)
    })));

    // Transacción: crear comprobante y actualizar OC
    const result = await prisma.$transaction(async (tx) => {
      // Crear el comprobante (PurchaseReceipt)
      const comprobante = await tx.purchaseReceipt.create({
        data: {
          numeroSerie: numeroSerie || '0000',
          numeroFactura,
          tipo: tipo || 'Factura A',
          proveedorId: proveedorId || orden.proveedorId,
          fechaEmision: new Date(fechaEmision || new Date()),
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          fechaImputacion: fechaImputacion ? new Date(fechaImputacion) : new Date(),
          tipoPago,
          neto: Number(neto),
          iva21: Number(iva21),
          noGravado: Number(noGravado),
          impInter: Number(impInter),
          percepcionIVA: Number(percepcionIVA),
          percepcionIIBB: Number(percepcionIIBB),
          otrosConceptos: Number(otrosConceptos),
          iva105: Number(iva105),
          iva27: Number(iva27),
          exento: Number(exento),
          iibb: Number(iibb),
          total: Number(total),
          tipoCuentaId: Number(tipoCuentaId),
          estado: 'pendiente',
          docType: 'T1',
          observaciones: observaciones || null,
          companyId,
          createdBy: user.id,
          // Crear items desde los items de la OC
          items: {
            create: orden.items.map(item => ({
              itemId: item.supplierItemId,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
              proveedorId: orden.proveedorId,
              companyId
            }))
          }
        }
      });

      // Crear historial de precios y actualizar precio del SupplierItem
      for (const item of orden.items) {
        if (item.supplierItemId && item.precioUnitario) {
          const precioUnitario = Number(item.precioUnitario);

          // Crear registro en historial de precios
          await tx.priceHistory.create({
            data: {
              supplierItemId: item.supplierItemId,
              precioUnitario,
              comprobanteId: comprobante.id,
              fecha: new Date(fechaEmision || new Date()),
              companyId,
            },
          });

          // Actualizar precio actual del SupplierItem
          await tx.supplierItem.update({
            where: { id: item.supplierItemId },
            data: { precioUnitario },
          });
        }
      }

      // Crear MatchResult para vincular OC con factura
      await tx.matchResult.create({
        data: {
          purchaseOrderId: ordenId,
          facturaId: comprobante.id,
          estado: 'MATCH_OK',
          matchOcFactura: true,
          matchCompleto: true,
          resuelto: true,
          resueltoPor: user.id,
          resueltoAt: new Date(),
          accionTomada: 'COMPLETADA_MANUAL',
          notas: `OC completada manualmente con factura ${numeroSerie}-${numeroFactura}`,
          companyId,
        }
      });

      // Marcar la OC como COMPLETADA
      // NO poner fechaEntregaReal: eso es para cuando se recibe mercadería con remito
      await tx.purchaseOrder.update({
        where: { id: ordenId },
        data: {
          estado: 'COMPLETADA',
        },
      });

      // Crear comentario de sistema para trazabilidad
      await tx.purchaseComment.create({
        data: {
          entidad: 'order',
          entidadId: ordenId,
          tipo: 'SISTEMA',
          contenido: `Factura ${numeroSerie}-${numeroFactura} cargada por ${user.name}`,
          companyId,
          userId: user.id
        }
      });

      // Si hubo modificaciones en los items, registrarlas para trazabilidad
      if (itemChanges && itemChanges.length > 0) {
        const changesDetail = itemChanges.map((c: any) =>
          `${c.campo}: ${c.valorAnterior} → ${c.valorNuevo}`
        ).join('; ');

        await tx.purchaseComment.create({
          data: {
            entidad: 'order',
            entidadId: ordenId,
            tipo: 'SISTEMA',
            contenido: `[MODIFICACIÓN DE ITEMS] Usuario ${user.name} modificó items al cargar factura:\n${changesDetail}`,
            companyId,
            userId: user.id
          }
        });
      }

      // NO actualizar el PurchaseRequest a COMPLETADA aquí
      // El pedido se completa cuando se recibe la mercadería (remito), no cuando se carga la factura

      return {
        comprobante: {
          id: comprobante.id,
          numero: `${comprobante.numeroSerie}-${comprobante.numeroFactura}`
        },
        ordenActualizada: true
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Factura cargada exitosamente desde la OC',
      ...result
    });
  } catch (error: any) {
    console.error('Error cargando factura desde OC:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cargar la factura desde la orden de compra' },
      { status: 500 }
    );
  }
}
