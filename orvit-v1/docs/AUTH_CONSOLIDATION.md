# Consolidación del Sistema de Autenticación y Permisos

## Resumen

El sistema de auth de Orvit fue consolidado para eliminar duplicación de código.
Anteriormente, ~86 archivos de API routes tenían su propia copia de `getUserFromToken()`,
y existían 8+ archivos de permisos legacy sin uso.

### Cambios realizados

1. **Creado `lib/auth/shared-helpers.ts`** - Módulo central con funciones reutilizables
2. **Eliminados 8 archivos legacy** que no estaban importados por ningún archivo
3. **Convertidos 6 module helpers a thin wrappers** sobre shared-helpers:
   - `tesoreria/auth.ts`, `ventas/auth.ts` (ya migrados)
   - `tasks/auth-helper.ts`, `compras/auth-helper.ts`, `payroll/auth-helper.ts`, `nominas/auth-helper.ts` (migrados en Fase 2)
4. **Creados tests unitarios** para validar el comportamiento de shared-helpers

---

## Arquitectura Actual

```
lib/
├── auth.ts                    # JWT_SECRET, verifyToken(), verifyAuth() (root-level)
├── auth/
│   ├── index.ts               # Barrel: config, tokens, blacklist, sessions, rate-limit
│   ├── shared-helpers.ts      # ★ NUEVO: funciones centralizadas de auth
│   ├── getAuthFromRequest.ts  # Auth desde NextRequest (legacy, 11 rutas lo usan)
│   ├── config.ts              # AUTH_CONFIG (tokens, 2FA, rate limits)
│   ├── tokens.ts              # Access/Refresh token management
│   ├── blacklist.ts           # Token blacklist
│   ├── sessions.ts            # Session management
│   └── rate-limit.ts          # Rate limiting
├── auth-server.ts             # Server Components auth (getUserWithPermissions)
├── admin-auth.ts              # Admin access patterns (getUserFromToken + checkAdminAccess)
├── permissions.ts             # Permission type union + ROLE_PERMISSIONS (2500+ líneas)
├── permissions-helpers.ts     # getUserPermissions, hasUserPermission (con cache Redis)
├── tesoreria/auth.ts          # ★ Thin wrapper → shared-helpers + TESORERIA_PERMISSIONS
├── ventas/auth.ts             # ★ Thin wrapper → shared-helpers + VENTAS_PERMISSIONS + audit
├── tasks/auth-helper.ts       # ★ Thin wrapper → shared-helpers + getUserCompanyId
├── compras/auth-helper.ts     # ★ Thin wrapper → shared-helpers + discriminated union
├── nominas/auth-helper.ts     # ★ Thin wrapper → shared-helpers + hasPayrollAccess
├── payroll/auth-helper.ts     # ★ Thin wrapper → shared-helpers + PayrollAuthUser
├── costs-auth.ts              # Auth helper para costos (27 rutas)
├── portal/auth.ts             # Auth para portal externo
└── assistant/auth.ts          # Auth para AI Assistant
```

---

## Funciones de shared-helpers.ts

### Obtención de usuario

| Función | Retorna | Uso |
|---------|---------|-----|
| `getUserFromToken()` | `AuthUser \| null` | Usuario liviano con `{id, name, email, role, companyId}` |
| `getUserFromTokenFull()` | `AuthUserFull \| null` | Usuario con arrays de `companies[]` y `ownedCompanies[]` |
| `getCompanyFromToken()` | `{userId, companyId, role} \| null` | Solo datos del token, sin BD (rápido) |

### Funciones require* (retornan `{user, error}`)

| Función | Verifica | Error |
|---------|----------|-------|
| `requireAuth()` | Token válido | 401 |
| `requirePermission(perm)` | Auth + permiso específico | 401/403 |
| `requireAnyPermission(perms)` | Auth + al menos 1 permiso | 401/403 |
| `requireAllPermissions(perms)` | Auth + todos los permisos | 401/403 |
| `requireRole(roles)` | Auth + rol del sistema | 401/403 |
| `requireCompanyAccess(companyId)` | Auth + acceso a empresa | 401/403 |

### Helpers utilitarios

| Función | Descripción |
|---------|-------------|
| `checkPermission(userId, companyId, perm)` | Check no-bloqueante (boolean) |
| `resolveCompanyId(user)` | owned > associated > null |
| `isAdminRole(role)` | SUPERADMIN/ADMIN/ADMIN_ENTERPRISE |
| `APPROVAL_ROLES` | Roles que pueden aprobar operaciones |
| `ALL_ROLES` | 5 roles del sistema |

---

## Guía de Migración para Desarrolladores

### Antes (patrón duplicado en cada ruta API)

```typescript
// ❌ Cada archivo tiene su propia copia
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
  // ... 20+ líneas de lógica repetida
}

export async function GET(request: NextRequest) {
  const user = await getUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // ...
}
```

### Después (importar desde shared-helpers)

```typescript
// ✅ Una línea de import
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  // user está garantizado no-null aquí
}
```

### Con verificación de permisos

```typescript
import { requirePermission } from '@/lib/auth/shared-helpers';

export async function POST() {
  const { user, error } = await requirePermission('machines.create');
  if (error) return error;
  // user tiene permiso 'machines.create'
}
```

### Con verificación de rol

```typescript
import { requireRole, APPROVAL_ROLES } from '@/lib/auth/shared-helpers';

export async function PUT() {
  const { user, error } = await requireRole(APPROVAL_ROLES);
  if (error) return error;
  // user es SUPERADMIN, ADMIN, ADMIN_ENTERPRISE o SUPERVISOR
}
```

### Para módulos con permisos propios

Si tu módulo tiene constantes de permisos (como ventas/tesoreria),
importa desde el wrapper del módulo:

```typescript
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export async function GET() {
  const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
  if (error) return error;
  // ...
}
```

---

## Archivos Eliminados (Legacy)

Estos archivos no estaban importados por ningún otro archivo del proyecto:

| Archivo | Motivo |
|---------|--------|
| `lib/permissions-frontend.ts` | Versión frontend-only de permisos, sin uso |
| `lib/permissions-optimized.ts` | Versión "optimizada" alternativa, sin uso |
| `lib/permissions-ultra-optimized.ts` | Otra versión alternativa, sin uso |
| `lib/permissions-database.ts` | Versión DB-driven alternativa, sin uso |
| `lib/permissions-db.ts` | Otra versión DB-driven, sin uso |
| `lib/permissions-centralized.ts` | Catálogo centralizado, solo se referenciaba a sí mismo |
| `lib/debug-auth.ts` | Utilidades de debug, sin uso |
| `hooks/use-permissions-optimized.tsx` | Hook que importaba permissions-optimized, sin uso |

---

## Archivos Activos Restantes (no migrados aún)

Estos módulos tienen auth helpers con patrones específicos que aún no fueron
migrados a shared-helpers. Se mantienen para retrocompatibilidad:

| Archivo | Razón para mantener |
|---------|---------------------|
| `lib/admin-auth.ts` | Patrón con `include: { companies, ownedCompanies }` y checkAdminAccess |
| `lib/auth-server.ts` | Server Components (cookies sync, sin NextRequest) |
| `lib/tasks/auth-helper.ts` | ★ Thin wrapper → shared-helpers + getUserCompanyId helpers |
| `lib/compras/auth-helper.ts` | ★ Thin wrapper → shared-helpers + discriminated union pattern |
| `lib/nominas/auth-helper.ts` | ★ Thin wrapper → shared-helpers + hasPayrollAccess |
| `lib/payroll/auth-helper.ts` | ★ Thin wrapper → shared-helpers + PayrollAuthUser format |
| `lib/costs-auth.ts` | 27 rutas de producción lo usan, raw SQL para companyId |
| `lib/portal/auth.ts` | Autenticación para portal externo |
| `lib/assistant/auth.ts` | Autenticación para AI Assistant |
| `lib/auth/getAuthFromRequest.ts` | 11 rutas lo usan, patrón con NextRequest |

### Migración futura sugerida

Para completar la consolidación, las ~390 rutas API que aún usan copias locales
de `getUserFromToken` pueden migrarse gradualmente:

1. Buscar rutas con `getUserFromToken` local: `grep -r "async function getUserFromToken" app/api/`
2. Reemplazar con `import { requireAuth } from '@/lib/auth/shared-helpers'`
3. Eliminar la función local
4. Verificar que el tipo de retorno sea compatible

---

## Tests

Los tests unitarios están en `tests/api/auth/shared-helpers.test.ts`.

```bash
npx vitest run tests/api/auth/shared-helpers.test.ts
```

Cubren: getUserFromToken, getCompanyFromToken, requireAuth, requirePermission,
requireAnyPermission, requireAllPermissions, requireRole, requireCompanyAccess,
checkPermission, resolveCompanyId, isAdminRole, y constantes.
