# CostVarianceMonthly

**Schema location:** Lines 2936-2953

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `productId` | `String` | ✅ |  | `` |  |
| `month` | `String` | ✅ |  | `` |  |
| `materialPriceVar` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `materialUsageVar` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `laborRateVar` | `Decimal?` | ❌ |  | `` | DB: Decimal(12, 4) |
| `laborEffVar` | `Decimal?` | ❌ |  | `` | DB: Decimal(12, 4) |
| `ohSpendingVar` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `ohVolumeVar` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `method` | [CostMethod](./models/CostMethod.md) | Many-to-One | - | - | - |
| `Company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `CostProduct` | [CostProduct](./models/CostProduct.md) | Many-to-One | productId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `CostVarianceMonthly` | Has many |
| [CostProduct](./models/CostProduct.md) | `CostVarianceMonthly` | Has many |

## Unique Constraints

- `productId, month, method`

## Entity Diagram

```mermaid
erDiagram
    CostVarianceMonthly {
        string id PK
        int companyId
        string productId
        string month
        decimal materialPriceVar
        decimal materialUsageVar
        decimal laborRateVar
        decimal laborEffVar
        decimal ohSpendingVar
        decimal ohVolumeVar
        datetime createdAt
    }
    Company {
        int id PK
    }
    CostProduct {
        string id PK
    }
    CostVarianceMonthly }|--|| CostMethod : "method"
    CostVarianceMonthly }|--|| Company : "Company"
    CostVarianceMonthly }|--|| CostProduct : "CostProduct"
```
