import { PrismaClient } from '@prisma/client';
import { loggers } from '@/lib/logger';
import { softDeleteExtension } from '@/lib/prisma-extensions/soft-delete';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Mapeo de modelos a tipos de entidad para el asistente
const INDEXABLE_MODELS: Record<string, string> = {
  workOrder: 'work_order',
  failureOccurrence: 'failure_occurrence',
  failureSolution: 'failure_solution',
  fixedTask: 'fixed_task',
  fixedTaskExecution: 'fixed_task_execution',
  maintenanceChecklist: 'maintenance_checklist',
  machine: 'machine',
  component: 'component',
};

// Función helper para indexar entidades
async function indexEntity(model: string, result: any) {
  if (!result?.id || !result?.companyId) return;

  const entityType = INDEXABLE_MODELS[model];
  if (!entityType) return;

  setImmediate(async () => {
    try {
      const { indexEntityQuick } = await import('@/lib/assistant/indexer');
      await indexEntityQuick(entityType as any, result.id, result.companyId);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        loggers.database.error({ err: error, entityType, entityId: result.id }, 'Error indexing entity');
      }
    }
  });
}

// Crear cliente base con límite de conexiones
// Supabase usa PgBouncer (puerto 6543), así que limitamos conexiones de Prisma
const connectionLimit = process.env.NODE_ENV === 'production' ? 10 : 5;
const dbUrl = process.env.DATABASE_URL?.includes('connection_limit')
  ? process.env.DATABASE_URL
  : `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}`;

const prismaBase = new PrismaClient({
  log: ['error', 'warn'],
  datasourceUrl: dbUrl,
});

// Usar extensiones en lugar de middleware (Prisma 6.x+)
const shouldIndex = process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test';

// Cliente con soft-delete + indexación (uso normal)
const withSoftDelete = prismaBase.$extends(softDeleteExtension);

export const prisma = shouldIndex
  ? withSoftDelete.$extends({
      query: {
        $allModels: {
          async create({ model, args, query }) {
            const result = await query(args);
            indexEntity(model, result);
            return result;
          },
          async update({ model, args, query }) {
            const result = await query(args);
            indexEntity(model, result);
            return result;
          },
        },
      },
    })
  : withSoftDelete;

// Cliente SIN filtro de soft-delete: para operaciones admin (restaurar, purgar, listar eliminados)
export const prismaUnfiltered = prismaBase;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaBase;
}