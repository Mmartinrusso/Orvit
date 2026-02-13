# PurchaseReceiptItem

> Table name: `PurchaseReceiptItem`

**Schema location:** Lines 4715-4737

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `comprobanteId` | `Int` | ✅ |  | `` |  |
| `itemId` | `Int?` | ❌ |  | `` |  |
| `descripcion` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `precioUnitario` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `subtotal` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `proveedorId` | `Int` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `proveedor` | `suppliers` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `comprobante` | [PurchaseReceipt](./models/PurchaseReceipt.md) | Many-to-One | comprobanteId | id | Cascade |
| `supplierItem` | [SupplierItem](./models/SupplierItem.md) | Many-to-One (optional) | itemId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [suppliers](./models/suppliers.md) | `purchaseReceiptItems` | Has many |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `items` | Has many |
| [SupplierItem](./models/SupplierItem.md) | `receiptItems` | Has many |

## Indexes

- `comprobanteId`
- `proveedorId`
- `itemId`
- `companyId`

## Entity Diagram

```mermaid
erDiagram
    PurchaseReceiptItem {
        int id PK
        int comprobanteId
        int itemId
        string descripcion
        decimal cantidad
        string unidad
        decimal precioUnitario
        decimal subtotal
        int proveedorId
        int companyId
        datetime createdAt
        datetime updatedAt
        suppliers proveedor
    }
    PurchaseReceipt {
        int id PK
    }
    SupplierItem {
        int id PK
    }
    suppliers {
        int id PK
    }
    PurchaseReceiptItem }|--|| PurchaseReceipt : "comprobante"
    PurchaseReceiptItem }o--|| SupplierItem : "supplierItem"
```
