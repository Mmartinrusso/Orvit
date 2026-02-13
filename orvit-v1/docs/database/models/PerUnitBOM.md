# PerUnitBOM

> Table name: `PerUnitBOM`

**Schema location:** Lines 2844-2855

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `productId` | `String` | ✅ |  | `` |  |
| `inputId` | `String` | ✅ |  | `` |  |
| `qtyPerOut` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `unitLabel` | `String` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `input` | [InputItem](./models/InputItem.md) | Many-to-One | inputId | id | Cascade |
| `product` | [CostProduct](./models/CostProduct.md) | Many-to-One | productId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [CostProduct](./models/CostProduct.md) | `perUnitBOM` | Has many |
| [InputItem](./models/InputItem.md) | `perUnitBOM` | Has many |

## Unique Constraints

- `productId, inputId`

## Entity Diagram

```mermaid
erDiagram
    PerUnitBOM {
        string id PK
        string productId
        string inputId
        decimal qtyPerOut
        string unitLabel
    }
    InputItem {
        string id PK
    }
    CostProduct {
        string id PK
    }
    PerUnitBOM }|--|| InputItem : "input"
    PerUnitBOM }|--|| CostProduct : "product"
```
