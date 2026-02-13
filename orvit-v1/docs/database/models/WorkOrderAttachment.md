# WorkOrderAttachment

> Table name: `WorkOrderAttachment`

**Schema location:** Lines 1883-1897

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `workOrderId` | `Int` | ✅ |  | `` |  |
| `url` | `String` | ✅ |  | `` |  |
| `fileName` | `String` | ✅ |  | `` |  |
| `fileType` | `String` | ✅ |  | `` |  |
| `fileSize` | `Int?` | ❌ |  | `` |  |
| `uploadedAt` | `DateTime` | ✅ |  | `now(` |  |
| `uploadedById` | `Int?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `uploadedBy` | [User](./models/User.md) | Many-to-One (optional) | uploadedById | id | - |
| `workOrder` | [WorkOrder](./models/WorkOrder.md) | Many-to-One | workOrderId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `workOrderAttachments` | Has many |
| [WorkOrder](./models/WorkOrder.md) | `attachments` | Has many |

## Indexes

- `workOrderId`

## Entity Diagram

```mermaid
erDiagram
    WorkOrderAttachment {
        int id PK
        int workOrderId
        string url
        string fileName
        string fileType
        int fileSize
        datetime uploadedAt
        int uploadedById
    }
    User {
        int id PK
    }
    WorkOrder {
        int id PK
    }
    WorkOrderAttachment }o--|| User : "uploadedBy"
    WorkOrderAttachment }|--|| WorkOrder : "workOrder"
```
