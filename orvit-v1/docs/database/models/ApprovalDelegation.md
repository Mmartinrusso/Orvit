# ApprovalDelegation

> Table name: `approval_delegations`

**Schema location:** Lines 15014-15026

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `delegatorId` | `Int` | ✅ |  | `` |  |
| `delegateeId` | `Int` | ✅ |  | `` |  |
| `validFrom` | `DateTime` | ✅ |  | `` |  |
| `validUntil` | `DateTime` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Indexes

- `companyId, delegateeId`
- `validFrom, validUntil`
