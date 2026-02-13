import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/plant/tool-requests - Crear solicitud de herramientas durante parada
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      plantStopId,
      sectorId,
      companyId,
      requesterId,
      requesterName,
      urgency,
      tools,
      timestamp
    } = body;

    console.log('📦 Recibiendo solicitud de herramientas:', body);

    // Validaciones básicas
    if (!sectorId || !companyId || !requesterId || !tools || tools.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos o no hay herramientas solicitadas' },
        { status: 400 }
      );
    }

    // Verificar que el sector existe y está en parada
    const sector = await prisma.sector.findUnique({
      where: { id: Number(sectorId) },
      include: { area: true }
    });

    if (!sector) {
      return NextResponse.json(
        { error: 'Sector no encontrado' },
        { status: 404 }
      );
    }

    // Por ahora permitir solicitudes de herramientas siempre (ya que no hay campo estado)
    // En el futuro se puede implementar un sistema de estado de sector

    // Crear el registro de solicitud de herramientas
    const toolRequest = await prisma.document.create({
      data: {
        id: `tool-request-${Date.now()}`,
        entityType: 'TOOL_REQUEST',
        entityId: plantStopId || sectorId.toString(),
        originalName: `Solicitud de Herramientas - ${sector.name} - ${new Date().toLocaleString()}`,
        url: JSON.stringify({
          type: 'PLANT_TOOL_REQUEST',
          plantStopId,
          sectorId,
          sectorName: sector.name,
          areaName: sector.area.name,
          companyId,
          requesterId,
          requesterName,
          urgency,
          tools,
          status: 'PENDING',
          timestamp: timestamp || new Date().toISOString(),
          createdAt: new Date().toISOString()
        })
      }
    });

    // Obtener usuarios del pañol para notificar (usuarios con rol que maneje pañol)
    const companyUsers = await prisma.userOnCompany.findMany({
      where: { companyId: Number(companyId) },
      include: { user: true }
    });

    // Filtrar usuarios que pueden manejar el pañol (admins y supervisores por ahora)
    const panolUsers = companyUsers.filter(userCompany => 
      ['ADMIN', 'SUPERADMIN'].includes(userCompany.user.role)
    );

    // Crear resumen de la solicitud
    const toolsSummary = tools.map((tool: any) => 
      `${tool.quantity}x ${tool.toolName} (${tool.reason})`
    ).join(', ');

    console.log('🚨 SOLICITUD DE HERRAMIENTAS REGISTRADA:', {
      sector: `${sector.area.name} - ${sector.name}`,
      requester: requesterName,
      urgency,
      toolsCount: tools.length,
      toolsSummary,
      panolUsersToNotify: panolUsers.length,
      requestId: toolRequest.id
    });

    // TODO: Integrar con Telegram para notificaciones urgentes
    const notificationMessage = `SOLICITUD URGENTE DE HERRAMIENTAS\n\n` +
            `Sector: ${sector.area.name} - ${sector.name}\n` +
        `Solicitante: ${requesterName}\n` +
              `Prioridad: ${urgency.toUpperCase()}\n` +
        `Herramientas:\n${toolsSummary}\n\n` +
              `PLANTA EN PARADA - Atender inmediatamente\n` +
      `ID: ${toolRequest.id}`;

    console.log('📱 Mensaje de notificacion:', notificationMessage);

    return NextResponse.json({
      success: true,
      message: 'Solicitud de herramientas enviada exitosamente',
      requestId: toolRequest.id,
      toolsRequested: tools.length,
      notifiedUsers: panolUsers.length
    });

  } catch (error) {
    console.error('Error en POST /api/plant/tool-requests:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/plant/tool-requests - Obtener solicitudes de herramientas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const status = searchParams.get('status'); // PENDING, APPROVED, REJECTED, DELIVERED

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID es requerido' },
        { status: 400 }
      );
    }

    // Buscar solicitudes de herramientas
    const toolRequestRecords = await prisma.document.findMany({
      where: {
        entityType: 'TOOL_REQUEST',
        ...(sectorId && { entityId: sectorId })
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtrar por empresa y estado si se especifica
    const filteredRequests = toolRequestRecords.filter(request => {
      try {
        const data = JSON.parse(request.url);
        const matchesCompany = data.companyId === Number(companyId);
        const matchesStatus = !status || data.status === status;
        return matchesCompany && matchesStatus;
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

    return NextResponse.json({
      success: true,
      requests: parsedRequests,
      total: parsedRequests.length
    });

  } catch (error) {
    console.error('Error en GET /api/plant/tool-requests:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 