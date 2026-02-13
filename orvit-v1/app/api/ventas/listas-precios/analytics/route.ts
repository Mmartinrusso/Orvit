import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener analytics y estadísticas de listas de precios
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.LISTAS_PRECIOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    try {
      // Obtener todas las listas con items
      const listas = await (prisma as any).salesPriceList.findMany({
        where: { companyId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  costPrice: true,
                  salePrice: true,
                }
              }
            }
          },
          _count: {
            select: { items: true }
          }
        },
      });

      // Obtener clientes que usan cada lista
      const clientsPerList = await prisma.client.groupBy({
        by: ['defaultPriceListId'],
        where: {
          companyId,
          defaultPriceListId: { not: null },
        },
        _count: true,
      });

      const clientsMap = new Map(
        clientsPerList.map(c => [c.defaultPriceListId, c._count])
      );

      // Calcular estadísticas generales
      const totalListas = listas.length;
      const listasActivas = listas.filter((l: any) => l.isActive).length;
      const listasInactivas = totalListas - listasActivas;
      const listaDefault = listas.find((l: any) => l.esDefault);

      // Por moneda
      const porMoneda = listas.reduce((acc: any, l: any) => {
        acc[l.moneda] = (acc[l.moneda] || 0) + 1;
        return acc;
      }, {});

      // Productos por lista
      const productCounts = listas.map((l: any) => l.items.length);
      const totalProductosEnListas = productCounts.reduce((sum, count) => sum + count, 0);
      const promedioProductosPorLista = totalListas > 0 ? totalProductosEnListas / totalListas : 0;
      const maxProductos = productCounts.length > 0 ? Math.max(...productCounts) : 0;
      const minProductos = productCounts.length > 0 ? Math.min(...productCounts) : 0;

      // Listas con más y menos productos
      const listaConMasProductos = listas.reduce((max: any, l: any) =>
        !max || l.items.length > max.items.length ? l : max, null
      );
      const listaConMenosProductos = listas.reduce((min: any, l: any) =>
        !min || (l.items.length < min.items.length && l.items.length > 0) ? l : min, null
      );

      // Análisis de precios
      const allPrices: number[] = [];
      const allMargins: number[] = [];

      listas.forEach((lista: any) => {
        lista.items.forEach((item: any) => {
          const precio = parseFloat(item.precioUnitario || 0);
          if (precio > 0) {
            allPrices.push(precio);

            // Calcular margen si hay costo
            const costo = parseFloat(item.product?.costPrice || 0);
            if (costo > 0 && precio > costo) {
              const margen = ((precio - costo) / precio) * 100;
              allMargins.push(margen);
            }
          }
        });
      });

      const precioPromedio = allPrices.length > 0
        ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
        : 0;
      const precioMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
      const precioMax = allPrices.length > 0 ? Math.max(...allPrices) : 0;

      const margenPromedio = allMargins.length > 0
        ? allMargins.reduce((sum, m) => sum + m, 0) / allMargins.length
        : 0;

      // Listas por uso (clientes asignados)
      const listasConClientes = listas.map((lista: any) => ({
        id: lista.id,
        nombre: lista.nombre,
        clientesAsignados: clientsMap.get(lista.id) || 0,
      })).sort((a, b) => b.clientesAsignados - a.clientesAsignados);

      const totalClientesConLista = Array.from(clientsMap.values()).reduce((sum, count) => sum + count, 0);

      // Listas sin productos
      const listasSinProductos = listas.filter((l: any) => l.items.length === 0);

      // Listas sin clientes asignados
      const listasSinClientes = listas.filter((l: any) => !clientsMap.has(l.id) || clientsMap.get(l.id) === 0);

      // Ranking de listas por utilidad
      const ranking = listas.map((lista: any) => {
        const items = lista.items.length;
        const clientes = clientsMap.get(lista.id) || 0;
        const activa = lista.isActive ? 1 : 0;
        const esDefault = lista.esDefault ? 1 : 0;

        // Score simple: items + clientes*10 + activa*5 + default*20
        const score = items + (clientes * 10) + (activa * 5) + (esDefault * 20);

        return {
          id: lista.id,
          nombre: lista.nombre,
          moneda: lista.moneda,
          items,
          clientes,
          activa: lista.isActive,
          esDefault: lista.esDefault,
          score,
        };
      }).sort((a, b) => b.score - a.score);

      const response = {
        resumen: {
          totalListas,
          listasActivas,
          listasInactivas,
          listaDefaultId: listaDefault?.id || null,
          listaDefaultNombre: listaDefault?.nombre || null,
        },
        distribucion: {
          porMoneda,
          productos: {
            total: totalProductosEnListas,
            promedio: parseFloat(promedioProductosPorLista.toFixed(2)),
            maximo: maxProductos,
            minimo: minProductos,
          },
          clientes: {
            totalConListaAsignada: totalClientesConLista,
            promedioClientesPorLista: totalListas > 0
              ? parseFloat((totalClientesConLista / totalListas).toFixed(2))
              : 0,
          },
        },
        analisisPrecios: {
          totalPrecios: allPrices.length,
          precioPromedio: parseFloat(precioPromedio.toFixed(2)),
          precioMinimo: parseFloat(precioMin.toFixed(2)),
          precioMaximo: parseFloat(precioMax.toFixed(2)),
          margenPromedio: parseFloat(margenPromedio.toFixed(2)),
          productosConMargen: allMargins.length,
        },
        topListas: {
          conMasProductos: listaConMasProductos ? {
            id: listaConMasProductos.id,
            nombre: listaConMasProductos.nombre,
            productos: listaConMasProductos.items.length,
          } : null,
          conMenosProductos: listaConMenosProductos ? {
            id: listaConMenosProductos.id,
            nombre: listaConMenosProductos.nombre,
            productos: listaConMenosProductos.items.length,
          } : null,
          masUtilizadas: listasConClientes.slice(0, 5),
        },
        alertas: {
          listasSinProductos: listasSinProductos.length,
          listasSinClientes: listasSinClientes.length,
          listasInactivas: listasInactivas,
          detalleListasSinProductos: listasSinProductos.map((l: any) => ({
            id: l.id,
            nombre: l.nombre,
          })),
          detalleListasSinClientes: listasSinClientes.map((l: any) => ({
            id: l.id,
            nombre: l.nombre,
          })),
        },
        ranking: ranking.slice(0, 10),
        ultimasActualizaciones: listas
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
          .map((l: any) => ({
            id: l.id,
            nombre: l.nombre,
            updatedAt: l.updatedAt,
            items: l.items.length,
          })),
      };

      return NextResponse.json(response);
    } catch (error: any) {
      if (error.message?.includes('Unknown model')) {
        // Fallback con raw SQL
        const listas = await prisma.$queryRaw`
          SELECT * FROM "sales_price_lists" WHERE "companyId" = ${companyId}
        ` as any[];

        const items = await prisma.$queryRaw`
          SELECT "priceListId", COUNT(*) as count
          FROM "sales_price_list_items"
          WHERE "priceListId" IN (SELECT id FROM "sales_price_lists" WHERE "companyId" = ${companyId})
          GROUP BY "priceListId"
        ` as any[];

        const itemsMap = new Map(items.map((i: any) => [i.priceListId, parseInt(i.count)]));

        const clients = await prisma.$queryRaw`
          SELECT "defaultPriceListId", COUNT(*) as count
          FROM "Client"
          WHERE "companyId" = ${companyId} AND "defaultPriceListId" IS NOT NULL
          GROUP BY "defaultPriceListId"
        ` as any[];

        const clientsMap = new Map(clients.map((c: any) => [c.defaultPriceListId, parseInt(c.count)]));

        const totalListas = listas.length;
        const listasActivas = listas.filter((l: any) => l.isActive).length;
        const listaDefault = listas.find((l: any) => l.esDefault);

        const response = {
          resumen: {
            totalListas,
            listasActivas,
            listasInactivas: totalListas - listasActivas,
            listaDefaultId: listaDefault?.id || null,
            listaDefaultNombre: listaDefault?.nombre || null,
          },
          distribucion: {
            porMoneda: listas.reduce((acc: any, l: any) => {
              acc[l.moneda] = (acc[l.moneda] || 0) + 1;
              return acc;
            }, {}),
          },
          message: 'Analytics básico (legacy mode)',
        };

        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error getting price list analytics:', error);
    return NextResponse.json(
      { error: 'Error al obtener analytics', details: error.message },
      { status: 500 }
    );
  }
}
