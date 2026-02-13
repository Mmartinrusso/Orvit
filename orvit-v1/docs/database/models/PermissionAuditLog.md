# PermissionAuditLog

> Table name: `PermissionAuditLog`

**Schema location:** Lines 2262-2280

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `action` | `String` | ✅ |  | `` | PERMISSION_GRANTED, PERMISSION_REVOKED, ROLE_CREATED, ROLE_DELETED, ROLE_CLONED, USER_PERMISSION_CHANGED |
| `targetType` | `String` | ✅ |  | `` | ROLE, USER |
| `targetId` | `Int` | ✅ |  | `` | roleId o userId dependiendo del targetType |
| `targetName` | `String?` | ❌ |  | `` | Nombre del rol o usuario afectado |
| `permissionId` | `Int?` | ❌ |  | `` | ID del permiso afectado (si aplica) |
| `permissionName` | `String?` | ❌ |  | `` | Nombre del permiso afectado |
| `performedById` | `Int` | ✅ |  | `` | ID del usuario que realizó la acción |
| `performedByName` | `String` | ✅ |  | `` | Nombre del usuario que realizó la acción |
| `details` | `Json?` | ❌ |  | `` | Detalles adicionales (ej: permisos clonados, valores anteriores) |
| `companyId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Indexes

- `companyId, createdAt`
- `targetType, targetId`
- `performedById`
