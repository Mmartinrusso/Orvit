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

// DELETE /api/tasks/history/clear-all - Limpiar todo el historial
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const companyId = getUserCompanyId(user);
    if (!companyId) {
      return NextResponse.json({ error: "Usuario sin empresa" }, { status: 401 });
    }

    // Eliminar todas las tareas del historial de la empresa
    const deletedCount = await prisma.document.deleteMany({
      where: {
        fileName: 'TASK_HISTORY',
        companyId: companyId
      }
    });

    console.log('✅ Historial limpiado completamente:', deletedCount.count, 'tareas eliminadas para empresa', companyId);

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount.count,
      message: `Se eliminaron ${deletedCount.count} tareas del historial`
    });

  } catch (error) {
    console.error('Error limpiando historial:', error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 