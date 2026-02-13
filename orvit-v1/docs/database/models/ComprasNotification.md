# ComprasNotification

> Table name: `compras_notifications`

**Schema location:** Lines 14924-14941

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `type` | `String` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `userId` | `Int?` | ❌ |  | `` |  |
| `title` | `String` | ✅ |  | `` |  |
| `message` | `String` | ✅ |  | `` |  |
| `priority` | `String` | ✅ |  | `"normal"` |  |
| `data` | `Json` | ✅ |  | `"{}"` |  |
| `read` | `Boolean` | ✅ |  | `false` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `expiresAt` | `DateTime?` | ❌ |  | `` |  |

## Indexes

- `companyId, userId`
- `companyId, read`
- `createdAt(sort: Desc)`
