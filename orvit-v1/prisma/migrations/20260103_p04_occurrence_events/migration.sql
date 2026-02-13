-- P0.4: Agregar campo occurrenceEvents para "Pasó otra vez"
-- Ejecutar manualmente en la base de datos

-- Agregar columna occurrenceEvents a failure_occurrences
ALTER TABLE failure_occurrences ADD COLUMN IF NOT EXISTS occurrence_events JSON NULL;

-- Comentario de documentación
COMMENT ON COLUMN failure_occurrences.occurrence_events IS 'Array de eventos "pasó otra vez" sin crear nueva FailureOccurrence. Formato: [{id, reportedBy, reportedAt, symptoms, attachments, notes, causedDowntime}]';
