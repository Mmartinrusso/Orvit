import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    // Verificar que prisma esté disponible
    if (!prisma) {
      console.error('❌ Prisma is undefined!');
      return NextResponse.json(
        { error: 'Error de configuración de base de datos' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const skip = Math.max(page, 0) * pageSize;
    const take = pageSize + 1; // Obtener un registro extra para saber si hay más

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Buscar ejecuciones de checklists
    const whereClause: any = {
      companyId: parseInt(companyId)
    };
    
    // Si se especifica un sectorId, filtrar por él, sino incluir todos (incluyendo null)
    if (sectorId && sectorId !== 'null' && sectorId !== 'undefined') {
      whereClause.sectorId = parseInt(sectorId);
    }

    // Primero, vamos a ver qué documentos existen en la tabla document
    const allDocuments = await prisma.document.findMany({
      where: {
        companyId: parseInt(companyId)
      },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        originalName: true
      },
      take: 10
    });

    // Verificar si hay algún documento con ID 144
    const document144 = await prisma.document.findUnique({
      where: { id: 144 }
    });
    
    // Verificar si hay checklists en la tabla document
    try {
      const maintenanceChecklists = await prisma.document.findMany({
        where: {
          entityType: 'MAINTENANCE_CHECKLIST',
          companyId: parseInt(companyId)
        },
        select: {
          id: true,
          originalName: true
        },
        take: 5
      });
    } catch (error) {
    }
    
    const checklistExecutions = await prisma.checklistExecution.findMany({
      where: whereClause,
      orderBy: [
        { executedAt: 'desc' },
        { id: 'desc' }
      ],
      skip,
      take
    });

    const hasMore = checklistExecutions.length > pageSize;
    const executionsPage = hasMore ? checklistExecutions.slice(0, pageSize) : checklistExecutions;

    if (checklistExecutions.length > 0) {
      
      // Verificar si las ejecuciones tienen el formato correcto
    }

    // Procesar las ejecuciones para incluir información del checklist
    const history = await Promise.all(
      executionsPage.map(async (execution) => {
        try {
          
          // Buscar el checklist en la tabla document (donde se guardan los checklists)
          
          // Buscar directamente por ID del documento (ya que checklistId apunta al ID del documento)
          let documentChecklist = await prisma.document.findUnique({
            where: {
              id: execution.checklistId
            }
          });
          
          if (documentChecklist) {
          } else {
          }

          let checklistData;
          
          if (documentChecklist) {
            try {
              const parsedData = JSON.parse(documentChecklist.url);
              
                        // Verificar que el checklist esté activo
          if (parsedData.isActive === false) {
            return null;
          }
          
          // Verificar que el checklist tenga un título válido
          if (!parsedData.title || parsedData.title.trim() === '') {
            return null;
          }
              
              checklistData = {
                title: parsedData.title || 'Checklist sin título',
                description: parsedData.description || ''
              };
            } catch (error) {
              console.error('Error parsing document checklist:', error);
              checklistData = {
                title: 'Checklist sin título',
                description: ''
              };
            }
          } else {
            
            // NO crear checklists temporales - solo mostrar checklists válidos y activos
            return null;
          }
          
          // Procesar justificaciones y detalles de ejecución
          let justifications: Array<{
            itemTitle: string;
            justification: string;
            skippedAt: string | Date;
          }> = [];
          let executionDetails: any = null;
          
          if (execution.justifications) {
            try {
              const parsedJustifications = JSON.parse(execution.justifications);
              if (Array.isArray(parsedJustifications)) {
                justifications = parsedJustifications.map((just: any) => ({
                  itemTitle: just.itemTitle || 'Item sin título',
                  justification: just.justification || 'Sin justificación',
                  skippedAt: just.skippedAt || execution.executedAt
                }));
              } else {
                // Si no es un array, crear una justificación única
                justifications = [{
                  itemTitle: 'Item del checklist',
                  justification: typeof parsedJustifications === 'string' ? parsedJustifications : 'Sin justificación',
                  skippedAt: execution.executedAt
                }];
              }
            } catch (error) {
              console.error('Error parsing justifications:', error);
              // Crear justificación por defecto si falla el parsing
              justifications = [{
                itemTitle: 'Item del checklist',
                justification: 'Error al procesar justificación',
                skippedAt: execution.executedAt
              }];
            }
          }

          // Procesar detalles de ejecución si existen
          if (execution.executionDetails) {
            try {
              executionDetails = JSON.parse(execution.executionDetails);
            } catch (error) {
              console.error('Error parsing execution details:', error);
            }
          }

          return {
            id: execution.id,
            checklistId: execution.checklistId,
            checklistTitle: checklistData.title || 'Checklist sin título',
            executedAt: execution.executedAt.toISOString(),
            executedBy: execution.executedBy || 'Usuario desconocido',
            status: execution.status || 'COMPLETED',
            completedItems: execution.completedItems || 0,
            totalItems: execution.totalItems || 0,
            executionTime: execution.executionTime || 0,
            justifications: justifications.length > 0 ? justifications : undefined,
            executionDetails: executionDetails || undefined
          };
        } catch (error) {
          console.error('Error processing execution:', execution.id, error);
          return null;
        }
      })
    );

    // Filtrar ejecuciones nulas
    const validHistory = history.filter(item => item !== null);

    return NextResponse.json({
      history: validHistory,
      hasMore,
      nextPage: hasMore ? page + 1 : null
    });

  } catch (error) {
    console.error('❌ Error fetching checklist history:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
