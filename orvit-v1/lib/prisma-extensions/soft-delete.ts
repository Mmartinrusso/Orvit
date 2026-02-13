import { Prisma } from '@prisma/client';

// Modelos que implementan soft delete
const SOFT_DELETE_MODELS = ['WorkOrder', 'Task', 'FixedTask', 'MaintenanceChecklist'];

function isSoftDeleteModel(model: string): boolean {
  return SOFT_DELETE_MODELS.includes(model);
}

// Inyecta { deletedAt: null } en el where de las queries de lectura
function injectDeletedAtFilter(args: any) {
  if (!args) args = {};
  if (!args.where) args.where = {};

  // Si ya se está filtrando explícitamente por deletedAt, no interferir
  if (args.where.deletedAt !== undefined) return args;

  args.where.deletedAt = null;
  return args;
}

/**
 * Extensión de Prisma para Soft Delete.
 *
 * Intercepta automáticamente las operaciones de lectura (findMany, findFirst,
 * findUnique, count, aggregate, groupBy) para filtrar registros con deletedAt != null
 * en los modelos: WorkOrder, Task, FixedTask, MaintenanceChecklist.
 *
 * Para ver registros eliminados, usar `prismaUnfiltered` directamente.
 */
export const softDeleteExtension = Prisma.defineExtension({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          args = injectDeletedAtFilter(args);
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          args = injectDeletedAtFilter(args);
        }
        return query(args);
      },
      async findUnique({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          // findUnique solo acepta campos @id/@unique en where.
          // No podemos inyectar deletedAt directamente, así que ejecutamos
          // la query normal y verificamos deletedAt en el resultado.
          const result = await query(args);
          if (result && (result as any).deletedAt != null) {
            // Si el caller pidió explícitamente registros eliminados, no filtrar
            if ((args as any)?.where?.deletedAt !== undefined) {
              return result;
            }
            return null;
          }
          return result;
        }
        return query(args);
      },
      async count({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          args = injectDeletedAtFilter(args);
        }
        return query(args);
      },
      async aggregate({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          args = injectDeletedAtFilter(args);
        }
        return query(args);
      },
      async groupBy({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          args = injectDeletedAtFilter(args);
        }
        return query(args);
      },
    },
  },
});
