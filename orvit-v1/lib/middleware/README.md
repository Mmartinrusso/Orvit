# withGuards - API Route Middleware

Middleware reutilizable para proteger endpoints de API con autenticacion JWT y permisos granulares.

## Uso Basico

### Solo autenticacion (sin verificacion de permisos)

```ts
import { withGuards } from '@/lib/middleware/withGuards';

export const GET = withGuards(async (request, { user }) => {
  // user.userId, user.companyId, user.role estan disponibles
  const items = await prisma.item.findMany({
    where: { companyId: user.companyId },
  });
  return NextResponse.json(items);
});
```

### Con un permiso requerido

```ts
export const POST = withGuards(async (request, { user }) => {
  const body = await request.json();
  // ...crear recurso
}, { requiredPermissions: ['work_orders.create'] });
```

### Con multiples permisos (OR - al menos uno)

```ts
export const DELETE = withGuards(async (request, { user }) => {
  // El usuario necesita work_orders.delete O work_orders.admin
}, {
  requiredPermissions: ['work_orders.delete', 'work_orders.admin'],
  permissionMode: 'any', // default
});
```

### Con multiples permisos (AND - todos requeridos)

```ts
export const PUT = withGuards(async (request, { user }) => {
  // El usuario necesita AMBOS permisos
}, {
  requiredPermissions: ['costs.edit', 'costs.view'],
  permissionMode: 'all',
});
```

### Rutas con parametros dinamicos ([id])

```ts
export const GET = withGuards(async (request, { user, params: _p }, routeContext) => {
  const { params } = routeContext!;
  const { id } = params;
  // ...usar id
}, { requiredPermissions: ['machines.view'] });
```

## Contexto del Usuario (GuardedContext)

```ts
interface GuardedUser {
  userId: number;
  companyId: number;
  role: string;
  email: string;
  name: string;
  permissions: string[]; // Solo poblado si requiredPermissions fue especificado
}

interface GuardedContext {
  user: GuardedUser;
  params?: Record<string, string>;
}
```

## Migracion desde patrones manuales

### Antes (patron manual con getUserAndCompany)

```ts
import { getUserAndCompany } from '@/lib/costs-auth';

export async function GET() {
  const auth = await getUserAndCompany();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  // ...logica
}
```

### Despues (con withGuards)

```ts
import { withGuards } from '@/lib/middleware/withGuards';

export const GET = withGuards(async (_request, { user }) => {
  // Auth ya verificada, user.companyId disponible
  // ...logica
});
```

### Antes (patron manual con JWT directo)

```ts
const token = cookies().get('token')?.value;
if (!token) return unauthorized();
const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
const user = await prisma.user.findUnique({ where: { id: payload.userId } });
if (!user) return unauthorized();
```

### Despues (con withGuards)

```ts
export const GET = withGuards(async (request, { user }) => {
  // Todo lo anterior se maneja automaticamente
});
```

## Logging de Seguridad

withGuards registra automaticamente via `loggers.auth` (Pino):

| Evento | Nivel | Datos incluidos |
|--------|-------|-----------------|
| Sin token | warn | endpoint, reason |
| Token invalido/expirado | warn | endpoint, reason |
| Usuario no encontrado | warn | endpoint, userId, reason |
| Sin empresa | warn | endpoint, userId, reason |
| Permiso denegado | warn | endpoint, userId, companyId, role, requiredPermissions, permissionMode |
| Error no controlado | error | endpoint, userId, companyId, error |

## Script de Auditoria

Ejecutar para ver el estado de seguridad de todas las rutas:

```bash
npm run audit:routes           # Reporte en consola
npm run audit:routes -- --json # Generar reporte JSON
npm run audit:routes -- --verbose # Incluir rutas OK
```

## Permisos Disponibles

Los permisos se definen en `lib/permissions.ts` como el tipo `Permission`. Ejemplos:

- `machines.view`, `machines.create`, `machines.edit`, `machines.delete`
- `work_orders.view`, `work_orders.create`, `work_orders.edit`, `work_orders.delete`
- `users.view`, `users.create`, `users.edit`, `users.delete`
- `tasks.create`, `tasks.edit`, `tasks.delete`
- Ver `lib/permissions.ts` para la lista completa.
