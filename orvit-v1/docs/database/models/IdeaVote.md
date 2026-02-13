# IdeaVote

> Table name: `idea_votes`

**Schema location:** Lines 12655-12667

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `ideaId` | `Int` | ✅ |  | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `idea` | [Idea](./models/Idea.md) | Many-to-One | ideaId | id | Cascade |
| `user` | [User](./models/User.md) | Many-to-One | userId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `ideaVotes` | Has many |
| [Idea](./models/Idea.md) | `votes` | Has many |

## Unique Constraints

- `ideaId, userId`

## Entity Diagram

```mermaid
erDiagram
    IdeaVote {
        int id PK
        int ideaId
        int userId
        datetime createdAt
    }
    Idea {
        int id PK
    }
    User {
        int id PK
    }
    IdeaVote }|--|| Idea : "idea"
    IdeaVote }|--|| User : "user"
```
