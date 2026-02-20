import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Auto-conectar bot de Discord al iniciar el servidor (dev y prod)
    // Usamos variable en import() para evitar que webpack analice el módulo
    // en el bundle de edge (discord.js y prisma no pueden correr en edge runtime)
    const botModule = './instrumentation-node';
    import(botModule).then((mod) => {
      mod.autoConnectDiscordBot();
    }).catch((err) => {
      console.error('[Discord Bot] Error cargando auto-connect:', err);
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
