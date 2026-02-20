import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Flag de módulo: DDL se ejecuta solo una vez por proceso del servidor
let instructiveTableInitialized = false;

async function ensureInstructiveTable() {
  if (instructiveTableInitialized) return;
  try {
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
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ChecklistInstructive_checklistId_idx"
      ON "ChecklistInstructive"("checklistId")
    `;
    instructiveTableInitialized = true;
  } catch {
    // La tabla puede ya existir
  }
}

// GET /api/maintenance/checklists/[id] - Obtener checklist por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const checklistId = parseInt(params.id);

    if (isNaN(checklistId)) {
      return NextResponse.json(
        { error: 'ID del checklist inválido' },
        { status: 400 }
      );
    }

    const checklist = await prisma.maintenanceChecklist.findUnique({
      where: {
        id: checklistId
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

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    // Cargar instructivos desde la tabla ChecklistInstructive
    let instructives: any[] = [];
    try {
      const instructivesData = await prisma.$queryRaw<any[]>`
        SELECT id, title, content, "order", "createdAt", "updatedAt"
        FROM "ChecklistInstructive"
        WHERE "checklistId" = ${checklistId}
        ORDER BY "order" ASC
      `;
      instructives = instructivesData || [];
    } catch (instructiveError) {
      console.error('⚠️ Error cargando instructivos (tabla puede no existir):', instructiveError);
      // Si la tabla no existe, usar instructivos del JSON como fallback
      instructives = (checklist.instructives as any[]) || [];
    }

    return NextResponse.json({
      success: true,
      checklist: {
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
        company: checklist.company,
        createdAt: checklist.createdAt.toISOString(),
        updatedAt: checklist.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo checklist:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/maintenance/checklists/[id] - Actualizar checklist
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const checklistId = parseInt(params.id);
    const body = await request.json();

    if (isNaN(checklistId)) {
      return NextResponse.json(
        { error: 'ID del checklist inválido' },
        { status: 400 }
      );
    }

    const existingChecklist = await prisma.maintenanceChecklist.findUnique({
      where: {
        id: checklistId
      }
    });

    if (!existingChecklist) {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    // Normalizar sectorId
    let normalizedSectorId = body.sectorId;
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
      normalizedSectorId = existingChecklist.sectorId;
    }

    // Normalizar machineId
    let normalizedMachineId = body.machineId;
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
      normalizedMachineId = existingChecklist.machineId;
    }

    // Preparar datos de actualización
    const updateData: any = {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.isTemplate !== undefined && { isTemplate: body.isTemplate }),
      ...(body.estimatedTotalTime !== undefined && { estimatedTotalTime: body.estimatedTotalTime }),
      ...(body.items !== undefined && { items: body.items }),
      ...(body.phases !== undefined && { phases: body.phases }),
      ...(body.instructives !== undefined && { instructives: body.instructives }),
      ...(body.sectorId !== undefined && { sectorId: normalizedSectorId }),
      ...(body.machineId !== undefined && { machineId: normalizedMachineId })
    };

    // Actualizar el checklist en la tabla dedicada
    const updatedChecklist = await prisma.maintenanceChecklist.update({
      where: {
        id: checklistId
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

    // Guardar instructivos en la tabla ChecklistInstructive
    if (body.instructives !== undefined && Array.isArray(body.instructives)) {
      
      try {
        await ensureInstructiveTable();

        // Eliminar instructivos existentes
        await prisma.$executeRaw`
          DELETE FROM "ChecklistInstructive" WHERE "checklistId" = ${checklistId}
        `;
        
        // Insertar los nuevos instructivos
        for (let i = 0; i < body.instructives.length; i++) {
          const inst = body.instructives[i];
          await prisma.$executeRaw`
            INSERT INTO "ChecklistInstructive" ("checklistId", "title", "content", "order", "createdAt", "updatedAt")
            VALUES (${checklistId}, ${inst.title}, ${inst.content}, ${i}, NOW(), NOW())
          `;
        }
        
      } catch (instructiveError) {
        console.error('❌ Error actualizando instructivos:', instructiveError);
        // No fallar el proceso si hay error con instructivos
      }
    }

    // Cargar instructivos actualizados desde la base de datos
    let instructives: any[] = [];
    try {
      const instructivesData = await prisma.$queryRaw<any[]>`
        SELECT id, title, content, "order", "createdAt", "updatedAt"
        FROM "ChecklistInstructive"
        WHERE "checklistId" = ${checklistId}
        ORDER BY "order" ASC
      `;
      instructives = instructivesData || [];
    } catch (instructiveError) {
      console.error('⚠️ Error cargando instructivos:', instructiveError);
      instructives = body.instructives || updatedChecklistData.instructives || [];
    }

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
        instructives: instructives,
        sector: updatedChecklist.sector,
        machine: updatedChecklist.machine,
        createdAt: updatedChecklist.createdAt.toISOString(),
        updatedAt: updatedChecklist.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error actualizando checklist:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor al actualizar el checklist' },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/checklists/[id] - Eliminar checklist
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const checklistId = parseInt(params.id);
    const body = await request.json();

    if (isNaN(checklistId)) {
      return NextResponse.json(
        { error: 'ID del checklist inválido' },
        { status: 400 }
      );
    }

    // PRIMERO: Eliminar todas las ejecuciones del checklist
    try {
      const deletedExecutions = await prisma.checklistExecution.deleteMany({
        where: {
          checklistId: checklistId
        }
      });
      
    } catch (executionError) {
      console.error('⚠️ Error eliminando ejecuciones del checklist:', executionError);
      // Continuar con la eliminación del checklist aunque falle la limpieza del historial
    }

    // SEGUNDO: Eliminar el checklist de la tabla dedicada
    const deletedChecklist = await prisma.maintenanceChecklist.delete({
      where: {
        id: checklistId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Checklist eliminado correctamente',
      deletedChecklist: {
        id: deletedChecklist.id,
        title: deletedChecklist.title
      }
    });

  } catch (error) {
    console.error('Error eliminando checklist:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor al eliminar el checklist' },
      { status: 500 }
    );
  }
}
