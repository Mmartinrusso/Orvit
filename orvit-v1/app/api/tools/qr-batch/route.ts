/**
 * API: /api/tools/qr-batch
 *
 * POST - Generar códigos QR para múltiples herramientas
 *        Útil para imprimir etiquetas en lote
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

interface ToolQR {
  id: number;
  name: string;
  category: string;
  serialNumber: string | null;
  location: string | null;
  stockQuantity: number;
  unit: string | null;
  qrBase64: string;
}

/**
 * POST /api/tools/qr-batch
 * Generar códigos QR para múltiples herramientas
 *
 * Body:
 * - toolIds: number[] - IDs de herramientas
 * - size: number (default: 150)
 * - includeUrl: boolean (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('tools.view');
    if (error) return error;

    const companyId = user!.companyId;

    const body = await request.json();
    const { toolIds, size = 150, includeUrl = true } = body;

    if (!toolIds || !Array.isArray(toolIds) || toolIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de toolIds' },
        { status: 400 }
      );
    }

    if (toolIds.length > 50) {
      return NextResponse.json(
        { error: 'Máximo 50 herramientas por lote' },
        { status: 400 }
      );
    }

    // Obtener herramientas
    const tools = await prisma.tool.findMany({
      where: {
        id: { in: toolIds.map(id => parseInt(id)) },
        companyId
      },
      select: {
        id: true,
        name: true,
        category: true,
        serialNumber: true,
        location: true,
        stockQuantity: true,
        unit: true
      }
    });

    if (tools.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron herramientas' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Generar QRs para cada herramienta
    const results: ToolQR[] = await Promise.all(
      tools.map(async (tool) => {
        const qrData = JSON.stringify({
          type: 'TOOL',
          id: tool.id,
          name: tool.name,
          category: tool.category,
          ...(includeUrl && { url: `${baseUrl}/panol?toolId=${tool.id}` })
        });

        const qrBase64 = await QRCode.toDataURL(qrData, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'M'
        });

        return {
          ...tool,
          qrBase64
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      tools: results
    });

  } catch (error) {
    console.error('Error generando QRs en lote:', error);
    return NextResponse.json(
      { error: 'Error al generar códigos QR' },
      { status: 500 }
    );
  }
}
