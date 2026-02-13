// ============================================
// API para indexar datos en el asistente
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAssistantContext } from '@/lib/assistant/auth'
import { indexEntity, indexAllEntitiesOfType, deleteEntityEmbedding } from '@/lib/assistant/indexer'
import { IndexableEntityType } from '@/lib/assistant/types'

export const dynamic = 'force-dynamic'

// Tipos de entidades válidos
const VALID_ENTITY_TYPES: IndexableEntityType[] = [
  'work_order',
  'failure_occurrence',
  'failure_solution',
  'solution_application',
  'fixed_task',
  'fixed_task_execution',
  'maintenance_checklist',
  'checklist_execution',
  'machine',
  'component',
  'work_log',
]

/**
 * POST /api/assistant/index
 * Indexa una entidad específica o todas las de un tipo
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación (solo admins)
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // TODO: Verificar que es admin
    // if (context.userRole !== 'manager' && context.userRole !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Solo administradores pueden indexar' },
    //     { status: 403 }
    //   )
    // }

    // 2. Parsear request
    const body = await request.json()
    const { entityType, entityId, indexAll } = body

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json(
        { error: `Tipo de entidad inválido. Válidos: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // 3. Indexar
    if (indexAll) {
      // Indexar todas las entidades de un tipo
      const result = await indexAllEntitiesOfType(
        entityType as IndexableEntityType,
        context.companyId,
        {
          batchSize: 50,
          onProgress: (processed, total) => {
            console.log(`Indexando ${entityType}: ${processed}/${total}`)
          },
        }
      )

      return NextResponse.json({
        success: true,
        message: `Indexación completada para ${entityType}`,
        processed: result.processed,
        errors: result.errors,
      })
    } else if (entityId) {
      // Indexar una entidad específica
      await indexEntity(
        entityType as IndexableEntityType,
        entityId,
        context.companyId
      )

      return NextResponse.json({
        success: true,
        message: `Entidad ${entityType}/${entityId} indexada correctamente`,
      })
    } else {
      return NextResponse.json(
        { error: 'Se requiere entityId o indexAll=true' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error indexando:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/assistant/index/status
 * Obtiene el estado de indexación
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Contar embeddings por tipo
    const counts = await prisma.assistantEmbedding.groupBy({
      by: ['entityType'],
      where: { companyId: context.companyId },
      _count: { id: true },
    })

    // Contar entidades totales por tipo (para comparar)
    const entityCounts: Record<string, { indexed: number; total: number }> = {}

    for (const entityType of VALID_ENTITY_TYPES) {
      const indexed = counts.find(c => c.entityType === entityType)?._count.id || 0

      // Contar total en la tabla original
      let total = 0
      try {
        const tableName = getTableName(entityType)
        const model = (prisma as any)[tableName]
        if (model) {
          total = await model.count({ where: { companyId: context.companyId } })
        }
      } catch {
        // Algunas tablas pueden no tener companyId directo
      }

      entityCounts[entityType] = { indexed, total }
    }

    return NextResponse.json({
      companyId: context.companyId,
      status: entityCounts,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error obteniendo estado:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/assistant/index
 * Elimina embeddings
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = await getAssistantContext()
    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (entityType && entityId) {
      // Eliminar un embedding específico
      await deleteEntityEmbedding(
        entityType as IndexableEntityType,
        parseInt(entityId)
      )

      return NextResponse.json({
        success: true,
        message: `Embedding ${entityType}/${entityId} eliminado`,
      })
    } else if (entityType) {
      // Eliminar todos los embeddings de un tipo
      const result = await prisma.assistantEmbedding.deleteMany({
        where: {
          companyId: context.companyId,
          entityType,
        },
      })

      return NextResponse.json({
        success: true,
        message: `${result.count} embeddings eliminados para ${entityType}`,
      })
    } else {
      return NextResponse.json(
        { error: 'Se requiere entityType' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error eliminando embeddings:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Helper para obtener nombre de tabla
function getTableName(entityType: IndexableEntityType): string {
  const mapping: Record<IndexableEntityType, string> = {
    work_order: 'workOrder',
    failure_occurrence: 'failureOccurrence',
    failure_solution: 'failureSolution',
    solution_application: 'solutionApplication',
    fixed_task: 'fixedTask',
    fixed_task_execution: 'fixedTaskExecution',
    maintenance_checklist: 'maintenanceChecklist',
    checklist_execution: 'checklistExecution',
    machine: 'machine',
    component: 'component',
    work_log: 'workLog',
  }
  return mapping[entityType]
}
