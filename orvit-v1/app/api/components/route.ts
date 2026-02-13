import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const {
      name,
      type,
      system,
      technicalInfo,
      parentId,
      machineId,
      logo,
      photo,
      // Nuevo: usar spareAction en lugar de createSpare
      spareAction = 'none',    // 'none' | 'link' | 'create'
      existingSpareId,         // ID del repuesto existente (para 'link')
      initialStock = 0,        // Stock inicial por defecto
      spareMinStock = 5,       // Stock mínimo por defecto
      spareCategory = 'Repuestos', // Categoría por defecto
      spareName,               // Nombre específico del repuesto
      spareDescription,        // Descripción técnica del repuesto
      spareImage,              // Imagen del repuesto
      companyId                // ID de la empresa
    } = body;

    // Determinar si se debe crear repuesto basado en spareAction
    const shouldCreateSpare = spareAction === 'create';
    const shouldLinkSpare = spareAction === 'link' && existingSpareId;

    if (!name || !machineId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: name, machineId' }, { status: 400 });
    }

    if ((shouldCreateSpare || shouldLinkSpare) && !companyId) {
      return NextResponse.json({ error: 'ID de empresa es requerido para gestionar repuestos' }, { status: 400 });
    }

    // Tipo es opcional ahora - por defecto "component"
    const normalizedType = (type || 'component').toLowerCase();

    // ============ VALIDACIÓN DE JERARQUÍA (profundidad ilimitada) ============

    let parentInfo = null;
    let depth = 0;
    let breadcrumb: string[] = [];

    if (parentId) {
      // Verificar que el padre existe
      const parent = await prisma.component.findUnique({
        where: { id: Number(parentId) },
        select: { id: true, type: true, machineId: true, name: true }
      });

      if (!parent) {
        return NextResponse.json({
          error: `Componente padre con ID ${parentId} no encontrado`
        }, { status: 404 });
      }

      // Validar que el padre pertenece a la misma máquina
      if (parent.machineId !== Number(machineId)) {
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
      const numInitialStock = Number(initialStock) || 0;
      const numMinStock = Number(spareMinStock) || 0;

      if (numInitialStock < 0 || numMinStock < 0) {
        return NextResponse.json({
          error: 'Los valores de stock no pueden ser negativos'
        }, { status: 400 });
      }

      if (numMinStock > numInitialStock) {
        console.warn(`⚠️ Stock mínimo (${numMinStock}) mayor que stock inicial (${numInitialStock}) para "${name}"`);
      }

      if (spareName && spareName.trim().length < 2) {
        return NextResponse.json({
          error: 'El nombre del repuesto debe tener al menos 2 caracteres'
        }, { status: 400 });
      }
    }

    // Validación para vincular repuesto existente
    if (shouldLinkSpare) {
      const existingTool = await prisma.tool.findUnique({
        where: { id: Number(existingSpareId) }
      });
      if (!existingTool) {
        return NextResponse.json({
          error: `Repuesto con ID ${existingSpareId} no encontrado`
        }, { status: 404 });
      }
    }

    // ============ FIN VALIDACIONES ============
    
    // Crear el componente (nota: el modelo no tiene campo 'photo', solo 'logo')
    const component = await prisma.component.create({
      data: {
        name,
        type: normalizedType,
        system,
        technicalInfo,
        machineId: Number(machineId),
        parentId: parentId ? Number(parentId) : undefined,
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

    let createdTool = null;
    let linkedTool = null;
    let spareResult = { action: 'none' as string, tool: null as any, error: null as string | null };

    // Crear repuesto automáticamente si spareAction === 'create'
    if (shouldCreateSpare) {
      try {
        // Crear el repuesto en el pañol
        createdTool = await prisma.tool.create({
          data: {
            name: spareName || `Repuesto - ${name}`,
            description: spareDescription || `Repuesto para componente: ${name}`,
            itemType: 'SUPPLY', // Es un repuesto que se consume
            category: spareCategory,
            stockQuantity: parseInt(initialStock), // Stock inicial cargado
            minStockLevel: spareMinStock,
            status: 'AVAILABLE',
            notes: `Repuesto creado automáticamente para componente ID: ${component.id}`,
            companyId: parseInt(companyId),
            // Agregar logo si se proporciona (el modelo no tiene campo image)
            ...(spareImage && { logo: spareImage })
          }
        });

        // Vincular el componente con el repuesto usando SQL directo
        await prisma.$executeRaw`
          INSERT INTO "ComponentTool" ("componentId", "toolId", "quantityNeeded", "minStockLevel", "notes", "isOptional", "createdAt", "updatedAt")
          VALUES (${component.id}, ${createdTool.id}, 1, ${spareMinStock}, 'Vinculación automática al crear componente', false, NOW(), NOW())
        `;

        console.log(`🎉 Componente "${name}" creado con repuesto automático "${createdTool.name}"`);
        spareResult = { action: 'created', tool: createdTool, error: null };
      } catch (spareError: any) {
        console.error('❌ Error creando repuesto automático:', spareError);
        // No fallar la creación del componente si falla el repuesto
        console.warn('⚠️ Componente creado pero falló la creación del repuesto automático');
        spareResult = { action: 'create_error', tool: null, error: spareError.message };
      }
    }
    // Vincular repuesto existente si spareAction === 'link'
    else if (shouldLinkSpare) {
      try {
        // Vincular el componente con el repuesto existente
        await prisma.$executeRaw`
          INSERT INTO "ComponentTool" ("componentId", "toolId", "quantityNeeded", "minStockLevel", "notes", "isOptional", "createdAt", "updatedAt")
          VALUES (${component.id}, ${Number(existingSpareId)}, 1, ${spareMinStock}, 'Vinculación manual al crear componente', false, NOW(), NOW())
        `;

        // Obtener info del repuesto vinculado
        linkedTool = await prisma.tool.findUnique({
          where: { id: Number(existingSpareId) },
          select: { id: true, name: true, stockQuantity: true, minStockLevel: true }
        });

        console.log(`🔗 Componente "${name}" vinculado con repuesto existente "${linkedTool?.name}"`);
        spareResult = { action: 'linked', tool: linkedTool, error: null };
      } catch (linkError: any) {
        console.error('❌ Error vinculando repuesto existente:', linkError);
        console.warn('⚠️ Componente creado pero falló la vinculación con repuesto existente');
        spareResult = { action: 'link_error', tool: null, error: linkError.message };
      }
    } else {
      console.log(`🚫 No se creará ni vinculará repuesto para componente "${name}"`);
    }

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
    return NextResponse.json({ error: 'Error al crear componente' }, { status: 500 });
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