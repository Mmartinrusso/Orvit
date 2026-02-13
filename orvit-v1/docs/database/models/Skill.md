# Skill

> Table name: `skills`

**Schema location:** Lines 13103-13123

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `name` | `String` | ✅ |  | `` | Nombre de la habilidad (ej: "Soldadura TIG") |
| `code` | `String?` | ❌ |  | `` | Código interno (ej: "SK-001") |
| `category` | `String` | ✅ |  | `` | Categoría (Mecánica, Eléctrica, Hidráulica, Instrumentación, etc.) |
| `description` | `String?` | ❌ |  | `` |  |
| `isActive` | `Boolean` | ✅ |  | `true` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `userSkills` | [UserSkill](./models/UserSkill.md) | One-to-Many | - | - | - |
| `taskRequirements` | [TaskSkillRequirement](./models/TaskSkillRequirement.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `skills` | Has many |
| [UserSkill](./models/UserSkill.md) | `skill` | Has one |
| [TaskSkillRequirement](./models/TaskSkillRequirement.md) | `skill` | Has one |

## Indexes

- `companyId`
- `category`

## Unique Constraints

- `companyId, name`

## Entity Diagram

```mermaid
erDiagram
    Skill {
        int id PK
        int companyId
        string name
        string code
        string category
        string description
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    Company {
        int id PK
    }
    UserSkill {
        int id PK
    }
    TaskSkillRequirement {
        int id PK
    }
    Skill }|--|| Company : "company"
    Skill ||--o{ UserSkill : "userSkills"
    Skill ||--o{ TaskSkillRequirement : "taskRequirements"
```
