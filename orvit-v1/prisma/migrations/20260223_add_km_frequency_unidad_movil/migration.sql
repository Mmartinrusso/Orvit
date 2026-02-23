-- Add km frequency tracking fields to UnidadMovil
-- Allows configuring how often km should be recorded and tracking the last reading date

ALTER TABLE "UnidadMovil"
  ADD COLUMN IF NOT EXISTS "kmUpdateFrequencyDays" INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "ultimaLecturaKm" TIMESTAMPTZ DEFAULT NULL;
