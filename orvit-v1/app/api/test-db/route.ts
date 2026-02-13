import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Probando conexión a la base de datos...');

    // Probar conexión básica
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Conexión exitosa:', result);

    // Verificar si la tabla ChecklistExecution existe
    let tableExists = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ChecklistExecution" LIMIT 1`;
      tableExists = true;
      console.log('✅ Tabla ChecklistExecution existe');
    } catch (error) {
      console.log('❌ Tabla ChecklistExecution no existe:', error.message);
    }

    // Contar checklists válidos
    const checklistCount = await prisma.document.count({
      where: {
        entityType: 'MAINTENANCE_CHECKLIST'
      }
    });

    // Contar work orders
    const workOrderCount = await prisma.workOrder.count();

    return NextResponse.json({
      success: true,
      connection: 'OK',
      tableExists,
      checklistCount,
      workOrderCount,
      message: 'Base de datos funcionando correctamente'
    });

  } catch (error) {
    console.error('❌ Error probando base de datos:', error);
    return NextResponse.json(
      { 
        error: 'Error de conexión a la base de datos',
        details: error.message 
      },
      { status: 500 }
    );
  }
}