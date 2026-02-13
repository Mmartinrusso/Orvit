# TaxBase

> Table name: `TaxBase`

**Schema location:** Lines 4005-4025

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `description` | `String?` | ❌ |  | `` |  |
| `isRecurring` | `Boolean` | ✅ |  | `true` |  |
| `recurringDay` | `Int` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `createdBy` | `Int` | ✅ |  | `` |  |
| `notes` | `String?` | ❌ |  | `` |  |
| `isActive` | `Boolean` | ✅ |  | `true` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `createdByUser` | [User](./models/User.md) | Many-to-One | createdBy | id | - |
| `taxRecords` | [TaxRecord](./models/TaxRecord.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `taxBases` | Has many |
| [User](./models/User.md) | `taxBasesCreated` | Has many |
| [TaxRecord](./models/TaxRecord.md) | `taxBase` | Has one |

## Indexes

- `companyId`
- `isActive`
- `isRecurring, recurringDay`

## Entity Diagram

```mermaid
erDiagram
    TaxBase {
        int id PK
        string name
        string description
        boolean isRecurring
        int recurringDay
        int companyId
        int createdBy
        string notes
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    Company {
        int id PK
    }
    User {
        int id PK
    }
    TaxRecord {
        int id PK
    }
    TaxBase }|--|| Company : "company"
    TaxBase }|--|| User : "createdByUser"
    TaxBase ||--o{ TaxRecord : "taxRecords"
```
