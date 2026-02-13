# ERD Overview

> High-level entity relationship diagram by category

## 🤖 AI

```mermaid
erDiagram
    AIConfig {
        int id PK
        int companyId
    }
    AssistantActionLog {
        int id PK
        int companyId
    }
    AssistantConversation {
        int id PK
        int companyId
    }
    AssistantEmbedding {
        int id PK
        int companyId
    }
    AssistantMessage {
        int id PK
    }
    DailyProductionEntry {
        int id PK
        int companyId
    }
    DailyProductionReport {
        int id PK
        int companyId
    }
    DailyProductionSession {
        int id PK
        string status
        int companyId
    }
    AssistantConversation ||--o{ AssistantMessage : "messages"
    AssistantMessage }|--|| AssistantConversation : "conversation"
    DailyProductionEntry }|--|| DailyProductionSession : "session"
    DailyProductionSession ||--o{ DailyProductionEntry : "entries"
```

## 🔐 Auth

```mermaid
erDiagram
    Role {
        int id PK
        string name
        int companyId
    }
    RolePermission {
        int id PK
    }
    Session {
        string id PK
    }
    User {
        int id PK
        string name
        string email
        string discordUserId
    }
    UserOnCompany {
        int id PK
        int companyId
    }
    UserPermission {
        int id PK
    }
    Role ||--o{ RolePermission : "permissions"
    Role ||--o{ UserOnCompany : "users"
    RolePermission }|--|| Role : "role"
    Session }|--|| User : "user"
    User ||--o{ UserOnCompany : "companies"
    User ||--o{ UserPermission : "grantedPermissions"
    User ||--o{ UserPermission : "userPermissions"
    User ||--o{ Session : "sessions"
    UserOnCompany }o--|| Role : "role"
    UserOnCompany }|--|| User : "user"
    UserPermission }o--|| User : "grantedBy"
    UserPermission }|--|| User : "user"
```

## ⚙️ Automation

```mermaid
erDiagram
    AutomationExecution {
        int id PK
        int companyId
    }
    AutomationRule {
        int id PK
        int companyId
        string name
    }
    AutomationExecution }|--|| AutomationRule : "rule"
    AutomationRule ||--o{ AutomationExecution : "executions"
```

## 💳 Billing

```mermaid
erDiagram
    BillingAuditLog {
        string id PK
    }
    BillingCoupon {
        string id PK
        string code
        string name
    }
    BillingCouponRedemption {
        string id PK
    }
    BillingInvoice {
        string id PK
        string number
    }
    BillingInvoiceItem {
        string id PK
    }
    Subscription {
        string id PK
        int userId
    }
    SubscriptionPlan {
        string id PK
        string name
    }
    BillingCoupon ||--o{ BillingCouponRedemption : "redemptions"
    BillingCoupon ||--o{ BillingInvoice : "invoices"
    BillingCouponRedemption }|--|| BillingCoupon : "coupon"
    BillingCouponRedemption }|--|| Subscription : "subscription"
    BillingCouponRedemption }o--|| BillingInvoice : "invoice"
    BillingInvoice }|--|| Subscription : "subscription"
    BillingInvoice ||--o{ BillingInvoiceItem : "items"
    BillingInvoice }o--|| BillingCoupon : "coupon"
    BillingInvoice ||--o{ BillingCouponRedemption : "couponRedemptions"
    BillingInvoiceItem }|--|| BillingInvoice : "invoice"
    Subscription }|--|| SubscriptionPlan : "plan"
    Subscription ||--o{ BillingInvoice : "invoices"
    Subscription ||--o{ BillingCouponRedemption : "couponRedemptions"
    SubscriptionPlan ||--o{ Subscription : "subscriptions"
```

## 🏢 Core

```mermaid
erDiagram
    Company {
        int id PK
        string name
        string cuit
    }
    CompanyModule {
        string id PK
        int companyId
    }
    CompanySettings {
        string id PK
        int companyId
    }
    CompanySettingsCosting {
        string id PK
        int companyId
    }
    CompanyTemplate {
        string id PK
        string name
    }
    CompanyViewConfig {
        string id PK
        int companyId
    }
    Company }o--|| CompanySettings : "settings"
    Company }o--|| CompanySettingsCosting : "CompanySettingsCosting"
    Company }o--|| CompanyViewConfig : "viewConfig"
    Company ||--o{ CompanyModule : "companyModules"
    Company }o--|| CompanyTemplate : "template"
    CompanyModule }|--|| Company : "company"
    CompanySettings }|--|| Company : "company"
    CompanySettingsCosting }|--|| Company : "Company"
    CompanyTemplate ||--o{ Company : "companies"
    CompanyViewConfig }|--|| Company : "company"
```

## 💰 Costs

> Too many models (36) for a single diagram. See individual model pages.

Models: `cost_distribution_config`, `CostCenter`, `CostEmployee`, `CostParam`, `CostProduct`, `CostSystemConfig`, `CostVarianceMonthly`, `employee_cost_distribution`, `indirect_cost_base`, `indirect_cost_categories`, `indirect_cost_change_history`, `indirect_cost_history`, `indirect_cost_monthly_records`, `indirect_costs`, `IndirectItem`, `IndirectItemAllocation`, `IndirectItemAllocationMonthly`, `IndirectPriceHistory`, `InputItem`, `InputPriceHistory`, `MonthlyCostConsolidation`, `MonthlyIndirect`, `MonthlyProduction`, `PayrollInput`, `ProductCostHistory`, `ProductCostLog`, `ProductionMethod`, `ProductStandardCost`, `Recipe`, `recipe_change_history`, `recipe_cost_tests`, `recipe_items`, `RecipeItem`, `recipes`, `TechnicianCostRate`, `ThirdPartyCost`

## 📊 Dashboard

```mermaid
erDiagram
    UserColorPreferences {
        int id PK
        int companyId
    }
    UserDashboardConfig {
        int id PK
        int companyId
        string name
    }
```

## 📎 Documents

```mermaid
erDiagram
    Document {
        int id PK
        string name
        int companyId
    }
    MOCDocument {
        int id PK
        string name
    }
```

## 💡 Ideas

```mermaid
erDiagram
    Idea {
        int id PK
        int companyId
    }
    IdeaComment {
        int id PK
    }
    IdeaVote {
        int id PK
    }
    Idea ||--o{ IdeaVote : "votes"
    Idea ||--o{ IdeaComment : "comments"
    IdeaComment }|--|| Idea : "idea"
    IdeaVote }|--|| Idea : "idea"
```

## 💬 Integrations

```mermaid
erDiagram
    UserDiscordAccess {
        int id PK
    }
```

## 🚛 Logistics

```mermaid
erDiagram
    KilometrajeLog {
        int id PK
        int companyId
    }
    TransportCompany {
        string id PK
        string name
        int companyId
    }
    Truck {
        int id PK
        string name
        int companyId
    }
    UnidadMovil {
        int id PK
        int companyId
    }
    ZoneAllocation {
        string id PK
        int companyId
    }
    ZoneAllocationMonthly {
        string id PK
        int companyId
    }
    KilometrajeLog }|--|| UnidadMovil : "unidadMovil"
    UnidadMovil ||--o{ KilometrajeLog : "kilometrajeLogs"
```

## 🔧 Maintenance

> Too many models (60) for a single diagram. See individual model pages.

Models: `ActivityEvent`, `checklist_executions`, `checklist_items`, `ChecklistExecution`, `ChecklistInstructive`, `ClientPortalActivity`, `Component`, `ComponentFailureMode`, `ComponentTool`, `CorrectiveChecklistTemplate`, `CorrectiveSettings`, `CounterMaintenanceTrigger`, `DowntimeLog`, `EmployeeSalaryComponent`, `Failure`, `FailureOccurrence`, `FailureOccurrenceComment`, `FailureOccurrenceEvent`, `FailureSolution`, `FailureWatcher`, `GremioCategoryTemplate`, `GremioTemplate`, `LOTOExecution`, `LOTOProcedure`, `Machine`, `machine_order_temp`, `MachineCounter`, `MachineCounterReading`, `MachineImportFile`, `MachineImportFileAnalysis`, `MachineImportJob`, `MachineOrder`, `maintenance_configs`, `maintenance_history`, `MaintenanceBudget`, `MaintenanceChecklist`, `MaintenanceCostBreakdown`, `PermitToWork`, `ProductionDowntime`, `ProductionQualityControl`, `ProductionRoutineTemplate`, `QualityAssurance`, `RootCauseAnalysis`, `SalaryComponent`, `SolutionApplication`, `SolutionApplied`, `SparePartReservation`, `SymptomLibrary`, `Template`, `ToolMachine`, `VoiceFailureLog`, `WorkOrder`, `WorkOrderAttachment`, `WorkOrderChecklist`, `WorkOrderComment`, `WorkOrderWatcher`, `WorkStation`, `WorkStationComponent`, `WorkStationInstructive`, `WorkStationMachine`

## 🔔 Notifications

```mermaid
erDiagram
    AgendaReminder {
        int id PK
        int companyId
    }
    ComprasNotification {
        int id PK
        int companyId
    }
    Notification {
        int id PK
        int companyId
    }
    NotificationOutbox {
        int id PK
        int companyId
    }
    NotificationPreferences {
        int id PK
        int companyId
    }
    Reminder {
        int id PK
    }
```

## 🏗️ Organization

```mermaid
erDiagram
    Area {
        int id PK
        string name
        int companyId
    }
    Line {
        string id PK
        string name
        int companyId
    }
    PlantZone {
        int id PK
        string name
        int companyId
    }
    Sector {
        int id PK
        string name
        int companyId
    }
    Zone {
        string id PK
        int companyId
        string name
    }
    Area ||--o{ Sector : "sectors"
    PlantZone }o--|| PlantZone : "parent"
    PlantZone ||--o{ PlantZone : "children"
    PlantZone }|--|| Sector : "sector"
    Sector }|--|| Area : "area"
    Sector ||--o{ PlantZone : "plantZones"
```

## 📁 Other

> Too many models (82) for a single diagram. See individual model pages.

Models: `AdvanceInstallment`, `AgendaTask`, `ApprovalAction`, `ApprovalDelegation`, `ApprovalInstance`, `ApprovalWorkflow`, `ApprovalWorkflowLevel`, `AttendanceEvent`, `AuditLog`, `BatchRun`, `BusinessSector`, `ChatMessage`, `ChatSession`, `Client`, `ClientPriceList`, `CompanyQuotationSettings`, `Contact`, `ContactInteraction`, `CreditDebitNoteItem`, `CreditNoteRequest`, `CreditNoteRequestItem`, `CuringRecord`, `Despacho`, `DespachoItem`, `DevolucionMaterial`, `DevolucionMaterialItem`, `DuplicateDetection`, `FactPnLMonthly`, `FactSalesMonthly`, `GeneralConfig`, `GlobalAllocation`, `GRNIAccrual`, `HistoryEvent`, `IntegrationConfig`, `InterventionKit`, `InventoryLot`, `LoginAttempt`, `LotInstallation`, `ManagementOfChange`, `MaterialRequest`, `MaterialRequestItem`, `MethodConversion`, `MethodProductYield`, `MOCHistory`, `MOCTask`, `Module`, `monthly_production`, `monthly_sales`, `Permission`, `PermissionAuditLog`, `PerUnitBOM`, `PrestressedMold`, `Project`, `QuotationStatusHistory`, `RateLimitEntry`, `RefreshToken`, `ReplenishmentSuggestion`, `SecurityEvent`, `SellerKPI`, `ServiceContract`, `ServiceContractAlert`, `Stock`, `StockLocation`, `StockMovement`, `StockReservation`, `Subtask`, `supplies`, `supply_monthly_prices`, `supply_price_history`, `SupplyCategory`, `TokenBlacklist`, `TokenTransaction`, `TrustedDevice`, `UnionCategory`, `UserTwoFactor`, `ViewModeLog`, `VoiceTaskLog`, `VolumetricParam`, `WorkCenter`, `WorkLog`, `WorkShift`, `YieldConfig`

## 💼 Payroll

> Too many models (24) for a single diagram. See individual model pages.

Models: `AgreementRate`, `CompanyHoliday`, `Employee`, `employee_distribution_config`, `employee_monthly_salaries`, `employee_salary_history_new`, `EmployeeCategory`, `EmployeeCompHistory`, `EmployeeFixedConcept`, `EmployeeSalaryHistory`, `Payroll`, `PayrollAuditLog`, `PayrollConfig`, `PayrollItem`, `PayrollItemLine`, `PayrollPeriod`, `PayrollRun`, `PayrollRunItem`, `PayrollRunItemLine`, `PayrollUnion`, `PayrollVariableConcept`, `SalaryAdvance`, `WorkPosition`, `WorkSector`

## 🌐 Portal

```mermaid
erDiagram
    ClientPortalAccess {
        int id PK
        string token
    }
    ClientPortalInvite {
        string id PK
        string token
        int companyId
    }
    ClientPortalOrder {
        string id PK
        int companyId
        string clientRequestId
    }
    ClientPortalOrderItem {
        string id PK
    }
    ClientPortalSession {
        string id PK
        int companyId
        string tokenHash
    }
    ClientPortalUser {
        string id PK
        string contactId
        int companyId
    }
    ClientPortalInvite }|--|| ClientPortalUser : "portalUser"
    ClientPortalOrder }|--|| ClientPortalUser : "createdByUser"
    ClientPortalOrder ||--o{ ClientPortalOrderItem : "items"
    ClientPortalOrderItem }|--|| ClientPortalOrder : "order"
    ClientPortalSession }|--|| ClientPortalUser : "portalUser"
    ClientPortalUser ||--o{ ClientPortalSession : "sessions"
    ClientPortalUser ||--o{ ClientPortalInvite : "invites"
    ClientPortalUser ||--o{ ClientPortalOrder : "orders"
```

## 📦 Products

```mermaid
erDiagram
    Category {
        int id PK
        string name
        int companyId
    }
    CategoryDefaultConcept {
        int id PK
    }
    Product {
        string id PK
        string name
        int companyId
    }
    product_categories {
        int id PK
        string name
    }
    product_subcategories {
        int id PK
        string name
    }
    ProductionBatchLot {
        int id PK
        int companyId
    }
    ProductionDefect {
        int id PK
        int companyId
    }
    ProductionEvent {
        int id PK
        int companyId
    }
    ProductionOrder {
        int id PK
        string status
        int companyId
    }
    ProductionReasonCode {
        int id PK
        string name
        int companyId
    }
    ProductionResource {
        int id PK
        string name
        string status
        int companyId
    }
    ProductionResourceType {
        int id PK
        string name
        int companyId
    }
    ProductionRoutine {
        int id PK
        string status
        int companyId
    }
    ProductionStockConfig {
        int id PK
        int companyId
    }
    products {
        int id PK
        string name
        string sku
    }
    ProductStockMovement {
        string id PK
        int companyId
    }
    ProductVariant {
        string id PK
        string productId
        string name
    }
    ProductWarranty {
        string id PK
        int companyId
    }
    Category }o--|| Category : "parent"
    Category ||--o{ Category : "children"
    Category ||--o{ Product : "products"
    Product }|--|| Category : "category"
    Product ||--o{ ProductStockMovement : "stockMovements"
    Product ||--o{ ProductWarranty : "warranties"
    ProductionBatchLot }|--|| ProductionOrder : "productionOrder"
    ProductionBatchLot ||--o{ ProductionDefect : "defects"
    ProductionDefect }o--|| ProductionOrder : "productionOrder"
    ProductionDefect }o--|| ProductionBatchLot : "batchLot"
    ProductionDefect }|--|| ProductionReasonCode : "reasonCode"
    ProductionEvent }o--|| ProductionOrder : "productionOrder"
    ProductionOrder ||--o{ ProductionBatchLot : "batchLots"
    ProductionOrder ||--o{ ProductionEvent : "events"
    ProductionOrder ||--o{ ProductionDefect : "defects"
    ProductionReasonCode }o--|| ProductionReasonCode : "parent"
    ProductionReasonCode ||--o{ ProductionReasonCode : "children"
    ProductionReasonCode ||--o{ ProductionDefect : "defects"
    ProductionResource }|--|| ProductionResourceType : "resourceType"
    ProductionResourceType ||--o{ ProductionResource : "resources"
    ProductStockMovement }|--|| Product : "product"
    ProductWarranty }|--|| Product : "product"
```

## 🛍️ Purchases

> Too many models (45) for a single diagram. See individual model pages.

Models: `CreditDebitNote`, `FactPurchasesMonthly`, `GoodsReceipt`, `GoodsReceiptItem`, `InventoryItemSupplier`, `MatchException`, `MatchExceptionHistory`, `MatchExceptionSLAConfig`, `MatchLineResult`, `MatchResult`, `PurchaseAccount`, `PurchaseAdvancedConfig`, `PurchaseApproval`, `PurchaseAuditLog`, `PurchaseComment`, `PurchaseConfig`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseQuotation`, `PurchaseQuotationItem`, `PurchaseReceipt`, `PurchaseReceiptItem`, `PurchaseRequest`, `PurchaseRequestItem`, `PurchaseReturn`, `PurchaseReturnItem`, `RecurringPurchaseHistory`, `RecurringPurchaseItem`, `RecurringPurchaseOrder`, `SoDRule`, `SoDViolation`, `StockAdjustment`, `StockAdjustmentItem`, `StockTransfer`, `StockTransferItem`, `SupplierAccountMovement`, `SupplierChangeRequest`, `SupplierCreditAllocation`, `SupplierItem`, `SupplierItemAlias`, `SupplierLeadTime`, `suppliers`, `UserWarehouseScope`, `VoicePurchaseLog`, `Warehouse`

## 🛒 Sales

> Too many models (53) for a single diagram. See individual model pages.

Models: `AcopioRetiro`, `AcopioRetiroItem`, `ClientBalanceSnapshot`, `ClientBlockHistory`, `ClientContact`, `ClientDiscount`, `ClientLedgerEntry`, `ClientNote`, `ClientType`, `CollectionAttempt`, `DeliveryZone`, `DiscountList`, `DiscountListProduct`, `DiscountListRubro`, `InvoicePaymentAllocation`, `Load`, `LoadItem`, `LoadOrder`, `LoadOrderItem`, `PriceComparison`, `PriceComparisonCompetitor`, `PriceComparisonProductPrice`, `PriceHistory`, `Quote`, `QuoteAcceptance`, `QuoteAttachment`, `QuoteItem`, `QuoteVersion`, `Sale`, `SaleAcopio`, `SaleAcopioItem`, `SaleDelivery`, `SaleDeliveryEvidence`, `SaleDeliveryItem`, `SaleItem`, `SaleRemito`, `SaleRemitoItem`, `SaleRMA`, `SaleRMAHistory`, `SaleRMAItem`, `SalesApproval`, `SalesAuditLog`, `SalesConfig`, `SalesCreditDebitNote`, `SalesCreditDebitNoteItem`, `SalesGoal`, `SalesGoalProgress`, `SalesInvoice`, `SalesInvoiceItem`, `SalesPerformanceDashboard`, `SalesPriceList`, `SalesPriceListItem`, `SalesPriceLog`

## 📋 Tasks

```mermaid
erDiagram
    FixedTask {
        int id PK
        int companyId
    }
    FixedTaskExecution {
        int id PK
        string status
    }
    FixedTaskInstructive {
        int id PK
    }
    Task {
        int id PK
        int companyId
    }
    TaskAttachment {
        int id PK
        string name
    }
    TaskComment {
        int id PK
    }
    TaskSkillRequirement {
        int id PK
        int companyId
    }
    FixedTask ||--o{ FixedTaskExecution : "executions"
    FixedTask ||--o{ FixedTaskInstructive : "instructives"
    FixedTaskExecution }|--|| FixedTask : "fixedTask"
    FixedTaskInstructive }|--|| FixedTask : "fixedTask"
    Task ||--o{ TaskAttachment : "attachments"
    Task ||--o{ TaskComment : "comments"
    TaskAttachment }|--|| Task : "task"
    TaskComment }|--|| Task : "task"
```

## 📑 Tax

```mermaid
erDiagram
    Control {
        int id PK
        string name
        int companyId
    }
    TaxBase {
        int id PK
        string name
        int companyId
    }
    TaxRecord {
        int id PK
    }
    TaxBase ||--o{ TaxRecord : "taxRecords"
    TaxRecord }|--|| TaxBase : "taxBase"
```

## 🔨 Tools

```mermaid
erDiagram
    SectorTool {
        int id PK
    }
    Tool {
        int id PK
        string name
        string code
        int companyId
    }
    ToolLoan {
        int id PK
    }
    ToolMovement {
        int id PK
    }
    ToolRequest {
        int id PK
        string status
        int companyId
    }
    SectorTool }|--|| Tool : "tool"
    Tool ||--o{ SectorTool : "sectorTools"
    Tool ||--o{ ToolLoan : "loans"
    Tool ||--o{ ToolMovement : "movements"
    ToolLoan }|--|| Tool : "tool"
    ToolMovement }|--|| Tool : "tool"
```

## 🏦 Treasury

> Too many models (23) for a single diagram. See individual model pages.

Models: `BankAccount`, `BankMovement`, `BankStatement`, `BankStatementItem`, `BillingAutoPaymentConfig`, `BillingPayment`, `CashAccount`, `CashMovement`, `Cheque`, `ClientPayment`, `ClientPaymentCheque`, `IdempotencyKey`, `PaymentOrder`, `PaymentOrderAttachment`, `PaymentOrderCheque`, `PaymentOrderReceipt`, `PaymentRequest`, `PaymentRequestLog`, `PaymentRequestReceipt`, `ServicePayment`, `TreasuryConfig`, `TreasuryMovement`, `TreasuryTransfer`

## 👷 Workers

```mermaid
erDiagram
    Skill {
        int id PK
        int companyId
        string name
    }
    UserCertification {
        int id PK
        int companyId
        string name
    }
    UserSkill {
        int id PK
    }
    Worker {
        int id PK
        string name
        int companyId
    }
    Skill ||--o{ UserSkill : "userSkills"
    UserSkill }|--|| Skill : "skill"
```

