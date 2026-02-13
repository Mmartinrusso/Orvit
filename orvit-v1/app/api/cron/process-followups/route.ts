import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendQuoteEmail } from '@/lib/ventas/email-service';

export const dynamic = 'force-dynamic';

/**
 * CRON JOB - Process pending follow-ups
 * Should be called every 15 minutes
 *
 * Vercel Cron: 0,15,30,45 * * * *
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    console.log('[CRON] Processing follow-ups at:', now.toISOString());

    // Get pending follow-ups that should be sent
    const pendingFollowUps = await prisma.$queryRaw<any[]>`
      SELECT
        f.*,
        q.numero as "quoteNumber",
        q."clientId",
        q.total as "quoteTotal",
        q.moneda as "quoteMoneda",
        c.email as "clientEmail",
        c."legalName" as "clientName",
        u.name as "sellerName",
        u.email as "sellerEmail",
        comp.name as "companyName"
      FROM quote_follow_ups f
      INNER JOIN quotes q ON q.id = f."quoteId"
      INNER JOIN "Client" c ON c.id = q."clientId"
      LEFT JOIN "User" u ON u.id = q."sellerId"
      INNER JOIN "Company" comp ON comp.id = f."companyId"
      WHERE f.enviado = false
        AND f."programadoPara" <= ${now}
        AND q.estado NOT IN ('CONVERTIDA', 'RECHAZADA', 'CANCELADA')
      ORDER BY f."programadoPara" ASC
      LIMIT 100
    `;

    console.log(`[CRON] Found ${pendingFollowUps.length} pending follow-ups`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as any[]
    };

    for (const followUp of pendingFollowUps) {
      results.processed++;

      try {
        let sent = false;
        let errorMsg = null;

        // Process based on channel
        switch (followUp.canal) {
          case 'EMAIL':
            if (!followUp.clientEmail) {
              errorMsg = 'Cliente sin email configurado';
              results.skipped++;
              break;
            }

            // Send email
            const emailResult = await sendQuoteEmail({
              quoteNumber: followUp.quoteNumber,
              clientName: followUp.clientName,
              clientEmail: followUp.clientEmail,
              companyName: followUp.companyName,
              total: Number(followUp.quoteTotal),
              moneda: followUp.quoteMoneda,
              validUntil: null, // Follow-up doesn't need this
            });

            if (emailResult.success) {
              sent = true;
              results.sent++;
            } else {
              errorMsg = emailResult.error || 'Error al enviar email';
              results.failed++;
            }
            break;

          case 'WHATSAPP':
            // TODO: Integrate with WhatsApp API
            console.log(`[FOLLOWUP] WhatsApp not implemented for follow-up ${followUp.id}`);
            errorMsg = 'WhatsApp no implementado aún';
            results.skipped++;
            break;

          case 'INTERNO':
            // Just mark as sent (internal notification)
            sent = true;
            results.sent++;
            break;

          case 'LLAMADA':
            // Manual action required, just mark as sent to remove from queue
            sent = true;
            results.sent++;
            break;

          default:
            errorMsg = `Canal desconocido: ${followUp.canal}`;
            results.skipped++;
        }

        // Update follow-up status
        await prisma.$executeRaw`
          UPDATE quote_follow_ups
          SET enviado = ${sent},
              "enviadoAt" = ${sent ? now : null},
              "errorEnvio" = ${errorMsg}
          WHERE id = ${followUp.id}
        `;

      } catch (error: any) {
        console.error(`[FOLLOWUP] Error processing follow-up ${followUp.id}:`, error);
        results.failed++;
        results.errors.push({
          followUpId: followUp.id,
          error: error.message
        });

        // Update with error
        await prisma.$executeRaw`
          UPDATE quote_follow_ups
          SET "errorEnvio" = ${error.message}
          WHERE id = ${followUp.id}
        `;
      }
    }

    console.log('[CRON] Follow-ups processing completed:', results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results
    });

  } catch (error: any) {
    console.error('[CRON] Critical error processing follow-ups:', error);
    return NextResponse.json(
      { error: 'Error processing follow-ups', details: error.message },
      { status: 500 }
    );
  }
}
