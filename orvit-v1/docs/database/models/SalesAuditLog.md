# SalesAuditLog

> Table name: `sales_audit_logs`

**Schema location:** Lines 10020-10041

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `entidad` | `String` | ✅ |  | `` | DB: VarChar(100) |
| `entidadId` | `Int` | ✅ |  | `` |  |
| `accion` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `camposModificados` | `Json?` | ❌ |  | `` |  |
| `datosAnteriores` | `Json?` | ❌ |  | `` |  |
| `datosNuevos` | `Json?` | ❌ |  | `` |  |
| `ip` | `String?` | ❌ |  | `` | DB: VarChar(50) |
| `userAgent` | `String?` | ❌ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `user` | [User](./models/User.md) | Many-to-One | userId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `salesAuditLogs` | Has many |

## Indexes

- `companyId`
- `entidad, entidadId`
- `userId`
- `createdAt`

## Entity Diagram

```mermaid
erDiagram
    SalesAuditLog {
        int id PK
        string entidad
        int entidadId
        string accion
        json camposModificados
        json datosAnteriores
        json datosNuevos
        string ip
        string userAgent
        int companyId
        int userId
        datetime createdAt
    }
    User {
        int id PK
    }
    SalesAuditLog }|--|| User : "user"
```
