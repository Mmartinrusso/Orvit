import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken(request: NextRequest) {
  try {
    const token = cookies().get('token')?.value;

    if (!token) {
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
        }
      }
    });

    if (!user || !user.companies || user.companies.length === 0) {
      return null;
    }

    return {
      userId: user.id,
      companyId: user.companies[0].companyId,
    };
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET - Obtener preferencias de colores del usuario
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = request.nextUrl.searchParams.get('companyId') || auth.companyId.toString();

    const preferences = await (prisma as any).userColorPreferences.findUnique({
      where: {
        userId_companyId: {
          userId: auth.userId,
          companyId: parseInt(companyId),
        },
      },
    });

    if (!preferences) {
      // Retornar colores por defecto si no existen preferencias
      return NextResponse.json({
        exists: false,
        colors: {
          themeName: 'Predeterminado',
          chart1: '#3b82f6',
          chart2: '#10b981',
          chart3: '#f59e0b',
          chart4: '#8b5cf6',
          chart5: '#06b6d4',
          chart6: '#ef4444',
          progressPrimary: '#3b82f6',
          progressSecondary: '#10b981',
          progressWarning: '#f59e0b',
          progressDanger: '#ef4444',
          kpiPositive: '#10b981',
          kpiNegative: '#ef4444',
          kpiNeutral: '#64748b',
          cardHighlight: '#ede9fe',
          cardMuted: '#f1f5f9',
          donut1: '#3b82f6',
          donut2: '#10b981',
          donut3: '#f59e0b',
          donut4: '#8b5cf6',
          donut5: '#94a3b8',
        },
      });
    }

    return NextResponse.json({
      exists: true,
      colors: {
        themeName: preferences.themeName,
        chart1: preferences.chart1,
        chart2: preferences.chart2,
        chart3: preferences.chart3,
        chart4: preferences.chart4,
        chart5: preferences.chart5,
        chart6: preferences.chart6,
        progressPrimary: preferences.progressPrimary,
        progressSecondary: preferences.progressSecondary,
        progressWarning: preferences.progressWarning,
        progressDanger: preferences.progressDanger,
        kpiPositive: preferences.kpiPositive,
        kpiNegative: preferences.kpiNegative,
        kpiNeutral: preferences.kpiNeutral,
        cardHighlight: preferences.cardHighlight,
        cardMuted: preferences.cardMuted,
        donut1: preferences.donut1,
        donut2: preferences.donut2,
        donut3: preferences.donut3,
        donut4: preferences.donut4,
        donut5: preferences.donut5,
      },
    });
  } catch (error) {
    console.error('Error fetching color preferences:', error);
    return NextResponse.json(
      { error: 'Error al obtener preferencias' },
      { status: 500 }
    );
  }
}

// POST - Guardar preferencias de colores del usuario
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if (!auth || !auth.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, colors } = body;

    const targetCompanyId = companyId ? parseInt(companyId) : auth.companyId;

    if (!colors) {
      return NextResponse.json(
        { error: 'colors es requerido' },
        { status: 400 }
      );
    }

    const preferences = await (prisma as any).userColorPreferences.upsert({
      where: {
        userId_companyId: {
          userId: auth.userId,
          companyId: targetCompanyId,
        },
      },
      create: {
        userId: auth.userId,
        companyId: targetCompanyId,
        themeName: colors.themeName || 'Personalizado',
        chart1: colors.chart1,
        chart2: colors.chart2,
        chart3: colors.chart3,
        chart4: colors.chart4,
        chart5: colors.chart5,
        chart6: colors.chart6,
        progressPrimary: colors.progressPrimary,
        progressSecondary: colors.progressSecondary,
        progressWarning: colors.progressWarning,
        progressDanger: colors.progressDanger,
        kpiPositive: colors.kpiPositive,
        kpiNegative: colors.kpiNegative,
        kpiNeutral: colors.kpiNeutral,
        cardHighlight: colors.cardHighlight,
        cardMuted: colors.cardMuted,
        donut1: colors.donut1,
        donut2: colors.donut2,
        donut3: colors.donut3,
        donut4: colors.donut4,
        donut5: colors.donut5,
      },
      update: {
        themeName: colors.themeName || 'Personalizado',
        chart1: colors.chart1,
        chart2: colors.chart2,
        chart3: colors.chart3,
        chart4: colors.chart4,
        chart5: colors.chart5,
        chart6: colors.chart6,
        progressPrimary: colors.progressPrimary,
        progressSecondary: colors.progressSecondary,
        progressWarning: colors.progressWarning,
        progressDanger: colors.progressDanger,
        kpiPositive: colors.kpiPositive,
        kpiNegative: colors.kpiNegative,
        kpiNeutral: colors.kpiNeutral,
        cardHighlight: colors.cardHighlight,
        cardMuted: colors.cardMuted,
        donut1: colors.donut1,
        donut2: colors.donut2,
        donut3: colors.donut3,
        donut4: colors.donut4,
        donut5: colors.donut5,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Preferencias de colores guardadas',
      preferences,
    });
  } catch (error) {
    console.error('Error saving color preferences:', error);
    return NextResponse.json(
      { error: 'Error al guardar preferencias' },
      { status: 500 }
    );
  }
}
