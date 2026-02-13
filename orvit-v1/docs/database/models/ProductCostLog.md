# ProductCostLog

> Table name: `ProductCostLog`

**Schema location:** Lines 2410-2443

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `cuid(` |  |
| `productId` | `String` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `previousCost` | `Float?` | ❌ |  | `` | Valores del cambio |
| `newCost` | `Float` | ✅ |  | `` |  |
| `previousStock` | `Int?` | ❌ |  | `` |  |
| `newStock` | `Int?` | ❌ |  | `` |  |
| `changeSource` | `String` | ✅ |  | `` | 'PURCHASE', 'RECIPE_UPDATE', 'MANUAL', 'BATCH_RUN' |
| `sourceDocumentId` | `String?` | ❌ |  | `` | ID del documento origen |
| `sourceDocumentType` | `String?` | ❌ |  | `` | Tipo de documento |
| `purchaseQuantity` | `Float?` | ❌ |  | `` | Cálculo detallado (para auditoría) |
| `purchaseUnitPrice` | `Float?` | ❌ |  | `` |  |
| `calculationMethod` | `String?` | ❌ |  | `` | 'WEIGHTED_AVERAGE', 'LAST_PURCHASE', 'RECIPE_SUM' |
| `createdAt` | `DateTime` | ✅ |  | `now(` | Metadata |
| `createdById` | `Int?` | ❌ |  | `` |  |
| `notes` | `String?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `product` | [Product](./models/Product.md) | Many-to-One | productId | id | Cascade |
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `productCostLogs` | Has many |
| [Product](./models/Product.md) | `costLogs` | Has many |

## Indexes

- `productId`
- `companyId, createdAt(sort: Desc)`
- `changeSource`

## Entity Diagram

```mermaid
erDiagram
    ProductCostLog {
        string id PK
        string productId
        int companyId
        float previousCost
        float newCost
        int previousStock
        int newStock
        string changeSource
        string sourceDocumentId
        string sourceDocumentType
        float purchaseQuantity
        float purchaseUnitPrice
        string calculationMethod
        datetime createdAt
        int createdById
        string _more_fields
    }
    Product {
        string id PK
    }
    Company {
        int id PK
    }
    ProductCostLog }|--|| Product : "product"
    ProductCostLog }|--|| Company : "company"
```
