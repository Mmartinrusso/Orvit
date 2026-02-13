# TokenBlacklist

> Table name: `token_blacklist`

**Schema location:** Lines 8048-8061

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `tokenHash` | `String` | ✅ | ✅ | `` |  |
| `tokenType` | `String` | ✅ |  | `` | "access" | "refresh" |
| `userId` | `Int` | ✅ |  | `` |  |
| `reason` | `String?` | ❌ |  | `` | "logout" | "password_change" | "admin_revoke" | "security" |
| `expiresAt` | `DateTime` | ✅ |  | `` | Cuando el token original expiraría |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Indexes

- `tokenHash`
- `expiresAt`
- `userId`
