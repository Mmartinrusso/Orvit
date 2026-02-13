# ContactInteraction

> Table name: `ContactInteraction`

**Schema location:** Lines 2196-2213

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `type` | `String` | ✅ |  | `` |  |
| `subject` | `String` | ✅ |  | `` |  |
| `description` | `String?` | ❌ |  | `` |  |
| `date` | `DateTime` | ✅ |  | `now(` |  |
| `duration` | `Int?` | ❌ |  | `` |  |
| `outcome` | `String?` | ❌ |  | `` |  |
| `nextAction` | `String?` | ❌ |  | `` |  |
| `contactId` | `Int` | ✅ |  | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `contact` | [Contact](./models/Contact.md) | Many-to-One | contactId | id | Cascade |
| `user` | [User](./models/User.md) | Many-to-One | userId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `contactInteractions` | Has many |
| [Contact](./models/Contact.md) | `interactions` | Has many |

## Entity Diagram

```mermaid
erDiagram
    ContactInteraction {
        int id PK
        string type
        string subject
        string description
        datetime date
        int duration
        string outcome
        string nextAction
        int contactId
        int userId
        datetime createdAt
        datetime updatedAt
    }
    Contact {
        int id PK
    }
    User {
        int id PK
    }
    ContactInteraction }|--|| Contact : "contact"
    ContactInteraction }|--|| User : "user"
```
