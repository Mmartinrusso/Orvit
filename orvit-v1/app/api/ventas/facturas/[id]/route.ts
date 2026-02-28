import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logInvoiceEmitted, logInvoiceVoided, logLedgerEntry, logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, checkPermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener factura por ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VIEW);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Buscar CON filtro de ViewMode
    const factura = await prisma.salesInvoice.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: {
        client: {
          select: { id: true, legalName: true, name: true, cuit: true, address: true, email: true }
        },
        sale: { select: { id: true, numero: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } }
          }
        },
        payments: {
          include: {
            payment: { select: { id: true, numero: true, fechaPago: true, totalPago: true } }
          }
        },
        creditNotes: { select: { id: true, numero: true, total: true } },
        createdByUser: { select: { id: true, name: true } }
      }
    });

    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    // Verificar permisos granulares de costos y márgenes
    const [canViewCosts, canViewMargins] = await Promise.all([
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.COSTS_VIEW),
      checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.MARGINS_VIEW),
    ]);

    // Filtrar campos sensibles según permisos (protección para campos actuales y futuros)
    const response: any = { ...factura };
    if (!canViewCosts) {
      response.costoTotal = undefined;
      response.items = response.items?.map((item: any) => ({
        ...item,
        costoUnitario: undefined,
      }));
    }
    if (!canViewMargins) {
      response.margenBruto = undefined;
      response.margenPorcentaje = undefined;
      response.items = response.items?.map((item: any) => ({
        ...item,
        margenItem: undefined,
      }));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching factura:', error);
    return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 });
  }
}

// PUT - Actualizar factura (editar borrador, emitir, anular)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_EDIT);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Verificar que existe y es accesible en el ViewMode actual
    const factura = await prisma.salesInvoice.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode),
      include: { client: true, items: true }
    });

    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    const body = await request.json();
    const { accion, motivo, cae, fechaVtoCae } = body;

    // Granular permission check per action
    if (accion === 'emitir') {
      const emitCheck = await checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.FACTURAS_EMIT);
      if (!emitCheck) {
        return NextResponse.json(
          { error: 'Sin permisos para emitir facturas', requiredPermission: VENTAS_PERMISSIONS.FACTURAS_EMIT },
          { status: 403 }
        );
      }
    } else if (accion === 'anular') {
      const voidCheck = await checkPermission(user!.id, user!.companyId, VENTAS_PERMISSIONS.FACTURAS_VOID);
      if (!voidCheck) {
        return NextResponse.json(
          { error: 'Sin permisos para anular facturas', requiredPermission: VENTAS_PERMISSIONS.FACTURAS_VOID },
          { status: 403 }
        );
      }
    }

    switch (accion) {
      case 'emitir':
        if (factura.estado !== 'BORRADOR') {
          return NextResponse.json({ error: 'Solo se pueden emitir facturas en borrador' }, { status: 400 });
        }

        const facturaEmitida = await prisma.$transaction(async (tx) => {
          // Emitir factura
          const updated = await tx.salesInvoice.update({
            where: { id },
            data: {
              estado: 'EMITIDA',
              fechaEmision: new Date(),
              cae: cae || null,
              fechaVtoCae: fechaVtoCae ? new Date(fechaVtoCae) : null,
            }
          });

          // Actualizar cantidades facturadas en la orden
          if (factura.saleId) {
            for (const item of factura.items) {
              if (item.saleItemId) {
                await tx.saleItem.update({
                  where: { id: item.saleItemId },
                  data: { cantidadFacturada: { increment: item.cantidad } }
                });
              }
            }
          }

          // Crear movimiento en cuenta corriente (ledger inmutable)
          const ledgerEntry = await tx.clientLedgerEntry.create({
            data: {
              clientId: factura.clientId,
              tipo: 'FACTURA',
              facturaId: factura.id,
              comprobante: factura.numero,
              fecha: new Date(),
              debe: Number(factura.total),
              haber: 0,
              descripcion: `Factura ${factura.numero}`,
              companyId: user!.companyId,
            }
          });

          // Actualizar deuda del cliente
          await tx.client.update({
            where: { id: factura.clientId },
            data: {
              currentBalance: { increment: Number(factura.total) }
            }
          });

          // Verificar si la orden está completamente facturada
          // Check by comparing invoiced quantities from SalesInvoiceItem with SaleItem quantities
          if (factura.saleId) {
            const orden = await tx.sale.findUnique({
              where: { id: factura.saleId },
              include: {
                items: {
                  include: {
                    invoiceItems: {
                      where: {
                        invoice: {
                          estado: { notIn: ['ANULADA', 'CANCELADA'] }
                        }
                      }
                    }
                  }
                }
              }
            });

            const todoFacturado = orden?.items.every(saleItem => {
              const totalInvoiced = saleItem.invoiceItems.reduce(
                (sum, ii) => sum + Number(ii.cantidad),
                0
              );
              return totalInvoiced >= Number(saleItem.cantidad);
            });

            if (todoFacturado) {
              await tx.sale.update({
                where: { id: factura.saleId },
                data: { estado: 'FACTURADA' }
              });
            }
          }

          return { updated, ledgerEntry };
        });

        await logInvoiceEmitted({
          invoiceId: id,
          companyId: user!.companyId,
          userId: user!.id,
          invoiceNumber: factura.numero,
          amount: Number(factura.total),
          clientId: factura.clientId,
          clientName: factura.client.legalName,
        });

        return NextResponse.json({ message: 'Factura emitida', factura: facturaEmitida.updated });

      case 'anular':
        if (!['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(factura.estado)) {
          return NextResponse.json({ error: 'Solo se pueden anular facturas emitidas' }, { status: 400 });
        }
        if (!motivo) {
          return NextResponse.json({ error: 'Motivo de anulación requerido' }, { status: 400 });
        }

        const facturaAnulada = await prisma.$transaction(async (tx) => {
          const updated = await tx.salesInvoice.update({
            where: { id },
            data: {
              estado: 'ANULADA',
              motivoAnulacion: motivo,
              fechaAnulacion: new Date(),
            }
          });

          // Contraasiento en el ledger (inmutable)
          await tx.clientLedgerEntry.create({
            data: {
              clientId: factura.clientId,
              tipo: 'ANULACION',
              facturaId: factura.id,
              comprobante: factura.numero,
              fecha: new Date(),
              debe: 0,
              haber: Number(factura.saldoPendiente || factura.total),
              descripcion: `Anulación Factura ${factura.numero}: ${motivo}`,
              companyId: user!.companyId,
            }
          });

          // Reducir deuda del cliente
          await tx.client.update({
            where: { id: factura.clientId },
            data: {
              currentBalance: { decrement: Number(factura.saldoPendiente || factura.total) }
            }
          });

          return updated;
        });

        await logInvoiceVoided({
          invoiceId: id,
          companyId: user!.companyId,
          userId: user!.id,
          invoiceNumber: factura.numero,
          reason: motivo,
        });

        return NextResponse.json({ message: 'Factura anulada', factura: facturaAnulada });

      default:
        // Edición de borrador
        if (factura.estado !== 'BORRADOR') {
          return NextResponse.json({ error: 'Solo se pueden editar facturas en borrador' }, { status: 400 });
        }

        const { fechaVencimiento, condicionesPago, notas } = body;
        const facturaEditada = await prisma.salesInvoice.update({
          where: { id },
          data: {
            ...(fechaVencimiento && { fechaVencimiento: new Date(fechaVencimiento) }),
            ...(condicionesPago !== undefined && { condicionesPago }),
            ...(notas !== undefined && { notas }),
          }
        });

        return NextResponse.json(facturaEditada);
    }
  } catch (error) {
    console.error('Error updating factura:', error);
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 });
  }
}

// DELETE - Eliminar factura en borrador
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VOID);
    if (error) return error;

    // ViewMode - filtrar según modo activo
    const viewMode = getViewMode(request);

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // Verificar que existe y es accesible en el ViewMode actual
    const factura = await prisma.salesInvoice.findFirst({
      where: applyViewMode({ id, companyId: user!.companyId }, viewMode)
    });

    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    if (factura.estado !== 'BORRADOR') {
      return NextResponse.json({ error: 'Solo se pueden eliminar facturas en borrador' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.salesInvoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.salesInvoice.delete({ where: { id } });
    });

    return NextResponse.json({ message: 'Factura eliminada' });
  } catch (error) {
    console.error('Error deleting factura:', error);
    return NextResponse.json({ error: 'Error al eliminar factura' }, { status: 500 });
  }
}
