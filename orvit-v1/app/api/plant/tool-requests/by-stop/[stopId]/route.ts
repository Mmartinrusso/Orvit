import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/plant/tool-requests/by-stop/[stopId] - Obtener solicitudes de herramientas para una parada específica
export async function GET(
  request: NextRequest,
  { params }: { params: { stopId: string } }
) {
  try {
    const stopId = params.stopId;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    // Buscar solicitudes de herramientas para esta parada específica
    const toolRequestRecords = await prisma.document.findMany({
      where: {
        entityType: 'TOOL_REQUEST',
        entityId: stopId
      },
      orderBy: { createdAt: 'asc' }
    });

    // Filtrar por empresa
    const filteredRequests = toolRequestRecords.filter(request => {
      try {
        const data = JSON.parse(request.url);
        return data.companyId === Number(companyId);
      } catch {
        return false;
      }
    });

    const parsedRequests = filteredRequests.map(request => ({
      id: request.id,
      createdAt: request.createdAt,
      originalName: request.originalName,
      ...JSON.parse(request.url)
    }));

    // Consolidar todas las herramientas solicitadas
    const allRequestedTools: any[] = [];
    
    parsedRequests.forEach(request => {
      if (request.tools && Array.isArray(request.tools)) {
        request.tools.forEach((tool: any) => {
          allRequestedTools.push({
            ...tool,
            requestId: request.id,
            requestedBy: request.requesterName,
            requestedAt: request.createdAt,
            urgency: request.urgency,
            status: request.status
          });
        });
      }
    });

    return NextResponse.json({
      success: true,
      requests: parsedRequests,
      tools: allRequestedTools,
      totalRequests: parsedRequests.length,
      totalTools: allRequestedTools.length
    });

  } catch (error) {
    console.error('Error en GET /api/plant/tool-requests/by-stop/[stopId]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 