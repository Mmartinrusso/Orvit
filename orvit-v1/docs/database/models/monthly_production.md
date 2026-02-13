# monthly_production

**Schema location:** Lines 3947-3965

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `product_id` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `product_name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `month_year` | `DateTime` | ✅ |  | `` | DB: Date |
| `fecha_imputacion` | `String` | ✅ |  | `` | DB: VarChar(7) |
| `quantity_produced` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 4) |
| `unit_cost` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `total_cost` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `notes` | `String?` | ❌ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |

## Indexes

- `month_year`
- `company_id`
- `fecha_imputacion`

## Unique Constraints

- `company_id, product_id, month_year`
