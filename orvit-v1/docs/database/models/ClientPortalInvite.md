# ClientPortalInvite

> Table name: `client_portal_invites`

**Schema location:** Lines 8960-8983

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `String` | ✅ | 🔑 PK | `cuid(` |  |
| `token` | `String` | ✅ | ✅ | `` | DB: VarChar(100) |
| `portalUserId` | `String` | ✅ |  | `` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `expiresAt` | `DateTime` | ✅ |  | `` | Vigencia |
| `usedAt` | `DateTime?` | ❌ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` | Tracking |
| `createdBy` | `Int` | ✅ |  | `` |  |
| `sentVia` | `String?` | ❌ |  | `` | DB: VarChar(20) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `portalUser` | [ClientPortalUser](./models/ClientPortalUser.md) | Many-to-One | portalUserId | id | Cascade |
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `clientPortalInvites` | Has many |
| [ClientPortalUser](./models/ClientPortalUser.md) | `invites` | Has many |

## Indexes

- `token`
- `portalUserId`
- `expiresAt`

## Entity Diagram

```mermaid
erDiagram
    ClientPortalInvite {
        string id PK
        string token UK
        string portalUserId
        int companyId
        datetime expiresAt
        datetime usedAt
        datetime createdAt
        int createdBy
        string sentVia
    }
    ClientPortalUser {
        string id PK
    }
    Company {
        int id PK
    }
    ClientPortalInvite }|--|| ClientPortalUser : "portalUser"
    ClientPortalInvite }|--|| Company : "company"
```
