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

// POST - Sincronizar movimientos de cuenta corriente
// Esto regenera los movimientos a partir de facturas, pagos y NC/ND existentes
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
    const { supplierId, force } = body;

    let stats = {
      facturasCreadas: 0,
      pagosCreados: 0,
      notasCreadas: 0,
      movimientosExistentes: 0
    };

    // Filtro opcional por proveedor
    const supplierFilter = supplierId ? { proveedorId: parseInt(supplierId) } : {};

    // 1. Sincronizar facturas
    const facturas = await prisma.purchaseReceipt.findMany({
      where: {
        companyId,
        ...supplierFilter
      }
    });

    for (const factura of facturas) {
      const existente = await prisma.supplierAccountMovement.findFirst({
        where: {
          facturaId: factura.id,
          tipo: 'FACTURA'
        }
      });

      if (!existente) {
        await prisma.supplierAccountMovement.create({
          data: {
            supplierId: factura.proveedorId,
            companyId,
            tipo: 'FACTURA',
            facturaId: factura.id,
            fecha: factura.fechaEmision,
            fechaVencimiento: factura.fechaVencimiento,
            debe: factura.total,
            haber: 0,
            comprobante: `${factura.numeroSerie}-${factura.numeroFactura}`,
            descripcion: `Factura ${factura.tipo} ${factura.numeroSerie}-${factura.numeroFactura}`,
            createdBy: factura.userId
          }
        });
        stats.facturasCreadas++;
      } else {
        stats.movimientosExistentes++;
        // Opcionalmente actualizar si force=true
        if (force) {
          await prisma.supplierAccountMovement.update({
            where: { id: existente.id },
            data: {
              debe: factura.total,
              fecha: factura.fechaEmision,
              fechaVencimiento: factura.fechaVencimiento,
              comprobante: `${factura.numeroSerie}-${factura.numeroFactura}`
            }
          });
        }
      }
    }

    // 2. Sincronizar pagos (órdenes de pago)
    const pagos = await prisma.paymentOrder.findMany({
      where: {
        companyId,
        ...(supplierId ? { proveedorId: parseInt(supplierId) } : {})
      }
    });

    for (const pago of pagos) {
      // Movimiento principal del pago
      const existentePago = await prisma.supplierAccountMovement.findFirst({
        where: {
          pagoId: pago.id,
          tipo: 'PAGO'
        }
      });

      if (!existentePago) {
        // Determinar método de pago principal
        let metodoPago = 'OTROS';
        if (Number(pago.efectivo) > 0) metodoPago = 'EFECTIVO';
        else if (Number(pago.transferencia) > 0) metodoPago = 'TRANSFERENCIA';
        else if (Number(pago.chequesTerceros) > 0 || Number(pago.chequesPropios) > 0) metodoPago = 'CHEQUE';
        else if (Number(pago.dolares) > 0) metodoPago = 'DOLARES';

        await prisma.supplierAccountMovement.create({
          data: {
            supplierId: pago.proveedorId,
            companyId,
            tipo: 'PAGO',
            pagoId: pago.id,
            fecha: pago.fechaPago,
            debe: 0,
            haber: pago.totalPago,
            comprobante: `OP-${pago.id}`,
            descripcion: `Orden de Pago #${pago.id}`,
            metodoPago,
            createdBy: pago.createdBy
          }
        });
        stats.pagosCreados++;

        // Crear movimiento de anticipo si existe
        if (Number(pago.anticipo) > 0) {
          await prisma.supplierAccountMovement.create({
            data: {
              supplierId: pago.proveedorId,
              companyId,
              tipo: 'ANTICIPO',
              pagoId: pago.id,
              fecha: pago.fechaPago,
              debe: 0,
              haber: pago.anticipo,
              comprobante: `ANT-${pago.id}`,
              descripcion: 'Anticipo a proveedor',
              createdBy: pago.createdBy
            }
          });
        }

        // Crear movimientos de retenciones
        if (Number(pago.retIVA) > 0) {
          await prisma.supplierAccountMovement.create({
            data: {
              supplierId: pago.proveedorId,
              companyId,
              tipo: 'RETENCION',
              pagoId: pago.id,
              fecha: pago.fechaPago,
              debe: 0,
              haber: pago.retIVA,
              comprobante: `RET-IVA-${pago.id}`,
              descripcion: 'Retención IVA',
              createdBy: pago.createdBy
            }
          });
        }

        if (Number(pago.retGanancias) > 0) {
          await prisma.supplierAccountMovement.create({
            data: {
              supplierId: pago.proveedorId,
              companyId,
              tipo: 'RETENCION',
              pagoId: pago.id,
              fecha: pago.fechaPago,
              debe: 0,
              haber: pago.retGanancias,
              comprobante: `RET-GAN-${pago.id}`,
              descripcion: 'Retención Ganancias',
              createdBy: pago.createdBy
            }
          });
        }

        if (Number(pago.retIngBrutos) > 0) {
          await prisma.supplierAccountMovement.create({
            data: {
              supplierId: pago.proveedorId,
              companyId,
              tipo: 'RETENCION',
              pagoId: pago.id,
              fecha: pago.fechaPago,
              debe: 0,
              haber: pago.retIngBrutos,
              comprobante: `RET-IIBB-${pago.id}`,
              descripcion: 'Retención Ingresos Brutos',
              createdBy: pago.createdBy
            }
          });
        }
      } else {
        stats.movimientosExistentes++;
      }
    }

    // 3. Sincronizar notas de crédito/débito
    const notas = await prisma.creditDebitNote.findMany({
      where: {
        companyId,
        ...(supplierId ? { proveedorId: parseInt(supplierId) } : {})
      }
    });

    for (const nota of notas) {
      const existenteNota = await prisma.supplierAccountMovement.findFirst({
        where: {
          notaCreditoDebitoId: nota.id
        }
      });

      if (!existenteNota) {
        await prisma.supplierAccountMovement.create({
          data: {
            supplierId: nota.proveedorId,
            companyId,
            tipo: nota.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND',
            notaCreditoDebitoId: nota.id,
            fecha: nota.fechaEmision,
            debe: nota.tipo === 'NOTA_DEBITO' ? nota.total : 0,
            haber: nota.tipo === 'NOTA_CREDITO' ? nota.total : 0,
            comprobante: nota.numero,
            descripcion: `${nota.tipo === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'} ${nota.numero}`,
            createdBy: nota.createdBy
          }
        });
        stats.notasCreadas++;
      } else {
        stats.movimientosExistentes++;
      }
    }

    // 4. Recalcular saldos acumulados
    await prisma.$executeRaw`
      WITH ordered_movements AS (
        SELECT
          id,
          "supplierId",
          "fecha",
          "debe",
          "haber",
          SUM("debe" - "haber") OVER (
            PARTITION BY "supplierId"
            ORDER BY "fecha", id
          ) as running_balance
        FROM "SupplierAccountMovement"
        WHERE "companyId" = ${companyId}
        ${supplierId ? prisma.$queryRaw`AND "supplierId" = ${parseInt(supplierId)}` : prisma.$queryRaw``}
      )
      UPDATE "SupplierAccountMovement" sam
      SET "saldoMovimiento" = om.running_balance
      FROM ordered_movements om
      WHERE sam.id = om.id
    `;

    return NextResponse.json({
      success: true,
      message: 'Sincronización completada',
      stats: {
        ...stats,
        total: stats.facturasCreadas + stats.pagosCreados + stats.notasCreadas
      }
    });
  } catch (error) {
    console.error('Error syncing cuenta corriente:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar cuenta corriente' },
      { status: 500 }
    );
  }
}
