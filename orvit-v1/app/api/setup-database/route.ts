import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    console.log('🔧 Configurando base de datos...');

    // 1. Verificar si la tabla ChecklistExecution existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ChecklistExecution'
      );
    ` as any[];

    console.log('📊 Tabla ChecklistExecution existe:', tableExists[0]?.exists);

    // 2. Si no existe, crearla
    if (!tableExists[0]?.exists) {
      console.log('🔨 Creando tabla ChecklistExecution...');
      
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

      // Crear índices
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ChecklistExecution_checklistId_idx" ON "ChecklistExecution"("checklistId");
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ChecklistExecution_companyId_idx" ON "ChecklistExecution"("companyId");
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ChecklistExecution_executedAt_idx" ON "ChecklistExecution"("executedAt");
      `;

      console.log('✅ Tabla ChecklistExecution creada con índices');
    }

    // 3. Limpiar checklists de prueba inválidos
    console.log('🧹 Limpiando checklists de prueba...');
    
    const deletedChecklists = await prisma.$executeRaw`
      DELETE FROM "Document" 
      WHERE "entityType" = 'MAINTENANCE_CHECKLIST' 
      AND (
        "url" LIKE '%"title":""%' OR 
        "url" LIKE '%"title":null%' OR
        "url" LIKE '%"isActive":false%' OR
        "originalName" LIKE '%Prueba%' OR
        "originalName" LIKE '%Test%' OR
        "originalName" LIKE '%test%' OR
        "originalName" LIKE '%Demo%' OR
        "originalName" LIKE '%Ejemplo%' OR
        "originalName" LIKE '%ejemplo%'
      );
    `;

    console.log('🗑️ Checklists de prueba eliminados:', deletedChecklists);

    // 4. Corregir work orders correctivos
    console.log('🔧 Corrigiendo work orders correctivos...');
    
    const updatedWorkOrders = await prisma.$executeRaw`
      UPDATE "work_orders" 
      SET "status" = 'COMPLETED', 
          "completedDate" = COALESCE("completedDate", "updatedAt")
      WHERE "type" = 'CORRECTIVE' 
      AND "status" IN ('PENDING', 'IN_PROGRESS') 
      AND "completedDate" IS NOT NULL;
    `;

    console.log('🔄 Work orders corregidos:', updatedWorkOrders);

    // 5. Obtener estadísticas finales
    const stats = await prisma.$queryRaw`
      SELECT 
        'Checklists válidos' as tipo,
        COUNT(*) as cantidad
      FROM "Document" 
      WHERE "entityType" = 'MAINTENANCE_CHECKLIST'
      UNION ALL
      SELECT 
        'Work Orders correctivos completados' as tipo,
        COUNT(*) as cantidad
      FROM "work_orders" 
      WHERE "type" = 'CORRECTIVE' AND "status" = 'COMPLETED'
      UNION ALL
      SELECT 
        'Mantenimientos preventivos' as tipo,
        COUNT(*) as cantidad
      FROM "Document" 
      WHERE "entityType" = 'PREVENTIVE_MAINTENANCE_TEMPLATE';
    `;

    console.log('📊 Estadísticas finales:', stats);

    return NextResponse.json({
      success: true,
      message: 'Base de datos configurada correctamente',
      tableCreated: !tableExists[0]?.exists,
      deletedChecklists,
      updatedWorkOrders,
      stats
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