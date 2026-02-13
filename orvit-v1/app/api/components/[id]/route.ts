import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deleteEntityFiles, deleteMultipleEntityFiles, deleteS3File } from '@/lib/s3-utils';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateComponentSchema } from '@/lib/validations/components';

// ============================================
// OPTIMIZED HELPERS using Recursive CTEs
// These execute a SINGLE query instead of N+1
// ============================================

// Helper: Obtener todos los descendientes de un componente usando CTE recursivo
// ANTES: N queries (uno por nivel de jerarquía)
// AHORA: 1 query
async function getAllDescendantIds(componentId: number): Promise<number[]> {
  const result = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Component" WHERE "parentId" = ${componentId}
      UNION ALL
      SELECT c.id FROM "Component" c
      INNER JOIN descendants d ON c."parentId" = d.id
    )
    SELECT id FROM descendants LIMIT 1000
  `;
  return result.map(r => r.id);
}

// Helper: Obtener ruta completa (breadcrumb) usando CTE recursivo
// ANTES: N queries (uno por ancestro)
// AHORA: 1 query
async function getComponentBreadcrumb(componentId: number): Promise<string[]> {
  const result = await prisma.$queryRaw<{ name: string; depth: number }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, "parentId", 0 as depth
      FROM "Component"
      WHERE id = ${componentId}
      UNION ALL
      SELECT c.id, c.name, c."parentId", a.depth + 1
      FROM "Component" c
      INNER JOIN ancestors a ON c.id = a."parentId"
      WHERE a.depth < 50
    )
    SELECT name, depth FROM ancestors ORDER BY depth DESC
  `;
  return result.map(r => r.name);
}

// Helper: Obtener profundidad de un componente usando CTE recursivo
// ANTES: N queries (uno por ancestro)
// AHORA: 1 query
async function getComponentDepth(componentId: number): Promise<number> {
  const result = await prisma.$queryRaw<{ depth: bigint }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, "parentId", 0 as depth
      FROM "Component"
      WHERE id = ${componentId}
      UNION ALL
      SELECT c.id, c."parentId", a.depth + 1
      FROM "Component" c
      INNER JOIN ancestors a ON c.id = a."parentId"
      WHERE a.depth < 50
    )
    SELECT MAX(depth) as depth FROM ancestors
  `;
  return Number(result[0]?.depth || 0);
}

// Helper: Obtener todos los hijos con su jerarquía en UNA sola query
// ANTES: N queries por nivel de profundidad
// AHORA: 1 query que trae toda la jerarquía
async function getAllChildrenFlat(parentId: number): Promise<{
  id: number;
  name: string;
  code: string | null;
  type: string | null;
  description: string | null;
  parentId: number | null;
  machineId: number;
  technicalInfo: string | null;
  logo: string | null;
  system: string | null;
  depth: number;
  path: string;
}[]> {
  const result = await prisma.$queryRaw<any[]>`
    WITH RECURSIVE component_tree AS (
      SELECT
        id, name, code, type, description, "parentId", "machineId",
        "technicalInfo", logo, system, "createdAt", "updatedAt",
        1 as depth,
        CAST(id AS TEXT) as path
      FROM "Component"
      WHERE "parentId" = ${parentId}

      UNION ALL

      SELECT
        c.id, c.name, c.code, c.type, c.description, c."parentId", c."machineId",
        c."technicalInfo", c.logo, c.system, c."createdAt", c."updatedAt",
        ct.depth + 1,
        ct.path || '/' || CAST(c.id AS TEXT)
      FROM "Component" c
      INNER JOIN component_tree ct ON c."parentId" = ct.id
      WHERE ct.depth < 20
    )
    SELECT * FROM component_tree ORDER BY path
  `;
  return result;
}

// GET: Detalle de un componente (incluye hijos, breadcrumb, depth y repuestos)
// OPTIMIZADO: Usa CTEs y queries paralelas en vez de N+1
export async function GET(request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const componentId = Number(id);

  // Ejecutar queries en paralelo para máximo performance
  const [component, breadcrumb, allChildrenFlat] = await Promise.all([
    // Query 1: Componente principal con machine y tools
    prisma.component.findUnique({
      where: { id: componentId },
      include: {
        machine: {
          select: { id: true, name: true, type: true } // Solo campos necesarios
        },
        tools: {
          include: {
            tool: {
              select: { id: true, name: true, code: true, itemType: true, stockQuantity: true, status: true }
            }
          }
        }
      }
    }),
    // Query 2: Breadcrumb con CTE (1 query)
    getComponentBreadcrumb(componentId),
    // Query 3: Todos los hijos en una sola query con CTE
    getAllChildrenFlat(componentId)
  ]);

  if (!component) {
    return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
  }

  // Calcular depth del breadcrumb (ya lo tenemos, es length - 1)
  const depth = breadcrumb.length - 1;

  // Si hay hijos, obtener sus tools en UNA sola query
  let toolsByComponent: Record<number, any[]> = {};
  if (allChildrenFlat.length > 0) {
    const childIds = allChildrenFlat.map(c => c.id);
    const allTools = await prisma.componentTool.findMany({
      where: { componentId: { in: childIds } },
      include: {
        tool: {
          select: { id: true, name: true, code: true, itemType: true, stockQuantity: true, status: true }
        }
      }
    });

    // Agrupar tools por componentId para acceso O(1)
    toolsByComponent = allTools.reduce((acc, ct) => {
      if (!acc[ct.componentId]) acc[ct.componentId] = [];
      acc[ct.componentId].push(ct);
      return acc;
    }, {} as Record<number, any[]>);
  }

  // Construir árbol de hijos en memoria (O(n) en vez de O(n²))
  function buildTree(flatChildren: any[], parentBreadcrumb: string[], parentDepth: number): any[] {
    // Crear mapa de hijos por parentId para acceso O(1)
    const childrenByParent = new Map<number, any[]>();
    for (const child of flatChildren) {
      const pid = child.parentId;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(child);
    }

    // Función recursiva que usa el mapa (sin queries adicionales)
    function buildNode(parentId: number, currentBreadcrumb: string[], currentDepth: number): any[] {
      const children = childrenByParent.get(parentId) || [];
      return children.map(child => {
        const childBreadcrumb = [...currentBreadcrumb, child.name];
        return {
          ...child,
          breadcrumb: childBreadcrumb,
          depth: currentDepth + 1,
          tools: toolsByComponent[child.id] || [],
          children: buildNode(child.id, childBreadcrumb, currentDepth + 1)
        };
      });
    }

    return buildNode(componentId, parentBreadcrumb, parentDepth);
  }

  const children = buildTree(allChildrenFlat, breadcrumb, depth);

  const result = {
    ...component,
    breadcrumb,
    depth,
    machineName: component.machine?.name,
    children
  };

  return NextResponse.json(result);
}

// PUT: Editar un componente (alias de PATCH para compatibilidad)
export async function PUT(request: Request, context: { params: { id: string } }) {
  return PATCH(request, context);
}

// PATCH: Editar un componente
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  
  try {
    console.log(`🔄 Iniciando actualización de componente ${id}`);
    const body = await request.json();
    console.log(`🔄 Body recibido:`, body);
    console.log(`🔄 Tipo de ID:`, typeof id, 'Valor:', id);

    const validation = validateRequest(UpdateComponentSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    // Extraer datos de repuesto y campos problemáticos del body
    const {
      spareAction,
      existingSpareId,
      initialStock = 0,
      spareMinStock = 5,
      spareCategory = 'Repuestos',
      companyId,
      machineId,    // Separar machineId que requiere sintaxis especial
      photo,        // Campo que no existe en Component model
      status,       // Campo que no existe en Component model
      ...componentData
    } = validation.data;

    // Obtener el componente actual para verificar si el logo cambió
    const currentComponent = await prisma.component.findUnique({
      where: { id: Number(id) },
      select: { logo: true, machineId: true }
    });

    if (!currentComponent) {
      return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
    }

    // ============ VALIDACIÓN DE CAMBIO DE PADRE ============
    if (componentData.parentId !== undefined) {
      // parentId viene de UpdateComponentSchema: z.coerce.number | null | ''
      const newParentId = componentData.parentId === null || componentData.parentId === ''
        ? null
        : componentData.parentId as number;

      // Si se está asignando un nuevo padre
      if (newParentId !== null) {
        // Verificar que el nuevo padre existe
        const newParent = await prisma.component.findUnique({
          where: { id: newParentId },
          select: { id: true, name: true, machineId: true }
        });

        if (!newParent) {
          return NextResponse.json({
            error: `Componente padre con ID ${newParentId} no encontrado`
          }, { status: 404 });
        }

        // Validar que el nuevo padre pertenece a la misma máquina
        if (newParent.machineId !== currentComponent.machineId) {
          return NextResponse.json({
            error: 'El componente padre debe pertenecer a la misma máquina',
            hint: `El padre "${newParent.name}" pertenece a otra máquina`
          }, { status: 400 });
        }

        // Validar que no se cree una referencia circular
        // (el nuevo padre no puede ser el componente mismo ni ninguno de sus descendientes)
        if (newParentId === Number(id)) {
          return NextResponse.json({
            error: 'Un componente no puede ser su propio padre',
            hint: 'Referencia circular detectada'
          }, { status: 400 });
        }

        const descendants = await getAllDescendantIds(Number(id));
        if (descendants.includes(newParentId)) {
          const breadcrumb = await getComponentBreadcrumb(newParentId);
          return NextResponse.json({
            error: 'No se puede mover un componente debajo de uno de sus propios hijos',
            hint: `"${newParent.name}" es descendiente de este componente. Ruta: ${breadcrumb.join(' → ')}`,
            circularReference: true
          }, { status: 400 });
        }
      }
    }
    // ============ FIN VALIDACIÓN DE CAMBIO DE PADRE ============

    // Preparar datos para actualización con sintaxis correcta de Prisma
    // Solo incluir campos que existen en el modelo Component
    const validFields = ['name', 'code', 'type', 'system', 'description', 'technicalInfo', 'logo', 'parentId', 'model3dUrl'];
    const updateData: any = {};

    // Filtrar solo los campos válidos
    Object.keys(componentData).forEach(key => {
      if (validFields.includes(key)) {
        if (key === 'parentId') {
          // Manejar parentId: puede ser null para quitar el padre, o un número (ya coerced por Zod)
          updateData.parentId = componentData[key] === null || componentData[key] === '' ? null : componentData[key];
        } else {
          updateData[key] = componentData[key];
        }
      } else {
        console.log(`⚠️ Campo ignorado (no existe en modelo Component): ${key}`);
      }
    });
    
    console.log('🔄 Campos válidos para actualización:', updateData);

    // Solo actualizar machine si machineId cambió (ya es number por z.coerce)
    if (machineId && machineId !== currentComponent.machineId) {
      updateData.machine = {
        connect: { id: machineId }
      };
    }

    console.log('🔄 Datos preparados para Prisma update:', updateData);
    console.log('🔄 ID a actualizar:', Number(id));

    // Actualizar el componente (solo datos válidos para Prisma)
    let updated;
    try {
      updated = await prisma.component.update({
        where: { id: Number(id) },
        data: updateData,
      });
      console.log('✅ Componente actualizado en Prisma:', updated);
    } catch (prismaError: any) {
      console.error('❌ Error de Prisma al actualizar:', prismaError);
      console.error('❌ Código de error:', prismaError.code);
      console.error('❌ Mensaje de error:', prismaError.message);
      throw prismaError;
    }

    // Eliminar logo anterior de S3 si se eliminó o reemplazó
    if (currentComponent.logo && body.logo !== undefined) {
      const isDeleting = body.logo === null || body.logo === '';
      const isReplacing = !isDeleting && body.logo !== currentComponent.logo;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(currentComponent.logo);
          console.log(`✅ Logo anterior eliminado de S3: ${currentComponent.logo}`);
        } catch (error) {
          console.error('⚠️ Error eliminando logo anterior de componente de S3:', error);
          // No fallar la operación si falla la eliminación de S3
        }
      }
    }

    let spareResult = null;

    // Procesar lógica de repuestos
    if (spareAction && companyId) {
      console.log(`🔧 [API] Procesando spareAction: ${spareAction}`);
      console.log(`🔧 [API] existingSpareId: ${existingSpareId}`);
      console.log(`🔧 [API] companyId: ${companyId}`);

      if (spareAction === 'create') {
        // Crear nuevo repuesto automáticamente
        try {
          console.log(`➕ Creando nuevo repuesto para componente "${updated.name}"`);
          
          const createdTool = await prisma.tool.create({
            data: {
              name: `Repuesto - ${updated.name}`,
              description: `Repuesto para componente: ${updated.name}`,
              itemType: 'SUPPLY',
              category: spareCategory,
              stockQuantity: initialStock, // Ya es number por z.coerce
              minStockLevel: spareMinStock,
              status: 'AVAILABLE',
              notes: `Repuesto creado automáticamente para componente ID: ${updated.id}`,
              companyId: companyId! // Ya es number por z.coerce
            }
          });
          // console.log(`✅ Repuesto creado: ID=${createdTool.id}, Nombre="${createdTool.name}"`) // Log reducido;

          // Vincular el componente con el repuesto
          // console.log(`🔗 Vinculando componente ${updated.id} con repuesto ${createdTool.id}`) // Log reducido;
          await prisma.$executeRaw`
            INSERT INTO "ComponentTool" ("componentId", "toolId", "quantityNeeded", "minStockLevel", "notes", "isOptional", "createdAt", "updatedAt")
            VALUES (${updated.id}, ${createdTool.id}, 1, ${spareMinStock}, 'Vinculación automática al actualizar componente', false, NOW(), NOW())
            ON CONFLICT ("componentId", "toolId") DO NOTHING
          `;
          // console.log(`✅ Vinculación ComponentTool creada exitosamente`) // Log reducido;

          spareResult = { action: 'created', tool: createdTool };

        } catch (spareError: any) {
          console.error('❌ Error creando repuesto automático:', spareError);
          spareResult = { action: 'create_error', error: spareError.message };
        }

      } else if (spareAction === 'link' && existingSpareId) {
        // Vincular con repuesto existente
        try {
          // console.log(`🔗 Vinculando componente ${updated.id} con repuesto existente ${existingSpareId}`) // Log reducido;
          
          await prisma.$executeRaw`
            INSERT INTO "ComponentTool" ("componentId", "toolId", "quantityNeeded", "minStockLevel", "notes", "isOptional", "createdAt", "updatedAt")
            VALUES (${updated.id}, ${existingSpareId}, 1, ${spareMinStock}, 'Vinculación manual al actualizar componente', false, NOW(), NOW())
            ON CONFLICT ("componentId", "toolId") DO UPDATE SET
              "minStockLevel" = ${spareMinStock},
              "updatedAt" = NOW()
          `;
          // console.log(`✅ Vinculación con repuesto existente creada exitosamente`) // Log reducido;

          spareResult = { action: 'linked', spareId: existingSpareId };

        } catch (linkError: any) {
          console.error('❌ Error vinculando repuesto existente:', linkError);
          spareResult = { action: 'link_error', error: linkError.message };
        }

      } else if (spareAction === 'none') {
        // Eliminar vinculaciones existentes
        try {
          console.log(`🚫 Eliminando vinculaciones existentes del componente ${updated.id}`);
          
          await prisma.componentTool.deleteMany({
            where: { componentId: updated.id }
          });
          
          console.log(`✅ Vinculaciones eliminadas exitosamente`);
          spareResult = { action: 'unlinked' };
        } catch (unlinkError: any) {
          console.error('❌ Error eliminando vinculaciones:', unlinkError);
          spareResult = { action: 'unlink_error', error: unlinkError.message };
        }
      }
    }

    // Obtener el componente actualizado con la información de tools
    const updatedComponentWithTools = await prisma.component.findUnique({
      where: { id: Number(id) },
      include: {
        tools: {
          include: {
            tool: true,
          },
        },
      },
    });

    console.log(`🔍 [API] Componente actualizado con tools:`, JSON.stringify(updatedComponentWithTools, null, 2));

    const response = {
      component: updatedComponentWithTools,
      spare: spareResult
    };

    console.log(`🎉 Componente ${id} actualizado exitosamente`);
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error al actualizar componente:', error);
    return NextResponse.json({ error: 'Error al actualizar componente', details: error }, { status: 500 });
  }
}

// DELETE: Eliminar un componente y sus hijos recursivamente
// OPTIMIZADO: Usa CTE para obtener descendientes en 1 query
export async function DELETE(request: Request, context: { params: { id: string } }) {
  const { id } = context.params;
  const componentId = Number(id);

  try {
    // OPTIMIZADO: Usar CTE recursivo (1 query en vez de N)
    const descendantIds = await getAllDescendantIds(componentId);
    const allComponentIds = [componentId, ...descendantIds];

    console.log(`Eliminando componente ${id} con ${descendantIds.length} subcomponentes`);

    // ANTES de eliminar, verificar repuestos que solo están vinculados a estos componentes
    // OPTIMIZADO: Una sola query con groupBy en vez de N queries

    // Query 1: Obtener todos los toolIds vinculados a componentes que se eliminan
    const componentTools = await prisma.componentTool.findMany({
      where: { componentId: { in: allComponentIds } },
      select: { toolId: true }
    });

    const toolIdsToCheck = Array.from(new Set(componentTools.map(ct => ct.toolId)));

    // OPTIMIZADO: Una query para obtener conteo total de cada tool
    // y comparar con los que se van a eliminar
    let toolsToDelete: number[] = [];

    if (toolIdsToCheck.length > 0) {
      // Query con subquery para encontrar tools que SOLO están vinculados a componentes a eliminar
      const toolsOnlyLinkedToDeleted = await prisma.$queryRaw<{ toolId: number }[]>`
        SELECT ct."toolId"
        FROM "ComponentTool" ct
        WHERE ct."toolId" = ANY(${toolIdsToCheck})
        GROUP BY ct."toolId"
        HAVING COUNT(*) = COUNT(CASE WHEN ct."componentId" = ANY(${allComponentIds}) THEN 1 END)
      `;

      toolsToDelete = toolsOnlyLinkedToDeleted.map(t => t.toolId);
      console.log(`🗑️ ${toolsToDelete.length} tools marcados para eliminar (solo vinculados a componentes a eliminar)`);
    }
    
    // Eliminar los tools que solo estaban vinculados a los componentes que se van a eliminar
    if (toolsToDelete.length > 0) {
      console.log(`🗑️ Eliminando ${toolsToDelete.length} tools que solo estaban vinculados a componentes a eliminar:`, toolsToDelete);
      
      await prisma.tool.deleteMany({
        where: {
          id: { in: toolsToDelete }
        }
      });
      
      console.log(`✅ Tools eliminados exitosamente`);
    } else {
      console.log(`✅ No hay tools para eliminar`);
    }

    // Preparar entidades para eliminar archivos de S3
    const entitiesToDelete = allComponentIds.map(componentId => ({ 
      type: 'component', 
      id: componentId.toString() 
    }));

    // Eliminar archivos de S3 en paralelo con la eliminación de la base de datos
    const [dbResult, s3Result] = await Promise.allSettled([
      // Eliminar de la base de datos (cascada automática eliminará los hijos)
      prisma.component.delete({ where: { id: Number(id) } }),
      // Eliminar archivos de S3
      deleteMultipleEntityFiles(entitiesToDelete)
    ]);

    if (dbResult.status === 'rejected') {
      console.error('Error eliminando componente de la base de datos:', dbResult.reason);
      return NextResponse.json({ 
        error: 'Error al eliminar componente de la base de datos', 
        details: dbResult.reason 
      }, { status: 500 });
    }

    if (s3Result.status === 'rejected') {
      console.error('Error eliminando archivos de S3:', s3Result.reason);
      // No fallar la operación por errores de S3, solo logear
    }

    console.log(`Componente ${id} eliminado exitosamente`);
    return NextResponse.json({ 
      success: true, 
      toolsDeleted: toolsToDelete.length,
      message: toolsToDelete.length > 0 
        ? `Componente eliminado. ${toolsToDelete.length} repuesto${toolsToDelete.length > 1 ? 's' : ''} eliminado${toolsToDelete.length > 1 ? 's' : ''} automáticamente.`
        : 'Componente eliminado correctamente.'
    });
    
  } catch (error) {
    console.error('Error eliminando componente:', error);
    return NextResponse.json({ 
      error: 'Error al eliminar componente', 
      details: error 
    }, { status: 500 });
  }
}