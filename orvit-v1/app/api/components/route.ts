import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateComponentSchema } from '@/lib/validations/components';

export const dynamic = 'force-dynamic';

// Helper: Obtener profundidad de un componente (cuántos niveles de ancestros tiene)
async function getComponentDepth(componentId: number): Promise<number> {
  let depth = 0;
  let currentId: number | null = componentId;

  while (currentId) {
    const component = await prisma.component.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    if (!component || !component.parentId) break;
    currentId = component.parentId;
    depth++;
    // Protección contra bucles infinitos (máximo 50 niveles)
    if (depth > 50) break;
  }
  return depth;
}

// Helper: Obtener todos los ancestros de un componente (para detectar ciclos)
async function getAncestorIds(componentId: number): Promise<number[]> {
  const ancestors: number[] = [];
  let currentId: number | null = componentId;

  while (currentId) {
    const component = await prisma.component.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    if (!component || !component.parentId) break;
    ancestors.push(component.parentId);
    currentId = component.parentId;
    // Protección contra bucles infinitos
    if (ancestors.length > 50) break;
  }
  return ancestors;
}

// Helper: Obtener ruta completa (breadcrumb) de un componente
async function getComponentBreadcrumb(componentId: number): Promise<string[]> {
  const path: string[] = [];
  let currentId: number | null = componentId;

  while (currentId) {
    const component = await prisma.component.findUnique({
      where: { id: currentId },
      select: { name: true, parentId: true }
    });
    if (!component) break;
    path.unshift(component.name);
    currentId = component.parentId;
    if (path.length > 50) break;
  }
  return path;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = validateRequest(CreateComponentSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      type,
      system,
      technicalInfo,
      parentId,
      machineId,
      logo,
      photo,
      spareAction,
      existingSpareId,
      initialStock,
      spareMinStock,
      spareCategory,
      spareName,
      spareDescription,
      spareImage,
      companyId,
    } = validation.data;

    // Determinar si se debe crear repuesto basado en spareAction
    const shouldCreateSpare = spareAction === 'create';
    const shouldLinkSpare = spareAction === 'link' && existingSpareId;

    // Tipo es opcional ahora - por defecto "component"
    const normalizedType = (type || 'component').toLowerCase();

    // ============ VALIDACIÓN DE JERARQUÍA (profundidad ilimitada) ============

    let parentInfo = null;
    let depth = 0;
    let breadcrumb: string[] = [];

    if (parentId) {
      // Verificar que el padre existe (parentId ya es number por z.coerce)
      const parent = await prisma.component.findUnique({
        where: { id: parentId },
        select: { id: true, type: true, machineId: true, name: true }
      });

      if (!parent) {
        return NextResponse.json({
          error: `Componente padre con ID ${parentId} no encontrado`
        }, { status: 404 });
      }

      // Validar que el padre pertenece a la misma máquina (machineId ya es number)
      if (parent.machineId !== machineId) {
        return NextResponse.json({
          error: 'El componente padre debe pertenecer a la misma máquina',
          hint: `El padre "${parent.name}" pertenece a otra máquina`
        }, { status: 400 });
      }

      parentInfo = parent;

      // Calcular profundidad y breadcrumb
      depth = (await getComponentDepth(parent.id)) + 1;
      breadcrumb = await getComponentBreadcrumb(parent.id);

      // Advertencia si la profundidad es muy alta (pero no bloqueamos)
      if (depth >= 10) {
        console.warn(`⚠️ Componente "${name}" tendrá profundidad ${depth + 1}. Ruta: ${breadcrumb.join(' → ')} → ${name}`);
      }
    }

    // ============ VALIDACIÓN DE STOCK ============
    if (shouldCreateSpare) {
      // initialStock y spareMinStock ya son numbers por z.coerce
      if (initialStock < 0 || spareMinStock < 0) {
        return NextResponse.json({
          error: 'Los valores de stock no pueden ser negativos'
        }, { status: 400 });
      }

      if (spareMinStock > initialStock) {
        console.warn(`⚠️ Stock mínimo (${spareMinStock}) mayor que stock inicial (${initialStock}) para "${name}"`);
      }

      if (spareName && spareName.trim().length < 2) {
        return NextResponse.json({
          error: 'El nombre del repuesto debe tener al menos 2 caracteres'
        }, { status: 400 });
      }
    }

    // Validación para vincular repuesto existente (existingSpareId ya es number)
    if (shouldLinkSpare) {
      const existingTool = await prisma.tool.findUnique({
        where: { id: existingSpareId! }
      });
      if (!existingTool) {
        return NextResponse.json({
          error: `Repuesto con ID ${existingSpareId} no encontrado`
        }, { status: 404 });
      }
    }

    // ============ FIN VALIDACIONES ============

    let createdTool = null;
    let linkedTool = null;
    let spareResult = { action: 'none' as string, tool: null as any, error: null as string | null };

    // Transacción atómica: crear componente + vincular/crear repuesto
    const component = await prisma.$transaction(async (tx) => {
      // 1. Crear el componente (nota: el modelo no tiene campo 'photo', solo 'logo')
      const comp = await tx.component.create({
        data: {
          name,
          type: normalizedType,
          system,
          technicalInfo,
          machineId,
          parentId: parentId ?? undefined,
          logo,
        },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          system: true,
          description: true,
          parentId: true,
          machineId: true,
          technicalInfo: true,
          logo: true,
          createdAt: true,
          updatedAt: true,
          parent: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          children: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          machine: {
            select: {
              id: true,
              name: true,
              brand: true,
              model: true
            }
          }
        }
      });

      // 2. Crear repuesto automáticamente si spareAction === 'create'
      if (shouldCreateSpare) {
        createdTool = await tx.tool.create({
          data: {
            name: spareName || `Repuesto - ${name}`,
            description: spareDescription || `Repuesto para componente: ${name}`,
            itemType: 'SUPPLY',
            category: spareCategory,
            stockQuantity: initialStock,
            minStockLevel: spareMinStock,
            status: 'AVAILABLE',
            notes: `Repuesto creado automáticamente para componente ID: ${comp.id}`,
            companyId: companyId!,
            ...(spareImage && { logo: spareImage })
          }
        });

        // Vincular el componente con el repuesto
        await tx.$executeRaw`
          INSERT INTO "ComponentTool" ("componentId", "toolId", "quantityNeeded", "minStockLevel", "notes", "isOptional", "createdAt", "updatedAt")
          VALUES (${comp.id}, ${createdTool.id}, 1, ${spareMinStock}, 'Vinculación automática al crear componente', false, NOW(), NOW())
        `;

        console.log(`🎉 Componente "${name}" creado con repuesto automático "${createdTool.name}"`);
        spareResult = { action: 'created', tool: createdTool, error: null };
      }
      // 3. Vincular repuesto existente si spareAction === 'link'
      else if (shouldLinkSpare) {
        await tx.$executeRaw`
          INSERT INTO "ComponentTool" ("componentId", "toolId", "quantityNeeded", "minStockLevel", "notes", "isOptional", "createdAt", "updatedAt")
          VALUES (${comp.id}, ${existingSpareId!}, 1, ${spareMinStock}, 'Vinculación manual al crear componente', false, NOW(), NOW())
        `;

        linkedTool = await tx.tool.findUnique({
          where: { id: existingSpareId! },
          select: { id: true, name: true, stockQuantity: true, minStockLevel: true }
        });

        console.log(`🔗 Componente "${name}" vinculado con repuesto existente "${linkedTool?.name}"`);
        spareResult = { action: 'linked', tool: linkedTool, error: null };
      }

      return comp;
    });

    // Incluir información del repuesto y jerarquía en la respuesta
    const response = {
      component,
      spare: spareResult,
      tool: createdTool || linkedTool,
      // Info de jerarquía para mostrar en UI
      hierarchy: {
        depth: depth,
        breadcrumb: [...breadcrumb, name],
        parentName: parentInfo?.name || null
      },
      vinculationCreated: (shouldCreateSpare && createdTool) || (shouldLinkSpare && linkedTool) ? true : false
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error al crear componente:', error);
    return NextResponse.json({ error: 'Error al crear componente', details: error }, { status: 500 });
  }
}

// GET para listar todos los componentes
export async function GET() {
  const components = await prisma.component.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      system: true,
      description: true,
      parentId: true,
      machineId: true,
      technicalInfo: true,
      logo: true,
      createdAt: true,
      updatedAt: true,
      parent: {
        select: {
          id: true,
          name: true,
          type: true
        }
      },
      children: {
        select: {
          id: true,
          name: true,
          type: true
        }
      },
      machine: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true
        }
      },
      tools: {
        include: {
          tool: true
        }
      }
    }
  });
  return NextResponse.json(components);
} 