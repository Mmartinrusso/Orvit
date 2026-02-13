import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Auto-conectar bot de Discord solo en desarrollo
    // Usamos import() con variable para evitar que el bundler analice el archivo
    if (process.env.NODE_ENV === 'development') {
      const modulePath = './instrumentation-node';
      import(modulePath).then((mod) => {
        mod.autoConnectDiscordBot();
      }).catch((err) => {
        console.error('Error loading instrumentation-node:', err);
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
