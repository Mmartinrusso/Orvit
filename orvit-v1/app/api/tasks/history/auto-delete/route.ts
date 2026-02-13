import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper function para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      console.log('❌ No hay token JWT');
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// Helper para obtener companyId del usuario
function getUserCompanyId(user: any): number | null {
  if (user.ownedCompanies && user.ownedCompanies.length > 0) {
    return user.ownedCompanies[0].id;
  } else if (user.companies && user.companies.length > 0) {
    return user.companies[0].companyId;
  }
  return null;
}

// POST /api/tasks/history/auto-delete - Configurar auto-eliminación
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const body = await request.json();
    const { days } = body;

    if (!days || days < 1) {
      return NextResponse.json({ error: "Días debe ser un número positivo" }, { status: 400 });
    }

    // Guardar configuración en la base de datos (usando tabla Document como configuración)
    const existingConfig = await prisma.document.findFirst({
      where: {
        name: 'HISTORY_AUTO_DELETE_CONFIG',
        companyId: companyId
      }
    });

    if (existingConfig) {
      await prisma.document.update({
        where: { id: existingConfig.id },
        data: {
          url: JSON.stringify({ days, updatedAt: new Date().toISOString() }),
          uploadDate: new Date()
        }
      });
    } else {
      await prisma.document.create({
        data: {
          name: 'HISTORY_AUTO_DELETE_CONFIG',
          fileName: 'CONFIG',
          url: JSON.stringify({ days, createdAt: new Date().toISOString() }),
          companyId: companyId,
          uploadedById: user.id
        }
      });
    }

    console.log('✅ Auto-eliminación configurada:', days, 'días para empresa', companyId);

    return NextResponse.json({
      success: true,
      message: `Auto-eliminación configurada para ${days} días`
    });

  } catch (error) {
    console.error('Error configurando auto-eliminación:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// GET /api/tasks/history/auto-delete - Obtener configuración actual
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    const config = await prisma.document.findFirst({
      where: {
        name: 'HISTORY_AUTO_DELETE_CONFIG',
        companyId: companyId
      }
    });

    if (!config) {
      return NextResponse.json({
        success: true,
        config: { days: 30, enabled: false }
      });
    }

    const configData = JSON.parse(config.url);
    
    return NextResponse.json({
      success: true,
      config: { days: configData.days, enabled: true }
    });

  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 