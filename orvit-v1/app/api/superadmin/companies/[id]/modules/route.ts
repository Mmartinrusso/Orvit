import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

interface RouteParams {
  params: { id: string };
}

/**
 * Verifica que el usuario sea SUPERADMIN
 */
async function verifySuperAdmin(): Promise<{ userId: number } | null> {
  const token = cookies().get('token')?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    const userId = payload.userId as number;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user || user.role !== 'SUPERADMIN') return null;

    return { userId };
  } catch {
    return null;
  }
}

/**
 * GET /api/superadmin/companies/[id]/modules
 * Obtiene los módulos de una empresa específica con su estado
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await verifySuperAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const companyId = parseInt(params.id);
  if (isNaN(companyId)) {
    return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
  }

  try {
    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true }
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    // Obtener todos los módulos con su estado para esta empresa
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' }
      ],
      include: {
        companies: {
          where: { companyId },
          select: {
            id: true,
            isEnabled: true,
            enabledAt: true,
            config: true
          }
        }
      }
    });

    const modulesWithStatus = allModules.map(module => ({
      id: module.id,
      key: module.key,
      name: module.name,
      description: module.description,
      category: module.category,
      icon: module.icon,
      dependencies: module.dependencies,
      // Estado para esta empresa
      isEnabled: module.companies.length > 0 ? module.companies[0].isEnabled : false,
      companyModuleId: module.companies.length > 0 ? module.companies[0].id : null,
      enabledAt: module.companies.length > 0 ? module.companies[0].enabledAt : null,
      config: module.companies.length > 0 ? module.companies[0].config : null
    }));

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name
      },
      modules: modulesWithStatus
    });
  } catch (error) {
    console.error('Error fetching company modules:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/superadmin/companies/[id]/modules
 * Actualiza los módulos habilitados para una empresa
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await verifySuperAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const companyId = parseInt(params.id);
  if (isNaN(companyId)) {
    return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { modules } = body;

    if (!Array.isArray(modules)) {
      return NextResponse.json(
        { error: 'Se requiere un array de módulos' },
        { status: 400 }
      );
    }

    // Verificar que la empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }

    // Procesar cada módulo
    const results = [];
    for (const moduleUpdate of modules) {
      const { moduleId, isEnabled, config } = moduleUpdate;

      if (!moduleId) continue;

      // Buscar si ya existe el CompanyModule
      const existing = await prisma.companyModule.findUnique({
        where: {
          companyId_moduleId: {
            companyId,
            moduleId
          }
        }
      });

      if (existing) {
        // Actualizar
        const updated = await prisma.companyModule.update({
          where: { id: existing.id },
          data: {
            isEnabled: isEnabled ?? existing.isEnabled,
            config: config !== undefined ? config : existing.config,
            enabledAt: isEnabled && !existing.isEnabled ? new Date() : existing.enabledAt,
            enabledBy: isEnabled && !existing.isEnabled ? auth.userId : existing.enabledBy
          }
        });
        results.push({ action: 'updated', ...updated });
      } else if (isEnabled) {
        // Crear solo si se está habilitando
        const created = await prisma.companyModule.create({
          data: {
            companyId,
            moduleId,
            isEnabled: true,
            config: config || null,
            enabledBy: auth.userId
          }
        });
        results.push({ action: 'created', ...created });
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      results
    });
  } catch (error) {
    console.error('Error updating company modules:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/companies/[id]/modules
 * Habilitar/deshabilitar un módulo específico para una empresa
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await verifySuperAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const companyId = parseInt(params.id);
  if (isNaN(companyId)) {
    return NextResponse.json({ error: 'ID de empresa inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { moduleId, moduleKey, isEnabled, config } = body;

    // Permitir identificar el módulo por ID o key
    let targetModuleId = moduleId;
    if (!targetModuleId && moduleKey) {
      const module = await prisma.module.findUnique({
        where: { key: moduleKey },
        select: { id: true }
      });
      if (module) targetModuleId = module.id;
    }

    if (!targetModuleId) {
      return NextResponse.json(
        { error: 'Se requiere moduleId o moduleKey' },
        { status: 400 }
      );
    }

    // Verificar que el módulo existe
    const module = await prisma.module.findUnique({
      where: { id: targetModuleId },
      select: { id: true, key: true, name: true, dependencies: true }
    });

    if (!module) {
      return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 });
    }

    // Si se está habilitando, verificar dependencias
    if (isEnabled && module.dependencies.length > 0) {
      const enabledDeps = await prisma.companyModule.findMany({
        where: {
          companyId,
          isEnabled: true,
          module: {
            key: { in: module.dependencies }
          }
        },
        include: { module: { select: { key: true } } }
      });

      const enabledDepKeys = enabledDeps.map(d => d.module.key);
      const missingDeps = module.dependencies.filter(d => !enabledDepKeys.includes(d));

      if (missingDeps.length > 0) {
        return NextResponse.json({
          error: `El módulo "${module.name}" requiere que primero se habiliten: ${missingDeps.join(', ')}`,
          missingDependencies: missingDeps
        }, { status: 400 });
      }
    }

    // Upsert del CompanyModule
    const companyModule = await prisma.companyModule.upsert({
      where: {
        companyId_moduleId: {
          companyId,
          moduleId: targetModuleId
        }
      },
      create: {
        companyId,
        moduleId: targetModuleId,
        isEnabled: isEnabled ?? true,
        config: config || null,
        enabledBy: auth.userId
      },
      update: {
        isEnabled: isEnabled ?? true,
        config: config !== undefined ? config : undefined,
        enabledAt: isEnabled ? new Date() : undefined,
        enabledBy: isEnabled ? auth.userId : undefined
      },
      include: {
        module: {
          select: {
            key: true,
            name: true,
            category: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      companyModule: {
        id: companyModule.id,
        moduleKey: companyModule.module.key,
        moduleName: companyModule.module.name,
        category: companyModule.module.category,
        isEnabled: companyModule.isEnabled,
        config: companyModule.config
      }
    });
  } catch (error) {
    console.error('Error toggling company module:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
