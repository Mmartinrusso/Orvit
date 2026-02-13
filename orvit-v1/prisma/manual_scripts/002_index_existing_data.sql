-- ============================================
-- Script para indexar datos existentes en el asistente
-- Ejecutar UNA VEZ para cargar datos históricos
-- CORREGIDO con columnas correctas del schema
-- ============================================

-- 1. ORDENES DE TRABAJO
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  wo."companyId",
  'work_order' as "entityType",
  wo.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(wo.title, ''),
    COALESCE(wo.description, ''),
    COALESCE(wo.solution, ''),
    COALESCE(wo.notes, ''),
    CASE WHEN m.name IS NOT NULL THEN 'Máquina: ' || m.name END,
    CASE WHEN s.name IS NOT NULL THEN 'Sector: ' || s.name END,
    CASE WHEN c.name IS NOT NULL THEN 'Componente: ' || c.name END,
    CASE WHEN u.name IS NOT NULL THEN 'Asignado a: ' || u.name END,
    CASE WHEN wo.type IS NOT NULL THEN 'Tipo: ' || wo.type::text ELSE 'Tipo: N/A' END,
    CASE WHEN wo.priority IS NOT NULL THEN 'Prioridad: ' || wo.priority::text ELSE 'Prioridad: N/A' END,
    CASE WHEN wo.status IS NOT NULL THEN 'Estado: ' || wo.status::text ELSE 'Estado: N/A' END
  ) as content,
  jsonb_build_object(
    'machineId', wo."machineId",
    'sectorId', wo."sectorId",
    'status', wo.status::text,
    'priority', wo.priority::text,
    'type', wo.type::text,
    'createdAt', wo."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM work_orders wo
LEFT JOIN "Machine" m ON wo."machineId" = m.id
LEFT JOIN "Sector" s ON wo."sectorId" = s.id
LEFT JOIN "Component" c ON wo."componentId" = c.id
LEFT JOIN "User" u ON wo."assignedToId" = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'work_order' AND ae."entityId" = wo.id
);

-- 2. OCURRENCIAS DE FALLAS
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  fo."companyId",
  'failure_occurrence' as "entityType",
  fo.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(fo.title, ''),
    COALESCE(fo.description, ''),
    COALESCE(fo.notes, ''),
    CASE WHEN m.name IS NOT NULL THEN 'Máquina: ' || m.name END,
    CASE WHEN s.name IS NOT NULL THEN 'Sector: ' || s.name END,
    CASE WHEN sc.name IS NOT NULL THEN 'Subcomponente: ' || sc.name END,
    CASE WHEN fo."failureCategory" IS NOT NULL THEN 'Categoría: ' || fo."failureCategory" ELSE 'Categoría: N/A' END,
    CASE WHEN fo.priority IS NOT NULL THEN 'Prioridad: ' || fo.priority ELSE 'Prioridad: N/A' END,
    CASE WHEN fo.status IS NOT NULL THEN 'Estado: ' || fo.status ELSE 'Estado: N/A' END
  ) as content,
  jsonb_build_object(
    'machineId', fo."machineId",
    'subcomponentId', fo."subcomponentId",
    'sectorId', m."sectorId",
    'failureCategory', fo."failureCategory",
    'status', fo.status,
    'createdAt', fo."reportedAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM failure_occurrences fo
LEFT JOIN "Machine" m ON fo."machineId" = m.id
LEFT JOIN "Sector" s ON m."sectorId" = s.id
LEFT JOIN "Component" sc ON fo."subcomponentId" = sc.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'failure_occurrence' AND ae."entityId" = fo.id
);

-- 3. SOLUCIONES DE FALLAS
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  fo."companyId",
  'failure_solution' as "entityType",
  fs.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(fs.title, ''),
    COALESCE(fs.description, ''),
    COALESCE(fs."rootCause", ''),
    COALESCE(fs."preventiveActions", ''),
    CASE WHEN fo.title IS NOT NULL THEN 'Falla: ' || fo.title END,
    CASE WHEN fo.description IS NOT NULL THEN 'Descripción falla: ' || fo.description END,
    'Efectividad: ' || COALESCE(fs.effectiveness::text, 'N/A'),
    'Horas: ' || COALESCE(fs."actualHours"::text, 'N/A')
  ) as content,
  jsonb_build_object(
    'occurrenceId', fs."occurrenceId",
    'effectiveness', fs.effectiveness,
    'actualHours', fs."actualHours",
    'createdAt', fs."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM failure_solutions fs
LEFT JOIN failure_occurrences fo ON fs."occurrenceId" = fo.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'failure_solution' AND ae."entityId" = fs.id
);

-- 4. TAREAS PREVENTIVAS (Fixed Tasks)
-- Nota: FixedTask no tiene machineId ni sectorId
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  ft."companyId",
  'fixed_task' as "entityType",
  ft.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(ft.title, ''),
    COALESCE(ft.description, ''),
    COALESCE(ft.department, ''),
    CASE WHEN u.name IS NOT NULL THEN 'Asignado a: ' || u.name END,
    CASE WHEN ft.frequency IS NOT NULL THEN 'Frecuencia: ' || ft.frequency::text ELSE 'Frecuencia: N/A' END,
    CASE WHEN ft.priority IS NOT NULL THEN 'Prioridad: ' || ft.priority::text ELSE 'Prioridad: N/A' END,
    CASE WHEN ft."isActive" THEN 'Estado: Activa' ELSE 'Estado: Inactiva' END
  ) as content,
  jsonb_build_object(
    'frequency', ft.frequency::text,
    'priority', ft.priority::text,
    'isActive', ft."isActive",
    'createdAt', ft."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "FixedTask" ft
LEFT JOIN "User" u ON ft."assignedToId" = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'fixed_task' AND ae."entityId" = ft.id
);

-- 5. EJECUCIONES DE TAREAS PREVENTIVAS
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  ft."companyId",
  'fixed_task_execution' as "entityType",
  fte.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(fte.notes, ''),
    CASE WHEN ft.title IS NOT NULL THEN 'Tarea: ' || ft.title END,
    CASE WHEN u.name IS NOT NULL THEN 'Ejecutado por: ' || u.name END,
    CASE WHEN fte.status IS NOT NULL THEN 'Estado: ' || fte.status ELSE 'Estado: N/A' END,
    CASE WHEN fte."actualDuration" IS NOT NULL THEN 'Duración: ' || fte."actualDuration"::text || ' minutos' END
  ) as content,
  jsonb_build_object(
    'fixedTaskId', fte."fixedTaskId",
    'userId', fte."userId",
    'status', fte.status,
    'completedAt', fte."completedAt",
    'createdAt', fte."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "FixedTaskExecution" fte
LEFT JOIN "FixedTask" ft ON fte."fixedTaskId" = ft.id
LEFT JOIN "User" u ON fte."userId" = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'fixed_task_execution' AND ae."entityId" = fte.id
);

-- 6. MÁQUINAS
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  m."companyId",
  'machine' as "entityType",
  m.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(m.name, ''),
    COALESCE(m.nickname, ''),
    COALESCE(m.description, ''),
    CASE WHEN m.brand IS NOT NULL THEN 'Marca: ' || m.brand END,
    CASE WHEN m.model IS NOT NULL THEN 'Modelo: ' || m.model END,
    CASE WHEN m."serialNumber" IS NOT NULL THEN 'Serie: ' || m."serialNumber" END,
    CASE WHEN s.name IS NOT NULL THEN 'Sector: ' || s.name END,
    CASE WHEN a.name IS NOT NULL THEN 'Área: ' || a.name END,
    CASE WHEN m.type IS NOT NULL THEN 'Tipo: ' || m.type::text ELSE 'Tipo: N/A' END,
    CASE WHEN m.status IS NOT NULL THEN 'Estado: ' || m.status::text ELSE 'Estado: N/A' END
  ) as content,
  jsonb_build_object(
    'sectorId', m."sectorId",
    'areaId', m."areaId",
    'type', m.type::text,
    'status', m.status::text,
    'createdAt', m."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Machine" m
LEFT JOIN "Sector" s ON m."sectorId" = s.id
LEFT JOIN "Area" a ON m."areaId" = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'machine' AND ae."entityId" = m.id
);

-- 7. COMPONENTES
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  m."companyId",
  'component' as "entityType",
  c.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(c.name, ''),
    COALESCE(c.description, ''),
    COALESCE(c."technicalInfo", ''),
    CASE WHEN c.code IS NOT NULL THEN 'Código: ' || c.code END,
    CASE WHEN c.system IS NOT NULL THEN 'Sistema: ' || c.system END,
    CASE WHEN m.name IS NOT NULL THEN 'Máquina: ' || m.name END,
    CASE WHEN c.type IS NOT NULL THEN 'Tipo: ' || c.type ELSE 'Tipo: N/A' END
  ) as content,
  jsonb_build_object(
    'machineId', c."machineId",
    'type', c.type,
    'createdAt', c."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Component" c
LEFT JOIN "Machine" m ON c."machineId" = m.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'component' AND ae."entityId" = c.id
);

-- 8. CHECKLISTS DE MANTENIMIENTO
INSERT INTO assistant_embeddings ("companyId", "entityType", "entityId", content, metadata, "createdAt", "updatedAt")
SELECT
  mc."companyId",
  'maintenance_checklist' as "entityType",
  mc.id as "entityId",
  CONCAT_WS(E'\n',
    COALESCE(mc.title, ''),
    COALESCE(mc.description, ''),
    COALESCE(mc.category, ''),
    CASE WHEN m.name IS NOT NULL THEN 'Máquina: ' || m.name END,
    CASE WHEN s.name IS NOT NULL THEN 'Sector: ' || s.name END,
    CASE WHEN mc.frequency IS NOT NULL THEN 'Frecuencia: ' || mc.frequency::text ELSE 'Frecuencia: N/A' END,
    CASE WHEN mc."isActive" THEN 'Estado: Activo' ELSE 'Estado: Inactivo' END
  ) as content,
  jsonb_build_object(
    'machineId', mc."machineId",
    'sectorId', mc."sectorId",
    'frequency', mc.frequency::text,
    'isActive', mc."isActive",
    'createdAt', mc."createdAt"
  ) as metadata,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM maintenance_checklists mc
LEFT JOIN "Machine" m ON mc."machineId" = m.id
LEFT JOIN "Sector" s ON mc."sectorId" = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM assistant_embeddings ae
  WHERE ae."entityType" = 'maintenance_checklist' AND ae."entityId" = mc.id
);

-- Ver cuántos registros se insertaron
SELECT
  "entityType",
  COUNT(*) as cantidad
FROM assistant_embeddings
GROUP BY "entityType"
ORDER BY cantidad DESC;
