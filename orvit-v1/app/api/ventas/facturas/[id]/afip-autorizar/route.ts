/**
 * AFIP Authorization API
 *
 * Autoriza factura con AFIP y obtiene CAE
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { authorizeInvoiceWithAFIP, retryInvoiceAuthorization } from '@/lib/ventas/afip/afip-invoice-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_EMIT);
    if (error) return error;

    const { id } = await params;
    const invoiceId = parseInt(id);

    if (!invoiceId || isNaN(invoiceId)) {
      return NextResponse.json({ error: 'ID de factura inválido' }, { status: 400 });
    }

    const body = await req.json();
    const isRetry = body.retry === true;

    // Autorizar o reintentar
    const result = isRetry
      ? await retryInvoiceAuthorization(invoiceId, user!.companyId)
      : await authorizeInvoiceWithAFIP(invoiceId, user!.companyId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error al autorizar con AFIP',
          errores: result.errores,
          observaciones: result.observaciones,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      cae: result.cae,
      caeFechaVencimiento: result.caeFechaVencimiento,
      observaciones: result.observaciones,
      message: 'Factura autorizada correctamente en AFIP',
    });
  } catch (error: any) {
    console.error('Error en autorización AFIP:', error);
    return NextResponse.json(
      { error: 'Error al procesar autorización', details: error.message },
      { status: 500 }
    );
  }
}
