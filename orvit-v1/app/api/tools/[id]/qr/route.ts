/**
 * API: /api/tools/[id]/qr
 *
 * GET - Generar código QR para una herramienta/repuesto
 *       Retorna imagen PNG del QR o datos en base64
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tools/[id]/qr
 * Generar código QR para herramienta
 *
 * Query params:
 * - format: 'png' | 'svg' | 'base64' (default: 'base64')
 * - size: number (default: 200)
 * - includeInfo: 'true' | 'false' (default: 'true')
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const toolId = parseInt(id);

    if (isNaN(toolId)) {
      return NextResponse.json({ error: 'ID de herramienta inválido' }, { status: 400 });
    }

    // Obtener herramienta
    const tool = await prisma.tool.findFirst({
      where: {
        id: toolId,
        companyId
      },
      select: {
        id: true,
        name: true,
        itemType: true,
        category: true,
        serialNumber: true,
        location: true,
        stockQuantity: true,
        unit: true
      }
    });

    if (!tool) {
      return NextResponse.json(
        { error: 'Herramienta no encontrada' },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'base64';
    const size = parseInt(searchParams.get('size') || '200');
    const includeInfo = searchParams.get('includeInfo') !== 'false';

    // Construir datos para el QR
    // El QR contendrá una URL o un JSON con información de la herramienta
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const qrData = includeInfo
      ? JSON.stringify({
          type: 'TOOL',
          id: tool.id,
          name: tool.name,
          category: tool.category,
          serialNumber: tool.serialNumber,
          location: tool.location,
          url: `${baseUrl}/panol?toolId=${tool.id}`
        })
      : `${baseUrl}/panol?toolId=${tool.id}`;

    // Generar QR según formato
    if (format === 'svg') {
      const svg = await QRCode.toString(qrData, {
        type: 'svg',
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M'
      });

      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `inline; filename="tool-${tool.id}-qr.svg"`
        }
      });
    }

    if (format === 'png') {
      const pngBuffer = await QRCode.toBuffer(qrData, {
        type: 'png',
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M'
      });

      return new NextResponse(pngBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `inline; filename="tool-${tool.id}-qr.png"`
        }
      });
    }

    // Default: base64
    const base64 = await QRCode.toDataURL(qrData, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M'
    });

    return NextResponse.json({
      success: true,
      tool: {
        id: tool.id,
        name: tool.name,
        category: tool.category,
        serialNumber: tool.serialNumber,
        location: tool.location
      },
      qr: {
        data: base64,
        size,
        format: 'base64'
      }
    });

  } catch (error) {
    console.error('Error generando QR:', error);
    return NextResponse.json(
      { error: 'Error al generar código QR' },
      { status: 500 }
    );
  }
}
