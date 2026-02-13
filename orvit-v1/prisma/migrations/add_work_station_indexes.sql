-- Índices para optimizar consultas de Puestos de Trabajo
-- Ejecutar con: npx prisma db execute --file prisma/migrations/add_work_station_indexes.sql

-- Índice compuesto para listado filtrado por empresa y estado
CREATE INDEX IF NOT EXISTS "WorkStation_companyId_status_idx" ON "WorkStation"("companyId", "status");

-- Índice compuesto para búsqueda por empresa y nombre
CREATE INDEX IF NOT EXISTS "WorkStation_companyId_name_idx" ON "WorkStation"("companyId", "name");

-- Índice para búsqueda por sector
CREATE INDEX IF NOT EXISTS "WorkStation_sectorId_idx" ON "WorkStation"("sectorId");

-- Índice para ordenar por fecha de creación
CREATE INDEX IF NOT EXISTS "WorkStation_companyId_createdAt_idx" ON "WorkStation"("companyId", "createdAt" DESC);

-- Índices para instructivos
CREATE INDEX IF NOT EXISTS "WorkStationInstructive_workStationId_isActive_idx" ON "WorkStationInstructive"("workStationId", "isActive");
CREATE INDEX IF NOT EXISTS "WorkStationInstructive_createdAt_idx" ON "WorkStationInstructive"("createdAt" DESC);

-- Índices para máquinas asignadas
CREATE INDEX IF NOT EXISTS "WorkStationMachine_workStationId_idx" ON "WorkStationMachine"("workStationId");
CREATE INDEX IF NOT EXISTS "WorkStationMachine_machineId_idx" ON "WorkStationMachine"("machineId");

-- Índices para componentes asignados
CREATE INDEX IF NOT EXISTS "WorkStationComponent_workStationId_idx" ON "WorkStationComponent"("workStationId");
CREATE INDEX IF NOT EXISTS "WorkStationComponent_componentId_idx" ON "WorkStationComponent"("componentId");

-- Comentario: Estos índices mejoran significativamente las consultas de:
-- 1. Listado de puestos por empresa con filtros
-- 2. Búsqueda por nombre/código
-- 3. Conteo de instructivos activos
-- 4. Consultas de máquinas asignadas
