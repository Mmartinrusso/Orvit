/**
 * Script para indexar datos existentes en el asistente IA
 *
 * Uso:
 *   npx tsx scripts/index-assistant-data.ts [companyId] [entityType]
 *
 * Ejemplos:
 *   npx tsx scripts/index-assistant-data.ts 1              # Indexar todo para company 1
 *   npx tsx scripts/index-assistant-data.ts 1 work_order   # Solo OTs de company 1
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Tipos de entidades a indexar
const ENTITY_TYPES = [
  'work_order',
  'failure_occurrence',
  'failure_solution',
  'fixed_task',
  'fixed_task_execution',
  'maintenance_checklist',
  'machine',
  'component',
] as const

type EntityType = typeof ENTITY_TYPES[number]

async function main() {
  const args = process.argv.slice(2)
  const companyId = args[0] ? parseInt(args[0]) : null
  const entityType = args[1] as EntityType | undefined

  if (!companyId) {
    console.log('Uso: npx tsx scripts/index-assistant-data.ts <companyId> [entityType]')
    console.log('')
    console.log('Entity types disponibles:')
    ENTITY_TYPES.forEach(t => console.log(`  - ${t}`))
    process.exit(1)
  }

  // Verificar que la empresa existe
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    console.error(`Error: Empresa con ID ${companyId} no encontrada`)
    process.exit(1)
  }

  console.log(`\n📊 Indexando datos para: ${company.name} (ID: ${companyId})\n`)

  const typesToIndex = entityType ? [entityType] : ENTITY_TYPES

  for (const type of typesToIndex) {
    console.log(`\n🔄 Indexando ${type}...`)

    try {
      // Llamar al endpoint de indexación
      // (En producción, esto debería hacerse directamente importando las funciones)
      const count = await countEntities(type, companyId)
      console.log(`   Encontradas: ${count} entidades`)

      if (count === 0) {
        console.log(`   ⏭️  Saltando (no hay datos)`)
        continue
      }

      // Por ahora solo mostrar el conteo
      // La indexación real se hace vía API o importando directamente
      console.log(`   ✅ Listo para indexar (usar API /api/assistant/index)`)
    } catch (error) {
      console.error(`   ❌ Error: ${error}`)
    }
  }

  console.log('\n✅ Proceso completado')
  console.log('\nPara indexar, usa el endpoint POST /api/assistant/index con:')
  console.log(JSON.stringify({ entityType: 'work_order', indexAll: true }, null, 2))
}

async function countEntities(type: EntityType, companyId: number): Promise<number> {
  switch (type) {
    case 'work_order':
      return prisma.workOrder.count({ where: { companyId } })
    case 'failure_occurrence':
      return prisma.failureOccurrence.count({ where: { companyId } })
    case 'failure_solution':
      return prisma.failureSolution.count({ where: { failure: { companyId } } })
    case 'fixed_task':
      return prisma.fixedTask.count({ where: { companyId } })
    case 'fixed_task_execution':
      return prisma.fixedTaskExecution.count({ where: { fixedTask: { companyId } } })
    case 'maintenance_checklist':
      return prisma.maintenanceChecklist.count({ where: { companyId } })
    case 'machine':
      return prisma.machine.count({ where: { companyId } })
    case 'component':
      return prisma.component.count({ where: { machine: { companyId } } })
    default:
      return 0
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
