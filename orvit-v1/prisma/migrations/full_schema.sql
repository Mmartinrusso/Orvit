warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "KilometrajeLogTipo" AS ENUM ('MANUAL', 'MANTENIMIENTO', 'COMBUSTIBLE', 'VIAJE', 'INSPECCION');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'EXTRACTING', 'MERGING', 'DRAFT_READY', 'CONFIRMED', 'COMPLETED', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductStockMovementType" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "AccountMovementType" AS ENUM ('FACTURA', 'NC', 'ND', 'PAGO', 'ANTICIPO', 'RETENCION', 'AJUSTE');

-- CreateEnum
CREATE TYPE "LoadStatus" AS ENUM ('DRAFT', 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'ADMIN_ENTERPRISE', 'SUPERADMIN', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'OUT_OF_SERVICE', 'DECOMMISSIONED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('PRODUCTION', 'MAINTENANCE', 'UTILITY', 'PACKAGING', 'TRANSPORTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY', 'FAILURE');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'DAMAGED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('TOOL', 'SUPPLY', 'SPARE_PART', 'HAND_TOOL', 'CONSUMABLE', 'MATERIAL');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'LOAN', 'RETURN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('BORROWED', 'RETURNED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'PICKED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CONSUMED', 'EXPIRED', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'APPROVE', 'REJECT', 'CLOSE', 'REOPEN', 'RESERVE_STOCK', 'CONSUME_STOCK', 'LOCK_LOTO', 'UNLOCK_LOTO', 'APPROVE_PTW', 'CLOSE_PTW', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "PTWType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'HEIGHT_WORK', 'ELECTRICAL', 'EXCAVATION', 'CHEMICAL', 'RADIATION', 'PRESSURE_SYSTEMS', 'OTHER');

-- CreateEnum
CREATE TYPE "PTWStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LOTOStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('work_order_assigned', 'work_order_overdue', 'work_order_due_soon', 'stock_low', 'stock_out', 'maintenance_due', 'task_assigned', 'task_overdue', 'system_alert', 'task_updated', 'task_deleted', 'task_completed', 'task_due_soon', 'task_auto_reset', 'task_commented', 'reminder_overdue', 'reminder_due_today', 'reminder_due_soon', 'tool_request_new', 'tool_request_approved', 'tool_request_rejected', 'SLA_WARNING', 'SLA_BREACH', 'UNASSIGNED_FAILURE', 'RECURRENCE_ALERT', 'DOWNTIME_START', 'DOWNTIME_END', 'PRIORITY_ESCALATED', 'routine_photo_timer');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MANUAL', 'BLUEPRINT', 'PHOTO', 'DOCUMENT', 'PDF', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "HistoryEventType" AS ENUM ('MAINTENANCE', 'REPAIR', 'INSPECTION', 'MODIFICATION', 'INCIDENT', 'CREATION', 'UPDATE', 'DELETION');

-- CreateEnum
CREATE TYPE "WorkStationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MeasureKind" AS ENUM ('UNIT', 'LENGTH', 'AREA', 'VOLUME');

-- CreateEnum
CREATE TYPE "CostMethod" AS ENUM ('BATCH', 'VOLUMETRIC', 'PER_UNIT_BOM', 'REAL', 'STANDARD');

-- CreateEnum
CREATE TYPE "ProductCostType" AS ENUM ('PRODUCTION', 'PURCHASE', 'MANUAL');

-- CreateEnum
CREATE TYPE "IndirectCategory" AS ENUM ('IMP_SERV', 'SOCIAL', 'VEHICLES', 'MKT', 'OTHER', 'UTILITIES');

-- CreateEnum
CREATE TYPE "RecipeBase" AS ENUM ('PER_BATCH', 'PER_M3');

-- CreateEnum
CREATE TYPE "MethodUnitKind" AS ENUM ('BATCH', 'INTERMEDIATE', 'FINAL');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UnidadMovilEstado" AS ENUM ('ACTIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO', 'DESHABILITADO');

-- CreateEnum
CREATE TYPE "TaxControlStatus" AS ENUM ('RECIBIDO', 'PAGADO', 'PENDIENTE', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TruckType" AS ENUM ('CHASIS', 'EQUIPO', 'SEMI');

-- CreateEnum
CREATE TYPE "ExecutionWindow" AS ENUM ('BEFORE_START', 'MID_SHIFT', 'END_SHIFT', 'ANY_TIME', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "TimeUnit" AS ENUM ('HOURS', 'DAYS', 'CYCLES', 'KILOMETERS', 'SHIFTS', 'UNITS_PRODUCED');

-- CreateEnum
CREATE TYPE "SolutionOutcome" AS ENUM ('FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ');

-- CreateEnum
CREATE TYPE "FixType" AS ENUM ('PARCHE', 'DEFINITIVA');

-- CreateEnum
CREATE TYPE "FailureOccurrenceStatus" AS ENUM ('REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED', 'RESOLVED_IMMEDIATE');

-- CreateEnum
CREATE TYPE "WorkOrderOrigin" AS ENUM ('FAILURE', 'REQUEST', 'MANUAL', 'PREVENTIVE', 'PREDICTIVE');

-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QAStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED_TO_PRODUCTION');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('OPTIONAL', 'BASIC', 'STANDARD', 'COMPLETE');

-- CreateEnum
CREATE TYPE "DowntimeCategory" AS ENUM ('UNPLANNED', 'PLANNED', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('QUICK_CLOSE', 'WORK_ORDER', 'SOLUTION');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRADA_RECEPCION', 'SALIDA_DEVOLUCION', 'TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SALIDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'CONSUMO_PRODUCCION', 'RESERVA', 'LIBERACION_RESERVA', 'DESPACHO', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('BORRADOR', 'SOLICITADO', 'EN_TRANSITO', 'RECIBIDO_PARCIAL', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('INVENTARIO_FISICO', 'ROTURA', 'VENCIMIENTO', 'MERMA', 'CORRECCION', 'DEVOLUCION_INTERNA', 'OTRO');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'APROBADO_PARCIAL');

-- CreateEnum
CREATE TYPE "GRNIStatus" AS ENUM ('PENDIENTE', 'FACTURADO', 'REVERSADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "QuickPurchaseReason" AS ENUM ('EMERGENCIA_PRODUCCION', 'REPOSICION_URGENTE', 'PROVEEDOR_UNICO', 'COMPRA_MENOR', 'OPORTUNIDAD_PRECIO', 'OTRO');

-- CreateEnum
CREATE TYPE "RegularizationStatus" AS ENUM ('REG_PENDING', 'REG_OK', 'REG_NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "FacturaMatchStatus" AS ENUM ('MATCH_PENDING', 'MATCH_OK', 'MATCH_WARNING', 'MATCH_BLOCKED');

-- CreateEnum
CREATE TYPE "PayApprovalStatus" AS ENUM ('PAY_PENDING', 'PAY_APPROVED', 'PAY_REJECTED', 'PAY_BLOCKED_BY_MATCH');

-- CreateEnum
CREATE TYPE "LineMatchStatus" AS ENUM ('LINE_OK', 'LINE_WARNING', 'LINE_BLOCKED', 'LINE_MISSING_RECEIPT', 'LINE_MISSING_INVOICE', 'LINE_EXTRA');

-- CreateEnum
CREATE TYPE "CreditNoteRequestStatus" AS ENUM ('SNCA_NUEVA', 'SNCA_ENVIADA', 'SNCA_EN_REVISION', 'SNCA_APROBADA', 'SNCA_PARCIAL', 'SNCA_RECHAZADA', 'SNCA_NCA_RECIBIDA', 'SNCA_APLICADA', 'SNCA_CERRADA', 'SNCA_CANCELADA');

-- CreateEnum
CREATE TYPE "CreditNoteRequestType" AS ENUM ('SNCA_FALTANTE', 'SNCA_DEVOLUCION', 'SNCA_PRECIO', 'SNCA_DESCUENTO', 'SNCA_CALIDAD', 'SNCA_OTRO');

-- CreateEnum
CREATE TYPE "CreditNoteType" AS ENUM ('NCA_FALTANTE', 'NCA_DEVOLUCION', 'NCA_PRECIO', 'NCA_DESCUENTO', 'NCA_CALIDAD', 'NCA_OTRO', 'NC_FALTANTE', 'NC_DEVOLUCION', 'NC_PRECIO', 'NC_DESCUENTO', 'NC_CALIDAD', 'NC_OTRO');

-- CreateEnum
CREATE TYPE "CreditDebitNoteType" AS ENUM ('NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "CreditDebitNoteStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'APLICADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDIENTE', 'MATCH_OK', 'DISCREPANCIA', 'RESUELTO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "MatchExceptionType" AS ENUM ('CANTIDAD_DIFERENTE', 'PRECIO_DIFERENTE', 'ITEM_FALTANTE', 'ITEM_EXTRA', 'IMPUESTO_DIFERENTE', 'TOTAL_DIFERENTE', 'SIN_OC', 'SIN_RECEPCION', 'DUPLICADO');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('MONTO', 'CATEGORIA', 'PROVEEDOR', 'EMERGENCIA', 'DESVIACION_MATCH');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'ESCALADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APROBADA', 'RECHAZADA', 'APROBADA_CON_CONDICIONES');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVO', 'EN_PAUSA', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('BORRADOR', 'SOLICITADA', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CONVERTIDA', 'PAGADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('BORRADOR', 'SOLICITADA', 'APROBADA_PROVEEDOR', 'ENVIADA', 'RECIBIDA_PROVEEDOR', 'EN_EVALUACION', 'RESUELTA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('DEFECTO', 'EXCESO', 'ERROR_PEDIDO', 'GARANTIA', 'OTRO');

-- CreateEnum
CREATE TYPE "ReturnItemStatus" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ReplenishmentUrgency" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'IGNORADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'EN_COTIZACION', 'COTIZADA', 'EN_APROBACION', 'APROBADA', 'EN_PROCESO', 'COMPLETADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('BORRADOR', 'RECIBIDA', 'EN_REVISION', 'SELECCIONADA', 'CONVERTIDA_OC', 'RECHAZADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "PurchaseCommentType" AS ENUM ('COMENTARIO', 'ACTUALIZACION', 'PREGUNTA', 'RESPUESTA', 'SISTEMA');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('T1', 'T2', 'T3');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'ENVIADA', 'EN_NEGOCIACION', 'ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('COTIZACION', 'NOTA_PEDIDO');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'CONFIRMADA', 'EN_PREPARACION', 'PARCIALMENTE_ENTREGADA', 'ENTREGADA', 'FACTURADA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'LISTA_PARA_DESPACHO', 'EN_TRANSITO', 'RETIRADA', 'ENTREGADA', 'ENTREGA_FALLIDA', 'PARCIAL', 'CANCELADA');

-- CreateEnum
CREATE TYPE "RemitoStatus" AS ENUM ('BORRADOR', 'PREPARADO', 'EMITIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "SalesInvoiceType" AS ENUM ('A', 'B', 'C', 'M', 'E');

-- CreateEnum
CREATE TYPE "SalesInvoiceStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'ENVIADA', 'PARCIALMENTE_COBRADA', 'COBRADA', 'VENCIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "AFIPStatus" AS ENUM ('PENDIENTE', 'PROCESANDO', 'APROBADO', 'RECHAZADO', 'ERROR');

-- CreateEnum
CREATE TYPE "SalesCreditDebitType" AS ENUM ('NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "ClientPaymentStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('CARTERA', 'DEPOSITADO', 'COBRADO', 'RECHAZADO', 'ENDOSADO');

-- CreateEnum
CREATE TYPE "ClientMovementType" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'PAGO', 'ANTICIPO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "SalesApprovalType" AS ENUM ('DESCUENTO', 'CREDITO', 'PRECIO_ESPECIAL', 'MONTO_ALTO', 'PLAZO_PAGO');

-- CreateEnum
CREATE TYPE "SalesApprovalStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ESCALADA');

-- CreateEnum
CREATE TYPE "ModuleCategory" AS ENUM ('VENTAS', 'COMPRAS', 'MANTENIMIENTO', 'COSTOS', 'ADMINISTRACION', 'GENERAL');

-- CreateEnum
CREATE TYPE "SaleConditionType" AS ENUM ('FORMAL', 'INFORMAL', 'MIXTO');

-- CreateEnum
CREATE TYPE "SettlementPeriod" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "AcopioStatus" AS ENUM ('ACTIVO', 'PARCIAL', 'RETIRADO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PortalOrderStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'CONFIRMADO', 'RECHAZADO', 'CONVERTIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PortalActivityAction" AS ENUM ('LOGIN', 'LOGOUT', 'VIEW_PRICES', 'VIEW_QUOTE', 'ACCEPT_QUOTE', 'REJECT_QUOTE', 'CREATE_ORDER', 'CANCEL_ORDER', 'VIEW_DOCUMENT', 'DOWNLOAD_PDF', 'CHANGE_PASSWORD');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INGRESO_COBRO', 'EGRESO_PAGO', 'INGRESO_DEPOSITO', 'EGRESO_RETIRO', 'INGRESO_CAMBIO', 'EGRESO_CAMBIO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA_IN', 'TRANSFERENCIA_OUT');

-- CreateEnum
CREATE TYPE "BankMovementType" AS ENUM ('TRANSFERENCIA_IN', 'TRANSFERENCIA_OUT', 'DEPOSITO_EFECTIVO', 'DEPOSITO_CHEQUE', 'DEBITO_CHEQUE', 'DEBITO_AUTOMATICO', 'CREDITO_AUTOMATICO', 'COMISION', 'IMPUESTO', 'INTERES', 'AJUSTE');

-- CreateEnum
CREATE TYPE "ChequeOrigen" AS ENUM ('RECIBIDO', 'EMITIDO');

-- CreateEnum
CREATE TYPE "ChequeTipo" AS ENUM ('FISICO', 'ECHEQ');

-- CreateEnum
CREATE TYPE "ChequeEstado" AS ENUM ('CARTERA', 'DEPOSITADO', 'COBRADO', 'RECHAZADO', 'ENDOSADO', 'ANULADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TreasuryTransferStatus" AS ENUM ('PENDIENTE', 'COMPLETADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "billing_cycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "token_transaction_type" AS ENUM ('MONTHLY_CREDIT', 'PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('WORK_ORDER_CREATED', 'WORK_ORDER_STATUS_CHANGED', 'WORK_ORDER_ASSIGNED', 'FAILURE_REPORTED', 'FAILURE_RECURRENCE', 'STOCK_LOW', 'PREVENTIVE_DUE', 'MACHINE_STATUS_CHANGED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'SIMULATED');

-- CreateEnum
CREATE TYPE "IdeaCategory" AS ENUM ('SOLUCION_FALLA', 'MEJORA_PROCESO', 'MEJORA_EQUIPO', 'SEGURIDAD', 'AHORRO_COSTOS', 'CALIDAD', 'OTRO');

-- CreateEnum
CREATE TYPE "IdeaPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS', 'IMPLEMENTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING_RENEWAL', 'REVOKED');

-- CreateEnum
CREATE TYPE "MOCChangeType" AS ENUM ('EQUIPMENT', 'PROCESS', 'PROCEDURE', 'MATERIAL', 'PERSONNEL');

-- CreateEnum
CREATE TYPE "MOCStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "AgendaTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('WEB', 'DISCORD_TEXT', 'DISCORD_VOICE', 'API');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('DISCORD', 'EMAIL', 'WEB_PUSH', 'SSE');

-- CreateEnum
CREATE TYPE "VoiceLogStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVA', 'CONSUMIDA_PARCIAL', 'CONSUMIDA', 'LIBERADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "StockReservationType" AS ENUM ('SOLICITUD_MATERIAL', 'ORDEN_PRODUCCION', 'ORDEN_TRABAJO', 'MANUAL');

-- CreateEnum
CREATE TYPE "MaterialRequestType" AS ENUM ('OT_MANTENIMIENTO', 'OP_PRODUCCION', 'PROYECTO', 'INTERNO');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'PARCIALMENTE_DESPACHADA', 'DESPACHADA', 'CANCELADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('TOOL', 'SUPPLIER_ITEM');

-- CreateEnum
CREATE TYPE "DespachoType" AS ENUM ('ENTREGA_OT', 'ENTREGA_OP', 'ENTREGA_PERSONA', 'CONSUMO_INTERNO');

-- CreateEnum
CREATE TYPE "DespachoStatus" AS ENUM ('BORRADOR', 'EN_PREPARACION', 'LISTO_DESPACHO', 'DESPACHADO', 'RECIBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "DevolucionType" AS ENUM ('SOBRANTE_OT', 'SOBRANTE_OP', 'NO_UTILIZADO', 'DEFECTUOSO');

-- CreateEnum
CREATE TYPE "DevolucionStatus" AS ENUM ('BORRADOR', 'PENDIENTE_REVISION', 'ACEPTADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "StockConsumptionMode" AS ENUM ('ON_RELEASE', 'ON_REPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ServiceContractType" AS ENUM ('SEGURO_MAQUINARIA', 'SEGURO_VEHICULO', 'SEGURO_INSTALACIONES', 'SEGURO_RESPONSABILIDAD', 'SERVICIO_TECNICO', 'MANTENIMIENTO_PREVENTIVO', 'CALIBRACION', 'CERTIFICACION', 'ALQUILER_EQUIPO', 'LICENCIA_SOFTWARE', 'CONSULTORIA', 'VIGILANCIA', 'LIMPIEZA', 'TRANSPORTE', 'OTRO');

-- CreateEnum
CREATE TYPE "ServiceContractStatus" AS ENUM ('BORRADOR', 'ACTIVO', 'POR_VENCER', 'VENCIDO', 'SUSPENDIDO', 'CANCELADO', 'RENOVADO');

-- CreateEnum
CREATE TYPE "ServicePaymentFrequency" AS ENUM ('UNICO', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'CUATRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TreasuryMovementType" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA_INTERNA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "PaymentMedium" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE_TERCERO', 'CHEQUE_PROPIO', 'ECHEQ', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'DEPOSITO', 'COMISION', 'INTERES', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TreasuryAccountType" AS ENUM ('CASH', 'BANK', 'CHECK_PORTFOLIO');

-- CreateEnum
CREATE TYPE "TreasuryMovementStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'REVERSADO');

-- CreateEnum
CREATE TYPE "LoadOrderStatus" AS ENUM ('PENDIENTE', 'CARGANDO', 'CARGADA', 'DESPACHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "CashClosingStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'CON_DIFERENCIA_APROBADA', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CON_DIFERENCIAS', 'CERRADA');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('EXACT', 'FUZZY', 'REFERENCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('RESERVADO', 'EN_ESPERA', 'EN_CARGA', 'COMPLETADO', 'CANCELADO', 'NO_SHOW', 'CANCELADO_TARDE');

-- CreateEnum
CREATE TYPE "FiscalStatus" AS ENUM ('DRAFT', 'PENDING_AFIP', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELLED', 'CONTINGENCY');

-- CreateEnum
CREATE TYPE "AfipAmbiente" AS ENUM ('TESTING', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "SalesCreditDebitReason" AS ENUM ('DEVOLUCION', 'DIFERENCIA_CARGA', 'DIFERENCIA_PRECIO', 'BONIFICACION', 'AJUSTE_FINANCIERO', 'REFACTURACION', 'FLETE', 'OTRO');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('DESCUENTO_PORCENTAJE', 'DESCUENTO_MONTO', 'RECARGO_PORCENTAJE', 'RECARGO_MONTO', 'PRECIO_FIJO', 'BONIFICACION', 'FLETE', 'REDONDEO');

-- CreateEnum
CREATE TYPE "PricingAction" AS ENUM ('PORCENTAJE', 'MONTO_FIJO', 'PRECIO_FINAL');

-- CreateEnum
CREATE TYPE "PricingBase" AS ENUM ('PRECIO_LISTA', 'PRECIO_COSTO', 'SUBTOTAL');

-- CreateEnum
CREATE TYPE "CondicionIva" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'NO_RESPONSABLE', 'CONSUMIDOR_FINAL');

-- CreateEnum
CREATE TYPE "CollectionActionType" AS ENUM ('LLAMADA', 'EMAIL', 'CARTA', 'VISITA', 'WHATSAPP', 'PROMESA_PAGO', 'ACUERDO_PAGO', 'DERIVACION_LEGAL');

-- CreateEnum
CREATE TYPE "CollectionActionStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'ESCALADA');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('FACTURACION_INCORRECTA', 'MERCADERIA_DANADA', 'MERCADERIA_FALTANTE', 'PRECIO_INCORRECTO', 'FLETE_INCORRECTO', 'DUPLICADO', 'NO_RECIBIDO', 'OTRO');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('ABIERTA', 'EN_INVESTIGACION', 'PENDIENTE_CLIENTE', 'PENDIENTE_INTERNO', 'RESUELTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('FAVOR_CLIENTE', 'FAVOR_EMPRESA', 'PARCIAL', 'ACUERDO');

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "logo" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "logoDark" TEXT,
    "logoLight" TEXT,
    "subscriptionId" TEXT,
    "primaryAdminId" INTEGER,
    "templateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "discordBotToken" TEXT,
    "discordGuildId" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "batchLabel" TEXT NOT NULL DEFAULT 'batea',
    "intermediateLabel" TEXT NOT NULL DEFAULT 'placa',
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "machineOrder" TEXT,
    "toleranciaFaltante" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
    "toleranciaPrecio" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "requireDespachoSignature" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "avatar" TEXT,
    "logo" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "discordUserId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sectorId" INTEGER,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnCompany" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" INTEGER,

    CONSTRAINT "UserOnCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDiscordAccess" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sectorId" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" INTEGER,
    "canViewFallas" BOOLEAN NOT NULL DEFAULT true,
    "canViewPreventivos" BOOLEAN NOT NULL DEFAULT true,
    "canViewOT" BOOLEAN NOT NULL DEFAULT true,
    "canViewGeneral" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserDiscordAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "logo" TEXT,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "areaId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "discordFallasWebhook" TEXT,
    "discordPreventivosWebhook" TEXT,
    "discordOrdenesTrabajoWebhook" TEXT,
    "discordResumenDiaWebhook" TEXT,
    "discordCategoryId" TEXT,
    "discordGeneralChannelId" TEXT,
    "discordFallasChannelId" TEXT,
    "discordPreventivosChannelId" TEXT,
    "discordOTChannelId" TEXT,
    "enabledForProduction" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantZone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "photo" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" INTEGER,
    "sectorId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadMovil" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "año" INTEGER NOT NULL,
    "patente" TEXT NOT NULL,
    "numeroChasis" TEXT,
    "numeroMotor" TEXT,
    "kilometraje" INTEGER NOT NULL DEFAULT 0,
    "estado" "UnidadMovilEstado" NOT NULL DEFAULT 'ACTIVO',
    "sectorId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "fechaAdquisicion" TIMESTAMP(3),
    "valorAdquisicion" DOUBLE PRECISION,
    "proveedor" TEXT,
    "garantiaHasta" TIMESTAMP(3),
    "ultimoMantenimiento" TIMESTAMP(3),
    "proximoMantenimiento" TIMESTAMP(3),
    "combustible" TEXT,
    "capacidadCombustible" INTEGER,
    "consumoPromedio" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadMovil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KilometrajeLog" (
    "id" SERIAL NOT NULL,
    "unidadMovilId" INTEGER NOT NULL,
    "kilometraje" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "KilometrajeLogTipo" NOT NULL DEFAULT 'MANUAL',
    "registradoPorId" INTEGER,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KilometrajeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "aliases" JSONB,
    "type" "MachineType" NOT NULL DEFAULT 'OTHER',
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "description" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquisitionDate" TIMESTAMP(3),
    "slug" TEXT,
    "photo" TEXT,
    "logo" TEXT,
    "areaId" INTEGER,
    "sectorId" INTEGER,
    "plantZoneId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assetCode" TEXT,
    "sapCode" TEXT,
    "productionLine" TEXT,
    "position" TEXT,
    "manufacturingYear" INTEGER,
    "installationDate" TIMESTAMP(3),
    "technicalNotes" TEXT,
    "power" TEXT,
    "voltage" TEXT,
    "weight" TEXT,
    "dimensions" TEXT,
    "criticalityScore" INTEGER,
    "criticalityProduction" INTEGER,
    "criticalitySafety" INTEGER,
    "criticalityQuality" INTEGER,
    "criticalityCost" INTEGER,
    "healthScore" INTEGER,
    "healthScoreUpdatedAt" TIMESTAMP(3),
    "ownerId" INTEGER,
    "plannerId" INTEGER,
    "technicianId" INTEGER,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_import_jobs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADING',
    "errorMessage" TEXT,
    "stage" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "originalFileName" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "extractedData" JSONB,
    "confidence" DOUBLE PRECISION,
    "reviewedData" JSONB,
    "translateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT,
    "machineId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "machine_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_import_files" (
    "id" SERIAL NOT NULL,
    "importJobId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileTypes" JSONB NOT NULL DEFAULT '[]',
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "pageCount" INTEGER,
    "extractedTextS3Key" TEXT,
    "needsVision" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_import_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_import_file_analyses" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "importJobId" INTEGER NOT NULL,
    "extractedJson" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT,
    "tokensUsed" INTEGER,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_import_file_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "itemNumber" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "type" TEXT,
    "description" TEXT,
    "parentId" INTEGER,
    "machineId" INTEGER NOT NULL,
    "technicalInfo" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "system" TEXT,
    "model3dUrl" TEXT,
    "criticality" INTEGER,
    "isSafetyCritical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "itemType" "ItemType" NOT NULL DEFAULT 'TOOL',
    "category" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER NOT NULL DEFAULT 100,
    "reorderPoint" INTEGER,
    "location" TEXT,
    "status" "ToolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "cost" DOUBLE PRECISION,
    "supplier" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "lastMaintenanceDate" TIMESTAMP(3),
    "nextMaintenanceDate" TIMESTAMP(3),
    "notes" TEXT,
    "logo" TEXT,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "alternativeIds" JSONB,
    "requiresCalibration" BOOLEAN NOT NULL DEFAULT false,
    "calibrationFrequencyDays" INTEGER,
    "calibrationStatus" TEXT,
    "lastCalibrationAt" TIMESTAMP(3),
    "nextCalibrationAt" TIMESTAMP(3),
    "unit" TEXT DEFAULT 'unidad',
    "model3dUrl" TEXT,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolMovement" (
    "id" SERIAL NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "toolId" INTEGER NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolLoan" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "userId" INTEGER,
    "workerId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'BORROWED',
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ToolLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_part_reservations" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedAt" TIMESTAMP(3),
    "pickedById" INTEGER,
    "returnedAt" TIMESTAMP(3),
    "returnedById" INTEGER,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "spare_part_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolMachine" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentTool" (
    "id" SERIAL NOT NULL,
    "componentId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT DEFAULT 'unidad',
    "minStockLevel" INTEGER,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isConsumable" BOOLEAN NOT NULL DEFAULT false,
    "alternativeItemIds" JSONB,
    "kitId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComponentTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_kits" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "componentId" INTEGER,
    "checklistId" INTEGER,
    "estimatedTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervention_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorTool" (
    "id" SERIAL NOT NULL,
    "sectorId" INTEGER NOT NULL,
    "toolId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectorTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item_suppliers" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierCode" TEXT,
    "leadTimeDays" INTEGER,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "lastPurchaseAt" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_item_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "purchaseOrderId" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "unitCost" DOUBLE PRECISION,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_installations" (
    "id" SERIAL NOT NULL,
    "lotId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "componentId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedById" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "removedAt" TIMESTAMP(3),
    "removedById" INTEGER,
    "removalReason" TEXT,
    "removalWorkOrderId" INTEGER,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "type" "MaintenanceType" NOT NULL DEFAULT 'CORRECTIVE',
    "machineId" INTEGER,
    "componentId" INTEGER,
    "workStationId" INTEGER,
    "assignedToId" INTEGER,
    "assignedWorkerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "startedDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rootCause" TEXT,
    "correctiveActions" TEXT,
    "preventiveActions" TEXT,
    "spareParts" JSONB,
    "failureDescription" TEXT,
    "solution" TEXT,
    "executionWindow" "ExecutionWindow" DEFAULT 'ANY_TIME',
    "timeUnit" "TimeUnit" DEFAULT 'HOURS',
    "timeValue" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completionRate" DOUBLE PRECISION,
    "unidadMovilId" INTEGER,
    "origin" "WorkOrderOrigin" DEFAULT 'MANUAL',
    "waitingReason" TEXT,
    "waitingDescription" TEXT,
    "waitingETA" TIMESTAMP(3),
    "waitingSince" TIMESTAMP(3),
    "closingMode" TEXT,
    "diagnosisNotes" TEXT,
    "workPerformedNotes" TEXT,
    "resultNotes" TEXT,
    "isSafetyRelated" BOOLEAN NOT NULL DEFAULT false,
    "assetCriticality" "AssetCriticality",
    "requiresReturnToProduction" BOOLEAN NOT NULL DEFAULT false,
    "returnToProductionConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "fromTemplate" INTEGER,
    "slaDueAt" TIMESTAMP(3),
    "slaStatus" TEXT,
    "slaBreachedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalatedToId" INTEGER,
    "executorIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "assignedAt" TIMESTAMP(3),
    "plannedAt" TIMESTAMP(3),
    "requiresPTW" BOOLEAN NOT NULL DEFAULT false,
    "ptwTypes" JSONB DEFAULT '[]',
    "requiresLOTO" BOOLEAN NOT NULL DEFAULT false,
    "ptwBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lotoBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failures" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "machine_id" INTEGER NOT NULL,
    "companyId" INTEGER,
    "failure_type" VARCHAR(50) DEFAULT 'MECANICA',
    "priority" VARCHAR(20) DEFAULT 'MEDIUM',
    "estimated_hours" DECIMAL(5,2) DEFAULT 0,
    "reported_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(50) DEFAULT 'REPORTED',
    "affected_components" JSONB,
    "attachments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_occurrences" (
    "id" SERIAL NOT NULL,
    "failureId" INTEGER,
    "failureTypeId" INTEGER,
    "machineId" INTEGER,
    "additionalMachineIds" JSONB,
    "subcomponentId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "reportedBy" INTEGER NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "title" TEXT,
    "description" TEXT,
    "failureCategory" VARCHAR(50) DEFAULT 'MECANICA',
    "priority" VARCHAR(20) DEFAULT 'MEDIUM',
    "affectedComponents" JSONB,
    "status" VARCHAR(20) DEFAULT 'OPEN',
    "notes" TEXT,
    "isIntermittent" BOOLEAN NOT NULL DEFAULT false,
    "isObservation" BOOLEAN NOT NULL DEFAULT false,
    "causedDowntime" BOOLEAN NOT NULL DEFAULT false,
    "linkedToOccurrenceId" INTEGER,
    "linkedAt" TIMESTAMP(3),
    "linkedById" INTEGER,
    "linkedReason" VARCHAR(255),
    "isLinkedDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "reopenedFrom" INTEGER,
    "reopenReason" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" INTEGER,
    "resolvedImmediately" BOOLEAN NOT NULL DEFAULT false,
    "symptoms" JSONB,
    "photos" JSONB,

    CONSTRAINT "failure_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_solutions" (
    "id" SERIAL NOT NULL,
    "occurrenceId" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "appliedById" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualHours" DECIMAL(5,2),
    "timeUnit" VARCHAR(20) NOT NULL DEFAULT 'hours',
    "toolsUsed" JSONB,
    "sparePartsUsed" JSONB,
    "rootCause" TEXT,
    "preventiveActions" TEXT,
    "attachments" JSONB,
    "effectiveness" INTEGER,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution_applications" (
    "id" SERIAL NOT NULL,
    "failureSolutionId" INTEGER NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "occurrenceId" INTEGER,
    "appliedById" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualHours" DECIMAL(5,2),
    "timeUnit" VARCHAR(20) NOT NULL DEFAULT 'hours',
    "notes" TEXT,
    "effectiveness" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solution_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderComment" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT DEFAULT 'comment',
    "workOrderId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderAttachment" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" INTEGER,

    CONSTRAINT "WorkOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "assignedToId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "tags" JSONB,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "type" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" INTEGER,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtask" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedTask" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "TaskFrequency" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedToId" INTEGER,
    "assignedWorkerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "department" TEXT,
    "nextExecution" TIMESTAMP(3) NOT NULL,
    "lastExecuted" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "executionTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedTaskInstructive" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "fixedTaskId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedTaskInstructive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedTaskExecution" (
    "id" SERIAL NOT NULL,
    "fixedTaskId" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "actualDuration" INTEGER,
    "completedAt" TIMESTAMP(3),
    "nextScheduled" TIMESTAMP(3),
    "userId" INTEGER,
    "workerId" INTEGER,

    CONSTRAINT "FixedTaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "fileName" TEXT,
    "type" "DocumentType",
    "url" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "toolId" INTEGER,
    "companyId" INTEGER,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityId" TEXT,
    "entityType" TEXT,
    "originalName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "folder" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEvent" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "HistoryEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "userId" INTEGER,
    "companyId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolRequest" (
    "id" SERIAL NOT NULL,
    "reason" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" INTEGER NOT NULL,
    "approvedBy" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "position" TEXT,
    "notes" TEXT,
    "avatar" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "userId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInteraction" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "outcome" TEXT,
    "nextAction" TEXT,
    "contactId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "isGranted" BOOLEAN NOT NULL,
    "grantedById" INTEGER,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "targetName" TEXT,
    "permissionId" INTEGER,
    "permissionName" TEXT,
    "performedById" INTEGER NOT NULL,
    "performedByName" TEXT NOT NULL,
    "details" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "costCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "minStock" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "blocksPerM2" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "images" JSONB,
    "files" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "volumeUnit" TEXT DEFAULT 'metros_lineales',
    "image" TEXT,
    "costType" "ProductCostType" NOT NULL DEFAULT 'MANUAL',
    "recipeId" TEXT,
    "purchaseInputId" TEXT,
    "weightedAverageCost" DOUBLE PRECISION,
    "lastCostUpdate" TIMESTAMP(3),
    "costCalculationStock" INTEGER DEFAULT 0,
    "salePrice" DOUBLE PRECISION,
    "saleCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "marginMin" DOUBLE PRECISION,
    "marginMax" DOUBLE PRECISION,
    "barcode" TEXT,
    "sku" TEXT,
    "tags" JSONB,
    "trackBatches" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiration" BOOLEAN NOT NULL DEFAULT false,
    "alertStockEmail" BOOLEAN NOT NULL DEFAULT true,
    "alertStockDays" INTEGER,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCostLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "previousCost" DOUBLE PRECISION,
    "newCost" DOUBLE PRECISION NOT NULL,
    "previousStock" INTEGER,
    "newStock" INTEGER,
    "changeSource" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceDocumentType" TEXT,
    "purchaseQuantity" DOUBLE PRECISION,
    "purchaseUnitPrice" DOUBLE PRECISION,
    "calculationMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ProductCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" "ProductStockMovementType" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "stockAnterior" DOUBLE PRECISION NOT NULL,
    "stockPosterior" DOUBLE PRECISION NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceNumber" TEXT,
    "motivo" TEXT,
    "notas" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "status" "WorkStationStatus" NOT NULL DEFAULT 'ACTIVE',
    "sectorId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStationInstructive" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workStationId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "scope" TEXT,
    "contentHtml" TEXT,
    "machineIds" JSONB,
    "componentIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStationInstructive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStationMachine" (
    "id" SERIAL NOT NULL,
    "workStationId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStationMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkStationComponent" (
    "id" SERIAL NOT NULL,
    "workStationId" INTEGER NOT NULL,
    "componentId" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostProduct" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "measureKind" "MeasureKind" NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "costMethod" "CostMethod" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "CostProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "currentPrice" DECIMAL(12,4) NOT NULL,
    "supplier" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,

    CONSTRAINT "InputItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputPriceHistory" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "inputId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEmployee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "payrollTaxes" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,
    "zoneId" TEXT,

    CONSTRAINT "CostEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompHistory" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "grossSalary" DECIMAL(12,2) NOT NULL,
    "payrollTaxes" DECIMAL(12,2) NOT NULL,
    "changePct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeCompHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyIndirect" (
    "id" TEXT NOT NULL,
    "category" "IndirectCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "month" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" TEXT,
    "servicePrice" DECIMAL(12,4),
    "quantity" DECIMAL(12,4),

    CONSTRAINT "MonthlyIndirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndirectItem" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "IndirectCategory" NOT NULL,
    "currentPrice" DECIMAL(12,4),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndirectItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndirectPriceHistory" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "indirectId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndirectPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalAllocation" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "percent" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base" "RecipeBase" NOT NULL DEFAULT 'PER_BATCH',
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "intermediateQuantity" DECIMAL(12,6),
    "intermediateUnitLabel" TEXT,
    "outputQuantity" DECIMAL(12,6),
    "outputUnitLabel" TEXT,
    "baseQty" DECIMAL(12,6),
    "baseUnit" TEXT,
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "quantity" DECIMAL(12,6) NOT NULL,
    "unitLabel" TEXT NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YieldConfig" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "intermediatesPerBatch" DECIMAL(12,4),
    "outputsPerIntermediate" DECIMAL(12,4),
    "scrapA" DECIMAL(5,4),
    "scrapB" DECIMAL(5,4),
    "outputsPerBatch" DECIMAL(12,4),
    "scrapGlobal" DECIMAL(5,4),
    "m3PerBatch" DECIMAL(12,4),
    "usesIntermediate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "YieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerUnitBOM" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "qtyPerOut" DECIMAL(12,4) NOT NULL,
    "unitLabel" TEXT NOT NULL,

    CONSTRAINT "PerUnitBOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumetricParam" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "m3PerOutput" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "VolumetricParam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRun" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recipeId" TEXT NOT NULL,
    "batches" DECIMAL(12,4) NOT NULL,
    "intermediates" DECIMAL(12,4),
    "outputs" DECIMAL(12,4),
    "note" TEXT,

    CONSTRAINT "BatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyProduction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "producedQuantity" DECIMAL(12,4) NOT NULL,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "MonthlyProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCostHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "directPerOutput" DECIMAL(12,4) NOT NULL,
    "indirectPerOutput" DECIMAL(12,4) NOT NULL,
    "employeesPerOutput" DECIMAL(12,4) NOT NULL,
    "totalPerOutput" DECIMAL(12,4) NOT NULL,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "CostMethod" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ProductCostHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostParam" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CostParam_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CompanySettingsCosting" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "currencyBase" TEXT NOT NULL DEFAULT 'ARS',
    "inputPriceSource" TEXT NOT NULL DEFAULT 'PRICE_HISTORY',
    "treatEmployeesAsOverhead" BOOLEAN NOT NULL DEFAULT true,
    "requireProductionForMonth" BOOLEAN NOT NULL DEFAULT true,
    "allowZeroProduction" BOOLEAN NOT NULL DEFAULT false,
    "defaultCostMethod" "CostMethod" NOT NULL DEFAULT 'REAL',
    "autoCreateDO" BOOLEAN NOT NULL DEFAULT true,
    "autoReserveStock" BOOLEAN NOT NULL DEFAULT true,
    "cogsMethod" TEXT NOT NULL DEFAULT 'COST_HISTORY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettingsCosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostVarianceMonthly" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "method" "CostMethod" NOT NULL,
    "materialPriceVar" DECIMAL(12,4) NOT NULL,
    "materialUsageVar" DECIMAL(12,4) NOT NULL,
    "laborRateVar" DECIMAL(12,4),
    "laborEffVar" DECIMAL(12,4),
    "ohSpendingVar" DECIMAL(12,4) NOT NULL,
    "ohVolumeVar" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostVarianceMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactPnLMonthly" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "salesNet" DECIMAL(15,4) NOT NULL,
    "cogs" DECIMAL(15,4) NOT NULL,
    "grossMargin" DECIMAL(15,4) NOT NULL,
    "indirects" DECIMAL(15,4) NOT NULL,
    "employees" DECIMAL(15,4) NOT NULL,
    "operatingMargin" DECIMAL(15,4) NOT NULL,
    "purchasesTotal" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactPnLMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactPurchasesMonthly" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactPurchasesMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactSalesMonthly" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "netAmount" DECIMAL(15,4) NOT NULL,
    "grossAmount" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactSalesMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndirectItemAllocation" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "percent" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndirectItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndirectItemAllocationMonthly" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "percent" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndirectItemAllocationMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodConversion" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "fromKind" "MethodUnitKind" NOT NULL,
    "fromLabel" TEXT NOT NULL,
    "toKind" "MethodUnitKind" NOT NULL,
    "toLabel" TEXT NOT NULL,
    "factor" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodProductYield" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT,
    "productId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodProductYield_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStandardCost" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalUnit" DECIMAL(12,4) NOT NULL,
    "dmUnit" DECIMAL(12,4) NOT NULL,
    "laborUnit" DECIMAL(12,4),
    "ohUnit" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStandardCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMethod" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneAllocation" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "zoneId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "percent" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneAllocationMonthly" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "zoneId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "percent" DECIMAL(5,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneAllocationMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_checklists" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "ChecklistFrequency" NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "estimatedTotalTime" INTEGER DEFAULT 0,
    "items" JSONB,
    "phases" JSONB,
    "instructives" JSONB,

    CONSTRAINT "maintenance_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistExecution" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "executedBy" TEXT NOT NULL,
    "executionTime" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justifications" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "executionDetails" TEXT,

    CONSTRAINT "ChecklistExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_order" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "machineId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "company_id" INTEGER NOT NULL,
    "gremio" VARCHAR(100),
    "convention_code" VARCHAR(50),
    "payment_schedule_type" VARCHAR(50) NOT NULL DEFAULT 'BIWEEKLY_FIXED',
    "payment_rule_json" JSONB,
    "attendance_policy_json" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" VARCHAR(255) NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(255) NOT NULL,
    "cuil" VARCHAR(20),
    "gross_salary" DECIMAL(10,2) NOT NULL,
    "payroll_taxes" DECIMAL(10,2) DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "category_id" INTEGER,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "hire_date" DATE,
    "termination_date" DATE,
    "cost_center_id" INTEGER,
    "union_category_id" INTEGER,
    "work_sector_id" INTEGER,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_history" (
    "id" VARCHAR(255) NOT NULL DEFAULT (gen_random_uuid())::text,
    "company_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "gross_salary" DECIMAL(10,2) NOT NULL,
    "payroll_taxes" DECIMAL(10,2) DEFAULT 0,
    "change_pct" DECIMAL(5,2),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_monthly_salaries" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "month_year" DATE NOT NULL,
    "fecha_imputacion" VARCHAR(7) NOT NULL,
    "gross_salary" DECIMAL(10,2) NOT NULL,
    "payroll_taxes" DECIMAL(10,2) DEFAULT 0,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_monthly_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_history_new" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "old_salary" DECIMAL(10,2) NOT NULL,
    "new_salary" DECIMAL(10,2) NOT NULL,
    "change_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "change_reason" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salary_history_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indirect_cost_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) DEFAULT '#3B82F6',
    "icon" VARCHAR(100) DEFAULT 'Building2',
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indirect_cost_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indirect_costs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "fecha_imputacion" VARCHAR(7) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "due_date" DATE,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indirect_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indirect_cost_history" (
    "id" SERIAL NOT NULL,
    "cost_id" INTEGER NOT NULL,
    "old_amount" DECIMAL(15,2),
    "new_amount" DECIMAL(15,2) NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indirect_cost_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indirect_cost_base" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "category_id" INTEGER NOT NULL,
    "description" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indirect_cost_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indirect_cost_change_history" (
    "id" SERIAL NOT NULL,
    "cost_base_id" INTEGER NOT NULL,
    "monthly_record_id" INTEGER,
    "change_type" VARCHAR NOT NULL,
    "old_amount" DECIMAL,
    "new_amount" DECIMAL,
    "old_status" VARCHAR,
    "new_status" VARCHAR,
    "fecha_imputacion" VARCHAR,
    "reason" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indirect_cost_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indirect_cost_monthly_records" (
    "id" SERIAL NOT NULL,
    "cost_base_id" INTEGER NOT NULL,
    "fecha_imputacion" VARCHAR NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT 'pending',
    "due_date" DATE,
    "notes" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indirect_cost_monthly_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_subcategories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sku" VARCHAR(100),
    "category_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) DEFAULT 0,
    "unit_cost" DECIMAL(15,2) DEFAULT 0,
    "stock_quantity" INTEGER DEFAULT 0,
    "min_stock_level" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "subcategory_id" INTEGER,
    "location" VARCHAR(255),
    "weight" DECIMAL(15,3) DEFAULT 0,
    "volume" DECIMAL(15,3) DEFAULT 0,
    "volume_unit" VARCHAR(50) DEFAULT 'metros_lineales',
    "image" VARCHAR(500),
    "images" JSONB,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "city" VARCHAR(255),
    "postal_code" VARCHAR(50),
    "province" VARCHAR(255),
    "condiciones_pago" VARCHAR(255),
    "prontoPagoDias" INTEGER,
    "prontoPagoPorcentaje" DECIMAL(5,2),
    "prontoPagoAplicaSobre" VARCHAR(20),
    "ingresos_brutos" VARCHAR(100),
    "condicion_iva" VARCHAR(100),
    "cbu" TEXT,
    "alias_cbu" TEXT,
    "banco" TEXT,
    "tipo_cuenta" TEXT,
    "numero_cuenta" TEXT,
    "contact_phone" VARCHAR(50),
    "contact_email" VARCHAR(255),
    "notes" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedByUserId" INTEGER,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "cuit" VARCHAR(20),
    "razon_social" VARCHAR(255),
    "codigo" VARCHAR(50),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_change_requests" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "datosAnteriores" JSONB NOT NULL,
    "datosNuevos" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "solicitadoPor" INTEGER NOT NULL,
    "solicitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "rechazadoPor" INTEGER,
    "rechazadoAt" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "segundoAprobadorId" INTEGER,
    "segundaAprobacionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "code" VARCHAR(20),
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "parentId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "unit_measure" VARCHAR(50) NOT NULL DEFAULT 'TN',
    "supplier_id" INTEGER,
    "company_id" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAccountMovement" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" "AccountMovementType" NOT NULL,
    "facturaId" INTEGER,
    "notaCreditoDebitoId" INTEGER,
    "pagoId" INTEGER,
    "fecha" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "debe" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoMovimiento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "comprobante" VARCHAR(100),
    "descripcion" TEXT,
    "metodoPago" VARCHAR(50),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_monthly_prices" (
    "id" SERIAL NOT NULL,
    "supply_id" INTEGER NOT NULL,
    "month_year" DATE NOT NULL,
    "fecha_imputacion" VARCHAR(7) NOT NULL,
    "price_per_unit" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "freight_cost" DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT "supply_monthly_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_price_history" (
    "id" SERIAL NOT NULL,
    "supply_id" INTEGER NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "old_price" DECIMAL(15,2),
    "new_price" DECIMAL(15,2),
    "month_year" DATE NOT NULL,
    "notes" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "old_freight_cost" DECIMAL(15,2) DEFAULT 0,
    "new_freight_cost" DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT "supply_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "product_id" TEXT,
    "base_type" VARCHAR(20) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "output_quantity" DECIMAL(10,5),
    "output_unit_label" VARCHAR(100) DEFAULT 'unidades',
    "intermediate_quantity" DECIMAL(10,5),
    "intermediate_unit_label" VARCHAR(100) DEFAULT 'placas',
    "is_active" BOOLEAN DEFAULT true,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "units_per_item" DECIMAL(10,4),
    "subcategory_id" INTEGER,
    "metros_utiles" DECIMAL(10,2),
    "cantidad_pastones" INTEGER,
    "notes" TEXT,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_cost_tests" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "test_name" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "test_data" JSONB NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "cost_per_unit" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "company_id" INTEGER NOT NULL,

    CONSTRAINT "recipe_cost_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_change_history" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "supply_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,5) NOT NULL,
    "unit_measure" VARCHAR(10) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "pulsos" INTEGER DEFAULT 100,
    "kg_por_pulso" DECIMAL(10,4) DEFAULT 0.0000,
    "is_bank_ingredient" BOOLEAN DEFAULT false,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_distribution_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cost_type" VARCHAR(100) NOT NULL,
    "cost_name" VARCHAR(255) NOT NULL,
    "product_category_id" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_distribution_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_distribution_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "product_category_id" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_distribution_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_cost_distribution" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cost_type" VARCHAR(100) NOT NULL,
    "cost_name" VARCHAR(255) NOT NULL,
    "employee_category_id" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "product_category_id" INTEGER,

    CONSTRAINT "employee_cost_distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_sales" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "product_id" VARCHAR(255) NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "month_year" DATE NOT NULL,
    "fecha_imputacion" VARCHAR(7) NOT NULL,
    "quantity_sold" DECIMAL(15,4) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "total_revenue" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_production" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "product_id" VARCHAR(255) NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "month_year" DATE NOT NULL,
    "fecha_imputacion" VARCHAR(7) NOT NULL,
    "quantity_produced" DECIMAL(15,4) NOT NULL,
    "unit_cost" DECIMAL(15,2) NOT NULL,
    "total_cost" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceComparison" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceComparisonCompetitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,

    CONSTRAINT "PriceComparisonCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceComparisonProductPrice" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "myPrice" DECIMAL(15,2) NOT NULL,
    "competitorPrice" DECIMAL(15,2),
    "competitorId" TEXT NOT NULL,

    CONSTRAINT "PriceComparisonProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxBase" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "recurringDay" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" SERIAL NOT NULL,
    "taxBaseId" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "TaxControlStatus" NOT NULL DEFAULT 'PENDIENTE',
    "receivedDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "alertDate" TIMESTAMP(3) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "receivedBy" INTEGER,
    "paidBy" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" SERIAL NOT NULL,
    "internalId" INTEGER,
    "name" TEXT NOT NULL,
    "type" "TruckType" NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "maxWeight" DOUBLE PRECISION,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "client" TEXT,
    "isOwn" BOOLEAN DEFAULT true,
    "chasisLength" DOUBLE PRECISION,
    "acopladoLength" DOUBLE PRECISION,
    "chasisWeight" DOUBLE PRECISION,
    "acopladoWeight" DOUBLE PRECISION,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Load" (
    "id" SERIAL NOT NULL,
    "internalId" INTEGER,
    "truckId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "status" "LoadStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledDate" TIMESTAMP(3),
    "departureDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveryClient" TEXT,
    "deliveryAddress" TEXT,
    "isCorralon" BOOLEAN DEFAULT false,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadItem" (
    "id" SERIAL NOT NULL,
    "loadId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "length" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoadItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "cuit" TEXT,
    "taxCondition" TEXT NOT NULL DEFAULT 'consumidor_final',
    "creditLimit" DOUBLE PRECISION,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTerms" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "observations" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legalName" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT NOT NULL,
    "checkTerms" INTEGER,
    "saleCondition" TEXT,
    "contactPerson" TEXT,
    "grossIncome" TEXT,
    "activityStartDate" TIMESTAMP(3),
    "merchandisePendingDays" INTEGER,
    "sellerId" INTEGER,
    "clientTypeId" TEXT,
    "deliveryZoneId" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedByUserId" INTEGER,
    "tipoCondicionVenta" "SaleConditionType" NOT NULL DEFAULT 'FORMAL',
    "porcentajeFormal" DECIMAL(5,2),
    "limiteAcopio" DECIMAL(15,2),
    "acopioActual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "diasAlertaAcopio" INTEGER,
    "transportCompanyId" TEXT,
    "businessSectorId" TEXT,
    "settlementPeriod" "SettlementPeriod",
    "requiresPurchaseOrder" BOOLEAN NOT NULL DEFAULT false,
    "isDeliveryBlocked" BOOLEAN NOT NULL DEFAULT false,
    "deliveryBlockedReason" TEXT,
    "deliveryBlockedAt" TIMESTAMP(3),
    "quickNote" TEXT,
    "quickNoteExpiry" TIMESTAMP(3),
    "hasCheckLimit" BOOLEAN NOT NULL DEFAULT false,
    "checkLimitType" TEXT,
    "checkLimit" DECIMAL(15,2),
    "generalDiscount" DECIMAL(5,2),
    "creditLimitOverride" DECIMAL(15,2),
    "creditLimitOverrideExpiry" TIMESTAMP(3),
    "merchandisePendingDaysOverride" INTEGER,
    "merchandisePendingDaysOverrideExpiry" TIMESTAMP(3),
    "tempCreditLimit" DECIMAL(15,2),
    "tempCreditLimitOverride" DECIMAL(15,2),
    "tempCreditLimitOverrideExpiry" TIMESTAMP(3),
    "invoiceDueDays" INTEGER DEFAULT 15,
    "accountBlockDays" INTEGER,
    "extraBonusDescription" TEXT,
    "discountListId" TEXT,
    "defaultPriceListId" INTEGER,
    "whatsapp" TEXT,
    "municipalRetentionType" TEXT,
    "parentClientId" TEXT,
    "visitDays" JSONB DEFAULT '[]',
    "deliveryDays" JSONB DEFAULT '[]',
    "isVatPerceptionExempt" BOOLEAN NOT NULL DEFAULT false,
    "vatPerceptionExemptUntil" TIMESTAMP(3),
    "vatPerceptionExemptCertificate" TEXT,
    "isVatRetentionExempt" BOOLEAN NOT NULL DEFAULT false,
    "vatRetentionExemptUntil" TIMESTAMP(3),
    "isGrossIncomeExempt" BOOLEAN NOT NULL DEFAULT false,
    "grossIncomeExemptUntil" TIMESTAMP(3),
    "isMunicipalExempt" BOOLEAN NOT NULL DEFAULT false,
    "municipalExemptUntil" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDiscount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "categoryId" INTEGER,
    "productId" TEXT,
    "minQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPriceList" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "priceListName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountListRubro" (
    "id" TEXT NOT NULL,
    "discountListId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "categoryName" TEXT NOT NULL,
    "serieDesde" INTEGER DEFAULT 0,
    "serieHasta" INTEGER DEFAULT 0,
    "descuento1" DECIMAL(5,2),
    "descuento2" DECIMAL(5,2),
    "descuentoPago" DECIMAL(5,2),
    "comision" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountListRubro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountListProduct" (
    "id" TEXT NOT NULL,
    "discountListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountListProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseAccount" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" SERIAL NOT NULL,
    "numeroSerie" VARCHAR(10) NOT NULL,
    "numeroFactura" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "fechaImputacion" DATE NOT NULL,
    "tipoPago" VARCHAR(20) NOT NULL,
    "metodoPago" VARCHAR(50),
    "neto" DECIMAL(15,2) NOT NULL,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "noGravado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "impInter" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIVA" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIIBB" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otrosConceptos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iibb" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "tipoCuentaId" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "pagoUrgente" BOOLEAN NOT NULL DEFAULT false,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "docType" "DocType" DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ingresoConfirmado" BOOLEAN NOT NULL DEFAULT false,
    "ingresoConfirmadoPor" INTEGER,
    "ingresoConfirmadoAt" TIMESTAMP(3),
    "firmaIngreso" TEXT,
    "remitoUrl" TEXT,
    "fotoIngresoUrl" TEXT,
    "pagoForzado" BOOLEAN NOT NULL DEFAULT false,
    "pagoForzadoPor" INTEGER,
    "pagoForzadoAt" TIMESTAMP(3),
    "matchStatus" "FacturaMatchStatus" NOT NULL DEFAULT 'MATCH_PENDING',
    "matchCheckedAt" TIMESTAMP(3),
    "matchBlockReason" TEXT,
    "facturaValidada" BOOLEAN NOT NULL DEFAULT false,
    "validadaPor" INTEGER,
    "validadaAt" TIMESTAMP(3),
    "payApprovalStatus" "PayApprovalStatus" NOT NULL DEFAULT 'PAY_PENDING',
    "payApprovedBy" INTEGER,
    "payApprovedAt" TIMESTAMP(3),
    "payRejectedReason" TEXT,
    "prontoPagoDisponible" BOOLEAN NOT NULL DEFAULT false,
    "prontoPagoFechaLimite" TIMESTAMP(3),
    "prontoPagoPorcentaje" DECIMAL(5,2),
    "prontoPagoMonto" DECIMAL(15,2),
    "prontoPagoAplicado" BOOLEAN NOT NULL DEFAULT false,
    "prontoPagoAplicadoAt" TIMESTAMP(3),
    "requiereRevisionDuplicado" BOOLEAN NOT NULL DEFAULT false,
    "motivoBloqueo" TEXT,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptItem" (
    "id" SERIAL NOT NULL,
    "comprobanteId" INTEGER NOT NULL,
    "itemId" INTEGER,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierItem" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplyId" INTEGER NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "codigoProveedor" VARCHAR(100),
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "comprobanteId" INTEGER,
    "fecha" DATE NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "fechaPago" DATE NOT NULL,
    "totalPago" DECIMAL(15,2) NOT NULL,
    "efectivo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "dolares" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferencia" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "chequesTerceros" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "chequesPropios" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retIVA" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retGanancias" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retIngBrutos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "anticipo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notas" TEXT,
    "estado" TEXT DEFAULT 'EJECUTADO',
    "requiereDobleAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "primeraAprobacionBy" INTEGER,
    "primeraAprobacionAt" TIMESTAMP(3),
    "segundaAprobacionBy" INTEGER,
    "segundaAprobacionAt" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrderReceipt" (
    "id" SERIAL NOT NULL,
    "paymentOrderId" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "montoAplicado" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrderCheque" (
    "id" SERIAL NOT NULL,
    "paymentOrderId" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "banco" VARCHAR(100),
    "titular" VARCHAR(255),
    "fechaVencimiento" DATE,
    "importe" DECIMAL(15,2) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOrderCheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrderAttachment" (
    "id" SERIAL NOT NULL,
    "paymentOrderId" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "fileType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER,
    "description" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_allocations" (
    "id" SERIAL NOT NULL,
    "creditNoteId" INTEGER NOT NULL,
    "receiptId" INTEGER,
    "debitNoteId" INTEGER,
    "tipoImputacion" VARCHAR(20) NOT NULL DEFAULT 'FACTURA',
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "fxRate" DECIMAL(10,6),
    "amountBase" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_credit_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistInstructive" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistInstructive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_executions" (
    "id" SERIAL NOT NULL,
    "checklistItemId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "executedById" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "actualValue" TEXT,
    "notes" TEXT,
    "hasIssue" BOOLEAN NOT NULL DEFAULT false,
    "issueDescription" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "expectedValue" TEXT,
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_order_temp" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "machine_id" INTEGER NOT NULL,
    "order_position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_order_temp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "defaultTimeUnit" "TimeUnit" NOT NULL DEFAULT 'HOURS',
    "defaultExecutionWindow" "ExecutionWindow" NOT NULL DEFAULT 'ANY_TIME',
    "autoScheduling" BOOLEAN NOT NULL DEFAULT true,
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "allowOverdue" BOOLEAN NOT NULL DEFAULT true,
    "requirePhotos" BOOLEAN NOT NULL DEFAULT false,
    "requireSignoff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_history" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "executedById" INTEGER,
    "duration" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "rootCause" TEXT,
    "correctiveActions" TEXT,
    "preventiveActions" TEXT,
    "spareParts" JSONB,
    "nextMaintenanceDate" TIMESTAMP(3),
    "mttr" DOUBLE PRECISION,
    "mtbf" DOUBLE PRECISION,
    "completionRate" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_dashboard_configs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mi Dashboard',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_color_preferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "themeName" TEXT NOT NULL DEFAULT 'Personalizado',
    "chart1" TEXT NOT NULL DEFAULT '#3b82f6',
    "chart2" TEXT NOT NULL DEFAULT '#10b981',
    "chart3" TEXT NOT NULL DEFAULT '#f59e0b',
    "chart4" TEXT NOT NULL DEFAULT '#8b5cf6',
    "chart5" TEXT NOT NULL DEFAULT '#06b6d4',
    "chart6" TEXT NOT NULL DEFAULT '#ef4444',
    "progressPrimary" TEXT NOT NULL DEFAULT '#3b82f6',
    "progressSecondary" TEXT NOT NULL DEFAULT '#10b981',
    "progressWarning" TEXT NOT NULL DEFAULT '#f59e0b',
    "progressDanger" TEXT NOT NULL DEFAULT '#ef4444',
    "kpiPositive" TEXT NOT NULL DEFAULT '#10b981',
    "kpiNegative" TEXT NOT NULL DEFAULT '#ef4444',
    "kpiNeutral" TEXT NOT NULL DEFAULT '#64748b',
    "cardHighlight" TEXT NOT NULL DEFAULT '#ede9fe',
    "cardMuted" TEXT NOT NULL DEFAULT '#f1f5f9',
    "donut1" TEXT NOT NULL DEFAULT '#3b82f6',
    "donut2" TEXT NOT NULL DEFAULT '#10b981',
    "donut3" TEXT NOT NULL DEFAULT '#f59e0b',
    "donut4" TEXT NOT NULL DEFAULT '#8b5cf6',
    "donut5" TEXT NOT NULL DEFAULT '#94a3b8',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_color_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptom_library" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "keywords" JSONB NOT NULL,
    "shortNote" VARCHAR(255),
    "componentId" INTEGER,
    "subcomponentId" INTEGER,
    "machineId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "symptom_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downtime_logs" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "machineId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "returnToProductionBy" INTEGER,
    "returnToProductionAt" TIMESTAMP(3),
    "totalMinutes" INTEGER,
    "category" "DowntimeCategory" NOT NULL DEFAULT 'UNPLANNED',
    "reason" TEXT,
    "productionImpact" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downtime_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_logs" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "performedByType" TEXT NOT NULL DEFAULT 'USER',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "description" TEXT,
    "activityType" TEXT NOT NULL DEFAULT 'EXECUTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" SERIAL NOT NULL,
    "type" "TemplateType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "componentId" INTEGER,
    "machineId" INTEGER,
    "areaId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_assurance" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "requiredReason" TEXT,
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "status" "QAStatus" NOT NULL DEFAULT 'PENDING',
    "checklist" JSONB,
    "notes" TEXT,
    "returnToProductionConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "returnConfirmedById" INTEGER,
    "returnConfirmedAt" TIMESTAMP(3),
    "evidenceRequired" "EvidenceLevel" NOT NULL DEFAULT 'OPTIONAL',
    "evidenceProvided" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_assurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_watchers" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_watchers" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_occurrence_comments" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'comment',
    "mentionedUserIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_occurrence_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solutions_applied" (
    "id" SERIAL NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "diagnosis" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "outcome" "SolutionOutcome" NOT NULL,
    "performedById" INTEGER NOT NULL,
    "performedByIds" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualMinutes" INTEGER,
    "finalComponentId" INTEGER,
    "finalSubcomponentId" INTEGER,
    "confirmedCause" VARCHAR(255),
    "fixType" "FixType" NOT NULL DEFAULT 'DEFINITIVA',
    "templateUsedId" INTEGER,
    "sourceSolutionId" INTEGER,
    "toolsUsed" JSONB,
    "sparePartsUsed" JSONB,
    "effectiveness" INTEGER,
    "attachments" JSONB,
    "notes" TEXT,
    "isObsolete" BOOLEAN NOT NULL DEFAULT false,
    "obsoleteReason" VARCHAR(500),
    "obsoleteAt" TIMESTAMP(3),
    "obsoleteById" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solutions_applied_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_settings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "duplicateWindowHours" INTEGER NOT NULL DEFAULT 48,
    "recurrenceWindowDays" INTEGER NOT NULL DEFAULT 7,
    "downtimeQaThresholdMin" INTEGER NOT NULL DEFAULT 60,
    "slaP1Hours" INTEGER NOT NULL DEFAULT 4,
    "slaP2Hours" INTEGER NOT NULL DEFAULT 8,
    "slaP3Hours" INTEGER NOT NULL DEFAULT 24,
    "slaP4Hours" INTEGER NOT NULL DEFAULT 72,
    "requireEvidenceP3" BOOLEAN NOT NULL DEFAULT true,
    "requireEvidenceP2" BOOLEAN NOT NULL DEFAULT true,
    "requireEvidenceP1" BOOLEAN NOT NULL DEFAULT true,
    "requireReturnConfirmationOnDowntime" BOOLEAN NOT NULL DEFAULT true,
    "requireReturnConfirmationOnQA" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failure_occurrence_events" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "failureOccurrenceId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "causedDowntime" BOOLEAN NOT NULL DEFAULT false,
    "isSafetyRelated" BOOLEAN NOT NULL DEFAULT false,
    "isIntermittent" BOOLEAN NOT NULL DEFAULT false,
    "workOrderId" INTEGER,
    "symptoms" JSONB,
    "attachments" JSONB,

    CONSTRAINT "failure_occurrence_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "entityType" VARCHAR(30) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "previousValue" VARCHAR(255),
    "newValue" VARCHAR(255),
    "metadata" JSONB,
    "performedById" INTEGER,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "root_cause_analyses" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "failureOccurrenceId" INTEGER,
    "whys" JSONB NOT NULL,
    "rootCause" TEXT,
    "conclusion" TEXT,
    "correctiveActions" JSONB,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "root_cause_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_checklist_templates" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "failureTypeId" INTEGER,
    "minPriority" VARCHAR(10),
    "tags" JSONB,
    "items" JSONB NOT NULL,
    "evidenceRequired" VARCHAR(20) NOT NULL DEFAULT 'OPTIONAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_checklists" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "responses" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_embeddings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" VARCHAR(255),
    "context" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "actionType" VARCHAR(50),
    "actionData" JSONB,
    "actionStatus" VARCHAR(20),
    "sources" JSONB,
    "tokensUsed" INTEGER,
    "responseTimeMs" INTEGER,
    "isVoiceInput" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_action_logs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "actionType" VARCHAR(50) NOT NULL,
    "actionData" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "resultData" JSONB,
    "errorMessage" TEXT,
    "entityType" VARCHAR(50),
    "entityId" INTEGER,
    "conversationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTransit" BOOLEAN NOT NULL DEFAULT false,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadReservada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(15,4),
    "stockMaximo" DECIMAL(15,4),
    "puntoReposicion" DECIMAL(15,4),
    "costoUnitario" DECIMAL(15,4),
    "criticidad" VARCHAR(10),
    "ubicacion" VARCHAR(100),
    "codigoPropio" VARCHAR(100),
    "codigoProveedor" VARCHAR(100),
    "descripcionItem" VARCHAR(255),
    "companyId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ubicacionFisica" VARCHAR(100),
    "metodoSalida" VARCHAR(20),

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "tipo" "StockMovementType" NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadAnterior" DECIMAL(15,4) NOT NULL,
    "cantidadPosterior" DECIMAL(15,4) NOT NULL,
    "costoUnitario" DECIMAL(15,2),
    "costoTotal" DECIMAL(15,2),
    "supplierItemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "codigoPropio" VARCHAR(100),
    "codigoProveedor" VARCHAR(100),
    "descripcionItem" VARCHAR(255),
    "goodsReceiptId" INTEGER,
    "purchaseReturnId" INTEGER,
    "transferId" INTEGER,
    "adjustmentId" INTEGER,
    "despachoId" INTEGER,
    "devolucionId" INTEGER,
    "productionOrderId" INTEGER,
    "dailyProductionReportId" INTEGER,
    "reservationId" INTEGER,
    "sourceNumber" VARCHAR(50),
    "motivo" TEXT,
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "warehouseOrigenId" INTEGER NOT NULL,
    "warehouseDestinoId" INTEGER NOT NULL,
    "estado" "TransferStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaSolicitud" DATE NOT NULL,
    "fechaEnvio" DATE,
    "fechaRecepcion" DATE,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadEnviada" DECIMAL(15,4),
    "cantidadRecibida" DECIMAL(15,4),
    "notas" TEXT,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "AdjustmentType" NOT NULL,
    "estado" "AdjustmentStatus" NOT NULL DEFAULT 'BORRADOR',
    "motivo" TEXT NOT NULL,
    "motivoDetalle" TEXT,
    "reasonCode" VARCHAR(50),
    "adjuntos" TEXT[],
    "notas" TEXT,
    "warehouseId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_items" (
    "id" SERIAL NOT NULL,
    "adjustmentId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "cantidadAnterior" DECIMAL(15,4) NOT NULL,
    "cantidadNueva" DECIMAL(15,4) NOT NULL,
    "diferencia" DECIMAL(15,4) NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" "PurchaseOrderStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "fechaEntregaEsperada" DATE,
    "fechaEntregaReal" DATE,
    "condicionesPago" VARCHAR(255),
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "impuestos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "notasInternas" TEXT,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "rechazadoPor" INTEGER,
    "rechazadoAt" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "esEmergencia" BOOLEAN NOT NULL DEFAULT false,
    "motivoEmergencia" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "tipoCuentaId" INTEGER,
    "purchaseRequestId" INTEGER,
    "purchaseQuotationId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "codigoPropio" VARCHAR(50),
    "codigoProveedor" VARCHAR(50),
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadRecibida" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "fechaEntregaEsperada" DATE,
    "notas" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "estado" "GoodsReceiptStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaRecepcion" DATE NOT NULL,
    "numeroRemito" VARCHAR(100),
    "tieneFactura" BOOLEAN NOT NULL DEFAULT false,
    "facturaId" INTEGER,
    "esEmergencia" BOOLEAN NOT NULL DEFAULT false,
    "requiereRegularizacion" BOOLEAN NOT NULL DEFAULT false,
    "fechaLimiteRegularizacion" TIMESTAMP(3),
    "regularizada" BOOLEAN NOT NULL DEFAULT false,
    "regularizadaAt" TIMESTAMP(3),
    "isQuickPurchase" BOOLEAN NOT NULL DEFAULT false,
    "quickPurchaseReason" "QuickPurchaseReason",
    "quickPurchaseJustification" TEXT,
    "regularizationStatus" "RegularizationStatus",
    "regularizedBy" INTEGER,
    "regularizationNotes" TEXT,
    "estadoCalidad" "QualityStatus" NOT NULL DEFAULT 'PENDIENTE',
    "notasCalidad" TEXT,
    "notas" TEXT,
    "adjuntos" TEXT[],
    "firma" TEXT,
    "observacionesRecepcion" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" SERIAL NOT NULL,
    "goodsReceiptId" INTEGER NOT NULL,
    "purchaseOrderItemId" INTEGER,
    "supplierItemId" INTEGER NOT NULL,
    "codigoPropio" VARCHAR(100),
    "codigoProveedor" VARCHAR(100),
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidadEsperada" DECIMAL(15,4),
    "cantidadRecibida" DECIMAL(15,4) NOT NULL,
    "cantidadAceptada" DECIMAL(15,4) NOT NULL,
    "cantidadRechazada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "unidad" VARCHAR(50) NOT NULL,
    "motivoRechazo" TEXT,
    "lote" VARCHAR(100),
    "fechaVencimiento" DATE,
    "notas" TEXT,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grni_accruals" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "goodsReceiptId" INTEGER NOT NULL,
    "goodsReceiptItemId" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "descripcion" TEXT,
    "montoEstimado" DECIMAL(15,2) NOT NULL,
    "montoFacturado" DECIMAL(15,2),
    "varianza" DECIMAL(15,2),
    "estado" "GRNIStatus" NOT NULL DEFAULT 'PENDIENTE',
    "facturaId" INTEGER,
    "periodoCreacion" TEXT NOT NULL,
    "periodoFacturacion" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "docType" TEXT NOT NULL DEFAULT 'T1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,
    "reversadoAt" TIMESTAMP(3),
    "reversadoBy" INTEGER,
    "motivoReversion" TEXT,

    CONSTRAINT "grni_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_debit_notes" (
    "id" SERIAL NOT NULL,
    "tipo" "CreditDebitNoteType" NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "numeroSerie" VARCHAR(20) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "facturaId" INTEGER,
    "goodsReceiptId" INTEGER,
    "fechaEmision" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "neto" DECIMAL(15,2) NOT NULL,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "estado" "CreditDebitNoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "aplicada" BOOLEAN NOT NULL DEFAULT false,
    "aplicadaAt" TIMESTAMP(3),
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "notas" TEXT,
    "tipoNca" "CreditNoteType" NOT NULL DEFAULT 'NCA_OTRO',
    "requestId" INTEGER,
    "purchaseReturnId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_debit_note_items" (
    "id" SERIAL NOT NULL,
    "noteId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "credit_debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_requests" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" "CreditNoteRequestStatus" NOT NULL DEFAULT 'SNCA_NUEVA',
    "tipo" "CreditNoteRequestType" NOT NULL,
    "facturaId" INTEGER,
    "goodsReceiptId" INTEGER,
    "montoSolicitado" DECIMAL(15,2) NOT NULL,
    "montoAprobado" DECIMAL(15,2),
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "evidencias" TEXT[],
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEnvio" TIMESTAMP(3),
    "fechaRespuesta" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "respuestaProveedor" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_note_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_request_items" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidadFacturada" DECIMAL(15,4) NOT NULL,
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadAprobada" DECIMAL(15,4),
    "unidad" VARCHAR(20) NOT NULL,
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "credit_note_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" SERIAL NOT NULL,
    "purchaseOrderId" INTEGER,
    "goodsReceiptId" INTEGER,
    "facturaId" INTEGER NOT NULL,
    "estado" "MatchStatus" NOT NULL DEFAULT 'PENDIENTE',
    "matchOcRecepcion" BOOLEAN,
    "matchRecepcionFactura" BOOLEAN,
    "matchOcFactura" BOOLEAN,
    "matchCompleto" BOOLEAN NOT NULL DEFAULT false,
    "discrepancias" JSONB,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "accionTomada" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_line_results" (
    "id" SERIAL NOT NULL,
    "matchResultId" INTEGER NOT NULL,
    "facturaItemId" INTEGER,
    "receiptItemId" INTEGER,
    "ocItemId" INTEGER,
    "supplierItemId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "qtyFacturada" DECIMAL(15,4) NOT NULL,
    "qtyRecibida" DECIMAL(15,4) NOT NULL,
    "qtyOC" DECIMAL(15,4),
    "precioFactura" DECIMAL(15,4),
    "precioRecibido" DECIMAL(15,4),
    "precioOC" DECIMAL(15,4),
    "status" "LineMatchStatus" NOT NULL,
    "diffCantidad" DECIMAL(15,4),
    "diffPorcentaje" DECIMAL(5,2),
    "diffPrecio" DECIMAL(15,4),
    "pctVarianzaPrecio" DECIMAL(5,2),
    "razon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_line_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_exceptions" (
    "id" SERIAL NOT NULL,
    "matchResultId" INTEGER NOT NULL,
    "tipo" "MatchExceptionType" NOT NULL,
    "campo" VARCHAR(100) NOT NULL,
    "valorEsperado" TEXT,
    "valorRecibido" TEXT,
    "diferencia" DECIMAL(15,4),
    "porcentajeDiff" DECIMAL(5,2),
    "dentroTolerancia" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" INTEGER,
    "ownerRole" VARCHAR(50),
    "slaDeadline" TIMESTAMP(3),
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "prioridad" VARCHAR(20),
    "montoAfectado" DECIMAL(15,2),
    "escalatedAt" TIMESTAMP(3),
    "escalatedTo" INTEGER,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "accion" TEXT,
    "reasonCode" VARCHAR(50),
    "reasonText" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "toleranciaCantidad" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "toleranciaPrecio" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "toleranciaTotal" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "permitirExceso" BOOLEAN NOT NULL DEFAULT false,
    "permitirPagoSinMatch" BOOLEAN NOT NULL DEFAULT false,
    "bloquearPagoConWarning" BOOLEAN NOT NULL DEFAULT false,
    "permitirRecepcionSinOc" BOOLEAN NOT NULL DEFAULT true,
    "requiereAprobacionMontoMinimo" DECIMAL(15,2),
    "quickPurchaseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quickPurchaseMaxAmount" DECIMAL(15,2),
    "quickPurchaseRequiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "quickPurchaseAllowedRoles" TEXT[],
    "quickPurchaseAlertThreshold" INTEGER NOT NULL DEFAULT 3,
    "quickPurchaseRequireJustification" BOOLEAN NOT NULL DEFAULT true,
    "umbralAprobacionPedido" DECIMAL(15,2) NOT NULL DEFAULT 50000,
    "umbralDobleAprobacion" DECIMAL(15,2) NOT NULL DEFAULT 500000,
    "permitirPagoSinRecepcion" BOOLEAN NOT NULL DEFAULT false,
    "diasAlertaRecepcionSinFactura" INTEGER NOT NULL DEFAULT 7,
    "diasAlertaFacturaVencer" INTEGER NOT NULL DEFAULT 7,
    "diasLimiteRegularizacion" INTEGER NOT NULL DEFAULT 15,
    "iaAutoMatch" BOOLEAN NOT NULL DEFAULT false,
    "iaConfianzaMinima" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_exception_sla_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "exceptionType" VARCHAR(50) NOT NULL,
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "ownerRole" VARCHAR(50),
    "escalateAfterHours" INTEGER,
    "escalateToRole" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_exception_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_exception_history" (
    "id" SERIAL NOT NULL,
    "exceptionId" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "fromOwnerId" INTEGER,
    "toOwnerId" INTEGER,
    "fromStatus" VARCHAR(50),
    "toStatus" VARCHAR(50),
    "reasonCode" VARCHAR(50),
    "reasonText" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_exception_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "destinatarios" JSONB NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "datos" JSONB,
    "prioridad" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sod_rules" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "accion1" VARCHAR(50) NOT NULL,
    "accion2" VARCHAR(50) NOT NULL,
    "scope" VARCHAR(30) NOT NULL DEFAULT 'SAME_DOCUMENT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sod_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sod_violations" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "documentType" VARCHAR(50) NOT NULL,
    "documentId" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "bloqueado" BOOLEAN NOT NULL DEFAULT true,
    "aprobadoPor" INTEGER,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sod_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_approvals" (
    "id" SERIAL NOT NULL,
    "tipo" "ApprovalType" NOT NULL,
    "referenciaId" INTEGER NOT NULL,
    "referenciaTipo" VARCHAR(50) NOT NULL,
    "estado" "ApprovalStatus" NOT NULL DEFAULT 'PENDIENTE',
    "monto" DECIMAL(15,2),
    "motivo" TEXT,
    "asignadoA" INTEGER,
    "fechaLimite" TIMESTAMP(3),
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "decision" "ApprovalDecision",
    "comentarios" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "estado" "ProjectStatus" NOT NULL DEFAULT 'ACTIVO',
    "fechaInicio" DATE,
    "fechaFin" DATE,
    "presupuesto" DECIMAL(15,2),
    "clienteId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_item_aliases" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "alias" VARCHAR(255) NOT NULL,
    "codigoProveedor" VARCHAR(100),
    "esNombreFactura" BOOLEAN NOT NULL DEFAULT true,
    "confianza" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "vecesUsado" INTEGER NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_item_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" "PaymentRequestStatus" NOT NULL DEFAULT 'SOLICITADA',
    "prioridad" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "fechaSolicitud" DATE NOT NULL,
    "fechaObjetivo" DATE,
    "fechaAprobacion" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "montoTotal" DECIMAL(15,2) NOT NULL,
    "motivo" TEXT,
    "comentarios" TEXT,
    "esUrgente" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "rechazadoPor" INTEGER,
    "motivoRechazo" TEXT,
    "paymentOrderId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_request_receipts" (
    "id" SERIAL NOT NULL,
    "paymentRequestId" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "montoSolicitado" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_request_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_request_logs" (
    "id" SERIAL NOT NULL,
    "paymentRequestId" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "estadoAnterior" VARCHAR(30),
    "estadoNuevo" VARCHAR(30),
    "prioridadAnterior" VARCHAR(20),
    "prioridadNueva" VARCHAR(20),
    "userId" INTEGER NOT NULL,
    "detalles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "goodsReceiptId" INTEGER,
    "estado" "PurchaseReturnStatus" NOT NULL DEFAULT 'BORRADOR',
    "tipo" "ReturnType" NOT NULL,
    "fechaSolicitud" DATE NOT NULL,
    "fechaEnvio" DATE,
    "fechaResolucion" DATE,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "evidencias" JSONB,
    "evidenciaProblema" TEXT,
    "evidenciaEnvio" TEXT,
    "evidenciaRecepcion" TEXT,
    "resolucion" TEXT,
    "creditNoteId" INTEGER,
    "facturaId" INTEGER,
    "creditNoteRequestId" INTEGER,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "warehouseId" INTEGER,
    "stockMovementCreated" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "docType" VARCHAR(10) DEFAULT 'T1',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_items" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "motivo" TEXT,
    "estado" "ReturnItemStatus" NOT NULL DEFAULT 'PENDIENTE',
    "goodsReceiptItemId" INTEGER,
    "precioReferencia" DECIMAL(15,2),
    "fuentePrecio" TEXT,

    CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishment_suggestions" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "proveedorSugerido" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "cantidadSugerida" DECIMAL(15,4) NOT NULL,
    "cantidadActual" DECIMAL(15,4) NOT NULL,
    "stockMinimo" DECIMAL(15,4) NOT NULL,
    "consumoPromedio" DECIMAL(15,4),
    "leadTimeEstimado" INTEGER,
    "urgencia" "ReplenishmentUrgency" NOT NULL DEFAULT 'NORMAL',
    "motivo" TEXT,
    "estado" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "purchaseOrderId" INTEGER,
    "ignorada" BOOLEAN NOT NULL DEFAULT false,
    "ignoradaPor" INTEGER,
    "ignoradaMotivo" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "replenishment_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_lead_times" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "supplierItemId" INTEGER,
    "leadTimePromedio" INTEGER NOT NULL,
    "leadTimeMinimo" INTEGER,
    "leadTimeMaximo" INTEGER,
    "desviacionEstandar" DECIMAL(5,2),
    "cantidadMuestras" INTEGER NOT NULL DEFAULT 0,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "supplier_lead_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_audit_logs" (
    "id" SERIAL NOT NULL,
    "entidad" VARCHAR(100) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "camposModificados" JSONB,
    "datosAnteriores" JSONB,
    "datosNuevos" JSONB,
    "ip" VARCHAR(50),
    "userAgent" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_detections" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "duplicadoDeId" INTEGER,
    "campos" JSONB NOT NULL,
    "confianza" DECIMAL(5,2) NOT NULL,
    "estado" "DuplicateStatus" NOT NULL DEFAULT 'PENDIENTE',
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "esRealDuplicado" BOOLEAN,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "estado" "PurchaseRequestStatus" NOT NULL DEFAULT 'BORRADOR',
    "prioridad" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "solicitanteId" INTEGER NOT NULL,
    "departamento" VARCHAR(100),
    "fechaNecesidad" DATE,
    "fechaLimite" DATE,
    "presupuestoEstimado" DECIMAL(15,2),
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "adjuntos" TEXT[],
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request_items" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "supplierItemId" INTEGER,
    "especificaciones" TEXT,

    CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_quotations" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "requestId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "estado" "QuotationStatus" NOT NULL DEFAULT 'RECIBIDA',
    "fechaCotizacion" DATE NOT NULL,
    "validezHasta" DATE,
    "plazoEntrega" INTEGER,
    "fechaEntregaEstimada" DATE,
    "condicionesPago" VARCHAR(200),
    "formaPago" VARCHAR(100),
    "garantia" VARCHAR(200),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "exchangeRate" DECIMAL(15,4),
    "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "shippingCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherCosts" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherCostsDesc" VARCHAR(200),
    "beneficios" TEXT,
    "observaciones" TEXT,
    "adjuntos" TEXT[],
    "esSeleccionada" BOOLEAN NOT NULL DEFAULT false,
    "seleccionadaPor" INTEGER,
    "seleccionadaAt" TIMESTAMP(3),
    "motivoSeleccion" TEXT,
    "receivedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "notSelectedReason" VARCHAR(100),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_quotation_items" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "requestItemId" INTEGER,
    "supplierItemId" INTEGER,
    "codigoProveedor" VARCHAR(100),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,4) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "productId" TEXT,
    "normalizedKey" VARCHAR(200),
    "supplierSku" VARCHAR(100),
    "isSubstitute" BOOLEAN NOT NULL DEFAULT false,
    "substituteFor" INTEGER,

    CONSTRAINT "purchase_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_status_history" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "fromStatus" "QuotationStatus",
    "toStatus" "QuotationStatus" NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "systemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "quotation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_quotation_settings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "autoRejectOnSelect" BOOLEAN NOT NULL DEFAULT false,
    "scorePriceWeight" INTEGER NOT NULL DEFAULT 50,
    "scoreDeliveryWeight" INTEGER NOT NULL DEFAULT 25,
    "scorePaymentWeight" INTEGER NOT NULL DEFAULT 25,
    "penaltyMissingItems" INTEGER NOT NULL DEFAULT 10,
    "penaltyExpired" INTEGER NOT NULL DEFAULT 20,
    "penaltyIncomplete" INTEGER NOT NULL DEFAULT 5,
    "alertDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_quotation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_comments" (
    "id" SERIAL NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "tipo" "PurchaseCommentType" NOT NULL DEFAULT 'COMENTARIO',
    "contenido" TEXT NOT NULL,
    "adjuntos" TEXT[],
    "mencionados" INTEGER[],
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_view_config" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "hotkey" VARCHAR(50),
    "pinHash" VARCHAR(100),
    "sessionTimeout" INTEGER NOT NULL DEFAULT 30,
    "tiposT2" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "t2DbEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_view_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_vm_log" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_vm_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_blacklist" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceFingerprint" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_entries" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failReason" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_two_factor" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "secret" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "backupCodes" TEXT[],
    "usedBackupCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "deviceName" TEXT,
    "trustToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_config" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "quotePrefix" VARCHAR(10) NOT NULL DEFAULT 'COT',
    "quoteNextNumber" INTEGER NOT NULL DEFAULT 1,
    "salePrefix" VARCHAR(10) NOT NULL DEFAULT 'VTA',
    "saleNextNumber" INTEGER NOT NULL DEFAULT 1,
    "deliveryPrefix" VARCHAR(10) NOT NULL DEFAULT 'ENT',
    "deliveryNextNumber" INTEGER NOT NULL DEFAULT 1,
    "remitoPrefix" VARCHAR(10) NOT NULL DEFAULT 'REM',
    "remitoNextNumber" INTEGER NOT NULL DEFAULT 1,
    "invoicePrefix" VARCHAR(10) NOT NULL DEFAULT 'FA',
    "paymentPrefix" VARCHAR(10) NOT NULL DEFAULT 'REC',
    "paymentNextNumber" INTEGER NOT NULL DEFAULT 1,
    "puntoVenta" VARCHAR(5) NOT NULL DEFAULT '0001',
    "invoiceNextNumberA" INTEGER NOT NULL DEFAULT 1,
    "invoiceNextNumberB" INTEGER NOT NULL DEFAULT 1,
    "invoiceNextNumberC" INTEGER NOT NULL DEFAULT 1,
    "requiereAprobacionCotizacion" BOOLEAN NOT NULL DEFAULT false,
    "montoMinimoAprobacionCot" DECIMAL(15,2),
    "requiereAprobacionDescuento" BOOLEAN NOT NULL DEFAULT true,
    "maxDescuentoSinAprobacion" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "validarLimiteCredito" BOOLEAN NOT NULL DEFAULT true,
    "bloquearVentaSinCredito" BOOLEAN NOT NULL DEFAULT false,
    "diasVencimientoDefault" INTEGER NOT NULL DEFAULT 30,
    "enableBlockByOverdue" BOOLEAN NOT NULL DEFAULT true,
    "overdueGraceDays" INTEGER NOT NULL DEFAULT 0,
    "autoBlockOnOverdue" BOOLEAN NOT NULL DEFAULT false,
    "enableAging" BOOLEAN NOT NULL DEFAULT true,
    "agingBuckets" JSONB NOT NULL DEFAULT '[30, 60, 90, 120]',
    "creditAlertThreshold" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "enableCheckLimit" BOOLEAN NOT NULL DEFAULT true,
    "defaultCheckLimit" DECIMAL(15,2),
    "defaultCheckMaxDays" INTEGER,
    "blockOnRejectedCheck" BOOLEAN NOT NULL DEFAULT true,
    "autoRecalculateBalances" BOOLEAN NOT NULL DEFAULT false,
    "validarStockDisponible" BOOLEAN NOT NULL DEFAULT true,
    "permitirVentaSinStock" BOOLEAN NOT NULL DEFAULT true,
    "reservarStockEnCotizacion" BOOLEAN NOT NULL DEFAULT false,
    "margenMinimoPermitido" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "alertarMargenBajo" BOOLEAN NOT NULL DEFAULT true,
    "comisionVendedorDefault" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tasaIvaDefault" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "diasValidezCotizacion" INTEGER NOT NULL DEFAULT 30,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalShowStock" BOOLEAN NOT NULL DEFAULT false,
    "portalShowOriginalPrice" BOOLEAN NOT NULL DEFAULT true,
    "portalAutoApproveOrders" BOOLEAN NOT NULL DEFAULT false,
    "portalOrderMinAmount" DECIMAL(15,2),
    "portalSessionDays" INTEGER NOT NULL DEFAULT 7,
    "portalInviteExpiryHours" INTEGER NOT NULL DEFAULT 48,
    "portalWelcomeMessage" TEXT,
    "portalNotifyEmails" TEXT,
    "portalRequireApprovalAbove" DECIMAL(15,2),
    "habilitarAcopios" BOOLEAN NOT NULL DEFAULT true,
    "acopioPrefix" VARCHAR(10) NOT NULL DEFAULT 'ACO',
    "acopioNextNumber" INTEGER NOT NULL DEFAULT 1,
    "retiroPrefix" VARCHAR(10) NOT NULL DEFAULT 'RET',
    "retiroNextNumber" INTEGER NOT NULL DEFAULT 1,
    "diasAlertaAcopioDefault" INTEGER NOT NULL DEFAULT 30,
    "diasVencimientoAcopioDefault" INTEGER NOT NULL DEFAULT 90,
    "bloquearVentaAcopioExcedido" BOOLEAN NOT NULL DEFAULT false,
    "alertarAcopioExcedido" BOOLEAN NOT NULL DEFAULT true,
    "enableLoadOrders" BOOLEAN NOT NULL DEFAULT true,
    "enablePartialDeliveries" BOOLEAN NOT NULL DEFAULT true,
    "enableInvoiceByDelivery" BOOLEAN NOT NULL DEFAULT true,
    "requireRemitoForInvoice" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateRemitoOnDelivery" BOOLEAN NOT NULL DEFAULT false,
    "enablePOD" BOOLEAN NOT NULL DEFAULT true,
    "enableShipping" BOOLEAN NOT NULL DEFAULT true,
    "enableLoadPlanning" BOOLEAN NOT NULL DEFAULT true,
    "loadOrderPrefix" VARCHAR(10) NOT NULL DEFAULT 'ORC',
    "enablePickupTurns" BOOLEAN NOT NULL DEFAULT true,
    "enableBankReconciliation" BOOLEAN NOT NULL DEFAULT true,
    "defaultSlotDuration" INTEGER NOT NULL DEFAULT 60,
    "maxReservationsPerDay" INTEGER,
    "cancellationDeadlineHours" INTEGER NOT NULL DEFAULT 24,
    "noShowPenaltyDays" INTEGER NOT NULL DEFAULT 7,
    "clientFormEnabledFields" JSONB NOT NULL DEFAULT '{}',
    "maxClientFormFeatures" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" INTEGER,
    "estado" "QuoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "quoteType" "QuoteType" NOT NULL DEFAULT 'COTIZACION',
    "fechaEmision" DATE NOT NULL,
    "fechaValidez" DATE NOT NULL,
    "fechaEnvio" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "descuentoGlobal" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "descuentoMonto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "impuestos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "tipoCambio" DECIMAL(15,4),
    "condicionesPago" VARCHAR(255),
    "diasPlazo" INTEGER,
    "condicionesEntrega" VARCHAR(255),
    "tiempoEntrega" VARCHAR(100),
    "lugarEntrega" TEXT,
    "titulo" VARCHAR(255),
    "descripcion" TEXT,
    "notas" TEXT,
    "notasInternas" TEXT,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "motivoPerdida" TEXT,
    "competidorGanador" TEXT,
    "precioCompetidor" DECIMAL(15,2),
    "convertidaAVentaId" INTEGER,
    "convertidaAt" TIMESTAMP(3),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "costoTotal" DECIMAL(15,2),
    "margenBruto" DECIMAL(15,2),
    "margenPorcentaje" DECIMAL(5,2),
    "comisionPorcentaje" DECIMAL(5,2),
    "comisionMonto" DECIMAL(15,2),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costoUnitario" DECIMAL(15,2),
    "margenItem" DECIMAL(5,2),
    "notas" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_attachments" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "tamanio" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "motivo" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_access" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" INTEGER,
    "token" VARCHAR(100) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "client_portal_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "whatsapp" VARCHAR(50),
    "position" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_users" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(50),
    "canViewPrices" BOOLEAN NOT NULL DEFAULT true,
    "canViewQuotes" BOOLEAN NOT NULL DEFAULT true,
    "canAcceptQuotes" BOOLEAN NOT NULL DEFAULT true,
    "canCreateOrders" BOOLEAN NOT NULL DEFAULT true,
    "canViewHistory" BOOLEAN NOT NULL DEFAULT true,
    "canViewDocuments" BOOLEAN NOT NULL DEFAULT true,
    "maxOrderAmount" DECIMAL(15,2),
    "requiresApprovalAbove" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,

    CONSTRAINT "client_portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_invites" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(100) NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "sentVia" VARCHAR(20),

    CONSTRAINT "client_portal_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_sessions" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,

    CONSTRAINT "client_portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_orders" (
    "id" TEXT NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "clientRequestId" VARCHAR(100) NOT NULL,
    "quoteId" INTEGER,
    "estado" "PortalOrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "notasCliente" TEXT,
    "direccionEntrega" TEXT,
    "fechaEntregaSolicitada" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedBy" INTEGER,
    "processNotes" TEXT,
    "rejectionReason" TEXT,
    "convertedToQuoteId" INTEGER,
    "convertedToSaleId" INTEGER,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "client_portal_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,

    CONSTRAINT "client_portal_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_portal_activity" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "action" "PortalActivityAction" NOT NULL,
    "entityType" VARCHAR(50),
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_portal_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_acceptances" (
    "id" SERIAL NOT NULL,
    "quoteId" INTEGER NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedByContactId" TEXT,
    "quoteVersionId" INTEGER,
    "pdfHash" VARCHAR(64),
    "aceptadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "firmaDigital" TEXT,
    "nombreFirmante" VARCHAR(255),
    "dniCuitFirmante" VARCHAR(20),
    "observaciones" TEXT,

    CONSTRAINT "quote_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" INTEGER,
    "quoteId" INTEGER,
    "estado" "SaleStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "fechaEntregaEstimada" DATE,
    "fechaEntregaReal" DATE,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "descuentoGlobal" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "descuentoMonto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "impuestos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "condicionesPago" VARCHAR(255),
    "diasPlazo" INTEGER,
    "lugarEntrega" TEXT,
    "notas" TEXT,
    "notasInternas" TEXT,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "comisionPorcentaje" DECIMAL(5,2),
    "comisionMonto" DECIMAL(15,2),
    "comisionPagada" BOOLEAN NOT NULL DEFAULT false,
    "comisionPagadaAt" TIMESTAMP(3),
    "costoTotal" DECIMAL(15,2),
    "margenBruto" DECIMAL(15,2),
    "margenPorcentaje" DECIMAL(5,2),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadEntregada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "costoUnitario" DECIMAL(15,2),
    "notas" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_deliveries" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "saleId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "estado" "DeliveryStatus" NOT NULL DEFAULT 'PENDIENTE',
    "fechaProgramada" DATE,
    "horaProgramada" VARCHAR(20),
    "fechaEntrega" DATE,
    "horaEntrega" VARCHAR(20),
    "direccionEntrega" TEXT,
    "transportista" VARCHAR(255),
    "vehiculo" VARCHAR(100),
    "conductorNombre" VARCHAR(255),
    "conductorDNI" VARCHAR(20),
    "costoFlete" DECIMAL(15,2),
    "costoSeguro" DECIMAL(15,2),
    "otrosCostos" DECIMAL(15,2),
    "recibeNombre" VARCHAR(255),
    "recibeDNI" VARCHAR(20),
    "firmaRecepcion" TEXT,
    "latitudEntrega" DECIMAL(10,8),
    "longitudEntrega" DECIMAL(11,8),
    "notas" TEXT,
    "observacionesEntrega" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_delivery_items" (
    "id" SERIAL NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "productId" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "notas" TEXT,

    CONSTRAINT "sale_delivery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_delivery_evidences" (
    "id" SERIAL NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_delivery_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_remitos" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "saleId" INTEGER NOT NULL,
    "deliveryId" INTEGER,
    "clientId" TEXT NOT NULL,
    "estado" "RemitoStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "cai" VARCHAR(20),
    "fechaVtoCai" DATE,
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_remitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_remito_items" (
    "id" SERIAL NOT NULL,
    "remitoId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "productId" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "sale_remito_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" SERIAL NOT NULL,
    "tipo" "SalesInvoiceType" NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVenta" VARCHAR(5) NOT NULL,
    "numero" VARCHAR(8) NOT NULL,
    "numeroCompleto" VARCHAR(20) NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" INTEGER,
    "estado" "SalesInvoiceStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "fechaServicioDesde" DATE,
    "fechaServicioHasta" DATE,
    "netoGravado" DECIMAL(15,2) NOT NULL,
    "netoNoGravado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIVA" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "percepcionIIBB" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otrosImpuestos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "tipoCambio" DECIMAL(15,4),
    "totalCobrado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoPendiente" DECIMAL(15,2) NOT NULL,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "estadoAFIP" "AFIPStatus",
    "condicionesPago" VARCHAR(255),
    "notas" TEXT,
    "notasInternas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_items" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "saleItemId" INTEGER,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "alicuotaIVA" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_credit_debit_notes" (
    "id" SERIAL NOT NULL,
    "tipo" "SalesCreditDebitType" NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVenta" VARCHAR(5) NOT NULL,
    "numero" VARCHAR(8) NOT NULL,
    "numeroCompleto" VARCHAR(20) NOT NULL,
    "clientId" TEXT NOT NULL,
    "facturaId" INTEGER,
    "estado" "CreditDebitNoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "netoGravado" DECIMAL(15,2) NOT NULL,
    "iva21" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva105" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva27" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "cae" VARCHAR(20),
    "fechaVtoCae" DATE,
    "aplicada" BOOLEAN NOT NULL DEFAULT false,
    "aplicadaAt" TIMESTAMP(3),
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_credit_debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_credit_debit_note_items" (
    "id" SERIAL NOT NULL,
    "noteId" INTEGER NOT NULL,
    "productId" TEXT,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "alicuotaIVA" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "subtotal" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "sales_credit_debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payments" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "fechaPago" DATE NOT NULL,
    "totalPago" DECIMAL(15,2) NOT NULL,
    "efectivo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "transferencia" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "chequesTerceros" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "chequesPropios" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tarjetaCredito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tarjetaDebito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otrosMedios" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retIVA" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retGanancias" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "retIngBrutos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "estado" "ClientPaymentStatus" NOT NULL DEFAULT 'CONFIRMADO',
    "bancoOrigen" VARCHAR(100),
    "numeroOperacion" VARCHAR(50),
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment_allocations" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "montoAplicado" DECIMAL(15,2) NOT NULL,
    "fechaAplicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payment_cheques" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "banco" VARCHAR(100),
    "titular" VARCHAR(255),
    "cuit" VARCHAR(20),
    "fechaEmision" DATE,
    "fechaVencimiento" DATE,
    "importe" DECIMAL(15,2) NOT NULL,
    "estado" "ChequeStatus" NOT NULL DEFAULT 'CARTERA',

    CONSTRAINT "client_payment_cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_ledger_entries" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" "ClientMovementType" NOT NULL,
    "facturaId" INTEGER,
    "notaCreditoDebitoId" INTEGER,
    "pagoId" INTEGER,
    "fecha" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "debe" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "comprobante" VARCHAR(100),
    "descripcion" TEXT,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "anuladoPor" INTEGER,
    "anuladoAt" TIMESTAMP(3),
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_price_lists" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',
    "porcentajeBase" DECIMAL(5,2),
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" DATE,
    "validUntil" DATE,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_price_list_items" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "porcentaje" DECIMAL(5,2),

    CONSTRAINT "sales_price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_approvals" (
    "id" SERIAL NOT NULL,
    "entidad" VARCHAR(50) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "tipo" "SalesApprovalType" NOT NULL,
    "estado" "SalesApprovalStatus" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "monto" DECIMAL(15,2),
    "porcentaje" DECIMAL(5,2),
    "solicitadoPor" INTEGER NOT NULL,
    "asignadoA" INTEGER,
    "resueltoPor" INTEGER,
    "resueltoAt" TIMESTAMP(3),
    "comentarios" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_audit_logs" (
    "id" SERIAL NOT NULL,
    "entidad" VARCHAR(100) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "camposModificados" JSONB,
    "datosAnteriores" JSONB,
    "datosNuevos" JSONB,
    "ip" VARCHAR(50),
    "userAgent" TEXT,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_kpis" (
    "id" SERIAL NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "periodo" DATE NOT NULL,
    "cotizacionesCreadas" INTEGER NOT NULL DEFAULT 0,
    "cotizacionesGanadas" INTEGER NOT NULL DEFAULT 0,
    "cotizacionesPerdidas" INTEGER NOT NULL DEFAULT 0,
    "tasaConversion" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ventasTotales" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "margenPromedio" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "comisionesGeneradas" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "comisionesPagadas" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "clientesNuevos" INTEGER NOT NULL DEFAULT 0,
    "ticketPromedio" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ModuleCategory" NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dependencies" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_modules" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledBy" INTEGER,
    "config" JSONB,

    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_acopios" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" INTEGER NOT NULL,
    "paymentId" INTEGER,
    "estado" "AcopioStatus" NOT NULL DEFAULT 'ACTIVO',
    "fechaIngreso" DATE NOT NULL,
    "fechaVencimiento" DATE,
    "montoTotal" DECIMAL(15,2) NOT NULL,
    "montoRetirado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "montoPendiente" DECIMAL(15,2) NOT NULL,
    "notas" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_acopios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_acopio_items" (
    "id" SERIAL NOT NULL,
    "acopioId" INTEGER NOT NULL,
    "saleItemId" INTEGER,
    "productId" TEXT,
    "codigo" VARCHAR(50),
    "descripcion" VARCHAR(500) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15,2) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadRetirada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadPendiente" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "sale_acopio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acopio_retiros" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "acopioId" INTEGER NOT NULL,
    "fechaRetiro" DATE NOT NULL,
    "retiraNombre" VARCHAR(255),
    "retiraDNI" VARCHAR(20),
    "retiraRelacion" VARCHAR(100),
    "montoRetirado" DECIMAL(15,2) NOT NULL,
    "transportista" VARCHAR(255),
    "vehiculo" VARCHAR(100),
    "patente" VARCHAR(20),
    "firmaRetiro" TEXT,
    "fotoEntrega" TEXT,
    "gpsEntrega" VARCHAR(100),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "observaciones" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acopio_retiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acopio_retiro_items" (
    "id" SERIAL NOT NULL,
    "retiroId" INTEGER NOT NULL,
    "acopioItemId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "acopio_retiro_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "saldoActual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" SERIAL NOT NULL,
    "cashAccountId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" "CashMovementType" NOT NULL,
    "paymentOrderId" INTEGER,
    "clientPaymentId" INTEGER,
    "chequeId" INTEGER,
    "transferId" INTEGER,
    "ingreso" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "egreso" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoAnterior" DECIMAL(15,2) NOT NULL,
    "saldoPosterior" DECIMAL(15,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "comprobante" VARCHAR(100),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "banco" VARCHAR(100) NOT NULL,
    "tipoCuenta" VARCHAR(50) NOT NULL,
    "numeroCuenta" VARCHAR(50) NOT NULL,
    "cbu" VARCHAR(22),
    "alias" VARCHAR(50),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "saldoContable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoBancario" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_movements" (
    "id" SERIAL NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipo" "BankMovementType" NOT NULL,
    "paymentOrderId" INTEGER,
    "clientPaymentId" INTEGER,
    "chequeId" INTEGER,
    "ingreso" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "egreso" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldoAnterior" DECIMAL(15,2) NOT NULL,
    "saldoPosterior" DECIMAL(15,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaValor" DATE,
    "descripcion" TEXT,
    "comprobante" VARCHAR(100),
    "referenciaExterna" VARCHAR(100),
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "origen" "ChequeOrigen" NOT NULL,
    "tipo" "ChequeTipo" NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "banco" VARCHAR(100) NOT NULL,
    "sucursal" VARCHAR(50),
    "titular" VARCHAR(255) NOT NULL,
    "cuitTitular" VARCHAR(20),
    "importe" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "fechaEmision" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "fechaDeposito" DATE,
    "fechaCobro" DATE,
    "estado" "ChequeEstado" NOT NULL DEFAULT 'CARTERA',
    "clientPaymentId" INTEGER,
    "paymentOrderId" INTEGER,
    "bankAccountId" INTEGER,
    "depositoBankAccountId" INTEGER,
    "endosadoA" VARCHAR(255),
    "endosadoPaymentOrderId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "motivoRechazo" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_transfers" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "origenCajaId" INTEGER,
    "origenBancoId" INTEGER,
    "destinoCajaId" INTEGER,
    "destinoBancoId" INTEGER,
    "importe" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "estado" "TreasuryTransferStatus" NOT NULL DEFAULT 'PENDIENTE',
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "moduleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "monthlyPrice" DECIMAL(12,2) NOT NULL,
    "annualPrice" DECIMAL(12,2),
    "maxCompanies" INTEGER,
    "maxUsersPerCompany" INTEGER,
    "maxStorageGB" INTEGER,
    "includedTokensMonthly" INTEGER NOT NULL DEFAULT 0,
    "moduleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "billingCycle" "billing_cycle" NOT NULL DEFAULT 'MONTHLY',
    "includedTokensRemaining" INTEGER NOT NULL DEFAULT 0,
    "purchasedTokensBalance" INTEGER NOT NULL DEFAULT 0,
    "tokensUsedThisPeriod" INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt" TIMESTAMP(3),
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "planSnapshot" JSONB NOT NULL,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "discountAmount" DECIMAL(12,2) DEFAULT 0,
    "couponId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "method" TEXT NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "providerPaymentId" TEXT,
    "providerRef" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "notes" TEXT,
    "receivedBy" INTEGER,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_transactions" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "type" "token_transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "includedBalanceAfter" INTEGER NOT NULL,
    "purchasedBalanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "unitPrice" DECIMAL(12,2),
    "totalPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_audit_log" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "maxUses" INTEGER,
    "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "appliesToPlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliesToCycles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minAmount" DECIMAL(12,2),
    "firstPaymentOnly" BOOLEAN NOT NULL DEFAULT false,
    "durationMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_coupon_redemptions" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "appliedCount" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_auto_payment_configs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "providerPaymentMethodId" TEXT,
    "providerSubscriptionId" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailureReason" TEXT,
    "lastPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_auto_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_configs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "payment_frequency" TEXT NOT NULL DEFAULT 'BIWEEKLY',
    "first_payment_day" INTEGER NOT NULL DEFAULT 15,
    "second_payment_day" INTEGER NOT NULL DEFAULT 30,
    "quincena_percentage" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "payment_day_rule" TEXT NOT NULL DEFAULT 'PREVIOUS_BUSINESS_DAY',
    "max_advance_percent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "max_active_advances" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holidays" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_national" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_components" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "concept_type" VARCHAR(30) NOT NULL DEFAULT 'CALCULATED',
    "calc_type" VARCHAR(20) NOT NULL,
    "calc_value" DECIMAL(12,4),
    "calc_formula" TEXT,
    "base_variable" VARCHAR(30) NOT NULL DEFAULT 'GROSS_REMUNERATIVE',
    "depends_on" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "rounding_mode" VARCHAR(20) NOT NULL DEFAULT 'HALF_UP',
    "rounding_decimals" INTEGER NOT NULL DEFAULT 2,
    "cap_min" DECIMAL(12,2),
    "cap_max" DECIMAL(12,2),
    "is_remunerative" BOOLEAN NOT NULL DEFAULT true,
    "affects_employee_contrib" BOOLEAN NOT NULL DEFAULT true,
    "affects_employer_contrib" BOOLEAN NOT NULL DEFAULT true,
    "affects_income_tax" BOOLEAN NOT NULL DEFAULT false,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "apply_to" VARCHAR(100) NOT NULL DEFAULT 'ALL',
    "prorate_on_partial" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_components" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "component_id" INTEGER NOT NULL,
    "custom_value" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "employee_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "union_id" INTEGER,
    "category_id" INTEGER,
    "period_type" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "business_days" INTEGER NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_inputs" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "input_key" VARCHAR(50) NOT NULL,
    "input_value" DECIMAL(12,4) NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "period_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(14,2) NOT NULL,
    "total_deductions" DECIMAL(14,2) NOT NULL,
    "total_net" DECIMAL(14,2) NOT NULL,
    "total_employer_cost" DECIMAL(14,2) NOT NULL,
    "employee_count" INTEGER NOT NULL,
    "notes" TEXT,
    "calculated_at" TIMESTAMP(3),
    "calculated_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "paid_at" TIMESTAMP(3),
    "paid_by" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" INTEGER,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" SERIAL NOT NULL,
    "payroll_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "cost_center_id" INTEGER,
    "days_worked" INTEGER NOT NULL DEFAULT 30,
    "days_in_period" INTEGER NOT NULL DEFAULT 30,
    "prorate_factor" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "total_earnings" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "advances_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "employer_cost" DECIMAL(12,2) NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_item_lines" (
    "id" SERIAL NOT NULL,
    "payroll_item_id" INTEGER NOT NULL,
    "component_id" INTEGER,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "calculated_amount" DECIMAL(12,2) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "formula_used" TEXT,
    "meta" JSONB,

    CONSTRAINT "payroll_item_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_advances" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "installments_count" INTEGER NOT NULL DEFAULT 1,
    "installment_amount" DECIMAL(12,2) NOT NULL,
    "remaining_amount" DECIMAL(12,2) NOT NULL,
    "request_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" INTEGER,
    "reject_reason" TEXT,
    "payroll_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_installments" (
    "id" SERIAL NOT NULL,
    "advance_id" INTEGER NOT NULL,
    "installment_num" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_period_id" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "discounted_at" TIMESTAMP(3),
    "payroll_item_id" INTEGER,

    CONSTRAINT "advance_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_audit_logs" (
    "id" SERIAL NOT NULL,
    "payroll_id" INTEGER,
    "run_id" INTEGER,
    "action" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "details" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gremio_templates" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(500),
    "convention_code" VARCHAR(50),
    "payment_schedule_type" VARCHAR(50) NOT NULL DEFAULT 'BIWEEKLY_FIXED',
    "payment_rule_json" JSONB,
    "attendance_policy_json" JSONB,
    "contribution_rules_json" JSONB,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gremio_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gremio_category_templates" (
    "id" SERIAL NOT NULL,
    "gremio_template_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "group_name" VARCHAR(100),
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gremio_category_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_unions" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "convention_code" VARCHAR(50),
    "payment_schedule_type" VARCHAR(50) NOT NULL DEFAULT 'BIWEEKLY_FIXED',
    "payment_rule_json" JSONB,
    "attendance_policy_json" JSONB,
    "contribution_rules_json" JSONB,
    "source_template_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_unions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "union_categories" (
    "id" SERIAL NOT NULL,
    "union_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "union_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_sectors" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "description" TEXT,
    "cost_center_id" INTEGER,
    "source_sector_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_positions" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "sector_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_rates" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "union_category_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "daily_rate" DECIMAL(12,2) NOT NULL,
    "hourly_rate" DECIMAL(12,2),
    "presenteeism_rate" DECIMAL(12,2),
    "seniority_pct" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_default_concepts" (
    "id" SERIAL NOT NULL,
    "union_category_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "component_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "comment" VARCHAR(500),
    "no_delete" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_default_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_fixed_concepts" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "component_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_amount" DECIMAL(12,2) NOT NULL,
    "comment" VARCHAR(500),
    "no_delete" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "employee_fixed_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_variable_concepts" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "component_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_amount" DECIMAL(12,2) NOT NULL,
    "settlement_date" DATE,
    "transaction_date" DATE,
    "comment" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "created_by" INTEGER,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "attachment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_variable_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "event_date" DATE NOT NULL,
    "quantity" DECIMAL(5,2) NOT NULL,
    "minutes_late" INTEGER,
    "comment" TEXT,
    "generated_concept_id" INTEGER,
    "source" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" SERIAL NOT NULL,
    "period_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "run_number" INTEGER NOT NULL DEFAULT 1,
    "run_type" VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "total_gross" DECIMAL(14,2) NOT NULL,
    "total_deductions" DECIMAL(14,2) NOT NULL,
    "total_net" DECIMAL(14,2) NOT NULL,
    "total_employer_cost" DECIMAL(14,2) NOT NULL,
    "employee_count" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3),
    "calculated_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "paid_at" TIMESTAMP(3),
    "paid_by" INTEGER,
    "locked_at" TIMESTAMP(3),
    "locked_by" INTEGER,
    "voided_at" TIMESTAMP(3),
    "voided_by" INTEGER,
    "void_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_items" (
    "id" SERIAL NOT NULL,
    "run_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(255) NOT NULL,
    "employee_snapshot" JSONB NOT NULL,
    "days_worked" INTEGER NOT NULL DEFAULT 30,
    "days_in_period" INTEGER NOT NULL DEFAULT 30,
    "prorate_factor" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "gross_remunerative" DECIMAL(12,2) NOT NULL,
    "gross_total" DECIMAL(12,2) NOT NULL,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "advances_discounted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "employer_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_item_lines" (
    "id" SERIAL NOT NULL,
    "run_item_id" INTEGER NOT NULL,
    "component_id" INTEGER,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_amount" DECIMAL(12,2) NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "calculated_amount" DECIMAL(12,2) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "formula_used" TEXT,
    "meta" JSONB,

    CONSTRAINT "payroll_run_item_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_cost_breakdowns" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sparePartsCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "thirdPartyCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extrasCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "maintenance_cost_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_cost_rates" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "overtimeRate" DECIMAL(10,2),
    "role" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_cost_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_costs" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierRUT" TEXT,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "costType" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "third_party_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_budgets" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "sectorId" INTEGER,
    "totalBudget" DECIMAL(14,2) NOT NULL,
    "laborBudget" DECIMAL(14,2),
    "partsBudget" DECIMAL(14,2),
    "thirdPartyBudget" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,

    CONSTRAINT "maintenance_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerData" JSONB NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "conditionsPassed" BOOLEAN NOT NULL DEFAULT false,
    "actionsExecuted" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "machineId" INTEGER,
    "componentId" INTEGER,
    "failureOccurrenceId" INTEGER,
    "workOrderId" INTEGER,
    "category" "IdeaCategory" NOT NULL,
    "priority" "IdeaPriority" NOT NULL DEFAULT 'MEDIUM',
    "tags" JSONB,
    "status" "IdeaStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "implementedAt" TIMESTAMP(3),
    "implementedById" INTEGER,
    "implementationNotes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attachments" JSONB,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_votes" (
    "id" SERIAL NOT NULL,
    "ideaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_comments" (
    "id" SERIAL NOT NULL,
    "ideaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_system_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'V1',
    "usePayrollData" BOOLEAN NOT NULL DEFAULT false,
    "useComprasData" BOOLEAN NOT NULL DEFAULT false,
    "useVentasData" BOOLEAN NOT NULL DEFAULT false,
    "useProdData" BOOLEAN NOT NULL DEFAULT false,
    "useIndirectData" BOOLEAN NOT NULL DEFAULT false,
    "useMaintData" BOOLEAN NOT NULL DEFAULT false,
    "enablePretensadosSim" BOOLEAN NOT NULL DEFAULT false,
    "v2EnabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_cost_consolidations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "payrollCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchasesCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "indirectCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "productionCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maintenanceCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salesRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salesCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grossMargin" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netResult" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedById" INTEGER,
    "version" TEXT NOT NULL DEFAULT 'V1',
    "details" JSONB,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "monthly_cost_consolidations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" "AuditAction" NOT NULL,
    "fieldChanged" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "summary" TEXT,
    "performedById" INTEGER,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loto_procedures" (
    "id" SERIAL NOT NULL,
    "machineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "energySources" JSONB NOT NULL DEFAULT '[]',
    "lockoutSteps" JSONB NOT NULL DEFAULT '[]',
    "verificationSteps" JSONB NOT NULL DEFAULT '[]',
    "restorationSteps" JSONB NOT NULL DEFAULT '[]',
    "verificationMethod" TEXT,
    "requiredPPE" JSONB DEFAULT '[]',
    "estimatedMinutes" INTEGER,
    "warnings" TEXT,
    "specialConsiderations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loto_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permits_to_work" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "type" "PTWType" NOT NULL,
    "status" "PTWStatus" NOT NULL DEFAULT 'DRAFT',
    "workOrderId" INTEGER,
    "machineId" INTEGER,
    "sectorId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "workLocation" TEXT,
    "hazardsIdentified" JSONB NOT NULL DEFAULT '[]',
    "controlMeasures" JSONB NOT NULL DEFAULT '[]',
    "requiredPPE" JSONB NOT NULL DEFAULT '[]',
    "emergencyProcedures" TEXT,
    "emergencyContacts" JSONB DEFAULT '[]',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "rejectedById" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "activatedById" INTEGER,
    "activatedAt" TIMESTAMP(3),
    "suspendedById" INTEGER,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "resumedById" INTEGER,
    "resumedAt" TIMESTAMP(3),
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "closeNotes" TEXT,
    "workCompletedSuccessfully" BOOLEAN,
    "finalVerificationChecklist" JSONB DEFAULT '[]',
    "finalVerifiedById" INTEGER,
    "finalVerifiedAt" TIMESTAMP(3),
    "ppeVerifiedById" INTEGER,
    "ppeVerifiedAt" TIMESTAMP(3),
    "signatures" JSONB DEFAULT '[]',
    "attachments" JSONB DEFAULT '[]',
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permits_to_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loto_executions" (
    "id" SERIAL NOT NULL,
    "procedureId" INTEGER NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "ptwId" INTEGER,
    "status" "LOTOStatus" NOT NULL DEFAULT 'LOCKED',
    "lockedById" INTEGER NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockDetails" JSONB NOT NULL DEFAULT '[]',
    "zeroEnergyVerified" BOOLEAN NOT NULL DEFAULT false,
    "zeroEnergyVerifiedById" INTEGER,
    "zeroEnergyVerifiedAt" TIMESTAMP(3),
    "zeroEnergyVerificationPhoto" TEXT,
    "zeroEnergyChecklist" JSONB DEFAULT '[]',
    "unlockedById" INTEGER,
    "unlockedAt" TIMESTAMP(3),
    "unlockVerificationPhoto" TEXT,
    "workersAccountedFor" JSONB DEFAULT '[]',
    "notes" TEXT,
    "incidentsReported" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loto_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_failure_modes" (
    "id" SERIAL NOT NULL,
    "componentId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "category" TEXT,
    "symptoms" JSONB DEFAULT '[]',
    "causes" JSONB DEFAULT '[]',
    "effects" JSONB DEFAULT '[]',
    "detectability" INTEGER,
    "severity" INTEGER,
    "occurrence" INTEGER,
    "rpn" INTEGER,
    "recommendedActions" JSONB DEFAULT '[]',
    "preventiveMeasures" TEXT,
    "predictiveIndicators" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_failure_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "certifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "certificationDoc" TEXT,
    "verifiedById" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_certifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "status" "CertificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_skill_requirements" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "checklistId" INTEGER,
    "machineId" INTEGER,
    "maintenanceType" TEXT,
    "ptwType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_skill_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_counters" (
    "id" SERIAL NOT NULL,
    "machineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastReadingAt" TIMESTAMP(3),
    "lastReadingById" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machine_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_counter_readings" (
    "id" SERIAL NOT NULL,
    "counterId" INTEGER NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "previousValue" DECIMAL(65,30),
    "delta" DECIMAL(65,30),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,

    CONSTRAINT "machine_counter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_maintenance_triggers" (
    "id" SERIAL NOT NULL,
    "counterId" INTEGER NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "triggerEvery" DECIMAL(65,30) NOT NULL,
    "lastTriggeredValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "nextTriggerValue" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counter_maintenance_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_of_change" (
    "id" SERIAL NOT NULL,
    "mocNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "changeType" "MOCChangeType" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MOCStatus" NOT NULL DEFAULT 'DRAFT',
    "justification" TEXT,
    "scope" TEXT,
    "impactAssessment" TEXT,
    "riskAssessment" TEXT,
    "requestedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "machineId" INTEGER,
    "componentId" INTEGER,
    "areaId" INTEGER,
    "sectorId" INTEGER,
    "requestedById" INTEGER NOT NULL,
    "reviewedById" INTEGER,
    "approvedById" INTEGER,
    "implementedById" INTEGER,
    "approvalDate" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "temporaryUntil" TIMESTAMP(3),
    "requiresTraining" BOOLEAN NOT NULL DEFAULT false,
    "trainingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "management_of_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moc_documents" (
    "id" SERIAL NOT NULL,
    "mocId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "documentType" TEXT,
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moc_history" (
    "id" SERIAL NOT NULL,
    "mocId" INTEGER NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "moc_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moc_tasks" (
    "id" SERIAL NOT NULL,
    "mocId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedToId" INTEGER,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "notes" TEXT,

    CONSTRAINT "moc_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_shifts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_centers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "parentId" INTEGER,
    "theoreticalCapacity" DECIMAL(12,4),
    "capacityUnit" TEXT,
    "standardCycleSeconds" INTEGER,
    "standardSetupMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "machineId" INTEGER,
    "lineId" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_reason_codes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" INTEGER,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "triggersMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "affectsOEE" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_reason_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "recipeId" TEXT,
    "plannedQuantity" DECIMAL(12,4) NOT NULL,
    "producedQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "scrapQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reworkQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "targetUom" TEXT NOT NULL,
    "plannedCycleTimeSec" INTEGER,
    "plannedSetupMinutes" INTEGER,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "workCenterId" INTEGER,
    "sectorId" INTEGER,
    "responsibleId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_production_reports" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "productionOrderId" INTEGER,
    "workCenterId" INTEGER,
    "operatorId" INTEGER NOT NULL,
    "supervisorId" INTEGER,
    "teamSize" INTEGER,
    "crewMembers" JSONB,
    "goodQuantity" DECIMAL(12,4) NOT NULL,
    "scrapQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reworkQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL,
    "variantBreakdown" JSONB,
    "shiftDurationMinutes" INTEGER NOT NULL,
    "productiveMinutes" INTEGER NOT NULL,
    "downtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "setupMinutes" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "issues" TEXT,
    "attachmentUrls" JSONB,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewNotes" TEXT,
    "offlineId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_production_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_downtimes" (
    "id" SERIAL NOT NULL,
    "dailyReportId" INTEGER,
    "productionOrderId" INTEGER,
    "shiftId" INTEGER,
    "workCenterId" INTEGER,
    "machineId" INTEGER,
    "type" TEXT NOT NULL,
    "reasonCodeId" INTEGER,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "affectsLine" BOOLEAN NOT NULL DEFAULT true,
    "isMicrostop" BOOLEAN NOT NULL DEFAULT false,
    "detectedBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "workOrderId" INTEGER,
    "failureOccurrenceId" INTEGER,
    "qualityHoldId" INTEGER,
    "reportedById" INTEGER NOT NULL,
    "offlineId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_quality_controls" (
    "id" SERIAL NOT NULL,
    "dailyReportId" INTEGER,
    "productionOrderId" INTEGER,
    "batchLotId" INTEGER,
    "controlType" TEXT NOT NULL,
    "parameter" TEXT,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "unit" TEXT,
    "result" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "inspectedById" INTEGER NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "attachmentUrls" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_quality_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_defects" (
    "id" SERIAL NOT NULL,
    "dailyReportId" INTEGER,
    "productionOrderId" INTEGER,
    "batchLotId" INTEGER,
    "reasonCodeId" INTEGER NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "uom" TEXT NOT NULL,
    "disposition" TEXT NOT NULL DEFAULT 'SCRAP',
    "description" TEXT,
    "attachmentUrls" JSONB,
    "reportedById" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batch_lots" (
    "id" SERIAL NOT NULL,
    "lotCode" TEXT NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "uom" TEXT NOT NULL,
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "blockedAt" TIMESTAMP(3),
    "blockedById" INTEGER,
    "releasedAt" TIMESTAMP(3),
    "releasedById" INTEGER,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "rawMaterialLots" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_batch_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_events" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,
    "performedById" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productionOrderId" INTEGER,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "production_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_routine_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "workCenterId" INTEGER,
    "sectorId" INTEGER,
    "items" JSONB NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'EVERY_SHIFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_routine_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_routines" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "workCenterId" INTEGER,
    "shiftId" INTEGER,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responses" JSONB NOT NULL,
    "hasIssues" BOOLEAN NOT NULL DEFAULT false,
    "issueDescription" TEXT,
    "linkedDowntimeId" INTEGER,
    "linkedWorkOrderId" INTEGER,
    "executedById" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" INTEGER NOT NULL,

    CONSTRAINT "production_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_resource_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "uomCode" TEXT,
    "attributesSchema" JSONB,
    "config" JSONB,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_resource_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_resources" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceTypeId" INTEGER NOT NULL,
    "workCenterId" INTEGER,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestressed_molds" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moldType" TEXT NOT NULL,
    "lengthMeters" DECIMAL(8,2) NOT NULL,
    "widthMeters" DECIMAL(8,2) NOT NULL,
    "maxCables" INTEGER NOT NULL,
    "maxTensionKN" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "currentOrderId" INTEGER,
    "workCenterId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestressed_molds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curing_records" (
    "id" SERIAL NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "moldId" INTEGER NOT NULL,
    "batchLotId" INTEGER,
    "castingDateTime" TIMESTAMP(3) NOT NULL,
    "curingStartDateTime" TIMESTAMP(3),
    "curingEndDateTime" TIMESTAMP(3),
    "demoldingDateTime" TIMESTAMP(3),
    "ambientTemp" DECIMAL(5,2),
    "concreteTemp" DECIMAL(5,2),
    "humidity" DECIMAL(5,2),
    "steamCuringUsed" BOOLEAN NOT NULL DEFAULT false,
    "steamTemp" DECIMAL(5,2),
    "targetStrengthMPa" DECIMAL(8,2),
    "actualStrengthMPa" DECIMAL(8,2),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_purchase_logs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordMessageId" TEXT NOT NULL,
    "discordAttachmentId" TEXT NOT NULL,
    "discordChannelId" TEXT,
    "audioUrl" TEXT,
    "audioHash" TEXT,
    "transcript" TEXT,
    "extractedData" JSONB,
    "confidence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "purchaseRequestId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "voice_purchase_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_failure_logs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordMessageId" TEXT NOT NULL,
    "discordAttachmentId" TEXT,
    "discordChannelId" TEXT,
    "audioUrl" TEXT,
    "audioHash" TEXT,
    "audioSize" INTEGER,
    "mimeType" VARCHAR(50),
    "transcript" TEXT,
    "extractedData" JSONB,
    "confidence" INTEGER,
    "machineMatchedId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureOccurrenceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queuedAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "voice_failure_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_purchase_orders" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "frecuencia" "RecurringFrequency" NOT NULL DEFAULT 'MENSUAL',
    "diaSemana" INTEGER,
    "diaMes" INTEGER,
    "horaEjecucion" INTEGER NOT NULL DEFAULT 8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "proximaEjecucion" TIMESTAMP(3),
    "ultimaEjecucion" TIMESTAMP(3),
    "totalEjecuciones" INTEGER NOT NULL DEFAULT 0,
    "tituloPedido" VARCHAR(200) NOT NULL,
    "prioridad" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "departamento" VARCHAR(100),
    "diasParaNecesidad" INTEGER NOT NULL DEFAULT 7,
    "notas" TEXT,
    "creadorId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_purchase_items" (
    "id" SERIAL NOT NULL,
    "recurringOrderId" INTEGER NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "especificaciones" TEXT,

    CONSTRAINT "recurring_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_purchase_history" (
    "id" SERIAL NOT NULL,
    "recurringOrderId" INTEGER NOT NULL,
    "purchaseRequestId" INTEGER,
    "fechaEjecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,

    CONSTRAINT "recurring_purchase_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_tasks" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AgendaTaskStatus" NOT NULL DEFAULT 'PENDING',
    "category" VARCHAR(100),
    "createdById" INTEGER NOT NULL,
    "assignedToUserId" INTEGER,
    "assignedToContactId" INTEGER,
    "assignedToName" VARCHAR(200),
    "source" "TaskSource" NOT NULL DEFAULT 'WEB',
    "discordMessageId" TEXT,
    "companyId" INTEGER NOT NULL,
    "notes" JSONB,
    "completedAt" TIMESTAMP(3),
    "completedNote" TEXT,
    "reminder15MinSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_reminders" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "notifyVia" "NotificationChannel"[] DEFAULT ARRAY['DISCORD']::"NotificationChannel"[],
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "taskId" INTEGER,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_task_logs" (
    "id" SERIAL NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordMessageId" TEXT NOT NULL,
    "discordAttachmentId" TEXT,
    "discordChannelId" TEXT,
    "audioUrl" TEXT,
    "audioHash" TEXT,
    "transcription" TEXT,
    "status" "VoiceLogStatus" NOT NULL DEFAULT 'PENDING',
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "taskId" INTEGER,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "voice_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" SERIAL NOT NULL,
    "supplierItemId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadConsumida" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "estado" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVA',
    "tipo" "StockReservationType" NOT NULL,
    "materialRequestId" INTEGER,
    "productionOrderId" INTEGER,
    "workOrderId" INTEGER,
    "fechaReserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaExpiracion" TIMESTAMP(3),
    "motivo" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requests" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "MaterialRequestType" NOT NULL,
    "estado" "MaterialRequestStatus" NOT NULL DEFAULT 'BORRADOR',
    "urgencia" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "workOrderId" INTEGER,
    "productionOrderId" INTEGER,
    "proyectoId" INTEGER,
    "solicitanteId" INTEGER NOT NULL,
    "destinatarioId" INTEGER,
    "warehouseId" INTEGER,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaNecesidad" TIMESTAMP(3),
    "fechaAprobacion" TIMESTAMP(3),
    "aprobadoPor" INTEGER,
    "motivo" TEXT,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_items" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "supplierItemId" INTEGER,
    "toolId" INTEGER,
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadAprobada" DECIMAL(15,4),
    "cantidadReservada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "cantidadDespachada" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "unidad" VARCHAR(50) NOT NULL,
    "notas" TEXT,

    CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despachos" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "DespachoType" NOT NULL,
    "estado" "DespachoStatus" NOT NULL DEFAULT 'BORRADOR',
    "materialRequestId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "productionOrderId" INTEGER,
    "destinatarioId" INTEGER,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDespacho" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3),
    "despachadorId" INTEGER NOT NULL,
    "receptorId" INTEGER,
    "firmaUrl" VARCHAR(500),
    "firmaHash" VARCHAR(64),
    "firmadoAt" TIMESTAMP(3),
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despachos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despacho_items" (
    "id" SERIAL NOT NULL,
    "despachoId" INTEGER NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "supplierItemId" INTEGER,
    "toolId" INTEGER,
    "stockLocationId" INTEGER,
    "lote" VARCHAR(100),
    "cantidadSolicitada" DECIMAL(15,4) NOT NULL,
    "cantidadDespachada" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "costoUnitario" DECIMAL(15,4),
    "costoTotal" DECIMAL(15,2),
    "metodoAsignacion" VARCHAR(20),
    "notas" TEXT,
    "stockMovementId" INTEGER,
    "toolMovementId" INTEGER,

    CONSTRAINT "despacho_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_material" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "tipo" "DevolucionType" NOT NULL,
    "estado" "DevolucionStatus" NOT NULL DEFAULT 'BORRADOR',
    "despachoOrigenId" INTEGER,
    "warehouseId" INTEGER NOT NULL,
    "devolvienteId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "notas" TEXT,
    "fechaDevolucion" TIMESTAMP(3),
    "recibidoPor" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devoluciones_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_material_items" (
    "id" SERIAL NOT NULL,
    "devolucionId" INTEGER NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "supplierItemId" INTEGER,
    "toolId" INTEGER,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "estadoItem" VARCHAR(50),
    "stockMovementId" INTEGER,

    CONSTRAINT "devolucion_material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_warehouse_scopes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canOperate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_warehouse_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_stock_configs" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "defaultWarehouseId" INTEGER,
    "stockConsumptionMode" "StockConsumptionMode" NOT NULL DEFAULT 'ON_REPORT',
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "reserveOnRelease" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_stock_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_notifications" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "data" JSONB NOT NULL DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "compras_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_levels" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverIds" INTEGER[],
    "escalationHours" INTEGER,
    "requireAll" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "approval_workflow_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "delegatorId" INTEGER NOT NULL,
    "delegateeId" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "tipo" "ServiceContractType" NOT NULL,
    "estado" "ServiceContractStatus" NOT NULL DEFAULT 'BORRADOR',
    "proveedorId" INTEGER NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "diasAviso" INTEGER NOT NULL DEFAULT 30,
    "renovacionAuto" BOOLEAN NOT NULL DEFAULT false,
    "montoTotal" DECIMAL(15,2),
    "frecuenciaPago" "ServicePaymentFrequency" NOT NULL DEFAULT 'MENSUAL',
    "montoPeriodo" DECIMAL(15,2),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "machineId" INTEGER,
    "polizaNumero" VARCHAR(100),
    "aseguradora" VARCHAR(200),
    "cobertura" TEXT,
    "sumaAsegurada" DECIMAL(15,2),
    "deducible" DECIMAL(15,2),
    "franquicia" DECIMAL(15,2),
    "contactoNombre" VARCHAR(200),
    "contactoTelefono" VARCHAR(50),
    "contactoEmail" VARCHAR(200),
    "documentos" JSONB,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_payments" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "periodoDesde" DATE NOT NULL,
    "periodoHasta" DATE NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaVencimiento" DATE NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "facturaId" INTEGER,
    "notas" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_contract_alerts" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fechaAlerta" TIMESTAMP(3) NOT NULL,
    "enviada" BOOLEAN NOT NULL DEFAULT false,
    "enviadaAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_contract_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "docType" VARCHAR(50) NOT NULL,
    "puntoVenta" VARCHAR(5),
    "prefix" VARCHAR(10) NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_block_history" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "tipoBloqueo" VARCHAR(50) NOT NULL,
    "motivo" TEXT,
    "montoExcedido" DECIMAL(15,2),
    "facturaRef" VARCHAR(100),
    "diasMora" INTEGER,
    "bloqueadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloqueadoPor" INTEGER NOT NULL,
    "desbloqueadoAt" TIMESTAMP(3),
    "desbloqueadoPor" INTEGER,
    "motivoDesbloqueo" TEXT,

    CONSTRAINT "client_block_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100),
    "entityId" INTEGER,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_movements" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaValor" DATE,
    "tipo" "TreasuryMovementType" NOT NULL,
    "medio" "PaymentMedium" NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "accountType" "TreasuryAccountType" NOT NULL,
    "cashAccountId" INTEGER,
    "bankAccountId" INTEGER,
    "referenceType" VARCHAR(50),
    "referenceId" INTEGER,
    "chequeId" INTEGER,
    "descripcion" TEXT,
    "numeroComprobante" VARCHAR(100),
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "estado" "TreasuryMovementStatus" NOT NULL DEFAULT 'CONFIRMADO',
    "reversaDeId" INTEGER,
    "reversadoPorId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "comprobanteUrl" TEXT,

    CONSTRAINT "treasury_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_orders" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "LoadOrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "saleId" INTEGER NOT NULL,
    "deliveryId" INTEGER,
    "vehiculo" VARCHAR(100),
    "vehiculoPatente" VARCHAR(20),
    "chofer" VARCHAR(255),
    "choferDNI" VARCHAR(20),
    "pesoTotal" DECIMAL(15,4),
    "volumenTotal" DECIMAL(15,4),
    "observaciones" TEXT,
    "confirmadoAt" TIMESTAMP(3),
    "confirmadoPor" INTEGER,
    "firmaOperario" TEXT,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_order_items" (
    "id" SERIAL NOT NULL,
    "loadOrderId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "productId" TEXT,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "cantidadCargada" DECIMAL(15,4),
    "secuencia" INTEGER NOT NULL DEFAULT 0,
    "posicion" VARCHAR(50),
    "pesoUnitario" DECIMAL(15,4),
    "volumenUnitario" DECIMAL(15,4),
    "motivoDiferencia" TEXT,

    CONSTRAINT "load_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_deposits" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "DepositStatus" NOT NULL DEFAULT 'PENDIENTE',
    "cashAccountId" INTEGER NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "efectivo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cheques" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "numeroComprobante" VARCHAR(100),
    "comprobanteUrl" TEXT,
    "chequeIds" TEXT,
    "egresoMovementId" INTEGER,
    "ingresoMovementId" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "confirmedBy" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closings" (
    "id" SERIAL NOT NULL,
    "cashAccountId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "saldoSistemaEfectivo" DECIMAL(15,2) NOT NULL,
    "saldoSistemaCheques" DECIMAL(15,2) NOT NULL,
    "saldoSistemaTotal" DECIMAL(15,2) NOT NULL,
    "arqueoEfectivo" DECIMAL(15,2) NOT NULL,
    "arqueoCheques" DECIMAL(15,2) NOT NULL,
    "arqueoTotal" DECIMAL(15,2) NOT NULL,
    "desglose" JSONB,
    "diferencia" DECIMAL(15,2) NOT NULL,
    "diferenciaNotas" TEXT,
    "ajusteMovementId" INTEGER,
    "estado" "CashClosingStatus" NOT NULL DEFAULT 'PENDIENTE',
    "aprobadoPor" INTEGER,
    "aprobadoAt" TIMESTAMP(3),
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" SERIAL NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "fechaImportacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivoOriginal" TEXT,
    "saldoInicial" DECIMAL(15,2) NOT NULL,
    "totalDebitos" DECIMAL(15,2) NOT NULL,
    "totalCreditos" DECIMAL(15,2) NOT NULL,
    "saldoFinal" DECIMAL(15,2) NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "itemsConciliados" INTEGER NOT NULL DEFAULT 0,
    "itemsPendientes" INTEGER NOT NULL DEFAULT 0,
    "itemsSuspense" INTEGER NOT NULL DEFAULT 0,
    "estado" "ReconciliationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "cerradoAt" TIMESTAMP(3),
    "cerradoPor" INTEGER,
    "toleranciaMonto" DECIMAL(15,2) NOT NULL DEFAULT 0.01,
    "toleranciaDias" INTEGER NOT NULL DEFAULT 3,
    "docType" "DocType" NOT NULL DEFAULT 'T1',
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_items" (
    "id" SERIAL NOT NULL,
    "statementId" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fechaValor" DATE,
    "descripcion" TEXT NOT NULL,
    "referencia" VARCHAR(100),
    "debito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(15,2) NOT NULL,
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "treasuryMovementId" INTEGER,
    "conciliadoAt" TIMESTAMP(3),
    "conciliadoBy" INTEGER,
    "matchType" "MatchType",
    "matchConfidence" DOUBLE PRECISION,
    "esSuspense" BOOLEAN NOT NULL DEFAULT false,
    "suspenseNotas" TEXT,
    "suspenseResuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bank_statement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_slots" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "capacidadMaxima" INTEGER NOT NULL DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_reservations" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "estado" "PickupStatus" NOT NULL DEFAULT 'RESERVADO',
    "observaciones" TEXT,
    "retiroNombre" VARCHAR(255),
    "retiroDNI" VARCHAR(20),
    "retiroVehiculo" VARCHAR(100),
    "retiroFecha" TIMESTAMP(3),
    "llegadaAt" TIMESTAMP(3),
    "inicioAt" TIMESTAMP(3),
    "finAt" TIMESTAMP(3),
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "afip_config" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "cuit" VARCHAR(11) NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "domicilioFiscal" TEXT NOT NULL,
    "certificadoPath" TEXT,
    "privateKeyPath" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "ambiente" "AfipAmbiente" NOT NULL DEFAULT 'TESTING',
    "wsaaUrl" TEXT,
    "wsfeUrl" TEXT,
    "puntosVenta" JSONB NOT NULL,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelaySeconds" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "afip_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "PricingRuleType" NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "productId" TEXT,
    "priceListId" INTEGER,
    "cantidadMinima" DECIMAL(15,4),
    "cantidadMaxima" DECIMAL(15,4),
    "montoMinimo" DECIMAL(15,2),
    "montoMaximo" DECIMAL(15,2),
    "accion" "PricingAction" NOT NULL,
    "valor" DECIMAL(15,4) NOT NULL,
    "aplicaSobre" "PricingBase" NOT NULL DEFAULT 'PRECIO_LISTA',
    "validFrom" DATE,
    "validUntil" DATE,
    "requiereAprobacion" BOOLEAN NOT NULL DEFAULT false,
    "aprobadoPor" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_actions" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" INTEGER,
    "tipo" "CollectionActionType" NOT NULL,
    "estado" "CollectionActionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "contactoNombre" TEXT,
    "contactoTelefono" TEXT,
    "contactoEmail" TEXT,
    "resultado" TEXT,
    "proximaAccion" DATE,
    "promesaPago" DATE,
    "promesaMonto" DECIMAL(15,2),
    "asignadoA" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_disputes" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" INTEGER,
    "deliveryId" INTEGER,
    "tipo" "DisputeType" NOT NULL,
    "estado" "DisputeStatus" NOT NULL DEFAULT 'ABIERTA',
    "descripcion" TEXT NOT NULL,
    "montoDisputa" DECIMAL(15,2),
    "resolucion" "DisputeResolution",
    "resolucionNotas" TEXT,
    "resolucionPor" INTEGER,
    "resolucionAt" TIMESTAMP(3),
    "creditNoteId" INTEGER,
    "companyId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OwnedCompanies" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_OwnedCompanies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_cuit_key" ON "Company"("cuit");

-- CreateIndex
CREATE INDEX "Company_subscriptionId_idx" ON "Company"("subscriptionId");

-- CreateIndex
CREATE INDEX "Company_primaryAdminId_idx" ON "Company"("primaryAdminId");

-- CreateIndex
CREATE INDEX "Company_templateId_idx" ON "Company"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE INDEX "UserOnCompany_companyId_isActive_idx" ON "UserOnCompany"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "UserOnCompany_companyId_roleId_idx" ON "UserOnCompany"("companyId", "roleId");

-- CreateIndex
CREATE INDEX "UserOnCompany_joinedAt_idx" ON "UserOnCompany"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnCompany_userId_companyId_key" ON "UserOnCompany"("userId", "companyId");

-- CreateIndex
CREATE INDEX "UserDiscordAccess_sectorId_idx" ON "UserDiscordAccess"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDiscordAccess_userId_sectorId_key" ON "UserDiscordAccess"("userId", "sectorId");

-- CreateIndex
CREATE INDEX "PlantZone_sectorId_idx" ON "PlantZone"("sectorId");

-- CreateIndex
CREATE INDEX "PlantZone_companyId_idx" ON "PlantZone"("companyId");

-- CreateIndex
CREATE INDEX "PlantZone_parentId_idx" ON "PlantZone"("parentId");

-- CreateIndex
CREATE INDEX "UnidadMovil_companyId_idx" ON "UnidadMovil"("companyId");

-- CreateIndex
CREATE INDEX "UnidadMovil_companyId_estado_idx" ON "UnidadMovil"("companyId", "estado");

-- CreateIndex
CREATE INDEX "UnidadMovil_companyId_sectorId_idx" ON "UnidadMovil"("companyId", "sectorId");

-- CreateIndex
CREATE INDEX "UnidadMovil_companyId_tipo_idx" ON "UnidadMovil"("companyId", "tipo");

-- CreateIndex
CREATE INDEX "UnidadMovil_proximoMantenimiento_idx" ON "UnidadMovil"("proximoMantenimiento");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadMovil_companyId_patente_key" ON "UnidadMovil"("companyId", "patente");

-- CreateIndex
CREATE INDEX "KilometrajeLog_unidadMovilId_fecha_idx" ON "KilometrajeLog"("unidadMovilId", "fecha");

-- CreateIndex
CREATE INDEX "KilometrajeLog_companyId_fecha_idx" ON "KilometrajeLog"("companyId", "fecha");

-- CreateIndex
CREATE INDEX "Machine_companyId_idx" ON "Machine"("companyId");

-- CreateIndex
CREATE INDEX "Machine_sectorId_idx" ON "Machine"("sectorId");

-- CreateIndex
CREATE INDEX "Machine_companyId_sectorId_idx" ON "Machine"("companyId", "sectorId");

-- CreateIndex
CREATE INDEX "Machine_companyId_status_idx" ON "Machine"("companyId", "status");

-- CreateIndex
CREATE INDEX "Machine_areaId_idx" ON "Machine"("areaId");

-- CreateIndex
CREATE INDEX "Machine_plantZoneId_idx" ON "Machine"("plantZoneId");

-- CreateIndex
CREATE INDEX "Machine_status_idx" ON "Machine"("status");

-- CreateIndex
CREATE INDEX "Machine_healthScore_idx" ON "Machine"("healthScore");

-- CreateIndex
CREATE INDEX "Machine_criticalityScore_idx" ON "Machine"("criticalityScore");

-- CreateIndex
CREATE UNIQUE INDEX "machine_import_jobs_machineId_key" ON "machine_import_jobs"("machineId");

-- CreateIndex
CREATE INDEX "machine_import_jobs_companyId_idx" ON "machine_import_jobs"("companyId");

-- CreateIndex
CREATE INDEX "machine_import_jobs_status_idx" ON "machine_import_jobs"("status");

-- CreateIndex
CREATE INDEX "machine_import_jobs_createdById_idx" ON "machine_import_jobs"("createdById");

-- CreateIndex
CREATE INDEX "machine_import_jobs_lockedAt_idx" ON "machine_import_jobs"("lockedAt");

-- CreateIndex
CREATE INDEX "machine_import_files_importJobId_idx" ON "machine_import_files"("importJobId");

-- CreateIndex
CREATE INDEX "machine_import_files_sha256_idx" ON "machine_import_files"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "machine_import_file_analyses_fileId_key" ON "machine_import_file_analyses"("fileId");

-- CreateIndex
CREATE INDEX "machine_import_file_analyses_importJobId_idx" ON "machine_import_file_analyses"("importJobId");

-- CreateIndex
CREATE INDEX "Component_machineId_idx" ON "Component"("machineId");

-- CreateIndex
CREATE INDEX "Component_parentId_idx" ON "Component"("parentId");

-- CreateIndex
CREATE INDEX "Component_machineId_parentId_idx" ON "Component"("machineId", "parentId");

-- CreateIndex
CREATE INDEX "Component_createdAt_idx" ON "Component"("createdAt");

-- CreateIndex
CREATE INDEX "Component_system_idx" ON "Component"("system");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_code_key" ON "Tool"("code");

-- CreateIndex
CREATE INDEX "spare_part_reservations_workOrderId_idx" ON "spare_part_reservations"("workOrderId");

-- CreateIndex
CREATE INDEX "spare_part_reservations_toolId_idx" ON "spare_part_reservations"("toolId");

-- CreateIndex
CREATE INDEX "spare_part_reservations_companyId_status_idx" ON "spare_part_reservations"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ToolMachine_toolId_machineId_key" ON "ToolMachine"("toolId", "machineId");

-- CreateIndex
CREATE INDEX "ComponentTool_kitId_idx" ON "ComponentTool"("kitId");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentTool_componentId_toolId_key" ON "ComponentTool"("componentId", "toolId");

-- CreateIndex
CREATE INDEX "intervention_kits_companyId_isActive_idx" ON "intervention_kits"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SectorTool_sectorId_toolId_key" ON "SectorTool"("sectorId", "toolId");

-- CreateIndex
CREATE INDEX "inventory_item_suppliers_toolId_idx" ON "inventory_item_suppliers"("toolId");

-- CreateIndex
CREATE INDEX "inventory_item_suppliers_companyId_isPreferred_idx" ON "inventory_item_suppliers"("companyId", "isPreferred");

-- CreateIndex
CREATE INDEX "inventory_lots_companyId_status_idx" ON "inventory_lots"("companyId", "status");

-- CreateIndex
CREATE INDEX "inventory_lots_expiresAt_idx" ON "inventory_lots"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_toolId_lotNumber_companyId_key" ON "inventory_lots"("toolId", "lotNumber", "companyId");

-- CreateIndex
CREATE INDEX "lot_installations_machineId_removedAt_idx" ON "lot_installations"("machineId", "removedAt");

-- CreateIndex
CREATE INDEX "lot_installations_lotId_idx" ON "lot_installations"("lotId");

-- CreateIndex
CREATE INDEX "lot_installations_companyId_idx" ON "lot_installations"("companyId");

-- CreateIndex
CREATE INDEX "work_orders_origin_idx" ON "work_orders"("origin");

-- CreateIndex
CREATE INDEX "work_orders_waitingReason_idx" ON "work_orders"("waitingReason");

-- CreateIndex
CREATE INDEX "work_orders_isSafetyRelated_idx" ON "work_orders"("isSafetyRelated");

-- CreateIndex
CREATE INDEX "work_orders_companyId_status_idx" ON "work_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "work_orders_companyId_type_idx" ON "work_orders"("companyId", "type");

-- CreateIndex
CREATE INDEX "work_orders_companyId_createdAt_idx" ON "work_orders"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "work_orders_companyId_completedDate_idx" ON "work_orders"("companyId", "completedDate");

-- CreateIndex
CREATE INDEX "work_orders_machineId_type_idx" ON "work_orders"("machineId", "type");

-- CreateIndex
CREATE INDEX "work_orders_sectorId_status_idx" ON "work_orders"("sectorId", "status");

-- CreateIndex
CREATE INDEX "work_orders_companyId_assignedToId_status_idx" ON "work_orders"("companyId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "work_orders_companyId_priority_status_idx" ON "work_orders"("companyId", "priority", "status");

-- CreateIndex
CREATE INDEX "work_orders_companyId_slaDueAt_idx" ON "work_orders"("companyId", "slaDueAt");

-- CreateIndex
CREATE INDEX "work_orders_companyId_scheduledDate_status_idx" ON "work_orders"("companyId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "idx_failures_machine_id" ON "failures"("machine_id");

-- CreateIndex
CREATE INDEX "idx_failures_reported_date" ON "failures"("reported_date");

-- CreateIndex
CREATE INDEX "idx_failures_status" ON "failures"("status");

-- CreateIndex
CREATE INDEX "failures_companyId_idx" ON "failures"("companyId");

-- CreateIndex
CREATE INDEX "failure_occurrences_failureId_idx" ON "failure_occurrences"("failureId");

-- CreateIndex
CREATE INDEX "failure_occurrences_failureTypeId_idx" ON "failure_occurrences"("failureTypeId");

-- CreateIndex
CREATE INDEX "failure_occurrences_machineId_idx" ON "failure_occurrences"("machineId");

-- CreateIndex
CREATE INDEX "failure_occurrences_status_idx" ON "failure_occurrences"("status");

-- CreateIndex
CREATE INDEX "failure_occurrences_reportedAt_idx" ON "failure_occurrences"("reportedAt");

-- CreateIndex
CREATE INDEX "failure_occurrences_linkedToOccurrenceId_idx" ON "failure_occurrences"("linkedToOccurrenceId");

-- CreateIndex
CREATE INDEX "failure_occurrences_isLinkedDuplicate_idx" ON "failure_occurrences"("isLinkedDuplicate");

-- CreateIndex
CREATE INDEX "failure_occurrences_isIntermittent_idx" ON "failure_occurrences"("isIntermittent");

-- CreateIndex
CREATE INDEX "failure_occurrences_causedDowntime_idx" ON "failure_occurrences"("causedDowntime");

-- CreateIndex
CREATE INDEX "failure_occurrences_companyId_status_reportedAt_idx" ON "failure_occurrences"("companyId", "status", "reportedAt");

-- CreateIndex
CREATE INDEX "failure_occurrences_companyId_machineId_status_idx" ON "failure_occurrences"("companyId", "machineId", "status");

-- CreateIndex
CREATE INDEX "failure_occurrences_companyId_machineId_subcomponentId_repo_idx" ON "failure_occurrences"("companyId", "machineId", "subcomponentId", "reportedAt");

-- CreateIndex
CREATE INDEX "failure_occurrences_companyId_isLinkedDuplicate_status_idx" ON "failure_occurrences"("companyId", "isLinkedDuplicate", "status");

-- CreateIndex
CREATE INDEX "failure_occurrences_companyId_isLinkedDuplicate_priority_st_idx" ON "failure_occurrences"("companyId", "isLinkedDuplicate", "priority", "status");

-- CreateIndex
CREATE INDEX "failure_occurrences_companyId_reopenedFrom_idx" ON "failure_occurrences"("companyId", "reopenedFrom");

-- CreateIndex
CREATE INDEX "failure_solutions_occurrenceId_idx" ON "failure_solutions"("occurrenceId");

-- CreateIndex
CREATE INDEX "failure_solutions_appliedById_idx" ON "failure_solutions"("appliedById");

-- CreateIndex
CREATE INDEX "failure_solutions_isPreferred_idx" ON "failure_solutions"("isPreferred");

-- CreateIndex
CREATE INDEX "solution_applications_failureSolutionId_idx" ON "solution_applications"("failureSolutionId");

-- CreateIndex
CREATE INDEX "solution_applications_workOrderId_idx" ON "solution_applications"("workOrderId");

-- CreateIndex
CREATE INDEX "solution_applications_occurrenceId_idx" ON "solution_applications"("occurrenceId");

-- CreateIndex
CREATE INDEX "solution_applications_appliedById_idx" ON "solution_applications"("appliedById");

-- CreateIndex
CREATE INDEX "solution_applications_appliedAt_idx" ON "solution_applications"("appliedAt");

-- CreateIndex
CREATE INDEX "WorkOrderComment_workOrderId_idx" ON "WorkOrderComment"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderAttachment_workOrderId_idx" ON "WorkOrderAttachment"("workOrderId");

-- CreateIndex
CREATE INDEX "Document_entityType_idx" ON "Document"("entityType");

-- CreateIndex
CREATE INDEX "Document_entityType_companyId_idx" ON "Document"("entityType", "companyId");

-- CreateIndex
CREATE INDEX "Document_companyId_idx" ON "Document"("companyId");

-- CreateIndex
CREATE INDEX "Document_folder_idx" ON "Document"("folder");

-- CreateIndex
CREATE INDEX "Notification_userId_companyId_readAt_idx" ON "Notification"("userId", "companyId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_companyId_createdAt_idx" ON "Notification"("userId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_companyId_readAt_idx" ON "Notification"("companyId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_companyId_createdAt_idx" ON "PermissionAuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_targetType_targetId_idx" ON "PermissionAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_performedById_idx" ON "PermissionAuditLog"("performedById");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_companyId_name_key" ON "Category"("companyId", "name");

-- CreateIndex
CREATE INDEX "Product_costType_idx" ON "Product"("costType");

-- CreateIndex
CREATE INDEX "Product_recipeId_idx" ON "Product"("recipeId");

-- CreateIndex
CREATE INDEX "Product_purchaseInputId_idx" ON "Product"("purchaseInputId");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_companyId_isActive_idx" ON "Product"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_code_key" ON "Product"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProductCostLog_productId_idx" ON "ProductCostLog"("productId");

-- CreateIndex
CREATE INDEX "ProductCostLog_companyId_createdAt_idx" ON "ProductCostLog"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProductCostLog_changeSource_idx" ON "ProductCostLog"("changeSource");

-- CreateIndex
CREATE INDEX "product_stock_movements_productId_idx" ON "product_stock_movements"("productId");

-- CreateIndex
CREATE INDEX "product_stock_movements_companyId_createdAt_idx" ON "product_stock_movements"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkStation_code_key" ON "WorkStation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStation_name_sectorId_key" ON "WorkStation"("name", "sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStationMachine_workStationId_machineId_key" ON "WorkStationMachine"("workStationId", "machineId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStationComponent_workStationId_componentId_key" ON "WorkStationComponent"("workStationId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Line_companyId_code_key" ON "Line"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_key" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "InputItem_supplierItemId_idx" ON "InputItem"("supplierItemId");

-- CreateIndex
CREATE INDEX "InputPriceHistory_inputId_effectiveFrom_idx" ON "InputPriceHistory"("inputId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "InputPriceHistory_companyId_effectiveFrom_idx" ON "InputPriceHistory"("companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeCompHistory_employeeId_effectiveFrom_idx" ON "EmployeeCompHistory"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "MonthlyIndirect_companyId_month_idx" ON "MonthlyIndirect"("companyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "IndirectItem_companyId_code_key" ON "IndirectItem"("companyId", "code");

-- CreateIndex
CREATE INDEX "IndirectPriceHistory_indirectId_effectiveFrom_idx" ON "IndirectPriceHistory"("indirectId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "IndirectPriceHistory_companyId_effectiveFrom_idx" ON "IndirectPriceHistory"("companyId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalAllocation_category_lineId_key" ON "GlobalAllocation"("category", "lineId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_companyId_scopeType_scopeId_name_key" ON "Recipe"("companyId", "scopeType", "scopeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_recipeId_inputId_key" ON "RecipeItem"("recipeId", "inputId");

-- CreateIndex
CREATE UNIQUE INDEX "YieldConfig_productId_key" ON "YieldConfig"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PerUnitBOM_productId_inputId_key" ON "PerUnitBOM"("productId", "inputId");

-- CreateIndex
CREATE UNIQUE INDEX "VolumetricParam_productId_key" ON "VolumetricParam"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyProduction_productId_month_key" ON "MonthlyProduction"("productId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCostHistory_productId_month_method_key" ON "ProductCostHistory"("productId", "month", "method");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettingsCosting_companyId_key" ON "CompanySettingsCosting"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CostVarianceMonthly_productId_month_method_key" ON "CostVarianceMonthly"("productId", "month", "method");

-- CreateIndex
CREATE UNIQUE INDEX "FactPnLMonthly_companyId_month_key" ON "FactPnLMonthly"("companyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FactPurchasesMonthly_companyId_month_key" ON "FactPurchasesMonthly"("companyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FactSalesMonthly_companyId_month_key" ON "FactSalesMonthly"("companyId", "month");

-- CreateIndex
CREATE INDEX "IndirectItemAllocation_companyId_itemId_idx" ON "IndirectItemAllocation"("companyId", "itemId");

-- CreateIndex
CREATE INDEX "IndirectItemAllocation_itemId_idx" ON "IndirectItemAllocation"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "IndirectItemAllocation_companyId_itemId_lineId_key" ON "IndirectItemAllocation"("companyId", "itemId", "lineId");

-- CreateIndex
CREATE INDEX "IndirectItemAllocationMonthly_companyId_month_idx" ON "IndirectItemAllocationMonthly"("companyId", "month");

-- CreateIndex
CREATE INDEX "IndirectItemAllocationMonthly_itemId_month_idx" ON "IndirectItemAllocationMonthly"("itemId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "IndirectItemAllocationMonthly_companyId_itemId_month_lineId_key" ON "IndirectItemAllocationMonthly"("companyId", "itemId", "month", "lineId");

-- CreateIndex
CREATE UNIQUE INDEX "MethodProductYield_productId_methodId_key" ON "MethodProductYield"("productId", "methodId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStandardCost_productId_month_key" ON "ProductStandardCost"("productId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionMethod_companyId_code_key" ON "ProductionMethod"("companyId", "code");

-- CreateIndex
CREATE INDEX "Zone_companyId_name_idx" ON "Zone"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_companyId_code_key" ON "Zone"("companyId", "code");

-- CreateIndex
CREATE INDEX "ZoneAllocation_companyId_zoneId_idx" ON "ZoneAllocation"("companyId", "zoneId");

-- CreateIndex
CREATE INDEX "ZoneAllocation_zoneId_idx" ON "ZoneAllocation"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneAllocation_companyId_zoneId_lineId_key" ON "ZoneAllocation"("companyId", "zoneId", "lineId");

-- CreateIndex
CREATE INDEX "ZoneAllocationMonthly_companyId_month_idx" ON "ZoneAllocationMonthly"("companyId", "month");

-- CreateIndex
CREATE INDEX "ZoneAllocationMonthly_zoneId_month_idx" ON "ZoneAllocationMonthly"("zoneId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneAllocationMonthly_companyId_zoneId_month_lineId_key" ON "ZoneAllocationMonthly"("companyId", "zoneId", "month", "lineId");

-- CreateIndex
CREATE INDEX "maintenance_checklists_companyId_isActive_idx" ON "maintenance_checklists"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "maintenance_checklists_companyId_sectorId_isActive_idx" ON "maintenance_checklists"("companyId", "sectorId", "isActive");

-- CreateIndex
CREATE INDEX "maintenance_checklists_sectorId_idx" ON "maintenance_checklists"("sectorId");

-- CreateIndex
CREATE INDEX "ChecklistExecution_checklistId_idx" ON "ChecklistExecution"("checklistId");

-- CreateIndex
CREATE INDEX "ChecklistExecution_companyId_idx" ON "ChecklistExecution"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistExecution_executedAt_idx" ON "ChecklistExecution"("executedAt");

-- CreateIndex
CREATE INDEX "ChecklistExecution_sectorId_idx" ON "ChecklistExecution"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "machine_order_companyId_machineId_key" ON "machine_order"("companyId", "machineId");

-- CreateIndex
CREATE INDEX "idx_employee_categories_company" ON "employee_categories"("company_id");

-- CreateIndex
CREATE INDEX "idx_employees_category" ON "employees"("category_id");

-- CreateIndex
CREATE INDEX "idx_employees_company" ON "employees"("company_id");

-- CreateIndex
CREATE INDEX "employees_cost_center_id_idx" ON "employees"("cost_center_id");

-- CreateIndex
CREATE INDEX "employees_union_category_id_idx" ON "employees"("union_category_id");

-- CreateIndex
CREATE INDEX "employees_work_sector_id_idx" ON "employees"("work_sector_id");

-- CreateIndex
CREATE INDEX "idx_employee_salary_history_company" ON "employee_salary_history"("company_id");

-- CreateIndex
CREATE INDEX "idx_employee_salary_history_employee" ON "employee_salary_history"("employee_id");

-- CreateIndex
CREATE INDEX "idx_employee_monthly_salaries_month_year" ON "employee_monthly_salaries"("month_year");

-- CreateIndex
CREATE INDEX "idx_employee_monthly_salaries_employee_id" ON "employee_monthly_salaries"("employee_id");

-- CreateIndex
CREATE INDEX "idx_employee_monthly_salaries_fecha_imputacion" ON "employee_monthly_salaries"("fecha_imputacion");

-- CreateIndex
CREATE INDEX "idx_employee_monthly_salaries_company_id" ON "employee_monthly_salaries"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_monthly_salaries_employee_id_month_year_key" ON "employee_monthly_salaries"("employee_id", "month_year");

-- CreateIndex
CREATE INDEX "idx_employee_salary_history_change_date" ON "employee_salary_history_new"("change_date");

-- CreateIndex
CREATE INDEX "idx_employee_salary_history_company_id" ON "employee_salary_history_new"("company_id");

-- CreateIndex
CREATE INDEX "idx_employee_salary_history_employee_id" ON "employee_salary_history_new"("employee_id");

-- CreateIndex
CREATE INDEX "idx_indirect_cost_categories_company" ON "indirect_cost_categories"("company_id");

-- CreateIndex
CREATE INDEX "idx_indirect_costs_company" ON "indirect_costs"("company_id");

-- CreateIndex
CREATE INDEX "idx_indirect_costs_category" ON "indirect_costs"("category_id");

-- CreateIndex
CREATE INDEX "idx_indirect_costs_fecha" ON "indirect_costs"("fecha_imputacion");

-- CreateIndex
CREATE INDEX "idx_indirect_cost_history_cost" ON "indirect_cost_history"("cost_id");

-- CreateIndex
CREATE INDEX "idx_indirect_cost_history_company" ON "indirect_cost_history"("company_id");

-- CreateIndex
CREATE INDEX "idx_cost_base_company" ON "indirect_cost_base"("company_id");

-- CreateIndex
CREATE INDEX "idx_cost_change_history_base" ON "indirect_cost_change_history"("cost_base_id");

-- CreateIndex
CREATE INDEX "idx_cost_change_history_company" ON "indirect_cost_change_history"("company_id");

-- CreateIndex
CREATE INDEX "idx_monthly_records_base" ON "indirect_cost_monthly_records"("cost_base_id");

-- CreateIndex
CREATE INDEX "idx_monthly_records_company" ON "indirect_cost_monthly_records"("company_id");

-- CreateIndex
CREATE INDEX "idx_monthly_records_month" ON "indirect_cost_monthly_records"("fecha_imputacion");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_category_id" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "idx_products_subcategory_id" ON "products"("subcategory_id");

-- CreateIndex
CREATE INDEX "idx_products_company_id" ON "products"("company_id");

-- CreateIndex
CREATE INDEX "idx_products_sku" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_suppliers_company_id" ON "suppliers"("company_id");

-- CreateIndex
CREATE INDEX "suppliers_cuit_idx" ON "suppliers"("cuit");

-- CreateIndex
CREATE INDEX "suppliers_codigo_idx" ON "suppliers"("codigo");

-- CreateIndex
CREATE INDEX "suppliers_isBlocked_idx" ON "suppliers"("isBlocked");

-- CreateIndex
CREATE INDEX "supplier_change_requests_supplierId_idx" ON "supplier_change_requests"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_change_requests_companyId_estado_idx" ON "supplier_change_requests"("companyId", "estado");

-- CreateIndex
CREATE INDEX "supply_categories_parentId_idx" ON "supply_categories"("parentId");

-- CreateIndex
CREATE INDEX "supply_categories_companyId_isActive_idx" ON "supply_categories"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "supply_categories_companyId_name_key" ON "supply_categories"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "supply_categories_companyId_code_key" ON "supply_categories"("companyId", "code");

-- CreateIndex
CREATE INDEX "idx_supplies_company_id" ON "supplies"("company_id");

-- CreateIndex
CREATE INDEX "supplies_categoryId_idx" ON "supplies"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_company_id_code_key" ON "supplies"("company_id", "code");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_supplierId_idx" ON "SupplierAccountMovement"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_companyId_idx" ON "SupplierAccountMovement"("companyId");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_fecha_idx" ON "SupplierAccountMovement"("fecha");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_tipo_idx" ON "SupplierAccountMovement"("tipo");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_comprobante_idx" ON "SupplierAccountMovement"("comprobante");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_supplierId_conciliado_idx" ON "SupplierAccountMovement"("supplierId", "conciliado");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_docType_idx" ON "SupplierAccountMovement"("docType");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_companyId_docType_idx" ON "SupplierAccountMovement"("companyId", "docType");

-- CreateIndex
CREATE INDEX "idx_supply_monthly_prices_month_year" ON "supply_monthly_prices"("month_year");

-- CreateIndex
CREATE INDEX "idx_supply_monthly_prices_supply_id" ON "supply_monthly_prices"("supply_id");

-- CreateIndex
CREATE INDEX "idx_supply_monthly_prices_fecha_imputacion" ON "supply_monthly_prices"("fecha_imputacion");

-- CreateIndex
CREATE UNIQUE INDEX "supply_monthly_prices_supply_id_month_year_key" ON "supply_monthly_prices"("supply_id", "month_year");

-- CreateIndex
CREATE INDEX "idx_recipes_company" ON "recipes"("company_id");

-- CreateIndex
CREATE INDEX "idx_recipes_product" ON "recipes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_product_id_name_version_company_id_key" ON "recipes"("product_id", "name", "version", "company_id");

-- CreateIndex
CREATE INDEX "idx_cost_tests_recipe" ON "recipe_cost_tests"("recipe_id");

-- CreateIndex
CREATE INDEX "idx_cost_tests_company" ON "recipe_cost_tests"("company_id");

-- CreateIndex
CREATE INDEX "idx_cost_tests_date" ON "recipe_cost_tests"("created_at");

-- CreateIndex
CREATE INDEX "idx_recipe_history_recipe" ON "recipe_change_history"("recipe_id");

-- CreateIndex
CREATE INDEX "idx_recipe_items_recipe" ON "recipe_items"("recipe_id");

-- CreateIndex
CREATE INDEX "idx_recipe_items_supply" ON "recipe_items"("supply_id");

-- CreateIndex
CREATE INDEX "idx_cost_dist_company" ON "cost_distribution_config"("company_id");

-- CreateIndex
CREATE INDEX "idx_cost_dist_type" ON "cost_distribution_config"("cost_type");

-- CreateIndex
CREATE UNIQUE INDEX "cost_distribution_config_company_id_cost_type_product_categ_key" ON "cost_distribution_config"("company_id", "cost_type", "product_category_id");

-- CreateIndex
CREATE INDEX "idx_emp_dist_company" ON "employee_distribution_config"("company_id");

-- CreateIndex
CREATE INDEX "idx_emp_dist_employee" ON "employee_distribution_config"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_distribution_config_company_id_employee_id_product_key" ON "employee_distribution_config"("company_id", "employee_id", "product_category_id");

-- CreateIndex
CREATE INDEX "idx_emp_cost_dist_company" ON "employee_cost_distribution"("company_id");

-- CreateIndex
CREATE INDEX "idx_emp_cost_dist_type" ON "employee_cost_distribution"("cost_type");

-- CreateIndex
CREATE INDEX "idx_emp_cost_dist_product_category" ON "employee_cost_distribution"("product_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_employee_cost_distribution" ON "employee_cost_distribution"("company_id", "cost_type", "employee_category_id", "product_category_id");

-- CreateIndex
CREATE INDEX "idx_monthly_sales_month" ON "monthly_sales"("month_year");

-- CreateIndex
CREATE INDEX "idx_monthly_sales_company" ON "monthly_sales"("company_id");

-- CreateIndex
CREATE INDEX "idx_monthly_sales_fecha" ON "monthly_sales"("fecha_imputacion");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_sales_company_id_product_id_month_year_key" ON "monthly_sales"("company_id", "product_id", "month_year");

-- CreateIndex
CREATE INDEX "idx_monthly_production_month" ON "monthly_production"("month_year");

-- CreateIndex
CREATE INDEX "idx_monthly_production_company" ON "monthly_production"("company_id");

-- CreateIndex
CREATE INDEX "idx_monthly_production_fecha" ON "monthly_production"("fecha_imputacion");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_production_company_id_product_id_month_year_key" ON "monthly_production"("company_id", "product_id", "month_year");

-- CreateIndex
CREATE INDEX "PriceComparison_companyId_idx" ON "PriceComparison"("companyId");

-- CreateIndex
CREATE INDEX "PriceComparisonCompetitor_comparisonId_idx" ON "PriceComparisonCompetitor"("comparisonId");

-- CreateIndex
CREATE INDEX "PriceComparisonProductPrice_competitorId_idx" ON "PriceComparisonProductPrice"("competitorId");

-- CreateIndex
CREATE INDEX "PriceComparisonProductPrice_productId_idx" ON "PriceComparisonProductPrice"("productId");

-- CreateIndex
CREATE INDEX "TaxBase_companyId_idx" ON "TaxBase"("companyId");

-- CreateIndex
CREATE INDEX "TaxBase_isActive_idx" ON "TaxBase"("isActive");

-- CreateIndex
CREATE INDEX "TaxBase_recurring_idx" ON "TaxBase"("isRecurring", "recurringDay");

-- CreateIndex
CREATE INDEX "TaxRecord_taxBaseId_idx" ON "TaxRecord"("taxBaseId");

-- CreateIndex
CREATE INDEX "TaxRecord_status_idx" ON "TaxRecord"("status");

-- CreateIndex
CREATE INDEX "TaxRecord_alertDate_idx" ON "TaxRecord"("alertDate");

-- CreateIndex
CREATE INDEX "TaxRecord_month_idx" ON "TaxRecord"("month");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRecord_taxBaseId_month_key" ON "TaxRecord"("taxBaseId", "month");

-- CreateIndex
CREATE INDEX "Control_companyId_idx" ON "Control"("companyId");

-- CreateIndex
CREATE INDEX "Control_type_idx" ON "Control"("type");

-- CreateIndex
CREATE INDEX "Control_isActive_idx" ON "Control"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Control_companyId_name_type_key" ON "Control"("companyId", "name", "type");

-- CreateIndex
CREATE INDEX "Truck_companyId_idx" ON "Truck"("companyId");

-- CreateIndex
CREATE INDEX "Truck_type_idx" ON "Truck"("type");

-- CreateIndex
CREATE INDEX "Truck_internalId_idx" ON "Truck"("internalId");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_companyId_name_key" ON "Truck"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_companyId_internalId_key" ON "Truck"("companyId", "internalId");

-- CreateIndex
CREATE INDEX "Load_companyId_idx" ON "Load"("companyId");

-- CreateIndex
CREATE INDEX "Load_truckId_idx" ON "Load"("truckId");

-- CreateIndex
CREATE INDEX "Load_date_idx" ON "Load"("date");

-- CreateIndex
CREATE INDEX "Load_internalId_idx" ON "Load"("internalId");

-- CreateIndex
CREATE INDEX "Load_status_idx" ON "Load"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Load_companyId_internalId_key" ON "Load"("companyId", "internalId");

-- CreateIndex
CREATE INDEX "LoadItem_loadId_idx" ON "LoadItem"("loadId");

-- CreateIndex
CREATE INDEX "LoadItem_productId_idx" ON "LoadItem"("productId");

-- CreateIndex
CREATE INDEX "ClientType_companyId_idx" ON "ClientType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientType_companyId_name_key" ON "ClientType"("companyId", "name");

-- CreateIndex
CREATE INDEX "DeliveryZone_companyId_idx" ON "DeliveryZone"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_companyId_name_key" ON "DeliveryZone"("companyId", "name");

-- CreateIndex
CREATE INDEX "TransportCompany_companyId_idx" ON "TransportCompany"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportCompany_companyId_name_key" ON "TransportCompany"("companyId", "name");

-- CreateIndex
CREATE INDEX "BusinessSector_companyId_idx" ON "BusinessSector"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSector_companyId_name_key" ON "BusinessSector"("companyId", "name");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "Client"("isActive");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_sellerId_idx" ON "Client"("sellerId");

-- CreateIndex
CREATE INDEX "Client_tipoCondicionVenta_idx" ON "Client"("tipoCondicionVenta");

-- CreateIndex
CREATE INDEX "Client_clientTypeId_idx" ON "Client"("clientTypeId");

-- CreateIndex
CREATE INDEX "Client_deliveryZoneId_idx" ON "Client"("deliveryZoneId");

-- CreateIndex
CREATE INDEX "Client_isBlocked_idx" ON "Client"("isBlocked");

-- CreateIndex
CREATE INDEX "Client_transportCompanyId_idx" ON "Client"("transportCompanyId");

-- CreateIndex
CREATE INDEX "Client_businessSectorId_idx" ON "Client"("businessSectorId");

-- CreateIndex
CREATE INDEX "Client_settlementPeriod_idx" ON "Client"("settlementPeriod");

-- CreateIndex
CREATE INDEX "Client_isDeliveryBlocked_idx" ON "Client"("isDeliveryBlocked");

-- CreateIndex
CREATE INDEX "Client_quickNoteExpiry_idx" ON "Client"("quickNoteExpiry");

-- CreateIndex
CREATE INDEX "Client_parentClientId_idx" ON "Client"("parentClientId");

-- CreateIndex
CREATE INDEX "Client_isVatPerceptionExempt_idx" ON "Client"("isVatPerceptionExempt");

-- CreateIndex
CREATE INDEX "ClientDiscount_clientId_idx" ON "ClientDiscount"("clientId");

-- CreateIndex
CREATE INDEX "ClientDiscount_isActive_idx" ON "ClientDiscount"("isActive");

-- CreateIndex
CREATE INDEX "ClientPriceList_clientId_idx" ON "ClientPriceList"("clientId");

-- CreateIndex
CREATE INDEX "ClientPriceList_isActive_idx" ON "ClientPriceList"("isActive");

-- CreateIndex
CREATE INDEX "DiscountList_companyId_idx" ON "DiscountList"("companyId");

-- CreateIndex
CREATE INDEX "DiscountList_isActive_idx" ON "DiscountList"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountList_companyId_name_key" ON "DiscountList"("companyId", "name");

-- CreateIndex
CREATE INDEX "DiscountListRubro_discountListId_idx" ON "DiscountListRubro"("discountListId");

-- CreateIndex
CREATE INDEX "DiscountListRubro_categoryId_idx" ON "DiscountListRubro"("categoryId");

-- CreateIndex
CREATE INDEX "DiscountListProduct_discountListId_idx" ON "DiscountListProduct"("discountListId");

-- CreateIndex
CREATE INDEX "DiscountListProduct_productId_idx" ON "DiscountListProduct"("productId");

-- CreateIndex
CREATE INDEX "PurchaseAccount_companyId_idx" ON "PurchaseAccount"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseAccount_activa_idx" ON "PurchaseAccount"("activa");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_idx" ON "PurchaseReceipt"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_proveedorId_idx" ON "PurchaseReceipt"("proveedorId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_tipoCuentaId_idx" ON "PurchaseReceipt"("tipoCuentaId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_fechaEmision_idx" ON "PurchaseReceipt"("fechaEmision");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_fechaImputacion_idx" ON "PurchaseReceipt"("fechaImputacion");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_estado_idx" ON "PurchaseReceipt"("estado");

-- CreateIndex
CREATE INDEX "idx_purchase_receipt_urgent" ON "PurchaseReceipt"("companyId", "estado", "pagoUrgente");

-- CreateIndex
CREATE INDEX "idx_purchase_receipt_provider_status" ON "PurchaseReceipt"("companyId", "proveedorId", "estado");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_cae_idx" ON "PurchaseReceipt"("cae");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_costCenterId_idx" ON "PurchaseReceipt"("costCenterId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_projectId_idx" ON "PurchaseReceipt"("projectId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_docType_idx" ON "PurchaseReceipt"("docType");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_docType_idx" ON "PurchaseReceipt"("companyId", "docType");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_ingresoConfirmado_idx" ON "PurchaseReceipt"("ingresoConfirmado");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_ingresoConfirmado_idx" ON "PurchaseReceipt"("companyId", "ingresoConfirmado");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_matchStatus_idx" ON "PurchaseReceipt"("matchStatus");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_matchStatus_idx" ON "PurchaseReceipt"("companyId", "matchStatus");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_payApprovalStatus_idx" ON "PurchaseReceipt"("payApprovalStatus");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_payApprovalStatus_idx" ON "PurchaseReceipt"("companyId", "payApprovalStatus");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_prontoPagoDisponible_prontoPagoFechaLimite_idx" ON "PurchaseReceipt"("prontoPagoDisponible", "prontoPagoFechaLimite");

-- CreateIndex
CREATE INDEX "idx_purchase_receipt_provider_date" ON "PurchaseReceipt"("companyId", "proveedorId", "fechaEmision");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_comprobanteId_idx" ON "PurchaseReceiptItem"("comprobanteId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_proveedorId_idx" ON "PurchaseReceiptItem"("proveedorId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_itemId_idx" ON "PurchaseReceiptItem"("itemId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_companyId_idx" ON "PurchaseReceiptItem"("companyId");

-- CreateIndex
CREATE INDEX "SupplierItem_supplierId_codigoProveedor_idx" ON "SupplierItem"("supplierId", "codigoProveedor");

-- CreateIndex
CREATE INDEX "SupplierItem_supplierId_idx" ON "SupplierItem"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierItem_supplyId_idx" ON "SupplierItem"("supplyId");

-- CreateIndex
CREATE INDEX "SupplierItem_companyId_idx" ON "SupplierItem"("companyId");

-- CreateIndex
CREATE INDEX "SupplierItem_activo_idx" ON "SupplierItem"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierItem_supplierId_supplyId_key" ON "SupplierItem"("supplierId", "supplyId");

-- CreateIndex
CREATE INDEX "PriceHistory_supplierItemId_idx" ON "PriceHistory"("supplierItemId");

-- CreateIndex
CREATE INDEX "PriceHistory_fecha_idx" ON "PriceHistory"("fecha");

-- CreateIndex
CREATE INDEX "PriceHistory_companyId_idx" ON "PriceHistory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_supplierItemId_key" ON "Stock"("supplierItemId");

-- CreateIndex
CREATE INDEX "Stock_companyId_idx" ON "Stock"("companyId");

-- CreateIndex
CREATE INDEX "PaymentOrder_companyId_idx" ON "PaymentOrder"("companyId");

-- CreateIndex
CREATE INDEX "PaymentOrder_proveedorId_idx" ON "PaymentOrder"("proveedorId");

-- CreateIndex
CREATE INDEX "PaymentOrder_fechaPago_idx" ON "PaymentOrder"("fechaPago");

-- CreateIndex
CREATE INDEX "PaymentOrder_docType_idx" ON "PaymentOrder"("docType");

-- CreateIndex
CREATE INDEX "PaymentOrder_companyId_docType_idx" ON "PaymentOrder"("companyId", "docType");

-- CreateIndex
CREATE INDEX "PaymentOrderReceipt_paymentOrderId_idx" ON "PaymentOrderReceipt"("paymentOrderId");

-- CreateIndex
CREATE INDEX "PaymentOrderReceipt_receiptId_idx" ON "PaymentOrderReceipt"("receiptId");

-- CreateIndex
CREATE INDEX "PaymentOrderCheque_paymentOrderId_idx" ON "PaymentOrderCheque"("paymentOrderId");

-- CreateIndex
CREATE INDEX "PaymentOrderCheque_companyId_idx" ON "PaymentOrderCheque"("companyId");

-- CreateIndex
CREATE INDEX "PaymentOrderAttachment_paymentOrderId_idx" ON "PaymentOrderAttachment"("paymentOrderId");

-- CreateIndex
CREATE INDEX "supplier_credit_allocations_creditNoteId_idx" ON "supplier_credit_allocations"("creditNoteId");

-- CreateIndex
CREATE INDEX "supplier_credit_allocations_receiptId_idx" ON "supplier_credit_allocations"("receiptId");

-- CreateIndex
CREATE INDEX "supplier_credit_allocations_debitNoteId_idx" ON "supplier_credit_allocations"("debitNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_allocations_creditNoteId_receiptId_key" ON "supplier_credit_allocations"("creditNoteId", "receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_allocations_creditNoteId_debitNoteId_key" ON "supplier_credit_allocations"("creditNoteId", "debitNoteId");

-- CreateIndex
CREATE INDEX "ChecklistInstructive_checklistId_idx" ON "ChecklistInstructive"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "machine_order_temp_company_id_machine_id_key" ON "machine_order_temp"("company_id", "machine_id");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_configs_companyId_sectorId_key" ON "maintenance_configs"("companyId", "sectorId");

-- CreateIndex
CREATE INDEX "user_dashboard_configs_userId_idx" ON "user_dashboard_configs"("userId");

-- CreateIndex
CREATE INDEX "user_dashboard_configs_companyId_idx" ON "user_dashboard_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "user_dashboard_configs_userId_companyId_name_key" ON "user_dashboard_configs"("userId", "companyId", "name");

-- CreateIndex
CREATE INDEX "user_color_preferences_userId_idx" ON "user_color_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_color_preferences_companyId_idx" ON "user_color_preferences"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "user_color_preferences_userId_companyId_key" ON "user_color_preferences"("userId", "companyId");

-- CreateIndex
CREATE INDEX "symptom_library_companyId_componentId_idx" ON "symptom_library"("companyId", "componentId");

-- CreateIndex
CREATE INDEX "symptom_library_companyId_subcomponentId_idx" ON "symptom_library"("companyId", "subcomponentId");

-- CreateIndex
CREATE INDEX "downtime_logs_failureOccurrenceId_idx" ON "downtime_logs"("failureOccurrenceId");

-- CreateIndex
CREATE INDEX "downtime_logs_machineId_startedAt_idx" ON "downtime_logs"("machineId", "startedAt");

-- CreateIndex
CREATE INDEX "downtime_logs_companyId_machineId_startedAt_idx" ON "downtime_logs"("companyId", "machineId", "startedAt");

-- CreateIndex
CREATE INDEX "downtime_logs_workOrderId_endedAt_idx" ON "downtime_logs"("workOrderId", "endedAt");

-- CreateIndex
CREATE INDEX "downtime_logs_companyId_endedAt_startedAt_idx" ON "downtime_logs"("companyId", "endedAt", "startedAt");

-- CreateIndex
CREATE INDEX "work_logs_workOrderId_idx" ON "work_logs"("workOrderId");

-- CreateIndex
CREATE INDEX "work_logs_performedById_startedAt_idx" ON "work_logs"("performedById", "startedAt");

-- CreateIndex
CREATE INDEX "templates_companyId_type_idx" ON "templates"("companyId", "type");

-- CreateIndex
CREATE INDEX "templates_componentId_idx" ON "templates"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "quality_assurance_workOrderId_key" ON "quality_assurance"("workOrderId");

-- CreateIndex
CREATE INDEX "quality_assurance_workOrderId_idx" ON "quality_assurance"("workOrderId");

-- CreateIndex
CREATE INDEX "quality_assurance_status_idx" ON "quality_assurance"("status");

-- CreateIndex
CREATE INDEX "failure_watchers_userId_idx" ON "failure_watchers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "failure_watchers_failureOccurrenceId_userId_key" ON "failure_watchers"("failureOccurrenceId", "userId");

-- CreateIndex
CREATE INDEX "work_order_watchers_userId_idx" ON "work_order_watchers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_watchers_workOrderId_userId_key" ON "work_order_watchers"("workOrderId", "userId");

-- CreateIndex
CREATE INDEX "failure_occurrence_comments_failureOccurrenceId_createdAt_idx" ON "failure_occurrence_comments"("failureOccurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "failure_occurrence_comments_authorId_idx" ON "failure_occurrence_comments"("authorId");

-- CreateIndex
CREATE INDEX "solutions_applied_failureOccurrenceId_idx" ON "solutions_applied"("failureOccurrenceId");

-- CreateIndex
CREATE INDEX "solutions_applied_workOrderId_idx" ON "solutions_applied"("workOrderId");

-- CreateIndex
CREATE INDEX "solutions_applied_performedById_performedAt_idx" ON "solutions_applied"("performedById", "performedAt");

-- CreateIndex
CREATE INDEX "solutions_applied_companyId_performedAt_idx" ON "solutions_applied"("companyId", "performedAt");

-- CreateIndex
CREATE INDEX "solutions_applied_finalSubcomponentId_effectiveness_idx" ON "solutions_applied"("finalSubcomponentId", "effectiveness");

-- CreateIndex
CREATE INDEX "solutions_applied_companyId_finalSubcomponentId_performedAt_idx" ON "solutions_applied"("companyId", "finalSubcomponentId", "performedAt");

-- CreateIndex
CREATE INDEX "solutions_applied_companyId_outcome_idx" ON "solutions_applied"("companyId", "outcome");

-- CreateIndex
CREATE INDEX "solutions_applied_companyId_outcome_effectiveness_idx" ON "solutions_applied"("companyId", "outcome", "effectiveness");

-- CreateIndex
CREATE INDEX "solutions_applied_companyId_isObsolete_outcome_idx" ON "solutions_applied"("companyId", "isObsolete", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "corrective_settings_companyId_key" ON "corrective_settings"("companyId");

-- CreateIndex
CREATE INDEX "failure_occurrence_events_companyId_failureOccurrenceId_occ_idx" ON "failure_occurrence_events"("companyId", "failureOccurrenceId", "occurredAt");

-- CreateIndex
CREATE INDEX "failure_occurrence_events_failureOccurrenceId_createdAt_idx" ON "failure_occurrence_events"("failureOccurrenceId", "createdAt");

-- CreateIndex
CREATE INDEX "failure_occurrence_events_workOrderId_idx" ON "failure_occurrence_events"("workOrderId");

-- CreateIndex
CREATE INDEX "activity_events_companyId_entityType_entityId_occurredAt_idx" ON "activity_events"("companyId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "activity_events_entityType_entityId_idx" ON "activity_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_events_performedById_idx" ON "activity_events"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "root_cause_analyses_workOrderId_key" ON "root_cause_analyses"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "root_cause_analyses_failureOccurrenceId_key" ON "root_cause_analyses"("failureOccurrenceId");

-- CreateIndex
CREATE INDEX "root_cause_analyses_companyId_workOrderId_idx" ON "root_cause_analyses"("companyId", "workOrderId");

-- CreateIndex
CREATE INDEX "root_cause_analyses_failureOccurrenceId_idx" ON "root_cause_analyses"("failureOccurrenceId");

-- CreateIndex
CREATE INDEX "corrective_checklist_templates_companyId_isActive_idx" ON "corrective_checklist_templates"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "corrective_checklist_templates_machineId_idx" ON "corrective_checklist_templates"("machineId");

-- CreateIndex
CREATE INDEX "corrective_checklist_templates_componentId_idx" ON "corrective_checklist_templates"("componentId");

-- CreateIndex
CREATE INDEX "work_order_checklists_workOrderId_idx" ON "work_order_checklists"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_checklists_templateId_idx" ON "work_order_checklists"("templateId");

-- CreateIndex
CREATE INDEX "work_order_checklists_workOrderId_companyId_idx" ON "work_order_checklists"("workOrderId", "companyId");

-- CreateIndex
CREATE INDEX "assistant_embeddings_companyId_idx" ON "assistant_embeddings"("companyId");

-- CreateIndex
CREATE INDEX "assistant_embeddings_entityType_idx" ON "assistant_embeddings"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_embeddings_entityType_entityId_key" ON "assistant_embeddings"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "assistant_conversations_companyId_idx" ON "assistant_conversations"("companyId");

-- CreateIndex
CREATE INDEX "assistant_conversations_userId_idx" ON "assistant_conversations"("userId");

-- CreateIndex
CREATE INDEX "assistant_messages_conversationId_idx" ON "assistant_messages"("conversationId");

-- CreateIndex
CREATE INDEX "assistant_action_logs_companyId_idx" ON "assistant_action_logs"("companyId");

-- CreateIndex
CREATE INDEX "assistant_action_logs_userId_idx" ON "assistant_action_logs"("userId");

-- CreateIndex
CREATE INDEX "assistant_action_logs_actionType_idx" ON "assistant_action_logs"("actionType");

-- CreateIndex
CREATE INDEX "assistant_action_logs_createdAt_idx" ON "assistant_action_logs"("createdAt");

-- CreateIndex
CREATE INDEX "warehouses_companyId_idx" ON "warehouses"("companyId");

-- CreateIndex
CREATE INDEX "warehouses_isActive_idx" ON "warehouses"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_companyId_codigo_key" ON "warehouses"("companyId", "codigo");

-- CreateIndex
CREATE INDEX "stock_locations_companyId_idx" ON "stock_locations"("companyId");

-- CreateIndex
CREATE INDEX "stock_locations_warehouseId_idx" ON "stock_locations"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_locations_supplierItemId_idx" ON "stock_locations"("supplierItemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_warehouseId_supplierItemId_key" ON "stock_locations"("warehouseId", "supplierItemId");

-- CreateIndex
CREATE INDEX "stock_movements_supplierItemId_idx" ON "stock_movements"("supplierItemId");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_idx" ON "stock_movements"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_idx" ON "stock_movements"("companyId");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_tipo_idx" ON "stock_movements"("tipo");

-- CreateIndex
CREATE INDEX "stock_movements_docType_idx" ON "stock_movements"("docType");

-- CreateIndex
CREATE INDEX "stock_movements_companyId_docType_idx" ON "stock_movements"("companyId", "docType");

-- CreateIndex
CREATE INDEX "stock_movements_purchaseReturnId_idx" ON "stock_movements"("purchaseReturnId");

-- CreateIndex
CREATE INDEX "stock_movements_despachoId_idx" ON "stock_movements"("despachoId");

-- CreateIndex
CREATE INDEX "stock_movements_devolucionId_idx" ON "stock_movements"("devolucionId");

-- CreateIndex
CREATE INDEX "stock_movements_productionOrderId_idx" ON "stock_movements"("productionOrderId");

-- CreateIndex
CREATE INDEX "stock_movements_dailyProductionReportId_idx" ON "stock_movements"("dailyProductionReportId");

-- CreateIndex
CREATE INDEX "stock_movements_reservationId_idx" ON "stock_movements"("reservationId");

-- CreateIndex
CREATE INDEX "idx_stock_movement_kardex" ON "stock_movements"("supplierItemId", "warehouseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_purchaseReturnId_supplierItemId_key" ON "stock_movements"("purchaseReturnId", "supplierItemId");

-- CreateIndex
CREATE INDEX "stock_transfers_companyId_idx" ON "stock_transfers"("companyId");

-- CreateIndex
CREATE INDEX "stock_transfers_estado_idx" ON "stock_transfers"("estado");

-- CreateIndex
CREATE INDEX "stock_transfer_items_transferId_idx" ON "stock_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "stock_adjustments_companyId_idx" ON "stock_adjustments"("companyId");

-- CreateIndex
CREATE INDEX "stock_adjustments_warehouseId_idx" ON "stock_adjustments"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_adjustments_estado_idx" ON "stock_adjustments"("estado");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_adjustmentId_idx" ON "stock_adjustment_items"("adjustmentId");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_idx" ON "purchase_orders"("companyId");

-- CreateIndex
CREATE INDEX "purchase_orders_proveedorId_idx" ON "purchase_orders"("proveedorId");

-- CreateIndex
CREATE INDEX "purchase_orders_estado_idx" ON "purchase_orders"("estado");

-- CreateIndex
CREATE INDEX "purchase_orders_fechaEmision_idx" ON "purchase_orders"("fechaEmision");

-- CreateIndex
CREATE INDEX "purchase_orders_esEmergencia_idx" ON "purchase_orders"("esEmergencia");

-- CreateIndex
CREATE INDEX "purchase_orders_docType_idx" ON "purchase_orders"("docType");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_docType_idx" ON "purchase_orders"("companyId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_companyId_numero_key" ON "purchase_orders"("companyId", "numero");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_supplierItemId_idx" ON "purchase_order_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "goods_receipts_companyId_idx" ON "goods_receipts"("companyId");

-- CreateIndex
CREATE INDEX "goods_receipts_proveedorId_idx" ON "goods_receipts"("proveedorId");

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "goods_receipts_estado_idx" ON "goods_receipts"("estado");

-- CreateIndex
CREATE INDEX "goods_receipts_fechaRecepcion_idx" ON "goods_receipts"("fechaRecepcion");

-- CreateIndex
CREATE INDEX "goods_receipts_requiereRegularizacion_regularizada_idx" ON "goods_receipts"("requiereRegularizacion", "regularizada");

-- CreateIndex
CREATE INDEX "goods_receipts_docType_idx" ON "goods_receipts"("docType");

-- CreateIndex
CREATE INDEX "goods_receipts_companyId_docType_idx" ON "goods_receipts"("companyId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_companyId_numero_key" ON "goods_receipts"("companyId", "numero");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "goods_receipt_items_purchaseOrderItemId_idx" ON "goods_receipt_items"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "goods_receipt_items_supplierItemId_idx" ON "goods_receipt_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "grni_accruals_companyId_estado_idx" ON "grni_accruals"("companyId", "estado");

-- CreateIndex
CREATE INDEX "grni_accruals_supplierId_idx" ON "grni_accruals"("supplierId");

-- CreateIndex
CREATE INDEX "grni_accruals_periodoCreacion_idx" ON "grni_accruals"("periodoCreacion");

-- CreateIndex
CREATE INDEX "grni_accruals_goodsReceiptId_idx" ON "grni_accruals"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "credit_debit_notes_companyId_idx" ON "credit_debit_notes"("companyId");

-- CreateIndex
CREATE INDEX "credit_debit_notes_proveedorId_idx" ON "credit_debit_notes"("proveedorId");

-- CreateIndex
CREATE INDEX "credit_debit_notes_facturaId_idx" ON "credit_debit_notes"("facturaId");

-- CreateIndex
CREATE INDEX "credit_debit_notes_tipo_idx" ON "credit_debit_notes"("tipo");

-- CreateIndex
CREATE INDEX "credit_debit_notes_estado_idx" ON "credit_debit_notes"("estado");

-- CreateIndex
CREATE INDEX "credit_debit_notes_docType_idx" ON "credit_debit_notes"("docType");

-- CreateIndex
CREATE INDEX "credit_debit_notes_companyId_docType_idx" ON "credit_debit_notes"("companyId", "docType");

-- CreateIndex
CREATE INDEX "credit_debit_note_items_noteId_idx" ON "credit_debit_note_items"("noteId");

-- CreateIndex
CREATE INDEX "credit_note_requests_companyId_idx" ON "credit_note_requests"("companyId");

-- CreateIndex
CREATE INDEX "credit_note_requests_estado_idx" ON "credit_note_requests"("estado");

-- CreateIndex
CREATE INDEX "credit_note_requests_proveedorId_idx" ON "credit_note_requests"("proveedorId");

-- CreateIndex
CREATE INDEX "credit_note_requests_facturaId_idx" ON "credit_note_requests"("facturaId");

-- CreateIndex
CREATE INDEX "credit_note_requests_docType_idx" ON "credit_note_requests"("docType");

-- CreateIndex
CREATE INDEX "credit_note_requests_companyId_docType_idx" ON "credit_note_requests"("companyId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_requests_companyId_numero_key" ON "credit_note_requests"("companyId", "numero");

-- CreateIndex
CREATE INDEX "credit_note_request_items_requestId_idx" ON "credit_note_request_items"("requestId");

-- CreateIndex
CREATE INDEX "match_results_companyId_idx" ON "match_results"("companyId");

-- CreateIndex
CREATE INDEX "match_results_estado_idx" ON "match_results"("estado");

-- CreateIndex
CREATE INDEX "match_results_facturaId_idx" ON "match_results"("facturaId");

-- CreateIndex
CREATE INDEX "match_line_results_matchResultId_idx" ON "match_line_results"("matchResultId");

-- CreateIndex
CREATE INDEX "match_line_results_status_idx" ON "match_line_results"("status");

-- CreateIndex
CREATE INDEX "match_exceptions_matchResultId_idx" ON "match_exceptions"("matchResultId");

-- CreateIndex
CREATE INDEX "match_exceptions_tipo_idx" ON "match_exceptions"("tipo");

-- CreateIndex
CREATE INDEX "match_exceptions_resuelto_idx" ON "match_exceptions"("resuelto");

-- CreateIndex
CREATE INDEX "match_exceptions_ownerId_idx" ON "match_exceptions"("ownerId");

-- CreateIndex
CREATE INDEX "match_exceptions_slaDeadline_idx" ON "match_exceptions"("slaDeadline");

-- CreateIndex
CREATE INDEX "match_exceptions_slaBreached_idx" ON "match_exceptions"("slaBreached");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_configs_companyId_key" ON "purchase_configs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "match_exception_sla_configs_companyId_exceptionType_key" ON "match_exception_sla_configs"("companyId", "exceptionType");

-- CreateIndex
CREATE INDEX "match_exception_history_exceptionId_idx" ON "match_exception_history"("exceptionId");

-- CreateIndex
CREATE INDEX "notification_outbox_companyId_idx" ON "notification_outbox"("companyId");

-- CreateIndex
CREATE INDEX "notification_outbox_estado_idx" ON "notification_outbox"("estado");

-- CreateIndex
CREATE INDEX "notification_outbox_scheduledAt_idx" ON "notification_outbox"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "sod_rules_companyId_codigo_key" ON "sod_rules"("companyId", "codigo");

-- CreateIndex
CREATE INDEX "sod_violations_companyId_idx" ON "sod_violations"("companyId");

-- CreateIndex
CREATE INDEX "sod_violations_userId_idx" ON "sod_violations"("userId");

-- CreateIndex
CREATE INDEX "purchase_approvals_companyId_idx" ON "purchase_approvals"("companyId");

-- CreateIndex
CREATE INDEX "purchase_approvals_tipo_idx" ON "purchase_approvals"("tipo");

-- CreateIndex
CREATE INDEX "purchase_approvals_estado_idx" ON "purchase_approvals"("estado");

-- CreateIndex
CREATE INDEX "purchase_approvals_asignadoA_idx" ON "purchase_approvals"("asignadoA");

-- CreateIndex
CREATE INDEX "purchase_approvals_referenciaId_referenciaTipo_idx" ON "purchase_approvals"("referenciaId", "referenciaTipo");

-- CreateIndex
CREATE INDEX "cost_centers_companyId_idx" ON "cost_centers"("companyId");

-- CreateIndex
CREATE INDEX "cost_centers_isActive_idx" ON "cost_centers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_companyId_codigo_key" ON "cost_centers"("companyId", "codigo");

-- CreateIndex
CREATE INDEX "projects_companyId_idx" ON "projects"("companyId");

-- CreateIndex
CREATE INDEX "projects_estado_idx" ON "projects"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "projects_companyId_codigo_key" ON "projects"("companyId", "codigo");

-- CreateIndex
CREATE INDEX "supplier_item_aliases_supplierItemId_idx" ON "supplier_item_aliases"("supplierItemId");

-- CreateIndex
CREATE INDEX "supplier_item_aliases_alias_idx" ON "supplier_item_aliases"("alias");

-- CreateIndex
CREATE INDEX "supplier_item_aliases_codigoProveedor_idx" ON "supplier_item_aliases"("codigoProveedor");

-- CreateIndex
CREATE INDEX "supplier_item_aliases_companyId_idx" ON "supplier_item_aliases"("companyId");

-- CreateIndex
CREATE INDEX "payment_requests_companyId_idx" ON "payment_requests"("companyId");

-- CreateIndex
CREATE INDEX "payment_requests_proveedorId_idx" ON "payment_requests"("proveedorId");

-- CreateIndex
CREATE INDEX "payment_requests_estado_idx" ON "payment_requests"("estado");

-- CreateIndex
CREATE INDEX "payment_requests_prioridad_idx" ON "payment_requests"("prioridad");

-- CreateIndex
CREATE INDEX "payment_requests_esUrgente_idx" ON "payment_requests"("esUrgente");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_companyId_numero_key" ON "payment_requests"("companyId", "numero");

-- CreateIndex
CREATE INDEX "payment_request_receipts_paymentRequestId_idx" ON "payment_request_receipts"("paymentRequestId");

-- CreateIndex
CREATE INDEX "payment_request_receipts_receiptId_idx" ON "payment_request_receipts"("receiptId");

-- CreateIndex
CREATE INDEX "payment_request_logs_paymentRequestId_idx" ON "payment_request_logs"("paymentRequestId");

-- CreateIndex
CREATE INDEX "payment_request_logs_userId_idx" ON "payment_request_logs"("userId");

-- CreateIndex
CREATE INDEX "payment_request_logs_createdAt_idx" ON "payment_request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_returns_companyId_idx" ON "purchase_returns"("companyId");

-- CreateIndex
CREATE INDEX "purchase_returns_proveedorId_idx" ON "purchase_returns"("proveedorId");

-- CreateIndex
CREATE INDEX "purchase_returns_estado_idx" ON "purchase_returns"("estado");

-- CreateIndex
CREATE INDEX "purchase_returns_creditNoteRequestId_idx" ON "purchase_returns"("creditNoteRequestId");

-- CreateIndex
CREATE INDEX "purchase_returns_warehouseId_idx" ON "purchase_returns"("warehouseId");

-- CreateIndex
CREATE INDEX "purchase_returns_facturaId_idx" ON "purchase_returns"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_companyId_numero_key" ON "purchase_returns"("companyId", "numero");

-- CreateIndex
CREATE INDEX "purchase_return_items_returnId_idx" ON "purchase_return_items"("returnId");

-- CreateIndex
CREATE INDEX "purchase_return_items_goodsReceiptItemId_idx" ON "purchase_return_items"("goodsReceiptItemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_return_items_returnId_goodsReceiptItemId_key" ON "purchase_return_items"("returnId", "goodsReceiptItemId");

-- CreateIndex
CREATE INDEX "replenishment_suggestions_companyId_idx" ON "replenishment_suggestions"("companyId");

-- CreateIndex
CREATE INDEX "replenishment_suggestions_estado_idx" ON "replenishment_suggestions"("estado");

-- CreateIndex
CREATE INDEX "replenishment_suggestions_urgencia_idx" ON "replenishment_suggestions"("urgencia");

-- CreateIndex
CREATE INDEX "replenishment_suggestions_supplierItemId_idx" ON "replenishment_suggestions"("supplierItemId");

-- CreateIndex
CREATE INDEX "supplier_lead_times_companyId_idx" ON "supplier_lead_times"("companyId");

-- CreateIndex
CREATE INDEX "supplier_lead_times_supplierId_idx" ON "supplier_lead_times"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_lead_times_supplierId_supplierItemId_key" ON "supplier_lead_times"("supplierId", "supplierItemId");

-- CreateIndex
CREATE INDEX "purchase_audit_logs_companyId_idx" ON "purchase_audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "purchase_audit_logs_entidad_entidadId_idx" ON "purchase_audit_logs"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "purchase_audit_logs_userId_idx" ON "purchase_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "purchase_audit_logs_createdAt_idx" ON "purchase_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_audit_logs_docType_idx" ON "purchase_audit_logs"("docType");

-- CreateIndex
CREATE INDEX "purchase_audit_logs_companyId_docType_idx" ON "purchase_audit_logs"("companyId", "docType");

-- CreateIndex
CREATE INDEX "duplicate_detections_companyId_idx" ON "duplicate_detections"("companyId");

-- CreateIndex
CREATE INDEX "duplicate_detections_tipo_idx" ON "duplicate_detections"("tipo");

-- CreateIndex
CREATE INDEX "duplicate_detections_estado_idx" ON "duplicate_detections"("estado");

-- CreateIndex
CREATE INDEX "duplicate_detections_entidadId_idx" ON "duplicate_detections"("entidadId");

-- CreateIndex
CREATE INDEX "purchase_requests_companyId_idx" ON "purchase_requests"("companyId");

-- CreateIndex
CREATE INDEX "purchase_requests_estado_idx" ON "purchase_requests"("estado");

-- CreateIndex
CREATE INDEX "purchase_requests_solicitanteId_idx" ON "purchase_requests"("solicitanteId");

-- CreateIndex
CREATE INDEX "purchase_requests_prioridad_idx" ON "purchase_requests"("prioridad");

-- CreateIndex
CREATE INDEX "purchase_requests_createdAt_idx" ON "purchase_requests"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_requests_fechaNecesidad_idx" ON "purchase_requests"("fechaNecesidad");

-- CreateIndex
CREATE INDEX "purchase_requests_companyId_estado_createdAt_idx" ON "purchase_requests"("companyId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_requests_companyId_prioridad_estado_idx" ON "purchase_requests"("companyId", "prioridad", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requests_companyId_numero_key" ON "purchase_requests"("companyId", "numero");

-- CreateIndex
CREATE INDEX "purchase_request_items_requestId_idx" ON "purchase_request_items"("requestId");

-- CreateIndex
CREATE INDEX "purchase_quotations_requestId_idx" ON "purchase_quotations"("requestId");

-- CreateIndex
CREATE INDEX "purchase_quotations_supplierId_idx" ON "purchase_quotations"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_quotations_companyId_idx" ON "purchase_quotations"("companyId");

-- CreateIndex
CREATE INDEX "purchase_quotations_estado_idx" ON "purchase_quotations"("estado");

-- CreateIndex
CREATE INDEX "purchase_quotations_companyId_estado_createdAt_idx" ON "purchase_quotations"("companyId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_quotations_companyId_validezHasta_idx" ON "purchase_quotations"("companyId", "validezHasta");

-- CreateIndex
CREATE INDEX "purchase_quotations_requestId_estado_idx" ON "purchase_quotations"("requestId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_quotations_companyId_numero_key" ON "purchase_quotations"("companyId", "numero");

-- CreateIndex
CREATE INDEX "purchase_quotation_items_quotationId_idx" ON "purchase_quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "purchase_quotation_items_productId_idx" ON "purchase_quotation_items"("productId");

-- CreateIndex
CREATE INDEX "purchase_quotation_items_normalizedKey_idx" ON "purchase_quotation_items"("normalizedKey");

-- CreateIndex
CREATE INDEX "quotation_status_history_quotationId_changedAt_idx" ON "quotation_status_history"("quotationId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_quotation_settings_companyId_key" ON "company_quotation_settings"("companyId");

-- CreateIndex
CREATE INDEX "purchase_comments_entidad_entidadId_idx" ON "purchase_comments"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "purchase_comments_companyId_idx" ON "purchase_comments"("companyId");

-- CreateIndex
CREATE INDEX "purchase_comments_createdAt_idx" ON "purchase_comments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_view_config_companyId_key" ON "company_view_config"("companyId");

-- CreateIndex
CREATE INDEX "_vm_log_companyId_timestamp_idx" ON "_vm_log"("companyId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_blacklist_tokenHash_key" ON "token_blacklist"("tokenHash");

-- CreateIndex
CREATE INDEX "token_blacklist_tokenHash_idx" ON "token_blacklist"("tokenHash");

-- CreateIndex
CREATE INDEX "token_blacklist_expiresAt_idx" ON "token_blacklist"("expiresAt");

-- CreateIndex
CREATE INDEX "token_blacklist_userId_idx" ON "token_blacklist"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_isActive_idx" ON "sessions"("userId", "isActive");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_deviceFingerprint_idx" ON "sessions"("deviceFingerprint");

-- CreateIndex
CREATE INDEX "rate_limit_entries_blockedUntil_idx" ON "rate_limit_entries"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_entries_identifier_action_key" ON "rate_limit_entries"("identifier", "action");

-- CreateIndex
CREATE INDEX "login_attempts_email_createdAt_idx" ON "login_attempts"("email", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_createdAt_idx" ON "login_attempts"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_userId_idx" ON "login_attempts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_two_factor_userId_key" ON "user_two_factor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_trustToken_key" ON "trusted_devices"("trustToken");

-- CreateIndex
CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");

-- CreateIndex
CREATE INDEX "trusted_devices_trustToken_idx" ON "trusted_devices"("trustToken");

-- CreateIndex
CREATE INDEX "trusted_devices_deviceFingerprint_idx" ON "trusted_devices"("deviceFingerprint");

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_eventType_createdAt_idx" ON "security_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_severity_createdAt_idx" ON "security_events"("severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_config_companyId_key" ON "sales_config"("companyId");

-- CreateIndex
CREATE INDEX "quotes_companyId_idx" ON "quotes"("companyId");

-- CreateIndex
CREATE INDEX "quotes_clientId_idx" ON "quotes"("clientId");

-- CreateIndex
CREATE INDEX "quotes_sellerId_idx" ON "quotes"("sellerId");

-- CreateIndex
CREATE INDEX "quotes_estado_idx" ON "quotes"("estado");

-- CreateIndex
CREATE INDEX "quotes_fechaEmision_idx" ON "quotes"("fechaEmision");

-- CreateIndex
CREATE INDEX "quotes_fechaValidez_idx" ON "quotes"("fechaValidez");

-- CreateIndex
CREATE INDEX "quotes_docType_idx" ON "quotes"("docType");

-- CreateIndex
CREATE INDEX "quotes_companyId_docType_idx" ON "quotes"("companyId", "docType");

-- CreateIndex
CREATE INDEX "quotes_companyId_docType_fechaEmision_idx" ON "quotes"("companyId", "docType", "fechaEmision");

-- CreateIndex
CREATE INDEX "quotes_quoteType_idx" ON "quotes"("quoteType");

-- CreateIndex
CREATE INDEX "quotes_companyId_quoteType_idx" ON "quotes"("companyId", "quoteType");

-- CreateIndex
CREATE INDEX "quotes_companyId_estado_createdAt_idx" ON "quotes"("companyId", "estado", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_companyId_fechaValidez_idx" ON "quotes"("companyId", "fechaValidez");

-- CreateIndex
CREATE INDEX "quotes_companyId_clientId_createdAt_idx" ON "quotes"("companyId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_companyId_sellerId_createdAt_idx" ON "quotes"("companyId", "sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "quotes_companyId_isExpired_idx" ON "quotes"("companyId", "isExpired");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_companyId_numero_key" ON "quotes"("companyId", "numero");

-- CreateIndex
CREATE INDEX "quote_items_quoteId_idx" ON "quote_items"("quoteId");

-- CreateIndex
CREATE INDEX "quote_items_productId_idx" ON "quote_items"("productId");

-- CreateIndex
CREATE INDEX "quote_attachments_quoteId_idx" ON "quote_attachments"("quoteId");

-- CreateIndex
CREATE INDEX "quote_versions_quoteId_idx" ON "quote_versions"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_access_token_key" ON "client_portal_access"("token");

-- CreateIndex
CREATE INDEX "client_portal_access_token_idx" ON "client_portal_access"("token");

-- CreateIndex
CREATE INDEX "client_portal_access_clientId_idx" ON "client_portal_access"("clientId");

-- CreateIndex
CREATE INDEX "client_portal_access_expiresAt_idx" ON "client_portal_access"("expiresAt");

-- CreateIndex
CREATE INDEX "client_contacts_clientId_idx" ON "client_contacts"("clientId");

-- CreateIndex
CREATE INDEX "client_contacts_companyId_idx" ON "client_contacts"("companyId");

-- CreateIndex
CREATE INDEX "client_contacts_email_idx" ON "client_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_clientId_email_key" ON "client_contacts"("clientId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_users_contactId_key" ON "client_portal_users"("contactId");

-- CreateIndex
CREATE INDEX "client_portal_users_clientId_idx" ON "client_portal_users"("clientId");

-- CreateIndex
CREATE INDEX "client_portal_users_companyId_idx" ON "client_portal_users"("companyId");

-- CreateIndex
CREATE INDEX "client_portal_users_email_idx" ON "client_portal_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_users_companyId_email_key" ON "client_portal_users"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_invites_token_key" ON "client_portal_invites"("token");

-- CreateIndex
CREATE INDEX "client_portal_invites_token_idx" ON "client_portal_invites"("token");

-- CreateIndex
CREATE INDEX "client_portal_invites_portalUserId_idx" ON "client_portal_invites"("portalUserId");

-- CreateIndex
CREATE INDEX "client_portal_invites_expiresAt_idx" ON "client_portal_invites"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_sessions_tokenHash_key" ON "client_portal_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "client_portal_sessions_tokenHash_idx" ON "client_portal_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "client_portal_sessions_portalUserId_idx" ON "client_portal_sessions"("portalUserId");

-- CreateIndex
CREATE INDEX "client_portal_sessions_expiresAt_idx" ON "client_portal_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_portal_orders_clientRequestId_key" ON "client_portal_orders"("clientRequestId");

-- CreateIndex
CREATE INDEX "client_portal_orders_companyId_idx" ON "client_portal_orders"("companyId");

-- CreateIndex
CREATE INDEX "client_portal_orders_clientId_idx" ON "client_portal_orders"("clientId");

-- CreateIndex
CREATE INDEX "client_portal_orders_estado_idx" ON "client_portal_orders"("estado");

-- CreateIndex
CREATE INDEX "client_portal_orders_createdAt_idx" ON "client_portal_orders"("createdAt");

-- CreateIndex
CREATE INDEX "client_portal_order_items_orderId_idx" ON "client_portal_order_items"("orderId");

-- CreateIndex
CREATE INDEX "client_portal_activity_portalUserId_idx" ON "client_portal_activity"("portalUserId");

-- CreateIndex
CREATE INDEX "client_portal_activity_clientId_idx" ON "client_portal_activity"("clientId");

-- CreateIndex
CREATE INDEX "client_portal_activity_companyId_idx" ON "client_portal_activity"("companyId");

-- CreateIndex
CREATE INDEX "client_portal_activity_action_idx" ON "client_portal_activity"("action");

-- CreateIndex
CREATE INDEX "client_portal_activity_createdAt_idx" ON "client_portal_activity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quote_acceptances_quoteId_key" ON "quote_acceptances"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quoteId_key" ON "sales"("quoteId");

-- CreateIndex
CREATE INDEX "sales_companyId_idx" ON "sales"("companyId");

-- CreateIndex
CREATE INDEX "sales_clientId_idx" ON "sales"("clientId");

-- CreateIndex
CREATE INDEX "sales_sellerId_idx" ON "sales"("sellerId");

-- CreateIndex
CREATE INDEX "sales_estado_idx" ON "sales"("estado");

-- CreateIndex
CREATE INDEX "sales_fechaEmision_idx" ON "sales"("fechaEmision");

-- CreateIndex
CREATE INDEX "sales_docType_idx" ON "sales"("docType");

-- CreateIndex
CREATE INDEX "sales_companyId_docType_idx" ON "sales"("companyId", "docType");

-- CreateIndex
CREATE INDEX "sales_companyId_docType_fechaEmision_idx" ON "sales"("companyId", "docType", "fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "sales_companyId_numero_key" ON "sales"("companyId", "numero");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "sale_deliveries_companyId_idx" ON "sale_deliveries"("companyId");

-- CreateIndex
CREATE INDEX "sale_deliveries_saleId_idx" ON "sale_deliveries"("saleId");

-- CreateIndex
CREATE INDEX "sale_deliveries_clientId_idx" ON "sale_deliveries"("clientId");

-- CreateIndex
CREATE INDEX "sale_deliveries_estado_idx" ON "sale_deliveries"("estado");

-- CreateIndex
CREATE INDEX "sale_deliveries_fechaEntrega_idx" ON "sale_deliveries"("fechaEntrega");

-- CreateIndex
CREATE INDEX "sale_deliveries_docType_idx" ON "sale_deliveries"("docType");

-- CreateIndex
CREATE INDEX "sale_deliveries_companyId_docType_idx" ON "sale_deliveries"("companyId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "sale_deliveries_companyId_numero_key" ON "sale_deliveries"("companyId", "numero");

-- CreateIndex
CREATE INDEX "sale_delivery_items_deliveryId_idx" ON "sale_delivery_items"("deliveryId");

-- CreateIndex
CREATE INDEX "sale_delivery_items_saleItemId_idx" ON "sale_delivery_items"("saleItemId");

-- CreateIndex
CREATE INDEX "sale_delivery_evidences_deliveryId_idx" ON "sale_delivery_evidences"("deliveryId");

-- CreateIndex
CREATE INDEX "sale_remitos_companyId_idx" ON "sale_remitos"("companyId");

-- CreateIndex
CREATE INDEX "sale_remitos_saleId_idx" ON "sale_remitos"("saleId");

-- CreateIndex
CREATE INDEX "sale_remitos_deliveryId_idx" ON "sale_remitos"("deliveryId");

-- CreateIndex
CREATE INDEX "sale_remitos_clientId_idx" ON "sale_remitos"("clientId");

-- CreateIndex
CREATE INDEX "sale_remitos_estado_idx" ON "sale_remitos"("estado");

-- CreateIndex
CREATE INDEX "sale_remitos_docType_idx" ON "sale_remitos"("docType");

-- CreateIndex
CREATE UNIQUE INDEX "sale_remitos_companyId_numero_key" ON "sale_remitos"("companyId", "numero");

-- CreateIndex
CREATE INDEX "sale_remito_items_remitoId_idx" ON "sale_remito_items"("remitoId");

-- CreateIndex
CREATE INDEX "sale_remito_items_saleItemId_idx" ON "sale_remito_items"("saleItemId");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_idx" ON "sales_invoices"("companyId");

-- CreateIndex
CREATE INDEX "sales_invoices_clientId_idx" ON "sales_invoices"("clientId");

-- CreateIndex
CREATE INDEX "sales_invoices_saleId_idx" ON "sales_invoices"("saleId");

-- CreateIndex
CREATE INDEX "sales_invoices_estado_idx" ON "sales_invoices"("estado");

-- CreateIndex
CREATE INDEX "sales_invoices_fechaEmision_idx" ON "sales_invoices"("fechaEmision");

-- CreateIndex
CREATE INDEX "sales_invoices_fechaVencimiento_idx" ON "sales_invoices"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "sales_invoices_cae_idx" ON "sales_invoices"("cae");

-- CreateIndex
CREATE INDEX "sales_invoices_docType_idx" ON "sales_invoices"("docType");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_docType_idx" ON "sales_invoices"("companyId", "docType");

-- CreateIndex
CREATE INDEX "sales_invoices_companyId_docType_fechaEmision_idx" ON "sales_invoices"("companyId", "docType", "fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_companyId_tipo_puntoVenta_numero_key" ON "sales_invoices"("companyId", "tipo", "puntoVenta", "numero");

-- CreateIndex
CREATE INDEX "sales_invoice_items_invoiceId_idx" ON "sales_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "sales_invoice_items_saleItemId_idx" ON "sales_invoice_items"("saleItemId");

-- CreateIndex
CREATE INDEX "sales_credit_debit_notes_companyId_idx" ON "sales_credit_debit_notes"("companyId");

-- CreateIndex
CREATE INDEX "sales_credit_debit_notes_clientId_idx" ON "sales_credit_debit_notes"("clientId");

-- CreateIndex
CREATE INDEX "sales_credit_debit_notes_facturaId_idx" ON "sales_credit_debit_notes"("facturaId");

-- CreateIndex
CREATE INDEX "sales_credit_debit_notes_tipo_idx" ON "sales_credit_debit_notes"("tipo");

-- CreateIndex
CREATE INDEX "sales_credit_debit_notes_estado_idx" ON "sales_credit_debit_notes"("estado");

-- CreateIndex
CREATE INDEX "sales_credit_debit_notes_docType_idx" ON "sales_credit_debit_notes"("docType");

-- CreateIndex
CREATE INDEX "sales_credit_debit_note_items_noteId_idx" ON "sales_credit_debit_note_items"("noteId");

-- CreateIndex
CREATE INDEX "client_payments_companyId_idx" ON "client_payments"("companyId");

-- CreateIndex
CREATE INDEX "client_payments_clientId_idx" ON "client_payments"("clientId");

-- CreateIndex
CREATE INDEX "client_payments_fechaPago_idx" ON "client_payments"("fechaPago");

-- CreateIndex
CREATE INDEX "client_payments_estado_idx" ON "client_payments"("estado");

-- CreateIndex
CREATE INDEX "client_payments_docType_idx" ON "client_payments"("docType");

-- CreateIndex
CREATE INDEX "client_payments_companyId_docType_idx" ON "client_payments"("companyId", "docType");

-- CreateIndex
CREATE INDEX "client_payments_companyId_docType_fechaPago_idx" ON "client_payments"("companyId", "docType", "fechaPago");

-- CreateIndex
CREATE UNIQUE INDEX "client_payments_companyId_numero_key" ON "client_payments"("companyId", "numero");

-- CreateIndex
CREATE INDEX "invoice_payment_allocations_paymentId_idx" ON "invoice_payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "invoice_payment_allocations_invoiceId_idx" ON "invoice_payment_allocations"("invoiceId");

-- CreateIndex
CREATE INDEX "client_payment_cheques_paymentId_idx" ON "client_payment_cheques"("paymentId");

-- CreateIndex
CREATE INDEX "client_payment_cheques_estado_idx" ON "client_payment_cheques"("estado");

-- CreateIndex
CREATE INDEX "client_ledger_entries_clientId_idx" ON "client_ledger_entries"("clientId");

-- CreateIndex
CREATE INDEX "client_ledger_entries_companyId_idx" ON "client_ledger_entries"("companyId");

-- CreateIndex
CREATE INDEX "client_ledger_entries_fecha_idx" ON "client_ledger_entries"("fecha");

-- CreateIndex
CREATE INDEX "client_ledger_entries_tipo_idx" ON "client_ledger_entries"("tipo");

-- CreateIndex
CREATE INDEX "client_ledger_entries_anulado_idx" ON "client_ledger_entries"("anulado");

-- CreateIndex
CREATE INDEX "sales_price_lists_companyId_idx" ON "sales_price_lists"("companyId");

-- CreateIndex
CREATE INDEX "sales_price_lists_isActive_idx" ON "sales_price_lists"("isActive");

-- CreateIndex
CREATE INDEX "sales_price_list_items_priceListId_idx" ON "sales_price_list_items"("priceListId");

-- CreateIndex
CREATE INDEX "sales_price_list_items_productId_idx" ON "sales_price_list_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_price_list_items_priceListId_productId_key" ON "sales_price_list_items"("priceListId", "productId");

-- CreateIndex
CREATE INDEX "sales_approvals_companyId_idx" ON "sales_approvals"("companyId");

-- CreateIndex
CREATE INDEX "sales_approvals_entidad_entidadId_idx" ON "sales_approvals"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "sales_approvals_estado_idx" ON "sales_approvals"("estado");

-- CreateIndex
CREATE INDEX "sales_audit_logs_companyId_idx" ON "sales_audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "sales_audit_logs_entidad_entidadId_idx" ON "sales_audit_logs"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "sales_audit_logs_userId_idx" ON "sales_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "sales_audit_logs_createdAt_idx" ON "sales_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "seller_kpis_sellerId_idx" ON "seller_kpis"("sellerId");

-- CreateIndex
CREATE INDEX "seller_kpis_periodo_idx" ON "seller_kpis"("periodo");

-- CreateIndex
CREATE INDEX "seller_kpis_companyId_idx" ON "seller_kpis"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "seller_kpis_sellerId_periodo_companyId_key" ON "seller_kpis"("sellerId", "periodo", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "modules_key_key" ON "modules"("key");

-- CreateIndex
CREATE INDEX "company_modules_companyId_idx" ON "company_modules"("companyId");

-- CreateIndex
CREATE INDEX "company_modules_moduleId_idx" ON "company_modules"("moduleId");

-- CreateIndex
CREATE INDEX "company_modules_isEnabled_idx" ON "company_modules"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "company_modules_companyId_moduleId_key" ON "company_modules"("companyId", "moduleId");

-- CreateIndex
CREATE INDEX "sale_acopios_companyId_idx" ON "sale_acopios"("companyId");

-- CreateIndex
CREATE INDEX "sale_acopios_clientId_idx" ON "sale_acopios"("clientId");

-- CreateIndex
CREATE INDEX "sale_acopios_saleId_idx" ON "sale_acopios"("saleId");

-- CreateIndex
CREATE INDEX "sale_acopios_estado_idx" ON "sale_acopios"("estado");

-- CreateIndex
CREATE INDEX "sale_acopios_fechaVencimiento_idx" ON "sale_acopios"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "sale_acopios_companyId_numero_key" ON "sale_acopios"("companyId", "numero");

-- CreateIndex
CREATE INDEX "sale_acopio_items_acopioId_idx" ON "sale_acopio_items"("acopioId");

-- CreateIndex
CREATE INDEX "sale_acopio_items_productId_idx" ON "sale_acopio_items"("productId");

-- CreateIndex
CREATE INDEX "acopio_retiros_acopioId_idx" ON "acopio_retiros"("acopioId");

-- CreateIndex
CREATE INDEX "acopio_retiros_companyId_idx" ON "acopio_retiros"("companyId");

-- CreateIndex
CREATE INDEX "acopio_retiros_fechaRetiro_idx" ON "acopio_retiros"("fechaRetiro");

-- CreateIndex
CREATE UNIQUE INDEX "acopio_retiros_companyId_numero_key" ON "acopio_retiros"("companyId", "numero");

-- CreateIndex
CREATE INDEX "acopio_retiro_items_retiroId_idx" ON "acopio_retiro_items"("retiroId");

-- CreateIndex
CREATE INDEX "acopio_retiro_items_acopioItemId_idx" ON "acopio_retiro_items"("acopioItemId");

-- CreateIndex
CREATE INDEX "cash_accounts_companyId_idx" ON "cash_accounts"("companyId");

-- CreateIndex
CREATE INDEX "cash_accounts_isActive_idx" ON "cash_accounts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_companyId_codigo_key" ON "cash_accounts"("companyId", "codigo");

-- CreateIndex
CREATE INDEX "cash_movements_cashAccountId_idx" ON "cash_movements"("cashAccountId");

-- CreateIndex
CREATE INDEX "cash_movements_companyId_idx" ON "cash_movements"("companyId");

-- CreateIndex
CREATE INDEX "cash_movements_fecha_idx" ON "cash_movements"("fecha");

-- CreateIndex
CREATE INDEX "cash_movements_tipo_idx" ON "cash_movements"("tipo");

-- CreateIndex
CREATE INDEX "cash_movements_docType_idx" ON "cash_movements"("docType");

-- CreateIndex
CREATE INDEX "bank_accounts_companyId_idx" ON "bank_accounts"("companyId");

-- CreateIndex
CREATE INDEX "bank_accounts_isActive_idx" ON "bank_accounts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_companyId_codigo_key" ON "bank_accounts"("companyId", "codigo");

-- CreateIndex
CREATE INDEX "bank_movements_bankAccountId_idx" ON "bank_movements"("bankAccountId");

-- CreateIndex
CREATE INDEX "bank_movements_companyId_idx" ON "bank_movements"("companyId");

-- CreateIndex
CREATE INDEX "bank_movements_fecha_idx" ON "bank_movements"("fecha");

-- CreateIndex
CREATE INDEX "bank_movements_conciliado_idx" ON "bank_movements"("conciliado");

-- CreateIndex
CREATE INDEX "cheques_companyId_idx" ON "cheques"("companyId");

-- CreateIndex
CREATE INDEX "cheques_estado_idx" ON "cheques"("estado");

-- CreateIndex
CREATE INDEX "cheques_fechaVencimiento_idx" ON "cheques"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "cheques_origen_idx" ON "cheques"("origen");

-- CreateIndex
CREATE INDEX "cheques_docType_idx" ON "cheques"("docType");

-- CreateIndex
CREATE INDEX "treasury_transfers_companyId_idx" ON "treasury_transfers"("companyId");

-- CreateIndex
CREATE INDEX "treasury_transfers_fecha_idx" ON "treasury_transfers"("fecha");

-- CreateIndex
CREATE INDEX "treasury_transfers_estado_idx" ON "treasury_transfers"("estado");

-- CreateIndex
CREATE INDEX "treasury_transfers_docType_idx" ON "treasury_transfers"("docType");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_transfers_companyId_numero_key" ON "treasury_transfers"("companyId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "company_templates_name_key" ON "company_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_name_key" ON "subscription_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_nextBillingDate_idx" ON "subscriptions"("nextBillingDate");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_type_idx" ON "invoice_items"("type");

-- CreateIndex
CREATE INDEX "billing_payments_invoiceId_idx" ON "billing_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "billing_payments_status_idx" ON "billing_payments"("status");

-- CreateIndex
CREATE INDEX "token_transactions_subscriptionId_idx" ON "token_transactions"("subscriptionId");

-- CreateIndex
CREATE INDEX "token_transactions_createdAt_idx" ON "token_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "token_transactions_type_idx" ON "token_transactions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "token_transactions_idempotencyKey_key" ON "token_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "billing_audit_log_entityType_entityId_idx" ON "billing_audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "billing_audit_log_createdAt_idx" ON "billing_audit_log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_coupons_code_key" ON "billing_coupons"("code");

-- CreateIndex
CREATE INDEX "billing_coupons_code_idx" ON "billing_coupons"("code");

-- CreateIndex
CREATE INDEX "billing_coupons_isActive_idx" ON "billing_coupons"("isActive");

-- CreateIndex
CREATE INDEX "billing_coupons_validFrom_validUntil_idx" ON "billing_coupons"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "billing_coupon_redemptions_subscriptionId_idx" ON "billing_coupon_redemptions"("subscriptionId");

-- CreateIndex
CREATE INDEX "billing_coupon_redemptions_couponId_idx" ON "billing_coupon_redemptions"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_coupon_redemptions_couponId_subscriptionId_key" ON "billing_coupon_redemptions"("couponId", "subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_auto_payment_configs_subscriptionId_key" ON "billing_auto_payment_configs"("subscriptionId");

-- CreateIndex
CREATE INDEX "billing_auto_payment_configs_subscriptionId_idx" ON "billing_auto_payment_configs"("subscriptionId");

-- CreateIndex
CREATE INDEX "billing_auto_payment_configs_provider_idx" ON "billing_auto_payment_configs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_configs_company_id_key" ON "payroll_configs"("company_id");

-- CreateIndex
CREATE INDEX "company_holidays_company_id_date_idx" ON "company_holidays"("company_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "company_holidays_company_id_date_key" ON "company_holidays"("company_id", "date");

-- CreateIndex
CREATE INDEX "salary_components_company_id_is_active_idx" ON "salary_components"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_company_id_code_key" ON "salary_components"("company_id", "code");

-- CreateIndex
CREATE INDEX "employee_salary_components_employee_id_effective_from_idx" ON "employee_salary_components"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_salary_components_component_id_idx" ON "employee_salary_components"("component_id");

-- CreateIndex
CREATE INDEX "payroll_periods_company_id_year_month_idx" ON "payroll_periods"("company_id", "year", "month");

-- CreateIndex
CREATE INDEX "payroll_periods_union_id_idx" ON "payroll_periods"("union_id");

-- CreateIndex
CREATE INDEX "payroll_periods_category_id_idx" ON "payroll_periods"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_company_id_year_month_period_type_union_id_key" ON "payroll_periods"("company_id", "year", "month", "period_type", "union_id");

-- CreateIndex
CREATE INDEX "payroll_inputs_period_id_idx" ON "payroll_inputs"("period_id");

-- CreateIndex
CREATE INDEX "payroll_inputs_employee_id_idx" ON "payroll_inputs"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_inputs_period_id_employee_id_input_key_key" ON "payroll_inputs"("period_id", "employee_id", "input_key");

-- CreateIndex
CREATE INDEX "payrolls_company_id_status_idx" ON "payrolls"("company_id", "status");

-- CreateIndex
CREATE INDEX "payrolls_period_id_idx" ON "payrolls"("period_id");

-- CreateIndex
CREATE INDEX "payroll_items_payroll_id_idx" ON "payroll_items"("payroll_id");

-- CreateIndex
CREATE INDEX "payroll_items_employee_id_idx" ON "payroll_items"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_items_payroll_id_employee_id_key" ON "payroll_items"("payroll_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_item_lines_payroll_item_id_idx" ON "payroll_item_lines"("payroll_item_id");

-- CreateIndex
CREATE INDEX "payroll_item_lines_code_idx" ON "payroll_item_lines"("code");

-- CreateIndex
CREATE INDEX "payroll_item_lines_component_id_idx" ON "payroll_item_lines"("component_id");

-- CreateIndex
CREATE INDEX "salary_advances_company_id_status_idx" ON "salary_advances"("company_id", "status");

-- CreateIndex
CREATE INDEX "salary_advances_employee_id_idx" ON "salary_advances"("employee_id");

-- CreateIndex
CREATE INDEX "salary_advances_payroll_id_idx" ON "salary_advances"("payroll_id");

-- CreateIndex
CREATE INDEX "advance_installments_advance_id_idx" ON "advance_installments"("advance_id");

-- CreateIndex
CREATE INDEX "advance_installments_due_period_id_status_idx" ON "advance_installments"("due_period_id", "status");

-- CreateIndex
CREATE INDEX "payroll_audit_logs_payroll_id_idx" ON "payroll_audit_logs"("payroll_id");

-- CreateIndex
CREATE INDEX "payroll_audit_logs_run_id_idx" ON "payroll_audit_logs"("run_id");

-- CreateIndex
CREATE INDEX "payroll_audit_logs_user_id_idx" ON "payroll_audit_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gremio_templates_code_key" ON "gremio_templates"("code");

-- CreateIndex
CREATE INDEX "gremio_category_templates_gremio_template_id_idx" ON "gremio_category_templates"("gremio_template_id");

-- CreateIndex
CREATE INDEX "payroll_unions_company_id_idx" ON "payroll_unions"("company_id");

-- CreateIndex
CREATE INDEX "payroll_unions_source_template_id_idx" ON "payroll_unions"("source_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_unions_company_id_name_key" ON "payroll_unions"("company_id", "name");

-- CreateIndex
CREATE INDEX "union_categories_union_id_idx" ON "union_categories"("union_id");

-- CreateIndex
CREATE UNIQUE INDEX "union_categories_union_id_name_key" ON "union_categories"("union_id", "name");

-- CreateIndex
CREATE INDEX "work_sectors_company_id_idx" ON "work_sectors"("company_id");

-- CreateIndex
CREATE INDEX "work_sectors_source_sector_id_idx" ON "work_sectors"("source_sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_sectors_company_id_name_key" ON "work_sectors"("company_id", "name");

-- CreateIndex
CREATE INDEX "work_positions_company_id_idx" ON "work_positions"("company_id");

-- CreateIndex
CREATE INDEX "work_positions_sector_id_idx" ON "work_positions"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_positions_company_id_sector_id_name_key" ON "work_positions"("company_id", "sector_id", "name");

-- CreateIndex
CREATE INDEX "agreement_rates_union_category_id_effective_from_idx" ON "agreement_rates"("union_category_id", "effective_from");

-- CreateIndex
CREATE INDEX "agreement_rates_category_id_effective_from_idx" ON "agreement_rates"("category_id", "effective_from");

-- CreateIndex
CREATE INDEX "agreement_rates_company_id_idx" ON "agreement_rates"("company_id");

-- CreateIndex
CREATE INDEX "category_default_concepts_union_category_id_idx" ON "category_default_concepts"("union_category_id");

-- CreateIndex
CREATE INDEX "category_default_concepts_category_id_idx" ON "category_default_concepts"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_default_concepts_union_category_id_component_id_key" ON "category_default_concepts"("union_category_id", "component_id");

-- CreateIndex
CREATE INDEX "employee_fixed_concepts_employee_id_effective_from_idx" ON "employee_fixed_concepts"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_fixed_concepts_component_id_idx" ON "employee_fixed_concepts"("component_id");

-- CreateIndex
CREATE INDEX "payroll_variable_concepts_period_id_employee_id_idx" ON "payroll_variable_concepts"("period_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_variable_concepts_status_idx" ON "payroll_variable_concepts"("status");

-- CreateIndex
CREATE INDEX "attendance_events_period_id_employee_id_idx" ON "attendance_events"("period_id", "employee_id");

-- CreateIndex
CREATE INDEX "attendance_events_event_type_idx" ON "attendance_events"("event_type");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE INDEX "payroll_runs_company_id_idx" ON "payroll_runs"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_period_id_run_number_key" ON "payroll_runs"("period_id", "run_number");

-- CreateIndex
CREATE INDEX "payroll_run_items_run_id_idx" ON "payroll_run_items"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_items_run_id_employee_id_key" ON "payroll_run_items"("run_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_run_item_lines_run_item_id_idx" ON "payroll_run_item_lines"("run_item_id");

-- CreateIndex
CREATE INDEX "payroll_run_item_lines_code_idx" ON "payroll_run_item_lines"("code");

-- CreateIndex
CREATE INDEX "payroll_run_item_lines_component_id_idx" ON "payroll_run_item_lines"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_cost_breakdowns_workOrderId_key" ON "maintenance_cost_breakdowns"("workOrderId");

-- CreateIndex
CREATE INDEX "maintenance_cost_breakdowns_companyId_idx" ON "maintenance_cost_breakdowns"("companyId");

-- CreateIndex
CREATE INDEX "maintenance_cost_breakdowns_calculatedAt_idx" ON "maintenance_cost_breakdowns"("calculatedAt");

-- CreateIndex
CREATE INDEX "technician_cost_rates_companyId_isActive_idx" ON "technician_cost_rates"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "technician_cost_rates_userId_companyId_effectiveFrom_key" ON "technician_cost_rates"("userId", "companyId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "third_party_costs_workOrderId_idx" ON "third_party_costs"("workOrderId");

-- CreateIndex
CREATE INDEX "third_party_costs_companyId_idx" ON "third_party_costs"("companyId");

-- CreateIndex
CREATE INDEX "maintenance_budgets_companyId_year_idx" ON "maintenance_budgets"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_budgets_companyId_year_month_sectorId_key" ON "maintenance_budgets"("companyId", "year", "month", "sectorId");

-- CreateIndex
CREATE INDEX "automation_rules_companyId_isActive_idx" ON "automation_rules"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "automation_rules_companyId_triggerType_idx" ON "automation_rules"("companyId", "triggerType");

-- CreateIndex
CREATE INDEX "automation_executions_ruleId_idx" ON "automation_executions"("ruleId");

-- CreateIndex
CREATE INDEX "automation_executions_companyId_startedAt_idx" ON "automation_executions"("companyId", "startedAt");

-- CreateIndex
CREATE INDEX "automation_executions_companyId_status_idx" ON "automation_executions"("companyId", "status");

-- CreateIndex
CREATE INDEX "ideas_companyId_status_idx" ON "ideas"("companyId", "status");

-- CreateIndex
CREATE INDEX "ideas_companyId_category_idx" ON "ideas"("companyId", "category");

-- CreateIndex
CREATE INDEX "ideas_companyId_createdAt_idx" ON "ideas"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ideas_machineId_idx" ON "ideas"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "idea_votes_ideaId_userId_key" ON "idea_votes"("ideaId", "userId");

-- CreateIndex
CREATE INDEX "idea_comments_ideaId_idx" ON "idea_comments"("ideaId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_system_configs_companyId_key" ON "cost_system_configs"("companyId");

-- CreateIndex
CREATE INDEX "monthly_cost_consolidations_companyId_month_idx" ON "monthly_cost_consolidations"("companyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_cost_consolidations_companyId_month_key" ON "monthly_cost_consolidations"("companyId", "month");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_performedById_idx" ON "audit_logs"("performedById");

-- CreateIndex
CREATE INDEX "audit_logs_performedAt_idx" ON "audit_logs"("performedAt");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_entityType_idx" ON "audit_logs"("companyId", "entityType");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_performedAt_idx" ON "audit_logs"("companyId", "performedAt");

-- CreateIndex
CREATE INDEX "loto_procedures_machineId_idx" ON "loto_procedures"("machineId");

-- CreateIndex
CREATE INDEX "loto_procedures_companyId_idx" ON "loto_procedures"("companyId");

-- CreateIndex
CREATE INDEX "loto_procedures_isActive_idx" ON "loto_procedures"("isActive");

-- CreateIndex
CREATE INDEX "permits_to_work_status_idx" ON "permits_to_work"("status");

-- CreateIndex
CREATE INDEX "permits_to_work_type_idx" ON "permits_to_work"("type");

-- CreateIndex
CREATE INDEX "permits_to_work_companyId_status_idx" ON "permits_to_work"("companyId", "status");

-- CreateIndex
CREATE INDEX "permits_to_work_workOrderId_idx" ON "permits_to_work"("workOrderId");

-- CreateIndex
CREATE INDEX "permits_to_work_machineId_idx" ON "permits_to_work"("machineId");

-- CreateIndex
CREATE INDEX "permits_to_work_validTo_idx" ON "permits_to_work"("validTo");

-- CreateIndex
CREATE UNIQUE INDEX "permits_to_work_number_companyId_key" ON "permits_to_work"("number", "companyId");

-- CreateIndex
CREATE INDEX "loto_executions_procedureId_idx" ON "loto_executions"("procedureId");

-- CreateIndex
CREATE INDEX "loto_executions_workOrderId_idx" ON "loto_executions"("workOrderId");

-- CreateIndex
CREATE INDEX "loto_executions_ptwId_idx" ON "loto_executions"("ptwId");

-- CreateIndex
CREATE INDEX "loto_executions_status_idx" ON "loto_executions"("status");

-- CreateIndex
CREATE INDEX "loto_executions_companyId_status_idx" ON "loto_executions"("companyId", "status");

-- CreateIndex
CREATE INDEX "component_failure_modes_componentId_idx" ON "component_failure_modes"("componentId");

-- CreateIndex
CREATE INDEX "component_failure_modes_companyId_idx" ON "component_failure_modes"("companyId");

-- CreateIndex
CREATE INDEX "component_failure_modes_category_idx" ON "component_failure_modes"("category");

-- CreateIndex
CREATE INDEX "component_failure_modes_rpn_idx" ON "component_failure_modes"("rpn");

-- CreateIndex
CREATE UNIQUE INDEX "component_failure_modes_componentId_name_key" ON "component_failure_modes"("componentId", "name");

-- CreateIndex
CREATE INDEX "skills_companyId_idx" ON "skills"("companyId");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE UNIQUE INDEX "skills_companyId_name_key" ON "skills"("companyId", "name");

-- CreateIndex
CREATE INDEX "user_skills_userId_idx" ON "user_skills"("userId");

-- CreateIndex
CREATE INDEX "user_skills_skillId_idx" ON "user_skills"("skillId");

-- CreateIndex
CREATE INDEX "user_skills_expiresAt_idx" ON "user_skills"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_userId_skillId_key" ON "user_skills"("userId", "skillId");

-- CreateIndex
CREATE INDEX "user_certifications_userId_idx" ON "user_certifications"("userId");

-- CreateIndex
CREATE INDEX "user_certifications_companyId_idx" ON "user_certifications"("companyId");

-- CreateIndex
CREATE INDEX "user_certifications_status_idx" ON "user_certifications"("status");

-- CreateIndex
CREATE INDEX "user_certifications_expiresAt_idx" ON "user_certifications"("expiresAt");

-- CreateIndex
CREATE INDEX "task_skill_requirements_skillId_idx" ON "task_skill_requirements"("skillId");

-- CreateIndex
CREATE INDEX "task_skill_requirements_companyId_idx" ON "task_skill_requirements"("companyId");

-- CreateIndex
CREATE INDEX "task_skill_requirements_checklistId_idx" ON "task_skill_requirements"("checklistId");

-- CreateIndex
CREATE INDEX "task_skill_requirements_machineId_idx" ON "task_skill_requirements"("machineId");

-- CreateIndex
CREATE INDEX "task_skill_requirements_maintenanceType_idx" ON "task_skill_requirements"("maintenanceType");

-- CreateIndex
CREATE INDEX "machine_counters_machineId_idx" ON "machine_counters"("machineId");

-- CreateIndex
CREATE INDEX "machine_counters_companyId_idx" ON "machine_counters"("companyId");

-- CreateIndex
CREATE INDEX "machine_counter_readings_counterId_idx" ON "machine_counter_readings"("counterId");

-- CreateIndex
CREATE INDEX "machine_counter_readings_recordedAt_idx" ON "machine_counter_readings"("recordedAt");

-- CreateIndex
CREATE INDEX "counter_maintenance_triggers_counterId_idx" ON "counter_maintenance_triggers"("counterId");

-- CreateIndex
CREATE INDEX "counter_maintenance_triggers_checklistId_idx" ON "counter_maintenance_triggers"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "management_of_change_mocNumber_key" ON "management_of_change"("mocNumber");

-- CreateIndex
CREATE INDEX "management_of_change_companyId_status_idx" ON "management_of_change"("companyId", "status");

-- CreateIndex
CREATE INDEX "management_of_change_machineId_idx" ON "management_of_change"("machineId");

-- CreateIndex
CREATE INDEX "management_of_change_requestedById_idx" ON "management_of_change"("requestedById");

-- CreateIndex
CREATE INDEX "moc_documents_mocId_idx" ON "moc_documents"("mocId");

-- CreateIndex
CREATE INDEX "moc_history_mocId_idx" ON "moc_history"("mocId");

-- CreateIndex
CREATE INDEX "moc_tasks_mocId_idx" ON "moc_tasks"("mocId");

-- CreateIndex
CREATE INDEX "work_shifts_companyId_isActive_idx" ON "work_shifts"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "work_shifts_companyId_code_key" ON "work_shifts"("companyId", "code");

-- CreateIndex
CREATE INDEX "work_centers_companyId_type_status_idx" ON "work_centers"("companyId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_centers_companyId_code_key" ON "work_centers"("companyId", "code");

-- CreateIndex
CREATE INDEX "production_reason_codes_companyId_type_isActive_idx" ON "production_reason_codes"("companyId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "production_reason_codes_companyId_code_key" ON "production_reason_codes"("companyId", "code");

-- CreateIndex
CREATE INDEX "production_orders_companyId_status_idx" ON "production_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "production_orders_productId_idx" ON "production_orders"("productId");

-- CreateIndex
CREATE INDEX "production_orders_workCenterId_idx" ON "production_orders"("workCenterId");

-- CreateIndex
CREATE INDEX "production_orders_plannedStartDate_idx" ON "production_orders"("plannedStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_companyId_code_key" ON "production_orders"("companyId", "code");

-- CreateIndex
CREATE INDEX "daily_production_reports_companyId_date_idx" ON "daily_production_reports"("companyId", "date");

-- CreateIndex
CREATE INDEX "daily_production_reports_productionOrderId_idx" ON "daily_production_reports"("productionOrderId");

-- CreateIndex
CREATE INDEX "daily_production_reports_operatorId_date_idx" ON "daily_production_reports"("operatorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_production_reports_companyId_offlineId_key" ON "daily_production_reports"("companyId", "offlineId");

-- CreateIndex
CREATE INDEX "production_downtimes_companyId_startTime_idx" ON "production_downtimes"("companyId", "startTime");

-- CreateIndex
CREATE INDEX "production_downtimes_reasonCodeId_idx" ON "production_downtimes"("reasonCodeId");

-- CreateIndex
CREATE INDEX "production_downtimes_workOrderId_idx" ON "production_downtimes"("workOrderId");

-- CreateIndex
CREATE INDEX "production_downtimes_machineId_startTime_idx" ON "production_downtimes"("machineId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "production_downtimes_companyId_offlineId_key" ON "production_downtimes"("companyId", "offlineId");

-- CreateIndex
CREATE INDEX "production_quality_controls_productionOrderId_idx" ON "production_quality_controls"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_quality_controls_batchLotId_idx" ON "production_quality_controls"("batchLotId");

-- CreateIndex
CREATE INDEX "production_quality_controls_result_idx" ON "production_quality_controls"("result");

-- CreateIndex
CREATE INDEX "production_defects_productionOrderId_idx" ON "production_defects"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_defects_reasonCodeId_idx" ON "production_defects"("reasonCodeId");

-- CreateIndex
CREATE INDEX "production_batch_lots_qualityStatus_idx" ON "production_batch_lots"("qualityStatus");

-- CreateIndex
CREATE INDEX "production_batch_lots_productionOrderId_idx" ON "production_batch_lots"("productionOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "production_batch_lots_companyId_lotCode_key" ON "production_batch_lots"("companyId", "lotCode");

-- CreateIndex
CREATE INDEX "production_events_entityType_entityId_idx" ON "production_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "production_events_productionOrderId_idx" ON "production_events"("productionOrderId");

-- CreateIndex
CREATE INDEX "production_events_performedAt_idx" ON "production_events"("performedAt");

-- CreateIndex
CREATE INDEX "production_routine_templates_companyId_isActive_idx" ON "production_routine_templates"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "production_routine_templates_companyId_code_key" ON "production_routine_templates"("companyId", "code");

-- CreateIndex
CREATE INDEX "production_routines_companyId_date_idx" ON "production_routines"("companyId", "date");

-- CreateIndex
CREATE INDEX "production_routines_companyId_status_idx" ON "production_routines"("companyId", "status");

-- CreateIndex
CREATE INDEX "production_routines_templateId_idx" ON "production_routines"("templateId");

-- CreateIndex
CREATE INDEX "production_resource_types_companyId_idx" ON "production_resource_types"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "production_resource_types_companyId_code_key" ON "production_resource_types"("companyId", "code");

-- CreateIndex
CREATE INDEX "production_resources_companyId_resourceTypeId_idx" ON "production_resources"("companyId", "resourceTypeId");

-- CreateIndex
CREATE INDEX "production_resources_companyId_status_idx" ON "production_resources"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "production_resources_companyId_code_key" ON "production_resources"("companyId", "code");

-- CreateIndex
CREATE INDEX "prestressed_molds_companyId_status_idx" ON "prestressed_molds"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prestressed_molds_companyId_code_key" ON "prestressed_molds"("companyId", "code");

-- CreateIndex
CREATE INDEX "curing_records_productionOrderId_idx" ON "curing_records"("productionOrderId");

-- CreateIndex
CREATE INDEX "curing_records_moldId_idx" ON "curing_records"("moldId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_purchase_logs_discordMessageId_key" ON "voice_purchase_logs"("discordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_purchase_logs_purchaseRequestId_key" ON "voice_purchase_logs"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "voice_purchase_logs_discordMessageId_idx" ON "voice_purchase_logs"("discordMessageId");

-- CreateIndex
CREATE INDEX "voice_purchase_logs_status_idx" ON "voice_purchase_logs"("status");

-- CreateIndex
CREATE INDEX "voice_purchase_logs_companyId_idx" ON "voice_purchase_logs"("companyId");

-- CreateIndex
CREATE INDEX "voice_purchase_logs_userId_idx" ON "voice_purchase_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_failure_logs_discordMessageId_key" ON "voice_failure_logs"("discordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_failure_logs_failureOccurrenceId_key" ON "voice_failure_logs"("failureOccurrenceId");

-- CreateIndex
CREATE INDEX "voice_failure_logs_discordMessageId_idx" ON "voice_failure_logs"("discordMessageId");

-- CreateIndex
CREATE INDEX "voice_failure_logs_audioHash_idx" ON "voice_failure_logs"("audioHash");

-- CreateIndex
CREATE INDEX "voice_failure_logs_status_idx" ON "voice_failure_logs"("status");

-- CreateIndex
CREATE INDEX "voice_failure_logs_companyId_idx" ON "voice_failure_logs"("companyId");

-- CreateIndex
CREATE INDEX "voice_failure_logs_userId_idx" ON "voice_failure_logs"("userId");

-- CreateIndex
CREATE INDEX "recurring_purchase_orders_companyId_idx" ON "recurring_purchase_orders"("companyId");

-- CreateIndex
CREATE INDEX "recurring_purchase_orders_isActive_idx" ON "recurring_purchase_orders"("isActive");

-- CreateIndex
CREATE INDEX "recurring_purchase_orders_proximaEjecucion_idx" ON "recurring_purchase_orders"("proximaEjecucion");

-- CreateIndex
CREATE INDEX "recurring_purchase_items_recurringOrderId_idx" ON "recurring_purchase_items"("recurringOrderId");

-- CreateIndex
CREATE INDEX "recurring_purchase_history_recurringOrderId_idx" ON "recurring_purchase_history"("recurringOrderId");

-- CreateIndex
CREATE INDEX "recurring_purchase_history_fechaEjecucion_idx" ON "recurring_purchase_history"("fechaEjecucion");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_tasks_discordMessageId_key" ON "agenda_tasks"("discordMessageId");

-- CreateIndex
CREATE INDEX "agenda_tasks_createdById_status_idx" ON "agenda_tasks"("createdById", "status");

-- CreateIndex
CREATE INDEX "agenda_tasks_assignedToUserId_idx" ON "agenda_tasks"("assignedToUserId");

-- CreateIndex
CREATE INDEX "agenda_tasks_assignedToContactId_idx" ON "agenda_tasks"("assignedToContactId");

-- CreateIndex
CREATE INDEX "agenda_tasks_companyId_dueDate_idx" ON "agenda_tasks"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "agenda_tasks_companyId_status_idx" ON "agenda_tasks"("companyId", "status");

-- CreateIndex
CREATE INDEX "agenda_reminders_userId_remindAt_isSent_idx" ON "agenda_reminders"("userId", "remindAt", "isSent");

-- CreateIndex
CREATE INDEX "agenda_reminders_companyId_idx" ON "agenda_reminders"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_task_logs_discordMessageId_key" ON "voice_task_logs"("discordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_task_logs_taskId_key" ON "voice_task_logs"("taskId");

-- CreateIndex
CREATE INDEX "voice_task_logs_discordUserId_idx" ON "voice_task_logs"("discordUserId");

-- CreateIndex
CREATE INDEX "voice_task_logs_status_idx" ON "voice_task_logs"("status");

-- CreateIndex
CREATE INDEX "voice_task_logs_companyId_idx" ON "voice_task_logs"("companyId");

-- CreateIndex
CREATE INDEX "stock_reservations_supplierItemId_warehouseId_idx" ON "stock_reservations"("supplierItemId", "warehouseId");

-- CreateIndex
CREATE INDEX "stock_reservations_estado_idx" ON "stock_reservations"("estado");

-- CreateIndex
CREATE INDEX "stock_reservations_companyId_idx" ON "stock_reservations"("companyId");

-- CreateIndex
CREATE INDEX "stock_reservations_materialRequestId_idx" ON "stock_reservations"("materialRequestId");

-- CreateIndex
CREATE INDEX "stock_reservations_productionOrderId_idx" ON "stock_reservations"("productionOrderId");

-- CreateIndex
CREATE INDEX "stock_reservations_workOrderId_idx" ON "stock_reservations"("workOrderId");

-- CreateIndex
CREATE INDEX "material_requests_companyId_estado_idx" ON "material_requests"("companyId", "estado");

-- CreateIndex
CREATE INDEX "material_requests_workOrderId_idx" ON "material_requests"("workOrderId");

-- CreateIndex
CREATE INDEX "material_requests_productionOrderId_idx" ON "material_requests"("productionOrderId");

-- CreateIndex
CREATE INDEX "material_requests_solicitanteId_idx" ON "material_requests"("solicitanteId");

-- CreateIndex
CREATE UNIQUE INDEX "material_requests_companyId_numero_key" ON "material_requests"("companyId", "numero");

-- CreateIndex
CREATE INDEX "material_request_items_requestId_idx" ON "material_request_items"("requestId");

-- CreateIndex
CREATE INDEX "material_request_items_supplierItemId_idx" ON "material_request_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "material_request_items_toolId_idx" ON "material_request_items"("toolId");

-- CreateIndex
CREATE INDEX "despachos_companyId_estado_idx" ON "despachos"("companyId", "estado");

-- CreateIndex
CREATE INDEX "despachos_workOrderId_idx" ON "despachos"("workOrderId");

-- CreateIndex
CREATE INDEX "despachos_productionOrderId_idx" ON "despachos"("productionOrderId");

-- CreateIndex
CREATE INDEX "despachos_fechaDespacho_idx" ON "despachos"("fechaDespacho");

-- CreateIndex
CREATE INDEX "despachos_warehouseId_idx" ON "despachos"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "despachos_companyId_numero_key" ON "despachos"("companyId", "numero");

-- CreateIndex
CREATE INDEX "despacho_items_despachoId_idx" ON "despacho_items"("despachoId");

-- CreateIndex
CREATE INDEX "despacho_items_supplierItemId_idx" ON "despacho_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "despacho_items_toolId_idx" ON "despacho_items"("toolId");

-- CreateIndex
CREATE INDEX "devoluciones_material_companyId_estado_idx" ON "devoluciones_material"("companyId", "estado");

-- CreateIndex
CREATE INDEX "devoluciones_material_despachoOrigenId_idx" ON "devoluciones_material"("despachoOrigenId");

-- CreateIndex
CREATE INDEX "devoluciones_material_warehouseId_idx" ON "devoluciones_material"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "devoluciones_material_companyId_numero_key" ON "devoluciones_material"("companyId", "numero");

-- CreateIndex
CREATE INDEX "devolucion_material_items_devolucionId_idx" ON "devolucion_material_items"("devolucionId");

-- CreateIndex
CREATE INDEX "devolucion_material_items_supplierItemId_idx" ON "devolucion_material_items"("supplierItemId");

-- CreateIndex
CREATE INDEX "devolucion_material_items_toolId_idx" ON "devolucion_material_items"("toolId");

-- CreateIndex
CREATE UNIQUE INDEX "user_warehouse_scopes_userId_warehouseId_key" ON "user_warehouse_scopes"("userId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "production_stock_configs_companyId_key" ON "production_stock_configs"("companyId");

-- CreateIndex
CREATE INDEX "compras_notifications_companyId_userId_idx" ON "compras_notifications"("companyId", "userId");

-- CreateIndex
CREATE INDEX "compras_notifications_companyId_read_idx" ON "compras_notifications"("companyId", "read");

-- CreateIndex
CREATE INDEX "compras_notifications_createdAt_idx" ON "compras_notifications"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "approval_workflows_companyId_isActive_idx" ON "approval_workflows"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "approval_workflow_levels_workflowId_idx" ON "approval_workflow_levels"("workflowId");

-- CreateIndex
CREATE INDEX "approval_instances_companyId_status_idx" ON "approval_instances"("companyId", "status");

-- CreateIndex
CREATE INDEX "approval_instances_entityType_entityId_idx" ON "approval_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_actions_instanceId_idx" ON "approval_actions"("instanceId");

-- CreateIndex
CREATE INDEX "approval_delegations_companyId_delegateeId_idx" ON "approval_delegations"("companyId", "delegateeId");

-- CreateIndex
CREATE INDEX "approval_delegations_validFrom_validUntil_idx" ON "approval_delegations"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "service_contracts_companyId_estado_idx" ON "service_contracts"("companyId", "estado");

-- CreateIndex
CREATE INDEX "service_contracts_companyId_tipo_idx" ON "service_contracts"("companyId", "tipo");

-- CreateIndex
CREATE INDEX "service_contracts_proveedorId_idx" ON "service_contracts"("proveedorId");

-- CreateIndex
CREATE INDEX "service_contracts_machineId_idx" ON "service_contracts"("machineId");

-- CreateIndex
CREATE INDEX "service_contracts_fechaFin_idx" ON "service_contracts"("fechaFin");

-- CreateIndex
CREATE UNIQUE INDEX "service_contracts_companyId_numero_key" ON "service_contracts"("companyId", "numero");

-- CreateIndex
CREATE INDEX "service_payments_contractId_idx" ON "service_payments"("contractId");

-- CreateIndex
CREATE INDEX "service_payments_companyId_estado_idx" ON "service_payments"("companyId", "estado");

-- CreateIndex
CREATE INDEX "service_payments_fechaVencimiento_idx" ON "service_payments"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "service_contract_alerts_contractId_idx" ON "service_contract_alerts"("contractId");

-- CreateIndex
CREATE INDEX "service_contract_alerts_companyId_enviada_idx" ON "service_contract_alerts"("companyId", "enviada");

-- CreateIndex
CREATE INDEX "service_contract_alerts_fechaAlerta_idx" ON "service_contract_alerts"("fechaAlerta");

-- CreateIndex
CREATE INDEX "document_sequences_companyId_idx" ON "document_sequences"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_companyId_docType_puntoVenta_key" ON "document_sequences"("companyId", "docType", "puntoVenta");

-- CreateIndex
CREATE INDEX "client_block_history_clientId_idx" ON "client_block_history"("clientId");

-- CreateIndex
CREATE INDEX "client_block_history_companyId_idx" ON "client_block_history"("companyId");

-- CreateIndex
CREATE INDEX "client_block_history_companyId_tipoBloqueo_idx" ON "client_block_history"("companyId", "tipoBloqueo");

-- CreateIndex
CREATE INDEX "client_block_history_bloqueadoAt_idx" ON "client_block_history"("bloqueadoAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_status_idx" ON "idempotency_keys"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_companyId_key_key" ON "idempotency_keys"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_movements_reversaDeId_key" ON "treasury_movements"("reversaDeId");

-- CreateIndex
CREATE INDEX "treasury_movements_companyId_idx" ON "treasury_movements"("companyId");

-- CreateIndex
CREATE INDEX "treasury_movements_companyId_docType_idx" ON "treasury_movements"("companyId", "docType");

-- CreateIndex
CREATE INDEX "treasury_movements_fecha_idx" ON "treasury_movements"("fecha");

-- CreateIndex
CREATE INDEX "treasury_movements_companyId_fecha_idx" ON "treasury_movements"("companyId", "fecha");

-- CreateIndex
CREATE INDEX "treasury_movements_accountType_cashAccountId_idx" ON "treasury_movements"("accountType", "cashAccountId");

-- CreateIndex
CREATE INDEX "treasury_movements_accountType_bankAccountId_idx" ON "treasury_movements"("accountType", "bankAccountId");

-- CreateIndex
CREATE INDEX "treasury_movements_conciliado_idx" ON "treasury_movements"("conciliado");

-- CreateIndex
CREATE INDEX "treasury_movements_referenceType_referenceId_idx" ON "treasury_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "load_orders_deliveryId_key" ON "load_orders"("deliveryId");

-- CreateIndex
CREATE INDEX "load_orders_companyId_idx" ON "load_orders"("companyId");

-- CreateIndex
CREATE INDEX "load_orders_companyId_docType_idx" ON "load_orders"("companyId", "docType");

-- CreateIndex
CREATE INDEX "load_orders_saleId_idx" ON "load_orders"("saleId");

-- CreateIndex
CREATE INDEX "load_orders_estado_idx" ON "load_orders"("estado");

-- CreateIndex
CREATE INDEX "load_orders_fecha_idx" ON "load_orders"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "load_orders_companyId_numero_key" ON "load_orders"("companyId", "numero");

-- CreateIndex
CREATE INDEX "load_order_items_loadOrderId_idx" ON "load_order_items"("loadOrderId");

-- CreateIndex
CREATE INDEX "load_order_items_saleItemId_idx" ON "load_order_items"("saleItemId");

-- CreateIndex
CREATE INDEX "cash_deposits_companyId_idx" ON "cash_deposits"("companyId");

-- CreateIndex
CREATE INDEX "cash_deposits_companyId_docType_idx" ON "cash_deposits"("companyId", "docType");

-- CreateIndex
CREATE INDEX "cash_deposits_estado_idx" ON "cash_deposits"("estado");

-- CreateIndex
CREATE INDEX "cash_deposits_cashAccountId_idx" ON "cash_deposits"("cashAccountId");

-- CreateIndex
CREATE INDEX "cash_deposits_bankAccountId_idx" ON "cash_deposits"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_deposits_companyId_numero_key" ON "cash_deposits"("companyId", "numero");

-- CreateIndex
CREATE INDEX "cash_closings_companyId_idx" ON "cash_closings"("companyId");

-- CreateIndex
CREATE INDEX "cash_closings_companyId_docType_idx" ON "cash_closings"("companyId", "docType");

-- CreateIndex
CREATE INDEX "cash_closings_fecha_idx" ON "cash_closings"("fecha");

-- CreateIndex
CREATE INDEX "cash_closings_estado_idx" ON "cash_closings"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "cash_closings_cashAccountId_fecha_key" ON "cash_closings"("cashAccountId", "fecha");

-- CreateIndex
CREATE INDEX "bank_statements_companyId_idx" ON "bank_statements"("companyId");

-- CreateIndex
CREATE INDEX "bank_statements_companyId_docType_idx" ON "bank_statements"("companyId", "docType");

-- CreateIndex
CREATE INDEX "bank_statements_estado_idx" ON "bank_statements"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statements_bankAccountId_periodo_key" ON "bank_statements"("bankAccountId", "periodo");

-- CreateIndex
CREATE INDEX "bank_statement_items_statementId_idx" ON "bank_statement_items"("statementId");

-- CreateIndex
CREATE INDEX "bank_statement_items_conciliado_idx" ON "bank_statement_items"("conciliado");

-- CreateIndex
CREATE INDEX "bank_statement_items_esSuspense_idx" ON "bank_statement_items"("esSuspense");

-- CreateIndex
CREATE INDEX "pickup_slots_companyId_idx" ON "pickup_slots"("companyId");

-- CreateIndex
CREATE INDEX "pickup_slots_fecha_idx" ON "pickup_slots"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_slots_companyId_fecha_horaInicio_key" ON "pickup_slots"("companyId", "fecha", "horaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_reservations_saleId_key" ON "pickup_reservations"("saleId");

-- CreateIndex
CREATE INDEX "pickup_reservations_slotId_idx" ON "pickup_reservations"("slotId");

-- CreateIndex
CREATE INDEX "pickup_reservations_companyId_idx" ON "pickup_reservations"("companyId");

-- CreateIndex
CREATE INDEX "pickup_reservations_companyId_estado_idx" ON "pickup_reservations"("companyId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "afip_config_companyId_key" ON "afip_config"("companyId");

-- CreateIndex
CREATE INDEX "pricing_rules_companyId_idx" ON "pricing_rules"("companyId");

-- CreateIndex
CREATE INDEX "pricing_rules_companyId_activo_idx" ON "pricing_rules"("companyId", "activo");

-- CreateIndex
CREATE INDEX "pricing_rules_clientId_idx" ON "pricing_rules"("clientId");

-- CreateIndex
CREATE INDEX "pricing_rules_productId_idx" ON "pricing_rules"("productId");

-- CreateIndex
CREATE INDEX "collection_actions_companyId_idx" ON "collection_actions"("companyId");

-- CreateIndex
CREATE INDEX "collection_actions_clientId_idx" ON "collection_actions"("clientId");

-- CreateIndex
CREATE INDEX "collection_actions_estado_idx" ON "collection_actions"("estado");

-- CreateIndex
CREATE INDEX "payment_disputes_companyId_idx" ON "payment_disputes"("companyId");

-- CreateIndex
CREATE INDEX "payment_disputes_clientId_idx" ON "payment_disputes"("clientId");

-- CreateIndex
CREATE INDEX "payment_disputes_estado_idx" ON "payment_disputes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "payment_disputes_companyId_numero_key" ON "payment_disputes"("companyId", "numero");

-- CreateIndex
CREATE INDEX "_OwnedCompanies_B_index" ON "_OwnedCompanies"("B");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_primaryAdminId_fkey" FOREIGN KEY ("primaryAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "company_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnCompany" ADD CONSTRAINT "UserOnCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnCompany" ADD CONSTRAINT "UserOnCompany_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnCompany" ADD CONSTRAINT "UserOnCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDiscordAccess" ADD CONSTRAINT "UserDiscordAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDiscordAccess" ADD CONSTRAINT "UserDiscordAccess_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDiscordAccess" ADD CONSTRAINT "UserDiscordAccess_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantZone" ADD CONSTRAINT "PlantZone_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlantZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantZone" ADD CONSTRAINT "PlantZone_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantZone" ADD CONSTRAINT "PlantZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadMovil" ADD CONSTRAINT "UnidadMovil_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadMovil" ADD CONSTRAINT "UnidadMovil_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KilometrajeLog" ADD CONSTRAINT "KilometrajeLog_unidadMovilId_fkey" FOREIGN KEY ("unidadMovilId") REFERENCES "UnidadMovil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KilometrajeLog" ADD CONSTRAINT "KilometrajeLog_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KilometrajeLog" ADD CONSTRAINT "KilometrajeLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_plantZoneId_fkey" FOREIGN KEY ("plantZoneId") REFERENCES "PlantZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_import_jobs" ADD CONSTRAINT "machine_import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_import_files" ADD CONSTRAINT "machine_import_files_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "machine_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_import_file_analyses" ADD CONSTRAINT "machine_import_file_analyses_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "machine_import_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_import_file_analyses" ADD CONSTRAINT "machine_import_file_analyses_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "machine_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolMovement" ADD CONSTRAINT "ToolMovement_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_pickedById_fkey" FOREIGN KEY ("pickedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_reservations" ADD CONSTRAINT "spare_part_reservations_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolMachine" ADD CONSTRAINT "ToolMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolMachine" ADD CONSTRAINT "ToolMachine_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentTool" ADD CONSTRAINT "ComponentTool_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "intervention_kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentTool" ADD CONSTRAINT "ComponentTool_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentTool" ADD CONSTRAINT "ComponentTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_kits" ADD CONSTRAINT "intervention_kits_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorTool" ADD CONSTRAINT "SectorTool_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectorTool" ADD CONSTRAINT "SectorTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_suppliers" ADD CONSTRAINT "inventory_item_suppliers_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "inventory_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_installations" ADD CONSTRAINT "lot_installations_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_unidadMovilId_fkey" FOREIGN KEY ("unidadMovilId") REFERENCES "UnidadMovil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_workStationId_fkey" FOREIGN KEY ("workStationId") REFERENCES "WorkStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failures" ADD CONSTRAINT "failures_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_failureId_fkey" FOREIGN KEY ("failureId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_failureTypeId_fkey" FOREIGN KEY ("failureTypeId") REFERENCES "failures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_linkedToOccurrenceId_fkey" FOREIGN KEY ("linkedToOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrences" ADD CONSTRAINT "failure_occurrences_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_solutions" ADD CONSTRAINT "failure_solutions_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_solutions" ADD CONSTRAINT "failure_solutions_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_applications" ADD CONSTRAINT "solution_applications_failureSolutionId_fkey" FOREIGN KEY ("failureSolutionId") REFERENCES "failure_solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_applications" ADD CONSTRAINT "solution_applications_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_applications" ADD CONSTRAINT "solution_applications_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_applications" ADD CONSTRAINT "solution_applications_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderComment" ADD CONSTRAINT "WorkOrderComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderComment" ADD CONSTRAINT "WorkOrderComment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderAttachment" ADD CONSTRAINT "WorkOrderAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderAttachment" ADD CONSTRAINT "WorkOrderAttachment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTask" ADD CONSTRAINT "FixedTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTask" ADD CONSTRAINT "FixedTask_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTask" ADD CONSTRAINT "FixedTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTask" ADD CONSTRAINT "FixedTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskInstructive" ADD CONSTRAINT "FixedTaskInstructive_fixedTaskId_fkey" FOREIGN KEY ("fixedTaskId") REFERENCES "FixedTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_fixedTaskId_fkey" FOREIGN KEY ("fixedTaskId") REFERENCES "FixedTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedTaskExecution" ADD CONSTRAINT "FixedTaskExecution_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolRequest" ADD CONSTRAINT "ToolRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolRequest" ADD CONSTRAINT "ToolRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInteraction" ADD CONSTRAINT "ContactInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInteraction" ADD CONSTRAINT "ContactInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_purchaseInputId_fkey" FOREIGN KEY ("purchaseInputId") REFERENCES "InputItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCostLog" ADD CONSTRAINT "ProductCostLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCostLog" ADD CONSTRAINT "ProductCostLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock_movements" ADD CONSTRAINT "product_stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock_movements" ADD CONSTRAINT "product_stock_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock_movements" ADD CONSTRAINT "product_stock_movements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStation" ADD CONSTRAINT "WorkStation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStation" ADD CONSTRAINT "WorkStation_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStationInstructive" ADD CONSTRAINT "WorkStationInstructive_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStationInstructive" ADD CONSTRAINT "WorkStationInstructive_workStationId_fkey" FOREIGN KEY ("workStationId") REFERENCES "WorkStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStationMachine" ADD CONSTRAINT "WorkStationMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStationMachine" ADD CONSTRAINT "WorkStationMachine_workStationId_fkey" FOREIGN KEY ("workStationId") REFERENCES "WorkStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStationComponent" ADD CONSTRAINT "WorkStationComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkStationComponent" ADD CONSTRAINT "WorkStationComponent_workStationId_fkey" FOREIGN KEY ("workStationId") REFERENCES "WorkStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProduct" ADD CONSTRAINT "CostProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostProduct" ADD CONSTRAINT "CostProduct_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputItem" ADD CONSTRAINT "InputItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputItem" ADD CONSTRAINT "InputItem_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputPriceHistory" ADD CONSTRAINT "InputPriceHistory_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "InputItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEmployee" ADD CONSTRAINT "CostEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEmployee" ADD CONSTRAINT "CostEmployee_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompHistory" ADD CONSTRAINT "EmployeeCompHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "CostEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyIndirect" ADD CONSTRAINT "MonthlyIndirect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyIndirect" ADD CONSTRAINT "MonthlyIndirect_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "IndirectItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectItem" ADD CONSTRAINT "IndirectItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectPriceHistory" ADD CONSTRAINT "IndirectPriceHistory_indirectId_fkey" FOREIGN KEY ("indirectId") REFERENCES "IndirectItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalAllocation" ADD CONSTRAINT "GlobalAllocation_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "InputItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YieldConfig" ADD CONSTRAINT "YieldConfig_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerUnitBOM" ADD CONSTRAINT "PerUnitBOM_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "InputItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerUnitBOM" ADD CONSTRAINT "PerUnitBOM_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumetricParam" ADD CONSTRAINT "VolumetricParam_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRun" ADD CONSTRAINT "BatchRun_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyProduction" ADD CONSTRAINT "MonthlyProduction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyProduction" ADD CONSTRAINT "MonthlyProduction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCostHistory" ADD CONSTRAINT "ProductCostHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCostHistory" ADD CONSTRAINT "ProductCostHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettingsCosting" ADD CONSTRAINT "CompanySettingsCosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostVarianceMonthly" ADD CONSTRAINT "CostVarianceMonthly_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostVarianceMonthly" ADD CONSTRAINT "CostVarianceMonthly_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactPnLMonthly" ADD CONSTRAINT "FactPnLMonthly_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactPurchasesMonthly" ADD CONSTRAINT "FactPurchasesMonthly_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactSalesMonthly" ADD CONSTRAINT "FactSalesMonthly_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectItemAllocation" ADD CONSTRAINT "IndirectItemAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "IndirectItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectItemAllocation" ADD CONSTRAINT "IndirectItemAllocation_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectItemAllocationMonthly" ADD CONSTRAINT "IndirectItemAllocationMonthly_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "IndirectItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectItemAllocationMonthly" ADD CONSTRAINT "IndirectItemAllocationMonthly_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodConversion" ADD CONSTRAINT "MethodConversion_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "ProductionMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodProductYield" ADD CONSTRAINT "MethodProductYield_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "ProductionMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodProductYield" ADD CONSTRAINT "MethodProductYield_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodProductYield" ADD CONSTRAINT "MethodProductYield_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStandardCost" ADD CONSTRAINT "ProductStandardCost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStandardCost" ADD CONSTRAINT "ProductStandardCost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMethod" ADD CONSTRAINT "ProductionMethod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAllocation" ADD CONSTRAINT "ZoneAllocation_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAllocation" ADD CONSTRAINT "ZoneAllocation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAllocationMonthly" ADD CONSTRAINT "ZoneAllocationMonthly_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAllocationMonthly" ADD CONSTRAINT "ZoneAllocationMonthly_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklists" ADD CONSTRAINT "maintenance_checklists_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_order" ADD CONSTRAINT "machine_order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_order" ADD CONSTRAINT "machine_order_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_categories" ADD CONSTRAINT "fk_employee_categories_company" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "fk_employees_category" FOREIGN KEY ("category_id") REFERENCES "employee_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "fk_employees_company" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_union_category_id_fkey" FOREIGN KEY ("union_category_id") REFERENCES "union_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_sector_id_fkey" FOREIGN KEY ("work_sector_id") REFERENCES "work_sectors"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_salary_history" ADD CONSTRAINT "fk_employee_salary_history_company" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_salary_history" ADD CONSTRAINT "fk_employee_salary_history_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_monthly_salaries" ADD CONSTRAINT "employee_monthly_salaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_monthly_salaries" ADD CONSTRAINT "employee_monthly_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "indirect_costs" ADD CONSTRAINT "indirect_costs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "indirect_cost_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "indirect_cost_history" ADD CONSTRAINT "indirect_cost_history_cost_id_fkey" FOREIGN KEY ("cost_id") REFERENCES "indirect_costs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "indirect_cost_base" ADD CONSTRAINT "indirect_cost_base_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "indirect_cost_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "indirect_cost_change_history" ADD CONSTRAINT "indirect_cost_change_history_cost_base_id_fkey" FOREIGN KEY ("cost_base_id") REFERENCES "indirect_cost_base"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "indirect_cost_change_history" ADD CONSTRAINT "indirect_cost_change_history_monthly_record_id_fkey" FOREIGN KEY ("monthly_record_id") REFERENCES "indirect_cost_monthly_records"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "indirect_cost_monthly_records" ADD CONSTRAINT "indirect_cost_monthly_records_cost_base_id_fkey" FOREIGN KEY ("cost_base_id") REFERENCES "indirect_cost_base"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_subcategories" ADD CONSTRAINT "product_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "product_subcategories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_solicitadoPor_fkey" FOREIGN KEY ("solicitadoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_rechazadoPor_fkey" FOREIGN KEY ("rechazadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_change_requests" ADD CONSTRAINT "supplier_change_requests_segundoAprobadorId_fkey" FOREIGN KEY ("segundoAprobadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_categories" ADD CONSTRAINT "supply_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_categories" ADD CONSTRAINT "supply_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "supply_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "supply_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_notaCreditoDebitoId_fkey" FOREIGN KEY ("notaCreditoDebitoId") REFERENCES "credit_debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_conciliadoBy_fkey" FOREIGN KEY ("conciliadoBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_monthly_prices" ADD CONSTRAINT "supply_monthly_prices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supply_monthly_prices" ADD CONSTRAINT "supply_monthly_prices_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supply_price_history" ADD CONSTRAINT "supply_price_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supply_price_history" ADD CONSTRAINT "supply_price_history_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "product_subcategories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_cost_tests" ADD CONSTRAINT "fk_recipe_cost_tests_company" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_change_history" ADD CONSTRAINT "recipe_change_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_change_history" ADD CONSTRAINT "recipe_change_history_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PriceComparison" ADD CONSTRAINT "PriceComparison_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceComparisonCompetitor" ADD CONSTRAINT "PriceComparisonCompetitor_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "PriceComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceComparisonProductPrice" ADD CONSTRAINT "PriceComparisonProductPrice_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "PriceComparisonCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBase" ADD CONSTRAINT "TaxBase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxBase" ADD CONSTRAINT "TaxBase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_taxBaseId_fkey" FOREIGN KEY ("taxBaseId") REFERENCES "TaxBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Load" ADD CONSTRAINT "Load_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadItem" ADD CONSTRAINT "LoadItem_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "Load"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientType" ADD CONSTRAINT "ClientType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportCompany" ADD CONSTRAINT "TransportCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSector" ADD CONSTRAINT "BusinessSector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_defaultPriceListId_fkey" FOREIGN KEY ("defaultPriceListId") REFERENCES "sales_price_lists"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_clientTypeId_fkey" FOREIGN KEY ("clientTypeId") REFERENCES "ClientType"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_blockedByUserId_fkey" FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_transportCompanyId_fkey" FOREIGN KEY ("transportCompanyId") REFERENCES "TransportCompany"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessSectorId_fkey" FOREIGN KEY ("businessSectorId") REFERENCES "BusinessSector"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_discountListId_fkey" FOREIGN KEY ("discountListId") REFERENCES "DiscountList"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_parentClientId_fkey" FOREIGN KEY ("parentClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ClientDiscount" ADD CONSTRAINT "ClientDiscount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPriceList" ADD CONSTRAINT "ClientPriceList_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountList" ADD CONSTRAINT "DiscountList_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountListRubro" ADD CONSTRAINT "DiscountListRubro_discountListId_fkey" FOREIGN KEY ("discountListId") REFERENCES "DiscountList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountListRubro" ADD CONSTRAINT "DiscountListRubro_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountListProduct" ADD CONSTRAINT "DiscountListProduct_discountListId_fkey" FOREIGN KEY ("discountListId") REFERENCES "DiscountList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountListProduct" ADD CONSTRAINT "DiscountListProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseAccount" ADD CONSTRAINT "PurchaseAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_tipoCuentaId_fkey" FOREIGN KEY ("tipoCuentaId") REFERENCES "PurchaseAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_ingresoConfirmadoPor_fkey" FOREIGN KEY ("ingresoConfirmadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_pagoForzadoPor_fkey" FOREIGN KEY ("pagoForzadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_validadaPor_fkey" FOREIGN KEY ("validadaPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_payApprovedBy_fkey" FOREIGN KEY ("payApprovedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrderReceipt" ADD CONSTRAINT "PaymentOrderReceipt_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrderReceipt" ADD CONSTRAINT "PaymentOrderReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrderCheque" ADD CONSTRAINT "PaymentOrderCheque_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrderAttachment" ADD CONSTRAINT "PaymentOrderAttachment_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_allocations" ADD CONSTRAINT "supplier_credit_allocations_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_allocations" ADD CONSTRAINT "supplier_credit_allocations_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_allocations" ADD CONSTRAINT "supplier_credit_allocations_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "credit_debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_executions" ADD CONSTRAINT "checklist_executions_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_executions" ADD CONSTRAINT "checklist_executions_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_configs" ADD CONSTRAINT "maintenance_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_configs" ADD CONSTRAINT "maintenance_configs_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_configs" ADD CONSTRAINT "user_dashboard_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_configs" ADD CONSTRAINT "user_dashboard_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_color_preferences" ADD CONSTRAINT "user_color_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_color_preferences" ADD CONSTRAINT "user_color_preferences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptom_library" ADD CONSTRAINT "symptom_library_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_returnToProductionBy_fkey" FOREIGN KEY ("returnToProductionBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_assurance" ADD CONSTRAINT "quality_assurance_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_assurance" ADD CONSTRAINT "quality_assurance_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_assurance" ADD CONSTRAINT "quality_assurance_returnConfirmedById_fkey" FOREIGN KEY ("returnConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_watchers" ADD CONSTRAINT "failure_watchers_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_watchers" ADD CONSTRAINT "failure_watchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_watchers" ADD CONSTRAINT "work_order_watchers_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_watchers" ADD CONSTRAINT "work_order_watchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrence_comments" ADD CONSTRAINT "failure_occurrence_comments_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrence_comments" ADD CONSTRAINT "failure_occurrence_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_templateUsedId_fkey" FOREIGN KEY ("templateUsedId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solutions_applied" ADD CONSTRAINT "solutions_applied_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_settings" ADD CONSTRAINT "corrective_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrence_events" ADD CONSTRAINT "failure_occurrence_events_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrence_events" ADD CONSTRAINT "failure_occurrence_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrence_events" ADD CONSTRAINT "failure_occurrence_events_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failure_occurrence_events" ADD CONSTRAINT "failure_occurrence_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_cause_analyses" ADD CONSTRAINT "root_cause_analyses_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_cause_analyses" ADD CONSTRAINT "root_cause_analyses_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_cause_analyses" ADD CONSTRAINT "root_cause_analyses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "root_cause_analyses" ADD CONSTRAINT "root_cause_analyses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_checklist_templates" ADD CONSTRAINT "corrective_checklist_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklists" ADD CONSTRAINT "work_order_checklists_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklists" ADD CONSTRAINT "work_order_checklists_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "corrective_checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklists" ADD CONSTRAINT "work_order_checklists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_checklists" ADD CONSTRAINT "work_order_checklists_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_embeddings" ADD CONSTRAINT "assistant_embeddings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_action_logs" ADD CONSTRAINT "assistant_action_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_action_logs" ADD CONSTRAINT "assistant_action_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_dailyProductionReportId_fkey" FOREIGN KEY ("dailyProductionReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "stock_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_warehouseOrigenId_fkey" FOREIGN KEY ("warehouseOrigenId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_warehouseDestinoId_fkey" FOREIGN KEY ("warehouseDestinoId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rechazadoPor_fkey" FOREIGN KEY ("rechazadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaseQuotationId_fkey" FOREIGN KEY ("purchaseQuotationId") REFERENCES "purchase_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_regularizedBy_fkey" FOREIGN KEY ("regularizedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grni_accruals" ADD CONSTRAINT "grni_accruals_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_notes" ADD CONSTRAINT "credit_debit_notes_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_notes" ADD CONSTRAINT "credit_debit_notes_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_notes" ADD CONSTRAINT "credit_debit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_notes" ADD CONSTRAINT "credit_debit_notes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_notes" ADD CONSTRAINT "credit_debit_notes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "credit_note_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_notes" ADD CONSTRAINT "credit_debit_notes_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "purchase_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_note_items" ADD CONSTRAINT "credit_debit_note_items_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "credit_debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_debit_note_items" ADD CONSTRAINT "credit_debit_note_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_requests" ADD CONSTRAINT "credit_note_requests_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_requests" ADD CONSTRAINT "credit_note_requests_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_requests" ADD CONSTRAINT "credit_note_requests_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_requests" ADD CONSTRAINT "credit_note_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_requests" ADD CONSTRAINT "credit_note_requests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_request_items" ADD CONSTRAINT "credit_note_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "credit_note_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_request_items" ADD CONSTRAINT "credit_note_request_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_line_results" ADD CONSTRAINT "match_line_results_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exceptions" ADD CONSTRAINT "match_exceptions_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exceptions" ADD CONSTRAINT "match_exceptions_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exceptions" ADD CONSTRAINT "match_exceptions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exceptions" ADD CONSTRAINT "match_exceptions_escalatedTo_fkey" FOREIGN KEY ("escalatedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_configs" ADD CONSTRAINT "purchase_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exception_sla_configs" ADD CONSTRAINT "match_exception_sla_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exception_history" ADD CONSTRAINT "match_exception_history_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "match_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_exception_history" ADD CONSTRAINT "match_exception_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_rules" ADD CONSTRAINT "sod_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_violations" ADD CONSTRAINT "sod_violations_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "sod_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_violations" ADD CONSTRAINT "sod_violations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sod_violations" ADD CONSTRAINT "sod_violations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_asignadoA_fkey" FOREIGN KEY ("asignadoA") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_referenciaId_fkey" FOREIGN KEY ("referenciaId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_aliases" ADD CONSTRAINT "supplier_item_aliases_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_rechazadoPor_fkey" FOREIGN KEY ("rechazadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_receipts" ADD CONSTRAINT "payment_request_receipts_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_receipts" ADD CONSTRAINT "payment_request_receipts_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_logs" ADD CONSTRAINT "payment_request_logs_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_logs" ADD CONSTRAINT "payment_request_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "PurchaseReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_creditNoteRequestId_fkey" FOREIGN KEY ("creditNoteRequestId") REFERENCES "credit_note_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "goods_receipt_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_suggestions" ADD CONSTRAINT "replenishment_suggestions_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_suggestions" ADD CONSTRAINT "replenishment_suggestions_proveedorSugerido_fkey" FOREIGN KEY ("proveedorSugerido") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_lead_times" ADD CONSTRAINT "supplier_lead_times_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_lead_times" ADD CONSTRAINT "supplier_lead_times_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_audit_logs" ADD CONSTRAINT "purchase_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotations" ADD CONSTRAINT "purchase_quotations_seleccionadaPor_fkey" FOREIGN KEY ("seleccionadaPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "purchase_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "purchase_request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotation_items" ADD CONSTRAINT "purchase_quotation_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "purchase_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_quotation_settings" ADD CONSTRAINT "company_quotation_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_comments" ADD CONSTRAINT "purchase_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_comments" ADD CONSTRAINT "purchase_comments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_view_config" ADD CONSTRAINT "company_view_config_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_two_factor" ADD CONSTRAINT "user_two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_config" ADD CONSTRAINT "sales_config_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_attachments" ADD CONSTRAINT "quote_attachments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_access" ADD CONSTRAINT "client_portal_access_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_invites" ADD CONSTRAINT "client_portal_invites_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_invites" ADD CONSTRAINT "client_portal_invites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_sessions" ADD CONSTRAINT "client_portal_sessions_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_sessions" ADD CONSTRAINT "client_portal_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_orders" ADD CONSTRAINT "client_portal_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_orders" ADD CONSTRAINT "client_portal_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_orders" ADD CONSTRAINT "client_portal_orders_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "client_portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_order_items" ADD CONSTRAINT "client_portal_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "client_portal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_order_items" ADD CONSTRAINT "client_portal_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal_activity" ADD CONSTRAINT "client_portal_activity_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "client_portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "client_portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_deliveries" ADD CONSTRAINT "sale_deliveries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_delivery_items" ADD CONSTRAINT "sale_delivery_items_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_delivery_items" ADD CONSTRAINT "sale_delivery_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_delivery_items" ADD CONSTRAINT "sale_delivery_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_delivery_evidences" ADD CONSTRAINT "sale_delivery_evidences_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remitos" ADD CONSTRAINT "sale_remitos_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remitos" ADD CONSTRAINT "sale_remitos_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remitos" ADD CONSTRAINT "sale_remitos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remitos" ADD CONSTRAINT "sale_remitos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remitos" ADD CONSTRAINT "sale_remitos_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remito_items" ADD CONSTRAINT "sale_remito_items_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "sale_remitos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remito_items" ADD CONSTRAINT "sale_remito_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_remito_items" ADD CONSTRAINT "sale_remito_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_credit_debit_notes" ADD CONSTRAINT "sales_credit_debit_notes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_credit_debit_notes" ADD CONSTRAINT "sales_credit_debit_notes_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_credit_debit_notes" ADD CONSTRAINT "sales_credit_debit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_credit_debit_notes" ADD CONSTRAINT "sales_credit_debit_notes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_credit_debit_note_items" ADD CONSTRAINT "sales_credit_debit_note_items_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "sales_credit_debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_credit_debit_note_items" ADD CONSTRAINT "sales_credit_debit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "client_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment_allocations" ADD CONSTRAINT "invoice_payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payment_cheques" ADD CONSTRAINT "client_payment_cheques_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "client_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger_entries" ADD CONSTRAINT "client_ledger_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger_entries" ADD CONSTRAINT "client_ledger_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger_entries" ADD CONSTRAINT "client_ledger_entries_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger_entries" ADD CONSTRAINT "client_ledger_entries_notaCreditoDebitoId_fkey" FOREIGN KEY ("notaCreditoDebitoId") REFERENCES "sales_credit_debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger_entries" ADD CONSTRAINT "client_ledger_entries_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_ledger_entries" ADD CONSTRAINT "client_ledger_entries_anuladoPor_fkey" FOREIGN KEY ("anuladoPor") REFERENCES "client_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_price_lists" ADD CONSTRAINT "sales_price_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_price_list_items" ADD CONSTRAINT "sales_price_list_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "sales_price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_price_list_items" ADD CONSTRAINT "sales_price_list_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_approvals" ADD CONSTRAINT "sales_approvals_quote_fk" FOREIGN KEY ("entidadId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_approvals" ADD CONSTRAINT "sales_approvals_sale_fk" FOREIGN KEY ("entidadId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_approvals" ADD CONSTRAINT "sales_approvals_solicitadoPor_fkey" FOREIGN KEY ("solicitadoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_approvals" ADD CONSTRAINT "sales_approvals_asignadoA_fkey" FOREIGN KEY ("asignadoA") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_approvals" ADD CONSTRAINT "sales_approvals_resueltoPor_fkey" FOREIGN KEY ("resueltoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_audit_logs" ADD CONSTRAINT "sales_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_kpis" ADD CONSTRAINT "seller_kpis_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_enabledBy_fkey" FOREIGN KEY ("enabledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopios" ADD CONSTRAINT "sale_acopios_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_acopioId_fkey" FOREIGN KEY ("acopioId") REFERENCES "sale_acopios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_acopio_items" ADD CONSTRAINT "sale_acopio_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_acopioId_fkey" FOREIGN KEY ("acopioId") REFERENCES "sale_acopios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acopio_retiros" ADD CONSTRAINT "acopio_retiros_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acopio_retiro_items" ADD CONSTRAINT "acopio_retiro_items_retiroId_fkey" FOREIGN KEY ("retiroId") REFERENCES "acopio_retiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_clientPaymentId_fkey" FOREIGN KEY ("clientPaymentId") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_clientPaymentId_fkey" FOREIGN KEY ("clientPaymentId") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_conciliadoBy_fkey" FOREIGN KEY ("conciliadoBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_clientPaymentId_fkey" FOREIGN KEY ("clientPaymentId") REFERENCES "client_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_depositoBankAccountId_fkey" FOREIGN KEY ("depositoBankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_endosadoPaymentOrderId_fkey" FOREIGN KEY ("endosadoPaymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_origenCajaId_fkey" FOREIGN KEY ("origenCajaId") REFERENCES "cash_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_origenBancoId_fkey" FOREIGN KEY ("origenBancoId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_destinoCajaId_fkey" FOREIGN KEY ("destinoCajaId") REFERENCES "cash_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_transfers" ADD CONSTRAINT "treasury_transfers_destinoBancoId_fkey" FOREIGN KEY ("destinoBancoId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "billing_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_audit_log" ADD CONSTRAINT "billing_audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_coupons" ADD CONSTRAINT "billing_coupons_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "billing_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_auto_payment_configs" ADD CONSTRAINT "billing_auto_payment_configs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_configs" ADD CONSTRAINT "payroll_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holidays" ADD CONSTRAINT "company_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_components" ADD CONSTRAINT "employee_salary_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "payroll_unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "employee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_item_lines" ADD CONSTRAINT "payroll_item_lines_payroll_item_id_fkey" FOREIGN KEY ("payroll_item_id") REFERENCES "payroll_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_item_lines" ADD CONSTRAINT "payroll_item_lines_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_installments" ADD CONSTRAINT "advance_installments_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "salary_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gremio_category_templates" ADD CONSTRAINT "gremio_category_templates_gremio_template_id_fkey" FOREIGN KEY ("gremio_template_id") REFERENCES "gremio_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_unions" ADD CONSTRAINT "payroll_unions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_unions" ADD CONSTRAINT "payroll_unions_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "gremio_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "union_categories" ADD CONSTRAINT "union_categories_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "payroll_unions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sectors" ADD CONSTRAINT "work_sectors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sectors" ADD CONSTRAINT "work_sectors_source_sector_id_fkey" FOREIGN KEY ("source_sector_id") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_positions" ADD CONSTRAINT "work_positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_positions" ADD CONSTRAINT "work_positions_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_union_category_id_fkey" FOREIGN KEY ("union_category_id") REFERENCES "union_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "employee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_default_concepts" ADD CONSTRAINT "category_default_concepts_union_category_id_fkey" FOREIGN KEY ("union_category_id") REFERENCES "union_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_default_concepts" ADD CONSTRAINT "category_default_concepts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "employee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_default_concepts" ADD CONSTRAINT "category_default_concepts_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_fixed_concepts" ADD CONSTRAINT "employee_fixed_concepts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_fixed_concepts" ADD CONSTRAINT "employee_fixed_concepts_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_variable_concepts" ADD CONSTRAINT "payroll_variable_concepts_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_variable_concepts" ADD CONSTRAINT "payroll_variable_concepts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_variable_concepts" ADD CONSTRAINT "payroll_variable_concepts_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_item_lines" ADD CONSTRAINT "payroll_run_item_lines_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "payroll_run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_item_lines" ADD CONSTRAINT "payroll_run_item_lines_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_cost_breakdowns" ADD CONSTRAINT "maintenance_cost_breakdowns_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_cost_breakdowns" ADD CONSTRAINT "maintenance_cost_breakdowns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_cost_rates" ADD CONSTRAINT "technician_cost_rates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_cost_rates" ADD CONSTRAINT "technician_cost_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_costs" ADD CONSTRAINT "third_party_costs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_costs" ADD CONSTRAINT "third_party_costs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_costs" ADD CONSTRAINT "third_party_costs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_budgets" ADD CONSTRAINT "maintenance_budgets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_implementedById_fkey" FOREIGN KEY ("implementedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_system_configs" ADD CONSTRAINT "cost_system_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_cost_consolidations" ADD CONSTRAINT "monthly_cost_consolidations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_cost_consolidations" ADD CONSTRAINT "monthly_cost_consolidations_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_procedures" ADD CONSTRAINT "loto_procedures_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_procedures" ADD CONSTRAINT "loto_procedures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_procedures" ADD CONSTRAINT "loto_procedures_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_procedures" ADD CONSTRAINT "loto_procedures_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_finalVerifiedById_fkey" FOREIGN KEY ("finalVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits_to_work" ADD CONSTRAINT "permits_to_work_ppeVerifiedById_fkey" FOREIGN KEY ("ppeVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "loto_procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_ptwId_fkey" FOREIGN KEY ("ptwId") REFERENCES "permits_to_work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_zeroEnergyVerifiedById_fkey" FOREIGN KEY ("zeroEnergyVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loto_executions" ADD CONSTRAINT "loto_executions_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_failure_modes" ADD CONSTRAINT "component_failure_modes_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_failure_modes" ADD CONSTRAINT "component_failure_modes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_certifications" ADD CONSTRAINT "user_certifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_certifications" ADD CONSTRAINT "user_certifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_skill_requirements" ADD CONSTRAINT "task_skill_requirements_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_counters" ADD CONSTRAINT "machine_counters_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_counters" ADD CONSTRAINT "machine_counters_lastReadingById_fkey" FOREIGN KEY ("lastReadingById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_counters" ADD CONSTRAINT "machine_counters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_counter_readings" ADD CONSTRAINT "machine_counter_readings_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "machine_counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_counter_readings" ADD CONSTRAINT "machine_counter_readings_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_maintenance_triggers" ADD CONSTRAINT "counter_maintenance_triggers_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "machine_counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_maintenance_triggers" ADD CONSTRAINT "counter_maintenance_triggers_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "maintenance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_implementedById_fkey" FOREIGN KEY ("implementedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_of_change" ADD CONSTRAINT "management_of_change_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_documents" ADD CONSTRAINT "moc_documents_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "management_of_change"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_documents" ADD CONSTRAINT "moc_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_history" ADD CONSTRAINT "moc_history_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "management_of_change"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_history" ADD CONSTRAINT "moc_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_tasks" ADD CONSTRAINT "moc_tasks_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "management_of_change"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_tasks" ADD CONSTRAINT "moc_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moc_tasks" ADD CONSTRAINT "moc_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_centers" ADD CONSTRAINT "work_centers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_reason_codes" ADD CONSTRAINT "production_reason_codes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "production_reason_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_reason_codes" ADD CONSTRAINT "production_reason_codes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CostProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_production_reports" ADD CONSTRAINT "daily_production_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "production_reason_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_downtimes" ADD CONSTRAINT "production_downtimes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_quality_controls" ADD CONSTRAINT "production_quality_controls_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_quality_controls" ADD CONSTRAINT "production_quality_controls_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_quality_controls" ADD CONSTRAINT "production_quality_controls_batchLotId_fkey" FOREIGN KEY ("batchLotId") REFERENCES "production_batch_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_quality_controls" ADD CONSTRAINT "production_quality_controls_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_quality_controls" ADD CONSTRAINT "production_quality_controls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_defects" ADD CONSTRAINT "production_defects_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "daily_production_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_defects" ADD CONSTRAINT "production_defects_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_defects" ADD CONSTRAINT "production_defects_batchLotId_fkey" FOREIGN KEY ("batchLotId") REFERENCES "production_batch_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_defects" ADD CONSTRAINT "production_defects_reasonCodeId_fkey" FOREIGN KEY ("reasonCodeId") REFERENCES "production_reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_defects" ADD CONSTRAINT "production_defects_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_defects" ADD CONSTRAINT "production_defects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_lots" ADD CONSTRAINT "production_batch_lots_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_lots" ADD CONSTRAINT "production_batch_lots_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_lots" ADD CONSTRAINT "production_batch_lots_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batch_lots" ADD CONSTRAINT "production_batch_lots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_events" ADD CONSTRAINT "production_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routine_templates" ADD CONSTRAINT "production_routine_templates_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routine_templates" ADD CONSTRAINT "production_routine_templates_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routine_templates" ADD CONSTRAINT "production_routine_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routines" ADD CONSTRAINT "production_routines_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "production_routine_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routines" ADD CONSTRAINT "production_routines_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routines" ADD CONSTRAINT "production_routines_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routines" ADD CONSTRAINT "production_routines_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routines" ADD CONSTRAINT "production_routines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_resource_types" ADD CONSTRAINT "production_resource_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_resources" ADD CONSTRAINT "production_resources_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "production_resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_resources" ADD CONSTRAINT "production_resources_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_resources" ADD CONSTRAINT "production_resources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestressed_molds" ADD CONSTRAINT "prestressed_molds_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "work_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestressed_molds" ADD CONSTRAINT "prestressed_molds_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curing_records" ADD CONSTRAINT "curing_records_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curing_records" ADD CONSTRAINT "curing_records_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "prestressed_molds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curing_records" ADD CONSTRAINT "curing_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_purchase_logs" ADD CONSTRAINT "voice_purchase_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_purchase_logs" ADD CONSTRAINT "voice_purchase_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_purchase_logs" ADD CONSTRAINT "voice_purchase_logs_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_failure_logs" ADD CONSTRAINT "voice_failure_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_failure_logs" ADD CONSTRAINT "voice_failure_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_failure_logs" ADD CONSTRAINT "voice_failure_logs_failureOccurrenceId_fkey" FOREIGN KEY ("failureOccurrenceId") REFERENCES "failure_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_purchase_orders" ADD CONSTRAINT "recurring_purchase_orders_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_purchase_orders" ADD CONSTRAINT "recurring_purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_purchase_items" ADD CONSTRAINT "recurring_purchase_items_recurringOrderId_fkey" FOREIGN KEY ("recurringOrderId") REFERENCES "recurring_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_purchase_history" ADD CONSTRAINT "recurring_purchase_history_recurringOrderId_fkey" FOREIGN KEY ("recurringOrderId") REFERENCES "recurring_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_tasks" ADD CONSTRAINT "agenda_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_tasks" ADD CONSTRAINT "agenda_tasks_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_tasks" ADD CONSTRAINT "agenda_tasks_assignedToContactId_fkey" FOREIGN KEY ("assignedToContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_tasks" ADD CONSTRAINT "agenda_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_reminders" ADD CONSTRAINT "agenda_reminders_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "agenda_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_reminders" ADD CONSTRAINT "agenda_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_reminders" ADD CONSTRAINT "agenda_reminders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_task_logs" ADD CONSTRAINT "voice_task_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "agenda_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_task_logs" ADD CONSTRAINT "voice_task_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_task_logs" ADD CONSTRAINT "voice_task_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_despachadorId_fkey" FOREIGN KEY ("despachadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despachos" ADD CONSTRAINT "despachos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "despachos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despacho_items" ADD CONSTRAINT "despacho_items_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "stock_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_despachoOrigenId_fkey" FOREIGN KEY ("despachoOrigenId") REFERENCES "despachos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_devolvienteId_fkey" FOREIGN KEY ("devolvienteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_recibidoPor_fkey" FOREIGN KEY ("recibidoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_material" ADD CONSTRAINT "devoluciones_material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "devoluciones_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_material_items" ADD CONSTRAINT "devolucion_material_items_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_scopes" ADD CONSTRAINT "user_warehouse_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_scopes" ADD CONSTRAINT "user_warehouse_scopes_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_stock_configs" ADD CONSTRAINT "production_stock_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_stock_configs" ADD CONSTRAINT "production_stock_configs_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_levels" ADD CONSTRAINT "approval_workflow_levels_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payments" ADD CONSTRAINT "service_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contract_alerts" ADD CONSTRAINT "service_contract_alerts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_block_history" ADD CONSTRAINT "client_block_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_block_history" ADD CONSTRAINT "client_block_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_block_history" ADD CONSTRAINT "client_block_history_bloqueadoPor_fkey" FOREIGN KEY ("bloqueadoPor") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_block_history" ADD CONSTRAINT "client_block_history_desbloqueadoPor_fkey" FOREIGN KEY ("desbloqueadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "cheques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_reversaDeId_fkey" FOREIGN KEY ("reversaDeId") REFERENCES "treasury_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_orders" ADD CONSTRAINT "load_orders_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_orders" ADD CONSTRAINT "load_orders_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_orders" ADD CONSTRAINT "load_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_orders" ADD CONSTRAINT "load_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_orders" ADD CONSTRAINT "load_orders_confirmadoPor_fkey" FOREIGN KEY ("confirmadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_order_items" ADD CONSTRAINT "load_order_items_loadOrderId_fkey" FOREIGN KEY ("loadOrderId") REFERENCES "load_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_order_items" ADD CONSTRAINT "load_order_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_order_items" ADD CONSTRAINT "load_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closings" ADD CONSTRAINT "cash_closings_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_cerradoPor_fkey" FOREIGN KEY ("cerradoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_items" ADD CONSTRAINT "bank_statement_items_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_items" ADD CONSTRAINT "bank_statement_items_treasuryMovementId_fkey" FOREIGN KEY ("treasuryMovementId") REFERENCES "treasury_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_items" ADD CONSTRAINT "bank_statement_items_conciliadoBy_fkey" FOREIGN KEY ("conciliadoBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_reservations" ADD CONSTRAINT "pickup_reservations_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "pickup_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_reservations" ADD CONSTRAINT "pickup_reservations_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_reservations" ADD CONSTRAINT "pickup_reservations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_reservations" ADD CONSTRAINT "pickup_reservations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_reservations" ADD CONSTRAINT "pickup_reservations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "afip_config" ADD CONSTRAINT "afip_config_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "sales_price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_actions" ADD CONSTRAINT "collection_actions_asignadoA_fkey" FOREIGN KEY ("asignadoA") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "sale_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_resolucionPor_fkey" FOREIGN KEY ("resolucionPor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_disputes" ADD CONSTRAINT "payment_disputes_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "sales_credit_debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OwnedCompanies" ADD CONSTRAINT "_OwnedCompanies_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OwnedCompanies" ADD CONSTRAINT "_OwnedCompanies_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

