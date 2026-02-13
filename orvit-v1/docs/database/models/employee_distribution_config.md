# employee_distribution_config

**Schema location:** Lines 3894-3907

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `employee_id` | `Int` | ✅ |  | `` |  |
| `product_category_id` | `Int` | ✅ |  | `` |  |
| `percentage` | `Decimal` | ✅ |  | `` | DB: Decimal(5, 2) |
| `is_active` | `Boolean?` | ❌ |  | `true` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |

## Indexes

- `company_id`
- `employee_id`

## Unique Constraints

- `company_id, employee_id, product_category_id`
