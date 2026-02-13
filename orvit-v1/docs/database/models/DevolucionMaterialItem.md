# DevolucionMaterialItem

> Table name: `devolucion_material_items`

**Schema location:** Lines 14843-14864

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `devolucionId` | `Int` | ✅ |  | `` |  |
| `supplierItemId` | `Int?` | ❌ |  | `` |  |
| `toolId` | `Int?` | ❌ |  | `` |  |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `estadoItem` | `String?` | ❌ |  | `` | DB: VarChar(50). Bueno, Dañado, etc. |
| `stockMovementId` | `Int?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `itemType` | [InventoryItemType](./models/InventoryItemType.md) | Many-to-One | - | - | - |
| `devolucion` | [DevolucionMaterial](./models/DevolucionMaterial.md) | Many-to-One | devolucionId | id | Cascade |
| `supplierItem` | [SupplierItem](./models/SupplierItem.md) | Many-to-One (optional) | supplierItemId | id | - |
| `tool` | [Tool](./models/Tool.md) | Many-to-One (optional) | toolId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Tool](./models/Tool.md) | `devolucionItems` | Has many |
| [SupplierItem](./models/SupplierItem.md) | `devolucionItems` | Has many |
| [DevolucionMaterial](./models/DevolucionMaterial.md) | `items` | Has many |

## Indexes

- `devolucionId`
- `supplierItemId`
- `toolId`

## Entity Diagram

```mermaid
erDiagram
    DevolucionMaterialItem {
        int id PK
        int devolucionId
        int supplierItemId
        int toolId
        decimal cantidad
        string estadoItem
        int stockMovementId
    }
    DevolucionMaterial {
        int id PK
    }
    SupplierItem {
        int id PK
    }
    Tool {
        int id PK
    }
    DevolucionMaterialItem }|--|| InventoryItemType : "itemType"
    DevolucionMaterialItem }|--|| DevolucionMaterial : "devolucion"
    DevolucionMaterialItem }o--|| SupplierItem : "supplierItem"
    DevolucionMaterialItem }o--|| Tool : "tool"
```
