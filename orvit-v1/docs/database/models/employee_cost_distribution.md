# employee_cost_distribution

**Schema location:** Lines 3909-3925

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `cost_type` | `String` | ✅ |  | `` | DB: VarChar(100) |
| `cost_name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `employee_category_id` | `Int` | ✅ |  | `` |  |
| `percentage` | `Decimal` | ✅ |  | `` | DB: Decimal(5, 2) |
| `is_active` | `Boolean?` | ❌ |  | `true` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `product_category_id` | `Int?` | ❌ |  | `` |  |

## Indexes

- `company_id`
- `cost_type`
- `product_category_id`

## Unique Constraints

- `company_id, cost_type, employee_category_id, product_category_id`
