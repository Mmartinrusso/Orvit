# DeliveryZone

> Table name: `DeliveryZone`

**Schema location:** Lines 4176-4190

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `cuid(` |  |
| `name` | `String` | ✅ |  | `` |  |
| `description` | `String?` | ❌ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `isActive` | `Boolean` | ✅ |  | `true` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `clients` | [Client](./models/Client.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `deliveryZones` | Has many |
| [Client](./models/Client.md) | `deliveryZone` | Has one |

## Indexes

- `companyId`

## Unique Constraints

- `companyId, name`

## Entity Diagram

```mermaid
erDiagram
    DeliveryZone {
        string id PK
        string name
        string description
        int companyId
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    Company {
        int id PK
    }
    Client {
        string id PK
    }
    DeliveryZone }|--|| Company : "company"
    DeliveryZone ||--o{ Client : "clients"
```
