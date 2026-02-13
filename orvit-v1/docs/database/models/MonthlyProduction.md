# MonthlyProduction

> Table name: `MonthlyProduction`

**Schema location:** Lines 2879-2890

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `productId` | `String` | ✅ |  | `` |  |
| `month` | `String` | ✅ |  | `` |  |
| `producedQuantity` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `companyId` | `Int` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `product` | [CostProduct](./models/CostProduct.md) | Many-to-One | productId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `monthlyProductions` | Has many |
| [CostProduct](./models/CostProduct.md) | `monthlyProductions` | Has many |

## Unique Constraints

- `productId, month`

## Entity Diagram

```mermaid
erDiagram
    MonthlyProduction {
        string id PK
        string productId
        string month
        decimal producedQuantity
        int companyId
    }
    Company {
        int id PK
    }
    CostProduct {
        string id PK
    }
    MonthlyProduction }|--|| Company : "company"
    MonthlyProduction }|--|| CostProduct : "product"
```
