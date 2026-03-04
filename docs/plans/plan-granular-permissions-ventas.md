# Plan: Validación de Permisos Granulares en Endpoints de Ventas

## Análisis del Estado Actual

Después de auditar exhaustivamente **todos los endpoints** en `app/api/ventas/` (100+ archivos de ruta), el hallazgo principal es:

**TODOS los endpoints ya tienen verificación de permisos granulares implementada.**

### Lo que ya existe y funciona:

1. **`lib/ventas/auth.ts`** - Ya contiene:
   - `requirePermission(permission)` → verifica auth + permiso específico, retorna 403 si falla
   - `requireAnyPermission(permissions[])` → verifica auth + cualquiera de los permisos
   - `checkPermission(userId, companyId, permission)` → verificación no-bloqueante
   - `VENTAS_PERMISSIONS` → constantes tipadas con **47 permisos** granulares

2. **`lib/permissions-helpers.ts`** - Ya contiene:
   - `hasUserPermission(userId, companyId, permission)` → verifica en BD
   - `getUserPermissions(userId, userRole, companyId)` → obtiene todos los permisos
   - Cache de 5min para permisos de ADMIN

3. **`lib/permissions.ts`** - Ya define el tipo `Permission` con todos los permisos granulares de ventas (`ventas.cotizaciones.create`, `ventas.ordenes.edit`, etc.)

4. **Todos los endpoints usan `requirePermission()`** con el permiso correcto:
   - `POST /api/ventas/cotizaciones` → `VENTAS_PERMISSIONS.COTIZACIONES_CREATE`
   - `PUT /api/ventas/cotizaciones/[id]` → `VENTAS_PERMISSIONS.COTIZACIONES_EDIT`
   - `DELETE /api/ventas/cotizaciones/[id]` → `VENTAS_PERMISSIONS.COTIZACIONES_DELETE`
   - (y así para ordenes, facturas, pagos, entregas, clientes, listas-precios, productos, turnos, reportes, config, etc.)

5. **Sistema de auditoría** en `lib/ventas/audit-helper.ts` ya registra CREATE, UPDATE, DELETE, STATUS_CHANGE, etc.

---

## Lo que FALTA (el trabajo real a implementar)

### 1. Registro de intentos de acceso denegado en auditoría

Actualmente, cuando `requirePermission()` falla, retorna un 403 genérico **sin registrar nada en auditoría**. Esto es una brecha de seguridad observacional.

**Implementación:**

#### Paso 1: Agregar acción `ACCESS_DENIED` al sistema de auditoría

**Archivo:** `project/lib/ventas/audit-config.ts`
- Agregar `'ACCESS_DENIED'` al type `SalesAuditAction`
- Agregar config visual en `SALES_ACCION_CONFIG`

#### Paso 2: Crear helper `logAccessDenied()` en audit-helper

**Archivo:** `project/lib/ventas/audit-helper.ts`
- Nueva función `logAccessDenied({ userId, companyId, permission, endpoint, method })`
- Registra en `SalesAuditLog` con entidad genérica (ej. `'access_control'` o re-usar la más cercana)

#### Paso 3: Integrar logging en `requirePermission()`

**Archivo:** `project/lib/ventas/auth.ts`
- Modificar `requirePermission()` para que, cuando el permiso falle (403), llame a `logAccessDenied()` antes de retornar
- Modificar `requireAnyPermission()` de la misma forma
- Incluir metadata: permiso requerido, endpoint/método si disponible, userId, companyId

### 2. Permiso especial `view_costs` para datos sensibles en GET

Actualmente los GET de cotizaciones/órdenes devuelven todos los campos, incluyendo costos y márgenes. Ya existen permisos definidos para esto:
- `ventas.margins.view`
- `ventas.costs.view`

**Implementación:**

#### Paso 4: Filtrar campos sensibles en GETs de cotizaciones

**Archivo:** `project/app/api/ventas/cotizaciones/route.ts` y `cotizaciones/[id]/route.ts`
- Después de autenticación exitosa con `COTIZACIONES_VIEW`, hacer un `checkPermission()` adicional para `ventas.costs.view`
- Si no tiene permiso, omitir campos de costo/margen de la respuesta (no 403, sino filtrado de datos)

#### Paso 5: Filtrar campos sensibles en GETs de órdenes

**Archivo:** `project/app/api/ventas/ordenes/route.ts` y `ordenes/[id]/route.ts`
- Mismo patrón que cotizaciones

#### Paso 6: Filtrar campos sensibles en GETs de facturas

**Archivo:** `project/app/api/ventas/facturas/route.ts` y `facturas/[id]/route.ts`
- Mismo patrón

---

## Resumen de cambios por archivo

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `lib/ventas/audit-config.ts` | Agregar `ACCESS_DENIED` a types y config |
| 2 | `lib/ventas/audit-helper.ts` | Nueva función `logAccessDenied()` |
| 3 | `lib/ventas/auth.ts` | Logging en `requirePermission()` y `requireAnyPermission()` cuando 403 |
| 4 | `app/api/ventas/cotizaciones/route.ts` | Filtrar costos si no tiene `ventas.costs.view` |
| 5 | `app/api/ventas/cotizaciones/[id]/route.ts` | Filtrar costos si no tiene `ventas.costs.view` |
| 6 | `app/api/ventas/ordenes/route.ts` | Filtrar costos si no tiene `ventas.costs.view` |
| 7 | `app/api/ventas/ordenes/[id]/route.ts` | Filtrar costos si no tiene `ventas.costs.view` |
| 8 | `app/api/ventas/facturas/route.ts` | Filtrar costos si no tiene `ventas.costs.view` |
| 9 | `app/api/ventas/facturas/[id]/route.ts` | Filtrar costos si no tiene `ventas.costs.view` |

## Notas de diseño

- **No se crean endpoints nuevos** - solo se mejoran los existentes
- **No se cambia la interfaz de `requirePermission()`** - el logging es transparente
- **El filtrado de costos NO bloquea el acceso** - solo oculta campos sensibles
- **`logAccessDenied()` no falla la operación** - usa try/catch como los otros helpers de auditoría
- **Se necesita agregar `'access_control'` como SalesAuditableEntity** o usar un approach genérico para el log de acceso denegado
