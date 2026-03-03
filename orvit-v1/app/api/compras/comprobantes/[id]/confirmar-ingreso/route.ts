import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getT2Client, isT2DatabaseConfigured } from '@/lib/prisma-t2';
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
 * POST - Validar Factura
 *
 * IMPORTANTE: Este endpoint SOLO valida la factura (marca como revisada).
 * NO mueve stock ni crea GoodsReceipt.
 * El stock se mueve SOLO cuando se confirma una Recepción (GoodsReceipt).
 *
 * Para ingresar stock:
 * 1. Usar "Cargar Remito desde Factura" para crear una GoodsReceipt
 * 2. O vincular una GoodsReceipt existente
 * 3. Confirmar la GoodsReceipt con evidencia → Eso mueve el stock
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

    const { id } = await params;
    const comprobanteId = parseInt(id);

    const body = await request.json();
    const { firmaIngreso, remitoUrl, fotoIngresoUrl, depositoId } = body;

    // Buscar el comprobante en T1
    const comprobante = await prisma.purchaseReceipt.findFirst({
      where: { id: comprobanteId, companyId },
      include: {
        goodsReceipts: {
          select: { id: true, numero: true, estado: true }
        }
      }
    });

    // ================================================================
    // Si no está en T1, buscar en T2
    // ================================================================
    if (!comprobante && isT2DatabaseConfigured()) {
      try {
        const prismaT2 = getT2Client();
        const comprobanteT2 = await prismaT2.t2PurchaseReceipt.findFirst({
          where: { id: comprobanteId, companyId },
        });

        if (!comprobanteT2) {
          return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
        }

        if (comprobanteT2.ingresoConfirmado) {
          return NextResponse.json(
            { error: 'El remito ya fue cargado para este comprobante' },
            { status: 400 }
          );
        }

        // Actualizar comprobante T2 con datos del remito
        const updatedT2 = await prismaT2.t2PurchaseReceipt.update({
          where: { id: comprobanteId },
          data: {
            ingresoConfirmado: true,
            ingresoConfirmadoPor: user.id,
            ingresoConfirmadoAt: new Date(),
            firmaIngreso: firmaIngreso || null,
            remitoUrl: remitoUrl || null,
            fotoIngresoUrl: fotoIngresoUrl || null,
            depositoId: depositoId || null,
          },
        });

        // ============================================================
        // Crear stock en main DB (StockLocation + StockMovement)
        // ============================================================
        const t2Items = await prismaT2.t2PurchaseReceiptItem.findMany({
          where: { receiptId: comprobanteId },
        });

        let stockItemsCreated = 0;
        if (t2Items.length > 0 && depositoId) {
          await prisma.$transaction(async (tx) => {
            for (const item of t2Items) {
              if (!item.supplierItemId || Number(item.cantidad) <= 0) continue;

              const cantidadNueva = Number(item.cantidad);

              // Upsert StockLocation en main DB
              const existing = await tx.stockLocation.findUnique({
                where: {
                  warehouseId_supplierItemId: {
                    warehouseId: depositoId,
                    supplierItemId: item.supplierItemId,
                  },
                },
              });

              const cantidadAnterior = existing ? Number(existing.cantidad) : 0;
              const cantidadPosterior = cantidadAnterior + cantidadNueva;

              if (existing) {
                await tx.stockLocation.update({
                  where: { id: existing.id },
                  data: {
                    cantidad: cantidadPosterior,
                    costoUnitario: Number(item.precioUnitario) || undefined,
                  },
                });
              } else {
                await tx.stockLocation.create({
                  data: {
                    warehouseId: depositoId,
                    supplierItemId: item.supplierItemId,
                    cantidad: cantidadNueva,
                    cantidadReservada: 0,
                    costoUnitario: Number(item.precioUnitario) || 0,
                    companyId,
                  },
                });
              }

              // Crear StockMovement con docType T2
              await tx.stockMovement.create({
                data: {
                  tipo: 'ENTRADA_RECEPCION',
                  cantidad: cantidadNueva,
                  cantidadAnterior,
                  cantidadPosterior,
                  costoUnitario: Number(item.precioUnitario) || 0,
                  costoTotal: Number(item.subtotal) || 0,
                  supplierItemId: item.supplierItemId,
                  warehouseId: depositoId,
                  docType: 'T2',
                  sourceNumber: `T2-${updatedT2.numeroFactura}`,
                  motivo: `Ingreso comprobante T2 #${comprobanteId}`,
                  companyId,
                  createdBy: user.id,
                },
              });

              stockItemsCreated++;
            }
          });

          // También crear T2StockMovement en T2 DB (audit trail)
          for (const item of t2Items) {
            if (!item.supplierItemId || Number(item.cantidad) <= 0) continue;
            try {
              await prismaT2.t2StockMovement.create({
                data: {
                  companyId,
                  supplierItemId: item.supplierItemId,
                  warehouseId: depositoId,
                  createdBy: user.id,
                  tipo: 'ENTRADA_RECEPCION',
                  cantidad: Number(item.cantidad),
                  cantidadAnterior: 0,
                  cantidadPosterior: Number(item.cantidad),
                  costoUnitario: Number(item.precioUnitario) || 0,
                  costoTotal: Number(item.subtotal) || 0,
                  receiptId: comprobanteId,
                  sourceNumber: updatedT2.numeroFactura,
                },
              });
            } catch (e) {
              console.warn('[T2 Stock] Error creating T2StockMovement:', e);
            }
          }
        }

        console.log(`[Confirmar Ingreso T2] Remito cargado para comprobante T2: ${comprobanteId}, stock items: ${stockItemsCreated}`);

        return NextResponse.json({
          success: true,
          message: depositoId && stockItemsCreated > 0
            ? `Remito cargado correctamente. ${stockItemsCreated} items ingresados a stock.`
            : 'Remito cargado correctamente.',
          comprobante: updatedT2,
          resumen: {
            remitoCargado: true,
            fromT2: true,
            stockItemsCreated,
          },
        });
      } catch (t2Error: any) {
        console.error('[Confirmar Ingreso T2] Error:', t2Error?.message);
        return NextResponse.json(
          { error: 'Error al cargar remito en T2', details: t2Error?.message },
          { status: 500 }
        );
      }
    }

    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }

    // ================================================================
    // Flujo T1
    // ================================================================

    // Verificar si ya está validada
    if (comprobante.facturaValidada) {
      return NextResponse.json(
        { error: 'El remito ya fue cargado para este comprobante' },
        { status: 400 }
      );
    }

    // Ejecutar todo en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // Actualizar el comprobante
      const updated = await tx.purchaseReceipt.update({
        where: { id: comprobanteId },
        data: {
          facturaValidada: true,
          validadaPor: user.id,
          validadaAt: new Date(),
          ingresoConfirmado: true,
          ingresoConfirmadoPor: user.id,
          ingresoConfirmadoAt: new Date(),
          firmaIngreso: firmaIngreso || undefined,
          remitoUrl: remitoUrl || undefined,
          fotoIngresoUrl: fotoIngresoUrl || undefined,
        }
      });

      // Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'purchase_receipt',
          entidadId: comprobanteId,
          accion: 'CARGAR_REMITO',
          datosAnteriores: { ingresoConfirmado: false },
          datosNuevos: {
            ingresoConfirmado: true,
            validadaPor: user.id,
            remitoUrl: remitoUrl || null,
            nota: 'Remito cargado.'
          },
          companyId,
          userId: user.id,
        }
      });

      return { comprobante: updated };
    });

    return NextResponse.json({
      success: true,
      message: 'Remito cargado correctamente.',
      comprobante: resultado.comprobante,
      resumen: {
        remitoCargado: true,
        fromT2: false,
      },
    });
  } catch (error: any) {
    console.error('Error validando factura:', error);
    return NextResponse.json(
      { error: error.message || 'Error al validar la factura' },
      { status: 500 }
    );
  }
}

// GET - Obtener estado de validación
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
    const comprobanteId = parseInt(id);

    const comprobante = await prisma.purchaseReceipt.findFirst({
      where: { id: comprobanteId, companyId },
      select: {
        id: true,
        // Nuevos campos de validación
        facturaValidada: true,
        validadaAt: true,
        validadaByUser: {
          select: { id: true, name: true }
        },
        // Campos legacy (backward compat)
        ingresoConfirmado: true,
        ingresoConfirmadoAt: true,
        firmaIngreso: true,
        remitoUrl: true,
        fotoIngresoUrl: true,
        ingresoConfirmadoByUser: {
          select: { id: true, name: true }
        },
        // Recepciones vinculadas
        goodsReceipts: {
          select: {
            id: true,
            numero: true,
            estado: true,
            fechaRecepcion: true
          }
        },
        // Estado de match
        matchStatus: true,
        payApprovalStatus: true
      }
    });

    if (!comprobante) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    }

    return NextResponse.json(comprobante);
  } catch (error: any) {
    console.error('Error obteniendo estado de validación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener estado' },
      { status: 500 }
    );
  }
}
