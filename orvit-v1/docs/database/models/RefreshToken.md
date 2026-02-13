# RefreshToken

> Table name: `refresh_tokens`

**Schema location:** Lines 8029-8045

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `token` | `String` | ✅ | ✅ | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `sessionId` | `String` | ✅ |  | `` |  |
| `expiresAt` | `DateTime` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `revokedAt` | `DateTime?` | ❌ |  | `` |  |
| `replacedBy` | `String?` | ❌ |  | `` | Token que lo reemplazó (detección de reuso) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `user` | [User](./models/User.md) | Many-to-One | userId | id | Cascade |
| `session` | [Session](./models/Session.md) | Many-to-One | sessionId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `refreshTokens` | Has many |
| [Session](./models/Session.md) | `refreshTokens` | Has many |

## Indexes

- `userId`
- `token`
- `expiresAt`

## Entity Diagram

```mermaid
erDiagram
    RefreshToken {
        string id PK
        string token UK
        int userId
        string sessionId
        datetime expiresAt
        datetime createdAt
        datetime revokedAt
        string replacedBy
    }
    User {
        int id PK
    }
    Session {
        string id PK
    }
    RefreshToken }|--|| User : "user"
    RefreshToken }|--|| Session : "session"
```
