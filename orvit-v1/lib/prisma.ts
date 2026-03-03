import { PrismaClient } from '@prisma/client';
import { loggers } from '@/lib/logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  engineGate: Promise<void> | undefined;
  engineGateSettled: boolean;
  engineHealthy: boolean; // true cuando el último $queryRaw SELECT 1 tuvo éxito
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
    log: ['warn'],
    datasourceUrl: dbUrl,
  });
}

// Singleton real en desarrollo: reutiliza la instancia entre hot reloads
let prismaBase: PrismaClient;
if (process.env.NODE_ENV !== 'production') {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaBase();
    globalForPrisma.prisma.$connect().catch(() => {});
  }
  prismaBase = globalForPrisma.prisma;
} else {
  prismaBase = createPrismaBase();
  prismaBase.$connect().catch(() => {});
}

// Helper: detectar errores de engine desconectado
function isEngineDisconnectError(msg: string): boolean {
  return (
    msg.includes('Engine is not yet connected') ||
    msg.includes('not yet connected') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Response from the Engine was empty') ||
    msg.includes('The Engine has disconnected')
  );
}

// Gate global: bloquea TODAS las queries hasta confirmar que el engine está listo.
//
// Diferencia clave vs versión anterior: llama $disconnect()/$connect() para REINICIAR
// el engine process de Prisma, no solo polling sobre un engine muerto.
function startEngineGate(): Promise<void> {
  globalForPrisma.engineGateSettled = false;
  globalForPrisma.engineHealthy = false;

  const gate = new Promise<void>(resolve => {
    (async () => {
      // Paso 1: Forzar reinicio del engine process
      try {
        await prismaBase.$disconnect();
      } catch {
        // Ignorar — puede fallar si ya está desconectado
      }
      try {
        await prismaBase.$connect();
      } catch {
        // $connect puede fallar la primera vez, polling lo reintentará
      }

      // Paso 2: Polling hasta confirmar que el engine responde
      for (let i = 0; i < 20; i++) {
        try {
          await prismaBase.$queryRaw`SELECT 1`;
          globalForPrisma.engineHealthy = true;
          return resolve();
        } catch (e: any) {
          const msg = (e?.message ?? '') as string;
          if (!isEngineDisconnectError(msg)) {
            // Error no relacionado con conexión (ej: SQL error) — engine funciona
            globalForPrisma.engineHealthy = true;
            return resolve();
          }
          // Cada 5 intentos fallidos, forzar $connect() de nuevo
          if (i > 0 && i % 5 === 0) {
            try { await prismaBase.$connect(); } catch { /* ignore */ }
          }
          if (i < 19) await new Promise(r => setTimeout(r, 500));
        }
      }
      resolve(); // timeout 10s — no bloquear indefinidamente
    })();
  });

  gate.then(() => { globalForPrisma.engineGateSettled = true; });
  return gate;
}

// En dev: cada re-evaluación de módulo verifica si el engine sigue vivo.
// Si el gate anterior ya resolvió pero el engine murió (Full Reload), crear uno nuevo.
if (!globalForPrisma.engineGate) {
  globalForPrisma.engineGate = startEngineGate();
} else if (process.env.NODE_ENV !== 'production' && globalForPrisma.engineGateSettled) {
  // Module re-evaluated (webpack hot reload) — verificar engine health
  prismaBase.$queryRaw`SELECT 1`
    .then(() => { globalForPrisma.engineHealthy = true; })
    .catch(() => {
      // Engine muerto después de Full Reload → crear nuevo gate
      globalForPrisma.engineGate = startEngineGate();
    });
}

// Usar extensiones en lugar de middleware (Prisma 6.x+)
const shouldIndex = process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [200, 500, 1000]; // backoff exponencial

const withAutoReconnect = prismaBase.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }: any) {
        // Esperar gate actual (puede ser el inicial o uno de reconnect)
        await globalForPrisma.engineGate;

        let lastError: any;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await query(args);
          } catch (error: any) {
            lastError = error;
            const msg = (error?.message ?? '') as string;
            if (!isEngineDisconnectError(msg)) throw error; // error real, no reintentar

            // Engine desconectado — trigger reconnect si no hay gate activo
            if (globalForPrisma.engineGateSettled) {
              globalForPrisma.engineGate = startEngineGate();
            }
            await globalForPrisma.engineGate;

            // Backoff antes de reintentar (excepto en el último intento)
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] ?? 1000));
            }
          }
        }
        throw lastError;
      },
    },
  },
});

export const prisma = shouldIndex
  ? withAutoReconnect.$extends({
      query: {
        $allModels: {
          async create({ model, args, query }: any) {
            const result = await query(args);
            indexEntity(model, result);
            return result;
          },
          async update({ model, args, query }: any) {
            const result = await query(args);
            indexEntity(model, result);
            return result;
          },
        },
      },
    })
  : withAutoReconnect;
