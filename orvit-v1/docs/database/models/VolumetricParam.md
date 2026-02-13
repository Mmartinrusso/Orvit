# VolumetricParam

> Table name: `VolumetricParam`

**Schema location:** Lines 2857-2864

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `productId` | `String` | ✅ | ✅ | `` |  |
| `m3PerOutput` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `product` | [CostProduct](./models/CostProduct.md) | Many-to-One | productId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [CostProduct](./models/CostProduct.md) | `volumetricParam` | Has one |

## Entity Diagram

```mermaid
erDiagram
    VolumetricParam {
        string id PK
        string productId UK
        decimal m3PerOutput
    }
    CostProduct {
        string id PK
    }
    VolumetricParam }|--|| CostProduct : "product"
```
