import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Configuración por defecto para el módulo de compras
const DEFAULT_PURCHASE_CONFIG = {
  claveEdicionItems: 'admin123', // Clave por defecto para editar items
  permitirEdicionItems: true,    // Habilitar/deshabilitar edición de items
  requiereMotivoEdicion: true,   // Requiere motivo al editar
};

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select: {
        id: true,
        name: true,
        role: true,
        companies: {
          select: { companyId: true },
          take: 1
        }
      }
    });

    return user;
  } catch {
    return null;
  }
}

// GET - Obtener configuración de compras
export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    // Buscar módulo de compras para esta empresa
    const companyModule = await prisma.companyModule.findFirst({
      where: {
        companyId,
        module: {
          key: 'compras'
        }
      },
      include: {
        module: {
          select: { key: true }
        }
      }
    });

    // Si no existe el módulo o no tiene config, devolver valores por defecto
    const config = companyModule?.config as Record<string, any> | null;

    return NextResponse.json({
      config: {
        ...DEFAULT_PURCHASE_CONFIG,
        ...(config || {})
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo config de compras:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar configuración de compras
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Solo ADMIN puede modificar configuración
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No tiene permisos para modificar configuración' }, { status: 403 });
    }

    const companyId = user.companies?.[0]?.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }

    const body = await request.json();
    const { claveEdicionItems, permitirEdicionItems, requiereMotivoEdicion } = body;

    // Buscar el módulo de compras
    const module = await prisma.module.findFirst({
      where: { key: 'compras' }
    });

    if (!module) {
      return NextResponse.json({ error: 'Módulo de compras no encontrado' }, { status: 404 });
    }

    // Buscar o crear CompanyModule
    let companyModule = await prisma.companyModule.findFirst({
      where: {
        companyId,
        moduleId: module.id
      }
    });

    const currentConfig = (companyModule?.config as Record<string, any>) || {};

    const newConfig = {
      ...currentConfig,
      ...(claveEdicionItems !== undefined && { claveEdicionItems }),
      ...(permitirEdicionItems !== undefined && { permitirEdicionItems }),
      ...(requiereMotivoEdicion !== undefined && { requiereMotivoEdicion }),
    };

    if (companyModule) {
      // Actualizar config existente
      await prisma.companyModule.update({
        where: { id: companyModule.id },
        data: { config: newConfig }
      });
    } else {
      // Crear nuevo CompanyModule con la config
      await prisma.companyModule.create({
        data: {
          companyId,
          moduleId: module.id,
          isEnabled: true,
          enabledBy: user.id,
          config: newConfig
        }
      });
    }

    return NextResponse.json({
      success: true,
      config: {
        ...DEFAULT_PURCHASE_CONFIG,
        ...newConfig
      }
    });
  } catch (error: any) {
    console.error('Error actualizando config de compras:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
