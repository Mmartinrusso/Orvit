# IndirectPriceHistory

> Table name: `IndirectPriceHistory`

**Schema location:** Lines 2754-2766

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `uuid(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `indirectId` | `String` | ✅ |  | `` |  |
| `effectiveFrom` | `DateTime` | ✅ |  | `` |  |
| `price` | `Decimal` | ✅ |  | `` | DB: Decimal(12, 4) |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `indirect` | [IndirectItem](./models/IndirectItem.md) | Many-to-One | indirectId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [IndirectItem](./models/IndirectItem.md) | `priceHistory` | Has many |

## Indexes

- `indirectId, effectiveFrom`
- `companyId, effectiveFrom`

## Entity Diagram

```mermaid
erDiagram
    IndirectPriceHistory {
        string id PK
        int companyId
        string indirectId
        datetime effectiveFrom
        decimal price
        datetime createdAt
    }
    IndirectItem {
        string id PK
    }
    IndirectPriceHistory }|--|| IndirectItem : "indirect"
```
