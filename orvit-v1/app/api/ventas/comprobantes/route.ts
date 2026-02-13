/**
 * Comprobantes API - Unified Documents Endpoint
 *
 * Returns all sales documents in a unified view:
 * - Facturas (Invoices)
 * - Notas de Crédito (Credit Notes)
 * - Notas de Débito (Debit Notes)
 * - Remitos (Delivery Notes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, ViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

type ComprobanteType = 'FACTURA' | 'NC' | 'ND' | 'REMITO' | 'ALL';

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(req.url);

    const tipo = (searchParams.get('tipo') as ComprobanteType) || 'ALL';
    const estado = searchParams.get('estado');
    const search = searchParams.get('search');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const viewMode = (searchParams.get('viewMode') || 'S') as ViewMode;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build date filter
    const dateFilter: any = {};
    if (fechaDesde) dateFilter.gte = new Date(fechaDesde);
    if (fechaHasta) {
      const endDate = new Date(fechaHasta);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    const comprobantes: any[] = [];

    // Fetch Facturas
    if (tipo === 'ALL' || tipo === 'FACTURA') {
      const whereFacturas = applyViewMode(
        {
          companyId,
          ...(estado && { estado: estado as any }),
          ...(Object.keys(dateFilter).length > 0 && { fechaEmision: dateFilter }),
          ...(search && {
            OR: [
              { numero: { contains: search, mode: 'insensitive' as const } },
              { client: { legalName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }),
        },
        viewMode
      );

      const facturas = await prisma.salesInvoice.findMany({
        where: whereFacturas,
        include: {
          client: { select: { id: true, legalName: true, name: true } },
        },
        orderBy: { fechaEmision: 'desc' },
        take: limit,
        skip: offset,
      });

      comprobantes.push(
        ...facturas.map((f) => ({
          id: f.id,
          numero: f.numero,
          tipo: 'FACTURA' as const,
          fecha: f.fechaEmision,
          clientId: f.clientId,
          clientName: f.client.legalName || f.client.name || 'Sin nombre',
          total: Number(f.total),
          saldo: Number(f.saldoPendiente),
          estado: f.estado,
          fiscalStatus: f.estado,
        }))
      );
    }

    // Fetch Notas de Crédito/Débito
    if (tipo === 'ALL' || tipo === 'NC' || tipo === 'ND') {
      const whereNotas = applyViewMode(
        {
          companyId,
          ...(tipo !== 'ALL' && {
            tipo: tipo === 'NC' ? 'NOTA_CREDITO' : 'NOTA_DEBITO',
          }),
          ...(estado && { fiscalStatus: estado as any }),
          ...(Object.keys(dateFilter).length > 0 && { fecha: dateFilter }),
          ...(search && {
            OR: [
              { numero: { contains: search, mode: 'insensitive' as const } },
              { client: { legalName: { contains: search, mode: 'insensitive' as const } } },
            ],
          }),
        },
        viewMode
      );

      const notas = await prisma.salesCreditDebitNote.findMany({
        where: whereNotas,
        include: {
          client: { select: { id: true, legalName: true, name: true } },
        },
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset,
      });

      comprobantes.push(
        ...notas.map((n) => ({
          id: n.id,
          numero: n.numero,
          tipo: (n.tipo === 'NOTA_CREDITO' ? 'NC' : 'ND') as const,
          fecha: n.fecha,
          clientId: n.clientId,
          clientName: n.client.legalName || n.client.name || 'Sin nombre',
          total: Number(n.total),
          saldo: undefined,
          estado: n.fiscalStatus,
          fiscalStatus: n.fiscalStatus,
        }))
      );
    }

    // Fetch Remitos (from Deliveries)
    if (tipo === 'ALL' || tipo === 'REMITO') {
      const whereRemitos = applyViewMode(
        {
          companyId,
          ...(Object.keys(dateFilter).length > 0 && { fechaEntrega: dateFilter }),
          ...(search && {
            OR: [
              { numero: { contains: search, mode: 'insensitive' as const } },
              { sale: { client: { legalName: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }),
        },
        viewMode
      );

      const deliveries = await prisma.saleDelivery.findMany({
        where: whereRemitos,
        include: {
          sale: {
            include: {
              client: { select: { id: true, legalName: true, name: true } },
            },
          },
        },
        orderBy: { fechaEntrega: 'desc' },
        take: limit,
        skip: offset,
      });

      comprobantes.push(
        ...deliveries.map((d) => ({
          id: d.id,
          numero: d.numero,
          tipo: 'REMITO' as const,
          fecha: d.fechaEntrega || d.fechaProgramada || new Date(),
          clientId: d.sale?.clientId || '',
          clientName:
            d.sale?.client?.legalName || d.sale?.client?.name || 'Sin nombre',
          total: 0,
          saldo: undefined,
          estado: d.estado,
          fiscalStatus: d.estado,
        }))
      );
    }

    // Sort by date (most recent first)
    comprobantes.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Calculate stats
    const stats = {
      totalFacturas: comprobantes.filter((c) => c.tipo === 'FACTURA').length,
      totalNC: comprobantes.filter((c) => c.tipo === 'NC').length,
      totalND: comprobantes.filter((c) => c.tipo === 'ND').length,
      totalRemitos: comprobantes.filter((c) => c.tipo === 'REMITO').length,
      montoFacturas: comprobantes
        .filter((c) => c.tipo === 'FACTURA')
        .reduce((sum, c) => sum + c.total, 0),
      montoNC: comprobantes
        .filter((c) => c.tipo === 'NC')
        .reduce((sum, c) => sum + c.total, 0),
      saldoPendiente: comprobantes
        .filter((c) => c.tipo === 'FACTURA' && c.saldo)
        .reduce((sum, c) => sum + (c.saldo || 0), 0),
    };

    return NextResponse.json({
      data: comprobantes,
      stats,
      pagination: {
        total: comprobantes.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching comprobantes:', error);
    return NextResponse.json(
      { error: 'Error al obtener comprobantes' },
      { status: 500 }
    );
  }
}
