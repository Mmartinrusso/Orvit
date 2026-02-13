# WorkOrderWatcher

> Table name: `work_order_watchers`

**Schema location:** Lines 5678-5692

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `workOrderId` | `Int` | ✅ |  | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `reason` | `String?` | ❌ |  | `` | AUTO_CREATOR | AUTO_ASSIGNED | AUTO_EXECUTOR | MANUAL |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `workOrder` | [WorkOrder](./models/WorkOrder.md) | Many-to-One | workOrderId | id | Cascade |
| `user` | [User](./models/User.md) | Many-to-One | userId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `workOrderWatchers` | Has many |
| [WorkOrder](./models/WorkOrder.md) | `watchers` | Has many |

## Indexes

- `userId`

## Unique Constraints

- `workOrderId, userId`

## Entity Diagram

```mermaid
erDiagram
    WorkOrderWatcher {
        int id PK
        int workOrderId
        int userId
        string reason
        datetime createdAt
        datetime updatedAt
    }
    WorkOrder {
        int id PK
    }
    User {
        int id PK
    }
    WorkOrderWatcher }|--|| WorkOrder : "workOrder"
    WorkOrderWatcher }|--|| User : "user"
```
