# FactSalesMonthly

**Schema location:** Lines 2983-2993

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `month` | `String` | ✅ |  | `` |  |
| `netAmount` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `grossAmount` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `Company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `FactSalesMonthly` | Has many |

## Unique Constraints

- `companyId, month`

## Entity Diagram

```mermaid
erDiagram
    FactSalesMonthly {
        string id PK
        int companyId
        string month
        decimal netAmount
        decimal grossAmount
        datetime createdAt
    }
    Company {
        int id PK
    }
    FactSalesMonthly }|--|| Company : "Company"
```
