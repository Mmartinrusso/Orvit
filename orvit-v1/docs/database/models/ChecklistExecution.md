# ChecklistExecution

> Table name: `ChecklistExecution`

**Schema location:** Lines 3178-3199

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `checklistId` | `Int` | ✅ |  | `` |  |
| `executedBy` | `String` | ✅ |  | `` |  |
| `executionTime` | `Int` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `sectorId` | `Int?` | ❌ |  | `` |  |
| `status` | `String` | ✅ |  | `"COMPLETED"` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `completedItems` | `Int` | ✅ |  | `0` |  |
| `executedAt` | `DateTime` | ✅ |  | `now(` |  |
| `justifications` | `String?` | ❌ |  | `` |  |
| `totalItems` | `Int` | ✅ |  | `0` |  |
| `executionDetails` | `String?` | ❌ |  | `` |  |

## Indexes

- `checklistId`
- `companyId`
- `executedAt`
- `sectorId`
