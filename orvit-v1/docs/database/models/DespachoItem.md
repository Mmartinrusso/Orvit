# DespachoItem

> Table name: `despacho_items`

**Schema location:** Lines 14749-14785

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `despachoId` | `Int` | ✅ |  | `` |  |
| `supplierItemId` | `Int?` | ❌ |  | `` |  |
| `toolId` | `Int?` | ❌ |  | `` |  |
| `stockLocationId` | `Int?` | ❌ |  | `` | Ubicación específica de donde salió |
| `lote` | `String?` | ❌ |  | `` | DB: VarChar(100) |
| `cantidadSolicitada` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `cantidadDespachada` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `costoUnitario` | `Decimal?` | ❌ |  | `` | DB: Decimal(15, 4). Costo al momento del despacho (congelado) |
| `costoTotal` | `Decimal?` | ❌ |  | `` | DB: Decimal(15, 2) |
| `metodoAsignacion` | `String?` | ❌ |  | `` | DB: VarChar(20). FIFO, FEFO, MANUAL |
| `notas` | `String?` | ❌ |  | `` |  |
| `stockMovementId` | `Int?` | ❌ |  | `` | Referencias a movimientos generados |
| `toolMovementId` | `Int?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `itemType` | [InventoryItemType](./models/InventoryItemType.md) | Many-to-One | - | - | - |
| `despacho` | [Despacho](./models/Despacho.md) | Many-to-One | despachoId | id | Cascade |
| `supplierItem` | [SupplierItem](./models/SupplierItem.md) | Many-to-One (optional) | supplierItemId | id | - |
| `tool` | [Tool](./models/Tool.md) | Many-to-One (optional) | toolId | id | - |
| `stockLocation` | [StockLocation](./models/StockLocation.md) | Many-to-One (optional) | stockLocationId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Tool](./models/Tool.md) | `despachoItems` | Has many |
| [SupplierItem](./models/SupplierItem.md) | `despachoItems` | Has many |
| [StockLocation](./models/StockLocation.md) | `despachoItems` | Has many |
| [Despacho](./models/Despacho.md) | `items` | Has many |

## Indexes

- `despachoId`
- `supplierItemId`
- `toolId`

## Entity Diagram

```mermaid
erDiagram
    DespachoItem {
        int id PK
        int despachoId
        int supplierItemId
        int toolId
        int stockLocationId
        string lote
        decimal cantidadSolicitada
        decimal cantidadDespachada
        string unidad
        decimal costoUnitario
        decimal costoTotal
        string metodoAsignacion
        string notas
        int stockMovementId
        int toolMovementId
    }
    Despacho {
        int id PK
    }
    SupplierItem {
        int id PK
    }
    Tool {
        int id PK
    }
    StockLocation {
        int id PK
    }
    DespachoItem }|--|| InventoryItemType : "itemType"
    DespachoItem }|--|| Despacho : "despacho"
    DespachoItem }o--|| SupplierItem : "supplierItem"
    DespachoItem }o--|| Tool : "tool"
    DespachoItem }o--|| StockLocation : "stockLocation"
```
