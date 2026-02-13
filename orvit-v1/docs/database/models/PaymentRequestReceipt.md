# PaymentRequestReceipt

> Table name: `payment_request_receipts`

**Schema location:** Lines 7407-7420

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `paymentRequestId` | `Int` | ✅ |  | `` |  |
| `receiptId` | `Int` | ✅ |  | `` |  |
| `montoSolicitado` | `Decimal` | ✅ |  | `` | DB: Decimal(15, 2) |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `paymentRequest` | [PaymentRequest](./models/PaymentRequest.md) | Many-to-One | paymentRequestId | id | Cascade |
| `receipt` | [PurchaseReceipt](./models/PurchaseReceipt.md) | Many-to-One | receiptId | id | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `paymentRequestReceipts` | Has many |
| [PaymentRequest](./models/PaymentRequest.md) | `facturas` | Has many |

## Indexes

- `paymentRequestId`
- `receiptId`

## Entity Diagram

```mermaid
erDiagram
    PaymentRequestReceipt {
        int id PK
        int paymentRequestId
        int receiptId
        decimal montoSolicitado
        datetime createdAt
    }
    PaymentRequest {
        int id PK
    }
    PurchaseReceipt {
        int id PK
    }
    PaymentRequestReceipt }|--|| PaymentRequest : "paymentRequest"
    PaymentRequestReceipt }|--|| PurchaseReceipt : "receipt"
```
