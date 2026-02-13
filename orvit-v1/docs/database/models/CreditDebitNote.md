# CreditDebitNote

> Table name: `credit_debit_notes`

**Schema location:** Lines 6744-6803

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `numero` | `String` | ✅ |  | `` | DB: VarChar(50) |
| `numeroSerie` | `String` | ✅ |  | `` | DB: VarChar(20) |
| `proveedorId` | `Int` | ✅ |  | `` |  |
| `facturaId` | `Int?` | ❌ |  | `` | Factura de referencia |
| `goodsReceiptId` | `Int?` | ❌ |  | `` | Recepción de referencia (para devoluciones) |
| `fechaEmision` | `DateTime` | ✅ |  | `` | DB: Date |
| `motivo` | `String` | ✅ |  | `` |  |
| `neto` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2). Montos |
| `iva21` | `Decimal` | ✅ |  | `0` | DB: Decimal(15, 2) |
| `iva105` | `Decimal` | ✅ |  | `0` | DB: Decimal(15, 2) |
| `iva27` | `Decimal` | ✅ |  | `0` | DB: Decimal(15, 2) |
| `total` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `aplicada` | `Boolean` | ✅ |  | `false` |  |
| `aplicadaAt` | `DateTime?` | ❌ |  | `` |  |
| `cae` | `String?` | ❌ |  | `` | DB: VarChar(20). CAE/CAI |
| `fechaVtoCae` | `DateTime?` | ❌ |  | `` | DB: Date |
| `notas` | `String?` | ❌ |  | `` | Tracking |
| `requestId` | `Int?` | ❌ |  | `` | Vinculación a solicitud de NCA |
| `purchaseReturnId` | `Int?` | ❌ |  | `` | Vinculación a devolución física (si aplica) |
| `companyId` | `Int` | ✅ |  | `` |  |
| `createdBy` | `Int` | ✅ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `proveedor` | `suppliers` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `tipo` | [CreditDebitNoteType](./models/CreditDebitNoteType.md) | Many-to-One | - | - | - |
| `estado` | [CreditDebitNoteStatus](./models/CreditDebitNoteStatus.md) | Many-to-One | - | - | - |
| `tipoNca` | [CreditNoteType](./models/CreditNoteType.md) | Many-to-One | - | - | - |
| `docType` | [DocType](./models/DocType.md) | Many-to-One | - | - | - |
| `factura` | [PurchaseReceipt](./models/PurchaseReceipt.md) | Many-to-One (optional) | facturaId | id | - |
| `company` | [Company](./models/Company.md) | Many-to-One | companyId | id | Cascade |
| `createdByUser` | [User](./models/User.md) | Many-to-One | createdBy | id | - |
| `items` | [CreditDebitNoteItem](./models/CreditDebitNoteItem.md) | One-to-Many | - | - | - |
| `accountMovements` | [SupplierAccountMovement](./models/SupplierAccountMovement.md) | One-to-Many | - | - | - |
| `request` | [CreditNoteRequest](./models/CreditNoteRequest.md) | Many-to-One (optional) | requestId | id | - |
| `purchaseReturn` | [PurchaseReturn](./models/PurchaseReturn.md) | Many-to-One (optional) | purchaseReturnId | id | - |
| `creditAllocations` | [SupplierCreditAllocation](./models/SupplierCreditAllocation.md) | One-to-Many | - | - | - |
| `debitAllocations` | [SupplierCreditAllocation](./models/SupplierCreditAllocation.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `creditDebitNotes` | Has many |
| [User](./models/User.md) | `creditDebitNotesCreated` | Has many |
| [suppliers](./models/suppliers.md) | `creditDebitNotes` | Has many |
| [SupplierAccountMovement](./models/SupplierAccountMovement.md) | `notaCreditoDebito` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `creditDebitNotes` | Has many |
| [SupplierCreditAllocation](./models/SupplierCreditAllocation.md) | `creditNote` | Has one |
| [SupplierCreditAllocation](./models/SupplierCreditAllocation.md) | `targetDebitNote` | Has one |
| [CreditDebitNoteItem](./models/CreditDebitNoteItem.md) | `note` | Has one |
| [CreditNoteRequest](./models/CreditNoteRequest.md) | `creditNotes` | Has many |
| [PurchaseReturn](./models/PurchaseReturn.md) | `creditNotes` | Has many |

## Indexes

- `companyId`
- `proveedorId`
- `facturaId`
- `tipo`
- `estado`
- `docType`
- `companyId, docType`

## Entity Diagram

```mermaid
erDiagram
    CreditDebitNote {
        int id PK
        string numero
        string numeroSerie
        int proveedorId
        int facturaId
        int goodsReceiptId
        datetime fechaEmision
        string motivo
        decimal neto
        decimal iva21
        decimal iva105
        decimal iva27
        decimal total
        boolean aplicada
        datetime aplicadaAt
        string _more_fields
    }
    PurchaseReceipt {
        int id PK
    }
    Company {
        int id PK
    }
    User {
        int id PK
    }
    CreditDebitNoteItem {
        int id PK
    }
    SupplierAccountMovement {
        int id PK
    }
    CreditNoteRequest {
        int id PK
    }
    PurchaseReturn {
        int id PK
    }
    SupplierCreditAllocation {
        int id PK
    }
    suppliers {
        int id PK
    }
    CreditDebitNote }|--|| CreditDebitNoteType : "tipo"
    CreditDebitNote }|--|| CreditDebitNoteStatus : "estado"
    CreditDebitNote }|--|| CreditNoteType : "tipoNca"
    CreditDebitNote }|--|| DocType : "docType"
    CreditDebitNote }o--|| PurchaseReceipt : "factura"
    CreditDebitNote }|--|| Company : "company"
    CreditDebitNote }|--|| User : "createdByUser"
    CreditDebitNote ||--o{ CreditDebitNoteItem : "items"
    CreditDebitNote ||--o{ SupplierAccountMovement : "accountMovements"
    CreditDebitNote }o--|| CreditNoteRequest : "request"
    CreditDebitNote }o--|| PurchaseReturn : "purchaseReturn"
    CreditDebitNote ||--o{ SupplierCreditAllocation : "creditAllocations"
    CreditDebitNote ||--o{ SupplierCreditAllocation : "debitAllocations"
```
