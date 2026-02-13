import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';


const prisma = new PrismaClient();

// GET /api/test/maintenance - Verificar datos de mantenimientos en BD
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verificando datos de mantenimientos en BD...');

    // Buscar todos los templates de mantenimiento preventivo
    const templates = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Solo los últimos 5
    });

    console.log(`🔍 Encontrados ${templates.length} templates de mantenimiento preventivo`);

    const results = templates.map(template => {
      try {
        const data = JSON.parse(template.url);
        return {
          id: template.id,
          name: template.originalName,
          createdAt: template.createdAt,
          componentIds: data.componentIds || [],
          subcomponentIds: data.subcomponentIds || [],
          executionWindow: data.executionWindow || 'NO_DEFINIDO',
          timeUnit: data.timeUnit || 'NO_DEFINIDO',
          timeValue: data.timeValue || 'NO_DEFINIDO',
          machineId: data.machineId,
          machineName: data.machineName
        };
      } catch (error) {
        return {
          id: template.id,
          name: template.originalName,
          error: 'Error parsing JSON',
          url: template.url
        };
      }
    });

    console.log('🔍 Resultados de verificación:', results);

    return NextResponse.json({
      success: true,
      count: templates.length,
      templates: results
    });

  } catch (error) {
    console.error('❌ Error verificando mantenimientos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
