# FactPurchasesMonthly

**Schema location:** Lines 2972-2981

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `month` | `String` | ✅ |  | `` |  |
| `amount` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `Company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `FactPurchasesMonthly` | Has many |

## Unique Constraints

- `companyId, month`

## Entity Diagram

```mermaid
erDiagram
    FactPurchasesMonthly {
        string id PK
        int companyId
        string month
        decimal amount
        datetime createdAt
    }
    Company {
        int id PK
    }
    FactPurchasesMonthly }|--|| Company : "Company"
```
