# EmployeeFixedConcept

> Table name: `employee_fixed_concepts`

**Schema location:** Lines 12146-12176

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `employee_id` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `component_id` | `Int` | ✅ |  | `` |  |
| `quantity` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 2). Valores |
| `unit_amount` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 2) |
| `comment` | `String?` | ❌ |  | `` | DB: VarChar(500) |
| `no_delete` | `Boolean` | ✅ |  | `false` |  |
| `effective_from` | `DateTime` | ✅ |  | `` | DB: Date. VIGENCIA (crítico para aumentos) |
| `effective_to` | `DateTime?` | ❌ |  | `` | DB: Date. null = vigente |
| `source` | `String` | ✅ |  | `"MANUAL"` | DB: VarChar(30). Origen |
| `is_active` | `Boolean` | ✅ |  | `true` |  |
| `created_at` | `DateTime` | ✅ |  | `now(` |  |
| `updated_at` | `DateTime` | ✅ |  | `` |  |
| `created_by` | `Int?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `employee` | [Employee](./models/Employee.md) | Many-to-One | employee_id | id | Cascade |
| `component` | [SalaryComponent](./models/SalaryComponent.md) | Many-to-One | component_id | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Employee](./models/Employee.md) | `fixedConcepts` | Has many |
| [SalaryComponent](./models/SalaryComponent.md) | `employeeFixed` | Has many |

## Indexes

- `employee_id, effective_from`
- `component_id`

## Entity Diagram

```mermaid
erDiagram
    EmployeeFixedConcept {
        int id PK
        string employee_id
        int component_id
        decimal quantity
        decimal unit_amount
        string comment
        boolean no_delete
        datetime effective_from
        datetime effective_to
        string source
        boolean is_active
        datetime created_at
        datetime updated_at
        int created_by
    }
    Employee {
        string id PK
    }
    SalaryComponent {
        int id PK
    }
    EmployeeFixedConcept }|--|| Employee : "employee"
    EmployeeFixedConcept }|--|| SalaryComponent : "component"
```
