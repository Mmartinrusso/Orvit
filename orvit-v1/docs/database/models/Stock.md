# Stock

> Table name: `Stock`

**Schema location:** Lines 4808-4822

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `supplierItemId` | `Int` | ✅ | ✅ | `` |  |
| `cantidad` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unidad` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `precioUnitario` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `ultimaActualizacion` | `DateTime` | ✅ |  | `now(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `supplierItem` | [SupplierItem](./models/SupplierItem.md) | Many-to-One | supplierItemId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [SupplierItem](./models/SupplierItem.md) | `stock` | Has one |

## Indexes

- `companyId`

## Entity Diagram

```mermaid
erDiagram
    Stock {
        int id PK
        int supplierItemId UK
        decimal cantidad
        string unidad
        decimal precioUnitario
        datetime ultimaActualizacion
        int companyId
        datetime createdAt
        datetime updatedAt
    }
    SupplierItem {
        int id PK
    }
    Stock }|--|| SupplierItem : "supplierItem"
```
