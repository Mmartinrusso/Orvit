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
 * POST - Reparar historial de precios para facturas pagadas sin historial
 *
 * Este endpoint corrige el bug donde el historial de precios no se creaba
 * porque se usaba `receiptId` en lugar de `comprobanteId` en el where clause.
 *
 * Solo ejecutar una vez para corregir datos históricos.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Solo admins pueden ejecutar esto
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden ejecutar esta corrección' }, { status: 403 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') !== 'false'; // Por defecto es dry run
    const limit = parseInt(searchParams.get('limit') || '100');

    // Buscar facturas pagadas que tienen items con precio pero sin historial
    const facturasPagadas = await prisma.purchaseReceipt.findMany({
      where: {
        companyId,
        estado: 'pagada',
        docType: { in: ['T1', null] }, // Solo T1
      },
      select: {
        id: true,
        numeroSerie: true,
        numeroFactura: true,
        fechaEmision: true,
        total: true,
        items: {
          select: {
            id: true,
            itemId: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
          }
        }
      },
      take: limit,
      orderBy: { fechaEmision: 'desc' }
    });

    const resultados: Array<{
      facturaId: number;
      numero: string;
      itemsCorregidos: number;
      itemsSinSupplierItem: number;
      itemsYaTenianHistorial: number;
    }> = [];

    let totalCorregidos = 0;
    let totalSinSupplierItem = 0;
    let totalYaTenianHistorial = 0;

    for (const factura of facturasPagadas) {
      let itemsCorregidos = 0;
      let itemsSinSupplierItem = 0;
      let itemsYaTenianHistorial = 0;

      for (const item of factura.items) {
        // Solo procesar items con supplierItemId y precio
        if (!item.itemId || !item.precioUnitario) {
          itemsSinSupplierItem++;
          continue;
        }

        const precioUnitario = Number(item.precioUnitario);
        if (precioUnitario <= 0) {
          itemsSinSupplierItem++;
          continue;
        }

        // Verificar si ya existe historial para este item en esta factura
        const existeHistorial = await prisma.priceHistory.findFirst({
          where: {
            supplierItemId: item.itemId,
            comprobanteId: factura.id,
          }
        });

        if (existeHistorial) {
          itemsYaTenianHistorial++;
          continue;
        }

        // Crear historial de precios
        if (!dryRun) {
          await prisma.priceHistory.create({
            data: {
              supplierItemId: item.itemId,
              precioUnitario: precioUnitario,
              comprobanteId: factura.id,
              fecha: factura.fechaEmision,
              companyId,
            }
          });

          // También actualizar el precio actual del SupplierItem si es más reciente
          const supplierItem = await prisma.supplierItem.findUnique({
            where: { id: item.itemId },
            select: { precioUnitario: true }
          });

          // Si el supplierItem no tiene precio o tiene precio 0, actualizar
          if (!supplierItem?.precioUnitario || Number(supplierItem.precioUnitario) === 0) {
            await prisma.supplierItem.update({
              where: { id: item.itemId },
              data: { precioUnitario: precioUnitario }
            });
          }
        }

        itemsCorregidos++;
      }

      if (itemsCorregidos > 0 || itemsSinSupplierItem > 0) {
        resultados.push({
          facturaId: factura.id,
          numero: `${factura.numeroSerie}-${factura.numeroFactura}`,
          itemsCorregidos,
          itemsSinSupplierItem,
          itemsYaTenianHistorial,
        });
      }

      totalCorregidos += itemsCorregidos;
      totalSinSupplierItem += itemsSinSupplierItem;
      totalYaTenianHistorial += itemsYaTenianHistorial;
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? 'Simulación completada. Use ?dryRun=false para aplicar cambios.'
        : 'Corrección aplicada exitosamente.',
      resumen: {
        facturasAnalizadas: facturasPagadas.length,
        totalItemsCorregidos: totalCorregidos,
        totalItemsSinSupplierItem: totalSinSupplierItem,
        totalItemsYaTenianHistorial: totalYaTenianHistorial,
      },
      detalle: resultados.slice(0, 20), // Mostrar máximo 20 para no saturar
    });
  } catch (error) {
    console.error('Error en fix-price-history:', error);
    return NextResponse.json(
      { error: 'Error al corregir historial de precios' },
      { status: 500 }
    );
  }
}

/**
 * GET - Ver estadísticas de facturas sin historial de precios
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

    // Contar facturas pagadas
    const totalFacturasPagadas = await prisma.purchaseReceipt.count({
      where: {
        companyId,
        estado: 'pagada',
        docType: { in: ['T1', null] },
      }
    });

    // Contar items en facturas pagadas con supplierItemId
    const itemsConSupplierItem = await prisma.purchaseReceiptItem.count({
      where: {
        companyId,
        itemId: { not: null },
        comprobante: {
          estado: 'pagada',
          docType: { in: ['T1', null] },
        }
      }
    });

    // Contar registros de historial de precios
    const registrosHistorial = await prisma.priceHistory.count({
      where: { companyId }
    });

    return NextResponse.json({
      estadisticas: {
        facturasPagadas: totalFacturasPagadas,
        itemsConSupplierItem: itemsConSupplierItem,
        registrosHistorialPrecios: registrosHistorial,
        potencialFaltante: Math.max(0, itemsConSupplierItem - registrosHistorial),
      },
      instrucciones: {
        verificar: 'GET /api/compras/fix-price-history - Ver estas estadísticas',
        simular: 'POST /api/compras/fix-price-history?dryRun=true - Simular corrección',
        aplicar: 'POST /api/compras/fix-price-history?dryRun=false - Aplicar corrección',
        limite: 'Agregar &limit=N para procesar N facturas a la vez',
      }
    });
  } catch (error) {
    console.error('Error en fix-price-history GET:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
