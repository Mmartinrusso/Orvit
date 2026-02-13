import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { canCreateCompany, calculateEnabledModules } from '@/lib/billing/limits';
import { logBillingAction } from '@/lib/billing/audit';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// GET - Listar todas las empresas con información de admin y suscripción
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companies = await prisma.$queryRaw`
      SELECT
        c.id,
        c.name,
        c.cuit,
        c.email,
        c.phone,
        c.address,
        c."templateId",
        ct.name as "templateName",
        c."createdAt",
        c."isActive",
        -- Admin principal
        c."primaryAdminId",
        pa.name as "adminName",
        pa.email as "adminEmail",
        pa.phone as "adminPhone",
        -- Suscripción (del owner)
        c."subscriptionId",
        s.status as "subscriptionStatus",
        sp.id as "planId",
        sp."displayName" as "planName",
        sp."maxCompanies",
        -- Conteos
        (SELECT COUNT(*) FROM "UserOnCompany" uoc WHERE uoc."companyId" = c.id) as "usersCount",
        (SELECT COUNT(*) FROM "company_modules" cm WHERE cm."companyId" = c.id AND cm."isEnabled" = true) as "modulesCount",
        -- Empresas en la misma suscripción
        (SELECT COUNT(*) FROM "Company" c2 WHERE c2."subscriptionId" = s.id) as "companiesInPlan"
      FROM "Company" c
      LEFT JOIN "company_templates" ct ON c."templateId" = ct.id
      LEFT JOIN "User" pa ON c."primaryAdminId" = pa.id
      LEFT JOIN subscriptions s ON c."subscriptionId" = s.id
      LEFT JOIN subscription_plans sp ON s."planId" = sp.id
      ORDER BY c."createdAt" DESC
    ` as any[];

    // Formatear respuesta
    const formattedCompanies = companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      cuit: c.cuit,
      email: c.email,
      phone: c.phone,
      address: c.address,
      templateId: c.templateId,
      templateName: c.templateName,
      createdAt: c.createdAt,
      isActive: c.isActive,
      usersCount: Number(c.usersCount),
      modulesCount: Number(c.modulesCount),
      // Admin principal
      primaryAdmin: c.primaryAdminId ? {
        id: c.primaryAdminId,
        name: c.adminName,
        email: c.adminEmail,
        phone: c.adminPhone,
      } : null,
      // Suscripción
      subscription: c.subscriptionId ? {
        id: c.subscriptionId,
        status: c.subscriptionStatus,
        planId: c.planId,
        planName: c.planName,
        maxCompanies: c.maxCompanies,
        companiesInPlan: Number(c.companiesInPlan),
      } : null,
      // Flag si está bloqueada por plan
      blockedByPlan: c.subscriptionStatus === 'PAST_DUE' ||
        c.subscriptionStatus === 'CANCELED' ||
        c.subscriptionStatus === 'PAUSED',
    }));

    return NextResponse.json({ companies: formattedCompanies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ error: 'Error al obtener empresas' }, { status: 500 });
  }
}

// POST - Crear nueva empresa con validación de límites y admin
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      cuit,
      email,
      phone,
      address,
      templateId,
      // Owner (usuario con suscripción)
      ownerId,
      // Admin principal (opcional, se crea si se proporciona)
      adminName,
      adminEmail,
      adminPassword,
      adminPhone,
    } = body;

    // Validaciones básicas
    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (!templateId) {
      return NextResponse.json({ error: 'El template es requerido' }, { status: 400 });
    }

    // Verificar que el owner tenga una suscripción activa y pueda crear empresas
    if (ownerId) {
      const canCreate = await canCreateCompany(ownerId);
      if (!canCreate.allowed) {
        return NextResponse.json(
          {
            error: canCreate.reason,
            current: canCreate.current,
            max: canCreate.max,
          },
          { status: 400 }
        );
      }
    }

    // Obtener la suscripción del owner
    let subscriptionId: string | null = null;
    let planModuleKeys: string[] = [];

    if (ownerId) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: ownerId },
        include: { plan: true },
      });

      if (subscription) {
        subscriptionId = subscription.id;
        planModuleKeys = subscription.plan.moduleKeys;
      }
    }

    // Obtener el template
    const templates = await prisma.$queryRaw`
      SELECT "moduleKeys" FROM "company_templates" WHERE "id" = ${templateId}
    ` as any[];

    if (templates.length === 0) {
      return NextResponse.json({ error: 'Template no encontrado' }, { status: 404 });
    }

    const templateModuleKeys: string[] = templates[0].moduleKeys || [];

    // Calcular módulos a habilitar (intersección plan ∩ template)
    let enabledModuleKeys: string[];
    if (planModuleKeys.length === 0) {
      // Plan Enterprise (array vacío = todos permitidos)
      enabledModuleKeys = templateModuleKeys;
    } else {
      // Intersección
      enabledModuleKeys = templateModuleKeys.filter(key => planModuleKeys.includes(key));
    }

    // Crear admin principal si se proporcionan datos
    let primaryAdminId: number | null = null;

    if (adminEmail && adminName) {
      // Verificar si ya existe el email
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (existingUser) {
        // Usar el usuario existente como admin
        primaryAdminId = existingUser.id;
      } else {
        // Crear nuevo usuario
        const hashedPassword = adminPassword
          ? await bcrypt.hash(adminPassword, 10)
          : await bcrypt.hash(Math.random().toString(36).slice(-12), 10);

        const newUser = await prisma.user.create({
          data: {
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            phone: adminPhone || null,
            role: 'USER',
            isActive: true,
          },
        });

        primaryAdminId = newUser.id;
      }
    }

    // Crear empresa
    const company = await prisma.company.create({
      data: {
        name,
        cuit: cuit || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        templateId,
        subscriptionId,
        primaryAdminId,
      },
    });

    // Habilitar módulos del template (filtrados por plan)
    if (enabledModuleKeys.length > 0) {
      // Obtener IDs de módulos
      const modules = await prisma.$queryRaw`
        SELECT id, key FROM "modules" WHERE "key" = ANY(${enabledModuleKeys}::TEXT[])
      ` as any[];

      // Crear company_modules entries
      for (const module of modules) {
        await prisma.$executeRaw`
          INSERT INTO "company_modules" ("id", "companyId", "moduleId", "isEnabled", "enabledAt", "enabledBy")
          VALUES (gen_random_uuid()::text, ${company.id}, ${module.id}, true, NOW(), ${auth.userId})
          ON CONFLICT ("companyId", "moduleId") DO NOTHING
        `;
      }

      // Incrementar contador de uso del template
      await prisma.$executeRaw`
        UPDATE "company_templates"
        SET "usageCount" = "usageCount" + 1
        WHERE "id" = ${templateId}
      `;
    }

    // Si hay admin principal, asociarlo a la empresa
    if (primaryAdminId) {
      await prisma.userOnCompany.create({
        data: {
          userId: primaryAdminId,
          companyId: company.id,
          isActive: true,
        },
      });
    }

    // Audit log si hay suscripción
    if (subscriptionId) {
      await logBillingAction(
        auth.userId,
        'COMPANY_ASSIGNED_TO_SUBSCRIPTION',
        'company',
        company.id.toString(),
        null,
        {
          companyId: company.id,
          companyName: name,
          subscriptionId,
          ownerId,
        }
      );
    }

    return NextResponse.json({
      success: true,
      company: {
        ...company,
        enabledModules: enabledModuleKeys,
      },
    });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json({ error: 'Error al crear empresa' }, { status: 500 });
  }
}
