/**
 * Determina si un WorkOrder requiere QA (Quality Assurance) selectivo
 * basado en reglas configurables por empresa
 */

import { prisma } from '@/lib/prisma';
import {
  validate,
  qaRequirementParamsSchema,
  validateQACompletionParamsSchema,
  createOrUpdateQAParamsSchema
} from './validations';
import { AssetCriticality, EvidenceLevel } from '@prisma/client';
import { Priority } from './priority-calculator';

export interface QARequirementParams {
  isSafetyRelated: boolean;
  priority: Priority | string;
  assetCriticality?: AssetCriticality | string | null;
  causedDowntime: boolean;
  downtimeMinutes?: number;
  isRecurrence: boolean;
  recurrenceDays?: number;
  companyId: number;
}

export interface QARequirementResult {
  required: boolean;
  reason?: 'SAFETY' | 'HIGH_PRIORITY' | 'HIGH_CRITICALITY' | 'HIGH_DOWNTIME' | 'RECURRENCE';
  evidenceLevel: EvidenceLevel;
}

/**
 * Obtiene la configuración de corrective settings para una empresa
 * Si no existe, crea una con valores por defecto
 */
async function getCorrectiveSettings(companyId: number) {
  let settings = await prisma.correctiveSettings.findUnique({
    where: { companyId }
  });

  // Si no existe, crear con defaults
  if (!settings) {
    settings = await prisma.correctiveSettings.create({
      data: {
        companyId,
        duplicateWindowHours: 48,
        recurrenceWindowDays: 7,
        downtimeQaThresholdMin: 60,
        slaP1Hours: 4,
        slaP2Hours: 8,
        slaP3Hours: 24,
        slaP4Hours: 72,
        requireEvidenceP3: true,
        requireEvidenceP2: true,
        requireEvidenceP1: true,
        requireReturnConfirmationOnDowntime: true,
        requireReturnConfirmationOnQA: true
      }
    });
  }

  return settings;
}

/**
 * Determina si un WorkOrder requiere QA selectivo
 * y qué nivel de evidencia se requiere
 */
export async function requiresQA(params: QARequirementParams): Promise<QARequirementResult> {
  // ✅ Validar parámetros
  const validated = validate(qaRequirementParamsSchema, params);
  const {
    isSafetyRelated,
    priority,
    assetCriticality,
    causedDowntime,
    downtimeMinutes,
    isRecurrence,
    recurrenceDays,
    companyId
  } = validated;

  // Obtener configuración (NO hardcoded)
  const settings = await getCorrectiveSettings(companyId);

  // ✅ Seguridad = SIEMPRE QA con evidencia completa
  if (isSafetyRelated) {
    return {
      required: true,
      reason: 'SAFETY',
      evidenceLevel: 'COMPLETE'
    };
  }

  // ✅ P1 (Urgente) = QA con evidencia completa
  if (priority === 'P1' || priority === 'URGENT') {
    return {
      required: true,
      reason: 'HIGH_PRIORITY',
      evidenceLevel: 'COMPLETE'
    };
  }

  // ✅ P2 (Alta) = QA con evidencia estándar
  if (priority === 'P2' || priority === 'HIGH') {
    return {
      required: true,
      reason: 'HIGH_PRIORITY',
      evidenceLevel: 'STANDARD'
    };
  }

  // ✅ Criticidad Alta + Parada = QA con evidencia estándar
  if ((assetCriticality === 'CRITICAL' || assetCriticality === 'HIGH') && causedDowntime) {
    return {
      required: true,
      reason: 'HIGH_CRITICALITY',
      evidenceLevel: 'STANDARD'
    };
  }

  // ✅ Downtime > umbral configurable = QA con evidencia estándar
  if (downtimeMinutes && downtimeMinutes > settings.downtimeQaThresholdMin) {
    return {
      required: true,
      reason: 'HIGH_DOWNTIME',
      evidenceLevel: 'STANDARD'
    };
  }

  // ✅ Reincidencia rápida (< ventana configurable) = QA con evidencia estándar
  if (isRecurrence && (recurrenceDays || 0) < settings.recurrenceWindowDays) {
    return {
      required: true,
      reason: 'RECURRENCE',
      evidenceLevel: 'STANDARD'
    };
  }

  // ✅ P3 (Media) = evidencia básica según settings (QA no obligatorio)
  if ((priority === 'P3' || priority === 'MEDIUM') && settings.requireEvidenceP3) {
    return {
      required: false,
      evidenceLevel: 'BASIC'
    };
  }

  // ✅ P4 (Baja) = evidencia opcional
  return {
    required: false,
    evidenceLevel: 'OPTIONAL'
  };
}

/**
 * Valida que el QA esté completo antes de cerrar el WorkOrder
 */
export async function validateQACompletion(workOrderId: number): Promise<{
  valid: boolean;
  error?: string;
}> {
  // ✅ Validar parámetros
  validate(validateQACompletionParamsSchema, { workOrderId });

  const qa = await prisma.qualityAssurance.findUnique({
    where: { workOrderId }
  });

  // Si no hay QA, es válido (no se requiere)
  if (!qa || !qa.isRequired) {
    return { valid: true };
  }

  // QA debe estar aprobado
  if (qa.status !== 'APPROVED') {
    return {
      valid: false,
      error: `El QA debe estar aprobado antes de cerrar (estado actual: ${qa.status})`
    };
  }

  // Si requiere evidencia, verificar que se haya proporcionado
  if (qa.evidenceRequired !== 'OPTIONAL') {
    const evidenceProvided = qa.evidenceProvided as any;
    if (!evidenceProvided || (Array.isArray(evidenceProvided) && evidenceProvided.length === 0)) {
      return {
        valid: false,
        error: `Se requiere evidencia de nivel ${qa.evidenceRequired}`
      };
    }
  }

  return { valid: true };
}

/**
 * Crea o actualiza el registro de QA para un WorkOrder
 */
export async function createOrUpdateQA(params: {
  workOrderId: number;
  companyId: number;
  qaRequirement: QARequirementResult;
}): Promise<void> {
  // ✅ Validar parámetros
  const validated = validate(createOrUpdateQAParamsSchema, params);
  const { workOrderId, companyId, qaRequirement } = validated;

  const settings = await getCorrectiveSettings(companyId);

  // Verificar si ya existe QA para este WorkOrder
  const existingQA = await prisma.qualityAssurance.findUnique({
    where: { workOrderId }
  });

  const qaData = {
    isRequired: qaRequirement.required,
    requiredReason: qaRequirement.reason || null,
    evidenceRequired: qaRequirement.evidenceLevel,
    status: qaRequirement.required ? 'PENDING' : 'NOT_REQUIRED'
  };

  if (existingQA) {
    // Actualizar QA existente
    await prisma.qualityAssurance.update({
      where: { workOrderId },
      data: qaData
    });
  } else {
    // Crear nuevo QA
    await prisma.qualityAssurance.create({
      data: {
        workOrderId,
        ...qaData
      }
    });
  }
}

/**
 * Obtiene el nivel de evidencia requerido en formato legible
 */
export function getEvidenceLevelLabel(level: EvidenceLevel): string {
  const labels: Record<EvidenceLevel, string> = {
    OPTIONAL: 'Opcional',
    BASIC: 'Básica (al menos 1 evidencia)',
    STANDARD: 'Estándar (evidencia + checklist)',
    COMPLETE: 'Completa (todo requerido)'
  };
  return labels[level];
}

/**
 * Exportar la función helper para obtener settings
 */
export { getCorrectiveSettings };
