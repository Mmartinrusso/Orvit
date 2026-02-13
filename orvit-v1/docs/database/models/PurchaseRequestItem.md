# PurchaseRequestItem

> Table name: `purchase_request_items`

**Schema location:** Lines 7747-7762

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `requestId` | `Int` | ✅ |  | `` |  |
| `descripcion` | `String` | ✅ |  | `` | DB: VarChar(500) |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `supplierItemId` | `Int?` | ❌ |  | `` | Opcional: si ya sabe qué item |
| `especificaciones` | `String?` | ❌ |  | `` | Detalles técnicos |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `request` | [PurchaseRequest](./models/PurchaseRequest.md) | Many-to-One | requestId | id | Cascade |
| `supplierItem` | [SupplierItem](./models/SupplierItem.md) | Many-to-One (optional) | supplierItemId | id | - |
| `quotationItems` | [PurchaseQuotationItem](./models/PurchaseQuotationItem.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [SupplierItem](./models/SupplierItem.md) | `purchaseRequestItems` | Has many |
| [PurchaseRequest](./models/PurchaseRequest.md) | `items` | Has many |
| [PurchaseQuotationItem](./models/PurchaseQuotationItem.md) | `requestItem` | Has one |

## Indexes

- `requestId`

## Entity Diagram

```mermaid
erDiagram
    PurchaseRequestItem {
        int id PK
        int requestId
        string descripcion
        decimal cantidad
        string unidad
        int supplierItemId
        string especificaciones
    }
    PurchaseRequest {
        int id PK
    }
    SupplierItem {
        int id PK
    }
    PurchaseQuotationItem {
        int id PK
    }
    PurchaseRequestItem }|--|| PurchaseRequest : "request"
    PurchaseRequestItem }o--|| SupplierItem : "supplierItem"
    PurchaseRequestItem ||--o{ PurchaseQuotationItem : "quotationItems"
```
