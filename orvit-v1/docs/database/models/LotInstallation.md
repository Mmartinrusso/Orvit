# LotInstallation

> Table name: `lot_installations`

**Schema location:** Lines 1480-1510

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `lotId` | `Int` | ✅ |  | `` |  |
| `machineId` | `Int` | ✅ |  | `` |  |
| `componentId` | `Int?` | ❌ |  | `` |  |
| `quantity` | `Int` | ✅ |  | `1` |  |
| `installedAt` | `DateTime` | ✅ |  | `now(` |  |
| `installedById` | `Int` | ✅ |  | `` |  |
| `workOrderId` | `Int?` | ❌ |  | `` | OT en la que se instaló |
| `removedAt` | `DateTime?` | ❌ |  | `` | Retiro (si se reemplaza) |
| `removedById` | `Int?` | ❌ |  | `` |  |
| `removalReason` | `String?` | ❌ |  | `` | REPLACEMENT, FAILURE, UPGRADE, RELOCATION |
| `removalWorkOrderId` | `Int?` | ❌ |  | `` |  |
| `notes` | `String?` | ❌ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `lot` | [InventoryLot](./models/InventoryLot.md) | Many-to-One | lotId | id | Cascade |
| `machine` | [Machine](./models/Machine.md) | Many-to-One | machineId | id | Cascade |
| `component` | [Component](./models/Component.md) | Many-to-One (optional) | componentId | id | - |
| `installedBy` | [User](./models/User.md) | Many-to-One | installedById | id | - |
| `workOrder` | [WorkOrder](./models/WorkOrder.md) | Many-to-One (optional) | workOrderId | id | - |
| `removedBy` | [User](./models/User.md) | Many-to-One (optional) | removedById | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `lotsInstalled` | Has many |
| [User](./models/User.md) | `lotsRemoved` | Has many |
| [Machine](./models/Machine.md) | `lotInstallations` | Has many |
| [Component](./models/Component.md) | `lotInstallations` | Has many |
| [InventoryLot](./models/InventoryLot.md) | `installations` | Has many |
| [WorkOrder](./models/WorkOrder.md) | `lotInstallations` | Has many |

## Indexes

- `machineId, removedAt`
- `lotId`
- `companyId`

## Entity Diagram

```mermaid
erDiagram
    LotInstallation {
        int id PK
        int lotId
        int machineId
        int componentId
        int quantity
        datetime installedAt
        int installedById
        int workOrderId
        datetime removedAt
        int removedById
        string removalReason
        int removalWorkOrderId
        string notes
        int companyId
        datetime createdAt
    }
    InventoryLot {
        int id PK
    }
    Machine {
        int id PK
    }
    Component {
        int id PK
    }
    User {
        int id PK
    }
    WorkOrder {
        int id PK
    }
    LotInstallation }|--|| InventoryLot : "lot"
    LotInstallation }|--|| Machine : "machine"
    LotInstallation }o--|| Component : "component"
    LotInstallation }|--|| User : "installedBy"
    LotInstallation }o--|| WorkOrder : "workOrder"
    LotInstallation }o--|| User : "removedBy"
```
