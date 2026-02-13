# IndirectItemAllocation

**Schema location:** Lines 2995-3009

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `itemId` | `String` | ✅ |  | `` |  |
| `lineId` | `String` | ✅ |  | `` |  |
| `percent` | `Decimal` | ✅ |  | `` | DB: Decimal(5, 4) |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `IndirectItem` | [IndirectItem](./models/IndirectItem.md) | Many-to-One | itemId | id | - |
| `Line` | [Line](./models/Line.md) | Many-to-One | lineId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Line](./models/Line.md) | `IndirectItemAllocation` | Has many |
| [IndirectItem](./models/IndirectItem.md) | `IndirectItemAllocation` | Has many |

## Indexes

- `companyId, itemId`
- `itemId`

## Unique Constraints

- `companyId, itemId, lineId`

## Entity Diagram

```mermaid
erDiagram
    IndirectItemAllocation {
        string id PK
        int companyId
        string itemId
        string lineId
        decimal percent
        datetime updatedAt
        datetime createdAt
    }
    IndirectItem {
        string id PK
    }
    Line {
        string id PK
    }
    IndirectItemAllocation }|--|| IndirectItem : "IndirectItem"
    IndirectItemAllocation }|--|| Line : "Line"
```
