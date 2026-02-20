---
name: orvit-api
description: Patrones de API routes, server cache, TanStack Query v5, Prisma y validación con Zod para Orvit. Usar al crear o modificar rutas en app/api/, hooks en hooks/, o lógica de servidor.
---

# API Routes — Orvit Patterns

## Estructura de un route handler

```ts
// app/api/[recurso]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { serverCache } from '@/lib/cache/server-cache';
import { getCompanyFromRequest, requireAuth } from '@/lib/auth/server';
import { getPaginationParams, startPerf, endDb } from '@/lib/api-utils';

// GET — con cache
export async function GET(req: NextRequest) {
  try {
    const { companyId } = await requireAuth(req);
    const perf = startPerf();

    const data = await serverCache.getOrSet(
      `recurso:company:${companyId}`,
      5 * 60, // TTL en segundos
      async () => {
        return prisma.recurso.findMany({
          where: { companyId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
      }
    );

    return NextResponse.json({ data, ...endDb(perf) });
  } catch (error) {
    console.error('[GET /api/recurso]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — con validación Zod
const CreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  // ...
});

export async function POST(req: NextRequest) {
  try {
    const { companyId, userId } = await requireAuth(req);
    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.recurso.create({
      data: { ...parsed.data, companyId, createdBy: userId },
    });

    // Invalidar cache después de mutación
    serverCache.invalidate(`recurso:company:${companyId}`);

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/recurso]', error);
    return NextResponse.json({ error: 'Error al crear' }, { status: 500 });
  }
}
```

---

## Server Cache — `serverCache.getOrSet()`

```ts
import { serverCache } from '@/lib/cache/server-cache';

// Leer con cache
const data = await serverCache.getOrSet(
  `clave:${companyId}`,   // key única por company
  300,                     // TTL segundos (5 min)
  async () => { /* query pesada */ }
);

// Invalidar después de mutación
serverCache.invalidate(`clave:${companyId}`);

// Invalidar por prefijo (todas las claves que empiezan con)
serverCache.invalidateByPrefix(`mantenimiento:company:${companyId}`);
```

**TTL recomendados:**
- Dashboard / KPIs: 2-5 min
- Listas principales: 5 min
- Datos de referencia (categorías, tipos): 15-30 min
- Datos en tiempo real: 30-60 seg

---

## Prisma — Patrones

```ts
// Siempre filtrar por companyId y soft-delete
where: { companyId, deletedAt: null }

// Transacción para operaciones múltiples
const [a, b] = await prisma.$transaction([
  prisma.recurso.update({ where: { id }, data }),
  prisma.log.create({ data: { recursoId: id, action: 'update' } }),
]);

// Paginación
const { skip, take, page } = getPaginationParams(req);
const [items, total] = await prisma.$transaction([
  prisma.recurso.findMany({ where, skip, take, orderBy }),
  prisma.recurso.count({ where }),
]);
return NextResponse.json({ data: items, total, page });

// Soft delete (nunca borrar físicamente sin razón)
await prisma.recurso.update({
  where: { id, companyId },
  data: { deletedAt: new Date() },
});
```

---

## TanStack Query v5 — Hooks

```ts
// hooks/use-recurso.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/cache/query-keys';
import { STALE_TIMES } from '@/lib/cache/stale-time-config';
import { toast } from 'sonner';

export function useRecurso(companyId: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.recurso.list(companyId),
    queryFn: async () => {
      const res = await fetch(`/api/recurso?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error al cargar');
      return res.json();
    },
    staleTime: STALE_TIMES.DEFAULT, // 5 min
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateRecursoInput) => {
      const res = await fetch('/api/recurso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al crear');
      return res.json();
    },
    onMutate: () => toast.loading('Creando...', { id: 'create-recurso' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurso.list(companyId) });
      toast.success('Creado correctamente', { id: 'create-recurso' });
    },
    onError: () => toast.error('Error al crear', { id: 'create-recurso' }),
  });

  return {
    data: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
```

---

## Validación con Zod

```ts
import { z } from 'zod';

// Esquemas reutilizables
const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const IdParamSchema = z.object({
  id: z.coerce.number().positive(),
});

// Validar params de URL
const params = IdParamSchema.safeParse({ id: req.nextUrl.searchParams.get('id') });
if (!params.success) {
  return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
}

// Validar body
const body = CreateSchema.safeParse(await req.json());
if (!body.success) {
  return NextResponse.json(
    { error: 'Datos inválidos', details: body.error.flatten() },
    { status: 400 }
  );
}
```

---

## Respuestas de error estándar

```ts
// 400 — validación
{ error: 'Datos inválidos', details: zodError.flatten() }

// 401 — no autenticado
{ error: 'No autorizado' }

// 403 — sin permiso
{ error: 'Sin permisos para este recurso' }

// 404 — no encontrado
{ error: 'Recurso no encontrado' }

// 409 — conflicto
{ error: 'Ya existe un registro con ese nombre' }

// 500 — error interno (nunca exponer detalles)
{ error: 'Error interno del servidor' }
```

---

## Rutas dinámicas ([id])

```ts
// app/api/recurso/[id]/route.ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const { companyId } = await requireAuth(req);
  const item = await prisma.recurso.findFirst({
    where: { id, companyId, deletedAt: null },
  });

  if (!item) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ data: item });
}
```

---

## Multi-tenancy

- **Siempre** incluir `companyId` en `where` de queries Prisma
- Obtener `companyId` de `requireAuth(req)` — nunca del body/params del cliente
- Las rutas cron (`/api/cron/`) son la excepción — usan `Bearer` token fijo
