# VoiceFailureLog

> Table name: `voice_failure_logs`

**Schema location:** Lines 14242-14289

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `userId` | `Int` | ✅ |  | `` |  |
| `discordUserId` | `String` | ✅ |  | `` |  |
| `discordMessageId` | `String` | ✅ | ✅ | `` | Idempotencia nivel 1 |
| `discordAttachmentId` | `String?` | ❌ |  | `` | Idempotencia nivel 2 |
| `discordChannelId` | `String?` | ❌ |  | `` |  |
| `audioUrl` | `String?` | ❌ |  | `` | URL de Discord (expira) |
| `audioHash` | `String?` | ❌ |  | `` | SHA256 - Idempotencia nivel 3 |
| `audioSize` | `Int?` | ❌ |  | `` |  |
| `mimeType` | `String?` | ❌ |  | `` | DB: VarChar(50) |
| `transcript` | `String?` | ❌ |  | `` | DB: Text. Pipeline de IA |
| `extractedData` | `Json?` | ❌ |  | `` | JSON completo extraído por GPT |
| `confidence` | `Int?` | ❌ |  | `` | 0-100 |
| `machineMatchedId` | `Int?` | ❌ |  | `` | Máquina identificada (o null si clarificación) |
| `status` | `String` | ✅ |  | `"PENDING"` | PENDING → QUEUED → PROCESSING → COMPLETED/FAILED/CLARIFICATION_NEEDED |
| `errorMessage` | `String?` | ❌ |  | `` |  |
| `retryCount` | `Int` | ✅ |  | `0` |  |
| `failureOccurrenceId` | `Int?` | ❌ | ✅ | `` | Resultado |
| `createdAt` | `DateTime` | ✅ |  | `now(` | Timestamps |
| `queuedAt` | `DateTime?` | ❌ |  | `` |  |
| `processingStartedAt` | `DateTime?` | ❌ |  | `` |  |
| `processedAt` | `DateTime?` | ❌ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `user` | [User](./models/User.md) | Many-to-One | userId | id | - |
| `failureOccurrence` | [FailureOccurrence](./models/FailureOccurrence.md) | Many-to-One (optional) | failureOccurrenceId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `voiceFailureLogs` | Has many |
| [User](./models/User.md) | `voiceFailureLogs` | Has many |
| [FailureOccurrence](./models/FailureOccurrence.md) | `voiceFailureLog` | Has one |

## Indexes

- `discordMessageId`
- `audioHash`
- `status`
- `companyId`
- `userId`

## Entity Diagram

```mermaid
erDiagram
    VoiceFailureLog {
        int id PK
        int companyId
        int userId
        string discordUserId
        string discordMessageId UK
        string discordAttachmentId
        string discordChannelId
        string audioUrl
        string audioHash
        int audioSize
        string mimeType
        string transcript
        json extractedData
        int confidence
        int machineMatchedId
        string _more_fields
    }
    Company {
        int id PK
    }
    User {
        int id PK
    }
    FailureOccurrence {
        int id PK
    }
    VoiceFailureLog }|--|| Company : "company"
    VoiceFailureLog }|--|| User : "user"
    VoiceFailureLog }o--|| FailureOccurrence : "failureOccurrence"
```
