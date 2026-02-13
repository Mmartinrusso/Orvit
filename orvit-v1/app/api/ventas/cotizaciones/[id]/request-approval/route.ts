import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

/**
 * POST - Request approval for a quote
 * Automatically checks if approval is needed based on rules
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.COTIZACIONES_EDIT);
    if (error) return error;

    const { id: idParam } = await params;
    const quoteId = parseInt(idParam);
    const { motivo, detalleMotivo } = await request.json();

    // Get quote with items
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, companyId: user!.companyId },
      include: { items: true }
    });

    if (!quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    // Check what triggers approval (this would come from config in real implementation)
    const needsApproval = await checkApprovalNeeded(quote);

    if (!needsApproval.required) {
      return NextResponse.json({
        needsApproval: false,
        message: 'Esta cotización no requiere aprobación'
      });
    }

    // Create approval workflow
    const workflow = await prisma.$queryRaw<any[]>`
      INSERT INTO quote_approval_workflows (
        "quoteId", "companyId", motivo, "detalleMotivo",
        "margenActual", "margenMinimo", "montoTotal", "descuentoTotal",
        "nivelesRequeridos", "solicitadoBy", "expiraAt"
      ) VALUES (
        ${quoteId}, ${user!.companyId}, ${motivo || needsApproval.motivo}, ${detalleMotivo},
        ${needsApproval.margenActual}, ${needsApproval.margenMinimo}, ${Number(quote.total)},
        ${0}, ${needsApproval.niveles}, ${user!.id}, ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
      )
      RETURNING id
    `;

    const workflowId = workflow[0].id;

    // Create approval levels
    for (let i = 1; i <= needsApproval.niveles; i++) {
      await prisma.$executeRaw`
        INSERT INTO quote_approval_levels ("workflowId", nivel, "aprobarPorRol")
        VALUES (${workflowId}, ${i}, ${i === 1 ? 'SUPERVISOR' : 'GERENTE'})
      `;
    }

    return NextResponse.json({
      success: true,
      workflowId,
      message: `Aprobación solicitada: ${needsApproval.niveles} nivel(es) requerido(s)`
    }, { status: 201 });

  } catch (error) {
    console.error('Error requesting approval:', error);
    return NextResponse.json({ error: 'Error al solicitar aprobación' }, { status: 500 });
  }
}

async function checkApprovalNeeded(quote: any) {
  // Calculate average margin
  let totalMargen = 0;
  let itemsWithMargen = 0;

  for (const item of quote.items) {
    const precio = Number(item.precioUnitario);
    const costo = Number(item.costoUnitario || 0);
    if (costo > 0) {
      const margen = ((precio - costo) / precio) * 100;
      totalMargen += margen;
      itemsWithMargen++;
    }
  }

  const margenPromedio = itemsWithMargen > 0 ? totalMargen / itemsWithMargen : 0;
  const total = Number(quote.total);

  // Rules (these should come from sales_approval_config)
  const MARGEN_MINIMO = 15;
  const MONTO_ALTO = 500000;
  const MONTO_MUY_ALTO = 1000000;

  if (margenPromedio < MARGEN_MINIMO) {
    return {
      required: true,
      motivo: 'MARGEN_BAJO',
      margenActual: margenPromedio,
      margenMinimo: MARGEN_MINIMO,
      niveles: total > MONTO_ALTO ? 2 : 1,
    };
  }

  if (total > MONTO_MUY_ALTO) {
    return {
      required: true,
      motivo: 'MONTO_ALTO',
      margenActual: margenPromedio,
      margenMinimo: MARGEN_MINIMO,
      niveles: 2,
    };
  }

  if (total > MONTO_ALTO) {
    return {
      required: true,
      motivo: 'MONTO_ALTO',
      margenActual: margenPromedio,
      margenMinimo: MARGEN_MINIMO,
      niveles: 1,
    };
  }

  return { required: false };
}
