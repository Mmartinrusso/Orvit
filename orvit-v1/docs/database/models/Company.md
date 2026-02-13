# Company

> Table name: `Company`

**Schema location:** Lines 11-330

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `name` | `String` | ✅ |  | `` |  |
| `cuit` | `String?` | ❌ | ✅ | `` |  |
| `logo` | `String?` | ❌ |  | `` |  |
| `address` | `String?` | ❌ |  | `` |  |
| `phone` | `String?` | ❌ |  | `` |  |
| `email` | `String?` | ❌ |  | `` |  |
| `website` | `String?` | ❌ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `logoDark` | `String?` | ❌ |  | `` |  |
| `logoLight` | `String?` | ❌ |  | `` |  |
| `employee_monthly_salaries` | `employee_monthly_salaries[]` | ✅ |  | `` |  |
| `maintenance_configs` | `maintenance_configs[]` | ✅ |  | `` |  |
| `products_lowercase` | `products[]` | ✅ |  | `` |  |
| `recipe_change_history` | `recipe_change_history[]` | ✅ |  | `` |  |
| `recipe_cost_tests` | `recipe_cost_tests[]` | ✅ |  | `` |  |
| `recipe_items` | `recipe_items[]` | ✅ |  | `` |  |
| `recipes_new` | `recipes[]` | ✅ |  | `` |  |
| `suppliers` | `suppliers[]` | ✅ |  | `` |  |
| `supplies` | `supplies[]` | ✅ |  | `` |  |
| `supply_monthly_prices` | `supply_monthly_prices[]` | ✅ |  | `` |  |
| `supply_price_history` | `supply_price_history[]` | ✅ |  | `` |  |
| `subscriptionId` | `String?` | ❌ |  | `` | Sistema de Billing (SaaS) |
| `primaryAdminId` | `Int?` | ❌ |  | `` |  |
| `templateId` | `String?` | ❌ |  | `` |  |
| `isActive` | `Boolean` | ✅ |  | `true` |  |
| `discordBotToken` | `String?` | ❌ |  | `` | Token del bot de Discord (encriptado) |
| `discordGuildId` | `String?` | ❌ |  | `` | ID del servidor de Discord |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `areas` | [Area](./models/Area.md) | One-to-Many | - | - | - |
| `categories` | [Category](./models/Category.md) | One-to-Many | - | - | - |
| `clients` | [Client](./models/Client.md) | One-to-Many | - | - | - |
| `clientTypes` | [ClientType](./models/ClientType.md) | One-to-Many | - | - | - |
| `deliveryZones` | [DeliveryZone](./models/DeliveryZone.md) | One-to-Many | - | - | - |
| `transportCompanies` | [TransportCompany](./models/TransportCompany.md) | One-to-Many | - | - | - |
| `businessSectors` | [BusinessSector](./models/BusinessSector.md) | One-to-Many | - | - | - |
| `settings` | [CompanySettings](./models/CompanySettings.md) | Many-to-One (optional) | - | - | - |
| `CompanySettingsCosting` | [CompanySettingsCosting](./models/CompanySettingsCosting.md) | Many-to-One (optional) | - | - | - |
| `costEmployees` | [CostEmployee](./models/CostEmployee.md) | One-to-Many | - | - | - |
| `costProducts` | [CostProduct](./models/CostProduct.md) | One-to-Many | - | - | - |
| `CostVarianceMonthly` | [CostVarianceMonthly](./models/CostVarianceMonthly.md) | One-to-Many | - | - | - |
| `documents` | [Document](./models/Document.md) | One-to-Many | - | - | - |
| `FactPnLMonthly` | [FactPnLMonthly](./models/FactPnLMonthly.md) | One-to-Many | - | - | - |
| `FactPurchasesMonthly` | [FactPurchasesMonthly](./models/FactPurchasesMonthly.md) | One-to-Many | - | - | - |
| `FactSalesMonthly` | [FactSalesMonthly](./models/FactSalesMonthly.md) | One-to-Many | - | - | - |
| `fixedTasks` | [FixedTask](./models/FixedTask.md) | One-to-Many | - | - | - |
| `indirectItems` | [IndirectItem](./models/IndirectItem.md) | One-to-Many | - | - | - |
| `inputItems` | [InputItem](./models/InputItem.md) | One-to-Many | - | - | - |
| `lines` | [Line](./models/Line.md) | One-to-Many | - | - | - |
| `loads` | [Load](./models/Load.md) | One-to-Many | - | - | - |
| `machines` | [Machine](./models/Machine.md) | One-to-Many | - | - | - |
| `monthlyIndirects` | [MonthlyIndirect](./models/MonthlyIndirect.md) | One-to-Many | - | - | - |
| `monthlyProductions` | [MonthlyProduction](./models/MonthlyProduction.md) | One-to-Many | - | - | - |
| `notifications` | [Notification](./models/Notification.md) | One-to-Many | - | - | - |
| `notificationPreferences` | [NotificationPreferences](./models/NotificationPreferences.md) | One-to-Many | - | - | - |
| `priceComparisons` | [PriceComparison](./models/PriceComparison.md) | One-to-Many | - | - | - |
| `products` | [Product](./models/Product.md) | One-to-Many | - | - | - |
| `productCostHistories` | [ProductCostHistory](./models/ProductCostHistory.md) | One-to-Many | - | - | - |
| `productCostLogs` | [ProductCostLog](./models/ProductCostLog.md) | One-to-Many | - | - | - |
| `salesPriceLogs` | [SalesPriceLog](./models/SalesPriceLog.md) | One-to-Many | - | - | - |
| `productStockMovements` | [ProductStockMovement](./models/ProductStockMovement.md) | One-to-Many | - | - | - |
| `ProductStandardCost` | [ProductStandardCost](./models/ProductStandardCost.md) | One-to-Many | - | - | - |
| `ProductionMethod` | [ProductionMethod](./models/ProductionMethod.md) | One-to-Many | - | - | - |
| `purchaseAccounts` | [PurchaseAccount](./models/PurchaseAccount.md) | One-to-Many | - | - | - |
| `purchaseReceipts` | [PurchaseReceipt](./models/PurchaseReceipt.md) | One-to-Many | - | - | - |
| `recipes` | [Recipe](./models/Recipe.md) | One-to-Many | - | - | - |
| `roles` | [Role](./models/Role.md) | One-to-Many | - | - | - |
| `sectors` | [Sector](./models/Sector.md) | One-to-Many | - | - | - |
| `tasks` | [Task](./models/Task.md) | One-to-Many | - | - | - |
| `taxBases` | [TaxBase](./models/TaxBase.md) | One-to-Many | - | - | - |
| `controls` | [Control](./models/Control.md) | One-to-Many | - | - | - |
| `tools` | [Tool](./models/Tool.md) | One-to-Many | - | - | - |
| `toolRequests` | [ToolRequest](./models/ToolRequest.md) | One-to-Many | - | - | - |
| `trucks` | [Truck](./models/Truck.md) | One-to-Many | - | - | - |
| `unidadesMoviles` | [UnidadMovil](./models/UnidadMovil.md) | One-to-Many | - | - | - |
| `kilometrajeLogs` | [KilometrajeLog](./models/KilometrajeLog.md) | One-to-Many | - | - | - |
| `users` | [UserOnCompany](./models/UserOnCompany.md) | One-to-Many | - | - | - |
| `workStations` | [WorkStation](./models/WorkStation.md) | One-to-Many | - | - | - |
| `workers` | [Worker](./models/Worker.md) | One-to-Many | - | - | - |
| `Zone` | [Zone](./models/Zone.md) | One-to-Many | - | - | - |
| `plantZones` | [PlantZone](./models/PlantZone.md) | One-to-Many | - | - | - |
| `employee_categories` | [EmployeeCategory](./models/EmployeeCategory.md) | One-to-Many | - | - | - |
| `employee_salary_history` | [EmployeeSalaryHistory](./models/EmployeeSalaryHistory.md) | One-to-Many | - | - | - |
| `employees` | [Employee](./models/Employee.md) | One-to-Many | - | - | - |
| `machineOrder` | [MachineOrder](./models/MachineOrder.md) | One-to-Many | - | - | - |
| `maintenanceChecklists` | [MaintenanceChecklist](./models/MaintenanceChecklist.md) | One-to-Many | - | - | - |
| `workOrders` | [WorkOrder](./models/WorkOrder.md) | One-to-Many | - | - | - |
| `paymentOrders` | [PaymentOrder](./models/PaymentOrder.md) | One-to-Many | - | - | - |
| `ownedByUsers` | [User](./models/User.md) | One-to-Many | - | - | - |
| `userDashboardConfigs` | [UserDashboardConfig](./models/UserDashboardConfig.md) | One-to-Many | - | - | - |
| `userColorPreferences` | [UserColorPreferences](./models/UserColorPreferences.md) | One-to-Many | - | - | - |
| `symptomLibrary` | [SymptomLibrary](./models/SymptomLibrary.md) | One-to-Many | - | - | - |
| `downtimeLogs` | [DowntimeLog](./models/DowntimeLog.md) | One-to-Many | - | - | - |
| `templates` | [Template](./models/Template.md) | One-to-Many | - | - | - |
| `solutionsApplied` | [SolutionApplied](./models/SolutionApplied.md) | One-to-Many | - | - | - |
| `correctiveSettings` | [CorrectiveSettings](./models/CorrectiveSettings.md) | Many-to-One (optional) | - | - | - |
| `occurrenceEvents` | [FailureOccurrenceEvent](./models/FailureOccurrenceEvent.md) | One-to-Many | - | - | - |
| `activityEvents` | [ActivityEvent](./models/ActivityEvent.md) | One-to-Many | - | - | - |
| `rootCauseAnalyses` | [RootCauseAnalysis](./models/RootCauseAnalysis.md) | One-to-Many | - | - | - |
| `correctiveChecklistTemplates` | [CorrectiveChecklistTemplate](./models/CorrectiveChecklistTemplate.md) | One-to-Many | - | - | - |
| `workOrderChecklists` | [WorkOrderChecklist](./models/WorkOrderChecklist.md) | One-to-Many | - | - | - |
| `assistantEmbeddings` | [AssistantEmbedding](./models/AssistantEmbedding.md) | One-to-Many | - | - | - |
| `assistantConversations` | [AssistantConversation](./models/AssistantConversation.md) | One-to-Many | - | - | - |
| `assistantActionLogs` | [AssistantActionLog](./models/AssistantActionLog.md) | One-to-Many | - | - | - |
| `warehouses` | [Warehouse](./models/Warehouse.md) | One-to-Many | - | - | - |
| `purchaseOrders` | [PurchaseOrder](./models/PurchaseOrder.md) | One-to-Many | - | - | - |
| `goodsReceipts` | [GoodsReceipt](./models/GoodsReceipt.md) | One-to-Many | - | - | - |
| `creditDebitNotes` | [CreditDebitNote](./models/CreditDebitNote.md) | One-to-Many | - | - | - |
| `creditNoteRequests` | [CreditNoteRequest](./models/CreditNoteRequest.md) | One-to-Many | - | - | - |
| `costCenters` | [CostCenter](./models/CostCenter.md) | One-to-Many | - | - | - |
| `projects` | [Project](./models/Project.md) | One-to-Many | - | - | - |
| `paymentRequests` | [PaymentRequest](./models/PaymentRequest.md) | One-to-Many | - | - | - |
| `purchaseReturns` | [PurchaseReturn](./models/PurchaseReturn.md) | One-to-Many | - | - | - |
| `supplierAccountMovements` | [SupplierAccountMovement](./models/SupplierAccountMovement.md) | One-to-Many | - | - | - |
| `matchExceptionSLAConfigs` | [MatchExceptionSLAConfig](./models/MatchExceptionSLAConfig.md) | One-to-Many | - | - | - |
| `notificationOutbox` | [NotificationOutbox](./models/NotificationOutbox.md) | One-to-Many | - | - | - |
| `sodRules` | [SoDRule](./models/SoDRule.md) | One-to-Many | - | - | - |
| `sodViolations` | [SoDViolation](./models/SoDViolation.md) | One-to-Many | - | - | - |
| `stockTransfers` | [StockTransfer](./models/StockTransfer.md) | One-to-Many | - | - | - |
| `stockAdjustments` | [StockAdjustment](./models/StockAdjustment.md) | One-to-Many | - | - | - |
| `purchaseRequests` | [PurchaseRequest](./models/PurchaseRequest.md) | One-to-Many | - | - | - |
| `purchaseQuotations` | [PurchaseQuotation](./models/PurchaseQuotation.md) | One-to-Many | - | - | - |
| `purchaseComments` | [PurchaseComment](./models/PurchaseComment.md) | One-to-Many | - | - | - |
| `quotationSettings` | [CompanyQuotationSettings](./models/CompanyQuotationSettings.md) | Many-to-One (optional) | - | - | - |
| `supplierChangeRequests` | [SupplierChangeRequest](./models/SupplierChangeRequest.md) | One-to-Many | - | - | - |
| `viewConfig` | [CompanyViewConfig](./models/CompanyViewConfig.md) | Many-to-One (optional) | - | - | - |
| `salesConfig` | [SalesConfig](./models/SalesConfig.md) | Many-to-One (optional) | - | - | - |
| `purchaseConfig` | [PurchaseConfig](./models/PurchaseConfig.md) | Many-to-One (optional) | - | - | - |
| `purchaseAdvancedConfig` | [PurchaseAdvancedConfig](./models/PurchaseAdvancedConfig.md) | Many-to-One (optional) | - | - | - |
| `treasuryConfig` | [TreasuryConfig](./models/TreasuryConfig.md) | Many-to-One (optional) | - | - | - |
| `generalConfig` | [GeneralConfig](./models/GeneralConfig.md) | Many-to-One (optional) | - | - | - |
| `integrationConfig` | [IntegrationConfig](./models/IntegrationConfig.md) | Many-to-One (optional) | - | - | - |
| `aiConfig` | [AIConfig](./models/AIConfig.md) | Many-to-One (optional) | - | - | - |
| `quotes` | [Quote](./models/Quote.md) | One-to-Many | - | - | - |
| `sales` | [Sale](./models/Sale.md) | One-to-Many | - | - | - |
| `saleDeliveries` | [SaleDelivery](./models/SaleDelivery.md) | One-to-Many | - | - | - |
| `saleRemitos` | [SaleRemito](./models/SaleRemito.md) | One-to-Many | - | - | - |
| `salesInvoices` | [SalesInvoice](./models/SalesInvoice.md) | One-to-Many | - | - | - |
| `salesCreditDebitNotes` | [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | One-to-Many | - | - | - |
| `clientPayments` | [ClientPayment](./models/ClientPayment.md) | One-to-Many | - | - | - |
| `clientLedgerEntries` | [ClientLedgerEntry](./models/ClientLedgerEntry.md) | One-to-Many | - | - | - |
| `collectionAttempts` | [CollectionAttempt](./models/CollectionAttempt.md) | One-to-Many | - | - | - |
| `loadOrders` | [LoadOrder](./models/LoadOrder.md) | One-to-Many | - | - | - |
| `clientBlockHistory` | [ClientBlockHistory](./models/ClientBlockHistory.md) | One-to-Many | - | - | - |
| `clientNotes` | [ClientNote](./models/ClientNote.md) | One-to-Many | - | - | - |
| `salesPriceLists` | [SalesPriceList](./models/SalesPriceList.md) | One-to-Many | - | - | - |
| `discountLists` | [DiscountList](./models/DiscountList.md) | One-to-Many | - | - | - |
| `companyModules` | [CompanyModule](./models/CompanyModule.md) | One-to-Many | - | - | - |
| `clientContacts` | [ClientContact](./models/ClientContact.md) | One-to-Many | - | - | - |
| `clientPortalUsers` | [ClientPortalUser](./models/ClientPortalUser.md) | One-to-Many | - | - | - |
| `clientPortalInvites` | [ClientPortalInvite](./models/ClientPortalInvite.md) | One-to-Many | - | - | - |
| `clientPortalSessions` | [ClientPortalSession](./models/ClientPortalSession.md) | One-to-Many | - | - | - |
| `clientPortalOrders` | [ClientPortalOrder](./models/ClientPortalOrder.md) | One-to-Many | - | - | - |
| `saleAcopios` | [SaleAcopio](./models/SaleAcopio.md) | One-to-Many | - | - | - |
| `acopioRetiros` | [AcopioRetiro](./models/AcopioRetiro.md) | One-to-Many | - | - | - |
| `cashAccounts` | [CashAccount](./models/CashAccount.md) | One-to-Many | - | - | - |
| `cashMovements` | [CashMovement](./models/CashMovement.md) | One-to-Many | - | - | - |
| `bankAccounts` | [BankAccount](./models/BankAccount.md) | One-to-Many | - | - | - |
| `bankMovements` | [BankMovement](./models/BankMovement.md) | One-to-Many | - | - | - |
| `cheques` | [Cheque](./models/Cheque.md) | One-to-Many | - | - | - |
| `treasuryTransfers` | [TreasuryTransfer](./models/TreasuryTransfer.md) | One-to-Many | - | - | - |
| `bankStatements` | [BankStatement](./models/BankStatement.md) | One-to-Many | - | - | - |
| `treasuryMovements` | [TreasuryMovement](./models/TreasuryMovement.md) | One-to-Many | - | - | - |
| `idempotencyKeys` | [IdempotencyKey](./models/IdempotencyKey.md) | One-to-Many | - | - | - |
| `subscription` | [Subscription](./models/Subscription.md) | Many-to-One (optional) | subscriptionId | id | - |
| `primaryAdmin` | [User](./models/User.md) | Many-to-One (optional) | primaryAdminId | id | - |
| `template` | [CompanyTemplate](./models/CompanyTemplate.md) | Many-to-One (optional) | templateId | id | - |
| `payrollConfig` | [PayrollConfig](./models/PayrollConfig.md) | Many-to-One (optional) | - | - | - |
| `companyHolidays` | [CompanyHoliday](./models/CompanyHoliday.md) | One-to-Many | - | - | - |
| `salaryComponents` | [SalaryComponent](./models/SalaryComponent.md) | One-to-Many | - | - | - |
| `payrollPeriods` | [PayrollPeriod](./models/PayrollPeriod.md) | One-to-Many | - | - | - |
| `payrolls` | [Payroll](./models/Payroll.md) | One-to-Many | - | - | - |
| `salaryAdvances` | [SalaryAdvance](./models/SalaryAdvance.md) | One-to-Many | - | - | - |
| `agreementRates` | [AgreementRate](./models/AgreementRate.md) | One-to-Many | - | - | - |
| `payrollRuns` | [PayrollRun](./models/PayrollRun.md) | One-to-Many | - | - | - |
| `payrollUnions` | [PayrollUnion](./models/PayrollUnion.md) | One-to-Many | - | - | - |
| `workSectors` | [WorkSector](./models/WorkSector.md) | One-to-Many | - | - | - |
| `workPositions` | [WorkPosition](./models/WorkPosition.md) | One-to-Many | - | - | - |
| `sparePartReservations` | [SparePartReservation](./models/SparePartReservation.md) | One-to-Many | - | - | - |
| `maintenanceCostBreakdowns` | [MaintenanceCostBreakdown](./models/MaintenanceCostBreakdown.md) | One-to-Many | - | - | - |
| `technicianCostRates` | [TechnicianCostRate](./models/TechnicianCostRate.md) | One-to-Many | - | - | - |
| `thirdPartyCosts` | [ThirdPartyCost](./models/ThirdPartyCost.md) | One-to-Many | - | - | - |
| `maintenanceBudgets` | [MaintenanceBudget](./models/MaintenanceBudget.md) | One-to-Many | - | - | - |
| `automationRules` | [AutomationRule](./models/AutomationRule.md) | One-to-Many | - | - | - |
| `automationExecutions` | [AutomationExecution](./models/AutomationExecution.md) | One-to-Many | - | - | - |
| `ideas` | [Idea](./models/Idea.md) | One-to-Many | - | - | - |
| `costSystemConfig` | [CostSystemConfig](./models/CostSystemConfig.md) | Many-to-One (optional) | - | - | - |
| `monthlyCostConsolidations` | [MonthlyCostConsolidation](./models/MonthlyCostConsolidation.md) | One-to-Many | - | - | - |
| `lotoProcedures` | [LOTOProcedure](./models/LOTOProcedure.md) | One-to-Many | - | - | - |
| `permitsToWork` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `lotoExecutions` | [LOTOExecution](./models/LOTOExecution.md) | One-to-Many | - | - | - |
| `componentFailureModes` | [ComponentFailureMode](./models/ComponentFailureMode.md) | One-to-Many | - | - | - |
| `skills` | [Skill](./models/Skill.md) | One-to-Many | - | - | - |
| `userCertifications` | [UserCertification](./models/UserCertification.md) | One-to-Many | - | - | - |
| `taskSkillRequirements` | [TaskSkillRequirement](./models/TaskSkillRequirement.md) | One-to-Many | - | - | - |
| `machineCounters` | [MachineCounter](./models/MachineCounter.md) | One-to-Many | - | - | - |
| `managementOfChanges` | [ManagementOfChange](./models/ManagementOfChange.md) | One-to-Many | - | - | - |
| `auditLogs` | [AuditLog](./models/AuditLog.md) | One-to-Many | - | - | - |
| `workShifts` | [WorkShift](./models/WorkShift.md) | One-to-Many | - | - | - |
| `workCenters` | [WorkCenter](./models/WorkCenter.md) | One-to-Many | - | - | - |
| `productionReasonCodes` | [ProductionReasonCode](./models/ProductionReasonCode.md) | One-to-Many | - | - | - |
| `productionOrders` | [ProductionOrder](./models/ProductionOrder.md) | One-to-Many | - | - | - |
| `dailyProductionReports` | [DailyProductionReport](./models/DailyProductionReport.md) | One-to-Many | - | - | - |
| `productionDowntimes` | [ProductionDowntime](./models/ProductionDowntime.md) | One-to-Many | - | - | - |
| `productionQualityControls` | [ProductionQualityControl](./models/ProductionQualityControl.md) | One-to-Many | - | - | - |
| `productionDefects` | [ProductionDefect](./models/ProductionDefect.md) | One-to-Many | - | - | - |
| `productionBatchLots` | [ProductionBatchLot](./models/ProductionBatchLot.md) | One-to-Many | - | - | - |
| `productionEvents` | [ProductionEvent](./models/ProductionEvent.md) | One-to-Many | - | - | - |
| `productionRoutineTemplates` | [ProductionRoutineTemplate](./models/ProductionRoutineTemplate.md) | One-to-Many | - | - | - |
| `productionRoutines` | [ProductionRoutine](./models/ProductionRoutine.md) | One-to-Many | - | - | - |
| `dailyProductionSessions` | [DailyProductionSession](./models/DailyProductionSession.md) | One-to-Many | - | - | - |
| `dailyProductionEntries` | [DailyProductionEntry](./models/DailyProductionEntry.md) | One-to-Many | - | - | - |
| `productionResourceTypes` | [ProductionResourceType](./models/ProductionResourceType.md) | One-to-Many | - | - | - |
| `productionResources` | [ProductionResource](./models/ProductionResource.md) | One-to-Many | - | - | - |
| `prestressedMolds` | [PrestressedMold](./models/PrestressedMold.md) | One-to-Many | - | - | - |
| `curingRecords` | [CuringRecord](./models/CuringRecord.md) | One-to-Many | - | - | - |
| `voicePurchaseLogs` | [VoicePurchaseLog](./models/VoicePurchaseLog.md) | One-to-Many | - | - | - |
| `voiceFailureLogs` | [VoiceFailureLog](./models/VoiceFailureLog.md) | One-to-Many | - | - | - |
| `recurringPurchaseOrders` | [RecurringPurchaseOrder](./models/RecurringPurchaseOrder.md) | One-to-Many | - | - | - |
| `agendaTasks` | [AgendaTask](./models/AgendaTask.md) | One-to-Many | - | - | - |
| `agendaReminders` | [AgendaReminder](./models/AgendaReminder.md) | One-to-Many | - | - | - |
| `voiceTaskLogs` | [VoiceTaskLog](./models/VoiceTaskLog.md) | One-to-Many | - | - | - |
| `stockReservations` | [StockReservation](./models/StockReservation.md) | One-to-Many | - | - | - |
| `materialRequests` | [MaterialRequest](./models/MaterialRequest.md) | One-to-Many | - | - | - |
| `despachos` | [Despacho](./models/Despacho.md) | One-to-Many | - | - | - |
| `devoluciones` | [DevolucionMaterial](./models/DevolucionMaterial.md) | One-to-Many | - | - | - |
| `productionStockConfig` | [ProductionStockConfig](./models/ProductionStockConfig.md) | Many-to-One (optional) | - | - | - |
| `machineImportJobs` | [MachineImportJob](./models/MachineImportJob.md) | One-to-Many | - | - | - |
| `supplyCategories` | [SupplyCategory](./models/SupplyCategory.md) | One-to-Many | - | - | - |
| `serviceContracts` | [ServiceContract](./models/ServiceContract.md) | One-to-Many | - | - | - |
| `grniAccruals` | [GRNIAccrual](./models/GRNIAccrual.md) | One-to-Many | - | - | - |
| `chatSessions` | [ChatSession](./models/ChatSession.md) | One-to-Many | - | - | - |
| `rmas` | [SaleRMA](./models/SaleRMA.md) | One-to-Many | - | - | - |
| `warranties` | [ProductWarranty](./models/ProductWarranty.md) | One-to-Many | - | - | - |
| `salesGoals` | [SalesGoal](./models/SalesGoal.md) | One-to-Many | - | - | - |
| `performanceDashboards` | [SalesPerformanceDashboard](./models/SalesPerformanceDashboard.md) | One-to-Many | - | - | - |
| `clientBalanceSnapshots` | [ClientBalanceSnapshot](./models/ClientBalanceSnapshot.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [CompanySettings](./models/CompanySettings.md) | `company` | Has one |
| [User](./models/User.md) | `ownedCompanies` | Has many |
| [User](./models/User.md) | `companiesAsPrimaryAdmin` | Has many |
| [Role](./models/Role.md) | `company` | Has one |
| [UserOnCompany](./models/UserOnCompany.md) | `company` | Has one |
| [Area](./models/Area.md) | `company` | Has one |
| [Sector](./models/Sector.md) | `company` | Has one |
| [PlantZone](./models/PlantZone.md) | `company` | Has one |
| [UnidadMovil](./models/UnidadMovil.md) | `company` | Has one |
| [KilometrajeLog](./models/KilometrajeLog.md) | `company` | Has one |
| [Machine](./models/Machine.md) | `company` | Has one |
| [MachineImportJob](./models/MachineImportJob.md) | `company` | Has one |
| [Tool](./models/Tool.md) | `company` | Has one |
| [SparePartReservation](./models/SparePartReservation.md) | `company` | Has one |
| [Worker](./models/Worker.md) | `company` | Has one |
| [WorkOrder](./models/WorkOrder.md) | `company` | Has one |
| [Task](./models/Task.md) | `company` | Has one |
| [FixedTask](./models/FixedTask.md) | `company` | Has one |
| [Document](./models/Document.md) | `company` | Has one |
| [Notification](./models/Notification.md) | `company` | Has one |
| [NotificationPreferences](./models/NotificationPreferences.md) | `company` | Has one |
| [ToolRequest](./models/ToolRequest.md) | `company` | Has one |
| [Category](./models/Category.md) | `company` | Has one |
| [Product](./models/Product.md) | `company` | Has one |
| [ProductCostLog](./models/ProductCostLog.md) | `company` | Has one |
| [SalesPriceLog](./models/SalesPriceLog.md) | `company` | Has one |
| [ProductStockMovement](./models/ProductStockMovement.md) | `company` | Has one |
| [WorkStation](./models/WorkStation.md) | `company` | Has one |
| [Line](./models/Line.md) | `company` | Has one |
| [CostProduct](./models/CostProduct.md) | `company` | Has one |
| [InputItem](./models/InputItem.md) | `company` | Has one |
| [CostEmployee](./models/CostEmployee.md) | `company` | Has one |
| [MonthlyIndirect](./models/MonthlyIndirect.md) | `company` | Has one |
| [IndirectItem](./models/IndirectItem.md) | `company` | Has one |
| [Recipe](./models/Recipe.md) | `company` | Has one |
| [MonthlyProduction](./models/MonthlyProduction.md) | `company` | Has one |
| [ProductCostHistory](./models/ProductCostHistory.md) | `company` | Has one |
| [CompanySettingsCosting](./models/CompanySettingsCosting.md) | `Company` | Has one |
| [CostVarianceMonthly](./models/CostVarianceMonthly.md) | `Company` | Has one |
| [FactPnLMonthly](./models/FactPnLMonthly.md) | `Company` | Has one |
| [FactPurchasesMonthly](./models/FactPurchasesMonthly.md) | `Company` | Has one |
| [FactSalesMonthly](./models/FactSalesMonthly.md) | `Company` | Has one |
| [ProductStandardCost](./models/ProductStandardCost.md) | `Company` | Has one |
| [ProductionMethod](./models/ProductionMethod.md) | `Company` | Has one |
| [Zone](./models/Zone.md) | `Company` | Has one |
| [MaintenanceChecklist](./models/MaintenanceChecklist.md) | `company` | Has one |
| [MachineOrder](./models/MachineOrder.md) | `company` | Has one |
| [EmployeeCategory](./models/EmployeeCategory.md) | `Company` | Has one |
| [Employee](./models/Employee.md) | `Company` | Has one |
| [EmployeeSalaryHistory](./models/EmployeeSalaryHistory.md) | `Company` | Has one |
| [employee_monthly_salaries](./models/employee_monthly_salaries.md) | `Company` | Has one |
| [products](./models/products.md) | `company` | Has one |
| [suppliers](./models/suppliers.md) | `Company` | Has one |
| [SupplierChangeRequest](./models/SupplierChangeRequest.md) | `company` | Has one |
| [SupplyCategory](./models/SupplyCategory.md) | `company` | Has one |
| [supplies](./models/supplies.md) | `Company` | Has one |
| [SupplierAccountMovement](./models/SupplierAccountMovement.md) | `company` | Has one |
| [supply_monthly_prices](./models/supply_monthly_prices.md) | `Company` | Has one |
| [supply_price_history](./models/supply_price_history.md) | `Company` | Has one |
| [recipes](./models/recipes.md) | `Company` | Has one |
| [recipe_cost_tests](./models/recipe_cost_tests.md) | `Company` | Has one |
| [recipe_change_history](./models/recipe_change_history.md) | `Company` | Has one |
| [recipe_items](./models/recipe_items.md) | `Company` | Has one |
| [PriceComparison](./models/PriceComparison.md) | `company` | Has one |
| [TaxBase](./models/TaxBase.md) | `company` | Has one |
| [Control](./models/Control.md) | `company` | Has one |
| [Truck](./models/Truck.md) | `company` | Has one |
| [Load](./models/Load.md) | `company` | Has one |
| [ClientType](./models/ClientType.md) | `company` | Has one |
| [DeliveryZone](./models/DeliveryZone.md) | `company` | Has one |
| [TransportCompany](./models/TransportCompany.md) | `company` | Has one |
| [BusinessSector](./models/BusinessSector.md) | `company` | Has one |
| [Client](./models/Client.md) | `company` | Has one |
| [ClientBlockHistory](./models/ClientBlockHistory.md) | `company` | Has one |
| [ClientNote](./models/ClientNote.md) | `company` | Has one |
| [DiscountList](./models/DiscountList.md) | `company` | Has one |
| [PurchaseAccount](./models/PurchaseAccount.md) | `company` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `company` | Has one |
| [PaymentOrder](./models/PaymentOrder.md) | `company` | Has one |
| [maintenance_configs](./models/maintenance_configs.md) | `Company` | Has one |
| [UserDashboardConfig](./models/UserDashboardConfig.md) | `company` | Has one |
| [UserColorPreferences](./models/UserColorPreferences.md) | `company` | Has one |
| [SymptomLibrary](./models/SymptomLibrary.md) | `company` | Has one |
| [DowntimeLog](./models/DowntimeLog.md) | `company` | Has one |
| [Template](./models/Template.md) | `company` | Has one |
| [SolutionApplied](./models/SolutionApplied.md) | `company` | Has one |
| [CorrectiveSettings](./models/CorrectiveSettings.md) | `company` | Has one |
| [FailureOccurrenceEvent](./models/FailureOccurrenceEvent.md) | `company` | Has one |
| [ActivityEvent](./models/ActivityEvent.md) | `company` | Has one |
| [RootCauseAnalysis](./models/RootCauseAnalysis.md) | `company` | Has one |
| [CorrectiveChecklistTemplate](./models/CorrectiveChecklistTemplate.md) | `company` | Has one |
| [WorkOrderChecklist](./models/WorkOrderChecklist.md) | `company` | Has one |
| [AssistantEmbedding](./models/AssistantEmbedding.md) | `company` | Has one |
| [AssistantConversation](./models/AssistantConversation.md) | `company` | Has one |
| [AssistantActionLog](./models/AssistantActionLog.md) | `company` | Has one |
| [Warehouse](./models/Warehouse.md) | `company` | Has one |
| [StockTransfer](./models/StockTransfer.md) | `company` | Has one |
| [StockAdjustment](./models/StockAdjustment.md) | `company` | Has one |
| [PurchaseOrder](./models/PurchaseOrder.md) | `company` | Has one |
| [GoodsReceipt](./models/GoodsReceipt.md) | `company` | Has one |
| [GRNIAccrual](./models/GRNIAccrual.md) | `company` | Has one |
| [CreditDebitNote](./models/CreditDebitNote.md) | `company` | Has one |
| [CreditNoteRequest](./models/CreditNoteRequest.md) | `company` | Has one |
| [PurchaseConfig](./models/PurchaseConfig.md) | `company` | Has one |
| [MatchExceptionSLAConfig](./models/MatchExceptionSLAConfig.md) | `company` | Has one |
| [NotificationOutbox](./models/NotificationOutbox.md) | `company` | Has one |
| [SoDRule](./models/SoDRule.md) | `company` | Has one |
| [SoDViolation](./models/SoDViolation.md) | `company` | Has one |
| [CostCenter](./models/CostCenter.md) | `company` | Has one |
| [Project](./models/Project.md) | `company` | Has one |
| [PaymentRequest](./models/PaymentRequest.md) | `company` | Has one |
| [PurchaseReturn](./models/PurchaseReturn.md) | `company` | Has one |
| [PurchaseRequest](./models/PurchaseRequest.md) | `company` | Has one |
| [PurchaseQuotation](./models/PurchaseQuotation.md) | `company` | Has one |
| [CompanyQuotationSettings](./models/CompanyQuotationSettings.md) | `company` | Has one |
| [PurchaseComment](./models/PurchaseComment.md) | `company` | Has one |
| [CompanyViewConfig](./models/CompanyViewConfig.md) | `company` | Has one |
| [SalesConfig](./models/SalesConfig.md) | `company` | Has one |
| [Quote](./models/Quote.md) | `company` | Has one |
| [ClientContact](./models/ClientContact.md) | `company` | Has one |
| [ClientPortalUser](./models/ClientPortalUser.md) | `company` | Has one |
| [ClientPortalInvite](./models/ClientPortalInvite.md) | `company` | Has one |
| [ClientPortalSession](./models/ClientPortalSession.md) | `company` | Has one |
| [ClientPortalOrder](./models/ClientPortalOrder.md) | `company` | Has one |
| [Sale](./models/Sale.md) | `company` | Has one |
| [SaleDelivery](./models/SaleDelivery.md) | `company` | Has one |
| [LoadOrder](./models/LoadOrder.md) | `company` | Has one |
| [SaleRemito](./models/SaleRemito.md) | `company` | Has one |
| [SalesInvoice](./models/SalesInvoice.md) | `company` | Has one |
| [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | `company` | Has one |
| [ClientPayment](./models/ClientPayment.md) | `company` | Has one |
| [ClientLedgerEntry](./models/ClientLedgerEntry.md) | `company` | Has one |
| [CollectionAttempt](./models/CollectionAttempt.md) | `company` | Has one |
| [SalesPriceList](./models/SalesPriceList.md) | `company` | Has one |
| [SaleRMA](./models/SaleRMA.md) | `company` | Has one |
| [ProductWarranty](./models/ProductWarranty.md) | `company` | Has one |
| [SalesGoal](./models/SalesGoal.md) | `company` | Has one |
| [SalesPerformanceDashboard](./models/SalesPerformanceDashboard.md) | `company` | Has one |
| [CompanyModule](./models/CompanyModule.md) | `company` | Has one |
| [SaleAcopio](./models/SaleAcopio.md) | `company` | Has one |
| [AcopioRetiro](./models/AcopioRetiro.md) | `company` | Has one |
| [CashAccount](./models/CashAccount.md) | `company` | Has one |
| [CashMovement](./models/CashMovement.md) | `company` | Has one |
| [BankAccount](./models/BankAccount.md) | `company` | Has one |
| [BankMovement](./models/BankMovement.md) | `company` | Has one |
| [Cheque](./models/Cheque.md) | `company` | Has one |
| [TreasuryTransfer](./models/TreasuryTransfer.md) | `company` | Has one |
| [BankStatement](./models/BankStatement.md) | `company` | Has one |
| [TreasuryMovement](./models/TreasuryMovement.md) | `company` | Has one |
| [IdempotencyKey](./models/IdempotencyKey.md) | `company` | Has one |
| [CompanyTemplate](./models/CompanyTemplate.md) | `companies` | Has many |
| [Subscription](./models/Subscription.md) | `companies` | Has many |
| [PayrollConfig](./models/PayrollConfig.md) | `Company` | Has one |
| [CompanyHoliday](./models/CompanyHoliday.md) | `Company` | Has one |
| [SalaryComponent](./models/SalaryComponent.md) | `Company` | Has one |
| [PayrollPeriod](./models/PayrollPeriod.md) | `Company` | Has one |
| [Payroll](./models/Payroll.md) | `Company` | Has one |
| [SalaryAdvance](./models/SalaryAdvance.md) | `Company` | Has one |
| [PayrollUnion](./models/PayrollUnion.md) | `Company` | Has one |
| [WorkSector](./models/WorkSector.md) | `Company` | Has one |
| [WorkPosition](./models/WorkPosition.md) | `Company` | Has one |
| [AgreementRate](./models/AgreementRate.md) | `Company` | Has one |
| [PayrollRun](./models/PayrollRun.md) | `Company` | Has one |
| [MaintenanceCostBreakdown](./models/MaintenanceCostBreakdown.md) | `company` | Has one |
| [TechnicianCostRate](./models/TechnicianCostRate.md) | `company` | Has one |
| [ThirdPartyCost](./models/ThirdPartyCost.md) | `company` | Has one |
| [MaintenanceBudget](./models/MaintenanceBudget.md) | `company` | Has one |
| [AutomationRule](./models/AutomationRule.md) | `company` | Has one |
| [AutomationExecution](./models/AutomationExecution.md) | `company` | Has one |
| [Idea](./models/Idea.md) | `company` | Has one |
| [CostSystemConfig](./models/CostSystemConfig.md) | `company` | Has one |
| [MonthlyCostConsolidation](./models/MonthlyCostConsolidation.md) | `company` | Has one |
| [AuditLog](./models/AuditLog.md) | `company` | Has one |
| [LOTOProcedure](./models/LOTOProcedure.md) | `company` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `company` | Has one |
| [LOTOExecution](./models/LOTOExecution.md) | `company` | Has one |
| [ComponentFailureMode](./models/ComponentFailureMode.md) | `company` | Has one |
| [Skill](./models/Skill.md) | `company` | Has one |
| [UserCertification](./models/UserCertification.md) | `company` | Has one |
| [TaskSkillRequirement](./models/TaskSkillRequirement.md) | `company` | Has one |
| [MachineCounter](./models/MachineCounter.md) | `company` | Has one |
| [ManagementOfChange](./models/ManagementOfChange.md) | `company` | Has one |
| [WorkShift](./models/WorkShift.md) | `company` | Has one |
| [WorkCenter](./models/WorkCenter.md) | `company` | Has one |
| [ProductionReasonCode](./models/ProductionReasonCode.md) | `company` | Has one |
| [ProductionOrder](./models/ProductionOrder.md) | `company` | Has one |
| [DailyProductionReport](./models/DailyProductionReport.md) | `company` | Has one |
| [ProductionDowntime](./models/ProductionDowntime.md) | `company` | Has one |
| [ProductionQualityControl](./models/ProductionQualityControl.md) | `company` | Has one |
| [ProductionDefect](./models/ProductionDefect.md) | `company` | Has one |
| [ProductionBatchLot](./models/ProductionBatchLot.md) | `company` | Has one |
| [ProductionEvent](./models/ProductionEvent.md) | `company` | Has one |
| [ProductionRoutineTemplate](./models/ProductionRoutineTemplate.md) | `company` | Has one |
| [ProductionRoutine](./models/ProductionRoutine.md) | `company` | Has one |
| [DailyProductionSession](./models/DailyProductionSession.md) | `company` | Has one |
| [DailyProductionEntry](./models/DailyProductionEntry.md) | `company` | Has one |
| [ProductionResourceType](./models/ProductionResourceType.md) | `company` | Has one |
| [ProductionResource](./models/ProductionResource.md) | `company` | Has one |
| [PrestressedMold](./models/PrestressedMold.md) | `company` | Has one |
| [CuringRecord](./models/CuringRecord.md) | `company` | Has one |
| [VoicePurchaseLog](./models/VoicePurchaseLog.md) | `company` | Has one |
| [VoiceFailureLog](./models/VoiceFailureLog.md) | `company` | Has one |
| [RecurringPurchaseOrder](./models/RecurringPurchaseOrder.md) | `company` | Has one |
| [AgendaTask](./models/AgendaTask.md) | `company` | Has one |
| [AgendaReminder](./models/AgendaReminder.md) | `company` | Has one |
| [VoiceTaskLog](./models/VoiceTaskLog.md) | `company` | Has one |
| [StockReservation](./models/StockReservation.md) | `company` | Has one |
| [MaterialRequest](./models/MaterialRequest.md) | `company` | Has one |
| [Despacho](./models/Despacho.md) | `company` | Has one |
| [DevolucionMaterial](./models/DevolucionMaterial.md) | `company` | Has one |
| [ProductionStockConfig](./models/ProductionStockConfig.md) | `company` | Has one |
| [ServiceContract](./models/ServiceContract.md) | `company` | Has one |
| [PurchaseAdvancedConfig](./models/PurchaseAdvancedConfig.md) | `company` | Has one |
| [TreasuryConfig](./models/TreasuryConfig.md) | `company` | Has one |
| [GeneralConfig](./models/GeneralConfig.md) | `company` | Has one |
| [IntegrationConfig](./models/IntegrationConfig.md) | `company` | Has one |
| [AIConfig](./models/AIConfig.md) | `company` | Has one |
| [ChatSession](./models/ChatSession.md) | `company` | Has one |
| [ClientBalanceSnapshot](./models/ClientBalanceSnapshot.md) | `company` | Has one |

## Indexes

- `subscriptionId`
- `primaryAdminId`
- `templateId`

## Entity Diagram

```mermaid
erDiagram
    Company {
        int id PK
        string name
        string cuit UK
        string logo
        string address
        string phone
        string email
        string website
        datetime createdAt
        datetime updatedAt
        string logoDark
        string logoLight
        employee_monthly_salaries employee_monthly_salaries
        maintenance_configs maintenance_configs
        products products_lowercase
        string _more_fields
    }
    Area {
        int id PK
    }
    Category {
        int id PK
    }
    Client {
        string id PK
    }
    ClientType {
        string id PK
    }
    DeliveryZone {
        string id PK
    }
    TransportCompany {
        string id PK
    }
    BusinessSector {
        string id PK
    }
    CompanySettings {
        string id PK
    }
    CompanySettingsCosting {
        string id PK
    }
    CostEmployee {
        string id PK
    }
    CostProduct {
        string id PK
    }
    CostVarianceMonthly {
        string id PK
    }
    Document {
        int id PK
    }
    FactPnLMonthly {
        string id PK
    }
    FactPurchasesMonthly {
        string id PK
    }
    FactSalesMonthly {
        string id PK
    }
    FixedTask {
        int id PK
    }
    IndirectItem {
        string id PK
    }
    InputItem {
        string id PK
    }
    Line {
        string id PK
    }
    Load {
        int id PK
    }
    Machine {
        int id PK
    }
    MonthlyIndirect {
        string id PK
    }
    MonthlyProduction {
        string id PK
    }
    Notification {
        int id PK
    }
    NotificationPreferences {
        int id PK
    }
    PriceComparison {
        string id PK
    }
    Product {
        string id PK
    }
    ProductCostHistory {
        string id PK
    }
    ProductCostLog {
        string id PK
    }
    SalesPriceLog {
        string id PK
    }
    ProductStockMovement {
        string id PK
    }
    ProductStandardCost {
        string id PK
    }
    ProductionMethod {
        string id PK
    }
    PurchaseAccount {
        int id PK
    }
    PurchaseReceipt {
        int id PK
    }
    Recipe {
        string id PK
    }
    Role {
        int id PK
    }
    Sector {
        int id PK
    }
    Task {
        int id PK
    }
    TaxBase {
        int id PK
    }
    Control {
        int id PK
    }
    Tool {
        int id PK
    }
    ToolRequest {
        int id PK
    }
    Truck {
        int id PK
    }
    UnidadMovil {
        int id PK
    }
    KilometrajeLog {
        int id PK
    }
    UserOnCompany {
        int id PK
    }
    WorkStation {
        int id PK
    }
    Worker {
        int id PK
    }
    Zone {
        string id PK
    }
    PlantZone {
        int id PK
    }
    EmployeeCategory {
        int id PK
    }
    EmployeeSalaryHistory {
        string id PK
    }
    Employee {
        string id PK
    }
    MachineOrder {
        int id PK
    }
    MaintenanceChecklist {
        int id PK
    }
    WorkOrder {
        int id PK
    }
    PaymentOrder {
        int id PK
    }
    User {
        int id PK
    }
    UserDashboardConfig {
        int id PK
    }
    UserColorPreferences {
        int id PK
    }
    SymptomLibrary {
        int id PK
    }
    DowntimeLog {
        int id PK
    }
    Template {
        int id PK
    }
    SolutionApplied {
        int id PK
    }
    CorrectiveSettings {
        int id PK
    }
    FailureOccurrenceEvent {
        int id PK
    }
    ActivityEvent {
        int id PK
    }
    RootCauseAnalysis {
        int id PK
    }
    CorrectiveChecklistTemplate {
        int id PK
    }
    WorkOrderChecklist {
        int id PK
    }
    AssistantEmbedding {
        int id PK
    }
    AssistantConversation {
        int id PK
    }
    AssistantActionLog {
        int id PK
    }
    Warehouse {
        int id PK
    }
    PurchaseOrder {
        int id PK
    }
    GoodsReceipt {
        int id PK
    }
    CreditDebitNote {
        int id PK
    }
    CreditNoteRequest {
        int id PK
    }
    CostCenter {
        int id PK
    }
    Project {
        int id PK
    }
    PaymentRequest {
        int id PK
    }
    PurchaseReturn {
        int id PK
    }
    SupplierAccountMovement {
        int id PK
    }
    MatchExceptionSLAConfig {
        int id PK
    }
    NotificationOutbox {
        int id PK
    }
    SoDRule {
        int id PK
    }
    SoDViolation {
        int id PK
    }
    StockTransfer {
        int id PK
    }
    StockAdjustment {
        int id PK
    }
    PurchaseRequest {
        int id PK
    }
    PurchaseQuotation {
        int id PK
    }
    PurchaseComment {
        int id PK
    }
    CompanyQuotationSettings {
        int id PK
    }
    SupplierChangeRequest {
        int id PK
    }
    CompanyViewConfig {
        string id PK
    }
    SalesConfig {
        int id PK
    }
    PurchaseConfig {
        int id PK
    }
    PurchaseAdvancedConfig {
        int id PK
    }
    TreasuryConfig {
        int id PK
    }
    GeneralConfig {
        int id PK
    }
    IntegrationConfig {
        int id PK
    }
    AIConfig {
        int id PK
    }
    Quote {
        int id PK
    }
    Sale {
        int id PK
    }
    SaleDelivery {
        int id PK
    }
    SaleRemito {
        int id PK
    }
    SalesInvoice {
        int id PK
    }
    SalesCreditDebitNote {
        int id PK
    }
    ClientPayment {
        int id PK
    }
    ClientLedgerEntry {
        int id PK
    }
    CollectionAttempt {
        int id PK
    }
    LoadOrder {
        int id PK
    }
    ClientBlockHistory {
        string id PK
    }
    ClientNote {
        string id PK
    }
    SalesPriceList {
        int id PK
    }
    DiscountList {
        string id PK
    }
    CompanyModule {
        string id PK
    }
    ClientContact {
        string id PK
    }
    ClientPortalUser {
        string id PK
    }
    ClientPortalInvite {
        string id PK
    }
    ClientPortalSession {
        string id PK
    }
    ClientPortalOrder {
        string id PK
    }
    SaleAcopio {
        int id PK
    }
    AcopioRetiro {
        int id PK
    }
    CashAccount {
        int id PK
    }
    CashMovement {
        int id PK
    }
    BankAccount {
        int id PK
    }
    BankMovement {
        int id PK
    }
    Cheque {
        int id PK
    }
    TreasuryTransfer {
        int id PK
    }
    BankStatement {
        int id PK
    }
    TreasuryMovement {
        int id PK
    }
    IdempotencyKey {
        int id PK
    }
    Subscription {
        string id PK
    }
    CompanyTemplate {
        string id PK
    }
    PayrollConfig {
        int id PK
    }
    CompanyHoliday {
        int id PK
    }
    SalaryComponent {
        int id PK
    }
    PayrollPeriod {
        int id PK
    }
    Payroll {
        int id PK
    }
    SalaryAdvance {
        int id PK
    }
    AgreementRate {
        int id PK
    }
    PayrollRun {
        int id PK
    }
    PayrollUnion {
        int id PK
    }
    WorkSector {
        int id PK
    }
    WorkPosition {
        int id PK
    }
    SparePartReservation {
        int id PK
    }
    MaintenanceCostBreakdown {
        int id PK
    }
    TechnicianCostRate {
        int id PK
    }
    ThirdPartyCost {
        int id PK
    }
    MaintenanceBudget {
        int id PK
    }
    AutomationRule {
        int id PK
    }
    AutomationExecution {
        int id PK
    }
    Idea {
        int id PK
    }
    CostSystemConfig {
        int id PK
    }
    MonthlyCostConsolidation {
        int id PK
    }
    LOTOProcedure {
        int id PK
    }
    PermitToWork {
        int id PK
    }
    LOTOExecution {
        int id PK
    }
    ComponentFailureMode {
        int id PK
    }
    Skill {
        int id PK
    }
    UserCertification {
        int id PK
    }
    TaskSkillRequirement {
        int id PK
    }
    MachineCounter {
        int id PK
    }
    ManagementOfChange {
        int id PK
    }
    AuditLog {
        int id PK
    }
    WorkShift {
        int id PK
    }
    WorkCenter {
        int id PK
    }
    ProductionReasonCode {
        int id PK
    }
    ProductionOrder {
        int id PK
    }
    DailyProductionReport {
        int id PK
    }
    ProductionDowntime {
        int id PK
    }
    ProductionQualityControl {
        int id PK
    }
    ProductionDefect {
        int id PK
    }
    ProductionBatchLot {
        int id PK
    }
    ProductionEvent {
        int id PK
    }
    ProductionRoutineTemplate {
        int id PK
    }
    ProductionRoutine {
        int id PK
    }
    DailyProductionSession {
        int id PK
    }
    DailyProductionEntry {
        int id PK
    }
    ProductionResourceType {
        int id PK
    }
    ProductionResource {
        int id PK
    }
    PrestressedMold {
        int id PK
    }
    CuringRecord {
        int id PK
    }
    VoicePurchaseLog {
        int id PK
    }
    VoiceFailureLog {
        int id PK
    }
    RecurringPurchaseOrder {
        int id PK
    }
    AgendaTask {
        int id PK
    }
    AgendaReminder {
        int id PK
    }
    VoiceTaskLog {
        int id PK
    }
    StockReservation {
        int id PK
    }
    MaterialRequest {
        int id PK
    }
    Despacho {
        int id PK
    }
    DevolucionMaterial {
        int id PK
    }
    ProductionStockConfig {
        int id PK
    }
    MachineImportJob {
        int id PK
    }
    SupplyCategory {
        int id PK
    }
    ServiceContract {
        int id PK
    }
    GRNIAccrual {
        int id PK
    }
    ChatSession {
        string id PK
    }
    SaleRMA {
        string id PK
    }
    ProductWarranty {
        string id PK
    }
    SalesGoal {
        string id PK
    }
    SalesPerformanceDashboard {
        string id PK
    }
    ClientBalanceSnapshot {
        int id PK
    }
    employee_monthly_salaries {
        int id PK
    }
    products {
        int id PK
    }
    suppliers {
        int id PK
    }
    supplies {
        int id PK
    }
    supply_monthly_prices {
        int id PK
    }
    supply_price_history {
        int id PK
    }
    recipes {
        int id PK
    }
    recipe_cost_tests {
        int id PK
    }
    recipe_change_history {
        int id PK
    }
    recipe_items {
        int id PK
    }
    maintenance_configs {
        int id PK
    }
    Company ||--o{ Area : "areas"
    Company ||--o{ Category : "categories"
    Company ||--o{ Client : "clients"
    Company ||--o{ ClientType : "clientTypes"
    Company ||--o{ DeliveryZone : "deliveryZones"
    Company ||--o{ TransportCompany : "transportCompanies"
    Company ||--o{ BusinessSector : "businessSectors"
    Company }o--|| CompanySettings : "settings"
    Company }o--|| CompanySettingsCosting : "CompanySettingsCosting"
    Company ||--o{ CostEmployee : "costEmployees"
    Company ||--o{ CostProduct : "costProducts"
    Company ||--o{ CostVarianceMonthly : "CostVarianceMonthly"
    Company ||--o{ Document : "documents"
    Company ||--o{ FactPnLMonthly : "FactPnLMonthly"
    Company ||--o{ FactPurchasesMonthly : "FactPurchasesMonthly"
    Company ||--o{ FactSalesMonthly : "FactSalesMonthly"
    Company ||--o{ FixedTask : "fixedTasks"
    Company ||--o{ IndirectItem : "indirectItems"
    Company ||--o{ InputItem : "inputItems"
    Company ||--o{ Line : "lines"
    Company ||--o{ Load : "loads"
    Company ||--o{ Machine : "machines"
    Company ||--o{ MonthlyIndirect : "monthlyIndirects"
    Company ||--o{ MonthlyProduction : "monthlyProductions"
    Company ||--o{ Notification : "notifications"
    Company ||--o{ NotificationPreferences : "notificationPreferences"
    Company ||--o{ PriceComparison : "priceComparisons"
    Company ||--o{ Product : "products"
    Company ||--o{ ProductCostHistory : "productCostHistories"
    Company ||--o{ ProductCostLog : "productCostLogs"
    Company ||--o{ SalesPriceLog : "salesPriceLogs"
    Company ||--o{ ProductStockMovement : "productStockMovements"
    Company ||--o{ ProductStandardCost : "ProductStandardCost"
    Company ||--o{ ProductionMethod : "ProductionMethod"
    Company ||--o{ PurchaseAccount : "purchaseAccounts"
    Company ||--o{ PurchaseReceipt : "purchaseReceipts"
    Company ||--o{ Recipe : "recipes"
    Company ||--o{ Role : "roles"
    Company ||--o{ Sector : "sectors"
    Company ||--o{ Task : "tasks"
    Company ||--o{ TaxBase : "taxBases"
    Company ||--o{ Control : "controls"
    Company ||--o{ Tool : "tools"
    Company ||--o{ ToolRequest : "toolRequests"
    Company ||--o{ Truck : "trucks"
    Company ||--o{ UnidadMovil : "unidadesMoviles"
    Company ||--o{ KilometrajeLog : "kilometrajeLogs"
    Company ||--o{ UserOnCompany : "users"
    Company ||--o{ WorkStation : "workStations"
    Company ||--o{ Worker : "workers"
    Company ||--o{ Zone : "Zone"
    Company ||--o{ PlantZone : "plantZones"
    Company ||--o{ EmployeeCategory : "employee_categories"
    Company ||--o{ EmployeeSalaryHistory : "employee_salary_history"
    Company ||--o{ Employee : "employees"
    Company ||--o{ MachineOrder : "machineOrder"
    Company ||--o{ MaintenanceChecklist : "maintenanceChecklists"
    Company ||--o{ WorkOrder : "workOrders"
    Company ||--o{ PaymentOrder : "paymentOrders"
    Company ||--o{ User : "ownedByUsers"
    Company ||--o{ UserDashboardConfig : "userDashboardConfigs"
    Company ||--o{ UserColorPreferences : "userColorPreferences"
    Company ||--o{ SymptomLibrary : "symptomLibrary"
    Company ||--o{ DowntimeLog : "downtimeLogs"
    Company ||--o{ Template : "templates"
    Company ||--o{ SolutionApplied : "solutionsApplied"
    Company }o--|| CorrectiveSettings : "correctiveSettings"
    Company ||--o{ FailureOccurrenceEvent : "occurrenceEvents"
    Company ||--o{ ActivityEvent : "activityEvents"
    Company ||--o{ RootCauseAnalysis : "rootCauseAnalyses"
    Company ||--o{ CorrectiveChecklistTemplate : "correctiveChecklistTemplates"
    Company ||--o{ WorkOrderChecklist : "workOrderChecklists"
    Company ||--o{ AssistantEmbedding : "assistantEmbeddings"
    Company ||--o{ AssistantConversation : "assistantConversations"
    Company ||--o{ AssistantActionLog : "assistantActionLogs"
    Company ||--o{ Warehouse : "warehouses"
    Company ||--o{ PurchaseOrder : "purchaseOrders"
    Company ||--o{ GoodsReceipt : "goodsReceipts"
    Company ||--o{ CreditDebitNote : "creditDebitNotes"
    Company ||--o{ CreditNoteRequest : "creditNoteRequests"
    Company ||--o{ CostCenter : "costCenters"
    Company ||--o{ Project : "projects"
    Company ||--o{ PaymentRequest : "paymentRequests"
    Company ||--o{ PurchaseReturn : "purchaseReturns"
    Company ||--o{ SupplierAccountMovement : "supplierAccountMovements"
    Company ||--o{ MatchExceptionSLAConfig : "matchExceptionSLAConfigs"
    Company ||--o{ NotificationOutbox : "notificationOutbox"
    Company ||--o{ SoDRule : "sodRules"
    Company ||--o{ SoDViolation : "sodViolations"
    Company ||--o{ StockTransfer : "stockTransfers"
    Company ||--o{ StockAdjustment : "stockAdjustments"
    Company ||--o{ PurchaseRequest : "purchaseRequests"
    Company ||--o{ PurchaseQuotation : "purchaseQuotations"
    Company ||--o{ PurchaseComment : "purchaseComments"
    Company }o--|| CompanyQuotationSettings : "quotationSettings"
    Company ||--o{ SupplierChangeRequest : "supplierChangeRequests"
    Company }o--|| CompanyViewConfig : "viewConfig"
    Company }o--|| SalesConfig : "salesConfig"
    Company }o--|| PurchaseConfig : "purchaseConfig"
    Company }o--|| PurchaseAdvancedConfig : "purchaseAdvancedConfig"
    Company }o--|| TreasuryConfig : "treasuryConfig"
    Company }o--|| GeneralConfig : "generalConfig"
    Company }o--|| IntegrationConfig : "integrationConfig"
    Company }o--|| AIConfig : "aiConfig"
    Company ||--o{ Quote : "quotes"
    Company ||--o{ Sale : "sales"
    Company ||--o{ SaleDelivery : "saleDeliveries"
    Company ||--o{ SaleRemito : "saleRemitos"
    Company ||--o{ SalesInvoice : "salesInvoices"
    Company ||--o{ SalesCreditDebitNote : "salesCreditDebitNotes"
    Company ||--o{ ClientPayment : "clientPayments"
    Company ||--o{ ClientLedgerEntry : "clientLedgerEntries"
    Company ||--o{ CollectionAttempt : "collectionAttempts"
    Company ||--o{ LoadOrder : "loadOrders"
    Company ||--o{ ClientBlockHistory : "clientBlockHistory"
    Company ||--o{ ClientNote : "clientNotes"
    Company ||--o{ SalesPriceList : "salesPriceLists"
    Company ||--o{ DiscountList : "discountLists"
    Company ||--o{ CompanyModule : "companyModules"
    Company ||--o{ ClientContact : "clientContacts"
    Company ||--o{ ClientPortalUser : "clientPortalUsers"
    Company ||--o{ ClientPortalInvite : "clientPortalInvites"
    Company ||--o{ ClientPortalSession : "clientPortalSessions"
    Company ||--o{ ClientPortalOrder : "clientPortalOrders"
    Company ||--o{ SaleAcopio : "saleAcopios"
    Company ||--o{ AcopioRetiro : "acopioRetiros"
    Company ||--o{ CashAccount : "cashAccounts"
    Company ||--o{ CashMovement : "cashMovements"
    Company ||--o{ BankAccount : "bankAccounts"
    Company ||--o{ BankMovement : "bankMovements"
    Company ||--o{ Cheque : "cheques"
    Company ||--o{ TreasuryTransfer : "treasuryTransfers"
    Company ||--o{ BankStatement : "bankStatements"
    Company ||--o{ TreasuryMovement : "treasuryMovements"
    Company ||--o{ IdempotencyKey : "idempotencyKeys"
    Company }o--|| Subscription : "subscription"
    Company }o--|| User : "primaryAdmin"
    Company }o--|| CompanyTemplate : "template"
    Company }o--|| PayrollConfig : "payrollConfig"
    Company ||--o{ CompanyHoliday : "companyHolidays"
    Company ||--o{ SalaryComponent : "salaryComponents"
    Company ||--o{ PayrollPeriod : "payrollPeriods"
    Company ||--o{ Payroll : "payrolls"
    Company ||--o{ SalaryAdvance : "salaryAdvances"
    Company ||--o{ AgreementRate : "agreementRates"
    Company ||--o{ PayrollRun : "payrollRuns"
    Company ||--o{ PayrollUnion : "payrollUnions"
    Company ||--o{ WorkSector : "workSectors"
    Company ||--o{ WorkPosition : "workPositions"
    Company ||--o{ SparePartReservation : "sparePartReservations"
    Company ||--o{ MaintenanceCostBreakdown : "maintenanceCostBreakdowns"
    Company ||--o{ TechnicianCostRate : "technicianCostRates"
    Company ||--o{ ThirdPartyCost : "thirdPartyCosts"
    Company ||--o{ MaintenanceBudget : "maintenanceBudgets"
    Company ||--o{ AutomationRule : "automationRules"
    Company ||--o{ AutomationExecution : "automationExecutions"
    Company ||--o{ Idea : "ideas"
    Company }o--|| CostSystemConfig : "costSystemConfig"
    Company ||--o{ MonthlyCostConsolidation : "monthlyCostConsolidations"
    Company ||--o{ LOTOProcedure : "lotoProcedures"
    Company ||--o{ PermitToWork : "permitsToWork"
    Company ||--o{ LOTOExecution : "lotoExecutions"
    Company ||--o{ ComponentFailureMode : "componentFailureModes"
    Company ||--o{ Skill : "skills"
    Company ||--o{ UserCertification : "userCertifications"
    Company ||--o{ TaskSkillRequirement : "taskSkillRequirements"
    Company ||--o{ MachineCounter : "machineCounters"
    Company ||--o{ ManagementOfChange : "managementOfChanges"
    Company ||--o{ AuditLog : "auditLogs"
    Company ||--o{ WorkShift : "workShifts"
    Company ||--o{ WorkCenter : "workCenters"
    Company ||--o{ ProductionReasonCode : "productionReasonCodes"
    Company ||--o{ ProductionOrder : "productionOrders"
    Company ||--o{ DailyProductionReport : "dailyProductionReports"
    Company ||--o{ ProductionDowntime : "productionDowntimes"
    Company ||--o{ ProductionQualityControl : "productionQualityControls"
    Company ||--o{ ProductionDefect : "productionDefects"
    Company ||--o{ ProductionBatchLot : "productionBatchLots"
    Company ||--o{ ProductionEvent : "productionEvents"
    Company ||--o{ ProductionRoutineTemplate : "productionRoutineTemplates"
    Company ||--o{ ProductionRoutine : "productionRoutines"
    Company ||--o{ DailyProductionSession : "dailyProductionSessions"
    Company ||--o{ DailyProductionEntry : "dailyProductionEntries"
    Company ||--o{ ProductionResourceType : "productionResourceTypes"
    Company ||--o{ ProductionResource : "productionResources"
    Company ||--o{ PrestressedMold : "prestressedMolds"
    Company ||--o{ CuringRecord : "curingRecords"
    Company ||--o{ VoicePurchaseLog : "voicePurchaseLogs"
    Company ||--o{ VoiceFailureLog : "voiceFailureLogs"
    Company ||--o{ RecurringPurchaseOrder : "recurringPurchaseOrders"
    Company ||--o{ AgendaTask : "agendaTasks"
    Company ||--o{ AgendaReminder : "agendaReminders"
    Company ||--o{ VoiceTaskLog : "voiceTaskLogs"
    Company ||--o{ StockReservation : "stockReservations"
    Company ||--o{ MaterialRequest : "materialRequests"
    Company ||--o{ Despacho : "despachos"
    Company ||--o{ DevolucionMaterial : "devoluciones"
    Company }o--|| ProductionStockConfig : "productionStockConfig"
    Company ||--o{ MachineImportJob : "machineImportJobs"
    Company ||--o{ SupplyCategory : "supplyCategories"
    Company ||--o{ ServiceContract : "serviceContracts"
    Company ||--o{ GRNIAccrual : "grniAccruals"
    Company ||--o{ ChatSession : "chatSessions"
    Company ||--o{ SaleRMA : "rmas"
    Company ||--o{ ProductWarranty : "warranties"
    Company ||--o{ SalesGoal : "salesGoals"
    Company ||--o{ SalesPerformanceDashboard : "performanceDashboards"
    Company ||--o{ ClientBalanceSnapshot : "clientBalanceSnapshots"
```
