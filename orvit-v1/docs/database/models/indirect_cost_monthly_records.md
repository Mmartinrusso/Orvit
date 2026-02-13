# indirect_cost_monthly_records

**Schema location:** Lines 3439-3456

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `cost_base_id` | `Int` | ✅ |  | `` |  |
| `fecha_imputacion` | `String` | ✅ |  | `` | DB: VarChar |
| `amount` | `Decimal` | ✅ |  | `` | DB: Decimal |
| `status` | `String` | ✅ |  | `"pending"` | DB: VarChar |
| `due_date` | `DateTime?` | ❌ |  | `` | DB: Date |
| `notes` | `String?` | ❌ |  | `` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `indirect_cost_change_history` | `indirect_cost_change_history[]` | ✅ |  | `` |  |
| `indirect_cost_base` | `indirect_cost_base` | ✅ |  | `` |  |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [indirect_cost_base](./models/indirect_cost_base.md) | `indirect_cost_monthly_records` | Has many |
| [indirect_cost_change_history](./models/indirect_cost_change_history.md) | `indirect_cost_monthly_records` | Has one |

## Indexes

- `cost_base_id`
- `company_id`
- `fecha_imputacion`

## Entity Diagram

```mermaid
erDiagram
    indirect_cost_monthly_records {
        int id PK
        int cost_base_id
        string fecha_imputacion
        decimal amount
        string status
        datetime due_date
        string notes
        int company_id
        datetime created_at
        datetime updated_at
        indirect_cost_change_history indirect_cost_change_history
        indirect_cost_base indirect_cost_base
    }
    indirect_cost_base {
        int id PK
    }
    indirect_cost_change_history {
        int id PK
    }
```
