# recipe_items

**Schema location:** Lines 3858-3876

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `recipe_id` | `Int` | ✅ |  | `` |  |
| `supply_id` | `Int` | ✅ |  | `` |  |
| `quantity` | `Decimal` | ✅ |  | `` | DB: Decimal(10, 5) |
| `unit_measure` | `String` | ✅ |  | `` | DB: VarChar(10) |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `pulsos` | `Int?` | ❌ |  | `100` |  |
| `kg_por_pulso` | `Decimal?` | ❌ |  | `0.0000` | DB: Decimal(10, 4) |
| `is_bank_ingredient` | `Boolean?` | ❌ |  | `false` |  |
| `recipes` | `recipes` | ✅ |  | `` |  |
| `supplies` | `supplies` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `Company` | [Company](./models/Company.md) | Many-to-One | company_id | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `recipe_items` | Has many |
| [supplies](./models/supplies.md) | `recipe_items` | Has many |
| [recipes](./models/recipes.md) | `recipe_items` | Has many |

## Indexes

- `recipe_id`
- `supply_id`

## Entity Diagram

```mermaid
erDiagram
    recipe_items {
        int id PK
        int recipe_id
        int supply_id
        decimal quantity
        string unit_measure
        int company_id
        datetime created_at
        datetime updated_at
        int pulsos
        decimal kg_por_pulso
        boolean is_bank_ingredient
        recipes recipes
        supplies supplies
    }
    Company {
        int id PK
    }
    supplies {
        int id PK
    }
    recipes {
        int id PK
    }
    recipe_items }|--|| Company : "Company"
```
