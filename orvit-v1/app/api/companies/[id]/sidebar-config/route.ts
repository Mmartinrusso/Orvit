import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, getUserCompanyId, getUserCompanyRole, isAdminRole } from '@/lib/admin-auth';
import {
  getEffectiveConfig,
  validateModuleConfig,
  ALL_MODULE_KEYS,
  getAdminModuleOrder,
  DEFAULT_ADMIN_MODULE_ORDER,
  type CompanySidebarConfig,
  type SidebarModuleKey,
} from '@/lib/sidebar/company-sidebar-config';

// GET /api/companies/[id]/sidebar-config
// Cualquier usuario autenticado de la empresa puede leer la config
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
    }

    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userCompanyId = getUserCompanyId(user);
    if (userCompanyId !== companyId && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso a esta empresa' }, { status: 403 });
    }

    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { sidebarConfig: true },
    });

    const savedConfig = settings?.sidebarConfig as CompanySidebarConfig | null;

    // Retorna la config efectiva para TODOS los módulos + orden admin + labels + custom groups
    const response: Record<string, any> = {
      isCustomized: !!savedConfig,
      adminOrder: getAdminModuleOrder(savedConfig),
      sectionLabels: savedConfig?.sectionLabels ?? {},
      customGroups: savedConfig?.customGroups ?? {},
    };
    for (const key of ALL_MODULE_KEYS) {
      response[key] = getEffectiveConfig(key, savedConfig);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[sidebar-config GET]', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// PUT /api/companies/[id]/sidebar-config
// Body: { module: SidebarModuleKey; config: ModuleSidebarConfig }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
    }

    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userCompanyId = getUserCompanyId(user);
    if (userCompanyId !== companyId && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso a esta empresa' }, { status: 403 });
    }

    const { name: roleName, displayName: roleDisplayName } = getUserCompanyRole(user, companyId);
    if (!isAdminRole(user.role, roleName, roleDisplayName)) {
      return NextResponse.json(
        { error: 'Se requiere rol de administrador para modificar el sidebar' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // ─── Caso: actualizar orden top-level ────────────────────────────────────
    if (body.adminOrder !== undefined) {
      const order: string[] = body.adminOrder;
      if (!Array.isArray(order) || !order.every(k => typeof k === 'string')) {
        return NextResponse.json({ error: 'adminOrder debe ser un array de strings' }, { status: 400 });
      }

      const currentSettings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: { sidebarConfig: true },
      });
      const currentConfig = (currentSettings?.sidebarConfig as CompanySidebarConfig) ?? {};
      const updatedConfig: CompanySidebarConfig = { ...currentConfig, adminOrder: order };

      await prisma.companySettings.upsert({
        where: { companyId },
        update: { sidebarConfig: updatedConfig },
        create: { companyId, sidebarConfig: updatedConfig },
      });

      return NextResponse.json({ success: true });
    }

    // ─── Caso: batch update (order + sectionLabels + customGroups) ───────────
    if (body.adminSidebarBatch !== undefined) {
      const batch = body.adminSidebarBatch as {
        adminOrder?: string[];
        sectionLabels?: Record<string, string>;
        upsertCustomGroups?: Record<string, { name: string; icon: string; items: string[] }>;
        removeCustomGroups?: string[];
      };

      const currentSettings = await prisma.companySettings.findUnique({
        where: { companyId },
        select: { sidebarConfig: true },
      });
      let updated = (currentSettings?.sidebarConfig as CompanySidebarConfig) ?? {};

      if (batch.adminOrder !== undefined) {
        updated = { ...updated, adminOrder: batch.adminOrder };
      }
      if (batch.sectionLabels !== undefined) {
        updated = { ...updated, sectionLabels: batch.sectionLabels };
      }
      if (batch.upsertCustomGroups && Object.keys(batch.upsertCustomGroups).length > 0) {
        updated = { ...updated, customGroups: { ...(updated.customGroups ?? {}), ...batch.upsertCustomGroups } };
      }
      if (batch.removeCustomGroups && batch.removeCustomGroups.length > 0) {
        const toRemove = new Set(batch.removeCustomGroups);
        const { customGroups: existing = {} } = updated;
        const cleanedGroups = Object.fromEntries(Object.entries(existing).filter(([id]) => !toRemove.has(id)));
        const cleanedOrder = (updated.adminOrder ?? []).filter(k => !toRemove.has(k));
        updated = { ...updated, customGroups: cleanedGroups, adminOrder: cleanedOrder };
      }

      await prisma.companySettings.upsert({
        where: { companyId },
        update: { sidebarConfig: updated },
        create: { companyId, sidebarConfig: updated },
      });

      return NextResponse.json({ success: true });
    }

    // ─── Caso: actualizar config de módulo ───────────────────────────────────
    const moduleKey: SidebarModuleKey = body.module;
    const newConfig = body.config;

    if (!moduleKey || !ALL_MODULE_KEYS.includes(moduleKey)) {
      return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
    }

    if (!newConfig) {
      return NextResponse.json({ error: 'Se requiere el campo "config"' }, { status: 400 });
    }

    const validation = validateModuleConfig(moduleKey, newConfig);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Hay módulos sin asignar a ningún grupo', orphaned: validation.orphaned },
        { status: 400 }
      );
    }

    const currentSettings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { sidebarConfig: true },
    });

    const currentConfig = (currentSettings?.sidebarConfig as CompanySidebarConfig) ?? {};
    const updatedConfig: CompanySidebarConfig = {
      ...currentConfig,
      [moduleKey]: newConfig,
    };

    await prisma.companySettings.upsert({
      where: { companyId },
      update: { sidebarConfig: updatedConfig },
      create: { companyId, sidebarConfig: updatedConfig },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[sidebar-config PUT]', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}

// DELETE /api/companies/[id]/sidebar-config
// Body (optional): { module: SidebarModuleKey } — si no se especifica, resetea todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
    }

    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userCompanyId = getUserCompanyId(user);
    if (userCompanyId !== companyId && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Sin acceso a esta empresa' }, { status: 403 });
    }

    const { name: roleName, displayName: roleDisplayName } = getUserCompanyRole(user, companyId);
    if (!isAdminRole(user.role, roleName, roleDisplayName)) {
      return NextResponse.json({ error: 'Se requiere rol de administrador' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const moduleKey: SidebarModuleKey | undefined = body?.module;

    const currentSettings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { sidebarConfig: true },
    });

    const currentConfig = (currentSettings?.sidebarConfig as CompanySidebarConfig) ?? {};

    let updatedConfig: CompanySidebarConfig | null;
    if (moduleKey && ALL_MODULE_KEYS.includes(moduleKey)) {
      // Eliminar solo ese módulo
      const { [moduleKey]: _removed, ...rest } = currentConfig;
      updatedConfig = Object.keys(rest).length > 0 ? rest : null;
    } else {
      // Eliminar toda la config
      updatedConfig = null;
    }

    await prisma.companySettings.upsert({
      where: { companyId },
      update: { sidebarConfig: updatedConfig },
      create: { companyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[sidebar-config DELETE]', error);
    return NextResponse.json({ error: 'Error al restablecer configuración' }, { status: 500 });
  }
}
