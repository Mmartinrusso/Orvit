-- Agregar campo CUIL a empleados
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "cuil" VARCHAR(20);

-- Índice único por empresa para CUIL (permite null pero no duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_employees_cuil_company"
ON "employees" (company_id, cuil)
WHERE cuil IS NOT NULL;
