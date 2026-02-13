# ViewModeLog

> Table name: `_vm_log`

**Schema location:** Lines 8011-8022

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `action` | `String` | ✅ |  | `` | DB: VarChar(20) |
| `ipAddress` | `String?` | ❌ |  | `` | DB: VarChar(50) |
| `userAgent` | `String?` | ❌ |  | `` |  |
| `timestamp` | `DateTime` | ✅ |  | `now(` |  |

## Indexes

- `companyId, timestamp`
