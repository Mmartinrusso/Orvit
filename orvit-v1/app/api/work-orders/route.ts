import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triggerWorkOrderCreated } from '@/lib/automation/engine';
import { notifyOTAssigned } from '@/lib/discord/notifications';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateWorkOrderSchema } from '@/lib/validations/work-orders';

export const dynamic = 'force-dynamic';


// GET /api/work-orders?companyId=123&status=PENDING&priority=HIGH
export const GET = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const machineId = searchParams.get('machineId');
    const assignedToId = searchParams.get('assignedToId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '100')), 200);

    const where: any = {};
    if (companyId) where.companyId = Number(companyId);
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;
    if (machineId) where.machineId = Number(machineId);
    if (assignedToId) where.assignedToId = Number(assignedToId);

    const [workOrders, totalCount] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          type: true,
          machineId: true,
          componentId: true,
          assignedToId: true,
          assignedWorkerId: true,
          createdById: true,
          sectorId: true,
          companyId: true,
          scheduledDate: true,
          estimatedHours: true,
          actualHours: true,
          completedDate: true,
          cost: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              sectorId: true,
            },
          },
          component: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedWorker: {
            select: {
              id: true,
              name: true,
              phone: true,
              specialty: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sector: {
            select: {
              id: true,
              name: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              url: true,
            },
          },
          failureOccurrences: {
            select: {
              id: true,
              subcomponentId: true,
            },
          },
          _count: {
            select: {
              attachments: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.workOrder.count({ where }),
    ]);

    // ✅ Recolectar IDs de componentes que necesitan nombres
    const allComponentIds = new Set<number>();
    const allSubcomponentIds = new Set<number>();

    for (const wo of workOrders) {
      try {
        if (wo.notes) {
          const notesData = JSON.parse(wo.notes);
          const ids = notesData.affectedComponents || [];
          if (ids.length > 0 && (!notesData.componentNames || notesData.componentNames.length === 0)) {
            ids.forEach((id: number) => allComponentIds.add(id));
          }
        }
      } catch (e) {}

      // Recolectar subcomponentIds de failureOccurrences
      if (wo.failureOccurrences) {
        wo.failureOccurrences.forEach((fo: any) => {
          if (fo.subcomponentId) {
            allSubcomponentIds.add(fo.subcomponentId);
          }
        });
      }
    }

    // ✅ Buscar nombres de componentes en la base de datos (una sola query)
    let componentNamesMap: Map<number, string> = new Map();
    const allIdsToFetch = new Set([...allComponentIds, ...allSubcomponentIds]);

    if (allIdsToFetch.size > 0) {
      const components = await prisma.component.findMany({
        where: { id: { in: Array.from(allIdsToFetch) } },
        select: { id: true, name: true }
      });
      components.forEach(c => componentNamesMap.set(c.id, c.name));
    }

    // ✅ Extraer componentNames y affectedComponents del campo notes para cada WorkOrder
    const transformedWorkOrders = workOrders.map(wo => {
      let notesData: any = {};
      try {
        if (wo.notes) {
          notesData = JSON.parse(wo.notes);
        }
      } catch (e) {
        // No es JSON válido, ignorar
      }

      // Obtener nombres de componentes: primero de notes, luego de DB
      let componentNames = notesData.componentNames || [];
      const affectedComponents = notesData.affectedComponents || [];

      // Si no hay nombres pero sí hay IDs, buscar en el mapa
      if (componentNames.length === 0 && affectedComponents.length > 0) {
        componentNames = affectedComponents.map((id: number) =>
          componentNamesMap.get(id) || `Componente ${id}`
        );
      }

      // Obtener nombres de subcomponentes de failureOccurrences
      const subcomponentNames = wo.failureOccurrences
        ?.map((fo: any) => fo.subcomponentId ? componentNamesMap.get(fo.subcomponentId) : null)
        .filter(Boolean)
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) || [];

      return {
        ...wo,
        // ✅ Extraer campos del notes para que estén disponibles en el frontend
        componentNames: componentNames,
        affectedComponents: affectedComponents,
        subcomponentNames: subcomponentNames, // Nuevos nombres de subcomponentes
        failureType: notesData.failureType || null,
        relatedFailureId: notesData.relatedFailureId || null,
        isOccurrenceSolution: notesData.isOccurrenceSolution || false,
      };
    });

    return NextResponse.json({
      data: transformedWorkOrders,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error en GET /api/work-orders:', error);
    return NextResponse.json({ error: 'Error al obtener órdenes de trabajo' }, { status: 500 });
  }
}, { requiredPermissions: ['work_orders.view'], permissionMode: 'any' });

// POST /api/work-orders
export const POST = withGuards(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const validation = validateRequest(CreateWorkOrderSchema, body);
    if (!validation.success) return validation.response;

    const {
      title, description, priority, type, machineId, componentId,
      assignedToId, assignedWorkerId, createdById, scheduledDate,
      estimatedHours, cost, notes, companyId, sectorId, status,
      completedDate, actualHours,
    } = validation.data;

    // ✅ OPTIMIZADO: Usar Prisma directo en lugar de fetch interno
    let notesWithWorkerInfo = notes || '';
    if (assignedWorkerId) {
      try {
        const assignedWorker = await prisma.worker.findFirst({
          where: {
            id: Number(assignedWorkerId),
            companyId: Number(companyId)
          },
          select: { id: true, name: true, phone: true, specialty: true }
        });
        if (assignedWorker) {
          notesWithWorkerInfo += `\n\n--- OPERARIO ASIGNADO ---\nNombre: ${assignedWorker.name}`;
          if (assignedWorker.phone) notesWithWorkerInfo += `\nTeléfono: ${assignedWorker.phone}`;
          if (assignedWorker.specialty) notesWithWorkerInfo += `\nEspecialidad: ${assignedWorker.specialty}`;
          notesWithWorkerInfo += `\nID del Operario: ${assignedWorker.id}`;
        }
      } catch (error) {
        console.error('Error obteniendo info del operario:', error);
      }
    }

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        type,
        machineId: machineId ? Number(machineId) : null,
        componentId: componentId ? Number(componentId) : null,
        assignedToId: assignedToId ? Number(assignedToId) : null,
        assignedWorkerId: assignedWorkerId ? Number(assignedWorkerId) : null,
        createdById: Number(createdById),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        cost: cost ? Number(cost) : null,
        notes: notesWithWorkerInfo,
        companyId: Number(companyId),
        sectorId: sectorId ? Number(sectorId) : null,
        status: status || 'PENDING',
        completedDate: completedDate ? new Date(completedDate) : null,
        actualHours: actualHours ? Number(actualHours) : null,
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            sector: {
              select: {
                id: true,
                name: true
              },
            },
          },
        },
        component: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          },
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
            phone: true,
            specialty: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sector: {
          select: {
            id: true,
            name: true
          },
        },
      },
    });

    // ✅ OPTIMIZADO: Notificación fire-and-forget (no bloquea la respuesta)
    if (newWorkOrder.assignedToId && newWorkOrder.assignedToId !== newWorkOrder.createdById) {
      fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'work_order_assigned',
          title: '🔧 Nueva Orden de Trabajo Asignada',
          message: `Se te ha asignado la orden: "${newWorkOrder.title}"`,
          userId: newWorkOrder.assignedToId,
          workOrderId: newWorkOrder.id,
          priority: newWorkOrder.priority.toLowerCase(),
          metadata: {
            workOrderTitle: newWorkOrder.title,
            assignedBy: newWorkOrder.createdBy?.name || 'Sistema',
            machineId: newWorkOrder.machineId,
            machineName: newWorkOrder.machine?.name || 'Sin máquina',
            createdAt: newWorkOrder.createdAt
          }
        })
      }).catch(() => {}); // Fire-and-forget
    }

    // ✅ OPTIMIZADO: Discord non-blocking (fire-and-forget)
    if (newWorkOrder.assignedToId && newWorkOrder.sectorId) {
      const sendDiscordNotification = async () => {
        try {
          const assigner = await prisma.user.findUnique({
            where: { id: newWorkOrder.createdById },
            select: { name: true }
          });

          await notifyOTAssigned({
            id: newWorkOrder.id,
            title: newWorkOrder.title,
            priority: newWorkOrder.priority,
            machineName: newWorkOrder.machine?.name,
            sectorId: newWorkOrder.sectorId,
            assignedTo: newWorkOrder.assignedTo?.name || 'Sin asignar',
            assignedToId: newWorkOrder.assignedToId,
            assignedBy: assigner?.name || 'Sistema',
            scheduledDate: newWorkOrder.scheduledDate?.toLocaleDateString('es-AR') || undefined,
            description: newWorkOrder.description || undefined
          });
        } catch (discordError) {
          console.warn('⚠️ Error enviando notificación Discord (no crítico):', discordError);
        }
      };
      // Fire-and-forget: no esperamos a que termine
      sendDiscordNotification().catch(() => {});
    }

    // Procesar automatizaciones
    try {
      await triggerWorkOrderCreated(
        newWorkOrder.companyId,
        newWorkOrder as unknown as Record<string, unknown>,
        newWorkOrder.createdById
      );
    } catch (automationError) {
      console.error('Error procesando automatizaciones:', automationError);
      // No fallar la creación de la orden si fallan las automatizaciones
    }

    return NextResponse.json(newWorkOrder, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/work-orders:', error);
    return NextResponse.json(
      { error: 'Error al crear orden de trabajo', details: error },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['work_orders.create'], permissionMode: 'any' });

// DELETE /api/work-orders
export const DELETE = withGuards(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!workOrderId) {
      return NextResponse.json(
        { error: 'ID de orden de trabajo es requerido' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuario es requerido' },
        { status: 400 }
      );
    }

    // Obtener usuario y orden en paralelo
    const [requestingUser, workOrder] = await Promise.all([
      prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
          id: true,
          role: true,
          companies: {
            select: {
              company: { select: { id: true } },
              role: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.workOrder.findUnique({
        where: { id: Number(workOrderId) },
        select: {
          id: true,
          title: true,
          companyId: true,
          createdById: true,
          machine: { select: { name: true } },
        },
      }),
    ]);

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Verificar permisos: SUPERADMIN, rol de sistema ADMIN, rol de empresa "Administrador"/"Admin", creador, o permisos específicos
    const isSystemAdmin = requestingUser.role === 'ADMIN' || requestingUser.role === 'SUPERADMIN';
    const isCreator = workOrder.createdById === Number(userId);

    // Verificar si tiene rol de empresa "Administrador" o "Admin" en la empresa de la orden
    const userCompany = requestingUser.companies.find(uc => uc.company.id === workOrder.companyId);
    const companyRoleName = userCompany?.role?.name?.toLowerCase() || '';
    const isCompanyAdmin = companyRoleName === 'administrador' || companyRoleName === 'admin';

    const isAdmin = isSystemAdmin || isCompanyAdmin;

    // Si es ADMIN de sistema o de empresa (no SUPERADMIN), verificar que pertenece a la misma empresa
    if (isAdmin && requestingUser.role !== 'SUPERADMIN') {
      const userCompanyIds = requestingUser.companies.map(uc => uc.company.id);
      if (!userCompanyIds.includes(workOrder.companyId)) {
        return NextResponse.json(
          { error: 'No tienes permisos para eliminar esta orden de trabajo' },
          { status: 403 }
        );
      }
    }

    // Si no es admin ni creador, verificar permisos específicos
    if (!isAdmin && !isCreator) {
      // Verificar permisos específicos del usuario
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId: Number(userId),
          isGranted: true,
          permission: {
            name: 'work_orders.delete',
            isActive: true
          },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      // Si no tiene permiso específico, verificar permisos del rol
      if (!userPermission) {
        // Obtener el rol del usuario en la empresa de la orden
        const userOnCompany = await prisma.userOnCompany.findFirst({
          where: {
            userId: Number(userId),
            companyId: workOrder.companyId
          },
          include: {
            role: true
          }
        });

        if (userOnCompany?.role) {
          const rolePermission = await prisma.rolePermission.findFirst({
            where: {
              roleId: userOnCompany.role.id,
              isGranted: true,
              permission: {
                name: 'work_orders.delete',
                isActive: true
              }
            }
          });

          if (!rolePermission) {
            return NextResponse.json(
              { error: 'No tienes permisos para eliminar órdenes de trabajo' },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            { error: 'No tienes permisos para eliminar esta orden de trabajo' },
            { status: 403 }
          );
        }
      } else {
        // Verificar que el permiso es para la misma empresa o es global
        if (userPermission.companyId !== null && userPermission.companyId !== workOrder.companyId) {
          return NextResponse.json(
            { error: 'No tienes permisos para eliminar esta orden de trabajo' },
            { status: 403 }
          );
        }
      }
    }

    // Eliminar la orden de trabajo
    await prisma.workOrder.delete({
      where: { id: Number(workOrderId) }
    });

    // console.log(`✅ Orden de trabajo ${workOrderId} eliminada por usuario ${userId} (${user.name})`) // Log reducido;
    
    return NextResponse.json(
      { 
        message: 'Orden de trabajo eliminada exitosamente',
        deletedOrder: {
          id: workOrder.id,
          title: workOrder.title,
          machine: workOrder.machine?.name || 'Sin máquina'
        }
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en DELETE /api/work-orders:', error);
    return NextResponse.json(
      { error: 'Error al eliminar orden de trabajo', details: error },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['work_orders.delete'], permissionMode: 'any' });
