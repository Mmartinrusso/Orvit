/**
 * API: /api/discord/users/test-dm
 *
 * POST - Enviar un mensaje de prueba por DM al usuario actual
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isBotReady, sendDM, connectBot } from '@/lib/discord';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // 2. Obtener el usuario con su discordUserId
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        discordUserId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!user.discordUserId) {
      return NextResponse.json(
        { error: 'No tienes una cuenta de Discord vinculada' },
        { status: 400 }
      );
    }

    // 3. Verificar que el bot esté conectado, si no, intentar conectar
    // Usar companyId del payload de auth (no del usuario porque es relación many-to-many)
    const companyId = payload.companyId;

    if (!isBotReady()) {
      // Intentar auto-conectar el bot usando el token de la empresa
      if (companyId) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: { discordBotToken: true },
        });

        if (company?.discordBotToken) {
          console.log('🔄 Intentando auto-conectar el bot de Discord...');
          const connectResult = await connectBot(company.discordBotToken);

          if (!connectResult.success) {
            return NextResponse.json(
              { error: `El bot de Discord no está conectado: ${connectResult.error}` },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { error: 'El bot de Discord no está configurado. Contacta al administrador.' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'El bot de Discord no está conectado' },
          { status: 400 }
        );
      }
    }

    // 4. Enviar mensaje de prueba
    const result = await sendDM(user.discordUserId, {
      content: `Hola ${user.name}! Este es un mensaje de prueba desde ORVIT.`,
      embed: {
        title: '✅ Verificación Exitosa',
        description: 'Tu cuenta de Discord está correctamente vinculada con ORVIT.\n\nRecibirás notificaciones aquí cuando:',
        color: 0x57F287, // Verde
        fields: [
          { name: '📋 Asignación de OT', value: 'Cuando te asignen una orden de trabajo', inline: false },
          { name: '⚠️ Alertas de SLA', value: 'Cuando una OT esté por vencer su plazo', inline: false },
          { name: '🔴 Fallas Críticas', value: 'Cuando se reporte una falla en tus máquinas asignadas', inline: false },
        ],
        footer: 'ORVIT - Sistema de Mantenimiento',
        timestamp: true,
      },
    });

    if (!result.success) {
      // Mensaje más descriptivo según el error
      let errorMsg = result.error || 'No se pudo enviar el mensaje';
      if (result.error?.includes('DMs desactivados')) {
        errorMsg = 'Tienes los mensajes directos desactivados en Discord. Habilítalos y vuelve a intentar.';
      }
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mensaje de prueba enviado. Revisa tus DMs en Discord.',
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/discord/users/test-dm:', error);
    return NextResponse.json(
      { error: error.message || 'Error al enviar mensaje de prueba' },
      { status: 500 }
    );
  }
}
