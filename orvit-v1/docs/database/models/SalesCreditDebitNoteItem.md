# SalesCreditDebitNoteItem

> Table name: `sales_credit_debit_note_items`

**Schema location:** Lines 9711-9727

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `noteId` | `Int` | ✅ |  | `` |  |
| `productId` | `String?` | ❌ |  | `` |  |
| `descripcion` | `String` | ✅ |  | `` | DB: VarChar(500) |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `precioUnitario` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `alicuotaIVA` | `Decimal` | ✅ |  | `21` | DB: Decimal(5, 2) |
| `subtotal` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `note` | [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | Many-to-One | noteId | id | Cascade |
| `product` | [Product](./models/Product.md) | Many-to-One (optional) | productId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Product](./models/Product.md) | `creditNoteItems` | Has many |
| [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | `items` | Has many |

## Indexes

- `noteId`

## Entity Diagram

```mermaid
erDiagram
    SalesCreditDebitNoteItem {
        int id PK
        int noteId
        string productId
        string descripcion
        decimal cantidad
        string unidad
        decimal precioUnitario
        decimal alicuotaIVA
        decimal subtotal
    }
    SalesCreditDebitNote {
        int id PK
    }
    Product {
        string id PK
    }
    SalesCreditDebitNoteItem }|--|| SalesCreditDebitNote : "note"
    SalesCreditDebitNoteItem }o--|| Product : "product"
```
