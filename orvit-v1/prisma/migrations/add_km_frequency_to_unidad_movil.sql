-- Migración: Frecuencia de carga de km en UnidadMovil
-- Fecha: 2026-02-23
-- Descripción: Agrega campos para configurar cada cuántos días debe registrarse
--              el kilometraje y cuándo fue la última lectura registrada.
--              Permite detectar unidades con lectura vencida y alertar al usuario.

ALTER TABLE "UnidadMovil"
  ADD COLUMN IF NOT EXISTS "kmUpdateFrequencyDays" INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "ultimaLecturaKm" TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN "UnidadMovil"."kmUpdateFrequencyDays" IS 'Cada cuántos días se debe registrar el km (null = sin frecuencia configurada)';
COMMENT ON COLUMN "UnidadMovil"."ultimaLecturaKm" IS 'Fecha/hora en que se registró el último km (para detectar lecturas vencidas)';
