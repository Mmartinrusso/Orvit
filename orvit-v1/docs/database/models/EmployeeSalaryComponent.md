# EmployeeSalaryComponent

> Table name: `employee_salary_components`

**Schema location:** Lines 11717-11732

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `employee_id` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `component_id` | `Int` | ✅ |  | `` |  |
| `custom_value` | `Decimal?` | ❌ |  | `` | DB: Decimal(12, 2) |
| `is_active` | `Boolean` | ✅ |  | `true` |  |
| `effective_from` | `DateTime` | ✅ |  | `now(` |  |
| `effective_to` | `DateTime?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `employee` | [Employee](./models/Employee.md) | Many-to-One | employee_id | id | Cascade |
| `component` | [SalaryComponent](./models/SalaryComponent.md) | Many-to-One | component_id | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Employee](./models/Employee.md) | `salaryComponents` | Has many |
| [SalaryComponent](./models/SalaryComponent.md) | `employeeComponents` | Has many |

## Indexes

- `employee_id, effective_from`
- `component_id`

## Entity Diagram

```mermaid
erDiagram
    EmployeeSalaryComponent {
        int id PK
        string employee_id
        int component_id
        decimal custom_value
        boolean is_active
        datetime effective_from
        datetime effective_to
    }
    Employee {
        string id PK
    }
    SalaryComponent {
        int id PK
    }
    EmployeeSalaryComponent }|--|| Employee : "employee"
    EmployeeSalaryComponent }|--|| SalaryComponent : "component"
```
