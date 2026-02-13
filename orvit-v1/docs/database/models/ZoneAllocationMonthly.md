# ZoneAllocationMonthly

**Schema location:** Lines 3122-3137

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `zoneId` | `String` | ✅ |  | `` |  |
| `month` | `String` | ✅ |  | `` |  |
| `lineId` | `String` | ✅ |  | `` |  |
| `percent` | `Decimal` | ✅ |  | `` | DB: Decimal(5, 4) |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `Line` | [Line](./models/Line.md) | Many-to-One | lineId | id | - |
| `Zone` | [Zone](./models/Zone.md) | Many-to-One | zoneId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Line](./models/Line.md) | `ZoneAllocationMonthly` | Has many |
| [Zone](./models/Zone.md) | `ZoneAllocationMonthly` | Has many |

## Indexes

- `companyId, month`
- `zoneId, month`

## Unique Constraints

- `companyId, zoneId, month, lineId`

## Entity Diagram

```mermaid
erDiagram
    ZoneAllocationMonthly {
        string id PK
        int companyId
        string zoneId
        string month
        string lineId
        decimal percent
        datetime updatedAt
        datetime createdAt
    }
    Line {
        string id PK
    }
    Zone {
        string id PK
    }
    ZoneAllocationMonthly }|--|| Line : "Line"
    ZoneAllocationMonthly }|--|| Zone : "Zone"
```
