import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { invalidarCacheStock } from '@/lib/compras/cache';

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
 * POST - Enviar devolución (cambia estado a ENVIADA y crea movimientos de stock)
 *
 * IMPORTANTE:
 * - Este endpoint SOLO mueve stock (crea StockMovement tipo SALIDA_DEVOLUCION)
 * - NO afecta cuenta corriente (eso lo hace la NCA al aplicarse)
 * - Incluye validaciones anti-fraude y control de idempotencia
 *
 * Validaciones:
 * 1. Estado debe ser APROBADA_PROVEEDOR
 * 2. Idempotencia: flag stockMovementCreated + constraint único en BD
 * 3. Stock suficiente en el depósito origen
 * 4. No devolver más de lo recibido (menos lo ya devuelto)
 * 5. Warehouse match con GoodsReceiptItem si hay trazabilidad
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

    // Leer body con datos de envío
    let envioData: {
      carrier?: string;
      trackingNumber?: string;
      evidenciaEnvio?: string;
      notas?: string;
    } = {};

    try {
      const body = await request.json();
      envioData = {
        ...(body.carrier && { carrier: body.carrier }),
        ...(body.trackingNumber && { trackingNumber: body.trackingNumber }),
        ...(body.evidenciaEnvio && { evidenciaEnvio: body.evidenciaEnvio }),
        ...(body.notas && { notas: body.notas }),
      };
    } catch {
      // Body vacío, continuar sin datos adicionales
    }

    // Ejecutar todo en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener devolución con items y relaciones necesarias
      const devolucion = await tx.purchaseReturn.findFirst({
        where: { id, companyId },
        include: {
          items: {
            include: {
              supplierItem: {
                select: { id: true, nombre: true, unidad: true, codigoProveedor: true }
              },
              goodsReceiptItem: {
                include: {
                  goodsReceipt: {
                    select: { warehouseId: true, docType: true }
                  }
                }
              }
            }
          },
          goodsReceipt: {
            select: { warehouseId: true, docType: true, numero: true }
          },
          warehouse: {
            select: { id: true, codigo: true, nombre: true }
          }
        }
      });

      if (!devolucion) {
        throw new Error('Devolución no encontrada');
      }

      // 2. Validar estado actual
      if (devolucion.estado !== 'APROBADA_PROVEEDOR') {
        throw new Error(
          `La devolución debe estar aprobada por el proveedor para enviar. ` +
          `Estado actual: ${devolucion.estado}`
        );
      }

      // 3. IDEMPOTENCIA: Si ya se creó el stock movement, no duplicar
      if (devolucion.stockMovementCreated) {
        throw new Error(
          'El stock ya fue descontado para esta devolución. ' +
          'No se puede enviar dos veces.'
        );
      }

      // 4. Validar que hay un depósito definido
      // Prioridad: warehouseId de la devolución > warehouseId del GoodsReceipt
      const warehouseId = devolucion.warehouseId || devolucion.goodsReceipt?.warehouseId;
      if (!warehouseId) {
        throw new Error(
          'No se encontró depósito de origen. ' +
          'Debe especificar de qué depósito sale la mercadería.'
        );
      }

      // 5. Validar que hay items
      if (devolucion.items.length === 0) {
        throw new Error('La devolución no tiene items para enviar');
      }

      // Determinar docType a usar para los movimientos
      // Prioridad: PurchaseReturn docType > GoodsReceipt docType > default T1
      const docType = devolucion.docType || devolucion.goodsReceipt?.docType || 'T1';

      const stockMovements = [];
      const stockUpdates = [];
      const erroresValidacion: string[] = [];

      // 6. VALIDACIONES ANTI-FRAUDE por cada item
      for (const item of devolucion.items) {
        const cantidad = new Decimal(item.cantidad);

        // 6a. Obtener stock actual en el depósito
        const stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId,
              supplierItemId: item.supplierItemId
            }
          }
        });

        const stockDisponible = stockLocation?.cantidad || new Decimal(0);

        // 6b. Validar stock suficiente
        if (stockDisponible.lt(cantidad)) {
          erroresValidacion.push(
            `Item "${item.supplierItem?.nombre || item.descripcion}" (ID: ${item.supplierItemId}): ` +
            `Stock insuficiente. Disponible: ${stockDisponible.toFixed(4)}, Requerido: ${cantidad.toFixed(4)}`
          );
          continue; // Seguir validando otros items para reportar todos los errores
        }

        // 6c. Validar trazabilidad (si tiene goodsReceiptItemId)
        if (item.goodsReceiptItemId && item.goodsReceiptItem) {
          // Verificar que el warehouse coincide
          const grWarehouseId = item.goodsReceiptItem.goodsReceipt?.warehouseId;
          if (grWarehouseId && grWarehouseId !== warehouseId) {
            erroresValidacion.push(
              `Item "${item.descripcion}": El depósito de la devolución (${warehouseId}) ` +
              `no coincide con el depósito de recepción original (${grWarehouseId})`
            );
          }

          // 6d. No devolver más de lo recibido (menos lo ya devuelto por otras devoluciones)
          const grItem = item.goodsReceiptItem;
          const cantidadRecibida = new Decimal(grItem.quantity);

          // Buscar cuánto ya se devolvió de este item de recepción
          const yaDevuelto = await tx.purchaseReturnItem.aggregate({
            where: {
              goodsReceiptItemId: item.goodsReceiptItemId,
              return: {
                estado: { in: ['ENVIADA', 'RECIBIDA_PROVEEDOR', 'RESUELTA'] },
                id: { not: devolucion.id }, // Excluir esta misma devolución
                companyId
              }
            },
            _sum: { cantidad: true }
          });

          const totalYaDevuelto = new Decimal(yaDevuelto._sum.cantidad || 0);
          const disponibleDevolver = cantidadRecibida.sub(totalYaDevuelto);

          if (cantidad.gt(disponibleDevolver)) {
            erroresValidacion.push(
              `Item "${item.descripcion}": Solo puede devolver ${disponibleDevolver.toFixed(4)} unidades. ` +
              `(Recibido: ${cantidadRecibida.toFixed(4)}, Ya devuelto: ${totalYaDevuelto.toFixed(4)})`
            );
          }
        }
      }

      // Si hay errores de validación, abortar
      if (erroresValidacion.length > 0) {
        throw new Error(
          'Validación fallida:\n' + erroresValidacion.join('\n')
        );
      }

      // 7. Ahora sí, crear movimientos de SALIDA
      for (const item of devolucion.items) {
        const cantidad = new Decimal(item.cantidad);

        const stockLocation = await tx.stockLocation.findUnique({
          where: {
            warehouseId_supplierItemId: {
              warehouseId,
              supplierItemId: item.supplierItemId
            }
          }
        });

        if (!stockLocation) {
          // Esto no debería pasar después de las validaciones, pero por seguridad
          throw new Error(`Stock location no encontrado para item ${item.supplierItemId}`);
        }

        const cantidadAnterior = stockLocation.cantidad;
        const cantidadPosterior = new Decimal(cantidadAnterior).sub(cantidad);

        // Obtener precio de referencia para el movimiento
        const costoUnitario = item.precioReferencia
          || item.goodsReceiptItem?.precioUnitario
          || null;

        // Crear movimiento de salida
        // La constraint unique_return_movement garantiza idempotencia a nivel de BD
        try {
          const movimiento = await tx.stockMovement.create({
            data: {
              tipo: 'SALIDA_DEVOLUCION',
              cantidad,
              cantidadAnterior,
              cantidadPosterior,
              costoUnitario: costoUnitario || undefined,
              costoTotal: costoUnitario
                ? new Decimal(costoUnitario.toString()).mul(cantidad)
                : undefined,
              supplierItemId: item.supplierItemId,
              warehouseId,
              purchaseReturnId: devolucion.id,
              // Códigos para trazabilidad en kardex
              codigoProveedor: item.supplierItem?.codigoProveedor || null,
              descripcionItem: item.descripcion || item.supplierItem?.nombre || null,
              motivo: `Devolución ${devolucion.numero}`,
              sourceNumber: devolucion.numero,
              notas: `Enviado por ${user.name}. ${envioData.notas || ''}`.trim(),
              docType: docType as any,
              companyId,
              createdBy: user.id
            }
          });

          stockMovements.push(movimiento);
        } catch (error: any) {
          // Si falla por constraint único, es un intento de duplicación
          if (error.code === 'P2002' && error.meta?.target?.includes('unique_return_movement')) {
            throw new Error(
              `Error de idempotencia: Ya existe un movimiento de stock para este item ` +
              `en esta devolución. Posible intento de duplicación.`
            );
          }
          throw error;
        }

        // Actualizar StockLocation
        await tx.stockLocation.update({
          where: { id: stockLocation.id },
          data: {
            cantidad: cantidadPosterior
          }
        });

        stockUpdates.push({
          supplierItemId: item.supplierItemId,
          descripcion: item.descripcion || item.supplierItem?.nombre,
          cantidadAnterior: cantidadAnterior.toNumber(),
          cantidadPosterior: cantidadPosterior.toNumber(),
          cantidadDescontada: cantidad.toNumber()
        });
      }

      // 8. Cambiar estado y marcar flags
      const devolucionActualizada = await tx.purchaseReturn.update({
        where: { id: devolucion.id },
        data: {
          estado: 'ENVIADA',
          fechaEnvio: new Date(),
          stockMovementCreated: true, // Flag de idempotencia
          warehouseId, // Guardar el warehouse usado
          ...(envioData.carrier && { carrier: envioData.carrier }),
          ...(envioData.trackingNumber && { trackingNumber: envioData.trackingNumber }),
          ...(envioData.evidenciaEnvio && { evidenciaEnvio: envioData.evidenciaEnvio }),
          ...(envioData.notas && { notas: devolucion.notas ? `${devolucion.notas}\n${envioData.notas}` : envioData.notas }),
        }
      });

      // 9. Registrar en auditoría
      await tx.purchaseAuditLog.create({
        data: {
          entidad: 'purchase_return',
          entidadId: id,
          accion: 'ENVIAR',
          datosAnteriores: {
            estado: 'APROBADA_PROVEEDOR',
            stockMovementCreated: false
          },
          datosNuevos: {
            estado: 'ENVIADA',
            stockMovementCreated: true,
            movimientosCreados: stockMovements.length,
            stockUpdates,
            envio: {
              carrier: envioData.carrier,
              trackingNumber: envioData.trackingNumber,
              tieneEvidencia: !!envioData.evidenciaEnvio
            }
          },
          companyId,
          userId: user.id,
          docType: docType as any
        }
      });

      return {
        devolucionId: id,
        numero: devolucion.numero,
        movimientosCreados: stockMovements.length,
        stockActualizado: stockUpdates,
        warehouseId,
        warehouseNombre: devolucion.warehouse?.nombre || 'N/A'
      };
    });

    // Invalidar caché de stock porque se actualizó
    invalidarCacheStock(companyId);

    // Obtener devolución actualizada para respuesta
    const devolucionEnviada = await prisma.purchaseReturn.findUnique({
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
        stockMovements: {
          where: { tipo: 'SALIDA_DEVOLUCION' },
          select: {
            id: true,
            tipo: true,
            cantidad: true,
            cantidadAnterior: true,
            cantidadPosterior: true,
            createdAt: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Devolución enviada. ${resultado.movimientosCreados} movimiento(s) de stock creado(s).`,
      devolucion: devolucionEnviada,
      resumen: {
        ...resultado,
        nota: 'Stock descontado correctamente. Ahora puede crear la NCA asociada cuando el proveedor la emita.'
      }
    });
  } catch (error: any) {
    console.error('Error enviando devolucion:', error);
    return NextResponse.json(
      { error: error.message || 'Error al enviar la devolución' },
      { status: error.message?.includes('Validación fallida') ? 400 : 500 }
    );
  }
}
