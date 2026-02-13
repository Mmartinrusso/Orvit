# SalesInvoiceItem

> Table name: `sales_invoice_items`

**Schema location:** Lines 9628-9649

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `invoiceId` | `Int` | ✅ |  | `` |  |
| `saleItemId` | `Int?` | ❌ |  | `` |  |
| `productId` | `String?` | ❌ |  | `` |  |
| `codigo` | `String?` | ❌ |  | `` | DB: VarChar(50) |
| `descripcion` | `String` | ✅ |  | `` | DB: VarChar(500) |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `precioUnitario` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `descuento` | `Decimal` | ✅ |  | `0` | DB: Decimal(5, 2) |
| `alicuotaIVA` | `Decimal` | ✅ |  | `21` | DB: Decimal(5, 2) |
| `subtotal` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `invoice` | [SalesInvoice](./models/SalesInvoice.md) | Many-to-One | invoiceId | id | Cascade |
| `saleItem` | [SaleItem](./models/SaleItem.md) | Many-to-One (optional) | saleItemId | id | - |
| `product` | [Product](./models/Product.md) | Many-to-One (optional) | productId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Product](./models/Product.md) | `invoiceItems` | Has many |
| [SaleItem](./models/SaleItem.md) | `invoiceItems` | Has many |
| [SalesInvoice](./models/SalesInvoice.md) | `items` | Has many |

## Indexes

- `invoiceId`
- `saleItemId`

## Entity Diagram

```mermaid
erDiagram
    SalesInvoiceItem {
        int id PK
        int invoiceId
        int saleItemId
        string productId
        string codigo
        string descripcion
        decimal cantidad
        string unidad
        decimal precioUnitario
        decimal descuento
        decimal alicuotaIVA
        decimal subtotal
    }
    SalesInvoice {
        int id PK
    }
    SaleItem {
        int id PK
    }
    Product {
        string id PK
    }
    SalesInvoiceItem }|--|| SalesInvoice : "invoice"
    SalesInvoiceItem }o--|| SaleItem : "saleItem"
    SalesInvoiceItem }o--|| Product : "product"
```
