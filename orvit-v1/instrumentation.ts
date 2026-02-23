import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Discord bot ahora corre como servicio separado en Railway
    // Ya no se auto-conecta desde el proceso Next.js
    // Ver: discord-bot/ (standalone service)
    console.log('ℹ️ [Discord Bot] Bot corre como servicio externo (Railway)');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
