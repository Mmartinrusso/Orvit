---
name: orvit-prisma
description: Patrones de Prisma específicos para Orvit — schema, migraciones, multi-tenancy, soft delete, transacciones y queries optimizadas. Usar al modificar el schema, agregar modelos, crear migraciones o escribir queries complejas.
---

# Prisma — Orvit Patterns

## Reglas fundamentales

1. **Siempre filtrar por `companyId`** en queries de modelos con multi-tenancy
2. **Soft delete**: usar `deletedAt: null` en `where` — nunca borrar físicamente salvo excepciones
3. **Nunca editar `prisma/migrations/` manualmente** — siempre generar con `prisma migrate dev`
4. **Leer schema en partes** — es 32K+ tokens, usar offset/limit al leer

---

## Modelo con multi-tenancy (template)

```prisma
// prisma/schema.prisma
model Recurso {
  id          Int       @id @default(autoincrement())
  name        String
  description String?
  isActive    Boolean   @default(true)
  companyId   Int                          // multi-tenant obligatorio
  createdBy   Int?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?                    // soft delete

  company     Company   @relation(fields: [companyId], references: [id])
  creator     User?     @relation(fields: [createdBy], references: [id])

  @@index([companyId])                     // índice obligatorio
  @@index([companyId, deletedAt])          // índice compuesto para queries frecuentes
  @@index([companyId, isActive])
}
```

---

## Agregar modelo nuevo — workflow

```bash
# 1. Editar prisma/schema.prisma — agregar el modelo
# 2. Generar migración
npm run prisma:migrate
# Nombrar la migración: add_recurso_table

# 3. Regenerar cliente (si no lo hizo solo)
npm run prisma:generate

# 4. Reiniciar dev server
npm run dev
```

---

## Queries con multi-tenancy

```ts
import { prisma } from '@/lib/prisma';

// ✅ BIEN — siempre companyId + soft delete
const items = await prisma.recurso.findMany({
  where: { companyId, deletedAt: null },
  orderBy: { createdAt: 'desc' },
});

// ✅ BIEN — findFirst con companyId para seguridad
const item = await prisma.recurso.findFirst({
  where: { id, companyId, deletedAt: null },
});
if (!item) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

// ❌ MAL — sin companyId (expone datos de otras empresas)
const item = await prisma.recurso.findUnique({ where: { id } });
```

---

## Soft delete

```ts
// Eliminar (soft)
await prisma.recurso.update({
  where: { id, companyId },
  data: { deletedAt: new Date() },
});

// Restaurar
await prisma.recurso.update({
  where: { id, companyId },
  data: { deletedAt: null },
});

// Siempre incluir en where para excluir eliminados
where: { companyId, deletedAt: null }
```

---

## Transacciones

```ts
// Para operaciones múltiples que deben ser atómicas
const [updated, log] = await prisma.$transaction([
  prisma.recurso.update({
    where: { id, companyId },
    data: { isActive: false, deletedAt: new Date() },
  }),
  prisma.auditLog.create({
    data: { action: 'DELETE', resourceId: id, userId, companyId },
  }),
]);

// Transacción interactiva (para lógica condicional dentro)
await prisma.$transaction(async (tx) => {
  const item = await tx.recurso.findFirst({ where: { id, companyId } });
  if (!item) throw new Error('No encontrado');

  await tx.recurso.update({ where: { id }, data: { isActive: false } });
  await tx.stock.update({ where: { recursoId: id }, data: { quantity: 0 } });
});
```

---

## Paginación

```ts
// Con getPaginationParams de @/lib/api-utils
import { getPaginationParams } from '@/lib/api-utils';

const { skip, take, page } = getPaginationParams(req);
// default: page=1, limit=20

const [items, total] = await prisma.$transaction([
  prisma.recurso.findMany({
    where: { companyId, deletedAt: null },
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.recurso.count({
    where: { companyId, deletedAt: null },
  }),
]);

return NextResponse.json({ data: items, total, page });
```

---

## Select (proyecciones) — evitar over-fetching

```ts
// Solo traer los campos necesarios
const items = await prisma.recurso.findMany({
  where: { companyId, deletedAt: null },
  select: {
    id: true,
    name: true,
    isActive: true,
    createdAt: true,
    // ❌ no incluir campos grandes innecesarios (description, JSON, etc.)
  },
});

// Para listas: select mínimo
// Para detalle: include con relaciones
const detail = await prisma.recurso.findFirst({
  where: { id, companyId },
  include: {
    company: { select: { name: true } },
    creator: { select: { name: true, email: true } },
  },
});
```

---

## Índices — agregar al schema

```prisma
// Para queries frecuentes siempre agregar índices
@@index([companyId])
@@index([companyId, deletedAt])
@@index([companyId, isActive])
@@index([companyId, createdAt])

// Para búsquedas por campo específico
@@index([name])
@@index([companyId, name])
```

---

## Agregar columna a modelo existente

```prisma
// 1. Agregar en schema.prisma
model Recurso {
  // ...campos existentes...
  newField  String?  // nullable para no romper filas existentes
}

// 2. Si es NOT NULL, dar valor default
newField  String  @default("valor")

// 3. Migrar
npm run prisma:migrate
```

---

## Leer schema.prisma (es muy grande)

```bash
# Leer por secciones — el archivo tiene 1000+ líneas
# Buscar un modelo específico con Grep antes de leer
# Luego leer solo el rango de líneas necesario
```

---

## Anti-patterns

- ❌ `findUnique` sin `companyId` — expone datos cross-tenant
- ❌ Editar archivos en `prisma/migrations/` manualmente
- ❌ `deleteMany` sin `companyId` en where
- ❌ N+1 queries — usar `include` o `select` con relaciones anidadas
- ❌ Traer todos los campos cuando solo necesitás id+name — usar `select`
- ❌ Ausencia de índices en columnas usadas en `where` frecuente
