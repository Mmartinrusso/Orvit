-- Índices para tablas relacionadas a WorkOrder
-- Mejora queries de comentarios, adjuntos y checklists

-- WorkOrderComment: queries por workOrderId
CREATE INDEX IF NOT EXISTS "WorkOrderComment_workOrderId_idx"
ON "WorkOrderComment"("workOrderId");

-- WorkOrderAttachment: queries por workOrderId
CREATE INDEX IF NOT EXISTS "WorkOrderAttachment_workOrderId_idx"
ON "WorkOrderAttachment"("workOrderId");

-- WorkOrderChecklist: queries compuestas (ya tiene workOrderId solo)
CREATE INDEX IF NOT EXISTS "work_order_checklists_workOrderId_companyId_idx"
ON "work_order_checklists"("workOrderId", "companyId");
