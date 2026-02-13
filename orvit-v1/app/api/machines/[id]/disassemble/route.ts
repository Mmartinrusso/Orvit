import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Validar token desde cookies
async function validateTokenFromCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return null;

  try {
    const JWT_SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET || 'Messi'
    );
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: number; companyId: number; role: string };
  } catch {
    return null;
  }
}

// Helper: obtener todos los descendientes de un componente (CTE recursivo)
async function getComponentDescendants(componentId: number): Promise<number[]> {
  const result = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Component" WHERE "parentId" = ${componentId}
      UNION ALL
      SELECT c.id FROM "Component" c
      INNER JOIN descendants d ON c."parentId" = d.id
    )
    SELECT id FROM descendants;
  `;
  return result.map(r => r.id);
}

interface ComponentAction {
  componentId: number;
  action: 'promote' | 'delete' | 'orphan'; // orphan = mantener sin máquina
  newMachineName?: string; // Solo para promote
}

interface DisassembleRequest {
  operationId: string;
  componentActions: ComponentAction[];
  deleteMachine: boolean; // Si true, elimina la máquina; si false, la deja como DECOMMISSIONED
  migrateHistory: 'move' | 'keep'; // Para componentes promovidos
  migrateDocuments: 'move' | 'copy' | 'none';
}

// POST /api/machines/[id]/disassemble
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validar autenticación
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const machineId = Number(params.id);
  if (isNaN(machineId)) {
    return NextResponse.json({ error: 'ID de máquina inválido' }, { status: 400 });
  }

  let body: DisassembleRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  // Validar operationId
  if (!body.operationId) {
    return NextResponse.json({ error: 'operationId es requerido para idempotencia' }, { status: 400 });
  }

  // 2. Verificar idempotencia
  const existingOp = await prisma.disassembleOperation.findUnique({
    where: { id: body.operationId }
  }).catch(() => null); // Si la tabla no existe aún, ignorar

  if (existingOp?.status === 'completed') {
    return NextResponse.json({
      success: true,
      cached: true,
      message: 'Operación ya completada anteriormente',
      ...existingOp.result as object
    });
  }

  if (existingOp?.status === 'pending') {
    return NextResponse.json({ error: 'Operación en progreso' }, { status: 409 });
  }

  // 3. Obtener máquina
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      components: {
        where: { parentId: null }
      }
    }
  });

  if (!machine) {
    return NextResponse.json({ error: 'Máquina no encontrada' }, { status: 404 });
  }

  if (machine.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Sin permisos para esta máquina' }, { status: 403 });
  }

  // 4. Registrar operación como pendiente
  try {
    await prisma.disassembleOperation.upsert({
      where: { id: body.operationId },
      create: {
        id: body.operationId,
        machineId,
        companyId: user.companyId,
        userId: user.id,
        status: 'pending'
      },
      update: { status: 'pending' }
    });
  } catch {
    // Si la tabla no existe, continuar sin idempotencia
    console.warn('DisassembleOperation table not found, proceeding without idempotency');
  }

  try {
    // 5. Ejecutar transacción con lock
    const result = await prisma.$transaction(async (tx) => {
      // Lock exclusivo
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${machineId + 1000000})`; // Offset para no colisionar con promote

      const promotedMachines: any[] = [];
      const deletedComponents: number[] = [];
      const orphanedComponents: number[] = [];
      let totalMigratedWorkOrders = 0;
      let totalMigratedFailures = 0;
      let totalMigratedDocuments = 0;
      let totalMigratedLotInstallations = 0;
      let totalMigratedChecklists = 0;

      // Procesar cada acción de componente
      for (const action of body.componentActions) {
        const component = await tx.component.findUnique({
          where: { id: action.componentId },
          include: { machine: true }
        });

        if (!component || component.machineId !== machineId) {
          continue; // Componente no pertenece a esta máquina
        }

        // Obtener descendientes
        const descendantIds = await getComponentDescendants(action.componentId);
        const allComponentIds = [action.componentId, ...descendantIds];

        if (action.action === 'promote') {
          // PROMOVER A MÁQUINA INDEPENDIENTE

          // Generar assetCode único
          let assetCode = component.code;
          if (assetCode) {
            const existing = await tx.machine.findFirst({
              where: { assetCode, companyId: machine.companyId }
            });
            if (existing) {
              assetCode = `${assetCode}-DIS-${Date.now()}`;
            }
          }

          // Crear nueva máquina
          const newMachine = await tx.machine.create({
            data: {
              name: action.newMachineName || component.name,
              type: 'OTHER',
              description: component.description,
              technicalNotes: component.technicalInfo,
              assetCode,
              logo: component.logo,
              status: 'ACTIVE',
              companyId: machine.companyId,
              areaId: machine.areaId,
              sectorId: machine.sectorId,
              plantZoneId: machine.plantZoneId,
              criticalityProduction: component.criticality,
              criticalitySafety: component.isSafetyCritical ? 10 : 1,
              // Tracking
              derivedFromComponentId: action.componentId,
              originMachineId: machineId,
              promotedAt: new Date(),
            }
          });

          // Actualizar componente raíz - ahora es componente de la nueva máquina
          await tx.component.update({
            where: { id: action.componentId },
            data: {
              machineId: newMachine.id,
              parentId: null,
              // Los subcomponentes de nivel 1 se convierten en componentes
            }
          });

          // Actualizar descendientes - todos van a la nueva máquina
          if (descendantIds.length > 0) {
            await tx.component.updateMany({
              where: { id: { in: descendantIds } },
              data: { machineId: newMachine.id }
            });

            // Los hijos directos del componente promovido pierden su parentId
            // (se convierten en componentes de nivel 1 de la nueva máquina)
            await tx.component.updateMany({
              where: { parentId: action.componentId },
              data: { parentId: null }
            });
          }

          // Migrar historial si corresponde
          if (body.migrateHistory === 'move') {
            // Work Orders (solo las asociadas a los componentes migrados)
            const woResult = await tx.workOrder.updateMany({
              where: { componentId: { in: allComponentIds } },
              data: { machineId: newMachine.id }
            });
            totalMigratedWorkOrders += woResult.count;

            // Failure Occurrences (fallas asociadas a los componentes)
            const failResult = await tx.failureOccurrence.updateMany({
              where: { subcomponentId: { in: allComponentIds } },
              data: { machineId: newMachine.id }
            });
            totalMigratedFailures += failResult.count;

            // History Events (solo los de componentes migrados)
            await tx.historyEvent.updateMany({
              where: { componentId: { in: allComponentIds } },
              data: { machineId: newMachine.id }
            });

            // SolutionApplied - Las referencias a finalComponentId/finalSubcomponentId
            // se mantienen porque los IDs de componente no cambian, solo su machineId
            // No necesitan actualización
          }

          // Migrar instalaciones de lotes de inventario (solo las del componente)
          const lotResult = await tx.lotInstallation.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { machineId: newMachine.id }
          });
          totalMigratedLotInstallations += lotResult.count;

          // Migrar checklists de mantenimiento preventivo (los del componente)
          const checklistResult = await tx.maintenanceChecklist.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { machineId: newMachine.id }
          });
          totalMigratedChecklists += checklistResult.count;

          // NOTA: ToolMachine es a nivel de máquina, no se migra automáticamente
          // ComponentTool se mantiene con el componente (relación directa)

          // Migrar documentos (solo los asociados a los componentes migrados)
          if (body.migrateDocuments === 'move') {
            const docResult = await tx.document.updateMany({
              where: { componentId: { in: allComponentIds } },
              data: { machineId: newMachine.id }
            });
            totalMigratedDocuments += docResult.count;
          } else if (body.migrateDocuments === 'copy') {
            const docs = await tx.document.findMany({
              where: { componentId: { in: allComponentIds } }
            });
            for (const doc of docs) {
              await tx.document.create({
                data: {
                  url: doc.url,
                  fileName: doc.fileName,
                  originalName: doc.originalName,
                  name: doc.name,
                  type: doc.type,
                  fileSize: doc.fileSize,
                  entityType: 'machine',
                  entityId: String(newMachine.id),
                  machineId: newMachine.id,
                  componentId: doc.componentId,
                  folder: doc.folder,
                }
              });
            }
            totalMigratedDocuments += docs.length;
          }

          // Crear evento de historial en nueva máquina
          await tx.historyEvent.create({
            data: {
              type: 'MACHINE_CREATED_FROM_DISASSEMBLE',
              description: `Máquina creada al desarmar "${machine.name}"`,
              itemId: newMachine.id,
              itemType: 'machine',
              machineId: newMachine.id,
              userId: user.id,
              companyId: machine.companyId,
              metadata: {
                originMachineId: machineId,
                originMachineName: machine.name,
                originalComponentId: action.componentId,
                originalComponentName: component.name,
              }
            }
          });

          promotedMachines.push({
            id: newMachine.id,
            name: newMachine.name,
            fromComponent: component.name,
            componentsCount: allComponentIds.length,
          });

        } else if (action.action === 'delete') {
          // ELIMINAR COMPONENTE Y DESCENDIENTES

          // Eliminar documentos asociados
          await tx.document.deleteMany({
            where: { componentId: { in: allComponentIds } }
          });

          // Desvincular work orders (moverlas a la máquina sin componente)
          await tx.workOrder.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { componentId: null }
          });

          // Limpiar referencias en SolutionApplied antes de eliminar fallas
          await tx.solutionApplied.updateMany({
            where: { finalComponentId: { in: allComponentIds } },
            data: { finalComponentId: null }
          });
          await tx.solutionApplied.updateMany({
            where: { finalSubcomponentId: { in: allComponentIds } },
            data: { finalSubcomponentId: null }
          });

          // Eliminar fallas (esto también elimina las SolutionApplied relacionadas por cascade)
          await tx.failureOccurrence.deleteMany({
            where: { subcomponentId: { in: allComponentIds } }
          });

          // Desvincular instalaciones de lotes
          await tx.lotInstallation.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { componentId: null }
          });

          // Desvincular checklists de mantenimiento preventivo del componente
          // (quedan asociados a la máquina original sin componente específico)
          await tx.maintenanceChecklist.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { componentId: null }
          });

          // Eliminar eventos de historial
          await tx.historyEvent.deleteMany({
            where: { componentId: { in: allComponentIds } }
          });

          // Eliminar componentes (descendientes primero, luego raíz)
          // ComponentTool se elimina automáticamente por onDelete: Cascade
          if (descendantIds.length > 0) {
            await tx.component.deleteMany({
              where: { id: { in: descendantIds } }
            });
          }
          await tx.component.delete({
            where: { id: action.componentId }
          });

          deletedComponents.push(action.componentId);

        } else if (action.action === 'orphan') {
          // DEJAR COMO HUÉRFANO (sin máquina)
          await tx.component.updateMany({
            where: { id: { in: allComponentIds } },
            data: { machineId: null }
          });

          // Desvincular instalaciones de lotes de la máquina (mantener en componente)
          await tx.lotInstallation.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { machineId: null }
          });

          // Desvincular checklists de mantenimiento de la máquina (mantener en componente)
          await tx.maintenanceChecklist.updateMany({
            where: { componentId: { in: allComponentIds } },
            data: { machineId: null }
          });

          orphanedComponents.push(...allComponentIds);
        }
      }

      // 6. Migrar checklists a nivel máquina (sin componentId) a la primera máquina promovida
      let totalMigratedPreventiveTemplates = 0;
      if (promotedMachines.length > 0) {
        // Checklists a nivel máquina van a la primera máquina promovida
        const firstPromotedMachine = promotedMachines[0];
        const machineChecklistResult = await tx.maintenanceChecklist.updateMany({
          where: {
            machineId,
            componentId: null  // Solo los que son a nivel máquina
          },
          data: { machineId: firstPromotedMachine.id }
        });
        totalMigratedChecklists += machineChecklistResult.count;

        // Migrar templates de mantenimiento preventivo (almacenados como JSON en Document)
        const preventiveTemplates = await tx.document.findMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
            url: { contains: `"machineId":${machineId}` }
          }
        });

        for (const template of preventiveTemplates) {
          try {
            const data = JSON.parse(template.url);
            if (data.machineId === machineId) {
              // Actualizar el machineId en el JSON
              data.machineId = firstPromotedMachine.id;
              // También actualizar machineName si existe
              if (data.machineName) {
                data.machineName = firstPromotedMachine.name;
              }
              await tx.document.update({
                where: { id: template.id },
                data: { url: JSON.stringify(data) }
              });
              totalMigratedPreventiveTemplates++;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // 7. Manejar la máquina original
      if (body.deleteMachine) {
        // Crear evento de historial antes de eliminar
        await tx.historyEvent.create({
          data: {
            type: 'MACHINE_DISASSEMBLED',
            description: `Máquina "${machine.name}" desarmada y eliminada`,
            itemId: machineId,
            itemType: 'machine',
            machineId: null, // Ya no existe
            userId: user.id,
            companyId: machine.companyId,
            metadata: {
              machineName: machine.name,
              machineAssetCode: machine.assetCode,
              promotedMachines: promotedMachines.map(m => ({ id: m.id, name: m.name })),
              deletedComponents: deletedComponents.length,
              orphanedComponents: orphanedComponents.length,
            }
          }
        });

        // Eliminar documentos de la máquina (solo los que no están en componentes)
        await tx.document.deleteMany({
          where: { machineId, componentId: null }
        });

        // Desvincular work orders restantes
        await tx.workOrder.updateMany({
          where: { machineId },
          data: { machineId: null }
        });

        // Limpiar fallas residuales de la máquina (sin componente asociado)
        // Primero limpiar SolutionApplied de esas fallas
        const machineFailures = await tx.failureOccurrence.findMany({
          where: { machineId, subcomponentId: null },
          select: { id: true }
        });
        if (machineFailures.length > 0) {
          const failureIds = machineFailures.map(f => f.id);
          await tx.solutionApplied.deleteMany({
            where: { failureOccurrenceId: { in: failureIds } }
          });
          await tx.failureOccurrence.deleteMany({
            where: { id: { in: failureIds } }
          });
        }

        // Desvincular instalaciones de lotes restantes
        await tx.lotInstallation.updateMany({
          where: { machineId, componentId: null },
          data: { machineId: null }
        });

        // Eliminar historial de eventos de la máquina
        await tx.historyEvent.deleteMany({
          where: { machineId, componentId: null }
        });

        // Eliminar la máquina (ToolMachine se elimina por cascade)
        await tx.machine.delete({
          where: { id: machineId }
        });
      } else {
        // Marcar como DECOMMISSIONED
        await tx.machine.update({
          where: { id: machineId },
          data: { status: 'DECOMMISSIONED' }
        });

        await tx.historyEvent.create({
          data: {
            type: 'MACHINE_DISASSEMBLED',
            description: `Máquina "${machine.name}" desarmada y dada de baja`,
            itemId: machineId,
            itemType: 'machine',
            machineId: machineId,
            userId: user.id,
            companyId: machine.companyId,
            metadata: {
              promotedMachines: promotedMachines.map(m => ({ id: m.id, name: m.name })),
              deletedComponents: deletedComponents.length,
              orphanedComponents: orphanedComponents.length,
            }
          }
        });
      }

      return {
        promotedMachines,
        deletedComponentsCount: deletedComponents.length,
        orphanedComponentsCount: orphanedComponents.length,
        migratedWorkOrders: totalMigratedWorkOrders,
        migratedFailures: totalMigratedFailures,
        migratedDocuments: totalMigratedDocuments,
        migratedLotInstallations: totalMigratedLotInstallations,
        migratedChecklists: totalMigratedChecklists,
        migratedPreventiveTemplates: totalMigratedPreventiveTemplates,
        machineDeleted: body.deleteMachine,
      };
    }, {
      timeout: 120000, // 2 minutos para operaciones grandes
    });

    // 7. Marcar operación como completada
    try {
      await prisma.disassembleOperation.update({
        where: { id: body.operationId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result: result as any,
        }
      });
    } catch {
      // Ignorar si la tabla no existe
    }

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('Error disassembling machine:', error);

    // Marcar operación como fallida
    try {
      await prisma.disassembleOperation.update({
        where: { id: body.operationId },
        data: { status: 'failed', error: error.message }
      });
    } catch {
      // Ignorar si la tabla no existe
    }

    return NextResponse.json(
      { error: error.message || 'Error interno al desarmar máquina' },
      { status: 500 }
    );
  }
}
