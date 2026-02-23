import { PrismaClient } from '@prisma/client';
import { loggers } from '@/lib/logger';

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
// En dev: 1 conexión (hot reload crea múltiples módulos, el singleton evita acumulación)
// En prod: 10 conexiones vía pgbouncer
const connectionLimit = process.env.NODE_ENV === 'production' ? 10 : 1;
const dbUrl = process.env.DATABASE_URL?.includes('connection_limit')
  ? process.env.DATABASE_URL
  : `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}`;

function createPrismaBase() {
  return new PrismaClient({
    log: ['error', 'warn'],
    datasourceUrl: dbUrl,
  });
}

// Singleton real en desarrollo: reutiliza la instancia entre hot reloads
let prismaBase: PrismaClient;
if (process.env.NODE_ENV !== 'production') {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaBase();
  }
  prismaBase = globalForPrisma.prisma;
} else {
  prismaBase = createPrismaBase();
}

// Usar extensiones en lugar de middleware (Prisma 6.x+)
const shouldIndex = process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test';

export const prisma = shouldIndex
  ? prismaBase.$extends({
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
  : prismaBase;

