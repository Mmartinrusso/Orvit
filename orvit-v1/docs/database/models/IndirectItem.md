# IndirectItem

> Table name: `IndirectItem`

**Schema location:** Lines 2735-2752

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `code` | `String` | ✅ |  | `` |  |
| `label` | `String` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `currentPrice` | `Decimal?` | ❌ |  | `` | DB: Decimal(12, 4) |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `category` | [IndirectCategory](./models/IndirectCategory.md) | Many-to-One | - | - | - |
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `IndirectItemAllocation` | [IndirectItemAllocation](./models/IndirectItemAllocation.md) | One-to-Many | - | - | - |
| `IndirectItemAllocationMonthly` | [IndirectItemAllocationMonthly](./models/IndirectItemAllocationMonthly.md) | One-to-Many | - | - | - |
| `priceHistory` | [IndirectPriceHistory](./models/IndirectPriceHistory.md) | One-to-Many | - | - | - |
| `monthlyIndirects` | [MonthlyIndirect](./models/MonthlyIndirect.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `indirectItems` | Has many |
| [MonthlyIndirect](./models/MonthlyIndirect.md) | `item` | Has one |
| [IndirectPriceHistory](./models/IndirectPriceHistory.md) | `indirect` | Has one |
| [IndirectItemAllocation](./models/IndirectItemAllocation.md) | `IndirectItem` | Has one |
| [IndirectItemAllocationMonthly](./models/IndirectItemAllocationMonthly.md) | `IndirectItem` | Has one |

## Unique Constraints

- `companyId, code`

## Entity Diagram

```mermaid
erDiagram
    IndirectItem {
        string id PK
        int companyId
        string code
        string label
        datetime createdAt
        decimal currentPrice
        datetime updatedAt
    }
    Company {
        int id PK
    }
    IndirectItemAllocation {
        string id PK
    }
    IndirectItemAllocationMonthly {
        string id PK
    }
    IndirectPriceHistory {
        string id PK
    }
    MonthlyIndirect {
        string id PK
    }
    IndirectItem }|--|| IndirectCategory : "category"
    IndirectItem }|--|| Company : "company"
    IndirectItem ||--o{ IndirectItemAllocation : "IndirectItemAllocation"
    IndirectItem ||--o{ IndirectItemAllocationMonthly : "IndirectItemAllocationMonthly"
    IndirectItem ||--o{ IndirectPriceHistory : "priceHistory"
    IndirectItem ||--o{ MonthlyIndirect : "monthlyIndirects"
```
