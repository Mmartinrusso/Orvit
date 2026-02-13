# BusinessSector

> Table name: `BusinessSector`

**Schema location:** Lines 4212-4226

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
| [Company](./models/Company.md) | `businessSectors` | Has many |
| [Client](./models/Client.md) | `businessSector` | Has one |

## Indexes

- `companyId`

## Unique Constraints

- `companyId, name`

## Entity Diagram

```mermaid
erDiagram
    BusinessSector {
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
    BusinessSector }|--|| Company : "company"
    BusinessSector ||--o{ Client : "clients"
```
