# indirect_costs

**Schema location:** Lines 3369-3387

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `category_id` | `Int` | ✅ |  | `` |  |
| `amount` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `fecha_imputacion` | `String` | ✅ |  | `` | DB: VarChar(7) |
| `description` | `String?` | ❌ |  | `` |  |
| `status` | `String` | ✅ |  | `"pending"` | DB: VarChar(20) |
| `due_date` | `DateTime?` | ❌ |  | `` | DB: Date |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `indirect_cost_history` | `indirect_cost_history[]` | ✅ |  | `` |  |
| `indirect_cost_categories` | `indirect_cost_categories` | ✅ |  | `` |  |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [indirect_cost_categories](./models/indirect_cost_categories.md) | `indirect_costs` | Has many |
| [indirect_cost_history](./models/indirect_cost_history.md) | `indirect_costs` | Has one |

## Indexes

- `company_id`
- `category_id`
- `fecha_imputacion`

## Entity Diagram

```mermaid
erDiagram
    indirect_costs {
        int id PK
        string name
        int category_id
        decimal amount
        string fecha_imputacion
        string description
        string status
        datetime due_date
        int company_id
        datetime created_at
        datetime updated_at
        indirect_cost_history indirect_cost_history
        indirect_cost_categories indirect_cost_categories
    }
    indirect_cost_categories {
        int id PK
    }
    indirect_cost_history {
        int id PK
    }
```
