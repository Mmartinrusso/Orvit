# TransportCompany

> Table name: `TransportCompany`

**Schema location:** Lines 4193-4209

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `cuid(` |  |
| `name` | `String` | ✅ |  | `` |  |
| `description` | `String?` | ❌ |  | `` |  |
| `phone` | `String?` | ❌ |  | `` |  |
| `email` | `String?` | ❌ |  | `` |  |
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
| [Company](./models/Company.md) | `transportCompanies` | Has many |
| [Client](./models/Client.md) | `transportCompany` | Has one |

## Indexes

- `companyId`

## Unique Constraints

- `companyId, name`

## Entity Diagram

```mermaid
erDiagram
    TransportCompany {
        string id PK
        string name
        string description
        string phone
        string email
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
    TransportCompany }|--|| Company : "company"
    TransportCompany ||--o{ Client : "clients"
```
