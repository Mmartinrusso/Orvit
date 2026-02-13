# product_categories

**Schema location:** Lines 3458-3467

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `name` | `String` | ✅ |  | `` | DB: VarChar(255) |
| `description` | `String?` | ❌ |  | `` |  |
| `company_id` | `Int` | ✅ |  | `` |  |
| `created_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `updated_at` | `DateTime?` | ❌ |  | `now(` | DB: Timestamp(6) |
| `subcategories` | `product_subcategories[]` | ✅ |  | `` |  |
| `products` | `products[]` | ✅ |  | `` |  |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [product_subcategories](./models/product_subcategories.md) | `category` | Has one |
| [products](./models/products.md) | `product_categories` | Has one |

## Entity Diagram

```mermaid
erDiagram
    product_categories {
        int id PK
        string name
        string description
        int company_id
        datetime created_at
        datetime updated_at
        product_subcategories subcategories
        products products
    }
    product_subcategories {
        int id PK
    }
    products {
        int id PK
    }
```
