# ZoneAllocation

**Schema location:** Lines 3106-3120

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `zoneId` | `String` | ✅ |  | `` |  |
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
| [Line](./models/Line.md) | `ZoneAllocation` | Has many |
| [Zone](./models/Zone.md) | `ZoneAllocation` | Has many |

## Indexes

- `companyId, zoneId`
- `zoneId`

## Unique Constraints

- `companyId, zoneId, lineId`

## Entity Diagram

```mermaid
erDiagram
    ZoneAllocation {
        string id PK
        int companyId
        string zoneId
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
    ZoneAllocation }|--|| Line : "Line"
    ZoneAllocation }|--|| Zone : "Zone"
```
