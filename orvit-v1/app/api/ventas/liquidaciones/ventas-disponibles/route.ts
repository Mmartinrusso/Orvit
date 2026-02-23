import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Ventas disponibles para liquidación de un vendedor en un periodo
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LIQUIDACIONES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const sellerId = searchParams.get('sellerId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    if (!sellerId || !fechaDesde || !fechaHasta) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: sellerId, fechaDesde, fechaHasta' },
        { status: 400 }
      );
    }

    const sellerIdNum = parseInt(sellerId);
    if (isNaN(sellerIdNum)) {
      return NextResponse.json({ error: 'sellerId inválido' }, { status: 400 });
    }

    // Buscar ventas del vendedor en el periodo que no estén en liquidaciones activas
    const ventas = await prisma.sale.findMany({
      where: {
        companyId,
        sellerId: sellerIdNum,
        fechaEmision: {
          gte: new Date(fechaDesde),
          lte: new Date(fechaHasta),
        },
        estado: { notIn: ['CANCELADA'] },
      },
      include: {
        client: {
          select: { id: true, legalName: true, name: true },
        },
        invoices: {
          select: {
            id: true,
            numeroCompleto: true,
            estado: true,
            total: true,
            saldoPendiente: true,
            fechaEmision: true,
            fechaVencimiento: true,
            netoGravado: true,
            iva21: true,
            iva105: true,
            condicionesPago: true,
            paymentAllocations: {
              select: {
                id: true,
                montoAplicado: true,
                fechaAplicacion: true,
                payment: {
                  select: {
                    id: true,
                    numero: true,
                    fechaPago: true,
                    estado: true,
                    efectivo: true,
                    transferencia: true,
                    chequesTerceros: true,
                    chequesPropios: true,
                    tarjetaCredito: true,
                    tarjetaDebito: true,
                    bancoOrigen: true,
                    numeroOperacion: true,
                    notas: true,
                    cheques: {
                      select: {
                        id: true,
                        tipo: true,
                        numero: true,
                        banco: true,
                        titular: true,
                        importe: true,
                        fechaVencimiento: true,
                        estado: true,
                      },
                    },
                  },
                },
              },
              orderBy: { fechaAplicacion: 'asc' as const },
            },
          },
        },
        quote: {
          select: {
            fechaEnvio: true,
          },
        },
        items: {
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            aplicaComision: true,
            costBreakdown: {
              select: { id: true, concepto: true, monto: true, orden: true },
              orderBy: { orden: 'asc' as const },
            },
          },
        },
      },
      orderBy: { fechaEmision: 'asc' },
    });

    // Filtrar ventas que ya están en liquidaciones activas (CONFIRMADA o PAGADA)
    const saleIds = ventas.map(v => v.id);
    const ventasYaLiquidadas = await prisma.sellerLiquidacionItem.findMany({
      where: {
        saleId: { in: saleIds },
        incluido: true,
        liquidacion: {
          estado: { in: ['CONFIRMADA', 'PAGADA'] },
        },
      },
      select: { saleId: true, liquidacion: { select: { id: true, numero: true, estado: true } } },
    });

    const liquidadasSet = new Set(ventasYaLiquidadas.map(v => v.saleId));
    const liquidadasMap = new Map(ventasYaLiquidadas.map(v => [v.saleId, v.liquidacion]));

    // Enriquecer ventas con info de liquidación
    const ventasEnriquecidas = ventas.map(venta => {
      const yaLiquidada = liquidadasSet.has(venta.id);
      const liquidacionRef = liquidadasMap.get(venta.id);

      // Calcular estado de cobranza
      const totalFacturado = venta.invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      const saldoPendiente = venta.invoices.reduce((sum, inv) => sum + Number(inv.saldoPendiente || 0), 0);
      const cobrado = totalFacturado - saldoPendiente;

      // Calcular base de comisión: solo ítems con aplicaComision=true
      const baseComision = venta.items
        .filter(i => i.aplicaComision)
        .reduce((sum, i) => sum + Number(i.subtotal), 0);

      return {
        ...venta,
        total: Number(venta.total),
        baseComision,
        disponible: !yaLiquidada,
        liquidacionExistente: yaLiquidada ? liquidacionRef : null,
        cobranza: {
          totalFacturado,
          cobrado,
          saldoPendiente,
          porcentajeCobrado: totalFacturado > 0 ? (cobrado / totalFacturado) * 100 : 0,
        },
      };
    });

    // Resumen
    const disponibles = ventasEnriquecidas.filter(v => v.disponible);
    const totalDisponible = disponibles.reduce((sum, v) => sum + v.total, 0);

    return NextResponse.json({
      ventas: ventasEnriquecidas,
      resumen: {
        totalVentas: ventas.length,
        ventasDisponibles: disponibles.length,
        ventasYaLiquidadas: ventasYaLiquidadas.length,
        totalDisponible,
      },
    });
  } catch (error) {
    console.error('Error fetching ventas disponibles:', error);
    return NextResponse.json(
      { error: 'Error al obtener ventas disponibles' },
      { status: 500 }
    );
  }
}
