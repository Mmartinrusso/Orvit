import { NextRequest, NextResponse } from 'next/server';
import { prismaUnfiltered } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';
import { purgeDeletedRecords } from '@/lib/cron/purge-deleted-records';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// POST /api/admin/soft-delete/purge - Ejecutar purga manual de registros eliminados (>90 días)
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación: admin o cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    const isAuthorizedCron = cronSecret && cronSecret === process.env.CRON_SECRET;

    if (!isAuthorizedCron) {
      // Verificar auth de admin
      const token = cookies().get('token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }

      const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
      const user = await prismaUnfiltered.user.findUnique({
        where: { id: payload.userId as number },
        select: { role: true },
      });

      if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
    }

    const result = await purgeDeletedRecords();

    return NextResponse.json({
      success: true,
      message: 'Purga completada',
      ...result,
    });
  } catch (error) {
    console.error('Error en purga de registros:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
