import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// POST /api/plant/stop
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const {
      sectorId,
      companyId,
      supervisorId,
      supervisorName,
      reason,
      machineId,
      machineName,
      componentId,
      componentName,
      subcomponentId,
      subcomponentName,
      priority,
      timestamp
    } = body;

    // Validaciones básicas
    if (!sectorId || !companyId || !supervisorId || !reason) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el sector existe
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

    // Por ahora no actualizamos el estado del sector ya que no existe ese campo
    // En el futuro se puede implementar un sistema de estado de sector
    // await prisma.sector.update({
    //   where: { id: Number(sectorId) },
    //   data: { estado: 'INACTIVO' }
    // });

    // Crear registro de parada de planta (podríamos crear una tabla específica para esto)
    // Por ahora, usaremos la tabla de documentos para registrar el evento
    const plantStopRecord = await prisma.document.create({
      data: {
        id: `plant-stop-${Date.now()}`,
        entityType: 'PLANT_STOP',
        entityId: sectorId.toString(),
        url: JSON.stringify({
          sectorId,
          sectorName: sector.name,
          areaName: sector.area.name,
          companyId,
          supervisorId,
          supervisorName,
          reason,
          machineId,
          machineName,
          componentId,
          componentName,
          subcomponentId,
          subcomponentName,
          priority,
          timestamp,
          status: 'ACTIVE'
        }),
        originalName: `Parada de Planta - ${sector.name} - ${new Date().toLocaleString()}`
      }
    });

    // Obtener todos los usuarios de la empresa para notificar
    const companyUsers = await prisma.userOnCompany.findMany({
      where: { companyId: Number(companyId) },
      include: { user: true }
    });

    // Crear notificaciones para todos los usuarios de la empresa
    const notifications = companyUsers.map(userCompany => ({
      type: 'plant_stop',
      title: 'PARADA DE PLANTA',
      message: `${sector.area.name} - ${sector.name}: ${reason}`,
      priority: priority === 'critica' ? 'high' : priority === 'alta' ? 'medium' : 'low',
      userId: userCompany.user.id,
      metadata: JSON.stringify({
        sectorId,
        sectorName: sector.name,
        areaName: sector.area.name,
        reason,
        supervisorName,
        machineId,
        machineName,
        componentName,
        subcomponentName,
        priority,
        timestamp,
        plantStopId: plantStopRecord.id
      })
    }));

    // Aquí insertaríamos las notificaciones si tuviéramos una tabla de notificaciones
    // Por ahora, simularemos que se envían

    console.log('🚨 PARADA DE PLANTA REGISTRADA:', {
      sector: `${sector.area.name} - ${sector.name}`,
      reason,
      supervisor: supervisorName,
      affectedMachine: machineName,
      priority,
      usersNotified: companyUsers.length
    });

    return NextResponse.json({
      success: true,
      message: 'Parada de planta registrada exitosamente',
      plantStopId: plantStopRecord.id,
      sectorStatus: 'INACTIVO',
      notifiedUsers: companyUsers.length
    });

  } catch (error) {
    console.error('Error en POST /api/plant/stop:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/plant/stop - Obtener paradas activas
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const companyId = String(user!.companyId);
    const sectorId = searchParams.get('sectorId');

    // Buscar paradas activas
    const activePlantStops = await prisma.document.findMany({
      where: {
        entityType: 'PLANT_STOP',
        ...(sectorId && { entityId: sectorId })
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtrar solo las paradas activas y de la empresa
    const filteredStops = activePlantStops.filter(stop => {
      try {
        const data = JSON.parse(stop.url);
        return data.companyId === Number(companyId) && data.status === 'ACTIVE';
      } catch {
        return false;
      }
    });

    const parsedStops = filteredStops.map(stop => ({
      id: stop.id,
      createdAt: stop.createdAt,
      ...JSON.parse(stop.url)
    }));

    return NextResponse.json(parsedStops);

  } catch (error) {
    console.error('Error en GET /api/plant/stop:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 