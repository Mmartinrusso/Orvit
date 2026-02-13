/**
 * Bulk Operations for Invoices (Facturas) API
 *
 * Handles bulk actions on multiple invoices:
 * - bulk_emitir: Emit multiple draft invoices
 * - bulk_anular: Cancel multiple invoices
 * - bulk_export: Export invoices to CSV/Excel
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { validateTransition, InvoiceStatus } from '@/lib/ventas/state-machine';
import { logSalesStatusChange } from '@/lib/ventas/audit-helper';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Bulk operations
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_EDIT);
    if (error) return error;

    const body = await request.json();
    const { accion, invoiceIds, motivo, ...filters } = body;
    const viewMode = getViewMode(request);

    if (!accion) {
      return NextResponse.json({ error: 'Acción requerida' }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BULK EMITIR
    // ═══════════════════════════════════════════════════════════════════════════
    if (accion === 'bulk_emitir') {
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return NextResponse.json({ error: 'IDs de facturas requeridos' }, { status: 400 });
      }

      // Fetch invoices to validate
      const invoices = await prisma.salesInvoice.findMany({
        where: applyViewMode(
          {
            id: { in: invoiceIds },
            companyId: user!.companyId,
          },
          viewMode
        ),
        select: { id: true, estado: true, numero: true },
      });

      if (invoices.length === 0) {
        return NextResponse.json({ error: 'No se encontraron facturas' }, { status: 404 });
      }

      const results = {
        success: [] as number[],
        failed: [] as { id: number; numero: string; error: string }[],
      };

      // Process each invoice
      for (const invoice of invoices) {
        // Validate transition
        const validation = validateTransition({
          documentType: 'invoice',
          documentId: invoice.id,
          fromState: invoice.estado,
          toState: InvoiceStatus.EMITIDA,
          userId: user!.id,
        });

        if (!validation.valid) {
          results.failed.push({
            id: invoice.id,
            numero: invoice.numero,
            error: validation.error || 'Transición no válida',
          });
          continue;
        }

        try {
          // Get full invoice data for balance update
          const fullInvoice = await prisma.salesInvoice.findUnique({
            where: { id: invoice.id },
            select: { id: true, numero: true, clientId: true, total: true },
          });

          if (!fullInvoice) {
            throw new Error('Factura no encontrada');
          }

          // Update to EMITIDA in transaction (ensure atomicity)
          await prisma.$transaction(async (tx) => {
            await tx.salesInvoice.update({
              where: { id: invoice.id },
              data: {
                estado: InvoiceStatus.EMITIDA,
                fechaEmision: new Date(),
              },
            });

            // Create ledger entry
            await tx.clientLedgerEntry.create({
              data: {
                clientId: fullInvoice.clientId,
                fecha: new Date(),
                tipo: 'FACTURA',
                debe: Number(fullInvoice.total),
                haber: 0,
                comprobante: fullInvoice.numero,
                descripcion: `Factura ${fullInvoice.numero} (Emisión masiva)`,
                referenceType: 'SALES_INVOICE',
                referenceId: fullInvoice.id,
                companyId: user!.companyId,
                createdBy: user!.id,
              },
            });

            // Update client balance
            await tx.client.update({
              where: { id: fullInvoice.clientId },
              data: {
                currentBalance: { increment: Number(fullInvoice.total) },
              },
            });
          });

          // Audit log
          await logSalesStatusChange({
            entidad: 'invoice',
            entidadId: invoice.id,
            estadoAnterior: invoice.estado,
            estadoNuevo: InvoiceStatus.EMITIDA,
            companyId: user!.companyId,
            userId: user!.id,
            notas: 'Emitida mediante operación masiva',
          });

          results.success.push(invoice.id);
        } catch (err) {
          results.failed.push({
            id: invoice.id,
            numero: invoice.numero,
            error: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
      }

      return NextResponse.json({
        message: `Se emitieron ${results.success.length} de ${invoices.length} facturas`,
        results,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BULK ANULAR
    // ═══════════════════════════════════════════════════════════════════════════
    if (accion === 'bulk_anular') {
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return NextResponse.json({ error: 'IDs de facturas requeridos' }, { status: 400 });
      }

      if (!motivo || motivo.trim() === '') {
        return NextResponse.json(
          { error: 'Motivo de anulación requerido' },
          { status: 400 }
        );
      }

      // Fetch invoices to validate
      const invoices = await prisma.salesInvoice.findMany({
        where: applyViewMode(
          {
            id: { in: invoiceIds },
            companyId: user!.companyId,
          },
          viewMode
        ),
        select: { id: true, estado: true, numero: true },
      });

      if (invoices.length === 0) {
        return NextResponse.json({ error: 'No se encontraron facturas' }, { status: 404 });
      }

      const results = {
        success: [] as number[],
        failed: [] as { id: number; numero: string; error: string }[],
      };

      // Process each invoice
      for (const invoice of invoices) {
        // Validate transition
        const validation = validateTransition({
          documentType: 'invoice',
          documentId: invoice.id,
          fromState: invoice.estado,
          toState: InvoiceStatus.ANULADA,
          userId: user!.id,
        });

        if (!validation.valid) {
          results.failed.push({
            id: invoice.id,
            numero: invoice.numero,
            error: validation.error || 'Transición no válida',
          });
          continue;
        }

        try {
          // Get full invoice data for balance update
          const fullInvoice = await prisma.salesInvoice.findUnique({
            where: { id: invoice.id },
            select: { id: true, numero: true, clientId: true, total: true, saldoPendiente: true },
          });

          if (!fullInvoice) {
            throw new Error('Factura no encontrada');
          }

          // Update to ANULADA in transaction (ensure atomicity)
          await prisma.$transaction(async (tx) => {
            await tx.salesInvoice.update({
              where: { id: invoice.id },
              data: {
                estado: InvoiceStatus.ANULADA,
                motivoAnulacion: motivo,
              },
            });

            // Create reversal ledger entry
            const montoARevertir = Number(fullInvoice.saldoPendiente || fullInvoice.total);
            await tx.clientLedgerEntry.create({
              data: {
                clientId: fullInvoice.clientId,
                fecha: new Date(),
                tipo: 'AJUSTE',
                debe: 0,
                haber: montoARevertir,
                comprobante: `ANUL-${fullInvoice.numero}`,
                descripcion: `Anulación Factura ${fullInvoice.numero}: ${motivo}`,
                referenceType: 'INVOICE_VOID',
                referenceId: fullInvoice.id,
                companyId: user!.companyId,
                createdBy: user!.id,
              },
            });

            // Reduce client balance (revert debt)
            await tx.client.update({
              where: { id: fullInvoice.clientId },
              data: {
                currentBalance: { decrement: montoARevertir },
              },
            });
          });

          // Audit log
          await logSalesStatusChange({
            entidad: 'invoice',
            entidadId: invoice.id,
            estadoAnterior: invoice.estado,
            estadoNuevo: InvoiceStatus.ANULADA,
            companyId: user!.companyId,
            userId: user!.id,
            notas: `Anulada mediante operación masiva. Motivo: ${motivo}`,
          });

          results.success.push(invoice.id);
        } catch (err) {
          results.failed.push({
            id: invoice.id,
            numero: invoice.numero,
            error: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
      }

      return NextResponse.json({
        message: `Se anularon ${results.success.length} de ${invoices.length} facturas`,
        results,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BULK EXPORT
    // ═══════════════════════════════════════════════════════════════════════════
    if (accion === 'bulk_export') {
      // Build where clause from filters
      const estado = filters.estado;
      const clienteId = filters.clienteId;
      const fechaDesde = filters.fechaDesde;
      const fechaHasta = filters.fechaHasta;
      const search = filters.search;
      const tipoFactura = filters.tipoFactura;

      const where = applyViewMode(
        {
          companyId: user!.companyId,
          ...(estado && { estado: estado as any }),
          ...(clienteId && { clientId: parseInt(clienteId) }),
          ...(fechaDesde &&
            fechaHasta && {
              fechaEmision: {
                gte: new Date(fechaDesde),
                lte: new Date(fechaHasta),
              },
            }),
          ...(search && {
            OR: [
              { numero: { contains: search, mode: 'insensitive' as const } },
              { client: { legalName: { contains: search, mode: 'insensitive' as const } } },
              { client: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }),
          ...(tipoFactura && { tipoFactura: tipoFactura as any }),
        },
        viewMode
      );

      // Fetch all matching invoices (no limit)
      const invoices = await prisma.salesInvoice.findMany({
        where,
        include: {
          client: {
            select: {
              legalName: true,
              name: true,
              cuit: true,
            },
          },
          sale: {
            select: {
              numero: true,
            },
          },
          _count: { select: { items: true } },
        },
        orderBy: { numero: 'desc' },
      });

      // Generate CSV
      const headers = [
        'Número',
        'Tipo',
        'Fecha Emisión',
        'Fecha Vencimiento',
        'Estado',
        'Cliente',
        'CUIT',
        'OV',
        'Subtotal',
        'IVA',
        'Total',
        'Saldo Pendiente',
        'Items',
        'CAE',
        'Vto. CAE',
        'Punto Venta',
        'Observaciones',
      ];

      const rows = invoices.map((invoice) => [
        invoice.numero,
        invoice.tipoFactura || '',
        invoice.fechaEmision ? format(new Date(invoice.fechaEmision), 'dd/MM/yyyy', { locale: es }) : '',
        invoice.fechaVencimiento
          ? format(new Date(invoice.fechaVencimiento), 'dd/MM/yyyy', { locale: es })
          : '',
        invoice.estado,
        invoice.client.legalName || invoice.client.name || '',
        invoice.client.cuit || '',
        invoice.sale?.numero || '',
        invoice.subtotal ? invoice.subtotal.toFixed(2) : '',
        invoice.iva ? invoice.iva.toFixed(2) : '',
        invoice.total ? invoice.total.toFixed(2) : '',
        invoice.saldoPendiente ? invoice.saldoPendiente.toFixed(2) : '',
        invoice._count.items.toString(),
        invoice.cae || '',
        invoice.caeVencimiento
          ? format(new Date(invoice.caeVencimiento), 'dd/MM/yyyy', { locale: es })
          : '',
        invoice.puntoVenta ? invoice.puntoVenta.toString() : '',
        (invoice.observaciones || '').replace(/\n/g, ' ').substring(0, 100),
      ]);

      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => (cell ? `"${String(cell).replace(/"/g, '""')}"` : '')).join(',')
        ),
      ].join('\n');

      // Add BOM for Excel UTF-8 support
      const bom = '\uFEFF';
      const buffer = Buffer.from(bom + csvContent, 'utf-8');

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="facturas-${Date.now()}.csv"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk operations:', error);
    return NextResponse.json(
      { error: 'Error al procesar operación masiva' },
      { status: 500 }
    );
  }
}
