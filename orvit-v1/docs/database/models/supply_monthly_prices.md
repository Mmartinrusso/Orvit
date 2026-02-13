# supply_monthly_prices

**Schema location:** Lines 3761-3779

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `supply_id` | `Int` | ✅ |  | `` |  |
| `month_year` | `DateTime` | ✅ |  | `` | DB: Date |
| `fecha_imputacion` | `String` | ✅ |  | `` | DB: VarChar(7) |
| `price_per_unit` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `notes` | `String?` | ❌ |  | `` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `freight_cost` | `Decimal?` | ❌ |  | `0` | DB: Decimal(15, 2) |
| `supplies` | `supplies` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `Company` | [Company](./models/Company.md) | Many-to-One | company_id | id | NoAction |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `supply_monthly_prices` | Has many |
| [supplies](./models/supplies.md) | `supply_monthly_prices` | Has many |

## Indexes

- `month_year`
- `supply_id`
- `fecha_imputacion`

## Unique Constraints

- `supply_id, month_year`

## Entity Diagram

```mermaid
erDiagram
    supply_monthly_prices {
        int id PK
        int supply_id
        datetime month_year
        string fecha_imputacion
        decimal price_per_unit
        string notes
        int company_id
        datetime created_at
        datetime updated_at
        decimal freight_cost
        supplies supplies
    }
    Company {
        int id PK
    }
    supplies {
        int id PK
    }
    supply_monthly_prices }|--|| Company : "Company"
```
