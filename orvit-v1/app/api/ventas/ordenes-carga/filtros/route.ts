import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

/**
 * GET - Obtener opciones únicas para filtros (clientes, choferes, transportistas)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo'); // 'clientes', 'choferes', 'transportistas', 'vehiculos'
    const viewMode = getViewMode(request);

    const baseWhere = applyViewMode({ companyId: user!.companyId }, viewMode);

    if (tipo === 'clientes') {
      // Get unique clients from load orders
      const loadOrders = await prisma.loadOrder.findMany({
        where: baseWhere,
        select: {
          sale: {
            select: {
              client: {
                select: {
                  id: true,
                  legalName: true,
                  name: true,
                },
              },
            },
          },
        },
        distinct: ['saleId'],
      });

      const clients = loadOrders
        .map((lo) => lo.sale.client)
        .filter((client, index, self) =>
          index === self.findIndex((c) => c.id === client.id)
        )
        .map((client) => ({
          id: client.id,
          name: client.legalName || client.name || 'Sin nombre',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return NextResponse.json(clients);
    }

    if (tipo === 'choferes') {
      // Get unique drivers
      const choferes = await prisma.loadOrder.findMany({
        where: {
          ...baseWhere,
          chofer: { not: null },
        },
        select: {
          chofer: true,
          choferDNI: true,
        },
        distinct: ['chofer'],
        orderBy: { chofer: 'asc' },
      });

      return NextResponse.json(
        choferes
          .filter((c) => c.chofer)
          .map((c) => ({
            name: c.chofer,
            dni: c.choferDNI,
          }))
      );
    }

    if (tipo === 'transportistas') {
      // Get unique carriers
      const transportistas = await prisma.loadOrder.findMany({
        where: {
          ...baseWhere,
          transportista: { not: null },
        },
        select: {
          transportista: true,
        },
        distinct: ['transportista'],
        orderBy: { transportista: 'asc' },
      });

      return NextResponse.json(
        transportistas
          .filter((t) => t.transportista)
          .map((t) => t.transportista)
      );
    }

    if (tipo === 'vehiculos') {
      // Get unique vehicles
      const vehiculos = await prisma.loadOrder.findMany({
        where: {
          ...baseWhere,
          vehiculo: { not: null },
        },
        select: {
          vehiculo: true,
          vehiculoPatente: true,
        },
        distinct: ['vehiculo'],
        orderBy: { vehiculo: 'asc' },
      });

      return NextResponse.json(
        vehiculos
          .filter((v) => v.vehiculo)
          .map((v) => ({
            name: v.vehiculo,
            patente: v.vehiculoPatente,
          }))
      );
    }

    return NextResponse.json({ error: 'Tipo de filtro no válido' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Error al obtener opciones de filtro' },
      { status: 500 }
    );
  }
}
