/**
 * API: /api/corrective-settings
 *
 * GET - Obtener configuración de mantenimiento correctivo de la empresa actual
 * PATCH - Actualizar configuración (solo admin/supervisor)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para PATCH
 */
const updateSettingsSchema = z.object({
  // Ventanas configurables
  duplicateWindowHours: z.number().int().min(1).max(168).optional(), // Max 7 días
  recurrenceWindowDays: z.number().int().min(1).max(90).optional(),  // Max 90 días
  downtimeQaThresholdMin: z.number().int().min(0).max(480).optional(), // Max 8 horas

  // SLA por prioridad (en horas)
  slaP1Hours: z.number().int().min(1).max(24).optional(),   // P1: Max 24h
  slaP2Hours: z.number().int().min(1).max(48).optional(),   // P2: Max 48h
  slaP3Hours: z.number().int().min(1).max(168).optional(),  // P3: Max 7 días
  slaP4Hours: z.number().int().min(1).max(720).optional(),  // P4: Max 30 días

  // Reglas de evidencia
  requireEvidenceP3: z.boolean().optional(),
  requireEvidenceP2: z.boolean().optional(),
  requireEvidenceP1: z.boolean().optional(),

  // Retorno a producción
  requireReturnConfirmationOnDowntime: z.boolean().optional(),
  requireReturnConfirmationOnQA: z.boolean().optional(),
}).strict(); // No permitir campos extra

/**
 * GET /api/corrective-settings
 * Obtiene la configuración de mantenimiento correctivo de la empresa actual
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json(
        { error: 'Token inválido o sin companyId' },
        { status: 401 }
      );
    }

    const companyId = payload.companyId as number;

    // 2. Obtener CorrectiveSettings (debe existir por seed)
    let settings = await prisma.correctiveSettings.findUnique({
      where: { companyId }
    });

    // Si no existe (edge case), crear con defaults
    if (!settings) {
      console.warn(`⚠️  CorrectiveSettings no encontrado para companyId=${companyId}. Creando...`);
      settings = await prisma.correctiveSettings.create({
        data: {
          companyId,
          duplicateWindowHours: 48,
          recurrenceWindowDays: 7,
          downtimeQaThresholdMin: 60,
          slaP1Hours: 4,
          slaP2Hours: 8,
          slaP3Hours: 24,
          slaP4Hours: 72,
          requireEvidenceP3: true,
          requireEvidenceP2: true,
          requireEvidenceP1: true,
          requireReturnConfirmationOnDowntime: true,
          requireReturnConfirmationOnQA: true,
        }
      });
    }

    return NextResponse.json(settings, { status: 200 });

  } catch (error) {
    console.error('❌ Error en GET /api/corrective-settings:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/corrective-settings
 * Actualiza la configuración de mantenimiento correctivo (solo admin/supervisor)
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json(
        { error: 'Token inválido o sin companyId' },
        { status: 401 }
      );
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;

    // 2. Verificar permisos (admin o supervisor)
    // TODO: Implementar verificación de permisos granular
    // Por ahora, verificamos que sea admin o tenga rol de supervisor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: {
          where: { companyId },
          include: { role: true }
        }
      }
    });

    const userRole = user?.companies[0]?.role?.name?.toLowerCase();
    const isAdmin = user?.isSuperAdmin || userRole === 'admin' || userRole === 'administrador';
    const isSupervisor = userRole === 'supervisor' || userRole === 'jefe de mantenimiento';

    if (!isAdmin && !isSupervisor) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar la configuración' },
        { status: 403 }
      );
    }

    // 3. Parsear y validar body
    const body = await request.json();
    const validationResult = updateSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      ).join(', ');

      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Si no hay campos para actualizar
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      );
    }

    // 4. Actualizar CorrectiveSettings
    const settings = await prisma.correctiveSettings.upsert({
      where: { companyId },
      create: {
        companyId,
        duplicateWindowHours: 48,
        recurrenceWindowDays: 7,
        downtimeQaThresholdMin: 60,
        slaP1Hours: 4,
        slaP2Hours: 8,
        slaP3Hours: 24,
        slaP4Hours: 72,
        requireEvidenceP3: true,
        requireEvidenceP2: true,
        requireEvidenceP1: true,
        requireReturnConfirmationOnDowntime: true,
        requireReturnConfirmationOnQA: true,
        ...updates
      },
      update: updates
    });

    return NextResponse.json(settings, { status: 200 });

  } catch (error) {
    console.error('❌ Error en PATCH /api/corrective-settings:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
