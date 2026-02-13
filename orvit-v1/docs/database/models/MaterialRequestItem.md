# MaterialRequestItem

> Table name: `material_request_items`

**Schema location:** Lines 14645-14669

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `requestId` | `Int` | ✅ |  | `` |  |
| `supplierItemId` | `Int?` | ❌ |  | `` |  |
| `toolId` | `Int?` | ❌ |  | `` |  |
| `cantidadSolicitada` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `cantidadAprobada` | `Decimal?` | ❌ |  | `` | DB: Decimal(15, 4) |
| `cantidadReservada` | `Decimal` | ✅ |  | `0` | DB: Decimal(15, 4) |
| `cantidadDespachada` | `Decimal` | ✅ |  | `0` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `notas` | `String?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `itemType` | [InventoryItemType](./models/InventoryItemType.md) | Many-to-One | - | - | - |
| `request` | [MaterialRequest](./models/MaterialRequest.md) | Many-to-One | requestId | id | Cascade |
| `supplierItem` | [SupplierItem](./models/SupplierItem.md) | Many-to-One (optional) | supplierItemId | id | - |
| `tool` | [Tool](./models/Tool.md) | Many-to-One (optional) | toolId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Tool](./models/Tool.md) | `materialRequestItems` | Has many |
| [SupplierItem](./models/SupplierItem.md) | `materialRequestItems` | Has many |
| [MaterialRequest](./models/MaterialRequest.md) | `items` | Has many |

## Indexes

- `requestId`
- `supplierItemId`
- `toolId`

## Entity Diagram

```mermaid
erDiagram
    MaterialRequestItem {
        int id PK
        int requestId
        int supplierItemId
        int toolId
        decimal cantidadSolicitada
        decimal cantidadAprobada
        decimal cantidadReservada
        decimal cantidadDespachada
        string unidad
        string notas
    }
    MaterialRequest {
        int id PK
    }
    SupplierItem {
        int id PK
    }
    Tool {
        int id PK
    }
    MaterialRequestItem }|--|| InventoryItemType : "itemType"
    MaterialRequestItem }|--|| MaterialRequest : "request"
    MaterialRequestItem }o--|| SupplierItem : "supplierItem"
    MaterialRequestItem }o--|| Tool : "tool"
```
