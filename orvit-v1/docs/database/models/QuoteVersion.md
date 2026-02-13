# QuoteVersion

> Table name: `quote_versions`

**Schema location:** Lines 8803-8817

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `quoteId` | `Int` | ✅ |  | `` |  |
| `version` | `Int` | ✅ |  | `` |  |
| `datos` | `Json` | ✅ |  | `` |  |
| `motivo` | `String?` | ❌ |  | `` |  |
| `createdBy` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `quote` | [Quote](./models/Quote.md) | Many-to-One | quoteId | id | Cascade |
| `user` | [User](./models/User.md) | Many-to-One | createdBy | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [User](./models/User.md) | `quoteVersions` | Has many |
| [Quote](./models/Quote.md) | `versions` | Has many |

## Indexes

- `quoteId`

## Entity Diagram

```mermaid
erDiagram
    QuoteVersion {
        int id PK
        int quoteId
        int version
        json datos
        string motivo
        int createdBy
        datetime createdAt
    }
    Quote {
        int id PK
    }
    User {
        int id PK
    }
    QuoteVersion }|--|| Quote : "quote"
    QuoteVersion }|--|| User : "user"
```
