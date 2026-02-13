# RateLimitEntry

> Table name: `rate_limit_entries`

**Schema location:** Lines 8090-8102

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `identifier` | `String` | ✅ |  | `` | IP o "ip:userId" |
| `action` | `String` | ✅ |  | `` | "login" | "api" | "2fa" | "password_reset" |
| `count` | `Int` | ✅ |  | `1` |  |
| `firstAttempt` | `DateTime` | ✅ |  | `now(` |  |
| `lastAttempt` | `DateTime` | ✅ |  | `now(` |  |
| `blockedUntil` | `DateTime?` | ❌ |  | `` |  |

## Indexes

- `blockedUntil`

## Unique Constraints

- `identifier, action`
