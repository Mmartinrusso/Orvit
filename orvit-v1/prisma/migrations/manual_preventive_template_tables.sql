-- ============================================
-- Migración: Crear tablas PreventiveTemplate y PreventiveInstance
-- Reemplaza el patrón JSON-in-Document para mantenimiento preventivo
-- ============================================

-- 1. Tabla de Templates de Mantenimiento Preventivo
CREATE TABLE IF NOT EXISTS "PreventiveTemplate" (
  "id"                    SERIAL PRIMARY KEY,
  "title"                 TEXT NOT NULL,
  "description"           TEXT,
  "priority"              VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  "notes"                 TEXT,

  -- Equipo
  "machineId"             INTEGER REFERENCES "Machine"("id") ON DELETE SET NULL,
  "machineName"           TEXT,
  "unidadMovilId"         INTEGER REFERENCES "UnidadMovil"("id") ON DELETE SET NULL,
  "isMobileUnit"          BOOLEAN NOT NULL DEFAULT false,
  "componentIds"          INTEGER[] DEFAULT '{}',
  "componentNames"        TEXT[] DEFAULT '{}',
  "subcomponentIds"       INTEGER[] DEFAULT '{}',
  "subcomponentNames"     TEXT[] DEFAULT '{}',

  -- Programación
  "frequencyDays"         INTEGER NOT NULL DEFAULT 30,
  "nextMaintenanceDate"   TIMESTAMPTZ,
  "lastMaintenanceDate"   TIMESTAMPTZ,
  "weekdaysOnly"          BOOLEAN NOT NULL DEFAULT true,

  -- Ejecución
  "estimatedHours"        DOUBLE PRECISION,
  "timeUnit"              VARCHAR(20) NOT NULL DEFAULT 'HOURS',
  "timeValue"             DOUBLE PRECISION,
  "executionWindow"       VARCHAR(30) NOT NULL DEFAULT 'ANY_TIME',
  "toolsRequired"         JSONB NOT NULL DEFAULT '[]',

  -- Asignación
  "assignedToId"          INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "assignedToName"        TEXT,

  -- Empresa
  "companyId"             INTEGER NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "sectorId"              INTEGER REFERENCES "Sector"("id") ON DELETE SET NULL,
  "createdById"           INTEGER REFERENCES "User"("id") ON DELETE SET NULL,

  -- Estado
  "isActive"              BOOLEAN NOT NULL DEFAULT true,
  "maintenanceCount"      INTEGER NOT NULL DEFAULT 0,

  -- Alertas
  "alertDaysBefore"       INTEGER[] DEFAULT '{3,2,1,0}',

  -- Métricas
  "averageDuration"       DOUBLE PRECISION,
  "lastExecutionDuration" DOUBLE PRECISION,
  "executionHistory"      JSONB NOT NULL DEFAULT '[]',

  -- Instructivos (archivos S3)
  "instructives"          JSONB NOT NULL DEFAULT '[]',

  -- Referencia legacy
  "legacyDocumentId"      INTEGER UNIQUE,

  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para PreventiveTemplate
CREATE INDEX IF NOT EXISTS "PreventiveTemplate_companyId_idx" ON "PreventiveTemplate"("companyId");
CREATE INDEX IF NOT EXISTS "PreventiveTemplate_machineId_idx" ON "PreventiveTemplate"("machineId");
CREATE INDEX IF NOT EXISTS "PreventiveTemplate_isActive_idx" ON "PreventiveTemplate"("isActive");
CREATE INDEX IF NOT EXISTS "PreventiveTemplate_nextMaintenanceDate_idx" ON "PreventiveTemplate"("nextMaintenanceDate");
CREATE INDEX IF NOT EXISTS "PreventiveTemplate_companyId_isActive_idx" ON "PreventiveTemplate"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "PreventiveTemplate_companyId_machineId_idx" ON "PreventiveTemplate"("companyId", "machineId");

-- 2. Tabla de Instancias de Mantenimiento Preventivo
CREATE TABLE IF NOT EXISTS "PreventiveInstance" (
  "id"                    SERIAL PRIMARY KEY,
  "templateId"            INTEGER NOT NULL REFERENCES "PreventiveTemplate"("id") ON DELETE CASCADE,
  "scheduledDate"         TIMESTAMPTZ NOT NULL,
  "status"                VARCHAR(20) NOT NULL DEFAULT 'PENDING',

  -- Ejecución
  "actualStartDate"       TIMESTAMPTZ,
  "actualEndDate"         TIMESTAMPTZ,
  "actualHours"           DOUBLE PRECISION,
  "completedById"         INTEGER REFERENCES "User"("id") ON DELETE SET NULL,
  "completionNotes"       TEXT,
  "toolsUsed"             JSONB NOT NULL DEFAULT '[]',
  "photoUrls"             JSONB NOT NULL DEFAULT '[]',

  -- Referencia legacy
  "legacyDocumentId"      INTEGER UNIQUE,

  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para PreventiveInstance
CREATE INDEX IF NOT EXISTS "PreventiveInstance_templateId_idx" ON "PreventiveInstance"("templateId");
CREATE INDEX IF NOT EXISTS "PreventiveInstance_status_idx" ON "PreventiveInstance"("status");
CREATE INDEX IF NOT EXISTS "PreventiveInstance_scheduledDate_idx" ON "PreventiveInstance"("scheduledDate");
CREATE INDEX IF NOT EXISTS "PreventiveInstance_templateId_status_idx" ON "PreventiveInstance"("templateId", "status");

-- 3. Migración de datos: Document → PreventiveTemplate
-- Copia los templates existentes desde Document.url (JSON) a la nueva tabla
INSERT INTO "PreventiveTemplate" (
  "title", "description", "priority", "notes",
  "machineId", "machineName", "unidadMovilId", "isMobileUnit",
  "componentIds", "componentNames", "subcomponentIds", "subcomponentNames",
  "frequencyDays", "nextMaintenanceDate", "lastMaintenanceDate", "weekdaysOnly",
  "estimatedHours", "timeUnit", "timeValue", "executionWindow", "toolsRequired",
  "assignedToId", "assignedToName",
  "companyId", "sectorId", "createdById",
  "isActive", "maintenanceCount", "alertDaysBefore",
  "averageDuration", "lastExecutionDuration", "executionHistory",
  "instructives", "legacyDocumentId",
  "createdAt", "updatedAt"
)
SELECT
  COALESCE((d."url"::jsonb)->>'title', d."originalName", 'Sin título'),
  (d."url"::jsonb)->>'description',
  COALESCE((d."url"::jsonb)->>'priority', 'MEDIUM'),
  (d."url"::jsonb)->>'notes',
  -- machineId: solo si es numérico válido
  CASE WHEN ((d."url"::jsonb)->>'machineId') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'machineId')::integer ELSE NULL END,
  (d."url"::jsonb)->>'machineName',
  -- unidadMovilId
  CASE WHEN ((d."url"::jsonb)->>'unidadMovilId') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'unidadMovilId')::integer ELSE NULL END,
  COALESCE(((d."url"::jsonb)->>'isMobileUnit')::boolean, false),
  -- componentIds (JSON array → int array)
  COALESCE(
    (SELECT array_agg(elem::integer) FROM jsonb_array_elements_text((d."url"::jsonb)->'componentIds') AS elem WHERE elem ~ '^\d+$'),
    '{}'::integer[]
  ),
  COALESCE(
    (SELECT array_agg(elem::text) FROM jsonb_array_elements_text((d."url"::jsonb)->'componentNames') AS elem),
    '{}'::text[]
  ),
  COALESCE(
    (SELECT array_agg(elem::integer) FROM jsonb_array_elements_text((d."url"::jsonb)->'subcomponentIds') AS elem WHERE elem ~ '^\d+$'),
    '{}'::integer[]
  ),
  COALESCE(
    (SELECT array_agg(elem::text) FROM jsonb_array_elements_text((d."url"::jsonb)->'subcomponentNames') AS elem),
    '{}'::text[]
  ),
  COALESCE(((d."url"::jsonb)->>'frequencyDays')::integer, 30),
  CASE WHEN (d."url"::jsonb)->>'nextMaintenanceDate' IS NOT NULL
    THEN ((d."url"::jsonb)->>'nextMaintenanceDate')::timestamptz ELSE NULL END,
  CASE WHEN (d."url"::jsonb)->>'lastMaintenanceDate' IS NOT NULL
    THEN ((d."url"::jsonb)->>'lastMaintenanceDate')::timestamptz ELSE NULL END,
  COALESCE(((d."url"::jsonb)->>'weekdaysOnly')::boolean, true),
  CASE WHEN ((d."url"::jsonb)->>'estimatedHours') ~ '^[\d.]+$'
    THEN ((d."url"::jsonb)->>'estimatedHours')::double precision ELSE NULL END,
  COALESCE((d."url"::jsonb)->>'timeUnit', 'HOURS'),
  CASE WHEN ((d."url"::jsonb)->>'timeValue') ~ '^[\d.]+$'
    THEN ((d."url"::jsonb)->>'timeValue')::double precision ELSE NULL END,
  COALESCE((d."url"::jsonb)->>'executionWindow', 'ANY_TIME'),
  COALESCE((d."url"::jsonb)->'toolsRequired', '[]'::jsonb),
  -- assignedToId
  CASE WHEN ((d."url"::jsonb)->>'assignedToId') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'assignedToId')::integer ELSE NULL END,
  (d."url"::jsonb)->>'assignedToName',
  -- companyId (del JSON o del Document)
  COALESCE(
    CASE WHEN ((d."url"::jsonb)->>'companyId') ~ '^\d+$'
      THEN ((d."url"::jsonb)->>'companyId')::integer ELSE NULL END,
    d."companyId"
  ),
  CASE WHEN ((d."url"::jsonb)->>'sectorId') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'sectorId')::integer ELSE NULL END,
  CASE WHEN ((d."url"::jsonb)->>'createdById') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'createdById')::integer ELSE NULL END,
  COALESCE(((d."url"::jsonb)->>'isActive')::boolean, true),
  COALESCE(((d."url"::jsonb)->>'maintenanceCount')::integer, 0),
  COALESCE(
    (SELECT array_agg(elem::integer) FROM jsonb_array_elements_text((d."url"::jsonb)->'alertDaysBefore') AS elem WHERE elem ~ '^\d+$'),
    '{3,2,1,0}'::integer[]
  ),
  CASE WHEN ((d."url"::jsonb)->>'averageDuration') ~ '^[\d.]+$'
    THEN ((d."url"::jsonb)->>'averageDuration')::double precision ELSE NULL END,
  CASE WHEN ((d."url"::jsonb)->>'lastExecutionDuration') ~ '^[\d.]+$'
    THEN ((d."url"::jsonb)->>'lastExecutionDuration')::double precision ELSE NULL END,
  COALESCE((d."url"::jsonb)->'executionHistory', '[]'::jsonb),
  COALESCE((d."url"::jsonb)->'instructives', '[]'::jsonb),
  d."id",
  d."createdAt",
  d."updatedAt"
FROM "Document" d
WHERE d."entityType" = 'PREVENTIVE_MAINTENANCE_TEMPLATE'
  AND d."url" IS NOT NULL
  AND d."url" != ''
  AND d."url" LIKE '{%'  -- Solo JSONs válidos
ON CONFLICT ("legacyDocumentId") DO NOTHING;

-- 4. Migración de datos: Document → PreventiveInstance
-- Las instancias tienen entityType = 'PREVENTIVE_MAINTENANCE_INSTANCE'
-- y su entityId contiene "template-{documentId}-instance-{N}"
INSERT INTO "PreventiveInstance" (
  "templateId", "scheduledDate", "status",
  "actualStartDate", "actualEndDate", "actualHours",
  "completedById", "completionNotes", "toolsUsed", "photoUrls",
  "legacyDocumentId", "createdAt", "updatedAt"
)
SELECT
  pt."id",
  COALESCE(
    ((d."url"::jsonb)->>'scheduledDate')::timestamptz,
    d."createdAt"
  ),
  COALESCE((d."url"::jsonb)->>'status', 'PENDING'),
  CASE WHEN (d."url"::jsonb)->>'actualStartDate' IS NOT NULL
    THEN ((d."url"::jsonb)->>'actualStartDate')::timestamptz ELSE NULL END,
  CASE WHEN (d."url"::jsonb)->>'actualEndDate' IS NOT NULL
    THEN ((d."url"::jsonb)->>'actualEndDate')::timestamptz ELSE NULL END,
  CASE WHEN ((d."url"::jsonb)->>'actualHours') ~ '^[\d.]+$'
    THEN ((d."url"::jsonb)->>'actualHours')::double precision ELSE NULL END,
  CASE WHEN ((d."url"::jsonb)->>'completedById') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'completedById')::integer ELSE NULL END,
  (d."url"::jsonb)->>'completionNotes',
  COALESCE((d."url"::jsonb)->'toolsUsed', '[]'::jsonb),
  COALESCE((d."url"::jsonb)->'photoUrls', '[]'::jsonb),
  d."id",
  d."createdAt",
  d."updatedAt"
FROM "Document" d
-- Vincular con el template migrado usando el entityId del instance
-- El entityId de instancias es "template-{docId}-instance-{N}" o similar
JOIN "PreventiveTemplate" pt ON pt."legacyDocumentId" = (
  -- Extraer el templateId del JSON de la instancia
  CASE WHEN ((d."url"::jsonb)->>'templateId') ~ '^\d+$'
    THEN ((d."url"::jsonb)->>'templateId')::integer
    ELSE NULL
  END
)
WHERE d."entityType" = 'PREVENTIVE_MAINTENANCE_INSTANCE'
  AND d."url" IS NOT NULL
  AND d."url" != ''
  AND d."url" LIKE '{%'
ON CONFLICT ("legacyDocumentId") DO NOTHING;

-- 5. Verificación
DO $$
DECLARE
  template_count INTEGER;
  instance_count INTEGER;
  legacy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM "PreventiveTemplate";
  SELECT COUNT(*) INTO instance_count FROM "PreventiveInstance";
  SELECT COUNT(*) INTO legacy_count FROM "Document" WHERE "entityType" = 'PREVENTIVE_MAINTENANCE_TEMPLATE';
  RAISE NOTICE 'Migración completada: % templates migrados (de % legacy), % instancias', template_count, legacy_count, instance_count;
END $$;
