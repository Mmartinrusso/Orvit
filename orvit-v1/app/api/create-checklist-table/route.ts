import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Creando tabla ChecklistExecution...');

    // Crear la tabla ChecklistExecution
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ChecklistExecution" (
        "id" SERIAL PRIMARY KEY,
        "checklistId" INTEGER NOT NULL,
        "executedBy" TEXT NOT NULL,
        "executionTime" INTEGER NOT NULL DEFAULT 0,
        "completedItems" INTEGER NOT NULL DEFAULT 0,
        "totalItems" INTEGER NOT NULL DEFAULT 0,
        "companyId" INTEGER NOT NULL,
        "sectorId" INTEGER,
        "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" TEXT NOT NULL DEFAULT 'COMPLETED',
        "justifications" TEXT,
        "executionDetails" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('✅ Tabla ChecklistExecution creada');

    // Crear índices para mejorar el rendimiento
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ChecklistExecution_checklistId_idx" ON "ChecklistExecution"("checklistId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ChecklistExecution_companyId_idx" ON "ChecklistExecution"("companyId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ChecklistExecution_sectorId_idx" ON "ChecklistExecution"("sectorId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ChecklistExecution_executedAt_idx" ON "ChecklistExecution"("executedAt");
    `;

    console.log('✅ Índices creados');

    // Limpiar checklists de prueba inválidos
    console.log('🧹 Limpiando checklists de prueba...');
    
    const deletedChecklists = await prisma.document.deleteMany({
      where: {
        entityType: 'MAINTENANCE_CHECKLIST',
        OR: [
          { originalName: { contains: 'Prueba' } },
          { originalName: { contains: 'Test' } },
          { originalName: { contains: 'test' } },
          { originalName: { contains: 'Demo' } },
          { originalName: { contains: 'Ejemplo' } },
          { originalName: { contains: 'ejemplo' } },
          { url: { contains: '"title":""' } },
          { url: { contains: '"title":null' } },
          { url: { contains: '"isActive":false' } }
        ]
      }
    });

    console.log('🗑️ Checklists de prueba eliminados:', deletedChecklists.count);

    // Corregir work orders correctivos que están en estado incorrecto
    console.log('🔧 Corrigiendo work orders correctivos...');
    
    const updatedWorkOrders = await prisma.workOrder.updateMany({
      where: {
        type: 'CORRECTIVE',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        completedDate: { not: null }
      },
      data: {
        status: 'COMPLETED'
      }
    });

    console.log('🔄 Work orders corregidos:', updatedWorkOrders.count);

    // Obtener estadísticas finales
    const checklistCount = await prisma.document.count({
      where: { entityType: 'MAINTENANCE_CHECKLIST' }
    });

    const workOrderCount = await prisma.workOrder.count({
      where: { type: 'CORRECTIVE', status: 'COMPLETED' }
    });

    const preventiveCount = await prisma.document.count({
      where: { entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE' }
    });

    return NextResponse.json({
      success: true,
      message: 'Base de datos configurada correctamente',
      stats: {
        checklistsValidos: checklistCount,
        workOrdersCorregidos: updatedWorkOrders.count,
        checklistsEliminados: deletedChecklists.count,
        mantenimientosPreventivos: preventiveCount,
        workOrdersCorrectivos: workOrderCount
      }
    });

  } catch (error) {
    console.error('❌ Error configurando base de datos:', error);
    return NextResponse.json(
      { 
        error: 'Error configurando base de datos',
        details: error.message 
      },
      { status: 500 }
    );
  }
}