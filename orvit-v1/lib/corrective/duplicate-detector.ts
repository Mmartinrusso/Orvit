import { prisma } from '@/lib/prisma';
import { validate, duplicateDetectionParamsSchema, linkDuplicateParamsSchema } from './validations';

export interface DuplicateDetectionParams {
  machineId: number;
  componentId?: number;
  subcomponentId?: number;
  title: string;
  symptomIds?: number[];
  companyId: number;
}

export interface DuplicateResult {
  id: number;
  title: string;
  description?: string | null;
  reportedAt: Date;
  reportedBy: number;
  status: string | null;
  priority: string | null;
  similarity: number;
  machineId?: number | null;
  componentId?: number;
  symptoms?: any;
}

/**
 * Detecta duplicados de fallas en la ventana configurable
 * Busca ocurrencias ABIERTAS o EN_PROCESO en las últimas N horas
 * Calcula similaridad usando Levenshtein + overlap de síntomas
 */
export async function detectDuplicates(params: DuplicateDetectionParams): Promise<DuplicateResult[]> {
  // ✅ Validar parámetros
  const validated = validate(duplicateDetectionParamsSchema, params);
  const { machineId, componentId, subcomponentId, title, symptomIds = [], companyId } = validated;

  // 1. Obtener configuración de ventana (NO hardcoded)
  const settings = await prisma.correctiveSettings.findUnique({
    where: { companyId }
  });

  const windowHours = settings?.duplicateWindowHours ?? 48; // default 48h

  // 2. Calcular fecha de corte
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - windowHours);

  // 3. Buscar ocurrencias ABIERTAS o EN_PROCESO (no cerradas)
  // ✅ SIEMPRE filtrar isLinkedDuplicate=false
  // Nota: FailureOccurrence no tiene componentId, solo subcomponentId
  const candidates = await prisma.failureOccurrence.findMany({
    where: {
      companyId,
      machineId,
      status: { in: ['OPEN', 'IN_PROGRESS', 'REPORTED'] },
      reportedAt: { gte: cutoffDate },
      isLinkedDuplicate: false, // ✅ No buscar en duplicados ya vinculados
      ...(subcomponentId && { subcomponentId })
    },
    select: {
      id: true,
      title: true,
      description: true,
      reportedAt: true,
      reportedBy: true,
      status: true,
      priority: true,
      machineId: true,
      symptoms: true,
      machine: {
        select: { id: true, name: true }
      }
    },
    orderBy: {
      reportedAt: 'desc'
    }
  });

  // 4. Calcular similaridad (Levenshtein + overlap síntomas)
  const scored = candidates.map(c => ({
    ...c,
    similarity: calculateSimilarity(title, c.title || '', symptomIds, c.symptoms as any)
  }));

  // 5. Retornar duplicados con score >= 70%
  return scored.filter(c => c.similarity >= 70);
}

/**
 * Calcula similaridad entre dos fallas usando:
 * - Distancia de Levenshtein entre títulos (70% peso)
 * - Overlap de síntomas (30% peso)
 */
function calculateSimilarity(
  title1: string,
  title2: string,
  symptoms1: number[],
  symptoms2: any
): number {
  // Peso de cada factor
  const TITLE_WEIGHT = 0.7;
  const SYMPTOM_WEIGHT = 0.3;

  // Similaridad de título (1 - normalized Levenshtein distance)
  const titleSimilarity = 1 - (levenshteinDistance(title1.toLowerCase(), title2.toLowerCase()) / Math.max(title1.length, title2.length));

  // Similaridad de síntomas (Jaccard index)
  let symptomSimilarity = 0;
  if (symptoms1.length > 0 || (symptoms2 && Array.isArray(symptoms2) && symptoms2.length > 0)) {
    const set1 = new Set(symptoms1);
    const set2 = new Set(Array.isArray(symptoms2) ? symptoms2 : []);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    symptomSimilarity = union.size > 0 ? intersection.size / union.size : 0;
  }

  // Score combinado
  const score = (titleSimilarity * TITLE_WEIGHT + symptomSimilarity * SYMPTOM_WEIGHT) * 100;
  return Math.round(score);
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 * (número mínimo de operaciones para transformar s1 en s2)
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Vincula una falla como duplicado de otra (conserva timeline)
 * NO crea una FailureOccurrence completa, solo un registro minimal
 */
export async function linkDuplicate(params: {
  mainOccurrenceId: number;
  reportedBy: number;
  linkedReason?: string;
  symptoms?: number[];
  attachments?: any[];
  notes?: string;
  companyId: number;
  machineId: number;
  subcomponentId?: number;
}) {
  // ✅ Validar parámetros
  const validated = validate(linkDuplicateParamsSchema, params);
  const { mainOccurrenceId, reportedBy, linkedReason, symptoms, attachments, notes, companyId, machineId, subcomponentId } = validated;

  // 1. Obtener la ocurrencia principal para conseguir su workOrderId
  const mainOccurrence = await prisma.failureOccurrence.findUnique({
    where: { id: mainOccurrenceId },
    select: { failureId: true }
  });

  if (!mainOccurrence) {
    throw new Error('Ocurrencia principal no encontrada');
  }

  // 2. Crear registro minimal de duplicado usando el mismo workOrderId
  const duplicateOccurrence = await prisma.failureOccurrence.create({
    data: {
      failureId: mainOccurrence.failureId, // ✅ Usar el WorkOrder del caso principal
      companyId,
      machineId,
      subcomponentId,
      reportedBy,
      reportedAt: new Date(),
      isLinkedDuplicate: true,
      linkedToOccurrenceId: mainOccurrenceId,
      linkedAt: new Date(),
      linkedById: reportedBy,
      linkedReason,
      symptoms: symptoms ? JSON.stringify(symptoms) : null,
      notes,
      status: 'OPEN'
    }
  });

  // 3. Si trae foto/síntomas nuevos, agregarlos al caso principal
  if (attachments && attachments.length > 0) {
    const mainPhotos = await prisma.failureOccurrence.findUnique({
      where: { id: mainOccurrenceId },
      select: { photos: true }
    });

    const existingPhotos = mainPhotos?.photos as any[] || [];
    const updatedPhotos = [...existingPhotos, ...attachments];

    await prisma.failureOccurrence.update({
      where: { id: mainOccurrenceId },
      data: { photos: updatedPhotos }
    });
  }

  return duplicateOccurrence;
}

/**
 * Detecta REINCIDENCIAS - fallas que volvieron a ocurrir después de cerradas
 * Busca ocurrencias RESUELTAS en la misma máquina/componente dentro de la ventana configurable
 */
export async function detectRecurrence(params: {
  machineId: number;
  componentId?: number;
  subcomponentId?: number;
  title: string;
  companyId: number;
}): Promise<{
  isRecurrence: boolean;
  previousOccurrence?: DuplicateResult;
  daysSinceResolved?: number;
}> {
  const { machineId, subcomponentId, title, companyId } = params;

  // 1. Obtener configuración de ventana de reincidencia
  const settings = await prisma.correctiveSettings.findUnique({
    where: { companyId }
  });

  const recurrenceWindowDays = settings?.recurrenceWindowDays ?? 7; // default 7 días

  // 2. Calcular fecha de corte
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - recurrenceWindowDays);

  // 3. Buscar ocurrencias RESUELTAS en la ventana
  const candidates = await prisma.failureOccurrence.findMany({
    where: {
      companyId,
      machineId,
      status: { in: ['RESOLVED', 'RESOLVED_IMMEDIATE'] },
      resolvedAt: { gte: cutoffDate },
      isLinkedDuplicate: false,
      ...(subcomponentId && { subcomponentId })
    },
    select: {
      id: true,
      title: true,
      description: true,
      reportedAt: true,
      reportedBy: true,
      resolvedAt: true,
      status: true,
      priority: true,
      machineId: true,
      symptoms: true,
    },
    orderBy: {
      resolvedAt: 'desc'
    }
  });

  if (candidates.length === 0) {
    return { isRecurrence: false };
  }

  // 4. Calcular similaridad con cada candidato
  const scored = candidates.map(c => ({
    ...c,
    similarity: calculateSimilarity(title, c.title || '', [], c.symptoms as any)
  }));

  // 5. Encontrar la más similar con score >= 60%
  const mostSimilar = scored.find(c => c.similarity >= 60);

  if (!mostSimilar) {
    return { isRecurrence: false };
  }

  // 6. Calcular días desde la resolución
  const daysSinceResolved = mostSimilar.resolvedAt
    ? Math.floor((Date.now() - mostSimilar.resolvedAt.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    isRecurrence: true,
    previousOccurrence: mostSimilar,
    daysSinceResolved
  };
}
