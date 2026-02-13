# PayrollRunItemLine

> Table name: `payroll_run_item_lines`

**Schema location:** Lines 12326-12350

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `run_item_id` | `Int` | ✅ |  | `` |  |
| `component_id` | `Int?` | ❌ |  | `` |  |
| `code` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `type` | `String` | ✅ |  | `` | DB: VarChar(20). EARNING | DEDUCTION | EMPLOYER_COST |
| `quantity` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 2) |
| `unit_amount` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 2) |
| `base_amount` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 2) |
| `calculated_amount` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 2) |
| `final_amount` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 2) |
| `formula_used` | `String?` | ❌ |  | `` |  |
| `meta` | `Json?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `runItem` | [PayrollRunItem](./models/PayrollRunItem.md) | Many-to-One | run_item_id | id | Cascade |
| `component` | [SalaryComponent](./models/SalaryComponent.md) | Many-to-One (optional) | component_id | id | SetNull |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [SalaryComponent](./models/SalaryComponent.md) | `runItemLines` | Has many |
| [PayrollRunItem](./models/PayrollRunItem.md) | `lines` | Has many |

## Indexes

- `run_item_id`
- `code`
- `component_id`

## Entity Diagram

```mermaid
erDiagram
    PayrollRunItemLine {
        int id PK
        int run_item_id
        int component_id
        string code
        string name
        string type
        decimal quantity
        decimal unit_amount
        decimal base_amount
        decimal calculated_amount
        decimal final_amount
        string formula_used
        json meta
    }
    PayrollRunItem {
        int id PK
    }
    SalaryComponent {
        int id PK
    }
    PayrollRunItemLine }|--|| PayrollRunItem : "runItem"
    PayrollRunItemLine }o--|| SalaryComponent : "component"
```
