import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Validar token desde cookies
async function validateTokenFromCookie() {
  const cookieStore = cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as { id: number; companyId: number; role: string };
  } catch {
    return null;
  }
}

// Helper: obtener descendientes con CTE recursivo
async function getAllDescendantIds(componentId: number): Promise<number[]> {
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

// POST /api/components/[id]/promote-to-machine
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validar autenticación
  const user = await validateTokenFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const componentId = Number(params.id);
  if (isNaN(componentId)) {
    return NextResponse.json({ error: 'ID de componente inválido' }, { status: 400 });
  }

  let body: {
    newMachineName?: string;
    machineType?: string;
    sectorId?: number;
    plantZoneId?: number;
    migrateHistory: 'move' | 'keep';
    migrateDocuments: 'copy' | 'move' | 'none';
    keepHistoryInOrigin: boolean;
    operationId: string;
  };

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
  const existingOp = await prisma.promotionOperation.findUnique({
    where: { id: body.operationId }
  });

  if (existingOp?.status === 'completed' && existingOp.newMachineId) {
    // Retornar resultado previo
    const machine = await prisma.machine.findUnique({
      where: { id: existingOp.newMachineId }
    });
    return NextResponse.json({
      success: true,
      newMachine: machine,
      cached: true,
      migratedComponents: existingOp.migratedComponents,
      migratedDocuments: existingOp.migratedDocuments,
      migratedWorkOrders: existingOp.migratedWorkOrders,
      migratedFailures: existingOp.migratedFailures,
      migratedLogs: existingOp.migratedLogs,
    });
  }

  if (existingOp?.status === 'pending') {
    return NextResponse.json({ error: 'Operación en progreso' }, { status: 409 });
  }

  // 3. Obtener componente con máquina origen
  const component = await prisma.component.findUnique({
    where: { id: componentId },
    include: { machine: true }
  });

  if (!component) {
    return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
  }

  if (!component.machine) {
    return NextResponse.json({ error: 'Componente sin máquina asociada' }, { status: 400 });
  }

  // Verificar que el componente pertenece a la empresa del usuario
  if (component.machine.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Sin permisos para este componente' }, { status: 403 });
  }

  // 4. Registrar operación como pendiente
  await prisma.promotionOperation.upsert({
    where: { id: body.operationId },
    create: {
      id: body.operationId,
      componentId,
      companyId: user.companyId,
      userId: user.id,
      status: 'pending'
    },
    update: { status: 'pending' }
  });

  try {
    // 5. Obtener todos los descendientes (CTE recursivo)
    const descendantIds = await getAllDescendantIds(componentId);
    const scopeComponentIds = [componentId, ...descendantIds];

    // 6. Ejecutar transacción con lock
    const result = await prisma.$transaction(async (tx) => {
      // Lock exclusivo para evitar doble ejecución
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${componentId})`;

      // 6a. Generar assetCode único
      let assetCode = component.code;
      if (assetCode) {
        const existingMachine = await tx.machine.findFirst({
          where: { assetCode, companyId: component.machine!.companyId }
        });
        if (existingMachine) {
          assetCode = `${assetCode}-PROM-${Date.now()}`;
        }
      }

      // 6b. Crear nueva máquina
      const newMachine = await tx.machine.create({
        data: {
          name: body.newMachineName || component.name,
          type: (body.machineType as any) || 'OTHER',
          description: component.description,
          technicalNotes: component.technicalInfo,
          assetCode,
          logo: component.logo,
          status: 'ACTIVE',
          companyId: component.machine!.companyId,
          areaId: component.machine!.areaId,
          sectorId: body.sectorId || component.machine!.sectorId,
          plantZoneId: body.plantZoneId || component.machine!.plantZoneId,
          criticalityProduction: component.criticality,
          criticalitySafety: component.isSafetyCritical ? 10 : 1,
          // Tracking de promoción
          derivedFromComponentId: componentId,
          originMachineId: component.machine!.id,
          promotedAt: new Date(),
        }
      });

      // 6c. Migrar documentos del componente raíz a la nueva máquina
      //     (antes de eliminar el componente)
      await tx.document.updateMany({
        where: { componentId: componentId },
        data: {
          machineId: newMachine.id,
          componentId: null // Ya no pertenece a un componente, ahora es de la máquina
        }
      });

      // 6d. Actualizar descendientes directos (hijos del componente promovido)
      //     Ahora pasan a ser componentes raíz de la nueva máquina
      let migratedComponents = 0;
      if (descendantIds.length > 0) {
        // Actualizar solo los hijos directos para que no tengan padre
        await tx.component.updateMany({
          where: { parentId: componentId },
          data: { machineId: newMachine.id, parentId: null }
        });

        // Actualizar el resto de descendientes (nietos, etc.)
        const directChildIds = await tx.component.findMany({
          where: { id: { in: descendantIds }, parentId: { not: componentId } },
          select: { id: true }
        });
        const otherDescendantIds = directChildIds.map(c => c.id);
        if (otherDescendantIds.length > 0) {
          await tx.component.updateMany({
            where: { id: { in: otherDescendantIds } },
            data: { machineId: newMachine.id }
          });
        }
        migratedComponents = descendantIds.length;
      }

      // 6e. Migrar work orders del componente raíz a la nueva máquina (antes de eliminar)
      await tx.workOrder.updateMany({
        where: { componentId: componentId },
        data: {
          machineId: newMachine.id,
          componentId: null // Ya no hay componente, ahora es de la máquina directamente
        }
      });

      // 6f. Migrar failure occurrences del componente raíz
      await tx.failureOccurrence.updateMany({
        where: { subcomponentId: componentId },
        data: {
          machineId: newMachine.id,
          subcomponentId: null
        }
      });

      // 6g. Migrar historial del componente raíz
      await tx.historyEvent.updateMany({
        where: { componentId: componentId },
        data: {
          machineId: newMachine.id,
          componentId: null
        }
      });

      // 6h. ELIMINAR el componente raíz (ya se convirtió en máquina)
      //     Sus datos ya fueron copiados a la nueva máquina
      await tx.component.delete({
        where: { id: componentId }
      });

      // 6i. Migrar historial de descendientes (si se especificó)
      //     Nota: El componente raíz ya fue migrado arriba antes de eliminarlo
      let migratedWorkOrders = 0;
      let migratedFailures = 0;
      let migratedLogs = 0;

      if (body.migrateHistory === 'move' && descendantIds.length > 0) {
        // Work Orders de descendientes
        const woResult = await tx.workOrder.updateMany({
          where: {
            componentId: { in: descendantIds }
          },
          data: { machineId: newMachine.id }
        });
        migratedWorkOrders = woResult.count;

        // Failure Occurrences de descendientes
        const failResult = await tx.failureOccurrence.updateMany({
          where: {
            subcomponentId: { in: descendantIds }
          },
          data: { machineId: newMachine.id }
        });
        migratedFailures = failResult.count;

        // History Events de descendientes
        const logResult = await tx.historyEvent.updateMany({
          where: { componentId: { in: descendantIds } },
          data: { machineId: newMachine.id }
        });
        migratedLogs = logResult.count;
      }

      // 6j. Migrar documentos de descendientes (MANTENIENDO componentId)
      //     Nota: Los documentos del componente raíz ya fueron migrados arriba
      let migratedDocuments = 0;
      if (body.migrateDocuments === 'move' && descendantIds.length > 0) {
        const docResult = await tx.document.updateMany({
          where: { componentId: { in: descendantIds } },
          data: { machineId: newMachine.id }
          // Mantener componentId para granularidad
        });
        migratedDocuments = docResult.count;
      } else if (body.migrateDocuments === 'copy' && descendantIds.length > 0) {
        // Duplicar documentos de descendientes
        const docs = await tx.document.findMany({
          where: { componentId: { in: descendantIds } }
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
        migratedDocuments = docs.length;
      }

      // 6k. Crear evento de historial en nueva máquina
      const historyEvent = await tx.historyEvent.create({
        data: {
          type: 'COMPONENT_PROMOTED',
          description: `Componente "${component.name}" promovido a máquina independiente`,
          itemId: newMachine.id,
          itemType: 'machine',
          machineId: newMachine.id,
          userId: user.id,
          companyId: component.machine!.companyId,
          metadata: {
            originalMachineId: component.machine!.id,
            originalMachineName: component.machine!.name,
            originalComponentId: componentId,
            descendantsCount: descendantIds.length,
            migratedWorkOrders,
            migratedFailures,
            migratedDocuments,
          }
        }
      });

      // 6l. Crear nota en máquina origen (si se especificó)
      if (body.keepHistoryInOrigin) {
        await tx.historyEvent.create({
          data: {
            type: 'COMPONENT_REMOVED',
            description: `Componente "${component.name}" removido y convertido en máquina independiente (ID: ${newMachine.id})`,
            itemId: component.machine!.id,
            itemType: 'machine',
            machineId: component.machine!.id,
            userId: user.id,
            companyId: component.machine!.companyId,
            metadata: {
              newMachineId: newMachine.id,
              newMachineName: newMachine.name,
              componentId,
              migratedWorkOrders,
              migratedFailures,
            }
          }
        });
      }

      return {
        newMachine,
        migratedComponents,
        migratedDocuments,
        migratedWorkOrders,
        migratedFailures,
        migratedLogs,
        historyEventId: historyEvent.id,
      };
    }, {
      timeout: 60000, // 60 segundos para operaciones grandes
    });

    // 7. Marcar operación como completada
    await prisma.promotionOperation.update({
      where: { id: body.operationId },
      data: {
        status: 'completed',
        newMachineId: result.newMachine.id,
        completedAt: new Date(),
        migratedComponents: result.migratedComponents,
        migratedDocuments: result.migratedDocuments,
        migratedWorkOrders: result.migratedWorkOrders,
        migratedFailures: result.migratedFailures,
        migratedLogs: result.migratedLogs,
      }
    });

    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error('Error al promover componente a máquina:', error);

    // Marcar operación como fallida
    await prisma.promotionOperation.update({
      where: { id: body.operationId },
      data: { status: 'failed', error: error instanceof Error ? error.message : 'Error desconocido' }
    }).catch(() => {}); // Ignorar error si ya no existe

    return NextResponse.json(
      { error: 'Error al promover componente a máquina' },
      { status: 500 }
    );
  }
}
