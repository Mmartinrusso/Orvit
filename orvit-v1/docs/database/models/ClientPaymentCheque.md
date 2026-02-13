# ClientPaymentCheque

> Table name: `client_payment_cheques`

**Schema location:** Lines 9828-9846

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `paymentId` | `Int` | ✅ |  | `` |  |
| `tipo` | `String` | ✅ |  | `` | DB: VarChar(20) |
| `numero` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `banco` | `String?` | ❌ |  | `` | DB: VarChar(100) |
| `titular` | `String?` | ❌ |  | `` | DB: VarChar(255) |
| `cuit` | `String?` | ❌ |  | `` | DB: VarChar(20) |
| `fechaEmision` | `DateTime?` | ❌ |  | `` | DB: Date |
| `fechaVencimiento` | `DateTime?` | ❌ |  | `` | DB: Date |
| `importe` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `estado` | [ChequeStatus](./models/ChequeStatus.md) | Many-to-One | - | - | - |
| `payment` | [ClientPayment](./models/ClientPayment.md) | Many-to-One | paymentId | id | Cascade |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [ClientPayment](./models/ClientPayment.md) | `cheques` | Has many |

## Indexes

- `paymentId`
- `estado`

## Entity Diagram

```mermaid
erDiagram
    ClientPaymentCheque {
        int id PK
        int paymentId
        string tipo
        string numero
        string banco
        string titular
        string cuit
        datetime fechaEmision
        datetime fechaVencimiento
        decimal importe
    }
    ClientPayment {
        int id PK
    }
    ClientPaymentCheque }|--|| ChequeStatus : "estado"
    ClientPaymentCheque }|--|| ClientPayment : "payment"
```
