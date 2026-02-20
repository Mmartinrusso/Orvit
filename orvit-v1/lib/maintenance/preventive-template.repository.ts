/**
 * Repositorio para PreventiveTemplate y PreventiveInstance.
 * Centraliza el acceso a datos que antes estaba disperso en 21+ archivos
 * usando JSON-in-Document.
 *
 * Uso: importar funciones individuales en cada ruta API.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ========== Types ==========

export interface PreventiveTemplateData {
  title: string;
  description?: string | null;
  priority?: string;
  notes?: string | null;
  machineId?: number | null;
  machineName?: string | null;
  unidadMovilId?: number | null;
  isMobileUnit?: boolean;
  componentIds?: number[];
  componentNames?: string[];
  subcomponentIds?: number[];
  subcomponentNames?: string[];
  frequencyDays?: number;
  nextMaintenanceDate?: Date | string | null;
  lastMaintenanceDate?: Date | string | null;
  weekdaysOnly?: boolean;
  estimatedHours?: number | null;
  timeUnit?: string;
  timeValue?: number | null;
  executionWindow?: string;
  toolsRequired?: unknown[];
  assignedToId?: number | null;
  assignedToName?: string | null;
  companyId: number;
  sectorId?: number | null;
  createdById?: number | null;
  isActive?: boolean;
  alertDaysBefore?: number[];
  instructives?: unknown[];
}

export interface PreventiveInstanceData {
  templateId: number;
  scheduledDate: Date | string;
  status?: string;
  actualStartDate?: Date | string | null;
  actualEndDate?: Date | string | null;
  actualHours?: number | null;
  completedById?: number | null;
  completionNotes?: string | null;
  toolsUsed?: unknown[];
  photoUrls?: unknown[];
}

export interface CompletionData {
  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;
  maintenanceCount: number;
  lastExecutionDuration?: number | null;
  lastExecutionNotes?: string | null;
  averageDuration?: number | null;
  executionHistory?: unknown[];
}

// ========== Template CRUD ==========

/**
 * Crea un template de mantenimiento preventivo con instancias opcionales.
 */
export async function createTemplate(
  data: PreventiveTemplateData,
  instances?: PreventiveInstanceData[]
) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.preventiveTemplate.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? 'MEDIUM',
        notes: data.notes ?? null,
        machineId: data.machineId ?? null,
        machineName: data.machineName ?? null,
        unidadMovilId: data.unidadMovilId ?? null,
        isMobileUnit: data.isMobileUnit ?? false,
        componentIds: data.componentIds ?? [],
        componentNames: data.componentNames ?? [],
        subcomponentIds: data.subcomponentIds ?? [],
        subcomponentNames: data.subcomponentNames ?? [],
        frequencyDays: data.frequencyDays ?? 30,
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate as string) : null,
        lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate as string) : null,
        weekdaysOnly: data.weekdaysOnly ?? true,
        estimatedHours: data.estimatedHours ?? null,
        timeUnit: data.timeUnit ?? 'HOURS',
        timeValue: data.timeValue ?? null,
        executionWindow: data.executionWindow ?? 'ANY_TIME',
        toolsRequired: (data.toolsRequired ?? []) as Prisma.InputJsonValue,
        assignedToId: data.assignedToId ?? null,
        assignedToName: data.assignedToName ?? null,
        companyId: data.companyId,
        sectorId: data.sectorId ?? null,
        createdById: data.createdById ?? null,
        isActive: data.isActive ?? true,
        alertDaysBefore: data.alertDaysBefore ?? [3, 2, 1, 0],
        instructives: (data.instructives ?? []) as Prisma.InputJsonValue,
      },
      include: {
        machine: { select: { id: true, name: true } },
        unidadMovil: { select: { id: true, nombre: true } },
        assignedTo: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
      },
    });

    // Crear instancias si se proporcionan
    if (instances && instances.length > 0) {
      await tx.preventiveInstance.createMany({
        data: instances.map((inst) => ({
          templateId: template.id,
          scheduledDate: new Date(inst.scheduledDate as string),
          status: inst.status ?? 'PENDING',
        })),
      });
    }

    return template;
  });
}

/**
 * Obtiene un template por ID con sus instancias.
 */
export async function getTemplateById(id: number) {
  return prisma.preventiveTemplate.findUnique({
    where: { id },
    include: {
      machine: { select: { id: true, name: true } },
      unidadMovil: { select: { id: true, nombre: true } },
      assignedTo: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      instances: {
        orderBy: { scheduledDate: 'asc' },
      },
    },
  });
}

/**
 * Lista templates filtrados por empresa y criterios opcionales.
 */
export async function listTemplates(filters: {
  companyId: number;
  machineId?: number;
  sectorId?: number;
  isActive?: boolean;
  includeInstances?: boolean;
}) {
  const where: Prisma.PreventiveTemplateWhereInput = {
    companyId: filters.companyId,
  };
  if (filters.machineId != null) where.machineId = filters.machineId;
  if (filters.sectorId != null) where.sectorId = filters.sectorId;
  if (filters.isActive != null) where.isActive = filters.isActive;

  return prisma.preventiveTemplate.findMany({
    where,
    include: {
      machine: { select: { id: true, name: true, sectorId: true } },
      unidadMovil: { select: { id: true, nombre: true } },
      assignedTo: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      instances: filters.includeInstances
        ? { orderBy: { scheduledDate: 'asc' } }
        : false,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Actualiza un template y opcionalmente recalcula instancias.
 */
export async function updateTemplate(
  id: number,
  data: Partial<PreventiveTemplateData>,
  recalculateInstances?: boolean
) {
  return prisma.$transaction(async (tx) => {
    const updateData: Prisma.PreventiveTemplateUpdateInput = {};

    // Solo setear campos presentes
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.machineId !== undefined) {
      updateData.machine = data.machineId
        ? { connect: { id: data.machineId } }
        : { disconnect: true };
    }
    if (data.machineName !== undefined) updateData.machineName = data.machineName;
    if (data.unidadMovilId !== undefined) {
      updateData.unidadMovil = data.unidadMovilId
        ? { connect: { id: data.unidadMovilId } }
        : { disconnect: true };
    }
    if (data.isMobileUnit !== undefined) updateData.isMobileUnit = data.isMobileUnit;
    if (data.componentIds !== undefined) updateData.componentIds = data.componentIds;
    if (data.componentNames !== undefined) updateData.componentNames = data.componentNames;
    if (data.subcomponentIds !== undefined) updateData.subcomponentIds = data.subcomponentIds;
    if (data.subcomponentNames !== undefined) updateData.subcomponentNames = data.subcomponentNames;
    if (data.frequencyDays !== undefined) updateData.frequencyDays = data.frequencyDays;
    if (data.nextMaintenanceDate !== undefined) {
      updateData.nextMaintenanceDate = data.nextMaintenanceDate
        ? new Date(data.nextMaintenanceDate as string)
        : null;
    }
    if (data.weekdaysOnly !== undefined) updateData.weekdaysOnly = data.weekdaysOnly;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.timeUnit !== undefined) updateData.timeUnit = data.timeUnit;
    if (data.timeValue !== undefined) updateData.timeValue = data.timeValue;
    if (data.executionWindow !== undefined) updateData.executionWindow = data.executionWindow;
    if (data.toolsRequired !== undefined) updateData.toolsRequired = data.toolsRequired as Prisma.InputJsonValue;
    if (data.assignedToId !== undefined) {
      updateData.assignedTo = data.assignedToId
        ? { connect: { id: data.assignedToId } }
        : { disconnect: true };
    }
    if (data.assignedToName !== undefined) updateData.assignedToName = data.assignedToName;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.alertDaysBefore !== undefined) updateData.alertDaysBefore = data.alertDaysBefore;
    if (data.instructives !== undefined) updateData.instructives = data.instructives as Prisma.InputJsonValue;

    const template = await tx.preventiveTemplate.update({
      where: { id },
      data: updateData,
      include: {
        machine: { select: { id: true, name: true } },
        unidadMovil: { select: { id: true, nombre: true } },
        assignedTo: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
      },
    });

    // Si cambió frequencyDays, recalcular instancias PENDING
    if (recalculateInstances && data.frequencyDays) {
      await tx.preventiveInstance.deleteMany({
        where: { templateId: id, status: 'PENDING' },
      });

      const baseDate = template.nextMaintenanceDate ?? new Date();
      const newInstances = generateInstanceDates(
        baseDate,
        data.frequencyDays,
        template.weekdaysOnly,
        4
      );

      if (newInstances.length > 0) {
        await tx.preventiveInstance.createMany({
          data: newInstances.map((date) => ({
            templateId: id,
            scheduledDate: date,
            status: 'PENDING',
          })),
        });
      }
    }

    return template;
  });
}

/**
 * Elimina un template y todas sus instancias (cascade).
 */
export async function deleteTemplate(id: number) {
  return prisma.preventiveTemplate.delete({ where: { id } });
}

// ========== Template Completion ==========

/**
 * Registra la completación de un mantenimiento preventivo.
 */
export async function completeTemplate(id: number, completion: CompletionData) {
  return prisma.preventiveTemplate.update({
    where: { id },
    data: {
      lastMaintenanceDate: completion.lastMaintenanceDate,
      nextMaintenanceDate: completion.nextMaintenanceDate,
      maintenanceCount: completion.maintenanceCount,
      lastExecutionDuration: completion.lastExecutionDuration ?? undefined,
      averageDuration: completion.averageDuration ?? undefined,
      executionHistory: (completion.executionHistory ?? []) as Prisma.InputJsonValue,
    },
  });
}

// ========== Instance CRUD ==========

/**
 * Lista instancias de un template.
 */
export async function listInstances(templateId: number, status?: string) {
  const where: Prisma.PreventiveInstanceWhereInput = { templateId };
  if (status) where.status = status;

  return prisma.preventiveInstance.findMany({
    where,
    orderBy: { scheduledDate: 'asc' },
    include: {
      completedBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Actualiza el status de una instancia.
 */
export async function updateInstanceStatus(
  instanceId: number,
  status: string,
  completionData?: {
    completedById?: number;
    completionNotes?: string;
    actualStartDate?: Date;
    actualEndDate?: Date;
    actualHours?: number;
    toolsUsed?: unknown[];
    photoUrls?: unknown[];
  }
) {
  return prisma.preventiveInstance.update({
    where: { id: instanceId },
    data: {
      status,
      ...(completionData && {
        completedById: completionData.completedById,
        completionNotes: completionData.completionNotes,
        actualStartDate: completionData.actualStartDate,
        actualEndDate: completionData.actualEndDate,
        actualHours: completionData.actualHours,
        toolsUsed: (completionData.toolsUsed ?? []) as Prisma.InputJsonValue,
        photoUrls: (completionData.photoUrls ?? []) as Prisma.InputJsonValue,
      }),
    },
  });
}

/**
 * Marca instancias vencidas como OVERDUE.
 */
export async function markOverdueInstances() {
  const now = new Date();
  return prisma.preventiveInstance.updateMany({
    where: {
      status: 'PENDING',
      scheduledDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });
}

// ========== Queries Especializadas ==========

/**
 * Templates activos con nextMaintenanceDate para scheduler/alerts.
 */
export async function getActiveTemplatesForScheduler(companyId?: number) {
  const where: Prisma.PreventiveTemplateWhereInput = {
    isActive: true,
    nextMaintenanceDate: { not: null },
  };
  if (companyId) where.companyId = companyId;

  return prisma.preventiveTemplate.findMany({
    where,
    select: {
      id: true,
      title: true,
      frequencyDays: true,
      nextMaintenanceDate: true,
      lastMaintenanceDate: true,
      machineId: true,
      machineName: true,
      assignedToId: true,
      assignedToName: true,
      companyId: true,
      sectorId: true,
      priority: true,
      estimatedHours: true,
      timeUnit: true,
      alertDaysBefore: true,
    },
  });
}

/**
 * Templates pendientes con filtros para la vista de pending.
 */
export async function getPendingTemplates(filters: {
  companyId: number;
  sectorId?: number;
  machineId?: number;
}) {
  const where: Prisma.PreventiveTemplateWhereInput = {
    companyId: filters.companyId,
    isActive: true,
  };
  if (filters.sectorId) where.sectorId = filters.sectorId;
  if (filters.machineId) where.machineId = filters.machineId;

  return prisma.preventiveTemplate.findMany({
    where,
    include: {
      machine: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      instances: {
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      },
    },
    orderBy: { nextMaintenanceDate: 'asc' },
  });
}

/**
 * Datos para exportación PDF.
 */
export async function getTemplatesForExport(companyId: number) {
  return prisma.preventiveTemplate.findMany({
    where: { companyId, isActive: true },
    include: {
      machine: { select: { id: true, name: true } },
      unidadMovil: { select: { id: true, nombre: true } },
      assignedTo: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      instances: {
        orderBy: { scheduledDate: 'desc' },
        take: 10,
      },
    },
    orderBy: { title: 'asc' },
  });
}

// ========== Helpers ==========

/**
 * Genera fechas de instancias futuras basadas en frecuencia.
 */
function generateInstanceDates(
  baseDate: Date,
  frequencyDays: number,
  weekdaysOnly: boolean,
  count: number
): Date[] {
  const dates: Date[] = [];
  let current = new Date(baseDate);

  for (let i = 0; i < count; i++) {
    current = new Date(current.getTime() + frequencyDays * 24 * 60 * 60 * 1000);

    if (weekdaysOnly) {
      const day = current.getDay();
      if (day === 0) current.setDate(current.getDate() + 1); // Dom → Lun
      if (day === 6) current.setDate(current.getDate() + 2); // Sáb → Lun
    }

    dates.push(new Date(current));
  }

  return dates;
}

/**
 * Convierte un template de la nueva tabla al formato JSON legacy
 * para compatibilidad con código que aún no fue migrado.
 */
export function templateToLegacyJson(template: {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  notes: string | null;
  machineId: number | null;
  machineName: string | null;
  unidadMovilId: number | null;
  isMobileUnit: boolean;
  componentIds: number[];
  componentNames: string[];
  subcomponentIds: number[];
  subcomponentNames: string[];
  frequencyDays: number;
  nextMaintenanceDate: Date | null;
  lastMaintenanceDate: Date | null;
  weekdaysOnly: boolean;
  estimatedHours: number | null;
  timeUnit: string;
  timeValue: number | null;
  executionWindow: string;
  toolsRequired: unknown;
  assignedToId: number | null;
  assignedToName: string | null;
  companyId: number;
  sectorId: number | null;
  createdById: number | null;
  isActive: boolean;
  maintenanceCount: number;
  alertDaysBefore: number[];
  averageDuration: number | null;
  lastExecutionDuration: number | null;
  executionHistory: unknown;
  instructives: unknown;
  createdAt: Date;
}) {
  return {
    templateType: 'PREVENTIVE_MAINTENANCE',
    title: template.title,
    description: template.description,
    priority: template.priority,
    frequencyDays: template.frequencyDays,
    estimatedHours: template.estimatedHours,
    alertDaysBefore: template.alertDaysBefore,
    machineId: template.machineId,
    unidadMovilId: template.unidadMovilId,
    machineName: template.machineName,
    isMobileUnit: template.isMobileUnit,
    componentIds: template.componentIds,
    componentNames: template.componentNames,
    subcomponentIds: template.subcomponentIds,
    subcomponentNames: template.subcomponentNames,
    executionWindow: template.executionWindow,
    timeUnit: template.timeUnit,
    timeValue: template.timeValue,
    assignedToId: template.assignedToId,
    assignedToName: template.assignedToName,
    companyId: template.companyId,
    sectorId: template.sectorId,
    createdById: template.createdById,
    notes: template.notes,
    isActive: template.isActive,
    toolsRequired: template.toolsRequired,
    instructives: template.instructives,
    nextMaintenanceDate: template.nextMaintenanceDate?.toISOString() ?? null,
    lastMaintenanceDate: template.lastMaintenanceDate?.toISOString() ?? null,
    weekdaysOnly: template.weekdaysOnly,
    maintenanceCount: template.maintenanceCount,
    averageDuration: template.averageDuration,
    lastExecutionDuration: template.lastExecutionDuration,
    executionHistory: template.executionHistory,
    createdAt: template.createdAt.toISOString(),
  };
}
