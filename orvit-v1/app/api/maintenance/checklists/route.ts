import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineId = searchParams.get('machineId');
    const isTemplate = searchParams.get('isTemplate');
    const frequency = searchParams.get('frequency');
    const checklistId = searchParams.get('checklistId');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '10');

    // Si se especifica un checklistId, buscar solo ese checklist
    if (checklistId) {
      // Intentar buscar primero en la tabla Document con entityType
      let document = await prisma.document.findUnique({
        where: {
          id: parseInt(checklistId),
          entityType: 'MAINTENANCE_CHECKLIST'
        }
      });

      // Si no se encuentra con entityType, intentar buscar solo por ID en Document
      if (!document) {
        document = await prisma.document.findUnique({
          where: {
            id: parseInt(checklistId)
          }
        });
      }

      // Si aún no se encuentra en Document, buscar en la tabla MaintenanceChecklist
      if (!document) {
        try {
          const maintenanceChecklist = await prisma.maintenanceChecklist.findUnique({
            where: {
              id: parseInt(checklistId)
            },
            include: {
              sector: {
                select: {
                  id: true,
                  name: true,
                  description: true
                }
              },
              machine: {
                select: {
                  id: true,
                  name: true,
                  type: true
                }
              },
              company: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });

          if (maintenanceChecklist) {
            // Convertir el checklist de MaintenanceChecklist al formato esperado
            let instructives: any[] = [];
            try {
              const instructivesData = await prisma.$queryRaw<any[]>` 
                SELECT id, title, content, "order", "createdAt", "updatedAt"
                FROM "ChecklistInstructive"
                WHERE "checklistId" = ${parseInt(checklistId)}
                ORDER BY "order" ASC
              `;
              instructives = instructivesData || [];
            } catch (instructiveError) {
              instructives = (maintenanceChecklist.instructives as any[]) || [];
            }

            return NextResponse.json({
              success: true,
              checklists: [{
                id: maintenanceChecklist.id,
                title: maintenanceChecklist.title,
                description: maintenanceChecklist.description,
                frequency: maintenanceChecklist.frequency,
                category: maintenanceChecklist.category || 'MAINTENANCE',
                isTemplate: maintenanceChecklist.isTemplate,
                isActive: maintenanceChecklist.isActive,
                estimatedTotalTime: maintenanceChecklist.estimatedTotalTime || 0,
                machineId: maintenanceChecklist.machineId,
                sectorId: maintenanceChecklist.sectorId,
                companyId: maintenanceChecklist.companyId,
                items: (maintenanceChecklist.items as any[]) || [],
                phases: (maintenanceChecklist.phases as any[]) || [],
                instructives: instructives,
                sector: maintenanceChecklist.sector,
                machine: maintenanceChecklist.machine,
                company: maintenanceChecklist.company,
                createdAt: maintenanceChecklist.createdAt.toISOString(),
                updatedAt: maintenanceChecklist.updatedAt.toISOString()
              }]
            });
          }
        } catch (checklistError) {
          // Error buscando en MaintenanceChecklist
        }
      }

      if (!document) {
        return NextResponse.json(
          { error: 'Checklist no encontrado' },
          { status: 404 }
        );
      }

      try {
        const checklistData = JSON.parse(document.url);

        // Cargar instructivos desde la tabla ChecklistInstructive
        let instructives: any[] = [];
        try {
          const instructivesData = await prisma.$queryRaw<any[]>`
            SELECT id, title, content, "order", "createdAt", "updatedAt"
            FROM "ChecklistInstructive"
            WHERE "checklistId" = ${document.id}
            ORDER BY "order" ASC
          `;
          instructives = instructivesData || [];
        } catch (instructiveError) {
          // Si la tabla no existe, usar instructivos del JSON como fallback
          instructives = checklistData.instructives || [];
        }

        return NextResponse.json({
          success: true,
          checklists: [{
            ...checklistData,
            id: document.id,
            instructives: instructives,
            createdAt: document.uploadDate,
            updatedAt: document.uploadDate
          }]
        });
      } catch (error) {
        console.error('Error parsing checklist data:', error);
        return NextResponse.json(
          { error: 'Error al procesar los datos del checklist' },
          { status: 500 }
        );
      }
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const where: any = {
      companyId: parseInt(companyId),
      isActive: true
    };

    if (sectorId) {
      where.sectorId = parseInt(sectorId);
    }

    if (machineId) {
      where.machineId = parseInt(machineId);
    }

    if (isTemplate !== null) {
      where.isTemplate = isTemplate === 'true';
    }

    if (frequency) {
      where.frequency = frequency;
    }

    // Buscar checklists desde la tabla dedicada MaintenanceChecklist
    const checklistWhere: any = {
      companyId: parseInt(companyId),
      isActive: true
    };

    // Si se especifica sectorId, filtrar directamente
    if (sectorId) {
      checklistWhere.sectorId = parseInt(sectorId);
    }

    // Buscar checklists desde la tabla dedicada
    const checklistRecords = await prisma.maintenanceChecklist.findMany({
      where: checklistWhere,
      include: {
        sector: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      skip: skip,
      take: take + 1 // Tomamos uno más para saber si hay más resultados
    });

    // Si no se filtró por sectorId en la consulta, pero se especificó, 
    // necesitamos filtrar por mantenimientos dentro de los items
    let filteredChecklists = checklistRecords;
    if (sectorId && !checklistWhere.sectorId) {
      const requestedSectorId = parseInt(sectorId);
      
      // Filtrar de forma asíncrona verificando mantenimientos en items
      const filteredPromises = filteredChecklists.map(async (checklist) => {
        try {
          const items = checklist.items as any[] || [];
          const phases = checklist.phases as any[] || [];
          
          // Recopilar todos los maintenanceId de los items
          const maintenanceIds: number[] = [];
          
          // Verificar items directos
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              if (item.maintenanceId && !isNaN(Number(item.maintenanceId))) {
                maintenanceIds.push(Number(item.maintenanceId));
              }
            });
          }
          
          // Verificar items en fases
          if (Array.isArray(phases)) {
            phases.forEach((phase: any) => {
              if (phase.items && Array.isArray(phase.items)) {
                phase.items.forEach((item: any) => {
                  if (item.maintenanceId && !isNaN(Number(item.maintenanceId))) {
                    maintenanceIds.push(Number(item.maintenanceId));
                  }
                });
              }
            });
          }
          
          // Si no hay mantenimientos, verificar por máquina del checklist
          if (maintenanceIds.length === 0) {
            if (checklist.machineId) {
              const machine = await prisma.machine.findFirst({
                where: {
                  id: checklist.machineId,
                  sectorId: requestedSectorId
                },
                select: { id: true, sectorId: true }
              });
              return machine ? checklist : null;
            }
            return null;
          }
          
          // Verificar que al menos uno de los mantenimientos pertenezca al sector
          for (const maintenanceId of maintenanceIds) {
            try {
              let maintenanceDoc = await prisma.document.findFirst({
                where: {
                  id: Number(maintenanceId),
                  entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
                }
              });
              
              if (!maintenanceDoc) {
                maintenanceDoc = await prisma.document.findFirst({
                  where: {
                    entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
                    OR: [
                      { entityId: maintenanceId.toString() },
                      { entityId: { contains: maintenanceId.toString() } }
                    ]
                  }
                });
              }
              
              if (maintenanceDoc) {
                const maintenanceData = JSON.parse(maintenanceDoc.url);
                let maintenanceSectorId = maintenanceData.sectorId;
                
                if (maintenanceSectorId === '' || maintenanceSectorId === 'all' || maintenanceSectorId === null || maintenanceSectorId === undefined) {
                  maintenanceSectorId = null;
                } else {
                  maintenanceSectorId = Number(maintenanceSectorId);
                  if (isNaN(maintenanceSectorId)) {
                    maintenanceSectorId = null;
                  }
                }
                
                if (maintenanceSectorId === requestedSectorId) {
                  return checklist;
                }
                
                if (maintenanceSectorId === null && maintenanceData.machineId) {
                  const machine = await prisma.machine.findFirst({
                    where: {
                      id: Number(maintenanceData.machineId),
                      sectorId: requestedSectorId
                    },
                    select: { id: true, sectorId: true }
                  });
                  if (machine) {
                    return checklist;
                  }
                }
              }
            } catch (error) {
              // Continuar
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      });
      
      const filteredResults = await Promise.all(filteredPromises);
      filteredChecklists = filteredResults.filter((c): c is typeof c => c !== null);
    }

    // Verificar si hay más resultados
    const hasMore = filteredChecklists.length > take;
    const paginatedChecklists = hasMore ? filteredChecklists.slice(0, take) : filteredChecklists;

    // Aplicar filtros adicionales antes del batch
    let preFilteredChecklists = paginatedChecklists;
    if (machineId) {
      preFilteredChecklists = preFilteredChecklists.filter(c => c.machineId === null || c.machineId === parseInt(machineId));
    }
    if (isTemplate !== null) {
      preFilteredChecklists = preFilteredChecklists.filter(c => c.isTemplate === (isTemplate === 'true'));
    }
    if (frequency) {
      preFilteredChecklists = preFilteredChecklists.filter(c => c.frequency === frequency);
    }

    // ✅ OPTIMIZACIÓN: Batch queries para evitar N+1
    const checklistIds = preFilteredChecklists.map(c => c.id);

    // Query batch para ejecuciones en progreso
    const [inProgressExecutions, allInstructives] = await Promise.all([
      prisma.checklistExecution.findMany({
        where: {
          checklistId: { in: checklistIds },
          status: 'IN_PROGRESS',
          companyId: parseInt(companyId)
        },
        orderBy: { executedAt: 'desc' },
        distinct: ['checklistId']
      }),
      // Query batch para instructivos
      (async () => {
        try {
          return await prisma.$queryRaw<any[]>`
            SELECT id, "checklistId", title, content, "order", "createdAt", "updatedAt"
            FROM "ChecklistInstructive"
            WHERE "checklistId" = ANY(${checklistIds}::int[])
            ORDER BY "checklistId", "order" ASC
          `;
        } catch {
          return [];
        }
      })()
    ]);

    // Crear maps para acceso O(1)
    const executionMap = new Map(inProgressExecutions.map(e => [e.checklistId, e]));
    const instructivesMap = new Map<number, any[]>();
    for (const inst of allInstructives) {
      const existing = instructivesMap.get(inst.checklistId) || [];
      existing.push(inst);
      instructivesMap.set(inst.checklistId, existing);
    }

    // Mapear checklists sin queries adicionales
    const checklists = preFilteredChecklists.map(checklist => {
      const inProgressExecution = executionMap.get(checklist.id);
      const instructives = instructivesMap.get(checklist.id) || (checklist.instructives as any[]) || [];

      return {
        id: checklist.id,
        title: checklist.title,
        description: checklist.description,
        frequency: checklist.frequency,
        category: checklist.category || 'MAINTENANCE',
        isTemplate: checklist.isTemplate,
        isActive: checklist.isActive,
        estimatedTotalTime: checklist.estimatedTotalTime || 0,
        machineId: checklist.machineId,
        sectorId: checklist.sectorId,
        companyId: checklist.companyId,
        items: (checklist.items as any[]) || [],
        phases: (checklist.phases as any[]) || [],
        instructives: instructives,
        sector: checklist.sector,
        machine: checklist.machine,
        createdAt: checklist.createdAt.toISOString(),
        updatedAt: checklist.updatedAt.toISOString(),
        hasInProgressExecution: !!inProgressExecution,
        inProgressExecutionId: inProgressExecution?.id || null
      };
    });

    return NextResponse.json({
      success: true,
      checklists: checklists,
      hasMore: hasMore,
      total: checklists.length
    });
  } catch (error) {
    console.error('Error fetching maintenance checklists:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Normalizar sectorId: convertir string vacío a null, y strings numéricos a números
    let normalizedSectorId = data.sectorId;
    if (normalizedSectorId === '' || normalizedSectorId === 'all' || normalizedSectorId === null || normalizedSectorId === undefined) {
      normalizedSectorId = null;
    } else {
      normalizedSectorId = Number(normalizedSectorId);
      if (isNaN(normalizedSectorId)) {
        normalizedSectorId = null;
      }
    }

    // Normalizar machineId
    let normalizedMachineId = data.machineId;
    if (normalizedMachineId === 'all' || normalizedMachineId === '' || normalizedMachineId === null || normalizedMachineId === undefined) {
      normalizedMachineId = null;
    } else {
      normalizedMachineId = Number(normalizedMachineId);
      if (isNaN(normalizedMachineId)) {
        normalizedMachineId = null;
      }
    }

    // Guardar en la tabla dedicada MaintenanceChecklist
    const checklist = await prisma.maintenanceChecklist.create({
      data: {
        title: data.title,
        description: data.description || null,
        frequency: (data.frequency || 'MONTHLY') as any,
        machineId: normalizedMachineId,
        sectorId: normalizedSectorId,
        companyId: data.companyId,
        isActive: data.isActive !== false,
        isTemplate: data.isTemplate || false,
        category: data.category || 'MAINTENANCE',
        estimatedTotalTime: data.estimatedTotalTime || 0,
        items: (data.items || []) as any,
        phases: (data.phases || []) as any,
        instructives: (data.instructives || []) as any
      },
      include: {
        sector: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Guardar instructivos en la tabla ChecklistInstructive
    if (data.instructives && Array.isArray(data.instructives) && data.instructives.length > 0) {
      try {
        // Primero, verificar si la tabla existe, si no, crearla
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS "ChecklistInstructive" (
            "id" SERIAL PRIMARY KEY,
            "checklistId" INTEGER NOT NULL,
            "title" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "order" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        // Crear índice si no existe
        await prisma.$executeRaw`
          CREATE INDEX IF NOT EXISTS "ChecklistInstructive_checklistId_idx" 
          ON "ChecklistInstructive"("checklistId")
        `;
        
        // Eliminar instructivos existentes (por si acaso)
        await prisma.$executeRaw`
          DELETE FROM "ChecklistInstructive" WHERE "checklistId" = ${checklist.id}
        `;
        
        // Insertar los nuevos instructivos
        for (let i = 0; i < data.instructives.length; i++) {
          const inst = data.instructives[i];
          await prisma.$executeRaw`
            INSERT INTO "ChecklistInstructive" ("checklistId", "title", "content", "order", "createdAt", "updatedAt")
            VALUES (${checklist.id}, ${inst.title}, ${inst.content}, ${i}, NOW(), NOW())
          `;
        }
      } catch (instructiveError) {
        // No fallar el proceso si hay error con instructivos
      }
    }

    // Retornar el checklist con el formato esperado
    return NextResponse.json({
      id: checklist.id,
      title: checklist.title,
      description: checklist.description,
      frequency: checklist.frequency,
      category: checklist.category || 'MAINTENANCE',
      isTemplate: checklist.isTemplate,
      isActive: checklist.isActive,
      estimatedTotalTime: checklist.estimatedTotalTime || 0,
      machineId: checklist.machineId,
      sectorId: checklist.sectorId,
      companyId: checklist.companyId,
      items: (checklist.items as any[]) || [],
      phases: (checklist.phases as any[]) || [],
      instructives: (checklist.instructives as any[]) || [],
      sector: checklist.sector,
      machine: checklist.machine,
      createdAt: checklist.createdAt.toISOString(),
      updatedAt: checklist.updatedAt.toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance checklist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checklistId = searchParams.get('id');

    if (!checklistId) {
      return NextResponse.json(
        { error: 'ID del checklist es requerido' },
        { status: 400 }
      );
    }

    const numericChecklistId = parseInt(checklistId);

    // PRIMERO: Eliminar todas las ejecuciones del checklist
    let deletedExecutionsCount = 0;
    try {
      const deletedExecutions = await prisma.checklistExecution.deleteMany({
        where: {
          checklistId: numericChecklistId
        }
      });
      
      deletedExecutionsCount = deletedExecutions.count;
    } catch (executionError) {
      // Continuar con la eliminación del checklist aunque falle la limpieza del historial
    }

    // SEGUNDO: Eliminar el checklist de la tabla dedicada
    const deletedChecklist = await prisma.maintenanceChecklist.delete({
      where: {
        id: numericChecklistId
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Checklist eliminado correctamente. Se eliminaron ${deletedExecutionsCount} ejecuciones del historial.` 
    });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el checklist' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { checklistId, lastExecutionDate, isCompleted, executionStatus, sectorId, machineId, ...rest } = data;

    if (!checklistId) {
      return NextResponse.json(
        { error: 'ID del checklist es requerido' },
        { status: 400 }
      );
    }

    // Obtener el checklist actual desde la tabla dedicada
    const existingChecklist = await prisma.maintenanceChecklist.findUnique({
      where: {
        id: parseInt(checklistId)
      }
    });

    if (!existingChecklist) {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    // Normalizar sectorId para la actualización
    let normalizedSectorId = sectorId;
    if (normalizedSectorId !== undefined) {
      if (normalizedSectorId === '' || normalizedSectorId === 'all' || normalizedSectorId === null) {
        normalizedSectorId = null;
      } else {
        normalizedSectorId = Number(normalizedSectorId);
        if (isNaN(normalizedSectorId)) {
          normalizedSectorId = null;
        }
      }
    } else {
      normalizedSectorId = existingChecklist.sectorId; // Mantener el valor actual
    }

    // Normalizar machineId para la actualización
    let normalizedMachineId = machineId;
    if (normalizedMachineId !== undefined) {
      if (normalizedMachineId === '' || normalizedMachineId === 'all' || normalizedMachineId === null) {
        normalizedMachineId = null;
      } else {
        normalizedMachineId = Number(normalizedMachineId);
        if (isNaN(normalizedMachineId)) {
          normalizedMachineId = null;
        }
      }
    } else {
      normalizedMachineId = existingChecklist.machineId; // Mantener el valor actual
    }
    
    // Preparar datos de actualización
    const updateData: any = {
      ...(rest.title !== undefined && { title: rest.title }),
      ...(rest.description !== undefined && { description: rest.description }),
      ...(rest.frequency !== undefined && { frequency: rest.frequency }),
      ...(rest.category !== undefined && { category: rest.category }),
      ...(rest.isActive !== undefined && { isActive: rest.isActive }),
      ...(rest.isTemplate !== undefined && { isTemplate: rest.isTemplate }),
      ...(rest.estimatedTotalTime !== undefined && { estimatedTotalTime: rest.estimatedTotalTime }),
      ...(rest.items !== undefined && { items: rest.items }),
      ...(rest.phases !== undefined && { phases: rest.phases }),
      ...(rest.instructives !== undefined && { instructives: rest.instructives }),
      ...(sectorId !== undefined && { sectorId: normalizedSectorId }),
      ...(machineId !== undefined && { machineId: normalizedMachineId })
    };

    // Actualizar el checklist en la tabla dedicada
    const updatedChecklist = await prisma.maintenanceChecklist.update({
      where: {
        id: parseInt(checklistId)
      },
      data: updateData,
      include: {
        sector: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        machine: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Checklist actualizado correctamente',
      checklist: {
        id: updatedChecklist.id,
        title: updatedChecklist.title,
        description: updatedChecklist.description,
        frequency: updatedChecklist.frequency,
        category: updatedChecklist.category || 'MAINTENANCE',
        isTemplate: updatedChecklist.isTemplate,
        isActive: updatedChecklist.isActive,
        estimatedTotalTime: updatedChecklist.estimatedTotalTime || 0,
        machineId: updatedChecklist.machineId,
        sectorId: updatedChecklist.sectorId,
        companyId: updatedChecklist.companyId,
        items: (updatedChecklist.items as any[]) || [],
        phases: (updatedChecklist.phases as any[]) || [],
        instructives: (updatedChecklist.instructives as any[]) || [],
        sector: updatedChecklist.sector,
        machine: updatedChecklist.machine,
        createdAt: updatedChecklist.createdAt.toISOString(),
        updatedAt: updatedChecklist.updatedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el checklist' },
      { status: 500 }
    );
  }
}
