-- Agregar campo timezone al modelo User
-- Permite almacenar la preferencia de zona horaria IANA del usuario
-- NULL = se usa el default del sistema (America/Argentina/Buenos_Aires)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN "User"."timezone" IS 'IANA timezone del usuario (ej: America/Argentina/Buenos_Aires). NULL = default del sistema.';
