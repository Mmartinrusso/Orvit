---
name: orvit-permissions
description: Sistema de permisos granulares de Orvit. Usar al agregar un nuevo permiso, proteger una ruta API, ocultar UI según permisos, o crear un nuevo rol. Cubre frontend (AuthContext) y backend (permissions-helpers.ts).
---

# Permissions — Orvit Patterns

## Formato

```
{recurso}.{acción}
```

Ejemplos: `machines.edit`, `tasks.create`, `ventas.ver`, `costos.recalcular`

---

## 1. Definir el permiso nuevo

**Archivo**: `lib/permissions.ts`

```ts
// Agregar al tipo Permission
export type Permission =
  // ... permisos existentes ...
  | 'recurso.ver'
  | 'recurso.crear'
  | 'recurso.editar'
  | 'recurso.eliminar';
```

---

## 2. Crear el permiso en BD

Correr el script correspondiente en `scripts/permissions/` o ejecutar directo:

```ts
// scripts/permissions/create-recurso-permissions.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const permissions = [
    'recurso.ver',
    'recurso.crear',
    'recurso.editar',
    'recurso.eliminar',
  ];
  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`✓ ${name}`);
  }
}
main().finally(() => prisma.$disconnect());
```

---

## 3. Asignar al rol admin

```ts
// scripts/permissions/assign-recurso-permissions-to-admin.js
// Buscar el rol admin y asignarle los permisos
const adminRole = await prisma.role.findFirst({
  where: { name: { in: ['admin', 'Administrador'] }, companyId },
});
const perms = await prisma.permission.findMany({
  where: { name: { startsWith: 'recurso.' } },
});
await prisma.rolePermission.createMany({
  data: perms.map(p => ({ roleId: adminRole.id, permissionId: p.id })),
  skipDuplicates: true,
});
```

---

## 4. Verificar en el backend (API route)

```ts
// app/api/recurso/route.ts
import { checkPermission } from '@/lib/permissions-helpers';

export async function POST(req: NextRequest) {
  const { companyId, userId } = await requireAuth(req);

  // Verificar permiso ANTES de procesar
  const allowed = await checkPermission(userId, companyId, 'recurso.crear');
  if (!allowed) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  // ... lógica del endpoint
}

// Para rutas con ID dinámico
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { companyId, userId } = await requireAuth(req);
  await checkPermission(userId, companyId, 'recurso.editar'); // lanza 403 automáticamente
  // ...
}
```

---

## 5. Verificar en el frontend

```tsx
// Opción A — condicional inline (para elementos de UI)
import { useAuth } from '@/contexts/AuthContext';

const { hasPermission } = useAuth();

{hasPermission('recurso.crear') && (
  <Button onClick={() => setShowDialog(true)}>
    <Plus className="h-4 w-4 mr-2" /> Nuevo
  </Button>
)}

// Opción B — hook para múltiples permisos
const canCreate = hasPermission('recurso.crear');
const canEdit = hasPermission('recurso.editar');
const canDelete = hasPermission('recurso.eliminar');

// Opción C — deshabilitar vs ocultar
// Deshabilitar: el usuario ve el botón pero no puede usarlo (más UX-friendly)
<Button disabled={!canEdit} onClick={() => onEdit(item)}>
  Editar
</Button>

// Ocultar: el usuario no ve el botón (para acciones muy sensibles)
{canDelete && (
  <DropdownMenuItem onClick={() => onDelete(item.id)}>Eliminar</DropdownMenuItem>
)}
```

---

## 6. Proteger páginas completas

```tsx
// app/administracion/recurso/page.tsx
import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/auth-server';
import { checkPermission } from '@/lib/permissions-helpers';

export default async function RecursoPage() {
  const { userId, companyId } = await getServerAuth();
  const allowed = await checkPermission(userId, companyId, 'recurso.ver');
  if (!allowed) redirect('/unauthorized');

  return <RecursoPageClient />;
}
```

---

## Reglas importantes

1. **Verificar SIEMPRE en backend** — las verificaciones de frontend son solo UX, no seguridad
2. **El frontend oculta/deshabilita** — el backend rechaza la request (403)
3. **Usar `upsert`** al crear permisos — idempotente, se puede correr varias veces
4. **Naming convention**: `{recurso}.{acción}` en minúsculas, sin espacios, con punto
5. **Permisos atómicos**: un permiso = una acción. No `recurso.gestion` sino `recurso.ver` + `recurso.editar`

---

## Checklist para agregar un permiso nuevo

```
[ ] Agregar al tipo Permission en lib/permissions.ts
[ ] Crear script en scripts/permissions/create-[recurso]-permissions.js
[ ] Ejecutar script en BD de dev
[ ] Crear script assign-[recurso]-permissions-to-admin.js
[ ] Ejecutar assign en BD de dev
[ ] Verificar en API route con checkPermission()
[ ] Agregar hasPermission() en los componentes de frontend
[ ] Documentar en scripts/permissions/README.md si aplica
```
