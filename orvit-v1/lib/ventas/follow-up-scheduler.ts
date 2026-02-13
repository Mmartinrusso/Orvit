import { prisma } from '@/lib/prisma';

/**
 * Automatic Follow-up Scheduler
 *
 * Schedules automatic follow-ups when a quote is sent
 */

export interface FollowUpSchedule {
  diasDespues: number;
  canal: 'EMAIL' | 'WHATSAPP' | 'LLAMADA' | 'INTERNO';
  asunto: string;
  mensaje: string;
}

// Default follow-up schedule (can be customized per company)
const DEFAULT_SCHEDULE: FollowUpSchedule[] = [
  {
    diasDespues: 3,
    canal: 'EMAIL',
    asunto: 'Seguimiento de cotización #{quoteNumber}',
    mensaje: `Hola {clientName},

¿Recibió nuestra cotización #{quoteNumber}?

Estamos a su disposición para responder cualquier consulta o duda que pueda tener sobre nuestra propuesta.

¿Necesita que le aclaremos algún punto específico?

Saludos cordiales,
{companyName}`
  },
  {
    diasDespues: 7,
    canal: 'EMAIL',
    asunto: 'Recordatorio: Cotización #{quoteNumber} - Vence en {diasRestantes} días',
    mensaje: `Estimado/a {clientName},

Le recordamos que la cotización #{quoteNumber} vence en {diasRestantes} días.

Total cotizado: {total}

Si está interesado/a, le sugerimos confirmar pronto para asegurar estos precios y disponibilidad.

¿Podemos ayudarlo/a en algo para facilitar su decisión?

Saludos,
{companyName}`
  },
  {
    diasDespues: 14,
    canal: 'INTERNO',
    asunto: 'Acción requerida: Cotización #{quoteNumber} sin respuesta',
    mensaje: `La cotización #{quoteNumber} para {clientName} fue enviada hace 14 días sin respuesta.

Acciones sugeridas:
- Llamar al cliente para consultar estado
- Verificar si hay interés en ajustar la propuesta
- Considerar cerrar o renovar la cotización

Total: {total}`
  },
  {
    diasDespues: 27, // 3 días antes de vencer (asumiendo 30 días de validez)
    canal: 'EMAIL',
    asunto: '⚠️ Su cotización #{quoteNumber} vence pronto',
    mensaje: `Hola {clientName},

Su cotización #{quoteNumber} vence en 3 días.

Si está interesado/a pero necesita más tiempo, podemos renovarla sin problema.

¿Desea que procedamos con la renovación o tiene alguna consulta?

Quedamos atentos,
{companyName}`
  },
];

export async function scheduleAutoFollowUps(
  quoteId: number,
  companyId: number,
  userId: number,
  options?: {
    customSchedule?: FollowUpSchedule[];
    skipExisting?: boolean;
  }
): Promise<{ created: number; skipped: number }> {
  try {
    // Get quote details
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: {
          select: { id: true, legalName: true, name: true, email: true }
        },
        company: {
          select: { name: true }
        }
      }
    });

    if (!quote) {
      throw new Error('Quote not found');
    }

    // Check if auto follow-ups already exist
    if (options?.skipExisting) {
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id FROM quote_follow_ups
        WHERE "quoteId" = ${quoteId} AND tipo = 'AUTO'
      `;

      if (existing.length > 0) {
        console.log(`[FollowUp] Skipping ${quoteId}: ${existing.length} auto follow-ups already exist`);
        return { created: 0, skipped: existing.length };
      }
    }

    const schedule = options?.customSchedule || DEFAULT_SCHEDULE;
    const fechaEnvio = quote.fechaEmision || new Date();
    const fechaValidez = quote.fechaValidez;

    let created = 0;

    for (const followUpConfig of schedule) {
      // Calculate scheduled date
      const programadoPara = new Date(fechaEnvio);
      programadoPara.setDate(programadoPara.getDate() + followUpConfig.diasDespues);

      // Skip if scheduled date is after validity date
      if (fechaValidez && programadoPara > fechaValidez) {
        console.log(`[FollowUp] Skipping follow-up at day ${followUpConfig.diasDespues}: after validity date`);
        continue;
      }

      // Calculate days until expiration for template
      let diasRestantes = 0;
      if (fechaValidez) {
        diasRestantes = Math.ceil((fechaValidez.getTime() - programadoPara.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Replace template variables
      const clientName = quote.client.legalName || quote.client.name;
      const total = `${quote.moneda} ${Number(quote.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

      const asunto = followUpConfig.asunto
        .replace('{quoteNumber}', quote.numero)
        .replace('{clientName}', clientName)
        .replace('{diasRestantes}', diasRestantes.toString())
        .replace('{total}', total)
        .replace('{companyName}', quote.company.name);

      const mensaje = followUpConfig.mensaje
        .replace(/{quoteNumber}/g, quote.numero)
        .replace(/{clientName}/g, clientName)
        .replace(/{diasRestantes}/g, diasRestantes.toString())
        .replace(/{total}/g, total)
        .replace(/{companyName}/g, quote.company.name);

      // Create follow-up
      await prisma.$executeRaw`
        INSERT INTO quote_follow_ups (
          "quoteId", "companyId", tipo, canal, asunto, mensaje,
          "programadoPara", "createdBy"
        ) VALUES (
          ${quoteId}, ${companyId}, 'AUTO', ${followUpConfig.canal},
          ${asunto}, ${mensaje}, ${programadoPara}, ${userId}
        )
      `;

      created++;
    }

    console.log(`[FollowUp] Created ${created} auto follow-ups for quote ${quote.numero}`);

    return { created, skipped: 0 };

  } catch (error) {
    console.error('[FollowUp] Error scheduling auto follow-ups:', error);
    throw error;
  }
}

/**
 * Cancel pending follow-ups for a quote
 * (Used when quote is converted, rejected, or cancelled)
 */
export async function cancelPendingFollowUps(quoteId: number, motivo: string): Promise<number> {
  try {
    const result = await prisma.$executeRaw`
      UPDATE quote_follow_ups
      SET enviado = true,
          "enviadoAt" = NOW(),
          comentarios = ${`Cancelado: ${motivo}`}
      WHERE "quoteId" = ${quoteId}
        AND enviado = false
        AND "programadoPara" > NOW()
    `;

    console.log(`[FollowUp] Cancelled ${result} pending follow-ups for quote ${quoteId}`);
    return Number(result);

  } catch (error) {
    console.error('[FollowUp] Error cancelling follow-ups:', error);
    throw error;
  }
}

/**
 * Reschedule follow-ups when quote validity is extended
 */
export async function rescheduleFollowUps(
  quoteId: number,
  nuevaFechaValidez: Date
): Promise<{ rescheduled: number; cancelled: number }> {
  try {
    // Get current pending follow-ups
    const pending = await prisma.$queryRaw<any[]>`
      SELECT id, "programadoPara"
      FROM quote_follow_ups
      WHERE "quoteId" = ${quoteId}
        AND enviado = false
        AND tipo = 'AUTO'
    `;

    let rescheduled = 0;
    let cancelled = 0;

    for (const followUp of pending) {
      const programadoPara = new Date(followUp.programadoPara);

      if (programadoPara > nuevaFechaValidez) {
        // Cancel if now it's after new validity
        await prisma.$executeRaw`
          UPDATE quote_follow_ups
          SET enviado = true,
              "enviadoAt" = NOW(),
              comentarios = 'Cancelado: fuera de nueva fecha de validez'
          WHERE id = ${followUp.id}
        `;
        cancelled++;
      } else {
        // Keep it scheduled
        rescheduled++;
      }
    }

    console.log(`[FollowUp] Rescheduled ${rescheduled}, cancelled ${cancelled} for quote ${quoteId}`);
    return { rescheduled, cancelled };

  } catch (error) {
    console.error('[FollowUp] Error rescheduling follow-ups:', error);
    throw error;
  }
}

/**
 * Get follow-up statistics for a company
 */
export async function getFollowUpStats(companyId: number, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const stats = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN enviado = true THEN 1 ELSE 0 END) as enviados,
      SUM(CASE WHEN enviado = false THEN 1 ELSE 0 END) as pendientes,
      SUM(CASE WHEN respondido = true THEN 1 ELSE 0 END) as respondidos,
      SUM(CASE WHEN "errorEnvio" IS NOT NULL THEN 1 ELSE 0 END) as errores,
      AVG(CASE
        WHEN respondido = true AND "respuestaAt" IS NOT NULL AND "enviadoAt" IS NOT NULL
        THEN EXTRACT(EPOCH FROM ("respuestaAt" - "enviadoAt")) / 3600
      END) as "avgHorasRespuesta"
    FROM quote_follow_ups
    WHERE "companyId" = ${companyId}
      AND "createdAt" >= ${since}
  `;

  const byResultado = await prisma.$queryRaw<any[]>`
    SELECT
      resultado,
      COUNT(*) as count
    FROM quote_follow_ups
    WHERE "companyId" = ${companyId}
      AND "createdAt" >= ${since}
      AND resultado IS NOT NULL
    GROUP BY resultado
  `;

  return {
    period: { days, since },
    totals: stats[0],
    byResultado: byResultado.reduce((acc, r) => {
      acc[r.resultado] = parseInt(r.count);
      return acc;
    }, {} as Record<string, number>)
  };
}
