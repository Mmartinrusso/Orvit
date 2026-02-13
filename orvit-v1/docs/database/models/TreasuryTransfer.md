# TreasuryTransfer

> Table name: `treasury_transfers`

**Schema location:** Lines 10896-10942

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `companyId` | `Int` | ✅ |  | `` |  |
| `numero` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `origenCajaId` | `Int?` | ❌ |  | `` | Origen (uno de los dos) |
| `origenBancoId` | `Int?` | ❌ |  | `` |  |
| `destinoCajaId` | `Int?` | ❌ |  | `` | Destino (uno de los dos) |
| `destinoBancoId` | `Int?` | ❌ |  | `` |  |
| `importe` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2). Monto |
| `moneda` | `String` | ✅ |  | `"ARS"` | DB: VarChar(3) |
| `fecha` | `DateTime` | ✅ |  | `` | DB: Date. Fechas |
| `descripcion` | `String?` | ❌ |  | `` |  |
| `createdBy` | `Int` | ✅ |  | `` | Auditoría |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `estado` | [TreasuryTransferStatus](./models/TreasuryTransferStatus.md) | Many-to-One | - | - | - |
| `docType` | [DocType](./models/DocType.md) | Many-to-One | - | - | - |
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `createdByUser` | [User](./models/User.md) | Many-to-One | createdBy | id | - |
| `origenCaja` | [CashAccount](./models/CashAccount.md) | Many-to-One (optional) | origenCajaId | id | - |
| `origenBanco` | [BankAccount](./models/BankAccount.md) | Many-to-One (optional) | origenBancoId | id | - |
| `destinoCaja` | [CashAccount](./models/CashAccount.md) | Many-to-One (optional) | destinoCajaId | id | - |
| `destinoBanco` | [BankAccount](./models/BankAccount.md) | Many-to-One (optional) | destinoBancoId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `treasuryTransfers` | Has many |
| [User](./models/User.md) | `treasuryTransfersCreated` | Has many |
| [CashAccount](./models/CashAccount.md) | `transfersOut` | Has many |
| [CashAccount](./models/CashAccount.md) | `transfersIn` | Has many |
| [BankAccount](./models/BankAccount.md) | `transfersOut` | Has many |
| [BankAccount](./models/BankAccount.md) | `transfersIn` | Has many |

## Indexes

- `companyId`
- `fecha`
- `estado`
- `docType`

## Unique Constraints

- `companyId, numero`

## Entity Diagram

```mermaid
erDiagram
    TreasuryTransfer {
        int id PK
        int companyId
        string numero
        int origenCajaId
        int origenBancoId
        int destinoCajaId
        int destinoBancoId
        decimal importe
        string moneda
        datetime fecha
        string descripcion
        int createdBy
        datetime createdAt
        datetime updatedAt
    }
    Company {
        int id PK
    }
    User {
        int id PK
    }
    CashAccount {
        int id PK
    }
    BankAccount {
        int id PK
    }
    TreasuryTransfer }|--|| TreasuryTransferStatus : "estado"
    TreasuryTransfer }|--|| DocType : "docType"
    TreasuryTransfer }|--|| Company : "company"
    TreasuryTransfer }|--|| User : "createdByUser"
    TreasuryTransfer }o--|| CashAccount : "origenCaja"
    TreasuryTransfer }o--|| BankAccount : "origenBanco"
    TreasuryTransfer }o--|| CashAccount : "destinoCaja"
    TreasuryTransfer }o--|| BankAccount : "destinoBanco"
```
