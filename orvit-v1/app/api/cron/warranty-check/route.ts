/**
 * API: /api/cron/warranty-check
 *
 * POST - Verificar contratos de servicio/garantias por vencer
 *        - Crea alertas para contratos dentro de su ventana de aviso (diasAviso)
 *        - Actualiza automáticamente a VENCIDO los contratos que pasaron su fechaFin
 *
 * GET  - Health check con estadísticas de contratos
 *
 * Este endpoint debe ser llamado por un cron job (ej: una vez al día)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    contractsChecked: 0,
    alertsCreated: 0,
    contractsExpired: 0,
    errors: [] as string[],
  };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Buscar contratos activos con fecha de fin definida
    const contracts = await prisma.serviceContract.findMany({
      where: {
        estado: 'ACTIVO',
        fechaFin: { not: null },
      },
      include: {
        machine: { select: { id: true, name: true, sectorId: true } },
        proveedor: { select: { id: true, razonSocial: true } },
      },
    });

    results.contractsChecked = contracts.length;

    // 2. Para cada contrato, verificar si está dentro de la ventana de aviso
    for (const contract of contracts) {
      try {
        const fechaFin = contract.fechaFin!;
        const daysUntilExpiry = Math.ceil(
          (fechaFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry <= contract.diasAviso && daysUntilExpiry >= 0) {
          // 3. Verificar que no exista ya una alerta para hoy
          const existingAlert = await prisma.serviceContractAlert.findFirst({
            where: {
              contractId: contract.id,
              tipo: 'VENCIMIENTO',
              fechaAlerta: today,
            },
          });

          if (!existingAlert) {
            // 4. Crear alerta de vencimiento
            await prisma.serviceContractAlert.create({
              data: {
                contractId: contract.id,
                tipo: 'VENCIMIENTO',
                mensaje: `El contrato "${contract.nombre}" (${contract.numero}) vence en ${daysUntilExpiry} día${daysUntilExpiry !== 1 ? 's' : ''} (${fechaFin.toLocaleDateString('es-AR')})`,
                fechaAlerta: today,
                companyId: contract.companyId,
              },
            });
            results.alertsCreated++;
          }
        }
      } catch (contractError: any) {
        console.error(`Error procesando contrato ${contract.id}:`, contractError);
        results.errors.push(`Contrato ${contract.id}: ${contractError.message}`);
      }
    }

    // 5. Actualizar contratos vencidos a estado VENCIDO
    const expiredResult = await prisma.serviceContract.updateMany({
      where: {
        estado: 'ACTIVO',
        fechaFin: { lt: today },
      },
      data: { estado: 'VENCIDO' },
    });
    results.contractsExpired = expiredResult.count;

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Warranty check ejecutado correctamente',
      duration: `${duration}ms`,
      results,
    });
  } catch (error: any) {
    console.error('Error en warranty-check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error en warranty check',
        results,
      },
      { status: 500 }
    );
  }
}

// GET para verificar estado (health check)
export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [activeContracts, expiringSoon, recentAlerts] = await Promise.all([
      prisma.serviceContract.count({
        where: { estado: 'ACTIVO' },
      }),
      prisma.serviceContract.count({
        where: {
          estado: 'ACTIVO',
          fechaFin: { gte: today, lte: in30Days },
        },
      }),
      prisma.serviceContractAlert.count({
        where: {
          fechaAlerta: { gte: today },
        },
      }),
    ]);

    return NextResponse.json({
      status: 'healthy',
      data: {
        activeContracts,
        expiringSoon,
        recentAlerts,
      },
    });
  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Error al verificar estado de contratos' },
      { status: 500 }
    );
  }
}
