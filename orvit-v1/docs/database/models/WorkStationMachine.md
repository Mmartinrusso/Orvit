# WorkStationMachine

> Table name: `WorkStationMachine`

**Schema location:** Lines 2557-2570

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `workStationId` | `Int` | ✅ |  | `` |  |
| `machineId` | `Int` | ✅ |  | `` |  |
| `isRequired` | `Boolean` | ✅ |  | `true` |  |
| `notes` | `String?` | ❌ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `machine` | [Machine](./models/Machine.md) | Many-to-One | machineId | id | Cascade |
| `workStation` | [WorkStation](./models/WorkStation.md) | Many-to-One | workStationId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Machine](./models/Machine.md) | `workStationMachines` | Has many |
| [WorkStation](./models/WorkStation.md) | `machines` | Has many |

## Unique Constraints

- `workStationId, machineId`

## Entity Diagram

```mermaid
erDiagram
    WorkStationMachine {
        int id PK
        int workStationId
        int machineId
        boolean isRequired
        string notes
        datetime createdAt
        datetime updatedAt
    }
    Machine {
        int id PK
    }
    WorkStation {
        int id PK
    }
    WorkStationMachine }|--|| Machine : "machine"
    WorkStationMachine }|--|| WorkStation : "workStation"
```
