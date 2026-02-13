import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    // Verificar que prisma esté disponible
    if (!prisma) {
      console.error('❌ Prisma is undefined!');
      return NextResponse.json(
        { error: 'Error de configuración de base de datos' },
        { status: 500 }
      );
    }
    
    console.log('✅ Prisma is available:', !!prisma);
    
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

    console.log('🔍 Fetching checklist history with params:', {
      companyId,
      sectorId,
      sectorIdType: typeof sectorId,
      sectorIdValue: sectorId
    });

    // Buscar ejecuciones de checklists
    const whereClause: any = {
      companyId: parseInt(companyId)
    };
    
    // Si se especifica un sectorId, filtrar por él, sino incluir todos (incluyendo null)
    if (sectorId && sectorId !== 'null' && sectorId !== 'undefined') {
      whereClause.sectorId = parseInt(sectorId);
    }
    
    console.log('🔍 Final where clause:', whereClause);
    
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
    
    console.log('🔍 Sample documents in database:', allDocuments);
    
    // Verificar si hay algún documento con ID 144
    const document144 = await prisma.document.findUnique({
      where: { id: 144 }
    });
    console.log('🔍 Document with ID 144 exists:', !!document144, document144 ? document144.entityType : 'N/A');
    
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
      console.log('🔍 Sample maintenance checklists in document table:', maintenanceChecklists);
    } catch (error) {
      console.log('⚠️ Error accessing document table for checklists:', error);
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

    console.log('🔍 Raw checklist executions from DB:', checklistExecutions);
    console.log('🔍 Where clause used:', whereClause);

    console.log('🔍 Found checklist executions:', checklistExecutions.length);
    if (checklistExecutions.length > 0) {
      console.log('🔍 Sample execution:', checklistExecutions[0]);
      console.log('🔍 Sample execution checklistId:', checklistExecutions[0].checklistId);
      console.log('🔍 Sample execution companyId:', checklistExecutions[0].companyId);
      console.log('🔍 Sample execution sectorId:', checklistExecutions[0].sectorId);
      
      // Verificar si las ejecuciones tienen el formato correcto
      console.log('🔍 Sample execution structure:', {
        id: checklistExecutions[0].id,
        checklistId: checklistExecutions[0].checklistId,
        executedBy: checklistExecutions[0].executedBy,
        executionTime: checklistExecutions[0].executionTime,
        completedItems: checklistExecutions[0].completedItems,
        totalItems: checklistExecutions[0].totalItems,
        companyId: checklistExecutions[0].companyId,
        sectorId: checklistExecutions[0].sectorId,
        executedAt: checklistExecutions[0].executedAt,
        status: checklistExecutions[0].status,
        justifications: checklistExecutions[0].justifications
      });
    }

    // Procesar las ejecuciones para incluir información del checklist
    const history = await Promise.all(
      executionsPage.map(async (execution) => {
        try {
          console.log('🔍 Looking for checklist with ID:', execution.checklistId);
          
          // Buscar el checklist en la tabla document (donde se guardan los checklists)
          console.log('🔍 Looking for checklist in document table with ID:', execution.checklistId);
          
          // Buscar directamente por ID del documento (ya que checklistId apunta al ID del documento)
          let documentChecklist = await prisma.document.findUnique({
            where: {
              id: execution.checklistId
            }
          });
          
          if (documentChecklist) {
            console.log('✅ Found checklist document:', {
              id: documentChecklist.id,
              entityType: documentChecklist.entityType,
              originalName: documentChecklist.originalName
            });
          } else {
            console.log('❌ Checklist document not found for ID:', execution.checklistId);
          }
          
          console.log('🔍 Checklist found in document:', !!documentChecklist, 'for ID:', execution.checklistId);
          
          let checklistData;
          
          if (documentChecklist) {
            try {
              const parsedData = JSON.parse(documentChecklist.url);
              
                        // Verificar que el checklist esté activo
          if (parsedData.isActive === false) {
            console.log('❌ Skipping inactive checklist:', parsedData.title);
            return null;
          }
          
          // Verificar que el checklist tenga un título válido
          if (!parsedData.title || parsedData.title.trim() === '') {
            console.log('❌ Skipping checklist without valid title');
            return null;
          }
              
              checklistData = {
                title: parsedData.title || 'Checklist sin título',
                description: parsedData.description || ''
              };
              console.log('✅ Checklist data parsed successfully:', checklistData.title);
            } catch (error) {
              console.error('Error parsing document checklist:', error);
              checklistData = {
                title: 'Checklist sin título',
                description: ''
              };
            }
          } else {
            console.log('⚠️ Checklist not found in document table for execution:', execution.id, 'checklistId:', execution.checklistId);
            
            // NO crear checklists temporales - solo mostrar checklists válidos y activos
            console.log('❌ Skipping orphaned execution - checklist not found');
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
              console.log('✅ Justifications parsed successfully:', justifications.length);
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
              console.log('✅ Execution details parsed successfully:', executionDetails);
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

    console.log('🔍 Total executions fetched:', executionsPage.length);
    console.log('🔍 Valid executions after filtering:', validHistory.length);
    console.log('🔍 Has more pages:', hasMore);
    console.log('✅ History processing completed successfully');

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
