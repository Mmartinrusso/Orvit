/**
 * Invoice OCR API
 *
 * Upload de factura PDF y extracción automática de datos con IA
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/compras/auth';
import { getOCRService } from '@/lib/ai/invoice-ocr';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verificar permisos
    const { user, error } = await requirePermission('compras.facturas.create');
    if (error) return error;

    // Leer archivo PDF
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Se requiere un archivo PDF válido' },
        { status: 400 }
      );
    }

    // Convertir a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Procesar con OCR
    const ocrService = getOCRService();
    const result = await ocrService.extractAndMatch(buffer, user!.companyId);

    // Guardar en base de datos como borrador
    const invoice = await prisma.purchaseInvoice.create({
      data: {
        numero: result.extractedData.numero,
        fecha: new Date(result.extractedData.fecha),
        subtotal: result.extractedData.subtotal,
        iva: result.extractedData.iva,
        total: result.extractedData.total,
        moneda: result.extractedData.moneda,
        estado: 'BORRADOR',
        proveedorCUIT: result.extractedData.proveedorCUIT,
        requiereRevision: result.extractedData.requiresReview,
        ocrConfidence: result.extractedData.confidence,
        ocrData: result.extractedData as any,
        companyId: user!.companyId,
        createdBy: user!.id,
      },
    });

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      extractedData: result.extractedData,
      requiresReview: result.extractedData.requiresReview,
      confidence: result.extractedData.confidence,
      message: result.extractedData.requiresReview
        ? 'Factura procesada pero requiere revisión manual'
        : 'Factura procesada correctamente',
    });
  } catch (error: any) {
    console.error('Error in OCR processing:', error);
    return NextResponse.json(
      { error: 'Error al procesar factura', details: error.message },
      { status: 500 }
    );
  }
}
