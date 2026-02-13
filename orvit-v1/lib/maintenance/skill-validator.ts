// Skill Validator for Work Order Assignment
// Validates that users have the required skills/certifications for a task

import { prisma } from '@/lib/prisma';

export interface SkillValidationResult {
  isQualified: boolean;
  missingSkills: Array<{
    skillId: number;
    skillName: string;
    requiredLevel: number;
    userLevel: number | null;
    isVerified: boolean;
    isCertificationRequired: boolean;
    hasCertification: boolean;
    certificationExpired: boolean;
  }>;
  warnings: string[];
  qualifiedSkills: Array<{
    skillId: number;
    skillName: string;
    userLevel: number;
    requiredLevel: number;
  }>;
}

export interface ValidationContext {
  userId: number;
  checklistId?: number;
  machineId?: number;
  maintenanceType?: string;
  companyId: number;
}

/**
 * Validates if a user has the required skills for a work order/task
 */
export async function validateUserSkills(
  context: ValidationContext
): Promise<SkillValidationResult> {
  const { userId, checklistId, machineId, maintenanceType, companyId } = context;

  const result: SkillValidationResult = {
    isQualified: true,
    missingSkills: [],
    warnings: [],
    qualifiedSkills: [],
  };

  // Get all applicable skill requirements
  const requirements = await getApplicableRequirements(
    companyId,
    checklistId,
    machineId,
    maintenanceType
  );

  if (requirements.length === 0) {
    // No skill requirements defined
    return result;
  }

  // Get user's skills
  const userSkills = await prisma.userSkill.findMany({
    where: {
      userId,
      skill: {
        companyId,
        isActive: true,
      },
    },
    include: {
      skill: true,
    },
  });

  // Get user's certifications
  const userCertifications = await prisma.userCertification.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
  });

  const now = new Date();

  // Check each requirement
  for (const req of requirements) {
    const userSkill = userSkills.find(us => us.skillId === req.skillId);
    const skill = req.skill;

    const certification = userCertifications.find(
      c => c.skillId === req.skillId
    );

    const hasCertification = !!certification;
    const certificationExpired = certification?.expiresAt
      ? certification.expiresAt < now
      : false;

    // Check if user has the skill at the required level
    const hasSkill = userSkill && userSkill.level >= req.minimumLevel;
    const isVerified = userSkill?.isVerified ?? false;

    // Check certification requirement
    const meetsCertificationReq =
      !skill.isCertificationRequired || (hasCertification && !certificationExpired);

    // Check expiration
    const skillExpired = userSkill?.expiresAt
      ? userSkill.expiresAt < now
      : false;

    if (!hasSkill || skillExpired || !meetsCertificationReq) {
      if (req.isRequired) {
        result.isQualified = false;
      }

      result.missingSkills.push({
        skillId: skill.id,
        skillName: skill.name,
        requiredLevel: req.minimumLevel,
        userLevel: userSkill?.level ?? null,
        isVerified,
        isCertificationRequired: skill.isCertificationRequired,
        hasCertification,
        certificationExpired,
      });

      // Add specific warnings
      if (userSkill && userSkill.level < req.minimumLevel) {
        result.warnings.push(
          `Nivel insuficiente en "${skill.name}": tiene nivel ${userSkill.level}, requiere ${req.minimumLevel}`
        );
      } else if (!userSkill) {
        result.warnings.push(
          `No tiene la habilidad "${skill.name}" (nivel ${req.minimumLevel} requerido)`
        );
      }

      if (skillExpired) {
        result.warnings.push(
          `La habilidad "${skill.name}" ha expirado`
        );
      }

      if (skill.isCertificationRequired && !hasCertification) {
        result.warnings.push(
          `Requiere certificación para "${skill.name}"`
        );
      } else if (certificationExpired) {
        result.warnings.push(
          `La certificación para "${skill.name}" ha expirado`
        );
      }

      if (!isVerified && userSkill) {
        result.warnings.push(
          `La habilidad "${skill.name}" no ha sido verificada`
        );
      }
    } else {
      result.qualifiedSkills.push({
        skillId: skill.id,
        skillName: skill.name,
        userLevel: userSkill!.level,
        requiredLevel: req.minimumLevel,
      });
    }
  }

  return result;
}

/**
 * Gets all applicable skill requirements for a task
 */
async function getApplicableRequirements(
  companyId: number,
  checklistId?: number,
  machineId?: number,
  maintenanceType?: string
) {
  // Build OR conditions for different requirement types
  const orConditions: Record<string, unknown>[] = [];

  // Requirements by checklist
  if (checklistId) {
    orConditions.push({ checklistId: Number(checklistId) });
  }

  // Requirements by machine
  if (machineId) {
    orConditions.push({ machineId: Number(machineId) });
  }

  // Requirements by maintenance type
  if (maintenanceType) {
    orConditions.push({ maintenanceType });
  }

  // Global requirements (no specific target)
  orConditions.push({
    checklistId: null,
    machineId: null,
    maintenanceType: null,
  });

  if (orConditions.length === 0) {
    return [];
  }

  const requirements = await prisma.taskSkillRequirement.findMany({
    where: {
      companyId,
      OR: orConditions,
    },
    include: {
      skill: true,
    },
  });

  // Deduplicate by skillId, keeping the highest requirement level
  const skillMap = new Map<number, typeof requirements[0]>();

  for (const req of requirements) {
    const existing = skillMap.get(req.skillId);
    if (!existing || existing.minimumLevel < req.minimumLevel) {
      skillMap.set(req.skillId, req);
    }
  }

  return Array.from(skillMap.values());
}

/**
 * Gets qualified users for a specific task
 */
export async function getQualifiedUsers(
  companyId: number,
  checklistId?: number,
  machineId?: number,
  maintenanceType?: string
): Promise<Array<{
  userId: number;
  userName: string;
  validation: SkillValidationResult;
}>> {
  // Get all users in the company
  const users = await prisma.userOnCompany.findMany({
    where: {
      companyId,
      user: {
        isActive: true,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const results = [];

  for (const userOnCompany of users) {
    const validation = await validateUserSkills({
      userId: userOnCompany.userId,
      checklistId,
      machineId,
      maintenanceType,
      companyId,
    });

    results.push({
      userId: userOnCompany.userId,
      userName: userOnCompany.user.name,
      validation,
    });
  }

  // Sort by qualification (qualified first) and by number of warnings
  results.sort((a, b) => {
    if (a.validation.isQualified !== b.validation.isQualified) {
      return a.validation.isQualified ? -1 : 1;
    }
    return a.validation.warnings.length - b.validation.warnings.length;
  });

  return results;
}

/**
 * Validates assignment and returns error if user is not qualified
 */
export async function validateWorkOrderAssignment(
  userId: number,
  workOrderId: number
): Promise<{ valid: boolean; error?: string; validation?: SkillValidationResult }> {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      machine: true,
      checklist: true,
    },
  });

  if (!workOrder) {
    return { valid: false, error: 'Orden de trabajo no encontrada' };
  }

  const validation = await validateUserSkills({
    userId,
    checklistId: workOrder.checklistId ?? undefined,
    machineId: workOrder.machineId ?? undefined,
    maintenanceType: workOrder.maintenanceType ?? undefined,
    companyId: workOrder.companyId,
  });

  if (!validation.isQualified) {
    return {
      valid: false,
      error: `Usuario no calificado: ${validation.warnings.join(', ')}`,
      validation,
    };
  }

  return { valid: true, validation };
}
