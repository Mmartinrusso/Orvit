# employee_salary_history_new

**Schema location:** Lines 3338-3351

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `employee_id` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `old_salary` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 2) |
| `new_salary` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 2) |
| `change_date` | `DateTime?` | ❌ |  | `now(` | DB: Timestamptz(6) |
| `change_reason` | `String?` | ❌ |  | `` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamptz(6) |

## Indexes

- `change_date`
- `company_id`
- `employee_id`
