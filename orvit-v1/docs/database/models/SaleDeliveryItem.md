# SaleDeliveryItem

> Table name: `sale_delivery_items`

**Schema location:** Lines 9343-9358

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `deliveryId` | `Int` | ✅ |  | `` |  |
| `saleItemId` | `Int` | ✅ |  | `` |  |
| `productId` | `String?` | ❌ |  | `` |  |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `notas` | `String?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `delivery` | [SaleDelivery](./models/SaleDelivery.md) | Many-to-One | deliveryId | id | Cascade |
| `saleItem` | [SaleItem](./models/SaleItem.md) | Many-to-One | saleItemId | id | - |
| `product` | [Product](./models/Product.md) | Many-to-One (optional) | productId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Product](./models/Product.md) | `deliveryItems` | Has many |
| [SaleItem](./models/SaleItem.md) | `deliveryItems` | Has many |
| [SaleDelivery](./models/SaleDelivery.md) | `items` | Has many |

## Indexes

- `deliveryId`
- `saleItemId`

## Entity Diagram

```mermaid
erDiagram
    SaleDeliveryItem {
        int id PK
        int deliveryId
        int saleItemId
        string productId
        decimal cantidad
        string notas
    }
    SaleDelivery {
        int id PK
    }
    SaleItem {
        int id PK
    }
    Product {
        string id PK
    }
    SaleDeliveryItem }|--|| SaleDelivery : "delivery"
    SaleDeliveryItem }|--|| SaleItem : "saleItem"
    SaleDeliveryItem }o--|| Product : "product"
```
