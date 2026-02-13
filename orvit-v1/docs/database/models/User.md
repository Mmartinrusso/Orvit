# User

> Table name: `User`

**Schema location:** Lines 351-691

## Fields

| Field | Type | Required | Unique | Default | Notes |
|-------|------|----------|--------|---------|-------|
| `id` | `Int` | ✅ | 🔑 PK | `autoincrement(` |  |
| `name` | `String` | ✅ |  | `` |  |
| `email` | `String` | ✅ | ✅ | `` |  |
| `password` | `String?` | ❌ |  | `` |  |
| `avatar` | `String?` | ❌ |  | `` |  |
| `logo` | `String?` | ❌ |  | `` |  |
| `isActive` | `Boolean` | ✅ |  | `true` |  |
| `lastLogin` | `DateTime?` | ❌ |  | `` |  |
| `createdAt` | `DateTime` | ✅ |  | `now(` |  |
| `updatedAt` | `DateTime` | ✅ |  | `` |  |
| `phone` | `String?` | ❌ |  | `` | Teléfono del usuario para billing/contacto |
| `discordUserId` | `String?` | ❌ | ✅ | `` | ID de Discord del usuario para DMs |
| `sidebarPreferences` | `Json?` | ❌ |  | `` | DB: JsonB. User sidebar customization { ventas: { visible: [], pinned: [], order: [] } } |
| `checklist_executions` | `checklist_executions[]` | ✅ |  | `` |  |
| `maintenance_history` | `maintenance_history[]` | ✅ |  | `` |  |

## Relations

| Field | Type | Cardinality | FK Fields | References | On Delete |
|-------|------|-------------|-----------|------------|-----------|
| `role` | [UserRole](./models/UserRole.md) | Many-to-One | - | - | - |
| `createdCategories` | [Category](./models/Category.md) | One-to-Many | - | - | - |
| `clientsSold` | [Client](./models/Client.md) | One-to-Many | - | - | - |
| `clientsBlocked` | [Client](./models/Client.md) | One-to-Many | - | - | - |
| `clientBlocksCreated` | [ClientBlockHistory](./models/ClientBlockHistory.md) | One-to-Many | - | - | - |
| `clientBlocksResolved` | [ClientBlockHistory](./models/ClientBlockHistory.md) | One-to-Many | - | - | - |
| `clientNotes` | [ClientNote](./models/ClientNote.md) | One-to-Many | - | - | - |
| `contacts` | [Contact](./models/Contact.md) | One-to-Many | - | - | - |
| `contactInteractions` | [ContactInteraction](./models/ContactInteraction.md) | One-to-Many | - | - | - |
| `documents` | [Document](./models/Document.md) | One-to-Many | - | - | - |
| `assignedFixedTasks` | [FixedTask](./models/FixedTask.md) | One-to-Many | - | - | - |
| `createdFixedTasks` | [FixedTask](./models/FixedTask.md) | One-to-Many | - | - | - |
| `fixedTaskExecutions` | [FixedTaskExecution](./models/FixedTaskExecution.md) | One-to-Many | - | - | - |
| `historyEvents` | [HistoryEvent](./models/HistoryEvent.md) | One-to-Many | - | - | - |
| `notifications` | [Notification](./models/Notification.md) | One-to-Many | - | - | - |
| `notificationPreferences` | [NotificationPreferences](./models/NotificationPreferences.md) | One-to-Many | - | - | - |
| `createdProducts` | [Product](./models/Product.md) | One-to-Many | - | - | - |
| `productStockMovements` | [ProductStockMovement](./models/ProductStockMovement.md) | One-to-Many | - | - | - |
| `createdPurchaseReceipts` | [PurchaseReceipt](./models/PurchaseReceipt.md) | One-to-Many | - | - | - |
| `createdPaymentOrders` | [PaymentOrder](./models/PaymentOrder.md) | One-to-Many | - | - | - |
| `reminders` | [Reminder](./models/Reminder.md) | One-to-Many | - | - | - |
| `assignedTasks` | [Task](./models/Task.md) | One-to-Many | - | - | - |
| `createdTasks` | [Task](./models/Task.md) | One-to-Many | - | - | - |
| `taskAttachments` | [TaskAttachment](./models/TaskAttachment.md) | One-to-Many | - | - | - |
| `taskComments` | [TaskComment](./models/TaskComment.md) | One-to-Many | - | - | - |
| `taxBasesCreated` | [TaxBase](./models/TaxBase.md) | One-to-Many | - | - | - |
| `taxRecordsPaid` | [TaxRecord](./models/TaxRecord.md) | One-to-Many | - | - | - |
| `taxRecordsReceived` | [TaxRecord](./models/TaxRecord.md) | One-to-Many | - | - | - |
| `controlsCreated` | [Control](./models/Control.md) | One-to-Many | - | - | - |
| `toolLoans` | [ToolLoan](./models/ToolLoan.md) | One-to-Many | - | - | - |
| `toolRequests` | [ToolRequest](./models/ToolRequest.md) | One-to-Many | - | - | - |
| `companies` | [UserOnCompany](./models/UserOnCompany.md) | One-to-Many | - | - | - |
| `grantedPermissions` | [UserPermission](./models/UserPermission.md) | One-to-Many | - | - | - |
| `userPermissions` | [UserPermission](./models/UserPermission.md) | One-to-Many | - | - | - |
| `workOrderAttachments` | [WorkOrderAttachment](./models/WorkOrderAttachment.md) | One-to-Many | - | - | - |
| `workOrderComments` | [WorkOrderComment](./models/WorkOrderComment.md) | One-to-Many | - | - | - |
| `workStations` | [WorkStationInstructive](./models/WorkStationInstructive.md) | One-to-Many | - | - | - |
| `failureOccurrences` | [FailureOccurrence](./models/FailureOccurrence.md) | One-to-Many | - | - | - |
| `solutionsApplied` | [FailureSolution](./models/FailureSolution.md) | One-to-Many | - | - | - |
| `solutionApplications` | [SolutionApplication](./models/SolutionApplication.md) | One-to-Many | - | - | - |
| `assignedWorkOrders` | [WorkOrder](./models/WorkOrder.md) | One-to-Many | - | - | - |
| `createdWorkOrders` | [WorkOrder](./models/WorkOrder.md) | One-to-Many | - | - | - |
| `ownedCompanies` | [Company](./models/Company.md) | One-to-Many | - | - | - |
| `dashboardConfigs` | [UserDashboardConfig](./models/UserDashboardConfig.md) | One-to-Many | - | - | - |
| `colorPreferences` | [UserColorPreferences](./models/UserColorPreferences.md) | One-to-Many | - | - | - |
| `workLogsPerformed` | [WorkLog](./models/WorkLog.md) | One-to-Many | - | - | - |
| `templatesCreated` | [Template](./models/Template.md) | One-to-Many | - | - | - |
| `qaVerifications` | [QualityAssurance](./models/QualityAssurance.md) | One-to-Many | - | - | - |
| `qaReturnConfirmed` | [QualityAssurance](./models/QualityAssurance.md) | One-to-Many | - | - | - |
| `failureWatchers` | [FailureWatcher](./models/FailureWatcher.md) | One-to-Many | - | - | - |
| `workOrderWatchers` | [WorkOrderWatcher](./models/WorkOrderWatcher.md) | One-to-Many | - | - | - |
| `solutionsAppliedPerformed` | [SolutionApplied](./models/SolutionApplied.md) | One-to-Many | - | - | - |
| `downtimeReturned` | [DowntimeLog](./models/DowntimeLog.md) | One-to-Many | - | - | - |
| `occurrencesLinked` | [FailureOccurrence](./models/FailureOccurrence.md) | One-to-Many | - | - | - |
| `occurrencesReopened` | [FailureOccurrence](./models/FailureOccurrence.md) | One-to-Many | - | - | - |
| `failureOccurrenceComments` | [FailureOccurrenceComment](./models/FailureOccurrenceComment.md) | One-to-Many | - | - | - |
| `occurrenceEventsCreated` | [FailureOccurrenceEvent](./models/FailureOccurrenceEvent.md) | One-to-Many | - | - | - |
| `activityEventsPerformed` | [ActivityEvent](./models/ActivityEvent.md) | One-to-Many | - | - | - |
| `rcaCreated` | [RootCauseAnalysis](./models/RootCauseAnalysis.md) | One-to-Many | - | - | - |
| `checklistsCompleted` | [WorkOrderChecklist](./models/WorkOrderChecklist.md) | One-to-Many | - | - | - |
| `assistantConversations` | [AssistantConversation](./models/AssistantConversation.md) | One-to-Many | - | - | - |
| `assistantActionLogs` | [AssistantActionLog](./models/AssistantActionLog.md) | One-to-Many | - | - | - |
| `purchaseOrdersCreated` | [PurchaseOrder](./models/PurchaseOrder.md) | One-to-Many | - | - | - |
| `purchaseOrdersApproved` | [PurchaseOrder](./models/PurchaseOrder.md) | One-to-Many | - | - | - |
| `purchaseOrdersRejected` | [PurchaseOrder](./models/PurchaseOrder.md) | One-to-Many | - | - | - |
| `goodsReceiptsCreated` | [GoodsReceipt](./models/GoodsReceipt.md) | One-to-Many | - | - | - |
| `creditDebitNotesCreated` | [CreditDebitNote](./models/CreditDebitNote.md) | One-to-Many | - | - | - |
| `approvalsAssigned` | [PurchaseApproval](./models/PurchaseApproval.md) | One-to-Many | - | - | - |
| `approvalsResolved` | [PurchaseApproval](./models/PurchaseApproval.md) | One-to-Many | - | - | - |
| `approvalsCreated` | [PurchaseApproval](./models/PurchaseApproval.md) | One-to-Many | - | - | - |
| `matchResultsResolved` | [MatchResult](./models/MatchResult.md) | One-to-Many | - | - | - |
| `matchExceptionsResolved` | [MatchException](./models/MatchException.md) | One-to-Many | - | - | - |
| `matchExceptionsOwned` | [MatchException](./models/MatchException.md) | One-to-Many | - | - | - |
| `matchExceptionsEscalated` | [MatchException](./models/MatchException.md) | One-to-Many | - | - | - |
| `matchExceptionHistory` | [MatchExceptionHistory](./models/MatchExceptionHistory.md) | One-to-Many | - | - | - |
| `sodViolations` | [SoDViolation](./models/SoDViolation.md) | One-to-Many | - | - | - |
| `paymentRequestsCreated` | [PaymentRequest](./models/PaymentRequest.md) | One-to-Many | - | - | - |
| `paymentRequestsApproved` | [PaymentRequest](./models/PaymentRequest.md) | One-to-Many | - | - | - |
| `paymentRequestsRejected` | [PaymentRequest](./models/PaymentRequest.md) | One-to-Many | - | - | - |
| `paymentRequestLogs` | [PaymentRequestLog](./models/PaymentRequestLog.md) | One-to-Many | - | - | - |
| `purchaseReturnsCreated` | [PurchaseReturn](./models/PurchaseReturn.md) | One-to-Many | - | - | - |
| `stockMovementsCreated` | [StockMovement](./models/StockMovement.md) | One-to-Many | - | - | - |
| `purchaseAuditLogs` | [PurchaseAuditLog](./models/PurchaseAuditLog.md) | One-to-Many | - | - | - |
| `stockTransfersCreated` | [StockTransfer](./models/StockTransfer.md) | One-to-Many | - | - | - |
| `stockAdjustmentsCreated` | [StockAdjustment](./models/StockAdjustment.md) | One-to-Many | - | - | - |
| `stockAdjustmentsApproved` | [StockAdjustment](./models/StockAdjustment.md) | One-to-Many | - | - | - |
| `movementsConciliados` | [SupplierAccountMovement](./models/SupplierAccountMovement.md) | One-to-Many | - | - | - |
| `movementsCreated` | [SupplierAccountMovement](./models/SupplierAccountMovement.md) | One-to-Many | - | - | - |
| `purchaseRequestsSolicitante` | [PurchaseRequest](./models/PurchaseRequest.md) | One-to-Many | - | - | - |
| `quotationsCreated` | [PurchaseQuotation](./models/PurchaseQuotation.md) | One-to-Many | - | - | - |
| `quotationsSelected` | [PurchaseQuotation](./models/PurchaseQuotation.md) | One-to-Many | - | - | - |
| `purchaseComments` | [PurchaseComment](./models/PurchaseComment.md) | One-to-Many | - | - | - |
| `quotationStatusChanges` | [QuotationStatusHistory](./models/QuotationStatusHistory.md) | One-to-Many | - | - | - |
| `receiptsIngresoConfirmado` | [PurchaseReceipt](./models/PurchaseReceipt.md) | One-to-Many | - | - | - |
| `receiptsPagoForzado` | [PurchaseReceipt](./models/PurchaseReceipt.md) | One-to-Many | - | - | - |
| `receiptsValidado` | [PurchaseReceipt](./models/PurchaseReceipt.md) | One-to-Many | - | - | - |
| `receiptsPayApproved` | [PurchaseReceipt](./models/PurchaseReceipt.md) | One-to-Many | - | - | - |
| `goodsReceiptsRegularized` | [GoodsReceipt](./models/GoodsReceipt.md) | One-to-Many | - | - | - |
| `creditNoteRequestsCreated` | [CreditNoteRequest](./models/CreditNoteRequest.md) | One-to-Many | - | - | - |
| `supplierChangeRequestsCreated` | [SupplierChangeRequest](./models/SupplierChangeRequest.md) | One-to-Many | - | - | - |
| `supplierChangeRequestsApproved` | [SupplierChangeRequest](./models/SupplierChangeRequest.md) | One-to-Many | - | - | - |
| `supplierChangeRequestsRejected` | [SupplierChangeRequest](./models/SupplierChangeRequest.md) | One-to-Many | - | - | - |
| `supplierChangeRequests2Approved` | [SupplierChangeRequest](./models/SupplierChangeRequest.md) | One-to-Many | - | - | - |
| `refreshTokens` | [RefreshToken](./models/RefreshToken.md) | One-to-Many | - | - | - |
| `sessions` | [Session](./models/Session.md) | One-to-Many | - | - | - |
| `loginAttempts` | [LoginAttempt](./models/LoginAttempt.md) | One-to-Many | - | - | - |
| `twoFactor` | [UserTwoFactor](./models/UserTwoFactor.md) | Many-to-One (optional) | - | - | - |
| `trustedDevices` | [TrustedDevice](./models/TrustedDevice.md) | One-to-Many | - | - | - |
| `securityEvents` | [SecurityEvent](./models/SecurityEvent.md) | One-to-Many | - | - | - |
| `kilometrajeLogs` | [KilometrajeLog](./models/KilometrajeLog.md) | One-to-Many | - | - | - |
| `quotesAsSeller` | [Quote](./models/Quote.md) | One-to-Many | - | - | - |
| `quotesCreated` | [Quote](./models/Quote.md) | One-to-Many | - | - | - |
| `quotesApproved` | [Quote](./models/Quote.md) | One-to-Many | - | - | - |
| `quoteVersions` | [QuoteVersion](./models/QuoteVersion.md) | One-to-Many | - | - | - |
| `salesAsSeller` | [Sale](./models/Sale.md) | One-to-Many | - | - | - |
| `salesCreated` | [Sale](./models/Sale.md) | One-to-Many | - | - | - |
| `salesApproved` | [Sale](./models/Sale.md) | One-to-Many | - | - | - |
| `deliveriesCreated` | [SaleDelivery](./models/SaleDelivery.md) | One-to-Many | - | - | - |
| `remitosCreated` | [SaleRemito](./models/SaleRemito.md) | One-to-Many | - | - | - |
| `invoicesCreated` | [SalesInvoice](./models/SalesInvoice.md) | One-to-Many | - | - | - |
| `creditNotesCreated` | [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | One-to-Many | - | - | - |
| `clientPaymentsCreated` | [ClientPayment](./models/ClientPayment.md) | One-to-Many | - | - | - |
| `salesAuditLogs` | [SalesAuditLog](./models/SalesAuditLog.md) | One-to-Many | - | - | - |
| `sellerKPIs` | [SellerKPI](./models/SellerKPI.md) | One-to-Many | - | - | - |
| `salesApprovalsSolicited` | [SalesApproval](./models/SalesApproval.md) | One-to-Many | - | - | - |
| `salesApprovalsAssigned` | [SalesApproval](./models/SalesApproval.md) | One-to-Many | - | - | - |
| `salesApprovalsResolved` | [SalesApproval](./models/SalesApproval.md) | One-to-Many | - | - | - |
| `collectionAttempts` | [CollectionAttempt](./models/CollectionAttempt.md) | One-to-Many | - | - | - |
| `loadOrdersCreated` | [LoadOrder](./models/LoadOrder.md) | One-to-Many | - | - | - |
| `loadOrdersConfirmed` | [LoadOrder](./models/LoadOrder.md) | One-to-Many | - | - | - |
| `modulesEnabled` | [CompanyModule](./models/CompanyModule.md) | One-to-Many | - | - | - |
| `acopiosCreated` | [SaleAcopio](./models/SaleAcopio.md) | One-to-Many | - | - | - |
| `retirosCreated` | [AcopioRetiro](./models/AcopioRetiro.md) | One-to-Many | - | - | - |
| `cashAccountsCreated` | [CashAccount](./models/CashAccount.md) | One-to-Many | - | - | - |
| `cashMovementsCreated` | [CashMovement](./models/CashMovement.md) | One-to-Many | - | - | - |
| `bankAccountsCreated` | [BankAccount](./models/BankAccount.md) | One-to-Many | - | - | - |
| `bankMovementsCreated` | [BankMovement](./models/BankMovement.md) | One-to-Many | - | - | - |
| `bankMovementsConciliados` | [BankMovement](./models/BankMovement.md) | One-to-Many | - | - | - |
| `chequesCreated` | [Cheque](./models/Cheque.md) | One-to-Many | - | - | - |
| `treasuryTransfersCreated` | [TreasuryTransfer](./models/TreasuryTransfer.md) | One-to-Many | - | - | - |
| `bankStatementsCreated` | [BankStatement](./models/BankStatement.md) | One-to-Many | - | - | - |
| `bankStatementsCerrados` | [BankStatement](./models/BankStatement.md) | One-to-Many | - | - | - |
| `bankStatementItemsConciliados` | [BankStatementItem](./models/BankStatementItem.md) | One-to-Many | - | - | - |
| `treasuryMovementsCreated` | [TreasuryMovement](./models/TreasuryMovement.md) | One-to-Many | - | - | - |
| `treasuryMovementsConciliados` | [TreasuryMovement](./models/TreasuryMovement.md) | One-to-Many | - | - | - |
| `reservationsPickedBy` | [SparePartReservation](./models/SparePartReservation.md) | One-to-Many | - | - | - |
| `reservationsReturnedBy` | [SparePartReservation](./models/SparePartReservation.md) | One-to-Many | - | - | - |
| `technicianCostRates` | [TechnicianCostRate](./models/TechnicianCostRate.md) | One-to-Many | - | - | - |
| `thirdPartyCostsCreated` | [ThirdPartyCost](./models/ThirdPartyCost.md) | One-to-Many | - | - | - |
| `budgetsCreated` | [MaintenanceBudget](./models/MaintenanceBudget.md) | One-to-Many | - | - | - |
| `subscription` | [Subscription](./models/Subscription.md) | Many-to-One (optional) | - | - | - |
| `companiesAsPrimaryAdmin` | [Company](./models/Company.md) | One-to-Many | - | - | - |
| `billingPaymentsReceived` | [BillingPayment](./models/BillingPayment.md) | One-to-Many | - | - | - |
| `billingAuditLogs` | [BillingAuditLog](./models/BillingAuditLog.md) | One-to-Many | - | - | - |
| `couponsCreated` | [BillingCoupon](./models/BillingCoupon.md) | One-to-Many | - | - | - |
| `automationRulesCreated` | [AutomationRule](./models/AutomationRule.md) | One-to-Many | - | - | - |
| `ideasCreated` | [Idea](./models/Idea.md) | One-to-Many | - | - | - |
| `ideasReviewed` | [Idea](./models/Idea.md) | One-to-Many | - | - | - |
| `ideasImplemented` | [Idea](./models/Idea.md) | One-to-Many | - | - | - |
| `ideaVotes` | [IdeaVote](./models/IdeaVote.md) | One-to-Many | - | - | - |
| `ideaComments` | [IdeaComment](./models/IdeaComment.md) | One-to-Many | - | - | - |
| `costConsolidationsCalculated` | [MonthlyCostConsolidation](./models/MonthlyCostConsolidation.md) | One-to-Many | - | - | - |
| `lotsInstalled` | [LotInstallation](./models/LotInstallation.md) | One-to-Many | - | - | - |
| `lotsRemoved` | [LotInstallation](./models/LotInstallation.md) | One-to-Many | - | - | - |
| `auditLogs` | [AuditLog](./models/AuditLog.md) | One-to-Many | - | - | - |
| `machinesOwned` | [Machine](./models/Machine.md) | One-to-Many | - | - | - |
| `machinesPlanning` | [Machine](./models/Machine.md) | One-to-Many | - | - | - |
| `machinesTechnical` | [Machine](./models/Machine.md) | One-to-Many | - | - | - |
| `lotoProceduresCreated` | [LOTOProcedure](./models/LOTOProcedure.md) | One-to-Many | - | - | - |
| `lotoProceduresApproved` | [LOTOProcedure](./models/LOTOProcedure.md) | One-to-Many | - | - | - |
| `ptwRequested` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwApproved` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwRejected` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwActivated` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwSuspended` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwResumed` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwClosed` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwFinalVerified` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `ptwPPEVerified` | [PermitToWork](./models/PermitToWork.md) | One-to-Many | - | - | - |
| `lotoLockedBy` | [LOTOExecution](./models/LOTOExecution.md) | One-to-Many | - | - | - |
| `lotoZeroEnergyVerifiedBy` | [LOTOExecution](./models/LOTOExecution.md) | One-to-Many | - | - | - |
| `lotoUnlockedBy` | [LOTOExecution](./models/LOTOExecution.md) | One-to-Many | - | - | - |
| `skills` | [UserSkill](./models/UserSkill.md) | One-to-Many | - | - | - |
| `skillsVerified` | [UserSkill](./models/UserSkill.md) | One-to-Many | - | - | - |
| `certifications` | [UserCertification](./models/UserCertification.md) | One-to-Many | - | - | - |
| `counterLastReadings` | [MachineCounter](./models/MachineCounter.md) | One-to-Many | - | - | - |
| `counterReadings` | [MachineCounterReading](./models/MachineCounterReading.md) | One-to-Many | - | - | - |
| `mocRequested` | [ManagementOfChange](./models/ManagementOfChange.md) | One-to-Many | - | - | - |
| `mocReviewed` | [ManagementOfChange](./models/ManagementOfChange.md) | One-to-Many | - | - | - |
| `mocApproved` | [ManagementOfChange](./models/ManagementOfChange.md) | One-to-Many | - | - | - |
| `mocImplemented` | [ManagementOfChange](./models/ManagementOfChange.md) | One-to-Many | - | - | - |
| `mocDocumentsUploaded` | [MOCDocument](./models/MOCDocument.md) | One-to-Many | - | - | - |
| `mocHistoryChanges` | [MOCHistory](./models/MOCHistory.md) | One-to-Many | - | - | - |
| `mocTasksAssigned` | [MOCTask](./models/MOCTask.md) | One-to-Many | - | - | - |
| `mocTasksCompleted` | [MOCTask](./models/MOCTask.md) | One-to-Many | - | - | - |
| `dailyReportsAsOperator` | [DailyProductionReport](./models/DailyProductionReport.md) | One-to-Many | - | - | - |
| `dailyReportsAsSupervisor` | [DailyProductionReport](./models/DailyProductionReport.md) | One-to-Many | - | - | - |
| `dailyReportsConfirmed` | [DailyProductionReport](./models/DailyProductionReport.md) | One-to-Many | - | - | - |
| `dailyReportsReviewed` | [DailyProductionReport](./models/DailyProductionReport.md) | One-to-Many | - | - | - |
| `productionDowntimesReported` | [ProductionDowntime](./models/ProductionDowntime.md) | One-to-Many | - | - | - |
| `productionQCInspected` | [ProductionQualityControl](./models/ProductionQualityControl.md) | One-to-Many | - | - | - |
| `productionDefectsReported` | [ProductionDefect](./models/ProductionDefect.md) | One-to-Many | - | - | - |
| `productionLotsBlocked` | [ProductionBatchLot](./models/ProductionBatchLot.md) | One-to-Many | - | - | - |
| `productionLotsReleased` | [ProductionBatchLot](./models/ProductionBatchLot.md) | One-to-Many | - | - | - |
| `productionEventsPerformed` | [ProductionEvent](./models/ProductionEvent.md) | One-to-Many | - | - | - |
| `productionRoutinesExecuted` | [ProductionRoutine](./models/ProductionRoutine.md) | One-to-Many | - | - | - |
| `productionOrdersResponsible` | [ProductionOrder](./models/ProductionOrder.md) | One-to-Many | - | - | - |
| `productionOrdersCreated` | [ProductionOrder](./models/ProductionOrder.md) | One-to-Many | - | - | - |
| `dailySessionsSubmitted` | [DailyProductionSession](./models/DailyProductionSession.md) | One-to-Many | - | - | - |
| `dailySessionsApproved` | [DailyProductionSession](./models/DailyProductionSession.md) | One-to-Many | - | - | - |
| `dailyEntriesRegistered` | [DailyProductionEntry](./models/DailyProductionEntry.md) | One-to-Many | - | - | - |
| `discordSectorAccess` | [UserDiscordAccess](./models/UserDiscordAccess.md) | One-to-Many | - | - | - |
| `discordAccessGranted` | [UserDiscordAccess](./models/UserDiscordAccess.md) | One-to-Many | - | - | - |
| `voicePurchaseLogs` | [VoicePurchaseLog](./models/VoicePurchaseLog.md) | One-to-Many | - | - | - |
| `voiceFailureLogs` | [VoiceFailureLog](./models/VoiceFailureLog.md) | One-to-Many | - | - | - |
| `recurringPurchaseOrders` | [RecurringPurchaseOrder](./models/RecurringPurchaseOrder.md) | One-to-Many | - | - | - |
| `agendaTasksCreated` | [AgendaTask](./models/AgendaTask.md) | One-to-Many | - | - | - |
| `agendaTasksAssigned` | [AgendaTask](./models/AgendaTask.md) | One-to-Many | - | - | - |
| `agendaReminders` | [AgendaReminder](./models/AgendaReminder.md) | One-to-Many | - | - | - |
| `voiceTaskLogs` | [VoiceTaskLog](./models/VoiceTaskLog.md) | One-to-Many | - | - | - |
| `stockReservationsCreated` | [StockReservation](./models/StockReservation.md) | One-to-Many | - | - | - |
| `materialRequestsSolicitante` | [MaterialRequest](./models/MaterialRequest.md) | One-to-Many | - | - | - |
| `materialRequestsDestinatario` | [MaterialRequest](./models/MaterialRequest.md) | One-to-Many | - | - | - |
| `materialRequestsAprobadas` | [MaterialRequest](./models/MaterialRequest.md) | One-to-Many | - | - | - |
| `despachosDespachador` | [Despacho](./models/Despacho.md) | One-to-Many | - | - | - |
| `despachosDestinatario` | [Despacho](./models/Despacho.md) | One-to-Many | - | - | - |
| `despachosReceptor` | [Despacho](./models/Despacho.md) | One-to-Many | - | - | - |
| `devolucionesDevolviente` | [DevolucionMaterial](./models/DevolucionMaterial.md) | One-to-Many | - | - | - |
| `devolucionesRecibidas` | [DevolucionMaterial](./models/DevolucionMaterial.md) | One-to-Many | - | - | - |
| `warehouseScopes` | [UserWarehouseScope](./models/UserWarehouseScope.md) | One-to-Many | - | - | - |
| `machineImportsCreated` | [MachineImportJob](./models/MachineImportJob.md) | One-to-Many | - | - | - |
| `createdServiceContracts` | [ServiceContract](./models/ServiceContract.md) | One-to-Many | - | - | - |
| `chatSessions` | [ChatSession](./models/ChatSession.md) | One-to-Many | - | - | - |
| `rmasSolicitadas` | [SaleRMA](./models/SaleRMA.md) | One-to-Many | - | - | - |
| `rmasAprobadas` | [SaleRMA](./models/SaleRMA.md) | One-to-Many | - | - | - |
| `rmasProcesadas` | [SaleRMA](./models/SaleRMA.md) | One-to-Many | - | - | - |
| `rmaHistoryEvents` | [SaleRMAHistory](./models/SaleRMAHistory.md) | One-to-Many | - | - | - |
| `goalsAsignadas` | [SalesGoal](./models/SalesGoal.md) | One-to-Many | - | - | - |
| `goalsCreadas` | [SalesGoal](./models/SalesGoal.md) | One-to-Many | - | - | - |
| `performanceDashboards` | [SalesPerformanceDashboard](./models/SalesPerformanceDashboard.md) | One-to-Many | - | - | - |

## Referenced By

| Model | Field | Cardinality |
|-------|-------|-------------|
| [Company](./models/Company.md) | `ownedByUsers` | Has many |
| [Company](./models/Company.md) | `primaryAdmin` | Has one |
| [UserOnCompany](./models/UserOnCompany.md) | `user` | Has one |
| [UserDiscordAccess](./models/UserDiscordAccess.md) | `user` | Has one |
| [UserDiscordAccess](./models/UserDiscordAccess.md) | `granter` | Has one |
| [KilometrajeLog](./models/KilometrajeLog.md) | `registradoPor` | Has one |
| [Machine](./models/Machine.md) | `owner` | Has one |
| [Machine](./models/Machine.md) | `planner` | Has one |
| [Machine](./models/Machine.md) | `technician` | Has one |
| [MachineImportJob](./models/MachineImportJob.md) | `createdBy` | Has one |
| [ToolLoan](./models/ToolLoan.md) | `user` | Has one |
| [SparePartReservation](./models/SparePartReservation.md) | `pickedBy` | Has one |
| [SparePartReservation](./models/SparePartReservation.md) | `returnedBy` | Has one |
| [LotInstallation](./models/LotInstallation.md) | `installedBy` | Has one |
| [LotInstallation](./models/LotInstallation.md) | `removedBy` | Has one |
| [WorkOrder](./models/WorkOrder.md) | `assignedTo` | Has one |
| [WorkOrder](./models/WorkOrder.md) | `createdBy` | Has one |
| [FailureOccurrence](./models/FailureOccurrence.md) | `reporter` | Has one |
| [FailureOccurrence](./models/FailureOccurrence.md) | `linkedBy` | Has one |
| [FailureOccurrence](./models/FailureOccurrence.md) | `reopenedByUser` | Has one |
| [FailureSolution](./models/FailureSolution.md) | `appliedBy` | Has one |
| [SolutionApplication](./models/SolutionApplication.md) | `appliedBy` | Has one |
| [WorkOrderComment](./models/WorkOrderComment.md) | `author` | Has one |
| [WorkOrderAttachment](./models/WorkOrderAttachment.md) | `uploadedBy` | Has one |
| [Task](./models/Task.md) | `assignedTo` | Has one |
| [Task](./models/Task.md) | `createdBy` | Has one |
| [TaskAttachment](./models/TaskAttachment.md) | `uploadedBy` | Has one |
| [TaskComment](./models/TaskComment.md) | `user` | Has one |
| [FixedTask](./models/FixedTask.md) | `assignedTo` | Has one |
| [FixedTask](./models/FixedTask.md) | `createdBy` | Has one |
| [FixedTaskExecution](./models/FixedTaskExecution.md) | `user` | Has one |
| [Document](./models/Document.md) | `uploadedBy` | Has one |
| [HistoryEvent](./models/HistoryEvent.md) | `user` | Has one |
| [Notification](./models/Notification.md) | `user` | Has one |
| [NotificationPreferences](./models/NotificationPreferences.md) | `user` | Has one |
| [ToolRequest](./models/ToolRequest.md) | `requester` | Has one |
| [Contact](./models/Contact.md) | `user` | Has one |
| [Reminder](./models/Reminder.md) | `user` | Has one |
| [ContactInteraction](./models/ContactInteraction.md) | `user` | Has one |
| [UserPermission](./models/UserPermission.md) | `grantedBy` | Has one |
| [UserPermission](./models/UserPermission.md) | `user` | Has one |
| [Category](./models/Category.md) | `createdBy` | Has one |
| [Product](./models/Product.md) | `createdBy` | Has one |
| [ProductStockMovement](./models/ProductStockMovement.md) | `user` | Has one |
| [WorkStationInstructive](./models/WorkStationInstructive.md) | `createdBy` | Has one |
| [SupplierChangeRequest](./models/SupplierChangeRequest.md) | `solicitante` | Has one |
| [SupplierChangeRequest](./models/SupplierChangeRequest.md) | `aprobador` | Has one |
| [SupplierChangeRequest](./models/SupplierChangeRequest.md) | `rechazador` | Has one |
| [SupplierChangeRequest](./models/SupplierChangeRequest.md) | `segundoAprobador` | Has one |
| [SupplierAccountMovement](./models/SupplierAccountMovement.md) | `conciliadoByUser` | Has one |
| [SupplierAccountMovement](./models/SupplierAccountMovement.md) | `createdByUser` | Has one |
| [TaxBase](./models/TaxBase.md) | `createdByUser` | Has one |
| [TaxRecord](./models/TaxRecord.md) | `paidByUser` | Has one |
| [TaxRecord](./models/TaxRecord.md) | `receivedByUser` | Has one |
| [Control](./models/Control.md) | `createdByUser` | Has one |
| [Client](./models/Client.md) | `seller` | Has one |
| [Client](./models/Client.md) | `blockedByUser` | Has one |
| [ClientBlockHistory](./models/ClientBlockHistory.md) | `bloqueador` | Has one |
| [ClientBlockHistory](./models/ClientBlockHistory.md) | `desbloqueador` | Has one |
| [ClientNote](./models/ClientNote.md) | `user` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `createdByUser` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `ingresoConfirmadoByUser` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `pagoForzadoByUser` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `validadoByUser` | Has one |
| [PurchaseReceipt](./models/PurchaseReceipt.md) | `payApprovedByUser` | Has one |
| [PaymentOrder](./models/PaymentOrder.md) | `createdByUser` | Has one |
| [checklist_executions](./models/checklist_executions.md) | `User` | Has one |
| [maintenance_history](./models/maintenance_history.md) | `User` | Has one |
| [UserDashboardConfig](./models/UserDashboardConfig.md) | `user` | Has one |
| [UserColorPreferences](./models/UserColorPreferences.md) | `user` | Has one |
| [DowntimeLog](./models/DowntimeLog.md) | `returnedBy` | Has one |
| [WorkLog](./models/WorkLog.md) | `performedBy` | Has one |
| [Template](./models/Template.md) | `createdBy` | Has one |
| [QualityAssurance](./models/QualityAssurance.md) | `verifiedBy` | Has one |
| [QualityAssurance](./models/QualityAssurance.md) | `returnConfirmedBy` | Has one |
| [FailureWatcher](./models/FailureWatcher.md) | `user` | Has one |
| [WorkOrderWatcher](./models/WorkOrderWatcher.md) | `user` | Has one |
| [FailureOccurrenceComment](./models/FailureOccurrenceComment.md) | `author` | Has one |
| [SolutionApplied](./models/SolutionApplied.md) | `performedBy` | Has one |
| [FailureOccurrenceEvent](./models/FailureOccurrenceEvent.md) | `createdBy` | Has one |
| [ActivityEvent](./models/ActivityEvent.md) | `performedBy` | Has one |
| [RootCauseAnalysis](./models/RootCauseAnalysis.md) | `createdBy` | Has one |
| [WorkOrderChecklist](./models/WorkOrderChecklist.md) | `completedBy` | Has one |
| [AssistantConversation](./models/AssistantConversation.md) | `user` | Has one |
| [AssistantActionLog](./models/AssistantActionLog.md) | `user` | Has one |
| [StockMovement](./models/StockMovement.md) | `createdByUser` | Has one |
| [StockTransfer](./models/StockTransfer.md) | `createdByUser` | Has one |
| [StockAdjustment](./models/StockAdjustment.md) | `createdByUser` | Has one |
| [StockAdjustment](./models/StockAdjustment.md) | `aprobadoByUser` | Has one |
| [PurchaseOrder](./models/PurchaseOrder.md) | `createdByUser` | Has one |
| [PurchaseOrder](./models/PurchaseOrder.md) | `aprobadoByUser` | Has one |
| [PurchaseOrder](./models/PurchaseOrder.md) | `rechazadoByUser` | Has one |
| [GoodsReceipt](./models/GoodsReceipt.md) | `createdByUser` | Has one |
| [GoodsReceipt](./models/GoodsReceipt.md) | `regularizedByUser` | Has one |
| [CreditDebitNote](./models/CreditDebitNote.md) | `createdByUser` | Has one |
| [CreditNoteRequest](./models/CreditNoteRequest.md) | `createdByUser` | Has one |
| [MatchResult](./models/MatchResult.md) | `resueltoByUser` | Has one |
| [MatchException](./models/MatchException.md) | `resueltoByUser` | Has one |
| [MatchException](./models/MatchException.md) | `owner` | Has one |
| [MatchException](./models/MatchException.md) | `escalatedToUser` | Has one |
| [MatchExceptionHistory](./models/MatchExceptionHistory.md) | `user` | Has one |
| [SoDViolation](./models/SoDViolation.md) | `user` | Has one |
| [PurchaseApproval](./models/PurchaseApproval.md) | `asignadoAUser` | Has one |
| [PurchaseApproval](./models/PurchaseApproval.md) | `resueltoByUser` | Has one |
| [PurchaseApproval](./models/PurchaseApproval.md) | `createdByUser` | Has one |
| [PaymentRequest](./models/PaymentRequest.md) | `createdByUser` | Has one |
| [PaymentRequest](./models/PaymentRequest.md) | `aprobadoByUser` | Has one |
| [PaymentRequest](./models/PaymentRequest.md) | `rechazadoByUser` | Has one |
| [PaymentRequestLog](./models/PaymentRequestLog.md) | `user` | Has one |
| [PurchaseReturn](./models/PurchaseReturn.md) | `createdByUser` | Has one |
| [PurchaseAuditLog](./models/PurchaseAuditLog.md) | `user` | Has one |
| [PurchaseRequest](./models/PurchaseRequest.md) | `solicitante` | Has one |
| [PurchaseQuotation](./models/PurchaseQuotation.md) | `createdByUser` | Has one |
| [PurchaseQuotation](./models/PurchaseQuotation.md) | `seleccionadaByUser` | Has one |
| [QuotationStatusHistory](./models/QuotationStatusHistory.md) | `user` | Has one |
| [PurchaseComment](./models/PurchaseComment.md) | `user` | Has one |
| [RefreshToken](./models/RefreshToken.md) | `user` | Has one |
| [Session](./models/Session.md) | `user` | Has one |
| [LoginAttempt](./models/LoginAttempt.md) | `user` | Has one |
| [UserTwoFactor](./models/UserTwoFactor.md) | `user` | Has one |
| [TrustedDevice](./models/TrustedDevice.md) | `user` | Has one |
| [SecurityEvent](./models/SecurityEvent.md) | `user` | Has one |
| [Quote](./models/Quote.md) | `seller` | Has one |
| [Quote](./models/Quote.md) | `createdByUser` | Has one |
| [Quote](./models/Quote.md) | `aprobadoByUser` | Has one |
| [QuoteVersion](./models/QuoteVersion.md) | `user` | Has one |
| [Sale](./models/Sale.md) | `seller` | Has one |
| [Sale](./models/Sale.md) | `createdByUser` | Has one |
| [Sale](./models/Sale.md) | `aprobadoByUser` | Has one |
| [SaleDelivery](./models/SaleDelivery.md) | `createdByUser` | Has one |
| [LoadOrder](./models/LoadOrder.md) | `createdByUser` | Has one |
| [LoadOrder](./models/LoadOrder.md) | `confirmedBy` | Has one |
| [SaleRemito](./models/SaleRemito.md) | `createdByUser` | Has one |
| [SalesInvoice](./models/SalesInvoice.md) | `createdByUser` | Has one |
| [SalesCreditDebitNote](./models/SalesCreditDebitNote.md) | `createdByUser` | Has one |
| [ClientPayment](./models/ClientPayment.md) | `createdByUser` | Has one |
| [CollectionAttempt](./models/CollectionAttempt.md) | `user` | Has one |
| [SalesApproval](./models/SalesApproval.md) | `solicitante` | Has one |
| [SalesApproval](./models/SalesApproval.md) | `asignado` | Has one |
| [SalesApproval](./models/SalesApproval.md) | `resolutor` | Has one |
| [SalesAuditLog](./models/SalesAuditLog.md) | `user` | Has one |
| [SellerKPI](./models/SellerKPI.md) | `seller` | Has one |
| [SaleRMA](./models/SaleRMA.md) | `solicitante` | Has one |
| [SaleRMA](./models/SaleRMA.md) | `aprobador` | Has one |
| [SaleRMA](./models/SaleRMA.md) | `procesador` | Has one |
| [SaleRMAHistory](./models/SaleRMAHistory.md) | `user` | Has one |
| [SalesGoal](./models/SalesGoal.md) | `vendedor` | Has one |
| [SalesGoal](./models/SalesGoal.md) | `creator` | Has one |
| [SalesPerformanceDashboard](./models/SalesPerformanceDashboard.md) | `vendedor` | Has one |
| [CompanyModule](./models/CompanyModule.md) | `enabledByUser` | Has one |
| [SaleAcopio](./models/SaleAcopio.md) | `createdByUser` | Has one |
| [AcopioRetiro](./models/AcopioRetiro.md) | `createdByUser` | Has one |
| [CashAccount](./models/CashAccount.md) | `createdByUser` | Has one |
| [CashMovement](./models/CashMovement.md) | `createdByUser` | Has one |
| [BankAccount](./models/BankAccount.md) | `createdByUser` | Has one |
| [BankMovement](./models/BankMovement.md) | `createdByUser` | Has one |
| [BankMovement](./models/BankMovement.md) | `conciliadoByUser` | Has one |
| [Cheque](./models/Cheque.md) | `createdByUser` | Has one |
| [TreasuryTransfer](./models/TreasuryTransfer.md) | `createdByUser` | Has one |
| [BankStatement](./models/BankStatement.md) | `createdByUser` | Has one |
| [BankStatement](./models/BankStatement.md) | `cerradoPorUser` | Has one |
| [BankStatementItem](./models/BankStatementItem.md) | `conciliadoByUser` | Has one |
| [TreasuryMovement](./models/TreasuryMovement.md) | `createdByUser` | Has one |
| [TreasuryMovement](./models/TreasuryMovement.md) | `conciliadoByUser` | Has one |
| [Subscription](./models/Subscription.md) | `user` | Has one |
| [BillingPayment](./models/BillingPayment.md) | `receivedByUser` | Has one |
| [BillingAuditLog](./models/BillingAuditLog.md) | `user` | Has one |
| [BillingCoupon](./models/BillingCoupon.md) | `createdByUser` | Has one |
| [TechnicianCostRate](./models/TechnicianCostRate.md) | `user` | Has one |
| [ThirdPartyCost](./models/ThirdPartyCost.md) | `createdBy` | Has one |
| [MaintenanceBudget](./models/MaintenanceBudget.md) | `createdBy` | Has one |
| [AutomationRule](./models/AutomationRule.md) | `createdBy` | Has one |
| [Idea](./models/Idea.md) | `createdBy` | Has one |
| [Idea](./models/Idea.md) | `reviewedBy` | Has one |
| [Idea](./models/Idea.md) | `implementedBy` | Has one |
| [IdeaVote](./models/IdeaVote.md) | `user` | Has one |
| [IdeaComment](./models/IdeaComment.md) | `user` | Has one |
| [MonthlyCostConsolidation](./models/MonthlyCostConsolidation.md) | `calculatedBy` | Has one |
| [AuditLog](./models/AuditLog.md) | `performedBy` | Has one |
| [LOTOProcedure](./models/LOTOProcedure.md) | `createdBy` | Has one |
| [LOTOProcedure](./models/LOTOProcedure.md) | `approvedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `requestedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `approvedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `rejectedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `activatedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `suspendedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `resumedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `closedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `finalVerifiedBy` | Has one |
| [PermitToWork](./models/PermitToWork.md) | `ppeVerifiedBy` | Has one |
| [LOTOExecution](./models/LOTOExecution.md) | `lockedBy` | Has one |
| [LOTOExecution](./models/LOTOExecution.md) | `zeroEnergyVerifiedBy` | Has one |
| [LOTOExecution](./models/LOTOExecution.md) | `unlockedBy` | Has one |
| [UserSkill](./models/UserSkill.md) | `user` | Has one |
| [UserSkill](./models/UserSkill.md) | `verifiedBy` | Has one |
| [UserCertification](./models/UserCertification.md) | `user` | Has one |
| [MachineCounter](./models/MachineCounter.md) | `lastReadingBy` | Has one |
| [MachineCounterReading](./models/MachineCounterReading.md) | `recordedBy` | Has one |
| [ManagementOfChange](./models/ManagementOfChange.md) | `requestedBy` | Has one |
| [ManagementOfChange](./models/ManagementOfChange.md) | `reviewedBy` | Has one |
| [ManagementOfChange](./models/ManagementOfChange.md) | `approvedBy` | Has one |
| [ManagementOfChange](./models/ManagementOfChange.md) | `implementedBy` | Has one |
| [MOCDocument](./models/MOCDocument.md) | `uploadedBy` | Has one |
| [MOCHistory](./models/MOCHistory.md) | `changedBy` | Has one |
| [MOCTask](./models/MOCTask.md) | `assignedTo` | Has one |
| [MOCTask](./models/MOCTask.md) | `completedBy` | Has one |
| [ProductionOrder](./models/ProductionOrder.md) | `responsible` | Has one |
| [ProductionOrder](./models/ProductionOrder.md) | `createdBy` | Has one |
| [DailyProductionReport](./models/DailyProductionReport.md) | `operator` | Has one |
| [DailyProductionReport](./models/DailyProductionReport.md) | `supervisor` | Has one |
| [DailyProductionReport](./models/DailyProductionReport.md) | `confirmedBy` | Has one |
| [DailyProductionReport](./models/DailyProductionReport.md) | `reviewedBy` | Has one |
| [ProductionDowntime](./models/ProductionDowntime.md) | `reportedBy` | Has one |
| [ProductionQualityControl](./models/ProductionQualityControl.md) | `inspectedBy` | Has one |
| [ProductionDefect](./models/ProductionDefect.md) | `reportedBy` | Has one |
| [ProductionBatchLot](./models/ProductionBatchLot.md) | `blockedBy` | Has one |
| [ProductionBatchLot](./models/ProductionBatchLot.md) | `releasedBy` | Has one |
| [ProductionEvent](./models/ProductionEvent.md) | `performedBy` | Has one |
| [ProductionRoutine](./models/ProductionRoutine.md) | `executedBy` | Has one |
| [DailyProductionSession](./models/DailyProductionSession.md) | `submittedBy` | Has one |
| [DailyProductionSession](./models/DailyProductionSession.md) | `approvedBy` | Has one |
| [DailyProductionEntry](./models/DailyProductionEntry.md) | `registeredBy` | Has one |
| [VoicePurchaseLog](./models/VoicePurchaseLog.md) | `user` | Has one |
| [VoiceFailureLog](./models/VoiceFailureLog.md) | `user` | Has one |
| [RecurringPurchaseOrder](./models/RecurringPurchaseOrder.md) | `creador` | Has one |
| [AgendaTask](./models/AgendaTask.md) | `createdBy` | Has one |
| [AgendaTask](./models/AgendaTask.md) | `assignedToUser` | Has one |
| [AgendaReminder](./models/AgendaReminder.md) | `user` | Has one |
| [VoiceTaskLog](./models/VoiceTaskLog.md) | `user` | Has one |
| [StockReservation](./models/StockReservation.md) | `createdByUser` | Has one |
| [MaterialRequest](./models/MaterialRequest.md) | `solicitante` | Has one |
| [MaterialRequest](./models/MaterialRequest.md) | `destinatario` | Has one |
| [MaterialRequest](./models/MaterialRequest.md) | `aprobadoByUser` | Has one |
| [Despacho](./models/Despacho.md) | `despachador` | Has one |
| [Despacho](./models/Despacho.md) | `destinatario` | Has one |
| [Despacho](./models/Despacho.md) | `receptor` | Has one |
| [DevolucionMaterial](./models/DevolucionMaterial.md) | `devolviente` | Has one |
| [DevolucionMaterial](./models/DevolucionMaterial.md) | `recibidoByUser` | Has one |
| [UserWarehouseScope](./models/UserWarehouseScope.md) | `user` | Has one |
| [ServiceContract](./models/ServiceContract.md) | `createdBy` | Has one |
| [ChatSession](./models/ChatSession.md) | `user` | Has one |

## Indexes

- `role, isActive`
- `isActive`

## Entity Diagram

```mermaid
erDiagram
    User {
        int id PK
        string name
        string email UK
        string password
        string avatar
        string logo
        boolean isActive
        datetime lastLogin
        datetime createdAt
        datetime updatedAt
        string phone
        string discordUserId UK
        json sidebarPreferences
        checklist_executions checklist_executions
        maintenance_history maintenance_history
    }
    Category {
        int id PK
    }
    Client {
        string id PK
    }
    ClientBlockHistory {
        string id PK
    }
    ClientNote {
        string id PK
    }
    Contact {
        int id PK
    }
    ContactInteraction {
        int id PK
    }
    Document {
        int id PK
    }
    FixedTask {
        int id PK
    }
    FixedTaskExecution {
        int id PK
    }
    HistoryEvent {
        int id PK
    }
    Notification {
        int id PK
    }
    NotificationPreferences {
        int id PK
    }
    Product {
        string id PK
    }
    ProductStockMovement {
        string id PK
    }
    PurchaseReceipt {
        int id PK
    }
    PaymentOrder {
        int id PK
    }
    Reminder {
        int id PK
    }
    Task {
        int id PK
    }
    TaskAttachment {
        int id PK
    }
    TaskComment {
        int id PK
    }
    TaxBase {
        int id PK
    }
    TaxRecord {
        int id PK
    }
    Control {
        int id PK
    }
    ToolLoan {
        int id PK
    }
    ToolRequest {
        int id PK
    }
    UserOnCompany {
        int id PK
    }
    UserPermission {
        int id PK
    }
    WorkOrderAttachment {
        int id PK
    }
    WorkOrderComment {
        int id PK
    }
    WorkStationInstructive {
        int id PK
    }
    FailureOccurrence {
        int id PK
    }
    FailureSolution {
        int id PK
    }
    SolutionApplication {
        int id PK
    }
    WorkOrder {
        int id PK
    }
    Company {
        int id PK
    }
    UserDashboardConfig {
        int id PK
    }
    UserColorPreferences {
        int id PK
    }
    WorkLog {
        int id PK
    }
    Template {
        int id PK
    }
    QualityAssurance {
        int id PK
    }
    FailureWatcher {
        int id PK
    }
    WorkOrderWatcher {
        int id PK
    }
    SolutionApplied {
        int id PK
    }
    DowntimeLog {
        int id PK
    }
    FailureOccurrenceComment {
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
    WorkOrderChecklist {
        int id PK
    }
    AssistantConversation {
        int id PK
    }
    AssistantActionLog {
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
    PurchaseApproval {
        int id PK
    }
    MatchResult {
        int id PK
    }
    MatchException {
        int id PK
    }
    MatchExceptionHistory {
        int id PK
    }
    SoDViolation {
        int id PK
    }
    PaymentRequest {
        int id PK
    }
    PaymentRequestLog {
        int id PK
    }
    PurchaseReturn {
        int id PK
    }
    StockMovement {
        int id PK
    }
    PurchaseAuditLog {
        int id PK
    }
    StockTransfer {
        int id PK
    }
    StockAdjustment {
        int id PK
    }
    SupplierAccountMovement {
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
    QuotationStatusHistory {
        int id PK
    }
    CreditNoteRequest {
        int id PK
    }
    SupplierChangeRequest {
        int id PK
    }
    RefreshToken {
        string id PK
    }
    Session {
        string id PK
    }
    LoginAttempt {
        string id PK
    }
    UserTwoFactor {
        string id PK
    }
    TrustedDevice {
        string id PK
    }
    SecurityEvent {
        string id PK
    }
    KilometrajeLog {
        int id PK
    }
    Quote {
        int id PK
    }
    QuoteVersion {
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
    SalesAuditLog {
        int id PK
    }
    SellerKPI {
        int id PK
    }
    SalesApproval {
        int id PK
    }
    CollectionAttempt {
        int id PK
    }
    LoadOrder {
        int id PK
    }
    CompanyModule {
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
    BankStatementItem {
        int id PK
    }
    TreasuryMovement {
        int id PK
    }
    SparePartReservation {
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
    Subscription {
        string id PK
    }
    BillingPayment {
        string id PK
    }
    BillingAuditLog {
        string id PK
    }
    BillingCoupon {
        string id PK
    }
    AutomationRule {
        int id PK
    }
    Idea {
        int id PK
    }
    IdeaVote {
        int id PK
    }
    IdeaComment {
        int id PK
    }
    MonthlyCostConsolidation {
        int id PK
    }
    LotInstallation {
        int id PK
    }
    AuditLog {
        int id PK
    }
    Machine {
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
    UserSkill {
        int id PK
    }
    UserCertification {
        int id PK
    }
    MachineCounter {
        int id PK
    }
    MachineCounterReading {
        int id PK
    }
    ManagementOfChange {
        int id PK
    }
    MOCDocument {
        int id PK
    }
    MOCHistory {
        int id PK
    }
    MOCTask {
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
    ProductionRoutine {
        int id PK
    }
    ProductionOrder {
        int id PK
    }
    DailyProductionSession {
        int id PK
    }
    DailyProductionEntry {
        int id PK
    }
    UserDiscordAccess {
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
    UserWarehouseScope {
        int id PK
    }
    MachineImportJob {
        int id PK
    }
    ServiceContract {
        int id PK
    }
    ChatSession {
        string id PK
    }
    SaleRMA {
        string id PK
    }
    SaleRMAHistory {
        int id PK
    }
    SalesGoal {
        string id PK
    }
    SalesPerformanceDashboard {
        string id PK
    }
    checklist_executions {
        int id PK
    }
    maintenance_history {
        int id PK
    }
    User }|--|| UserRole : "role"
    User ||--o{ Category : "createdCategories"
    User ||--o{ Client : "clientsSold"
    User ||--o{ Client : "clientsBlocked"
    User ||--o{ ClientBlockHistory : "clientBlocksCreated"
    User ||--o{ ClientBlockHistory : "clientBlocksResolved"
    User ||--o{ ClientNote : "clientNotes"
    User ||--o{ Contact : "contacts"
    User ||--o{ ContactInteraction : "contactInteractions"
    User ||--o{ Document : "documents"
    User ||--o{ FixedTask : "assignedFixedTasks"
    User ||--o{ FixedTask : "createdFixedTasks"
    User ||--o{ FixedTaskExecution : "fixedTaskExecutions"
    User ||--o{ HistoryEvent : "historyEvents"
    User ||--o{ Notification : "notifications"
    User ||--o{ NotificationPreferences : "notificationPreferences"
    User ||--o{ Product : "createdProducts"
    User ||--o{ ProductStockMovement : "productStockMovements"
    User ||--o{ PurchaseReceipt : "createdPurchaseReceipts"
    User ||--o{ PaymentOrder : "createdPaymentOrders"
    User ||--o{ Reminder : "reminders"
    User ||--o{ Task : "assignedTasks"
    User ||--o{ Task : "createdTasks"
    User ||--o{ TaskAttachment : "taskAttachments"
    User ||--o{ TaskComment : "taskComments"
    User ||--o{ TaxBase : "taxBasesCreated"
    User ||--o{ TaxRecord : "taxRecordsPaid"
    User ||--o{ TaxRecord : "taxRecordsReceived"
    User ||--o{ Control : "controlsCreated"
    User ||--o{ ToolLoan : "toolLoans"
    User ||--o{ ToolRequest : "toolRequests"
    User ||--o{ UserOnCompany : "companies"
    User ||--o{ UserPermission : "grantedPermissions"
    User ||--o{ UserPermission : "userPermissions"
    User ||--o{ WorkOrderAttachment : "workOrderAttachments"
    User ||--o{ WorkOrderComment : "workOrderComments"
    User ||--o{ WorkStationInstructive : "workStations"
    User ||--o{ FailureOccurrence : "failureOccurrences"
    User ||--o{ FailureSolution : "solutionsApplied"
    User ||--o{ SolutionApplication : "solutionApplications"
    User ||--o{ WorkOrder : "assignedWorkOrders"
    User ||--o{ WorkOrder : "createdWorkOrders"
    User ||--o{ Company : "ownedCompanies"
    User ||--o{ UserDashboardConfig : "dashboardConfigs"
    User ||--o{ UserColorPreferences : "colorPreferences"
    User ||--o{ WorkLog : "workLogsPerformed"
    User ||--o{ Template : "templatesCreated"
    User ||--o{ QualityAssurance : "qaVerifications"
    User ||--o{ QualityAssurance : "qaReturnConfirmed"
    User ||--o{ FailureWatcher : "failureWatchers"
    User ||--o{ WorkOrderWatcher : "workOrderWatchers"
    User ||--o{ SolutionApplied : "solutionsAppliedPerformed"
    User ||--o{ DowntimeLog : "downtimeReturned"
    User ||--o{ FailureOccurrence : "occurrencesLinked"
    User ||--o{ FailureOccurrence : "occurrencesReopened"
    User ||--o{ FailureOccurrenceComment : "failureOccurrenceComments"
    User ||--o{ FailureOccurrenceEvent : "occurrenceEventsCreated"
    User ||--o{ ActivityEvent : "activityEventsPerformed"
    User ||--o{ RootCauseAnalysis : "rcaCreated"
    User ||--o{ WorkOrderChecklist : "checklistsCompleted"
    User ||--o{ AssistantConversation : "assistantConversations"
    User ||--o{ AssistantActionLog : "assistantActionLogs"
    User ||--o{ PurchaseOrder : "purchaseOrdersCreated"
    User ||--o{ PurchaseOrder : "purchaseOrdersApproved"
    User ||--o{ PurchaseOrder : "purchaseOrdersRejected"
    User ||--o{ GoodsReceipt : "goodsReceiptsCreated"
    User ||--o{ CreditDebitNote : "creditDebitNotesCreated"
    User ||--o{ PurchaseApproval : "approvalsAssigned"
    User ||--o{ PurchaseApproval : "approvalsResolved"
    User ||--o{ PurchaseApproval : "approvalsCreated"
    User ||--o{ MatchResult : "matchResultsResolved"
    User ||--o{ MatchException : "matchExceptionsResolved"
    User ||--o{ MatchException : "matchExceptionsOwned"
    User ||--o{ MatchException : "matchExceptionsEscalated"
    User ||--o{ MatchExceptionHistory : "matchExceptionHistory"
    User ||--o{ SoDViolation : "sodViolations"
    User ||--o{ PaymentRequest : "paymentRequestsCreated"
    User ||--o{ PaymentRequest : "paymentRequestsApproved"
    User ||--o{ PaymentRequest : "paymentRequestsRejected"
    User ||--o{ PaymentRequestLog : "paymentRequestLogs"
    User ||--o{ PurchaseReturn : "purchaseReturnsCreated"
    User ||--o{ StockMovement : "stockMovementsCreated"
    User ||--o{ PurchaseAuditLog : "purchaseAuditLogs"
    User ||--o{ StockTransfer : "stockTransfersCreated"
    User ||--o{ StockAdjustment : "stockAdjustmentsCreated"
    User ||--o{ StockAdjustment : "stockAdjustmentsApproved"
    User ||--o{ SupplierAccountMovement : "movementsConciliados"
    User ||--o{ SupplierAccountMovement : "movementsCreated"
    User ||--o{ PurchaseRequest : "purchaseRequestsSolicitante"
    User ||--o{ PurchaseQuotation : "quotationsCreated"
    User ||--o{ PurchaseQuotation : "quotationsSelected"
    User ||--o{ PurchaseComment : "purchaseComments"
    User ||--o{ QuotationStatusHistory : "quotationStatusChanges"
    User ||--o{ PurchaseReceipt : "receiptsIngresoConfirmado"
    User ||--o{ PurchaseReceipt : "receiptsPagoForzado"
    User ||--o{ PurchaseReceipt : "receiptsValidado"
    User ||--o{ PurchaseReceipt : "receiptsPayApproved"
    User ||--o{ GoodsReceipt : "goodsReceiptsRegularized"
    User ||--o{ CreditNoteRequest : "creditNoteRequestsCreated"
    User ||--o{ SupplierChangeRequest : "supplierChangeRequestsCreated"
    User ||--o{ SupplierChangeRequest : "supplierChangeRequestsApproved"
    User ||--o{ SupplierChangeRequest : "supplierChangeRequestsRejected"
    User ||--o{ SupplierChangeRequest : "supplierChangeRequests2Approved"
    User ||--o{ RefreshToken : "refreshTokens"
    User ||--o{ Session : "sessions"
    User ||--o{ LoginAttempt : "loginAttempts"
    User }o--|| UserTwoFactor : "twoFactor"
    User ||--o{ TrustedDevice : "trustedDevices"
    User ||--o{ SecurityEvent : "securityEvents"
    User ||--o{ KilometrajeLog : "kilometrajeLogs"
    User ||--o{ Quote : "quotesAsSeller"
    User ||--o{ Quote : "quotesCreated"
    User ||--o{ Quote : "quotesApproved"
    User ||--o{ QuoteVersion : "quoteVersions"
    User ||--o{ Sale : "salesAsSeller"
    User ||--o{ Sale : "salesCreated"
    User ||--o{ Sale : "salesApproved"
    User ||--o{ SaleDelivery : "deliveriesCreated"
    User ||--o{ SaleRemito : "remitosCreated"
    User ||--o{ SalesInvoice : "invoicesCreated"
    User ||--o{ SalesCreditDebitNote : "creditNotesCreated"
    User ||--o{ ClientPayment : "clientPaymentsCreated"
    User ||--o{ SalesAuditLog : "salesAuditLogs"
    User ||--o{ SellerKPI : "sellerKPIs"
    User ||--o{ SalesApproval : "salesApprovalsSolicited"
    User ||--o{ SalesApproval : "salesApprovalsAssigned"
    User ||--o{ SalesApproval : "salesApprovalsResolved"
    User ||--o{ CollectionAttempt : "collectionAttempts"
    User ||--o{ LoadOrder : "loadOrdersCreated"
    User ||--o{ LoadOrder : "loadOrdersConfirmed"
    User ||--o{ CompanyModule : "modulesEnabled"
    User ||--o{ SaleAcopio : "acopiosCreated"
    User ||--o{ AcopioRetiro : "retirosCreated"
    User ||--o{ CashAccount : "cashAccountsCreated"
    User ||--o{ CashMovement : "cashMovementsCreated"
    User ||--o{ BankAccount : "bankAccountsCreated"
    User ||--o{ BankMovement : "bankMovementsCreated"
    User ||--o{ BankMovement : "bankMovementsConciliados"
    User ||--o{ Cheque : "chequesCreated"
    User ||--o{ TreasuryTransfer : "treasuryTransfersCreated"
    User ||--o{ BankStatement : "bankStatementsCreated"
    User ||--o{ BankStatement : "bankStatementsCerrados"
    User ||--o{ BankStatementItem : "bankStatementItemsConciliados"
    User ||--o{ TreasuryMovement : "treasuryMovementsCreated"
    User ||--o{ TreasuryMovement : "treasuryMovementsConciliados"
    User ||--o{ SparePartReservation : "reservationsPickedBy"
    User ||--o{ SparePartReservation : "reservationsReturnedBy"
    User ||--o{ TechnicianCostRate : "technicianCostRates"
    User ||--o{ ThirdPartyCost : "thirdPartyCostsCreated"
    User ||--o{ MaintenanceBudget : "budgetsCreated"
    User }o--|| Subscription : "subscription"
    User ||--o{ Company : "companiesAsPrimaryAdmin"
    User ||--o{ BillingPayment : "billingPaymentsReceived"
    User ||--o{ BillingAuditLog : "billingAuditLogs"
    User ||--o{ BillingCoupon : "couponsCreated"
    User ||--o{ AutomationRule : "automationRulesCreated"
    User ||--o{ Idea : "ideasCreated"
    User ||--o{ Idea : "ideasReviewed"
    User ||--o{ Idea : "ideasImplemented"
    User ||--o{ IdeaVote : "ideaVotes"
    User ||--o{ IdeaComment : "ideaComments"
    User ||--o{ MonthlyCostConsolidation : "costConsolidationsCalculated"
    User ||--o{ LotInstallation : "lotsInstalled"
    User ||--o{ LotInstallation : "lotsRemoved"
    User ||--o{ AuditLog : "auditLogs"
    User ||--o{ Machine : "machinesOwned"
    User ||--o{ Machine : "machinesPlanning"
    User ||--o{ Machine : "machinesTechnical"
    User ||--o{ LOTOProcedure : "lotoProceduresCreated"
    User ||--o{ LOTOProcedure : "lotoProceduresApproved"
    User ||--o{ PermitToWork : "ptwRequested"
    User ||--o{ PermitToWork : "ptwApproved"
    User ||--o{ PermitToWork : "ptwRejected"
    User ||--o{ PermitToWork : "ptwActivated"
    User ||--o{ PermitToWork : "ptwSuspended"
    User ||--o{ PermitToWork : "ptwResumed"
    User ||--o{ PermitToWork : "ptwClosed"
    User ||--o{ PermitToWork : "ptwFinalVerified"
    User ||--o{ PermitToWork : "ptwPPEVerified"
    User ||--o{ LOTOExecution : "lotoLockedBy"
    User ||--o{ LOTOExecution : "lotoZeroEnergyVerifiedBy"
    User ||--o{ LOTOExecution : "lotoUnlockedBy"
    User ||--o{ UserSkill : "skills"
    User ||--o{ UserSkill : "skillsVerified"
    User ||--o{ UserCertification : "certifications"
    User ||--o{ MachineCounter : "counterLastReadings"
    User ||--o{ MachineCounterReading : "counterReadings"
    User ||--o{ ManagementOfChange : "mocRequested"
    User ||--o{ ManagementOfChange : "mocReviewed"
    User ||--o{ ManagementOfChange : "mocApproved"
    User ||--o{ ManagementOfChange : "mocImplemented"
    User ||--o{ MOCDocument : "mocDocumentsUploaded"
    User ||--o{ MOCHistory : "mocHistoryChanges"
    User ||--o{ MOCTask : "mocTasksAssigned"
    User ||--o{ MOCTask : "mocTasksCompleted"
    User ||--o{ DailyProductionReport : "dailyReportsAsOperator"
    User ||--o{ DailyProductionReport : "dailyReportsAsSupervisor"
    User ||--o{ DailyProductionReport : "dailyReportsConfirmed"
    User ||--o{ DailyProductionReport : "dailyReportsReviewed"
    User ||--o{ ProductionDowntime : "productionDowntimesReported"
    User ||--o{ ProductionQualityControl : "productionQCInspected"
    User ||--o{ ProductionDefect : "productionDefectsReported"
    User ||--o{ ProductionBatchLot : "productionLotsBlocked"
    User ||--o{ ProductionBatchLot : "productionLotsReleased"
    User ||--o{ ProductionEvent : "productionEventsPerformed"
    User ||--o{ ProductionRoutine : "productionRoutinesExecuted"
    User ||--o{ ProductionOrder : "productionOrdersResponsible"
    User ||--o{ ProductionOrder : "productionOrdersCreated"
    User ||--o{ DailyProductionSession : "dailySessionsSubmitted"
    User ||--o{ DailyProductionSession : "dailySessionsApproved"
    User ||--o{ DailyProductionEntry : "dailyEntriesRegistered"
    User ||--o{ UserDiscordAccess : "discordSectorAccess"
    User ||--o{ UserDiscordAccess : "discordAccessGranted"
    User ||--o{ VoicePurchaseLog : "voicePurchaseLogs"
    User ||--o{ VoiceFailureLog : "voiceFailureLogs"
    User ||--o{ RecurringPurchaseOrder : "recurringPurchaseOrders"
    User ||--o{ AgendaTask : "agendaTasksCreated"
    User ||--o{ AgendaTask : "agendaTasksAssigned"
    User ||--o{ AgendaReminder : "agendaReminders"
    User ||--o{ VoiceTaskLog : "voiceTaskLogs"
    User ||--o{ StockReservation : "stockReservationsCreated"
    User ||--o{ MaterialRequest : "materialRequestsSolicitante"
    User ||--o{ MaterialRequest : "materialRequestsDestinatario"
    User ||--o{ MaterialRequest : "materialRequestsAprobadas"
    User ||--o{ Despacho : "despachosDespachador"
    User ||--o{ Despacho : "despachosDestinatario"
    User ||--o{ Despacho : "despachosReceptor"
    User ||--o{ DevolucionMaterial : "devolucionesDevolviente"
    User ||--o{ DevolucionMaterial : "devolucionesRecibidas"
    User ||--o{ UserWarehouseScope : "warehouseScopes"
    User ||--o{ MachineImportJob : "machineImportsCreated"
    User ||--o{ ServiceContract : "createdServiceContracts"
    User ||--o{ ChatSession : "chatSessions"
    User ||--o{ SaleRMA : "rmasSolicitadas"
    User ||--o{ SaleRMA : "rmasAprobadas"
    User ||--o{ SaleRMA : "rmasProcesadas"
    User ||--o{ SaleRMAHistory : "rmaHistoryEvents"
    User ||--o{ SalesGoal : "goalsAsignadas"
    User ||--o{ SalesGoal : "goalsCreadas"
    User ||--o{ SalesPerformanceDashboard : "performanceDashboards"
```
