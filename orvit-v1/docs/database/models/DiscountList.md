# DiscountList

> Table name: `DiscountList`

**Schema location:** Lines 4494-4512

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `cuid(` |  |
| `name` | `String` | ✅ |  | `` | Nombre de la lista (ej: "Lista Mayorista", "Lista Corralón") |
| `description` | `String?` | ❌ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `isActive` | `Boolean` | ✅ |  | `true` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `rubroDiscounts` | [DiscountListRubro](./models/DiscountListRubro.md) | One-to-Many | - | - | - |
| `productDiscounts` | [DiscountListProduct](./models/DiscountListProduct.md) | One-to-Many | - | - | - |
| `clients` | [Client](./models/Client.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `discountLists` | Has many |
| [Client](./models/Client.md) | `discountList` | Has one |
| [DiscountListRubro](./models/DiscountListRubro.md) | `discountList` | Has one |
| [DiscountListProduct](./models/DiscountListProduct.md) | `discountList` | Has one |

## Indexes

- `companyId`
- `isActive`

## Unique Constraints

- `companyId, name`

## Entity Diagram

```mermaid
erDiagram
    DiscountList {
        string id PK
        string name
        string description
        int companyId
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    Company {
        int id PK
    }
    DiscountListRubro {
        string id PK
    }
    DiscountListProduct {
        string id PK
    }
    Client {
        string id PK
    }
    DiscountList }|--|| Company : "company"
    DiscountList ||--o{ DiscountListRubro : "rubroDiscounts"
    DiscountList ||--o{ DiscountListProduct : "productDiscounts"
    DiscountList ||--o{ Client : "clients"
```
