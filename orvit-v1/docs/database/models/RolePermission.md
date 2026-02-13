# RolePermission

> Table name: `RolePermission`

**Schema location:** Lines 2229-2241

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `roleId` | `Int` | ✅ |  | `` |  |
| `permissionId` | `Int` | ✅ |  | `` |  |
| `isGranted` | `Boolean` | ✅ |  | `true` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `permission` | [Permission](./models/Permission.md) | Many-to-One | permissionId | id | Cascade |
| `role` | [Role](./models/Role.md) | Many-to-One | roleId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Role](./models/Role.md) | `permissions` | Has many |
| [Permission](./models/Permission.md) | `rolePermissions` | Has many |

## Unique Constraints

- `roleId, permissionId`

## Entity Diagram

```mermaid
erDiagram
    RolePermission {
        int id PK
        int roleId
        int permissionId
        boolean isGranted
        datetime createdAt
        datetime updatedAt
    }
    Permission {
        int id PK
    }
    Role {
        int id PK
    }
    RolePermission }|--|| Permission : "permission"
    RolePermission }|--|| Role : "role"
```
