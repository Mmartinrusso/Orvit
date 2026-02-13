# employee_monthly_salaries

**Schema location:** Lines 3316-3336

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `employee_id` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `month_year` | `DateTime` | ✅ |  | `` | DB: Date |
| `fecha_imputacion` | `String` | ✅ |  | `` | DB: VarChar(7) |
| `gross_salary` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 2) |
| `payroll_taxes` | `Decimal?` | ❌ |  | `0` | DB: Decimal(10, 2) |
| `total_cost` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 2) |
| `notes` | `String?` | ❌ |  | `` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `Company` | [Company](./models/Company.md) | Many-to-One | company_id | id | NoAction |
| `employees` | [Employee](./models/Employee.md) | Many-to-One | employee_id | id | NoAction |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `employee_monthly_salaries` | Has many |
| [Employee](./models/Employee.md) | `employee_monthly_salaries` | Has many |

## Indexes

- `month_year`
- `employee_id`
- `fecha_imputacion`
- `company_id`

## Unique Constraints

- `employee_id, month_year`

## Entity Diagram

```mermaid
erDiagram
    employee_monthly_salaries {
        int id PK
        string employee_id
        datetime month_year
        string fecha_imputacion
        decimal gross_salary
        decimal payroll_taxes
        decimal total_cost
        string notes
        int company_id
        datetime created_at
        datetime updated_at
    }
    Company {
        int id PK
    }
    Employee {
        string id PK
    }
    employee_monthly_salaries }|--|| Company : "Company"
    employee_monthly_salaries }|--|| Employee : "employees"
```
