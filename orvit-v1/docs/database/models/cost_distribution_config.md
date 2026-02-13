# cost_distribution_config

**Schema location:** Lines 3878-3892

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `cost_type` | `String` | ✅ |  | `` | DB: VarChar(100) |
| `cost_name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `product_category_id` | `Int` | ✅ |  | `` |  |
| `percentage` | `Decimal` | ✅ |  | `` | DB: Decimal(5, 2) |
| `is_active` | `Boolean?` | ❌ |  | `true` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |

## Indexes

- `company_id`
- `cost_type`

## Unique Constraints

- `company_id, cost_type, product_category_id`
