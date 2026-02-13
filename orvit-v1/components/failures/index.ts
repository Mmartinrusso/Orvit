/**
 * Componentes de Fallas - P5 Corrective Maintenance
 *
 * Exportaciones centralizadas para el sistema de mantenimiento correctivo
 */

// Dialog de reporte rápido (20-30s)
export { FailureQuickReportDialog } from './FailureQuickReportDialog';

// Timeline de actividades
export { FailureTimelineTab } from './FailureTimelineTab';

// Botón crear OT desde observación
export { CreateWorkOrderButton } from './CreateWorkOrderButton';

// Dialog de Root Cause Analysis (5-Whys)
export { RCADialog } from './RCADialog';

// Panel de ejecución de checklists
export { ChecklistPanel } from './ChecklistPanel';

// Panel de sugerencias IA
export { AISuggestionsPanel } from './AISuggestionsPanel';

// Componentes existentes (re-export para compatibilidad)
export { default as FailureRegistrationDialog } from './FailureRegistrationDialog';
export { default as FailureOccurrenceDialog } from './FailureOccurrenceDialog';
export { default as FailureTypeSelector } from './FailureTypeSelector';
export { default as LoadSolutionDialog } from './LoadSolutionDialog';
export { default as SolutionsList } from './SolutionsList';
export { default as AddSolutionDialog } from './AddSolutionDialog';
