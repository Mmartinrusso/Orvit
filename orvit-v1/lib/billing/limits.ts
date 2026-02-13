/**
 * Servicio de Límites de Billing
 * Verifica límites de plan para empresas, usuarios y módulos
 */

import { prisma } from '@/lib/prisma';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  max: number | null; // null = ilimitado
}

/**
 * Verifica si un usuario puede crear una nueva empresa
 */
export async function canCreateCompany(userId: number): Promise<LimitCheckResult> {
  // Obtener la suscripción del usuario con el plan
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: true,
      companies: true,
    },
  });

  // Si no tiene suscripción, no puede crear empresas
  if (!subscription) {
    return {
      allowed: false,
      reason: 'No tienes una suscripción activa',
      current: 0,
      max: 0,
    };
  }

  // Verificar estado de la suscripción
  if (subscription.status === 'CANCELED' || subscription.status === 'PAUSED') {
    return {
      allowed: false,
      reason: `Tu suscripción está ${subscription.status === 'CANCELED' ? 'cancelada' : 'pausada'}`,
      current: subscription.companies.length,
      max: subscription.plan.maxCompanies,
    };
  }

  if (subscription.status === 'PAST_DUE') {
    return {
      allowed: false,
      reason: 'Tu suscripción tiene pagos pendientes',
      current: subscription.companies.length,
      max: subscription.plan.maxCompanies,
    };
  }

  // NULL = ilimitado
  if (subscription.plan.maxCompanies === null) {
    return {
      allowed: true,
      current: subscription.companies.length,
      max: null,
    };
  }

  // Verificar límite de empresas
  const currentCount = subscription.companies.length;
  const maxAllowed = subscription.plan.maxCompanies;

  if (currentCount >= maxAllowed) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${maxAllowed} empresa(s) de tu plan ${subscription.plan.displayName}`,
      current: currentCount,
      max: maxAllowed,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    max: maxAllowed,
  };
}

/**
 * Verifica si se puede agregar un usuario a una empresa
 */
export async function canAddUser(companyId: number): Promise<LimitCheckResult> {
  // Obtener la empresa con su suscripción y conteo de usuarios
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
      users: {
        where: { isActive: true },
      },
    },
  });

  if (!company) {
    return {
      allowed: false,
      reason: 'Empresa no encontrada',
      current: 0,
      max: 0,
    };
  }

  // Si no tiene suscripción asociada, verificar owner
  if (!company.subscription) {
    return {
      allowed: false,
      reason: 'La empresa no tiene una suscripción asociada',
      current: company.users.length,
      max: 0,
    };
  }

  const { subscription } = company;

  // Verificar estado de la suscripción
  if (subscription.status === 'CANCELED' || subscription.status === 'PAUSED') {
    return {
      allowed: false,
      reason: `La suscripción está ${subscription.status === 'CANCELED' ? 'cancelada' : 'pausada'}`,
      current: company.users.length,
      max: subscription.plan.maxUsersPerCompany,
    };
  }

  // NULL = ilimitado
  if (subscription.plan.maxUsersPerCompany === null) {
    return {
      allowed: true,
      current: company.users.length,
      max: null,
    };
  }

  // Verificar límite de usuarios
  const currentCount = company.users.length;
  const maxAllowed = subscription.plan.maxUsersPerCompany;

  if (currentCount >= maxAllowed) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${maxAllowed} usuario(s) por empresa del plan`,
      current: currentCount,
      max: maxAllowed,
    };
  }

  return {
    allowed: true,
    current: currentCount,
    max: maxAllowed,
  };
}

/**
 * Obtiene los módulos permitidos para una empresa según su plan
 * Retorna la intersección entre los módulos del plan y los del template de la empresa
 */
export async function getAllowedModules(companyId: number): Promise<string[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
      companyModules: {
        include: {
          module: true,
        },
      },
    },
  });

  if (!company || !company.subscription) {
    return [];
  }

  const planModuleKeys = company.subscription.plan.moduleKeys;

  // Si el plan tiene array vacío = todos los módulos permitidos (Enterprise)
  if (planModuleKeys.length === 0) {
    return company.companyModules.map(cm => cm.module.key);
  }

  // Retornar solo los módulos habilitados que están en el plan
  const enabledModuleKeys = company.companyModules
    .filter(cm => cm.isEnabled)
    .map(cm => cm.module.key);

  // Intersección: módulos habilitados que están permitidos por el plan
  return enabledModuleKeys.filter(key => planModuleKeys.includes(key));
}

/**
 * Verifica si un módulo específico está permitido para una empresa
 */
export async function isModuleAllowed(companyId: number, moduleKey: string): Promise<boolean> {
  const allowedModules = await getAllowedModules(companyId);
  return allowedModules.includes(moduleKey);
}

/**
 * Calcula los módulos que deben habilitarse al crear una empresa
 * basándose en el plan del owner y el template seleccionado
 */
export async function calculateEnabledModules(
  planId: string,
  templateModuleKeys: string[]
): Promise<string[]> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return [];
  }

  // Si el plan tiene array vacío = todos los módulos permitidos (Enterprise)
  if (plan.moduleKeys.length === 0) {
    return templateModuleKeys;
  }

  // Intersección: módulos del template que están en el plan
  return templateModuleKeys.filter(key => plan.moduleKeys.includes(key));
}

/**
 * Obtiene información de límites para mostrar en la UI
 */
export async function getSubscriptionLimits(userId: number): Promise<{
  plan: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  companies: {
    current: number;
    max: number | null;
    remaining: number | null;
  };
  usersPerCompany: number | null;
  tokens: {
    included: number;
    purchased: number;
    usedThisPeriod: number;
    available: number;
  };
  status: string;
  nextBillingDate: Date | null;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: true,
      companies: true,
    },
  });

  if (!subscription) {
    return {
      plan: null,
      companies: { current: 0, max: 0, remaining: 0 },
      usersPerCompany: 0,
      tokens: { included: 0, purchased: 0, usedThisPeriod: 0, available: 0 },
      status: 'NO_SUBSCRIPTION',
      nextBillingDate: null,
    };
  }

  const companiesMax = subscription.plan.maxCompanies;
  const companiesCurrent = subscription.companies.length;
  const companiesRemaining = companiesMax === null
    ? null
    : Math.max(0, companiesMax - companiesCurrent);

  const tokensAvailable = subscription.includedTokensRemaining + subscription.purchasedTokensBalance;

  return {
    plan: {
      id: subscription.plan.id,
      name: subscription.plan.name,
      displayName: subscription.plan.displayName,
    },
    companies: {
      current: companiesCurrent,
      max: companiesMax,
      remaining: companiesRemaining,
    },
    usersPerCompany: subscription.plan.maxUsersPerCompany,
    tokens: {
      included: subscription.includedTokensRemaining,
      purchased: subscription.purchasedTokensBalance,
      usedThisPeriod: subscription.tokensUsedThisPeriod,
      available: tokensAvailable,
    },
    status: subscription.status,
    nextBillingDate: subscription.nextBillingDate,
  };
}
