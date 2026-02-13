-- Agregar campos de peso del chasis y acoplado a la tabla Truck
-- Estos campos son necesarios para camiones tipo EQUIPO

-- Agregar columna chasisWeight si no existe
DO $$ BEGIN
    ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisWeight" DOUBLE PRECISION;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Agregar columna acopladoWeight si no existe
DO $$ BEGIN
    ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoWeight" DOUBLE PRECISION;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Nota: Los campos chasisLength y acopladoLength ya deberían existir
-- Si no existen, se pueden agregar con:
-- ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "chasisLength" DOUBLE PRECISION;
-- ALTER TABLE "Truck" ADD COLUMN IF NOT EXISTS "acopladoLength" DOUBLE PRECISION;

