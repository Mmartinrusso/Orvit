# Database Schema Documentation

> Auto-generated from `prisma/schema.prisma`
> Generated: 2026-02-12

## Overview

| Metric | Count |
|--------|-------|
| Models | 420 |
| Enums | 155 |
| Total Fields | 5821 |
| Total Relations | 2176 |
| Total Indexes | 1036 |

## Models by Category

### 🤖 AI (8)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [AIConfig](./models/AIConfig.md) | 27 | 1 | 0 |
| [AssistantActionLog](./models/AssistantActionLog.md) | 12 | 2 | 4 |
| [AssistantConversation](./models/AssistantConversation.md) | 8 | 3 | 2 |
| [AssistantEmbedding](./models/AssistantEmbedding.md) | 8 | 1 | 2 |
| [AssistantMessage](./models/AssistantMessage.md) | 12 | 1 | 1 |
| [DailyProductionEntry](./models/DailyProductionEntry.md) | 15 | 6 | 3 |
| [DailyProductionReport](./models/DailyProductionReport.md) | 33 | 12 | 3 |
| [DailyProductionSession](./models/DailyProductionSession.md) | 14 | 6 | 1 |

### 🔐 Auth (6)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Role](./models/Role.md) | 8 | 4 | 0 |
| [RolePermission](./models/RolePermission.md) | 6 | 2 | 0 |
| [Session](./models/Session.md) | 15 | 2 | 3 |
| [User](./models/User.md) | 15 | 240 | 2 |
| [UserOnCompany](./models/UserOnCompany.md) | 6 | 3 | 3 |
| [UserPermission](./models/UserPermission.md) | 9 | 3 | 0 |

### ⚙️ Automation (2)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [AutomationExecution](./models/AutomationExecution.md) | 11 | 3 | 3 |
| [AutomationRule](./models/AutomationRule.md) | 15 | 4 | 2 |

### 💳 Billing (7)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [BillingAuditLog](./models/BillingAuditLog.md) | 9 | 1 | 2 |
| [BillingCoupon](./models/BillingCoupon.md) | 20 | 4 | 3 |
| [BillingCouponRedemption](./models/BillingCouponRedemption.md) | 8 | 3 | 2 |
| [BillingInvoice](./models/BillingInvoice.md) | 17 | 7 | 4 |
| [BillingInvoiceItem](./models/BillingInvoiceItem.md) | 9 | 1 | 2 |
| [Subscription](./models/Subscription.md) | 17 | 9 | 3 |
| [SubscriptionPlan](./models/SubscriptionPlan.md) | 19 | 1 | 0 |

### 🏢 Core (6)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Company](./models/Company.md) | 29 | 208 | 3 |
| [CompanyModule](./models/CompanyModule.md) | 7 | 3 | 3 |
| [CompanySettings](./models/CompanySettings.md) | 11 | 1 | 0 |
| [CompanySettingsCosting](./models/CompanySettingsCosting.md) | 12 | 2 | 0 |
| [CompanyTemplate](./models/CompanyTemplate.md) | 12 | 1 | 0 |
| [CompanyViewConfig](./models/CompanyViewConfig.md) | 10 | 1 | 0 |

### 💰 Costs (36)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [cost_distribution_config](./models/cost_distribution_config.md) | 9 | 0 | 2 |
| [CostCenter](./models/CostCenter.md) | 9 | 5 | 2 |
| [CostEmployee](./models/CostEmployee.md) | 10 | 3 | 0 |
| [CostParam](./models/CostParam.md) | 2 | 0 | 0 |
| [CostProduct](./models/CostProduct.md) | 8 | 14 | 0 |
| [CostSystemConfig](./models/CostSystemConfig.md) | 13 | 1 | 0 |
| [CostVarianceMonthly](./models/CostVarianceMonthly.md) | 11 | 3 | 0 |
| [employee_cost_distribution](./models/employee_cost_distribution.md) | 10 | 0 | 3 |
| [indirect_cost_base](./models/indirect_cost_base.md) | 10 | 0 | 1 |
| [indirect_cost_categories](./models/indirect_cost_categories.md) | 11 | 0 | 1 |
| [indirect_cost_change_history](./models/indirect_cost_change_history.md) | 14 | 0 | 2 |
| [indirect_cost_history](./models/indirect_cost_history.md) | 9 | 0 | 2 |
| [indirect_cost_monthly_records](./models/indirect_cost_monthly_records.md) | 12 | 0 | 3 |
| [indirect_costs](./models/indirect_costs.md) | 13 | 0 | 3 |
| [IndirectItem](./models/IndirectItem.md) | 7 | 6 | 0 |
| [IndirectItemAllocation](./models/IndirectItemAllocation.md) | 7 | 2 | 2 |
| [IndirectItemAllocationMonthly](./models/IndirectItemAllocationMonthly.md) | 8 | 2 | 2 |
| [IndirectPriceHistory](./models/IndirectPriceHistory.md) | 6 | 1 | 2 |
| [InputItem](./models/InputItem.md) | 10 | 6 | 1 |
| [InputPriceHistory](./models/InputPriceHistory.md) | 6 | 1 | 2 |
| [MonthlyCostConsolidation](./models/MonthlyCostConsolidation.md) | 19 | 2 | 1 |
| [MonthlyIndirect](./models/MonthlyIndirect.md) | 8 | 3 | 1 |
| [MonthlyProduction](./models/MonthlyProduction.md) | 5 | 2 | 0 |
| [PayrollInput](./models/PayrollInput.md) | 8 | 2 | 2 |
| [ProductCostHistory](./models/ProductCostHistory.md) | 11 | 3 | 0 |
| [ProductCostLog](./models/ProductCostLog.md) | 16 | 2 | 3 |
| [ProductionMethod](./models/ProductionMethod.md) | 7 | 3 | 0 |
| [ProductStandardCost](./models/ProductStandardCost.md) | 11 | 2 | 0 |
| [Recipe](./models/Recipe.md) | 19 | 8 | 0 |
| [recipe_change_history](./models/recipe_change_history.md) | 7 | 1 | 1 |
| [recipe_cost_tests](./models/recipe_cost_tests.md) | 10 | 1 | 3 |
| [recipe_items](./models/recipe_items.md) | 13 | 1 | 2 |
| [RecipeItem](./models/RecipeItem.md) | 5 | 2 | 0 |
| [recipes](./models/recipes.md) | 22 | 1 | 2 |
| [TechnicianCostRate](./models/TechnicianCostRate.md) | 12 | 2 | 1 |
| [ThirdPartyCost](./models/ThirdPartyCost.md) | 13 | 3 | 2 |

### 📊 Dashboard (2)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [UserColorPreferences](./models/UserColorPreferences.md) | 26 | 2 | 2 |
| [UserDashboardConfig](./models/UserDashboardConfig.md) | 8 | 2 | 2 |

### 📎 Documents (2)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Document](./models/Document.md) | 17 | 6 | 4 |
| [MOCDocument](./models/MOCDocument.md) | 8 | 2 | 1 |

### 💡 Ideas (3)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Idea](./models/Idea.md) | 19 | 13 | 4 |
| [IdeaComment](./models/IdeaComment.md) | 6 | 2 | 1 |
| [IdeaVote](./models/IdeaVote.md) | 4 | 2 | 0 |

### 💬 Integrations (1)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [UserDiscordAccess](./models/UserDiscordAccess.md) | 9 | 3 | 1 |

### 🚛 Logistics (6)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [KilometrajeLog](./models/KilometrajeLog.md) | 8 | 4 | 2 |
| [TransportCompany](./models/TransportCompany.md) | 9 | 2 | 1 |
| [Truck](./models/Truck.md) | 16 | 3 | 3 |
| [UnidadMovil](./models/UnidadMovil.md) | 23 | 5 | 5 |
| [ZoneAllocation](./models/ZoneAllocation.md) | 7 | 2 | 2 |
| [ZoneAllocationMonthly](./models/ZoneAllocationMonthly.md) | 8 | 2 | 2 |

### 🔧 Maintenance (60)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [ActivityEvent](./models/ActivityEvent.md) | 11 | 2 | 3 |
| [checklist_executions](./models/checklist_executions.md) | 11 | 1 | 0 |
| [checklist_items](./models/checklist_items.md) | 13 | 1 | 0 |
| [ChecklistExecution](./models/ChecklistExecution.md) | 14 | 0 | 4 |
| [ChecklistInstructive](./models/ChecklistInstructive.md) | 7 | 0 | 1 |
| [ClientPortalActivity](./models/ClientPortalActivity.md) | 10 | 2 | 5 |
| [Component](./models/Component.md) | 18 | 14 | 5 |
| [ComponentFailureMode](./models/ComponentFailureMode.md) | 20 | 2 | 4 |
| [ComponentTool](./models/ComponentTool.md) | 13 | 3 | 1 |
| [CorrectiveChecklistTemplate](./models/CorrectiveChecklistTemplate.md) | 14 | 2 | 3 |
| [CorrectiveSettings](./models/CorrectiveSettings.md) | 16 | 1 | 0 |
| [CounterMaintenanceTrigger](./models/CounterMaintenanceTrigger.md) | 9 | 2 | 2 |
| [DowntimeLog](./models/DowntimeLog.md) | 14 | 6 | 5 |
| [EmployeeSalaryComponent](./models/EmployeeSalaryComponent.md) | 7 | 2 | 2 |
| [Failure](./models/Failure.md) | 15 | 2 | 4 |
| [FailureOccurrence](./models/FailureOccurrence.md) | 32 | 18 | 15 |
| [FailureOccurrenceComment](./models/FailureOccurrenceComment.md) | 8 | 2 | 2 |
| [FailureOccurrenceEvent](./models/FailureOccurrenceEvent.md) | 13 | 4 | 3 |
| [FailureSolution](./models/FailureSolution.md) | 17 | 3 | 3 |
| [FailureWatcher](./models/FailureWatcher.md) | 6 | 2 | 1 |
| [GremioCategoryTemplate](./models/GremioCategoryTemplate.md) | 9 | 1 | 1 |
| [GremioTemplate](./models/GremioTemplate.md) | 12 | 2 | 0 |
| [LOTOExecution](./models/LOTOExecution.md) | 21 | 8 | 5 |
| [LOTOProcedure](./models/LOTOProcedure.md) | 22 | 5 | 3 |
| [Machine](./models/Machine.md) | 40 | 31 | 9 |
| [machine_order_temp](./models/machine_order_temp.md) | 6 | 0 | 0 |
| [MachineCounter](./models/MachineCounter.md) | 11 | 5 | 2 |
| [MachineCounterReading](./models/MachineCounterReading.md) | 9 | 2 | 2 |
| [MachineImportFile](./models/MachineImportFile.md) | 14 | 2 | 2 |
| [MachineImportFileAnalysis](./models/MachineImportFileAnalysis.md) | 10 | 2 | 1 |
| [MachineImportJob](./models/MachineImportJob.md) | 23 | 6 | 4 |
| [MachineOrder](./models/MachineOrder.md) | 6 | 2 | 0 |
| [maintenance_configs](./models/maintenance_configs.md) | 10 | 4 | 0 |
| [maintenance_history](./models/maintenance_history.md) | 20 | 4 | 0 |
| [MaintenanceBudget](./models/MaintenanceBudget.md) | 13 | 3 | 1 |
| [MaintenanceChecklist](./models/MaintenanceChecklist.md) | 18 | 8 | 3 |
| [MaintenanceCostBreakdown](./models/MaintenanceCostBreakdown.md) | 11 | 2 | 2 |
| [PermitToWork](./models/PermitToWork.md) | 44 | 16 | 6 |
| [ProductionDowntime](./models/ProductionDowntime.md) | 25 | 9 | 4 |
| [ProductionQualityControl](./models/ProductionQualityControl.md) | 18 | 5 | 3 |
| [ProductionRoutineTemplate](./models/ProductionRoutineTemplate.md) | 14 | 4 | 1 |
| [QualityAssurance](./models/QualityAssurance.md) | 14 | 5 | 2 |
| [RootCauseAnalysis](./models/RootCauseAnalysis.md) | 12 | 4 | 2 |
| [SalaryComponent](./models/SalaryComponent.md) | 26 | 7 | 1 |
| [SolutionApplication](./models/SolutionApplication.md) | 12 | 4 | 5 |
| [SolutionApplied](./models/SolutionApplied.md) | 26 | 7 | 9 |
| [SparePartReservation](./models/SparePartReservation.md) | 11 | 6 | 3 |
| [SymptomLibrary](./models/SymptomLibrary.md) | 12 | 1 | 2 |
| [Template](./models/Template.md) | 13 | 4 | 2 |
| [ToolMachine](./models/ToolMachine.md) | 7 | 2 | 0 |
| [VoiceFailureLog](./models/VoiceFailureLog.md) | 23 | 3 | 5 |
| [WorkOrder](./models/WorkOrder.md) | 57 | 40 | 13 |
| [WorkOrderAttachment](./models/WorkOrderAttachment.md) | 8 | 2 | 1 |
| [WorkOrderChecklist](./models/WorkOrderChecklist.md) | 10 | 4 | 3 |
| [WorkOrderComment](./models/WorkOrderComment.md) | 6 | 2 | 1 |
| [WorkOrderWatcher](./models/WorkOrderWatcher.md) | 6 | 2 | 1 |
| [WorkStation](./models/WorkStation.md) | 8 | 7 | 0 |
| [WorkStationComponent](./models/WorkStationComponent.md) | 7 | 2 | 0 |
| [WorkStationInstructive](./models/WorkStationInstructive.md) | 16 | 2 | 0 |
| [WorkStationMachine](./models/WorkStationMachine.md) | 7 | 2 | 0 |

### 🔔 Notifications (6)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [AgendaReminder](./models/AgendaReminder.md) | 13 | 4 | 2 |
| [ComprasNotification](./models/ComprasNotification.md) | 11 | 0 | 3 |
| [Notification](./models/Notification.md) | 9 | 4 | 3 |
| [NotificationOutbox](./models/NotificationOutbox.md) | 15 | 1 | 3 |
| [NotificationPreferences](./models/NotificationPreferences.md) | 22 | 2 | 0 |
| [Reminder](./models/Reminder.md) | 11 | 3 | 0 |

### 🏗️ Organization (5)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Area](./models/Area.md) | 8 | 4 | 0 |
| [Line](./models/Line.md) | 6 | 8 | 0 |
| [PlantZone](./models/PlantZone.md) | 12 | 5 | 3 |
| [Sector](./models/Sector.md) | 19 | 22 | 0 |
| [Zone](./models/Zone.md) | 6 | 4 | 1 |

### 📁 Other (82)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [AdvanceInstallment](./models/AdvanceInstallment.md) | 8 | 1 | 2 |
| [AgendaTask](./models/AgendaTask.md) | 17 | 9 | 5 |
| [ApprovalAction](./models/ApprovalAction.md) | 7 | 1 | 1 |
| [ApprovalDelegation](./models/ApprovalDelegation.md) | 7 | 0 | 2 |
| [ApprovalInstance](./models/ApprovalInstance.md) | 10 | 2 | 2 |
| [ApprovalWorkflow](./models/ApprovalWorkflow.md) | 11 | 2 | 1 |
| [ApprovalWorkflowLevel](./models/ApprovalWorkflowLevel.md) | 7 | 1 | 1 |
| [AttendanceEvent](./models/AttendanceEvent.md) | 12 | 2 | 2 |
| [AuditLog](./models/AuditLog.md) | 14 | 3 | 5 |
| [BatchRun](./models/BatchRun.md) | 7 | 1 | 0 |
| [BusinessSector](./models/BusinessSector.md) | 7 | 2 | 1 |
| [ChatMessage](./models/ChatMessage.md) | 6 | 1 | 2 |
| [ChatSession](./models/ChatSession.md) | 8 | 4 | 4 |
| [Client](./models/Client.md) | 75 | 34 | 16 |
| [ClientPriceList](./models/ClientPriceList.md) | 8 | 1 | 2 |
| [CompanyQuotationSettings](./models/CompanyQuotationSettings.md) | 12 | 1 | 0 |
| [Contact](./models/Contact.md) | 14 | 4 | 0 |
| [ContactInteraction](./models/ContactInteraction.md) | 12 | 2 | 0 |
| [CreditDebitNoteItem](./models/CreditDebitNoteItem.md) | 8 | 2 | 1 |
| [CreditNoteRequest](./models/CreditNoteRequest.md) | 20 | 10 | 6 |
| [CreditNoteRequestItem](./models/CreditNoteRequestItem.md) | 11 | 2 | 1 |
| [CuringRecord](./models/CuringRecord.md) | 18 | 3 | 2 |
| [Despacho](./models/Despacho.md) | 19 | 13 | 5 |
| [DespachoItem](./models/DespachoItem.md) | 15 | 5 | 3 |
| [DevolucionMaterial](./models/DevolucionMaterial.md) | 12 | 9 | 3 |
| [DevolucionMaterialItem](./models/DevolucionMaterialItem.md) | 7 | 4 | 3 |
| [DuplicateDetection](./models/DuplicateDetection.md) | 12 | 1 | 4 |
| [FactPnLMonthly](./models/FactPnLMonthly.md) | 11 | 1 | 0 |
| [FactSalesMonthly](./models/FactSalesMonthly.md) | 6 | 1 | 0 |
| [GeneralConfig](./models/GeneralConfig.md) | 28 | 1 | 0 |
| [GlobalAllocation](./models/GlobalAllocation.md) | 5 | 1 | 0 |
| [GRNIAccrual](./models/GRNIAccrual.md) | 20 | 4 | 4 |
| [HistoryEvent](./models/HistoryEvent.md) | 11 | 4 | 0 |
| [IntegrationConfig](./models/IntegrationConfig.md) | 34 | 1 | 0 |
| [InterventionKit](./models/InterventionKit.md) | 11 | 2 | 1 |
| [InventoryLot](./models/InventoryLot.md) | 15 | 3 | 2 |
| [LoginAttempt](./models/LoginAttempt.md) | 8 | 1 | 3 |
| [LotInstallation](./models/LotInstallation.md) | 15 | 6 | 3 |
| [ManagementOfChange](./models/ManagementOfChange.md) | 31 | 15 | 3 |
| [MaterialRequest](./models/MaterialRequest.md) | 17 | 14 | 4 |
| [MaterialRequestItem](./models/MaterialRequestItem.md) | 10 | 4 | 3 |
| [MethodConversion](./models/MethodConversion.md) | 8 | 3 | 0 |
| [MethodProductYield](./models/MethodProductYield.md) | 7 | 3 | 0 |
| [MOCHistory](./models/MOCHistory.md) | 7 | 2 | 1 |
| [MOCTask](./models/MOCTask.md) | 11 | 3 | 1 |
| [Module](./models/Module.md) | 10 | 2 | 0 |
| [monthly_production](./models/monthly_production.md) | 12 | 0 | 3 |
| [monthly_sales](./models/monthly_sales.md) | 12 | 0 | 3 |
| [Permission](./models/Permission.md) | 7 | 2 | 0 |
| [PermissionAuditLog](./models/PermissionAuditLog.md) | 12 | 0 | 3 |
| [PerUnitBOM](./models/PerUnitBOM.md) | 5 | 2 | 0 |
| [PrestressedMold](./models/PrestressedMold.md) | 14 | 3 | 1 |
| [Project](./models/Project.md) | 11 | 5 | 2 |
| [QuotationStatusHistory](./models/QuotationStatusHistory.md) | 7 | 4 | 1 |
| [RateLimitEntry](./models/RateLimitEntry.md) | 7 | 0 | 1 |
| [RefreshToken](./models/RefreshToken.md) | 8 | 2 | 3 |
| [ReplenishmentSuggestion](./models/ReplenishmentSuggestion.md) | 18 | 3 | 4 |
| [SecurityEvent](./models/SecurityEvent.md) | 8 | 1 | 3 |
| [SellerKPI](./models/SellerKPI.md) | 16 | 1 | 3 |
| [ServiceContract](./models/ServiceContract.md) | 29 | 8 | 5 |
| [ServiceContractAlert](./models/ServiceContractAlert.md) | 9 | 1 | 3 |
| [Stock](./models/Stock.md) | 9 | 1 | 1 |
| [StockLocation](./models/StockLocation.md) | 18 | 3 | 3 |
| [StockMovement](./models/StockMovement.md) | 26 | 14 | 14 |
| [StockReservation](./models/StockReservation.md) | 15 | 10 | 6 |
| [Subtask](./models/Subtask.md) | 6 | 1 | 0 |
| [supplies](./models/supplies.md) | 14 | 3 | 2 |
| [supply_monthly_prices](./models/supply_monthly_prices.md) | 11 | 1 | 3 |
| [supply_price_history](./models/supply_price_history.md) | 12 | 1 | 0 |
| [SupplyCategory](./models/SupplyCategory.md) | 13 | 3 | 2 |
| [TokenBlacklist](./models/TokenBlacklist.md) | 7 | 0 | 3 |
| [TokenTransaction](./models/TokenTransaction.md) | 12 | 2 | 3 |
| [TrustedDevice](./models/TrustedDevice.md) | 8 | 1 | 3 |
| [UnionCategory](./models/UnionCategory.md) | 9 | 4 | 1 |
| [UserTwoFactor](./models/UserTwoFactor.md) | 9 | 1 | 0 |
| [ViewModeLog](./models/ViewModeLog.md) | 7 | 0 | 1 |
| [VoiceTaskLog](./models/VoiceTaskLog.md) | 15 | 4 | 3 |
| [VolumetricParam](./models/VolumetricParam.md) | 3 | 1 | 0 |
| [WorkCenter](./models/WorkCenter.md) | 16 | 13 | 1 |
| [WorkLog](./models/WorkLog.md) | 11 | 2 | 2 |
| [WorkShift](./models/WorkShift.md) | 11 | 5 | 1 |
| [YieldConfig](./models/YieldConfig.md) | 10 | 1 | 0 |

### 💼 Payroll (24)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [AgreementRate](./models/AgreementRate.md) | 13 | 3 | 3 |
| [CompanyHoliday](./models/CompanyHoliday.md) | 6 | 1 | 1 |
| [Employee](./models/Employee.md) | 17 | 13 | 5 |
| [employee_distribution_config](./models/employee_distribution_config.md) | 8 | 0 | 2 |
| [employee_monthly_salaries](./models/employee_monthly_salaries.md) | 11 | 2 | 4 |
| [employee_salary_history_new](./models/employee_salary_history_new.md) | 8 | 0 | 3 |
| [EmployeeCategory](./models/EmployeeCategory.md) | 12 | 5 | 1 |
| [EmployeeCompHistory](./models/EmployeeCompHistory.md) | 8 | 1 | 1 |
| [EmployeeFixedConcept](./models/EmployeeFixedConcept.md) | 14 | 2 | 2 |
| [EmployeeSalaryHistory](./models/EmployeeSalaryHistory.md) | 9 | 2 | 2 |
| [Payroll](./models/Payroll.md) | 21 | 5 | 2 |
| [PayrollAuditLog](./models/PayrollAuditLog.md) | 8 | 2 | 3 |
| [PayrollConfig](./models/PayrollConfig.md) | 11 | 1 | 0 |
| [PayrollItem](./models/PayrollItem.md) | 14 | 3 | 2 |
| [PayrollItemLine](./models/PayrollItemLine.md) | 11 | 2 | 3 |
| [PayrollPeriod](./models/PayrollPeriod.md) | 13 | 8 | 3 |
| [PayrollRun](./models/PayrollRun.md) | 25 | 4 | 2 |
| [PayrollRunItem](./models/PayrollRunItem.md) | 14 | 3 | 1 |
| [PayrollRunItemLine](./models/PayrollRunItemLine.md) | 13 | 2 | 3 |
| [PayrollUnion](./models/PayrollUnion.md) | 13 | 4 | 2 |
| [PayrollVariableConcept](./models/PayrollVariableConcept.md) | 16 | 3 | 2 |
| [SalaryAdvance](./models/SalaryAdvance.md) | 18 | 4 | 3 |
| [WorkPosition](./models/WorkPosition.md) | 9 | 2 | 2 |
| [WorkSector](./models/WorkSector.md) | 10 | 3 | 2 |

### 🌐 Portal (6)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [ClientPortalAccess](./models/ClientPortalAccess.md) | 8 | 2 | 3 |
| [ClientPortalInvite](./models/ClientPortalInvite.md) | 9 | 2 | 3 |
| [ClientPortalOrder](./models/ClientPortalOrder.md) | 23 | 5 | 4 |
| [ClientPortalOrderItem](./models/ClientPortalOrderItem.md) | 9 | 2 | 1 |
| [ClientPortalSession](./models/ClientPortalSession.md) | 10 | 2 | 3 |
| [ClientPortalUser](./models/ClientPortalUser.md) | 24 | 8 | 3 |

### 📦 Products (18)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Category](./models/Category.md) | 9 | 6 | 1 |
| [CategoryDefaultConcept](./models/CategoryDefaultConcept.md) | 10 | 3 | 2 |
| [Product](./models/Product.md) | 40 | 24 | 6 |
| [product_categories](./models/product_categories.md) | 8 | 0 | 0 |
| [product_subcategories](./models/product_subcategories.md) | 10 | 0 | 0 |
| [ProductionBatchLot](./models/ProductionBatchLot.md) | 17 | 6 | 2 |
| [ProductionDefect](./models/ProductionDefect.md) | 13 | 6 | 2 |
| [ProductionEvent](./models/ProductionEvent.md) | 11 | 3 | 3 |
| [ProductionOrder](./models/ProductionOrder.md) | 26 | 18 | 4 |
| [ProductionReasonCode](./models/ProductionReasonCode.md) | 13 | 5 | 1 |
| [ProductionResource](./models/ProductionResource.md) | 11 | 3 | 2 |
| [ProductionResourceType](./models/ProductionResourceType.md) | 10 | 2 | 1 |
| [ProductionRoutine](./models/ProductionRoutine.md) | 18 | 5 | 3 |
| [ProductionStockConfig](./models/ProductionStockConfig.md) | 7 | 3 | 0 |
| [products](./models/products.md) | 22 | 1 | 4 |
| [ProductStockMovement](./models/ProductStockMovement.md) | 13 | 4 | 2 |
| [ProductVariant](./models/ProductVariant.md) | 3 | 1 | 0 |
| [ProductWarranty](./models/ProductWarranty.md) | 21 | 3 | 5 |

### 🛍️ Purchases (45)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [CreditDebitNote](./models/CreditDebitNote.md) | 25 | 13 | 7 |
| [FactPurchasesMonthly](./models/FactPurchasesMonthly.md) | 5 | 1 | 0 |
| [GoodsReceipt](./models/GoodsReceipt.md) | 28 | 17 | 8 |
| [GoodsReceiptItem](./models/GoodsReceiptItem.md) | 16 | 4 | 3 |
| [InventoryItemSupplier](./models/InventoryItemSupplier.md) | 13 | 1 | 2 |
| [MatchException](./models/MatchException.md) | 24 | 6 | 6 |
| [MatchExceptionHistory](./models/MatchExceptionHistory.md) | 11 | 2 | 1 |
| [MatchExceptionSLAConfig](./models/MatchExceptionSLAConfig.md) | 10 | 1 | 0 |
| [MatchLineResult](./models/MatchLineResult.md) | 19 | 2 | 2 |
| [MatchResult](./models/MatchResult.md) | 17 | 7 | 3 |
| [PurchaseAccount](./models/PurchaseAccount.md) | 7 | 2 | 2 |
| [PurchaseAdvancedConfig](./models/PurchaseAdvancedConfig.md) | 24 | 1 | 0 |
| [PurchaseApproval](./models/PurchaseApproval.md) | 14 | 7 | 5 |
| [PurchaseAuditLog](./models/PurchaseAuditLog.md) | 12 | 2 | 6 |
| [PurchaseComment](./models/PurchaseComment.md) | 9 | 3 | 3 |
| [PurchaseConfig](./models/PurchaseConfig.md) | 26 | 1 | 0 |
| [PurchaseOrder](./models/PurchaseOrder.md) | 32 | 14 | 7 |
| [PurchaseOrderItem](./models/PurchaseOrderItem.md) | 15 | 3 | 2 |
| [PurchaseQuotation](./models/PurchaseQuotation.md) | 39 | 8 | 7 |
| [PurchaseQuotationItem](./models/PurchaseQuotationItem.md) | 17 | 3 | 3 |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | 60 | 24 | 21 |
| [PurchaseReceiptItem](./models/PurchaseReceiptItem.md) | 13 | 2 | 4 |
| [PurchaseRequest](./models/PurchaseRequest.md) | 15 | 8 | 8 |
| [PurchaseRequestItem](./models/PurchaseRequestItem.md) | 7 | 3 | 1 |
| [PurchaseReturn](./models/PurchaseReturn.md) | 28 | 11 | 6 |
| [PurchaseReturnItem](./models/PurchaseReturnItem.md) | 10 | 4 | 2 |
| [RecurringPurchaseHistory](./models/RecurringPurchaseHistory.md) | 6 | 1 | 2 |
| [RecurringPurchaseItem](./models/RecurringPurchaseItem.md) | 6 | 1 | 1 |
| [RecurringPurchaseOrder](./models/RecurringPurchaseOrder.md) | 18 | 6 | 3 |
| [SoDRule](./models/SoDRule.md) | 11 | 2 | 0 |
| [SoDViolation](./models/SoDViolation.md) | 11 | 3 | 2 |
| [StockAdjustment](./models/StockAdjustment.md) | 14 | 8 | 3 |
| [StockAdjustmentItem](./models/StockAdjustmentItem.md) | 7 | 2 | 1 |
| [StockTransfer](./models/StockTransfer.md) | 12 | 7 | 2 |
| [StockTransferItem](./models/StockTransferItem.md) | 7 | 2 | 1 |
| [SupplierAccountMovement](./models/SupplierAccountMovement.md) | 21 | 8 | 8 |
| [SupplierChangeRequest](./models/SupplierChangeRequest.md) | 19 | 5 | 2 |
| [SupplierCreditAllocation](./models/SupplierCreditAllocation.md) | 10 | 3 | 3 |
| [SupplierItem](./models/SupplierItem.md) | 14 | 22 | 5 |
| [SupplierItemAlias](./models/SupplierItemAlias.md) | 10 | 1 | 4 |
| [SupplierLeadTime](./models/SupplierLeadTime.md) | 11 | 1 | 2 |
| [suppliers](./models/suppliers.md) | 34 | 18 | 4 |
| [UserWarehouseScope](./models/UserWarehouseScope.md) | 6 | 2 | 0 |
| [VoicePurchaseLog](./models/VoicePurchaseLog.md) | 17 | 3 | 4 |
| [Warehouse](./models/Warehouse.md) | 11 | 14 | 2 |

### 🛒 Sales (53)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [AcopioRetiro](./models/AcopioRetiro.md) | 19 | 5 | 3 |
| [AcopioRetiroItem](./models/AcopioRetiroItem.md) | 4 | 1 | 2 |
| [ClientBalanceSnapshot](./models/ClientBalanceSnapshot.md) | 9 | 2 | 2 |
| [ClientBlockHistory](./models/ClientBlockHistory.md) | 13 | 4 | 4 |
| [ClientContact](./models/ClientContact.md) | 14 | 3 | 3 |
| [ClientDiscount](./models/ClientDiscount.md) | 14 | 1 | 2 |
| [ClientLedgerEntry](./models/ClientLedgerEntry.md) | 20 | 8 | 9 |
| [ClientNote](./models/ClientNote.md) | 13 | 3 | 5 |
| [ClientType](./models/ClientType.md) | 7 | 2 | 1 |
| [CollectionAttempt](./models/CollectionAttempt.md) | 12 | 3 | 5 |
| [DeliveryZone](./models/DeliveryZone.md) | 7 | 2 | 1 |
| [DiscountList](./models/DiscountList.md) | 7 | 4 | 2 |
| [DiscountListProduct](./models/DiscountListProduct.md) | 9 | 2 | 2 |
| [DiscountListRubro](./models/DiscountListRubro.md) | 13 | 2 | 2 |
| [InvoicePaymentAllocation](./models/InvoicePaymentAllocation.md) | 6 | 2 | 2 |
| [Load](./models/Load.md) | 14 | 4 | 5 |
| [LoadItem](./models/LoadItem.md) | 11 | 1 | 2 |
| [LoadOrder](./models/LoadOrder.md) | 21 | 8 | 7 |
| [LoadOrderItem](./models/LoadOrderItem.md) | 18 | 3 | 3 |
| [PriceComparison](./models/PriceComparison.md) | 5 | 2 | 1 |
| [PriceComparisonCompetitor](./models/PriceComparisonCompetitor.md) | 3 | 2 | 1 |
| [PriceComparisonProductPrice](./models/PriceComparisonProductPrice.md) | 6 | 1 | 2 |
| [PriceHistory](./models/PriceHistory.md) | 7 | 2 | 3 |
| [Quote](./models/Quote.md) | 44 | 15 | 16 |
| [QuoteAcceptance](./models/QuoteAcceptance.md) | 13 | 2 | 0 |
| [QuoteAttachment](./models/QuoteAttachment.md) | 7 | 1 | 1 |
| [QuoteItem](./models/QuoteItem.md) | 14 | 2 | 2 |
| [QuoteVersion](./models/QuoteVersion.md) | 7 | 2 | 1 |
| [Sale](./models/Sale.md) | 34 | 15 | 11 |
| [SaleAcopio](./models/SaleAcopio.md) | 15 | 9 | 5 |
| [SaleAcopioItem](./models/SaleAcopioItem.md) | 11 | 2 | 2 |
| [SaleDelivery](./models/SaleDelivery.md) | 27 | 10 | 7 |
| [SaleDeliveryEvidence](./models/SaleDeliveryEvidence.md) | 6 | 1 | 1 |
| [SaleDeliveryItem](./models/SaleDeliveryItem.md) | 6 | 3 | 2 |
| [SaleItem](./models/SaleItem.md) | 15 | 6 | 2 |
| [SaleRemito](./models/SaleRemito.md) | 13 | 8 | 6 |
| [SaleRemitoItem](./models/SaleRemitoItem.md) | 5 | 3 | 2 |
| [SaleRMA](./models/SaleRMA.md) | 27 | 10 | 5 |
| [SaleRMAHistory](./models/SaleRMAHistory.md) | 5 | 4 | 2 |
| [SaleRMAItem](./models/SaleRMAItem.md) | 13 | 2 | 2 |
| [SalesApproval](./models/SalesApproval.md) | 14 | 7 | 3 |
| [SalesAuditLog](./models/SalesAuditLog.md) | 12 | 1 | 4 |
| [SalesConfig](./models/SalesConfig.md) | 148 | 1 | 0 |
| [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | 23 | 9 | 6 |
| [SalesCreditDebitNoteItem](./models/SalesCreditDebitNoteItem.md) | 9 | 2 | 1 |
| [SalesGoal](./models/SalesGoal.md) | 21 | 7 | 5 |
| [SalesGoalProgress](./models/SalesGoalProgress.md) | 11 | 1 | 2 |
| [SalesInvoice](./models/SalesInvoice.md) | 34 | 13 | 13 |
| [SalesInvoiceItem](./models/SalesInvoiceItem.md) | 12 | 3 | 2 |
| [SalesPerformanceDashboard](./models/SalesPerformanceDashboard.md) | 16 | 2 | 2 |
| [SalesPriceList](./models/SalesPriceList.md) | 12 | 4 | 2 |
| [SalesPriceListItem](./models/SalesPriceListItem.md) | 5 | 2 | 2 |
| [SalesPriceLog](./models/SalesPriceLog.md) | 11 | 3 | 4 |

### 📋 Tasks (7)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [FixedTask](./models/FixedTask.md) | 17 | 8 | 0 |
| [FixedTaskExecution](./models/FixedTaskExecution.md) | 12 | 3 | 0 |
| [FixedTaskInstructive](./models/FixedTaskInstructive.md) | 8 | 1 | 0 |
| [Task](./models/Task.md) | 12 | 8 | 0 |
| [TaskAttachment](./models/TaskAttachment.md) | 8 | 2 | 0 |
| [TaskComment](./models/TaskComment.md) | 6 | 2 | 0 |
| [TaskSkillRequirement](./models/TaskSkillRequirement.md) | 11 | 4 | 5 |

### 📑 Tax (3)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Control](./models/Control.md) | 9 | 2 | 3 |
| [TaxBase](./models/TaxBase.md) | 11 | 3 | 3 |
| [TaxRecord](./models/TaxRecord.md) | 12 | 4 | 4 |

### 🔨 Tools (5)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [SectorTool](./models/SectorTool.md) | 8 | 2 | 0 |
| [Tool](./models/Tool.md) | 34 | 16 | 0 |
| [ToolLoan](./models/ToolLoan.md) | 9 | 4 | 0 |
| [ToolMovement](./models/ToolMovement.md) | 7 | 2 | 0 |
| [ToolRequest](./models/ToolRequest.md) | 9 | 2 | 0 |

### 🏦 Treasury (23)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [BankAccount](./models/BankAccount.md) | 17 | 9 | 2 |
| [BankMovement](./models/BankMovement.md) | 20 | 8 | 4 |
| [BankStatement](./models/BankStatement.md) | 21 | 7 | 4 |
| [BankStatementItem](./models/BankStatementItem.md) | 18 | 4 | 4 |
| [BillingAutoPaymentConfig](./models/BillingAutoPaymentConfig.md) | 16 | 1 | 2 |
| [BillingPayment](./models/BillingPayment.md) | 11 | 4 | 2 |
| [CashAccount](./models/CashAccount.md) | 11 | 5 | 2 |
| [CashMovement](./models/CashMovement.md) | 16 | 7 | 5 |
| [Cheque](./models/Cheque.md) | 23 | 12 | 5 |
| [ClientPayment](./models/ClientPayment.md) | 28 | 12 | 9 |
| [ClientPaymentCheque](./models/ClientPaymentCheque.md) | 10 | 2 | 2 |
| [IdempotencyKey](./models/IdempotencyKey.md) | 11 | 1 | 2 |
| [PaymentOrder](./models/PaymentOrder.md) | 26 | 12 | 5 |
| [PaymentOrderAttachment](./models/PaymentOrderAttachment.md) | 8 | 1 | 1 |
| [PaymentOrderCheque](./models/PaymentOrderCheque.md) | 10 | 1 | 2 |
| [PaymentOrderReceipt](./models/PaymentOrderReceipt.md) | 5 | 2 | 2 |
| [PaymentRequest](./models/PaymentRequest.md) | 20 | 9 | 5 |
| [PaymentRequestLog](./models/PaymentRequestLog.md) | 10 | 2 | 3 |
| [PaymentRequestReceipt](./models/PaymentRequestReceipt.md) | 5 | 2 | 2 |
| [ServicePayment](./models/ServicePayment.md) | 14 | 1 | 3 |
| [TreasuryConfig](./models/TreasuryConfig.md) | 25 | 1 | 0 |
| [TreasuryMovement](./models/TreasuryMovement.md) | 21 | 9 | 6 |
| [TreasuryTransfer](./models/TreasuryTransfer.md) | 14 | 8 | 4 |

### 👷 Workers (4)

| Model | Fields | Relations | Indexes |
|-------|--------|-----------|--------|
| [Skill](./models/Skill.md) | 9 | 3 | 2 |
| [UserCertification](./models/UserCertification.md) | 13 | 3 | 4 |
| [UserSkill](./models/UserSkill.md) | 12 | 3 | 3 |
| [Worker](./models/Worker.md) | 8 | 5 | 0 |

## Enums

### KilometrajeLogTipo

`MANUAL // Actualización manual` | `MANTENIMIENTO // Registrado durante mantenimiento` | `COMBUSTIBLE // Registrado al cargar combustible` | `VIAJE // Registrado inicio/fin de viaje` | `INSPECCION // Inspección diaria/semanal`

### ImportJobStatus

`UPLOADING` | `QUEUED` | `PROCESSING` | `EXTRACTING` | `MERGING` | `DRAFT_READY` | `CONFIRMED` | `COMPLETED` | `ERROR` | `CANCELLED`

### ProductStockMovementType

`ENTRADA` | `SALIDA` | `AJUSTE`

### AccountMovementType

`FACTURA` | `NC` | `ND` | `PAGO` | `ANTICIPO` | `RETENCION` | `AJUSTE`

### LoadStatus

`DRAFT` | `PENDING` | `IN_TRANSIT` | `DELIVERED` | `CANCELLED`

### ChecklistFrequency

`DAILY` | `WEEKLY` | `BIWEEKLY` | `MONTHLY` | `QUARTERLY` | `SEMIANNUAL` | `ANNUAL`

### UserRole

`USER` | `ADMIN` | `ADMIN_ENTERPRISE` | `SUPERADMIN` | `SUPERVISOR`

### MachineStatus

`ACTIVE` | `OUT_OF_SERVICE` | `DECOMMISSIONED` | `MAINTENANCE`

### MachineType

`PRODUCTION` | `MAINTENANCE` | `UTILITY` | `PACKAGING` | `TRANSPORTATION` | `OTHER`

### WorkOrderStatus

`INCOMING // Recién creada, sin asignar/planificar` | `PENDING // Asignada pero no iniciada (legacy, mantener por compatibilidad)` | `SCHEDULED // Planificada con fecha y responsable` | `IN_PROGRESS // En ejecución` | `WAITING // En espera (repuesto, proveedor, producción, etc.)` | `COMPLETED // Cerrada/resuelta` | `CANCELLED // Cancelada` | `ON_HOLD // En pausa (legacy, usar WAITING preferentemente)`

### Priority

`LOW` | `MEDIUM` | `HIGH` | `URGENT`

### MaintenanceType

`PREVENTIVE` | `CORRECTIVE` | `PREDICTIVE` | `EMERGENCY` | `FAILURE`

### ToolStatus

`AVAILABLE` | `IN_USE` | `MAINTENANCE` | `DAMAGED` | `RETIRED`

### ItemType

`TOOL // Legacy - usar HAND_TOOL para nuevos` | `SUPPLY // Legacy - usar SPARE_PART/CONSUMABLE para nuevos` | `SPARE_PART // Repuesto: se instala/consume, stock, lote/serie` | `HAND_TOOL // Herramienta: préstamo/devolución, calibración` | `CONSUMABLE // Consumible: sin serie, bajo costo, alta rotación` | `MATERIAL // Insumo: lubricantes, selladores, cables`

### MovementType

`IN` | `OUT` | `TRANSFER` | `ADJUSTMENT` | `LOAN` | `RETURN`

### LoanStatus

`BORROWED` | `RETURNED` | `OVERDUE`

### ReservationStatus

`PENDING // Reserva creada, pendiente de picking` | `PICKED // Repuestos retirados del pañol` | `CANCELLED // Reserva cancelada` | `RETURNED // Repuestos devueltos (no usados)`

### LotStatus

`AVAILABLE // Disponible para uso` | `RESERVED // Reservado para OT` | `CONSUMED // Consumido/instalado` | `EXPIRED // Vencido` | `DEFECTIVE // Defectuoso/rechazado`

### AuditAction

`CREATE` | `UPDATE` | `DELETE` | `STATUS_CHANGE` | `ASSIGN` | `APPROVE` | `REJECT` | `CLOSE` | `REOPEN` | `RESERVE_STOCK` | `CONSUME_STOCK` | `LOCK_LOTO` | `UNLOCK_LOTO` | `APPROVE_PTW` | `CLOSE_PTW` | `LOGIN` | `LOGOUT`

### PTWType

`HOT_WORK // Trabajos en caliente (soldadura, corte)` | `CONFINED_SPACE // Espacios confinados` | `HEIGHT_WORK // Trabajo en altura` | `ELECTRICAL // Trabajo eléctrico` | `EXCAVATION // Excavación` | `CHEMICAL // Trabajo con químicos` | `RADIATION // Trabajo con radiación` | `PRESSURE_SYSTEMS // Sistemas presurizados` | `OTHER // Otros trabajos peligrosos`

### PTWStatus

`DRAFT // Borrador, siendo completado` | `PENDING_APPROVAL // Esperando aprobación del supervisor` | `APPROVED // Aprobado, listo para usar` | `ACTIVE // En uso activo` | `SUSPENDED // Suspendido temporalmente` | `CLOSED // Cerrado correctamente` | `CANCELLED // Cancelado antes de usar` | `EXPIRED // Expirado (pasó validTo sin cerrar)`

### LOTOStatus

`LOCKED // Bloqueado activamente` | `UNLOCKED // Desbloqueado` | `PARTIAL // Parcialmente bloqueado (múltiples puntos)`

### NotificationType

`work_order_assigned` | `work_order_overdue` | `work_order_due_soon` | `stock_low` | `stock_out` | `maintenance_due` | `task_assigned` | `task_overdue` | `system_alert` | `task_updated` | `task_deleted` | `task_completed` | `task_due_soon` | `task_auto_reset` | `task_commented` | `reminder_overdue` | `reminder_due_today` | `reminder_due_soon` | `tool_request_new` | `tool_request_approved` | `tool_request_rejected` | `SLA_WARNING` | `SLA_BREACH` | `UNASSIGNED_FAILURE` | `RECURRENCE_ALERT` | `DOWNTIME_START` | `DOWNTIME_END` | `PRIORITY_ESCALATED` | `routine_photo_timer` | `invoice_due_soon` | `invoice_overdue` | `cheque_due_soon` | `cheque_overdue` | `quote_expiring` | `payment_received`

### TaskStatus

`TODO` | `IN_PROGRESS` | `DONE` | `CANCELLED`

### TaskFrequency

`DAILY` | `WEEKLY` | `BIWEEKLY` | `MONTHLY` | `QUARTERLY` | `SEMIANNUAL` | `ANNUAL`

### DocumentType

`MANUAL` | `BLUEPRINT` | `PHOTO` | `DOCUMENT` | `PDF` | `IMAGE` | `VIDEO`

### HistoryEventType

`MAINTENANCE` | `REPAIR` | `INSPECTION` | `MODIFICATION` | `INCIDENT` | `CREATION` | `UPDATE` | `DELETION`

### WorkStationStatus

`ACTIVE` | `INACTIVE` | `MAINTENANCE`

### MeasureKind

`UNIT` | `LENGTH` | `AREA` | `VOLUME`

### CostMethod

`BATCH` | `VOLUMETRIC` | `PER_UNIT_BOM` | `REAL` | `STANDARD`

### ProductCostType

`PRODUCTION // Costo calculado desde receta de fabricación` | `PURCHASE // Costo actualizado automáticamente desde compras` | `MANUAL // Costo ingresado manualmente`

### IndirectCategory

`IMP_SERV` | `SOCIAL` | `VEHICLES` | `MKT` | `OTHER` | `UTILITIES`

### RecipeBase

`PER_BATCH` | `PER_M3`

### MethodUnitKind

`BATCH` | `INTERMEDIATE` | `FINAL`

### RecipeStatus

`DRAFT` | `ACTIVE` | `ARCHIVED`

### UnidadMovilEstado

`ACTIVO` | `MANTENIMIENTO` | `FUERA_SERVICIO` | `DESHABILITADO`

### TaxControlStatus

`RECIBIDO` | `PAGADO` | `PENDIENTE` | `VENCIDO`

### TruckType

`CHASIS` | `EQUIPO` | `SEMI`

### ExecutionWindow

`BEFORE_START` | `MID_SHIFT` | `END_SHIFT` | `ANY_TIME` | `SCHEDULED`

### TimeUnit

`HOURS` | `DAYS` | `CYCLES` | `KILOMETERS` | `SHIFTS` | `UNITS_PRODUCED`

### SolutionOutcome

`FUNCIONÓ // Funcionó correctamente` | `PARCIAL // Funcionó parcialmente, necesita seguimiento` | `NO_FUNCIONÓ // No resolvió el problema`

### FixType

`PARCHE // Solución temporal` | `DEFINITIVA // Solución definitiva`

### FailureOccurrenceStatus

`REPORTED` | `IN_PROGRESS` | `RESOLVED` | `CANCELLED` | `RESOLVED_IMMEDIATE`

### WorkOrderOrigin

`FAILURE` | `REQUEST` | `MANUAL` | `PREVENTIVE` | `PREDICTIVE`

### AssetCriticality

`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

### QAStatus

`NOT_REQUIRED` | `PENDING` | `IN_REVIEW` | `APPROVED` | `REJECTED` | `RETURNED_TO_PRODUCTION`

### EvidenceLevel

`OPTIONAL // P4` | `BASIC // P3 - Al menos 1 evidencia` | `STANDARD // P2 - Evidencia + checklist` | `COMPLETE // P1 - Todo requerido`

### DowntimeCategory

`UNPLANNED // Parada no planificada (falla)` | `PLANNED // Parada planificada (mantenimiento)` | `EXTERNAL // Factor externo (corte de luz, etc.)`

### TemplateType

`QUICK_CLOSE // Plantilla de cierre rápido` | `WORK_ORDER // Plantilla de OT (procedimiento)` | `SOLUTION // Plantilla de solución`

### StockMovementType

`ENTRADA_RECEPCION // Entrada por recepción de mercadería` | `SALIDA_DEVOLUCION // Salida por devolución a proveedor` | `TRANSFERENCIA_ENTRADA // Entrada por transferencia entre depósitos` | `TRANSFERENCIA_SALIDA // Salida por transferencia entre depósitos` | `AJUSTE_POSITIVO // Ajuste de inventario positivo` | `AJUSTE_NEGATIVO // Ajuste de inventario negativo` | `CONSUMO_PRODUCCION // Salida por consumo de producción` | `RESERVA // Reserva de stock` | `LIBERACION_RESERVA // Liberación de reserva` | `DESPACHO // Salida por despacho de almacén` | `DEVOLUCION // Entrada por devolución de material`

### TransferStatus

`BORRADOR` | `SOLICITADO` | `EN_TRANSITO` | `RECIBIDO_PARCIAL` | `COMPLETADO` | `CANCELADO`

### AdjustmentType

`INVENTARIO_FISICO` | `ROTURA` | `VENCIMIENTO` | `MERMA` | `CORRECCION` | `DEVOLUCION_INTERNA` | `OTRO`

### AdjustmentStatus

`BORRADOR` | `PENDIENTE_APROBACION` | `CONFIRMADO` | `RECHAZADO`

### PurchaseOrderStatus

`BORRADOR` | `PENDIENTE_APROBACION` | `APROBADA` | `RECHAZADA` | `ENVIADA_PROVEEDOR` | `CONFIRMADA` | `PARCIALMENTE_RECIBIDA` | `COMPLETADA` | `CANCELADA`

### GoodsReceiptStatus

`BORRADOR` | `CONFIRMADA` | `ANULADA`

### QualityStatus

`PENDIENTE` | `APROBADO` | `RECHAZADO` | `APROBADO_PARCIAL`

### GRNIStatus

`PENDIENTE // Esperando factura` | `FACTURADO // Factura vinculada` | `REVERSADO // Reversión manual` | `ANULADO // Recepción anulada`

### QuickPurchaseReason

`EMERGENCIA_PRODUCCION // Parada de línea, urgencia operativa` | `REPOSICION_URGENTE // Stock crítico, no puede esperar OC` | `PROVEEDOR_UNICO // Solo este proveedor lo tiene` | `COMPRA_MENOR // Monto menor al umbral de OC` | `OPORTUNIDAD_PRECIO // Oferta por tiempo limitado` | `OTRO // Requiere justificación en texto`

### RegularizationStatus

`REG_PENDING // Pendiente de regularizar` | `REG_OK // Regularizada (se vinculó a OC o se documentó)` | `REG_NOT_REQUIRED // No requiere (compra menor dentro de umbral)`

### FacturaMatchStatus

`MATCH_PENDING // No hay recepciones vinculadas todavía` | `MATCH_OK // TODAS las líneas dentro de tolerancia` | `MATCH_WARNING // Diferencias menores (registrar CUÁLES líneas)` | `MATCH_BLOCKED // Diferencias fuera de tolerancia (registrar CUÁLES)`

### PayApprovalStatus

`PAY_PENDING // Sin revisar` | `PAY_APPROVED // Aprobada para pago` | `PAY_REJECTED // Rechazada` | `PAY_BLOCKED_BY_MATCH // Bloqueada automáticamente por match`

### LineMatchStatus

`LINE_OK // Coincide dentro de tolerancia` | `LINE_WARNING // Diferencia menor` | `LINE_BLOCKED // Diferencia mayor` | `LINE_MISSING_RECEIPT // Facturado pero no recibido` | `LINE_MISSING_INVOICE // Recibido pero no facturado` | `LINE_EXTRA // Item extra no esperado`

### CreditNoteRequestStatus

`SNCA_NUEVA // Recién creada` | `SNCA_ENVIADA // Enviada al proveedor` | `SNCA_EN_REVISION // Proveedor la está revisando` | `SNCA_APROBADA // Proveedor aprobó` | `SNCA_PARCIAL // Proveedor aprobó parcialmente` | `SNCA_RECHAZADA // Proveedor rechazó` | `SNCA_NCA_RECIBIDA // Se recibió la NCA del proveedor` | `SNCA_APLICADA // NCA aplicada a factura/cuenta` | `SNCA_CERRADA // Finalizada` | `SNCA_CANCELADA // Cancelada internamente`

### CreditNoteRequestType

`SNCA_FALTANTE // Llegó menos de lo facturado` | `SNCA_DEVOLUCION // Se devolvió mercadería (afecta stock)` | `SNCA_PRECIO // Precio facturado distinto al acordado` | `SNCA_DESCUENTO // Descuento no aplicado` | `SNCA_CALIDAD // Problema de calidad (puede afectar stock)` | `SNCA_OTRO`

### CreditNoteType

`NCA_FALTANTE // Por mercadería que nunca llegó` | `NCA_DEVOLUCION // Por mercadería devuelta` | `NCA_PRECIO // Diferencia de precio` | `NCA_DESCUENTO // Descuento no aplicado` | `NCA_CALIDAD // Por problema de calidad` | `NCA_OTRO` | `NC_FALTANTE // Por mercadería que nunca llegó` | `NC_DEVOLUCION // Por mercadería devuelta` | `NC_PRECIO // Diferencia de precio` | `NC_DESCUENTO // Descuento no aplicado` | `NC_CALIDAD // Por problema de calidad` | `NC_OTRO`

### CreditDebitNoteType

`NOTA_CREDITO` | `NOTA_DEBITO`

### CreditDebitNoteStatus

`BORRADOR` | `EMITIDA` | `APLICADA` | `ANULADA`

### MatchStatus

`PENDIENTE` | `MATCH_OK` | `DISCREPANCIA` | `RESUELTO` | `BLOQUEADO`

### MatchExceptionType

`CANTIDAD_DIFERENTE` | `PRECIO_DIFERENTE` | `ITEM_FALTANTE` | `ITEM_EXTRA` | `IMPUESTO_DIFERENTE` | `TOTAL_DIFERENTE` | `SIN_OC` | `SIN_RECEPCION` | `DUPLICADO`

### ApprovalType

`MONTO` | `CATEGORIA` | `PROVEEDOR` | `EMERGENCIA` | `DESVIACION_MATCH`

### ApprovalStatus

`PENDIENTE` | `EN_REVISION` | `APROBADA` | `RECHAZADA` | `ESCALADA` | `VENCIDA`

### ApprovalDecision

`APROBADA` | `RECHAZADA` | `APROBADA_CON_CONDICIONES`

### ProjectStatus

`ACTIVO` | `EN_PAUSA` | `COMPLETADO` | `CANCELADO`

### PaymentRequestStatus

`BORRADOR // Guardado sin enviar` | `SOLICITADA // Enviada, pendiente de revisión` | `EN_REVISION // En proceso de aprobación` | `APROBADA // Aprobada, lista para pagar` | `RECHAZADA // Rechazada con motivo` | `CONVERTIDA // Convertida a orden de pago` | `PAGADA // Pagada` | `CANCELADA // Cancelada por usuario`

### PurchaseReturnStatus

`BORRADOR` | `SOLICITADA` | `APROBADA_PROVEEDOR` | `ENVIADA` | `RECIBIDA_PROVEEDOR` | `EN_EVALUACION` | `RESUELTA` | `RECHAZADA` | `CANCELADA`

### ReturnType

`DEFECTO` | `EXCESO` | `ERROR_PEDIDO` | `GARANTIA` | `OTRO`

### ReturnItemStatus

`PENDIENTE` | `ACEPTADO` | `RECHAZADO`

### ReplenishmentUrgency

`BAJA` | `NORMAL` | `ALTA` | `CRITICA`

### ReplenishmentStatus

`PENDIENTE` | `EN_PROCESO` | `COMPLETADA` | `IGNORADA` | `EXPIRADA`

### DuplicateStatus

`PENDIENTE` | `CONFIRMADO` | `DESCARTADO`

### PurchaseRequestStatus

`BORRADOR` | `ENVIADA` | `EN_COTIZACION // Encargado buscando presupuestos` | `COTIZADA // Tiene cotizaciones cargadas` | `EN_APROBACION // Esperando aprobación de gerente` | `APROBADA // Gerente aprobó una cotización` | `EN_PROCESO // OC creada/enviada` | `COMPLETADA // Recibido` | `RECHAZADA` | `CANCELADA`

### RequestPriority

`BAJA` | `NORMAL` | `ALTA` | `URGENTE`

### QuotationStatus

`BORRADOR` | `RECIBIDA` | `EN_REVISION` | `SELECCIONADA // Elegida por el gerente` | `CONVERTIDA_OC // Se creó OC desde esta` | `RECHAZADA` | `VENCIDA`

### PurchaseCommentType

`COMENTARIO` | `ACTUALIZACION` | `PREGUNTA` | `RESPUESTA` | `SISTEMA // Automático: "Estado cambió a X"`

### DocType

`T1 // Formal (facturado, con CAE)` | `T2 // Interno (sin fiscal)` | `T3 // Presupuesto (cotización sin compromiso)`

### QuoteStatus

`BORRADOR` | `PENDIENTE_APROBACION` | `APROBADA` | `ENVIADA` | `EN_NEGOCIACION` | `ACEPTADA` | `CONVERTIDA` | `PERDIDA` | `VENCIDA` | `CANCELADA`

### QuoteType

`COTIZACION // Cotización tradicional con negociación` | `NOTA_PEDIDO // Nota de pedido directa (el cliente ya decidió)`

### SaleStatus

`BORRADOR` | `PENDIENTE_APROBACION` | `APROBADA` | `CONFIRMADA` | `EN_PREPARACION` | `PARCIALMENTE_ENTREGADA` | `ENTREGADA` | `FACTURADA` | `COMPLETADA` | `CANCELADA`

### DeliveryStatus

`PENDIENTE` | `EN_PREPARACION` | `LISTA_PARA_DESPACHO` | `EN_TRANSITO` | `RETIRADA` | `ENTREGADA` | `ENTREGA_FALLIDA` | `CANCELADA`

### RemitoStatus

`BORRADOR` | `EMITIDO` | `ANULADO`

### LoadOrderStatus

`PENDIENTE` | `CARGANDO` | `CARGADA` | `DESPACHADA` | `CANCELADA`

### SalesInvoiceType

`A` | `B` | `C` | `M` | `E // Exportación`

### SalesInvoiceStatus

`BORRADOR` | `EMITIDA` | `ENVIADA` | `PARCIALMENTE_COBRADA` | `COBRADA` | `VENCIDA` | `ANULADA`

### AFIPStatus

`PENDIENTE` | `PROCESANDO` | `APROBADO` | `RECHAZADO` | `ERROR`

### SalesCreditDebitType

`NOTA_CREDITO` | `NOTA_DEBITO`

### ClientPaymentStatus

`PENDIENTE` | `CONFIRMADO` | `RECHAZADO` | `ANULADO`

### ChequeStatus

`CARTERA` | `DEPOSITADO` | `COBRADO` | `RECHAZADO` | `ENDOSADO` | `ANULADO`

### ClientMovementType

`FACTURA` | `NOTA_CREDITO` | `NOTA_DEBITO` | `PAGO` | `ANTICIPO` | `AJUSTE` | `ANULACION` | `RECHAZO`

### SalesApprovalType

`DESCUENTO` | `CREDITO` | `PRECIO_ESPECIAL` | `MONTO_ALTO` | `PLAZO_PAGO`

### SalesApprovalStatus

`PENDIENTE` | `APROBADA` | `RECHAZADA` | `ESCALADA`

### ModuleCategory

`VENTAS` | `COMPRAS` | `MANTENIMIENTO` | `COSTOS` | `ADMINISTRACION` | `GENERAL`

### SaleConditionType

`FORMAL // T1: 100% facturado` | `INFORMAL // T2: 100% remito sin factura` | `MIXTO // T3: % configurable`

### SettlementPeriod

`SEMANAL` | `QUINCENAL` | `MENSUAL`

### AcopioStatus

`ACTIVO` | `PARCIAL` | `RETIRADO` | `VENCIDO` | `CANCELADO`

### PortalOrderStatus

`PENDIENTE` | `EN_REVISION` | `CONFIRMADO` | `RECHAZADO` | `CONVERTIDO` | `CANCELADO`

### PortalActivityAction

`LOGIN` | `LOGOUT` | `VIEW_PRICES` | `VIEW_QUOTE` | `ACCEPT_QUOTE` | `REJECT_QUOTE` | `CREATE_ORDER` | `CANCEL_ORDER` | `VIEW_DOCUMENT` | `DOWNLOAD_PDF` | `CHANGE_PASSWORD`

### RMAStatus

`SOLICITADO // Cliente solicitó devolución` | `EN_REVISION // Equipo revisando solicitud` | `APROBADO // RMA aprobado, esperando producto` | `RECHAZADO // RMA rechazado` | `EN_TRANSITO // Producto en camino` | `RECIBIDO // Producto recibido en almacén` | `EN_EVALUACION // Evaluando estado del producto` | `PROCESADO // Devolución procesada (NC emitida o producto cambiado)` | `CERRADO // Caso cerrado` | `CANCELADO // Cancelado por cliente`

### RMAType

`DEVOLUCION // Devolución con reembolso` | `CAMBIO // Cambio por otro producto` | `REPARACION // Envío a reparación` | `GARANTIA // Reclamo de garantía`

### RMAReasonCategory

`DEFECTO_FABRICACION // Producto defectuoso` | `ERROR_ENVIO // Se envió producto incorrecto` | `DANO_TRANSPORTE // Dañado durante envío` | `NO_CONFORME // No cumple expectativas` | `ARREPENTIMIENTO // Cambio de opinión` | `GARANTIA // Falla dentro de garantía` | `OTRO // Otra razón`

### GoalPeriod

`MENSUAL` | `TRIMESTRAL` | `SEMESTRAL` | `ANUAL`

### GoalType

`VENTAS_MONTO // Meta en dinero` | `VENTAS_CANTIDAD // Meta en unidades vendidas` | `CLIENTES_NUEVOS // Meta de nuevos clientes` | `MARGEN // Meta de margen` | `CONVERSION // Meta de tasa de conversión` | `COBRANZAS // Meta de cobranzas`

### GoalLevel

`EMPRESA // Meta a nivel empresa` | `VENDEDOR // Meta por vendedor` | `EQUIPO // Meta por equipo/zona` | `PRODUCTO // Meta por producto` | `CATEGORIA // Meta por categoría`

### CashMovementType

`INGRESO_COBRO // Cobro de cliente (efectivo)` | `EGRESO_PAGO // Pago a proveedor (efectivo)` | `INGRESO_DEPOSITO // Ingreso manual/depósito` | `EGRESO_RETIRO // Retiro manual` | `INGRESO_CAMBIO // Cambio de moneda (entrada)` | `EGRESO_CAMBIO // Cambio de moneda (salida)` | `AJUSTE_POSITIVO // Ajuste de arqueo (+)` | `AJUSTE_NEGATIVO // Ajuste de arqueo (-)` | `TRANSFERENCIA_IN // Transferencia desde otra caja` | `TRANSFERENCIA_OUT // Transferencia a otra caja`

### BankMovementType

`TRANSFERENCIA_IN // Transferencia recibida` | `TRANSFERENCIA_OUT // Transferencia enviada` | `DEPOSITO_EFECTIVO // Depósito de efectivo` | `DEPOSITO_CHEQUE // Depósito de cheque` | `DEBITO_CHEQUE // Débito por cheque emitido` | `DEBITO_AUTOMATICO // Débito automático` | `CREDITO_AUTOMATICO // Crédito automático` | `COMISION // Comisión bancaria` | `IMPUESTO // Imp. débitos/créditos` | `INTERES // Intereses` | `AJUSTE // Ajuste de conciliación`

### ChequeOrigen

`RECIBIDO // De cliente` | `EMITIDO // A proveedor`

### ChequeTipo

`FISICO` | `ECHEQ`

### ChequeEstado

`CARTERA // En cartera (no depositado)` | `DEPOSITADO // Depositado, esperando acreditación` | `COBRADO // Cobrado/acreditado` | `RECHAZADO // Rechazado por el banco` | `ENDOSADO // Endosado a tercero` | `ANULADO // Anulado` | `VENCIDO // Vencido sin depositar`

### TreasuryTransferStatus

`PENDIENTE` | `COMPLETADA` | `ANULADA`

### BankStatementStatus

`PENDIENTE` | `EN_PROCESO` | `COMPLETADA` | `CON_DIFERENCIAS` | `CERRADA`

### MatchType

`EXACT` | `FUZZY` | `REFERENCE` | `MANUAL`

### TreasuryMovementType

`INGRESO` | `EGRESO` | `TRANSFERENCIA_INTERNA` | `AJUSTE`

### PaymentMedium

`EFECTIVO` | `TRANSFERENCIA` | `CHEQUE_TERCERO` | `CHEQUE_PROPIO` | `ECHEQ` | `TARJETA_CREDITO` | `TARJETA_DEBITO` | `DEPOSITO` | `COMISION` | `INTERES` | `AJUSTE`

### TreasuryMovementStatus

`PENDIENTE` | `CONFIRMADO` | `REVERSADO`

### SubscriptionStatus

`TRIALING` | `ACTIVE` | `PAST_DUE` | `CANCELED` | `PAUSED` | `@@map("subscription_status")`

### BillingInvoiceStatus

`DRAFT` | `OPEN` | `PAID` | `VOID` | `UNCOLLECTIBLE` | `@@map("invoice_status")`

### BillingCycle

`MONTHLY` | `ANNUAL` | `@@map("billing_cycle")`

### TokenTransactionType

`MONTHLY_CREDIT` | `PURCHASE` | `USAGE` | `REFUND` | `ADJUSTMENT` | `EXPIRATION` | `@@map("token_transaction_type")`

### BillingPaymentStatus

`PENDING` | `COMPLETED` | `FAILED` | `REFUNDED` | `@@map("payment_status")`

### DiscountType

`PERCENTAGE` | `FIXED_AMOUNT`

### AutomationTriggerType

`WORK_ORDER_CREATED // Nueva OT creada` | `WORK_ORDER_STATUS_CHANGED // Cambio de estado de OT` | `WORK_ORDER_ASSIGNED // OT asignada` | `FAILURE_REPORTED // Falla reportada` | `FAILURE_RECURRENCE // Falla recurrente (N ocurrencias en X días)` | `STOCK_LOW // Stock bajo mínimo` | `PREVENTIVE_DUE // Mantenimiento preventivo próximo` | `MACHINE_STATUS_CHANGED // Cambio de estado de máquina` | `SCHEDULED // Programado (cron)`

### AutomationExecutionStatus

`PENDING // Pendiente de ejecución` | `RUNNING // En ejecución` | `COMPLETED // Completado exitosamente` | `FAILED // Error en ejecución` | `SKIPPED // Saltado (condiciones no cumplidas)` | `SIMULATED // Simulación (modo test)`

### IdeaCategory

`SOLUCION_FALLA // Propuesta de solución a falla` | `MEJORA_PROCESO // Mejora de proceso` | `MEJORA_EQUIPO // Mejora de equipo/máquina` | `SEGURIDAD // Mejora de seguridad` | `AHORRO_COSTOS // Reducción de costos` | `CALIDAD // Mejora de calidad` | `OTRO`

### IdeaPriority

`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

### IdeaStatus

`NEW // Recién creada` | `UNDER_REVIEW // En evaluación` | `APPROVED // Aprobada para implementar` | `IN_PROGRESS // En implementación` | `IMPLEMENTED // Implementada` | `REJECTED // Rechazada` | `ARCHIVED // Archivada`

### CertificationStatus

`ACTIVE` | `EXPIRED` | `PENDING_RENEWAL` | `REVOKED`

### MOCChangeType

`EQUIPMENT` | `PROCESS` | `PROCEDURE` | `MATERIAL` | `PERSONNEL`

### MOCStatus

`DRAFT` | `PENDING_REVIEW` | `UNDER_REVIEW` | `APPROVED` | `REJECTED` | `IMPLEMENTING` | `COMPLETED` | `CANCELLED`

### RecurringFrequency

`DIARIO` | `SEMANAL` | `QUINCENAL` | `MENSUAL`

### AgendaTaskStatus

`PENDING // Pendiente - recién creada` | `IN_PROGRESS // En progreso - se está trabajando` | `WAITING // Esperando respuesta` | `COMPLETED // Completada` | `CANCELLED // Cancelada`

### TaskSource

`WEB // Creada desde la web` | `DISCORD_TEXT // Creada desde Discord por texto` | `DISCORD_VOICE // Creada desde Discord por audio` | `API // Creada via API externa`

### NotificationChannel

`DISCORD // Notificación por Discord DM` | `EMAIL // Notificación por email` | `WEB_PUSH // Push notification web` | `SSE // Server-Sent Events (in-app)`

### VoiceLogStatus

`PENDING // Pendiente de procesar` | `PROCESSING // En proceso` | `COMPLETED // Procesado exitosamente` | `FAILED // Falló el procesamiento`

### StockReservationStatus

`ACTIVA` | `CONSUMIDA_PARCIAL` | `CONSUMIDA` | `LIBERADA` | `EXPIRADA`

### StockReservationType

`SOLICITUD_MATERIAL` | `ORDEN_PRODUCCION` | `ORDEN_TRABAJO` | `MANUAL`

### MaterialRequestType

`OT_MANTENIMIENTO` | `OP_PRODUCCION` | `PROYECTO` | `INTERNO`

### MaterialRequestStatus

`BORRADOR` | `PENDIENTE_APROBACION` | `APROBADA` | `PARCIALMENTE_DESPACHADA` | `DESPACHADA` | `CANCELADA` | `RECHAZADA`

### InventoryItemType

`TOOL` | `SUPPLIER_ITEM`

### DespachoType

`ENTREGA_OT` | `ENTREGA_OP` | `ENTREGA_PERSONA` | `CONSUMO_INTERNO`

### DespachoStatus

`BORRADOR` | `EN_PREPARACION` | `LISTO_DESPACHO` | `DESPACHADO` | `RECIBIDO` | `CANCELADO`

### DevolucionType

`SOBRANTE_OT` | `SOBRANTE_OP` | `NO_UTILIZADO` | `DEFECTUOSO`

### DevolucionStatus

`BORRADOR` | `PENDIENTE_REVISION` | `ACEPTADA` | `RECHAZADA`

### StockConsumptionMode

`ON_RELEASE // Reserva al liberar OP` | `ON_REPORT // Consume al reportar producción` | `MANUAL // El usuario decide cuándo`

### ServiceContractType

`SEGURO_MAQUINARIA // Seguro de máquina/equipo` | `SEGURO_VEHICULO // Seguro de vehículo` | `SEGURO_INSTALACIONES // Seguro de planta/instalaciones` | `SEGURO_RESPONSABILIDAD // Seguro de responsabilidad civil` | `SERVICIO_TECNICO // Servicio técnico externo` | `MANTENIMIENTO_PREVENTIVO // Contrato de mantenimiento` | `CALIBRACION // Servicios de calibración` | `CERTIFICACION // Certificaciones (ISO, etc.)` | `ALQUILER_EQUIPO // Alquiler de equipos` | `LICENCIA_SOFTWARE // Licencias de software` | `CONSULTORIA // Servicios de consultoría` | `VIGILANCIA // Seguridad y vigilancia` | `LIMPIEZA // Servicios de limpieza` | `TRANSPORTE // Contratos de transporte/logística` | `OTRO // Otros servicios`

### ServiceContractStatus

`BORRADOR // En creación` | `ACTIVO // Vigente` | `POR_VENCER // Próximo a vencer (30 días)` | `VENCIDO // Venció y no se renovó` | `SUSPENDIDO // Suspendido temporalmente` | `CANCELADO // Cancelado definitivamente` | `RENOVADO // Se generó nuevo contrato`

### ServicePaymentFrequency

`UNICO // Pago único` | `MENSUAL` | `BIMESTRAL` | `TRIMESTRAL` | `CUATRIMESTRAL` | `SEMESTRAL` | `ANUAL`

