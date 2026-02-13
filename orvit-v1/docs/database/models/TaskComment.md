# TaskComment

> Table name: `TaskComment`

**Schema location:** Lines 1951-1962

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `taskId` | `Int` | ✅ |  | `` |  |
| `content` | `String` | ✅ |  | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `task` | [Task](./models/Task.md) | Many-to-One | taskId | id | Cascade |
| `user` | [User](./models/User.md) | Many-to-One | userId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `taskComments` | Has many |
| [Task](./models/Task.md) | `comments` | Has many |

## Entity Diagram

```mermaid
erDiagram
    TaskComment {
        int id PK
        int taskId
        string content
        int userId
        datetime createdAt
        datetime updatedAt
    }
    Task {
        int id PK
    }
    User {
        int id PK
    }
    TaskComment }|--|| Task : "task"
    TaskComment }|--|| User : "user"
```
