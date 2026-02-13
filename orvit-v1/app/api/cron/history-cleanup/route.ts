import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';


// GET /api/cron/history-cleanup - Ejecutar limpieza automática del historial
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Iniciando limpieza automática del historial...');

    // Obtener todas las configuraciones de auto-eliminación
    const configs = await prisma.document.findMany({
      where: {
        name: 'HISTORY_AUTO_DELETE_CONFIG',
        fileName: 'CONFIG'
      }
    });

    let totalDeleted = 0;
    let companiesProcessed = 0;

    for (const config of configs) {
      try {
        const configData = JSON.parse(config.url);
        const days = configData.days;
        const companyId = config.companyId;

        if (!days || days < 1) {
          console.log(`⚠️ Configuración inválida para empresa ${companyId}`);
          continue;
        }

        // Calcular fecha límite
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Buscar tareas del historial más antiguas que la fecha límite
        const oldHistoryItems = await prisma.document.findMany({
          where: {
            fileName: 'TASK_HISTORY',
            companyId: companyId,
            uploadDate: {
              lt: cutoffDate
            }
          }
        });

        if (oldHistoryItems.length > 0) {
          // Eliminar tareas antiguas
          const deletedCount = await prisma.document.deleteMany({
            where: {
              fileName: 'TASK_HISTORY',
              companyId: companyId,
              uploadDate: {
                lt: cutoffDate
              }
            }
          });

          totalDeleted += deletedCount.count;
          console.log(`✅ Empresa ${companyId}: ${deletedCount.count} tareas eliminadas (más de ${days} días)`);
        } else {
          console.log(`ℹ️ Empresa ${companyId}: No hay tareas para eliminar`);
        }

        companiesProcessed++;
      } catch (error) {
        console.error(`❌ Error procesando empresa ${config.companyId}:`, error);
      }
    }

    console.log(`🎉 Limpieza completada: ${totalDeleted} tareas eliminadas en ${companiesProcessed} empresas`);

    return NextResponse.json({
      success: true,
      totalDeleted,
      companiesProcessed,
      message: `Limpieza automática completada: ${totalDeleted} tareas eliminadas`
    });

  } catch (error) {
    console.error('❌ Error en limpieza automática del historial:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 