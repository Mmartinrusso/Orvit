import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shouldResetChecklist } from '@/lib/checklist-utils';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Buscar todos los checklists de la empresa
    const checklistDocuments = await prisma.document.findMany({
      where: {
        entityType: 'MAINTENANCE_CHECKLIST',
        companyId: parseInt(companyId)
      }
    });

    const resetResults = [];

    for (const document of checklistDocuments) {
      try {
        const checklistData = JSON.parse(document.url);
        
        // Verificar si necesita reinicio
        const needsReset = shouldResetChecklist({
          lastExecutionDate: checklistData.lastExecutionDate,
          frequency: checklistData.frequency,
          isCompleted: checklistData.isCompleted
        });

        if (needsReset && checklistData.isCompleted) {
          // Actualizar el estado del checklist
          const updatedChecklistData = {
            ...checklistData,
            isCompleted: false,
            updatedAt: new Date().toISOString()
          };

          await prisma.document.update({
            where: { id: document.id },
            data: {
              url: JSON.stringify(updatedChecklistData),
              uploadDate: new Date()
            }
          });

          resetResults.push({
            checklistId: document.id,
            title: checklistData.title,
            frequency: checklistData.frequency,
            resetAt: new Date().toISOString()
          });

          console.log(`✅ Checklist "${checklistData.title}" reiniciado automáticamente`);
        }
      } catch (error) {
        console.error(`Error processing checklist document ${document.id}:`, error);
      }
    }

    console.log(`🔄 Proceso de reinicio completado. ${resetResults.length} checklists reiniciados`);

    return NextResponse.json({
      success: true,
      message: `${resetResults.length} checklists reiniciados automáticamente`,
      resetResults
    });
  } catch (error) {
    console.error('Error in checklist reset process:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
